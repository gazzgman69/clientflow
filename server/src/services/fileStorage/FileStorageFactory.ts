import { IFileStorage, FileStorageConfig, FileStorageError } from '../interfaces/fileStorage';
import { LocalFileStorage } from './LocalFileStorage';
import { S3FileStorage } from './S3FileStorage';

/**
 * Factory for creating file storage instances based on configuration
 * 
 * This factory abstracts the creation of different storage providers,
 * making it easy to switch between local, S3, and other storage backends
 * through configuration alone.
 */
export class FileStorageFactory {
  /**
   * Create a file storage instance based on configuration
   * @param config File storage configuration
   * @returns IFileStorage implementation
   */
  static create(config: FileStorageConfig): IFileStorage {
    switch (config.provider) {
      case 'local':
        return new LocalFileStorage(config);
      
      case 's3':
        return new S3FileStorage(config);
      
      case 'gcs':
        throw new FileStorageError(
          'Google Cloud Storage provider not yet implemented',
          'PROVIDER_NOT_IMPLEMENTED'
        );
      
      case 'azure':
        throw new FileStorageError(
          'Azure Blob Storage provider not yet implemented',
          'PROVIDER_NOT_IMPLEMENTED'
        );
      
      default:
        throw new FileStorageError(
          `Unknown storage provider: ${config.provider}`,
          'UNKNOWN_PROVIDER'
        );
    }
  }

  /**
   * Create storage instance from environment variables
   * @returns IFileStorage implementation based on environment configuration
   */
  static createFromEnvironment(): IFileStorage {
    const provider = (process.env.FILE_STORAGE_PROVIDER || 'local') as FileStorageConfig['provider'];
    
    switch (provider) {
      case 'local':
        return FileStorageFactory.create({
          provider: 'local',
          local: {
            basePath: process.env.FILE_STORAGE_LOCAL_PATH || './storage',
            permissions: process.env.FILE_STORAGE_PERMISSIONS 
              ? parseInt(process.env.FILE_STORAGE_PERMISSIONS, 8) 
              : 0o644,
          },
          maxFileSize: process.env.FILE_STORAGE_MAX_SIZE 
            ? parseInt(process.env.FILE_STORAGE_MAX_SIZE) 
            : 50 * 1024 * 1024, // 50MB default
          allowedMimeTypes: process.env.FILE_STORAGE_ALLOWED_TYPES?.split(','),
        });

      case 's3':
        return FileStorageFactory.create({
          provider: 's3',
          s3: {
            bucket: process.env.AWS_S3_BUCKET || '',
            region: process.env.AWS_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            endpoint: process.env.AWS_S3_ENDPOINT, // For S3-compatible services
          },
          maxFileSize: process.env.FILE_STORAGE_MAX_SIZE 
            ? parseInt(process.env.FILE_STORAGE_MAX_SIZE) 
            : 50 * 1024 * 1024,
          allowedMimeTypes: process.env.FILE_STORAGE_ALLOWED_TYPES?.split(','),
          defaultExpiration: process.env.FILE_STORAGE_URL_EXPIRATION 
            ? parseInt(process.env.FILE_STORAGE_URL_EXPIRATION) 
            : 3600,
        });

      default:
        throw new FileStorageError(
          `Unsupported storage provider from environment: ${provider}`,
          'UNSUPPORTED_PROVIDER'
        );
    }
  }

  /**
   * Validate storage configuration
   * @param config Configuration to validate
   * @returns Boolean indicating if configuration is valid
   */
  static validateConfig(config: FileStorageConfig): boolean {
    try {
      // Basic provider validation
      if (!config.provider) {
        throw new Error('Provider is required');
      }

      // Provider-specific validation
      switch (config.provider) {
        case 'local':
          if (!config.local?.basePath) {
            throw new Error('Local basePath is required');
          }
          break;

        case 's3':
          if (!config.s3?.bucket || !config.s3?.region) {
            throw new Error('S3 bucket and region are required');
          }
          break;

        case 'gcs':
          if (!config.gcs?.bucket) {
            throw new Error('GCS bucket is required');
          }
          break;

        case 'azure':
          if (!config.azure?.accountName || !config.azure?.containerName) {
            throw new Error('Azure account name and container name are required');
          }
          break;
      }

      // Global validation
      if (config.maxFileSize && config.maxFileSize <= 0) {
        throw new Error('maxFileSize must be positive');
      }

      return true;
    } catch (error) {
      console.error('Storage configuration validation failed:', error);
      return false;
    }
  }

  /**
   * Get available storage providers
   * @returns Array of supported provider names
   */
  static getAvailableProviders(): string[] {
    return ['local', 's3']; // Add 'gcs', 'azure' when implemented
  }

  /**
   * Test storage connectivity
   * @param storage Storage instance to test
   * @returns Promise indicating if storage is accessible
   */
  static async testStorage(storage: IFileStorage): Promise<boolean> {
    try {
      // Test basic operations
      const testKey = `test_${Date.now()}.txt`;
      const testData = Buffer.from('Storage connectivity test');

      // Save test file
      const saveResult = await storage.save(testKey, testData, {
        filename: 'test.txt',
        mimeType: 'text/plain',
      });

      if (!saveResult.success) {
        console.error('Storage test failed - save operation:', saveResult.error);
        return false;
      }

      // Check if file exists
      const exists = await storage.exists(testKey);
      if (!exists) {
        console.error('Storage test failed - file not found after save');
        return false;
      }

      // Read file back
      const retrievedData = await storage.get(testKey);
      if (!retrievedData || !retrievedData.equals(testData)) {
        console.error('Storage test failed - data integrity check');
        return false;
      }

      // Clean up test file
      await storage.delete(testKey);

      console.log('Storage connectivity test passed');
      return true;
    } catch (error) {
      console.error('Storage connectivity test failed:', error);
      return false;
    }
  }
}