import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { 
  IFileStorage, 
  FileMetadata, 
  FileStorageResult, 
  FileStorageConfig,
  FileNotFoundError,
  FileStorageError 
} from '../interfaces/fileStorage';

/**
 * Local filesystem implementation of IFileStorage
 * 
 * Stores files on the local filesystem with metadata stored alongside.
 * This implementation is suitable for development and single-server deployments.
 */
export class LocalFileStorage implements IFileStorage {
  private basePath: string;
  private metadataPath: string;
  private permissions: number;

  constructor(config: FileStorageConfig) {
    if (!config.local) {
      throw new FileStorageError('Local storage configuration required', 'CONFIG_MISSING');
    }

    this.basePath = path.resolve(config.local.basePath);
    this.metadataPath = path.join(this.basePath, '.metadata');
    this.permissions = config.local.permissions || 0o644;

    // Ensure directories exist
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(this.metadataPath, { recursive: true });
    } catch (error) {
      throw new FileStorageError(
        `Failed to initialize storage directories: ${error}`,
        'INIT_FAILED'
      );
    }
  }

  /**
   * Generate safe file path from key
   */
  private getFilePath(key: string): string {
    // Normalize path and prevent directory traversal
    const normalizedKey = path.normalize(key).replace(/\.\./g, '');
    // Ensure key doesn't start with / or \
    const sanitizedKey = normalizedKey.replace(/^[\/\\]+/, '');
    return path.join(this.basePath, sanitizedKey);
  }

  /**
   * Generate metadata file path from key
   */
  private getMetadataFilePath(key: string): string {
    // Use same sanitization as getFilePath but add .json extension
    const normalizedKey = path.normalize(key).replace(/\.\./g, '');
    const sanitizedKey = normalizedKey.replace(/^[\/\\]+/, '').replace(/\//g, '_');
    return path.join(this.metadataPath, `${sanitizedKey}.json`);
  }

  async save(key: string, data: Buffer | NodeJS.ReadableStream, metadata?: FileMetadata): Promise<FileStorageResult> {
    try {
      const filePath = this.getFilePath(key);
      const metadataFilePath = this.getMetadataFilePath(key);

      // Ensure parent directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Save file data
      if (Buffer.isBuffer(data)) {
        await fs.writeFile(filePath, data, { mode: this.permissions });
      } else {
        // Handle stream data
        const writeStream = createWriteStream(filePath, { mode: this.permissions });
        await pipeline(data, writeStream);
      }

      // Save metadata
      const fileStats = await fs.stat(filePath);
      const fileMetadata: FileMetadata = {
        filename: metadata?.filename || path.basename(key),
        mimeType: metadata?.mimeType,
        size: fileStats.size,
        createdAt: fileStats.birthtime,
        customMetadata: metadata?.customMetadata || {},
      };

      await fs.writeFile(
        metadataFilePath, 
        JSON.stringify(fileMetadata, null, 2),
        { mode: this.permissions }
      );

      return {
        success: true,
        key,
        metadata: fileMetadata,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to save file: ${error.message}`,
      };
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const filePath = this.getFilePath(key);
      
      if (!existsSync(filePath)) {
        return null;
      }

      return await fs.readFile(filePath);
    } catch (error) {
      console.error(`Error reading file ${key}:`, error);
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      const metadataFilePath = this.getMetadataFilePath(key);

      // Delete both file and metadata
      const deletePromises = [
        fs.unlink(filePath).catch(() => false),
        fs.unlink(metadataFilePath).catch(() => false),
      ];

      const results = await Promise.all(deletePromises);
      return results.some(result => result !== false);
    } catch (error) {
      console.error(`Error deleting file ${key}:`, error);
      return false;
    }
  }

  async deleteMultiple(keys: string[]): Promise<number> {
    let deletedCount = 0;
    
    // Process deletions in parallel but limit concurrency
    const batchSize = 10;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(key => this.delete(key))
      );
      deletedCount += results.filter(Boolean).length;
    }

    return deletedCount;
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const metadataFilePath = this.getMetadataFilePath(key);
      
      if (!existsSync(metadataFilePath)) {
        return null;
      }

      const metadataContent = await fs.readFile(metadataFilePath, 'utf-8');
      return JSON.parse(metadataContent) as FileMetadata;
    } catch (error) {
      console.error(`Error reading metadata for ${key}:`, error);
      return null;
    }
  }

  async list(prefix?: string, limit?: number): Promise<string[]> {
    try {
      const files = await this.listFilesRecursively(this.basePath, '');
      
      let filteredFiles = files;
      
      if (prefix) {
        filteredFiles = files.filter(file => file.startsWith(prefix));
      }

      if (limit) {
        filteredFiles = filteredFiles.slice(0, limit);
      }

      return filteredFiles;
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  /**
   * Recursively list all files with their relative paths
   */
  private async listFilesRecursively(dir: string, relativePath: string): Promise<string[]> {
    const results: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        const relativeEntryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          // Skip metadata directory
          if (entry.name === '.metadata') continue;
          
          const subFiles = await this.listFilesRecursively(entryPath, relativeEntryPath);
          results.push(...subFiles);
        } else if (entry.isFile()) {
          results.push(relativeEntryPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
    
    return results;
  }

  async copy(sourceKey: string, destinationKey: string): Promise<boolean> {
    try {
      const sourcePath = this.getFilePath(sourceKey);
      const destinationPath = this.getFilePath(destinationKey);
      const sourceMetadataPath = this.getMetadataFilePath(sourceKey);
      const destinationMetadataPath = this.getMetadataFilePath(destinationKey);

      // Ensure source exists
      if (!existsSync(sourcePath)) {
        throw new FileNotFoundError(sourceKey);
      }

      // Copy file and metadata
      await Promise.all([
        fs.copyFile(sourcePath, destinationPath),
        fs.copyFile(sourceMetadataPath, destinationMetadataPath).catch(() => {
          // Metadata copy is optional
        }),
      ]);

      return true;
    } catch (error) {
      console.error(`Error copying file from ${sourceKey} to ${destinationKey}:`, error);
      return false;
    }
  }

  async getStats(): Promise<{ totalFiles: number; totalSize: number; provider: string }> {
    try {
      const files = await fs.readdir(this.basePath);
      let totalSize = 0;

      // Calculate total size
      for (const file of files) {
        const filePath = path.join(this.basePath, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch {
          // Skip files that can't be read
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        provider: 'local',
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        provider: 'local',
      };
    }
  }
}