import { db } from "../../db";
import { emailAttachments, emails } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import type { EmailAttachment } from "@shared/schema";
import { gmailService } from "./gmail";
import fs from 'fs';
import path from 'path';

export class AttachmentsService {
  private attachmentsDir = path.join(process.cwd(), 'attachments');

  constructor() {
    // Ensure attachments directory exists
    if (!fs.existsSync(this.attachmentsDir)) {
      fs.mkdirSync(this.attachmentsDir, { recursive: true });
    }
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
   * Download attachment from Gmail and store locally
   */
  async downloadAttachment(
    attachmentId: string, 
    userId: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Get attachment metadata
      const attachment = await this.getAttachment(attachmentId);
      if (!attachment) {
        return { success: false, error: 'Attachment not found' };
      }

      // Check if file already exists locally
      const fileName = `${attachmentId}-${attachment.filename}`;
      const filePath = path.join(this.attachmentsDir, fileName);
      
      if (fs.existsSync(filePath)) {
        return { success: true, filePath };
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

      // Download from Gmail using the storage key (Gmail attachment ID)
      if (!attachment.storageKey) {
        return { success: false, error: 'Gmail attachment ID not found' };
      }

      // For now, we'll just return an error since Gmail attachment download
      // needs to be implemented in the gmail service
      return { success: false, error: 'Gmail attachment download not yet implemented' };
    } catch (error) {
      console.error('Error downloading attachment:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get file stream for attachment download
   */
  async getAttachmentStream(attachmentId: string, userId: string) {
    const downloadResult = await this.downloadAttachment(attachmentId, userId);
    
    if (!downloadResult.success || !downloadResult.filePath) {
      return null;
    }

    if (!fs.existsSync(downloadResult.filePath)) {
      return null;
    }

    return {
      stream: fs.createReadStream(downloadResult.filePath),
      attachment: await this.getAttachment(attachmentId)
    };
  }

  /**
   * Save uploaded attachment
   */
  async saveUploadedAttachment(
    emailId: string,
    file: {
      filename: string;
      mimetype: string;
      buffer: Buffer;
    }
  ): Promise<EmailAttachment | null> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.filename}`;
      const filePath = path.join(this.attachmentsDir, fileName);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Save metadata to database
      const [attachment] = await db
        .insert(emailAttachments)
        .values({
          emailId,
          filename: file.filename,
          mimeType: file.mimetype,
          size: file.buffer.length,
          storageKey: fileName,
        })
        .returning();

      return attachment;
    } catch (error) {
      console.error('Error saving uploaded attachment:', error);
      return null;
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

      // Delete file if it exists locally
      if (attachment.storageKey && !attachment.storageKey.startsWith('http')) {
        const filePath = path.join(this.attachmentsDir, attachment.storageKey);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Delete metadata from database
      await db
        .delete(emailAttachments)
        .where(eq(emailAttachments.id, attachmentId));

      return true;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      return false;
    }
  }

  /**
   * Get attachment file size and validate access
   */
  async validateAttachment(attachmentId: string): Promise<{
    valid: boolean;
    size?: number;
    filename?: string;
    mimeType?: string;
  }> {
    try {
      const attachment = await this.getAttachment(attachmentId);
      if (!attachment) {
        return { valid: false };
      }

      // Check if file exists locally
      if (attachment.storageKey && !attachment.storageKey.startsWith('http')) {
        const filePath = path.join(this.attachmentsDir, attachment.storageKey);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          return {
            valid: true,
            size: stats.size,
            filename: attachment.filename || undefined,
            mimeType: attachment.mimeType || undefined,
          };
        }
      }

      // File not local, but attachment exists in Gmail
      return {
        valid: true,
        size: attachment.size || undefined,
        filename: attachment.filename || undefined,
        mimeType: attachment.mimeType || undefined,
      };
    } catch (error) {
      console.error('Error validating attachment:', error);
      return { valid: false };
    }
  }

  /**
   * Clean up old attachment files
   */
  async cleanupOldAttachments(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let cleanedCount = 0;

      // Get old attachments from database
      const oldAttachments = await db
        .select()
        .from(emailAttachments)
        .where(lt(emailAttachments.createdAt, cutoffDate));

      for (const attachment of oldAttachments) {
        if (attachment.storageKey && !attachment.storageKey.startsWith('http')) {
          const filePath = path.join(this.attachmentsDir, attachment.storageKey);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up attachments:', error);
      return 0;
    }
  }

  /**
   * Get total storage used by attachments
   */
  async getStorageUsage(): Promise<{ totalFiles: number; totalSizeBytes: number }> {
    try {
      if (!fs.existsSync(this.attachmentsDir)) {
        return { totalFiles: 0, totalSizeBytes: 0 };
      }

      const files = fs.readdirSync(this.attachmentsDir);
      let totalSizeBytes = 0;

      for (const file of files) {
        const filePath = path.join(this.attachmentsDir, file);
        const stats = fs.statSync(filePath);
        totalSizeBytes += stats.size;
      }

      return {
        totalFiles: files.length,
        totalSizeBytes,
      };
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      return { totalFiles: 0, totalSizeBytes: 0 };
    }
  }
}

export const attachmentsService = new AttachmentsService();