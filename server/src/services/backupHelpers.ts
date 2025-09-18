import { spawn } from 'child_process';
import { createWriteStream, WriteStream } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

/**
 * Helper methods for tenant-specific backup operations
 */

/**
 * Create SQL export for a specific tenant
 */
export async function createTenantSqlExport(
  tenantId: string, 
  exportPath: string, 
  includeSchema: boolean, 
  encrypt: boolean,
  encryptionKey: Buffer | null,
  algorithm: string,
  ivLength: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Tables that contain tenant data
    const tenantTables = [
      'users', 'contacts', 'projects', 'leads', 'quotes', 'contracts', 
      'invoices', 'tasks', 'emails', 'email_threads', 'activities', 
      'automations', 'members', 'venues', 'sms_messages', 'message_templates'
    ];
    
    let writeStream: WriteStream;
    let cipher: crypto.Cipher | null = null;
    
    if (encrypt) {
      if (!encryptionKey) {
        return reject(new Error('Encryption key required for encrypted export'));
      }
      
      const iv = crypto.randomBytes(ivLength);
      cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
      cipher.setAAD(Buffer.from(`BusinessCRM_TenantExport_${tenantId}`));
      
      writeStream = createWriteStream(exportPath);
      writeStream.write(iv); // Write IV first
    } else {
      writeStream = createWriteStream(exportPath);
    }
    
    // Build pg_dump command with tenant-specific WHERE clauses
    const pgDumpArgs = [
      process.env.DATABASE_URL!,
      '--no-password',
      '--format=plain',
      '--no-owner',
      '--no-privileges'
    ];
    
    if (!includeSchema) {
      pgDumpArgs.push('--data-only');
    }
    
    // Add table filters for tenant tables only
    tenantTables.forEach(table => {
      pgDumpArgs.push(`--table=${table}`);
    });
    
    const pgDump = spawn('pg_dump', pgDumpArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let sqlData = '';
    
    pgDump.stdout.on('data', (data) => {
      sqlData += data.toString();
    });
    
    pgDump.stdout.on('end', () => {
      try {
        // Filter SQL to only include tenant-specific data
        const filteredSql = filterSqlByTenant(sqlData, tenantId, tenantTables);
        
        if (encrypt && cipher) {
          cipher.write(filteredSql);
          cipher.end();
          
          cipher.on('end', () => {
            const tag = cipher!.getAuthTag();
            writeStream.write(tag);
            writeStream.end();
          });
          
          cipher.pipe(writeStream);
        } else {
          writeStream.write(filteredSql);
          writeStream.end();
        }
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    pgDump.stderr.on('data', (data) => {
      console.error('pg_dump stderr:', data.toString());
    });
    
    pgDump.on('error', reject);
    pgDump.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump exited with code ${code}`));
      }
    });
  });
}

/**
 * Create JSON export for a specific tenant
 */
export async function createTenantJsonExport(
  tenantId: string, 
  exportPath: string, 
  encrypt: boolean,
  encryptionKey: Buffer | null,
  algorithm: string,
  ivLength: number
): Promise<void> {
  const { storage } = await import('../../storage');
  
  // Get tenant-scoped storage
  const tenantStorage = storage.withTenant(tenantId);
  
  // Export all tenant data
  const exportData = {
    tenantId,
    exportedAt: new Date().toISOString(),
    data: {
      users: await tenantStorage.getUsers(),
      contacts: await tenantStorage.getContacts(),
      projects: await tenantStorage.getProjects(),
      leads: await tenantStorage.getLeads(),
      quotes: await tenantStorage.getQuotes(),
      contracts: await tenantStorage.getContracts(),
      invoices: await tenantStorage.getInvoices(),
      tasks: await tenantStorage.getTasks(),
      emails: await tenantStorage.getEmails(),
      activities: await tenantStorage.getActivities(),
      automations: await tenantStorage.getAutomations()
    }
  };
  
  const jsonData = JSON.stringify(exportData, null, 2);
  
  if (encrypt) {
    if (!encryptionKey) {
      throw new Error('Encryption key required for encrypted export');
    }
    
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
    cipher.setAAD(Buffer.from(`BusinessCRM_TenantExport_${tenantId}`));
    
    const writeStream = createWriteStream(exportPath);
    writeStream.write(iv);
    
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    const encryptedData = Buffer.concat([Buffer.from(encrypted, 'hex'), tag]);
    
    writeStream.write(encryptedData);
    writeStream.end();
  } else {
    const writeStream = createWriteStream(exportPath);
    writeStream.write(jsonData);
    writeStream.end();
  }
}

/**
 * Filter SQL dump to only include data for a specific tenant
 */
export function filterSqlByTenant(sqlData: string, tenantId: string, tenantTables: string[]): string {
  const lines = sqlData.split('\n');
  const filteredLines: string[] = [];
  let insideInsert = false;
  let currentTable = '';
  
  for (const line of lines) {
    // Check for INSERT statements
    const insertMatch = line.match(/^INSERT INTO \"?([^\"\\s]+)\"?/);
    if (insertMatch) {
      currentTable = insertMatch[1];
      insideInsert = true;
      
      // Only include if it's a tenant table and contains the tenant ID
      if (tenantTables.includes(currentTable) && line.includes(`'${tenantId}'`)) {
        filteredLines.push(line);
      }
      continue;
    }
    
    // Handle multi-line INSERT statements
    if (insideInsert) {
      if (line.trim() === '' || line.startsWith('--') || line.match(/^\\s*$/)) {
        insideInsert = false;
        if (tenantTables.includes(currentTable)) {
          filteredLines.push(line);
        }
      } else if (tenantTables.includes(currentTable) && line.includes(`'${tenantId}'`)) {
        filteredLines.push(line);
      }
      continue;
    }
    
    // Include schema and other non-data lines
    if (!line.match(/^INSERT INTO/)) {
      filteredLines.push(line);
    }
  }
  
  return filteredLines.join('\n');
}