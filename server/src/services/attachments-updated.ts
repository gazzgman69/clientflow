import { db } from "../../db";
import { emailAttachments, emails } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import type { EmailAttachment } from "@shared/schema";
import { gmailService } from "./gmail";
import { fileStorage, generateFileKey, validateFile } from "./fileStorageService";

/**
 * Modern AttachmentsService using the new file storage abstraction
 * 
 * This service manages email attachments using the new storage interface,
 * which supports both local filesystem and cloud storage (S3, etc.) seamlessly.
 */
export class AttachmentsService {
  constructor() {
    // No need for manual directory creation - handled by storage abstraction
  }

  /**
   * Get attachment metadata by ID
   */
  async getAttachment(attachmentId: string): Promise<EmailAttachment | null> {
    try {
      const [attachment] = await db
        .select()
        .from(emailAttachments)
        .where(eq(emailAttachments.id, attachmentId))
        .limit(1);

      return attachment || null;
    } catch (error) {
      console.error('Error fetching attachment:', error);
      return null;
    }
  }

  /**
   * Get all attachments for an email
   */
  async getEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
    try {
      const attachments = await db
        .select()
        .from(emailAttachments)
        .where(eq(emailAttachments.emailId, emailId));

      return attachments;
    } catch (error) {
      console.error('Error fetching email attachments:', error);
      return [];
    }
  }

  /**
   * Download attachment from Gmail and store using file storage abstraction
   */
  async downloadAttachment(
    attachmentId: string, 
    userId: string
  ): Promise<{ success: boolean; filePath?: string; error?: string; storageKey?: string }> {
    try {
      // Get attachment metadata
      const attachment = await this.getAttachment(attachmentId);
      if (!attachment) {
        return { success: false, error: 'Attachment not found' };
      }

      // Generate storage key for the file
      const storageKey = generateFileKey(attachment.filename, 'attachments');
      
      // Check if file already exists in storage
      const exists = await fileStorage.exists(storageKey);
      if (exists) {
        return { success: true, storageKey };
      }

      // Get the email to extract Gmail message ID
      const [emailResult] = await db
        .select({ providerMessageId: emails.providerMessageId })
        .from(emails)
        .where(eq(emails.id, attachment.emailId))
        .limit(1);

      if (!emailResult?.providerMessageId) {
        return { success: false, error: 'Gmail message ID not found' };
      }

      // Download attachment data from Gmail  
      // Note: storageKey contains Gmail attachment ID until we migrate the schema
      const attachmentData = await gmailService.getAttachmentData(
        userId,
        emailResult.providerMessageId,
        attachment.storageKey // Gmail attachment ID (needs schema migration)
      );

      if (!attachmentData) {
        return { success: false, error: 'Failed to download attachment from Gmail' };
      }

      // Validate the file before storing
      const validation = validateFile(
        attachmentData,
        attachment.filename,
        undefined, // No MIME type restrictions for email attachments
        50 * 1024 * 1024 // 50MB max size
      );

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Store file using the abstraction
      const storageResult = await fileStorage.save(storageKey, attachmentData, {
        filename: attachment.filename,
        mimeType: attachment.mimeType || undefined,
        size: attachmentData.length,
        customMetadata: {
          emailId: attachment.emailId,
          attachmentId: attachmentId,
          userId: userId,
        },
      });

      if (!storageResult.success) {
        return { success: false, error: storageResult.error };
      }

      // TODO: Schema migration needed - storageKey currently holds Gmail ID
      // For now, we'll store the file storage key in a comment or separate field
      // await db
      //   .update(emailAttachments)
      //   .set({ 
      //     fileStorageKey: storageKey, // New field needed
      //     size: attachmentData.length 
      //   })
      //   .where(eq(emailAttachments.id, attachmentId));\n      \n      console.log(`📝 TODO: Update database schema to separate Gmail ID from file storage key`);"}

      console.log(`✅ Downloaded and stored attachment: ${attachment.filename} (${attachmentData.length} bytes)`);

      return { 
        success: true, 
        storageKey,
        filePath: storageKey // For backward compatibility
      };
    } catch (error: any) {
      console.error(`❌ Error downloading attachment ${attachmentId}:`, error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  /**
   * Get attachment file data
   */
  async getAttachmentData(attachmentId: string): Promise<Buffer | null> {
    try {
      const attachment = await this.getAttachment(attachmentId);
      if (!attachment || !attachment.storageKey) {
        return null;
      }

      return await fileStorage.get(attachment.storageKey);
    } catch (error) {
      console.error(`Error retrieving attachment data for ${attachmentId}:`, error);
      return null;
    }
  }

  /**
   * Save uploaded file using storage abstraction
   */
  async saveUploadedFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype?: string;
      size: number;
    },
    metadata: {
      emailId?: string;
      userId?: string;
      description?: string;
    } = {}
  ): Promise<{ success: boolean; storageKey?: string; error?: string }> {
    try {
      // Validate the uploaded file
      const validation = validateFile(
        file.buffer,
        file.originalname,
        undefined, // No restrictions by default
        50 * 1024 * 1024 // 50MB max
      );

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Generate storage key
      const storageKey = generateFileKey(file.originalname, 'uploads');

      // Store file using abstraction
      const storageResult = await fileStorage.save(storageKey, file.buffer, {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        customMetadata: {
          emailId: metadata.emailId || '',
          userId: metadata.userId || '',
          description: metadata.description || '',
          uploadedAt: new Date().toISOString(),
        },
      });

      if (!storageResult.success) {
        return { success: false, error: storageResult.error };
      }

      console.log(`✅ Uploaded file stored: ${file.originalname} (${file.size} bytes)`);

      return { success: true, storageKey };
    } catch (error: any) {
      console.error('Error saving uploaded file:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  /**
   * Delete attachment file and metadata
   */
  async deleteAttachment(attachmentId: string): Promise<boolean> {
    try {
      const attachment = await this.getAttachment(attachmentId);
      if (!attachment) {
        return false;
      }

      // Delete file from storage if storage key exists
      if (attachment.storageKey) {
        await fileStorage.delete(attachment.storageKey);
      }

      // Delete metadata from database
      const result = await db
        .delete(emailAttachments)
        .where(eq(emailAttachments.id, attachmentId));

      console.log(`✅ Deleted attachment: ${attachment.filename}`);
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting attachment ${attachmentId}:`, error);
      return false;
    }
  }

  /**
   * Clean up old attachments (files older than specified days)
   * Uses the storage abstraction for efficient cleanup
   */
  async cleanupOldAttachments(daysOld: number = 30): Promise<number> {
    try {
      console.log(`🧹 Starting cleanup of attachments older than ${daysOld} days...`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Get old attachments from database
      const oldAttachments = await db
        .select()
        .from(emailAttachments)
        .where(lt(emailAttachments.createdAt, cutoffDate));

      if (oldAttachments.length === 0) {
        console.log('No old attachments to clean up');
        return 0;
      }

      // Extract storage keys for batch deletion
      const storageKeys = oldAttachments
        .filter(attachment => attachment.storageKey)
        .map(attachment => attachment.storageKey!);

      // Delete files from storage in batch
      let deletedFileCount = 0;
      if (storageKeys.length > 0) {
        deletedFileCount = await fileStorage.deleteMultiple(storageKeys);
      }

      // Delete metadata from database
      const deletedRecords = await db
        .delete(emailAttachments)
        .where(lt(emailAttachments.createdAt, cutoffDate));

      const cleanedCount = deletedRecords.rowCount || 0;

      console.log(`✅ Cleanup completed: ${cleanedCount} records deleted, ${deletedFileCount} files removed`);

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up attachments:', error);
      return 0;
    }
  }

  /**
   * Get storage statistics for monitoring
   */
  async getStorageStats(): Promise<{
    totalAttachments: number;
    totalSize: number;
    provider: string;
  } | null> {
    try {
      // Get database statistics
      const attachmentCount = await db
        .select()
        .from(emailAttachments);

      const totalAttachments = attachmentCount.length;
      const totalSizeFromDB = attachmentCount.reduce((sum, att) => sum + (att.size || 0), 0);

      // Get storage provider stats if available
      const storageStats = await fileStorage.getStats?.();

      return {
        totalAttachments,
        totalSize: storageStats?.totalSize || totalSizeFromDB,
        provider: storageStats?.provider || 'unknown',
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return null;
    }
  }

  /**
   * Copy file from one storage location to another
   */
  async copyAttachment(sourceAttachmentId: string, destinationKey: string): Promise<boolean> {
    try {
      const attachment = await this.getAttachment(sourceAttachmentId);
      if (!attachment || !attachment.storageKey) {
        return false;
      }

      // Use storage abstraction copy if available
      if (fileStorage.copy) {
        return await fileStorage.copy(attachment.storageKey, destinationKey);
      }

      // Fallback: read and write
      const data = await fileStorage.get(attachment.storageKey);
      if (!data) {
        return false;
      }

      const result = await fileStorage.save(destinationKey, data, {
        filename: attachment.filename,
        mimeType: attachment.mimeType || undefined,
        size: data.length,
      });

      return result.success;
    } catch (error) {
      console.error(`Error copying attachment ${sourceAttachmentId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const attachmentsService = new AttachmentsService();