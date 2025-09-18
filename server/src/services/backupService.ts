import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createTenantSqlExport, createTenantJsonExport } from './backupHelpers';

const pipelineAsync = promisify(pipeline);

/**
 * Encrypted database backup service
 * Creates daily encrypted backups with local filesystem storage
 */
export class BackupService {
  private readonly backupDir = '/tmp/backups';
  private readonly tenantBackupDir = '/tmp/tenant-backups';
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits

  constructor() {
    // Ensure backup directories exist
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
    if (!existsSync(this.tenantBackupDir)) {
      mkdirSync(this.tenantBackupDir, { recursive: true });
    }
  }

  /**
   * Create an encrypted database backup
   */
  async createBackup(): Promise<{ success: boolean; backupPath?: string; error?: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}.sql.enc`;
    const backupPath = join(this.backupDir, backupName);

    try {
      console.log(`💾 Starting encrypted database backup: ${backupName}`);

      // Validate encryption key
      const encryptionKey = this.getEncryptionKey();
      if (!encryptionKey) {
        throw new Error('BACKUP_ENCRYPTION_KEY environment variable is required');
      }

      // Create encrypted backup
      await this.createEncryptedDump(backupPath, encryptionKey);

      console.log(`✅ Encrypted backup created successfully: ${backupPath}`);
      
      // Clean up old backups (keep last 7 days)
      await this.cleanupOldBackups();

      return { success: true, backupPath };
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Create a per-tenant export (optional feature, config-controlled)
   * Exports only data belonging to a specific tenant
   */
  async createTenantExport(tenantId: string, options: {
    includeSchema?: boolean;
    format?: 'sql' | 'json';
    encrypt?: boolean;
  } = {}): Promise<{ success: boolean; exportPath?: string; error?: string }> {
    const { includeSchema = false, format = 'sql', encrypt = true } = options;
    
    try {
      // Check if per-tenant exports are enabled via config
      const { configService } = await import('./configService');
      const tenantExportsEnabled = await configService.getConfig('TENANT_EXPORTS_ENABLED', {
        defaultValue: 'false'
      });
      
      if (tenantExportsEnabled !== 'true') {
        return {
          success: false,
          error: 'Per-tenant exports are not enabled. Set TENANT_EXPORTS_ENABLED=true to enable.'
        };
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportName = `tenant_${tenantId}_${timestamp}.${format}${encrypt ? '.enc' : ''}`;
      const exportPath = join(this.tenantBackupDir, exportName);
      
      console.log(`📦 Starting tenant export for ${tenantId}: ${exportName}`);
      
      if (format === 'sql') {
        // SECURITY: SQL export via pg_dump is currently unsafe for tenant isolation
        // pg_dump doesn't support row-level WHERE filtering, and post-processing
        // filtering of SQL text is dangerous and can leak cross-tenant data
        return {
          success: false,
          error: 'SQL per-tenant export is currently disabled for security reasons. Please use JSON format instead.'
        };
      } else {
        const encryptionKey = encrypt ? this.getEncryptionKey() : null;
        await createTenantJsonExport(
          tenantId, 
          exportPath, 
          encrypt,
          encryptionKey,
          this.algorithm,
          this.ivLength
        );
      }
      
      console.log(`✅ Tenant export created successfully: ${exportPath}`);
      return { success: true, exportPath };
      
    } catch (error) {
      console.error(`❌ Tenant export failed for ${tenantId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Create encrypted PostgreSQL dump
   */
  private async createEncryptedDump(backupPath: string, encryptionKey: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      // Generate random IV for this backup
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, encryptionKey, iv);
      cipher.setAAD(Buffer.from('BusinessCRM_Backup')); // Additional authenticated data

      // Create write stream
      const writeStream = createWriteStream(backupPath);

      // Write IV and AAD identifier to the beginning of the file
      writeStream.write(iv);
      
      // Setup pg_dump process
      const pgDump = spawn('pg_dump', [
        process.env.DATABASE_URL!,
        '--no-password',
        '--verbose',
        '--format=plain',
        '--no-owner',
        '--no-privileges'
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderrData = '';
      
      // Capture stderr for error reporting (without sensitive data)
      pgDump.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      // Handle pg_dump errors
      pgDump.on('error', (error) => {
        writeStream.destroy();
        reject(new Error(`pg_dump process error: ${error.message}`));
      });

      pgDump.on('exit', (code) => {
        if (code !== 0) {
          writeStream.destroy();
          // Filter sensitive information from stderr
          const filteredError = stderrData.replace(/password=[^&\s]*/gi, 'password=***');
          reject(new Error(`pg_dump failed with code ${code}: ${filteredError}`));
        }
      });

      // Setup encryption pipeline: pg_dump stdout -> cipher -> file
      pipeline(
        pgDump.stdout,
        cipher,
        writeStream,
        (error) => {
          if (error) {
            reject(new Error(`Encryption pipeline error: ${error.message}`));
          } else {
            // Write the auth tag at the end
            const authTag = cipher.getAuthTag();
            writeStream.write(authTag, (err) => {
              if (err) {
                reject(new Error(`Failed to write auth tag: ${err.message}`));
              } else {
                writeStream.end();
                resolve();
              }
            });
          }
        }
      );
    });
  }

  /**
   * Get and validate encryption key
   */
  private getEncryptionKey(): Buffer | null {
    const masterKey = process.env.BACKUP_ENCRYPTION_KEY;
    
    if (!masterKey) {
      console.error('❌ BACKUP_ENCRYPTION_KEY environment variable is required');
      return null;
    }
    
    if (masterKey.length < 32) {
      console.error('❌ BACKUP_ENCRYPTION_KEY must be at least 32 characters long');
      return null;
    }
    
    // Derive a proper encryption key using PBKDF2
    return crypto.pbkdf2Sync(
      masterKey,
      'BusinessCRM-Backup-Salt', // Static salt for consistency
      100000, // iterations
      this.keyLength,
      'sha256'
    );
  }

  /**
   * Clean up old backup files (keep last 7 days)
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(this.backupDir);
      
      const backupFiles = files
        .filter(file => file.startsWith('backup_') && file.endsWith('.sql.enc'))
        .map(file => ({
          name: file,
          path: join(this.backupDir, file),
          // Extract timestamp from filename
          timestamp: file.replace('backup_', '').replace('.sql.enc', '')
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort newest first

      // Keep the newest 7 backups, delete the rest
      const filesToDelete = backupFiles.slice(7);
      
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`🗑️ Cleaned up old backup: ${file.name}`);
      }

      if (filesToDelete.length > 0) {
        console.log(`🧹 Cleaned up ${filesToDelete.length} old backup(s), keeping ${Math.min(7, backupFiles.length)} most recent`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to clean up old backups:', error);
      // Don't throw - cleanup failure shouldn't fail the backup process
    }
    
    // Also clean up tenant exports if enabled
    await this.cleanupOldTenantExports();
  }
  
  /**
   * Clean up old tenant export files (keep last 30 days)
   */
  private async cleanupOldTenantExports(): Promise<void> {
    try {
      const { configService } = await import('./configService');
      const tenantExportsEnabled = await configService.getConfig('TENANT_EXPORTS_ENABLED', {
        defaultValue: 'false'
      });
      
      if (tenantExportsEnabled !== 'true') {
        return;
      }
      
      const fs = await import('fs/promises');
      const files = await fs.readdir(this.tenantBackupDir);
      
      const exportFiles = files
        .filter(file => file.startsWith('tenant_') && (file.endsWith('.sql') || file.endsWith('.json') || file.endsWith('.enc')))
        .map(file => ({
          name: file,
          path: join(this.tenantBackupDir, file),
          // Extract timestamp from filename
          timestamp: file.split('_')[2]?.replace(/\.(sql|json)(\.enc)?$/, '') || ''
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort newest first

      // Keep the newest 30 exports per tenant, delete the rest
      const filesToDelete = exportFiles.slice(30);
      
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`🗑️ Cleaned up old tenant export: ${file.name}`);
      }

      if (filesToDelete.length > 0) {
        console.log(`🧹 Cleaned up ${filesToDelete.length} old tenant export(s)`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to clean up old tenant exports:', error);
    }
  }

  /**
   * Restore from an encrypted backup (for documentation/testing)
   * NOTE: This is for reference only - actual restore should be done manually with proper safeguards
   */
  async restoreFromBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate encryption key
      const encryptionKey = this.getEncryptionKey();
      if (!encryptionKey) {
        throw new Error('BACKUP_ENCRYPTION_KEY environment variable is required for restore');
      }

      console.log('⚠️ RESTORE OPERATION - This will overwrite the current database');
      console.log('🔐 Decrypting and restoring backup:', backupPath);

      await this.restoreEncryptedDump(backupPath, encryptionKey);

      console.log('✅ Database restore completed successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Restore failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Restore encrypted PostgreSQL dump
   */
  private async restoreEncryptedDump(backupPath: string, encryptionKey: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      
      // Read the encrypted file
      const encryptedData = fs.readFileSync(backupPath);
      
      // Extract IV from the beginning of the file
      const iv = encryptedData.slice(0, this.ivLength);
      
      // Extract auth tag from the end (last 16 bytes)
      const tagLength = 16;
      const authTag = encryptedData.slice(-tagLength);
      
      // Extract encrypted content (between IV and auth tag)
      const encryptedContent = encryptedData.slice(this.ivLength, -tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, encryptionKey, iv);
      decipher.setAAD(Buffer.from('BusinessCRM_Backup'));
      decipher.setAuthTag(authTag);
      
      try {
        // Decrypt the content
        let decrypted = decipher.update(encryptedContent, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        
        // Setup psql process for restore
        const psql = spawn('psql', [
          process.env.DATABASE_URL!,
          '--no-password',
          '--quiet'
        ], {
          stdio: ['pipe', 'inherit', 'pipe']
        });

        let stderrData = '';
        
        psql.stderr.on('data', (data) => {
          stderrData += data.toString();
        });

        psql.on('error', (error) => {
          reject(new Error(`psql process error: ${error.message}`));
        });

        psql.on('exit', (code) => {
          if (code !== 0) {
            const filteredError = stderrData.replace(/password=[^&\s]*/gi, 'password=***');
            reject(new Error(`psql failed with code ${code}: ${filteredError}`));
          } else {
            resolve();
          }
        });

        // Send decrypted SQL to psql
        psql.stdin.write(decrypted);
        psql.stdin.end();
        
      } catch (error) {
        reject(new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Get backup status and available backups
   */
  async getBackupStatus(): Promise<{
    lastBackup?: string;
    totalBackups: number;
    backupDir: string;
    backups: Array<{ name: string; size: number; created: Date }>;
  }> {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(this.backupDir);
      
      const backupFiles = await Promise.all(
        files
          .filter(file => file.startsWith('backup_') && file.endsWith('.sql.enc'))
          .map(async file => {
            const filePath = join(this.backupDir, file);
            const stats = await fs.stat(filePath);
            return {
              name: file,
              size: stats.size,
              created: stats.birthtime
            };
          })
      );

      backupFiles.sort((a, b) => b.created.getTime() - a.created.getTime());

      return {
        lastBackup: backupFiles[0]?.name,
        totalBackups: backupFiles.length,
        backupDir: this.backupDir,
        backups: backupFiles
      };
    } catch (error) {
      console.error('Failed to get backup status:', error);
      return {
        totalBackups: 0,
        backupDir: this.backupDir,
        backups: []
      };
    }
  }
}

// Export singleton instance
export const backupService = new BackupService();