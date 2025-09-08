import crypto from 'crypto';

/**
 * SecureStore service for encrypting/decrypting sensitive data at rest
 * Uses AES-256-GCM encryption with a derived key from environment variable
 */
export class SecureStore {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  
  private encryptionKey: Buffer | null = null;

  constructor() {
    this.initializeKey();
  }

  private initializeKey() {
    // Use a master key from environment, or generate a default for development
    const masterKey = process.env.ENCRYPTION_MASTER_KEY || 'default-dev-key-change-in-production-please-2024';
    
    // Derive a proper encryption key using PBKDF2
    this.encryptionKey = crypto.pbkdf2Sync(
      masterKey,
      'BusinessCRM-MailSettings-Salt', // Static salt for consistency
      100000, // iterations
      this.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt a plaintext string
   * Returns: base64-encoded encrypted data with IV and auth tag
   */
  encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    if (!plaintext || plaintext.trim() === '') {
      return ''; // Don't encrypt empty values
    }

    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('BusinessCRM')); // Additional authenticated data
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine IV + tag + encrypted data and encode as base64
      const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
      return combined.toString('base64');
      
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a base64-encoded encrypted string
   * Returns: plaintext string
   */
  decrypt(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    if (!encryptedData || encryptedData.trim() === '') {
      return ''; // Return empty for empty encrypted values
    }

    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      if (combined.length < this.ivLength + this.tagLength) {
        throw new Error('Invalid encrypted data format');
      }
      
      // Extract IV, tag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const tag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAAD(Buffer.from('BusinessCRM')); // Same AAD as encryption
      decipher.setAuthTag(tag);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data - data may be corrupted or key changed');
    }
  }

  /**
   * Test if encryption/decryption is working properly
   */
  test(): boolean {
    try {
      const testString = 'test-encryption-' + Date.now();
      const encrypted = this.encrypt(testString);
      const decrypted = this.decrypt(encrypted);
      return testString === decrypted;
    } catch (error) {
      console.error('SecureStore test failed:', error);
      return false;
    }
  }

  /**
   * Encrypt an object's sensitive fields
   */
  encryptObject(obj: any, sensitiveFields: string[]): any {
    const result = { ...obj };
    
    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field]);
      }
    }
    
    return result;
  }

  /**
   * Decrypt an object's sensitive fields
   */
  decryptObject(obj: any, sensitiveFields: string[]): any {
    const result = { ...obj };
    
    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          result[field] = this.decrypt(result[field]);
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          result[field] = ''; // Set to empty on decryption failure
        }
      }
    }
    
    return result;
  }

  /**
   * Redact sensitive fields for client responses
   */
  redactObject(obj: any, sensitiveFields: string[]): any {
    const result = { ...obj };
    
    for (const field of sensitiveFields) {
      if (result[field]) {
        result[field] = '***REDACTED***';
      }
    }
    
    return result;
  }
}

// Export singleton instance
export const secureStore = new SecureStore();

// List of sensitive fields in mail settings
export const MAIL_SENSITIVE_FIELDS = [
  'imapPassword',
  'smtpPassword'
];