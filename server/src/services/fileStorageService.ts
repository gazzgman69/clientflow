/**
 * Global File Storage Service
 * 
 * Provides a singleton instance of the file storage system configured
 * for the current environment. This service abstracts file operations
 * and makes it easy to switch between different storage providers.
 */

import { FileStorageFactory } from './fileStorage/FileStorageFactory';
import { IFileStorage } from './interfaces/fileStorage';

/**
 * Singleton file storage instance
 * Configured based on environment variables or defaults to local storage
 */
export const fileStorage: IFileStorage = FileStorageFactory.createFromEnvironment();

/**
 * Initialize file storage and run connectivity test
 * This should be called during application startup
 */
export async function initializeFileStorage(): Promise<boolean> {
  try {
    console.log('🗄️ Initializing file storage...');
    
    // Test storage connectivity
    const isConnected = await FileStorageFactory.testStorage(fileStorage);
    
    if (isConnected) {
      console.log('✅ File storage initialized successfully');
      return true;
    } else {
      console.error('❌ File storage connectivity test failed');
      return false;
    }
  } catch (error) {
    console.error('❌ File storage initialization failed:', error);
    return false;
  }
}

/**
 * Get storage statistics for monitoring
 */
export async function getStorageStats() {
  try {
    if (fileStorage.getStats) {
      return await fileStorage.getStats();
    }
    return null;
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return null;
  }
}

/**
 * Generate a file key for storage
 * @param originalName Original filename
 * @param prefix Optional prefix for organization
 * @returns Unique storage key
 */
export function generateFileKey(originalName: string, prefix?: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  if (prefix) {
    return `${prefix}/${timestamp}_${randomSuffix}_${sanitizedName}`;
  }
  
  return `${timestamp}_${randomSuffix}_${sanitizedName}`;
}

/**
 * Validate file before storage
 * @param buffer File buffer
 * @param filename Original filename
 * @param allowedTypes Optional array of allowed MIME types
 * @param maxSize Optional maximum file size in bytes
 * @returns Validation result
 */
export function validateFile(
  buffer: Buffer,
  filename: string,
  allowedTypes?: string[],
  maxSize?: number
): { valid: boolean; error?: string } {
  // Check file size
  if (maxSize && buffer.length > maxSize) {
    return {
      valid: false,
      error: `File size ${buffer.length} exceeds maximum ${maxSize} bytes`
    };
  }

  // Check file type if specified
  if (allowedTypes && allowedTypes.length > 0) {
    // Basic MIME type detection from file extension
    const extension = filename.toLowerCase().split('.').pop();
    const mimeTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'zip': 'application/zip',
    };

    const detectedMimeType = extension ? mimeTypeMap[extension] : undefined;
    
    if (detectedMimeType && !allowedTypes.includes(detectedMimeType)) {
      return {
        valid: false,
        error: `File type ${detectedMimeType} not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }
  }

  return { valid: true };
}