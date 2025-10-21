import { storage } from "./storage";
import { EmailDispatcher } from "./src/services/email-dispatcher";

export class AutoReplyService {
  private emailDispatcher: EmailDispatcher;

  constructor() {
    this.emailDispatcher = new EmailDispatcher();
  }

  /**
   * Check if auto-reply should be sent for this contact
   */
  private async shouldSendAutoReply(
    contactId: string,
    tenantId: string
  ): Promise<boolean> {
    // Check if we've already sent an auto-reply to this contact
    const existingReply = await storage.getAutoReplyLog(contactId, tenantId);
    
    if (existingReply) {
      console.log(`❌ Auto-reply already sent to contact ${contactId}`);
      return false;
    }
    
    return true;
  }

  /**
   * Get notification settings for a tenant (tenant-wide or user-specific)
   */
  private async getNotificationSettings(tenantId: string, userId?: string) {
    // Try to get user-specific settings first
    if (userId) {
      const userSettings = await storage.getNotificationSettings(tenantId, userId);
      if (userSettings) {
        return userSettings;
      }
    }
    
    // Fall back to tenant-wide settings
    const tenantSettings = await storage.getNotificationSettings(tenantId);
    return tenantSettings;
  }

  /**
   * Send auto-reply acknowledgment to a new lead
   */
  async sendAutoReply(params: {
    contactId: string;
    contactEmail: string;
    contactName: string;
    tenantId: string;
    userId?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { contactId, contactEmail, contactName, tenantId, userId } = params;
      
      // Get notification settings
      const settings = await this.getNotificationSettings(tenantId, userId);
      
      if (!settings) {
        console.log('⚠️ No notification settings found, skipping auto-reply');
        return { success: false, error: 'No notification settings configured' };
      }
      
      // Check if auto-reply is enabled
      if (!settings.autoReplyEnabled) {
        console.log('⚠️ Auto-reply is disabled');
        return { success: false, error: 'Auto-reply is disabled' };
      }
      
      // Check if we should send auto-reply (haven't sent one before)
      const shouldSend = await this.shouldSendAutoReply(contactId, tenantId);
      
      if (!shouldSend) {
        return { success: false, error: 'Auto-reply already sent to this contact' };
      }
      
      // Get auto-reply message (use default if not configured)
      const message = settings.autoReplyMessage || 
        `Thank you for contacting us! We've received your inquiry and will get back to you as soon as possible.`;
      
      // Send the email
      console.log(`📧 Sending auto-reply to ${contactEmail}...`);
      
      const result = await this.emailDispatcher.sendEmail({
        to: contactEmail,
        subject: 'Thank you for your inquiry',
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
        tenantId
      });
      
      if (result.success && result.messageId) {
        // Log the auto-reply
        await storage.createAutoReplyLog({
          contactId,
          tenantId,
          messageId: result.messageId,
          sentAt: new Date(),
          fromEmail: result.fromEmail || '',
          toEmail: contactEmail,
          subject: 'Thank you for your inquiry',
          body: message,
        });
        
        console.log(`✅ Auto-reply sent successfully to ${contactEmail}`);
        
        return {
          success: true,
          messageId: result.messageId
        };
      } else {
        console.error('❌ Failed to send auto-reply:', result.error);
        return {
          success: false,
          error: result.error || 'Failed to send auto-reply'
        };
      }
    } catch (error: any) {
      console.error('❌ Auto-reply service error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }
}

export const autoReplyService = new AutoReplyService();
