/**
 * File Storage Abstraction Interface
 * 
 * Provides a unified interface for file storage operations that can work with
 * local filesystem, S3, or any other storage backend. This abstraction allows
 * for seamless migration between storage providers.
 */

export interface FileMetadata {
  filename: string;
  mimeType?: string;
  size?: number;
  createdAt?: Date;
  customMetadata?: Record<string, string>;
}

export interface FileStorageResult {
  success: boolean;
  key?: string;
  error?: string;
  metadata?: FileMetadata;
}

export interface IFileStorage {
  /**
   * Save a file to storage
   * @param key Unique identifier for the file
   * @param data File data as Buffer or ReadableStream
   * @param metadata Optional file metadata
   * @returns Promise with storage result including the final storage key
   */
  save(key: string, data: Buffer | NodeJS.ReadableStream, metadata?: FileMetadata): Promise<FileStorageResult>;

  /**
   * Retrieve a file from storage
   * @param key File identifier
   * @returns Promise with file data as Buffer or null if not found
   */
  get(key: string): Promise<Buffer | null>;

  /**
   * Check if a file exists in storage
   * @param key File identifier
   * @returns Promise with boolean indicating file existence
   */
  exists(key: string): Promise<boolean>;

  /**
   * Delete a file from storage
   * @param key File identifier
   * @returns Promise with boolean indicating successful deletion
   */
  delete(key: string): Promise<boolean>;

  /**
   * Delete multiple files from storage
   * @param keys Array of file identifiers
   * @returns Promise with number of successfully deleted files
   */
  deleteMultiple(keys: string[]): Promise<number>;

  /**
   * Get file metadata without downloading the file
   * @param key File identifier
   * @returns Promise with file metadata or null if not found
   */
  getMetadata(key: string): Promise<FileMetadata | null>;

  /**
   * List files matching a prefix pattern
   * @param prefix Optional prefix to filter files
   * @param limit Optional limit on number of results
   * @returns Promise with array of file keys
   */
  list(prefix?: string, limit?: number): Promise<string[]>;

  /**
   * Generate a temporary signed URL for file access (useful for S3)
   * @param key File identifier
   * @param expiresIn Expiration time in seconds (default: 3600)
   * @returns Promise with signed URL or null if not supported
   */
  getSignedUrl?(key: string, expiresIn?: number): Promise<string | null>;

  /**
   * Copy a file within storage
   * @param sourceKey Source file identifier
   * @param destinationKey Destination file identifier
   * @returns Promise with boolean indicating successful copy
   */
  copy?(sourceKey: string, destinationKey: string): Promise<boolean>;

  /**
   * Get storage statistics (useful for monitoring)
   * @returns Promise with storage statistics
   */
  getStats?(): Promise<{
    totalFiles: number;
    totalSize: number;
    provider: string;
  }>;
}

/**
 * File storage configuration interface
 */
export interface FileStorageConfig {
  provider: 'local' | 's3' | 'gcs' | 'azure';
  local?: {
    basePath: string;
    permissions?: number;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string; // For S3-compatible services
  };
  gcs?: {
    bucket: string;
    projectId: string;
    keyFilename?: string;
  };
  azure?: {
    accountName: string;
    accountKey: string;
    containerName: string;
  };
  // Global settings
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  retryAttempts?: number;
  defaultExpiration?: number; // For signed URLs
}

/**
 * File upload options
 */
export interface FileUploadOptions {
  filename?: string;
  mimeType?: string;
  metadata?: Record<string, string>;
  public?: boolean; // For cloud storage providers
  expires?: Date; // File expiration date
  overwrite?: boolean; // Allow overwriting existing files
}

/**
 * Error types for file storage operations
 */
export class FileStorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'FileStorageError';
  }
}

export class FileNotFoundError extends FileStorageError {
  constructor(key: string) {
    super(`File not found: ${key}`, 'FILE_NOT_FOUND', 404);
  }
}

export class FileSizeExceededError extends FileStorageError {
  constructor(size: number, limit: number) {
    super(`File size ${size} exceeds limit ${limit}`, 'FILE_SIZE_EXCEEDED', 413);
  }
}

export class InvalidFileTypeError extends FileStorageError {
  constructor(mimeType: string) {
    super(`Invalid file type: ${mimeType}`, 'INVALID_FILE_TYPE', 415);
  }
}