import { getUncachableOutlookClient } from './microsoft-oauth';
import type { Email, InsertEmail } from '@shared/schema';

interface MicrosoftMessage {
  id?: string;
  subject?: string;
  body?: {
    content?: string;
    contentType?: string;
  };
  from?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  bccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  conversationId?: string;
  hasAttachments?: boolean;
  internetMessageId?: string;
  parentFolderId?: string;
}

export class MicrosoftMailService {
  /**
   * Get user's email messages
   */
  async getMessages(folderId: string = 'inbox', count: number = 50, since?: Date): Promise<Email[]> {
    const client = await getUncachableOutlookClient();
    
    let query = `/me/mailFolders/${folderId}/messages`;
    const params: string[] = [`$top=${count}`];
    
    if (since) {
      params.push(`$filter=receivedDateTime ge ${since.toISOString()}`);
    }
    
    // Order by received date, newest first
    params.push('$orderby=receivedDateTime desc');
    
    if (params.length > 0) {
      query += `?${params.join('&')}`;
    }

    const response = await client.api(query).get();
    const messages = response.value || [];

    return messages.map((message: MicrosoftMessage) => this.convertToEmail(message));
  }

  /**
   * Send an email message
   */
  async sendEmail(emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
    fromEmail?: string; // For from header verification
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = await getUncachableOutlookClient();

      let userEmail: string;
      try {
        const userProfile = await client.api('/me').get();
        userEmail = userProfile.mail || userProfile.userPrincipalName;
      } catch (profileError) {
        console.error('📧 Microsoft: failed to get user profile:', profileError);
        userEmail = 'unknown@microsoft.com';
      }

      const message = {
        subject: emailData.subject,
        body: {
          contentType: emailData.isHtml ? 'HTML' : 'Text',
          content: emailData.body
        },
        toRecipients: emailData.to.map(email => ({
          emailAddress: { address: email }
        })),
        ccRecipients: emailData.cc?.map(email => ({
          emailAddress: { address: email }
        })) || [],
        bccRecipients: emailData.bcc?.map(email => ({
          emailAddress: { address: email }
        })) || []
      };

      await client.api('/me/sendMail').post({ message, saveToSentItems: true });

      return {
        success: true,
        messageId: 'microsoft-sent-' + Date.now()
      };
    } catch (error: any) {
      console.error('📧 Microsoft send error:', error.message);
      if (error.response) {
        console.error('📧 Microsoft API status:', error.response.status);
      }
      return {
        success: false,
        error: error.message || 'Failed to send email via Microsoft Graph'
      };
    }
  }

  /**
   * Get email message by ID
   */
  async getMessage(messageId: string): Promise<Email | null> {
    try {
      const client = await getUncachableOutlookClient();
      const message = await client.api(`/me/messages/${messageId}`).get();
      return this.convertToEmail(message);
    } catch (error) {
      console.error('Error fetching message:', error);
      return null;
    }
  }

  /**
   * Mark message as read/unread
   */
  async markAsRead(messageId: string, isRead: boolean = true): Promise<void> {
    const client = await getUncachableOutlookClient();
    await client.api(`/me/messages/${messageId}`).patch({
      isRead
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const client = await getUncachableOutlookClient();
    await client.api(`/me/messages/${messageId}`).delete();
  }

  /**
   * Get user's mail folders
   */
  async getFolders(): Promise<Array<{ id: string; name: string; messageCount: number }>> {
    const client = await getUncachableOutlookClient();
    const response = await client.api('/me/mailFolders').get();
    const folders = response.value || [];

    return folders.map((folder: any) => ({
      id: folder.id,
      name: folder.displayName,
      messageCount: folder.totalItemCount || 0
    }));
  }

  /**
   * Convert Microsoft Graph message to our Email format
   */
  private convertToEmail(microsoftMessage: MicrosoftMessage): Email {
    return {
      id: microsoftMessage.id || '',
      subject: microsoftMessage.subject || '',
      body: microsoftMessage.body?.content || '',
      fromEmail: microsoftMessage.from?.emailAddress.address || '',
      fromName: microsoftMessage.from?.emailAddress.name || '',
      toEmails: microsoftMessage.toRecipients?.map(r => r.emailAddress.address) || [],
      ccEmails: microsoftMessage.ccRecipients?.map(r => r.emailAddress.address) || [],
      bccEmails: microsoftMessage.bccRecipients?.map(r => r.emailAddress.address) || [],
      receivedAt: microsoftMessage.receivedDateTime ? new Date(microsoftMessage.receivedDateTime) : new Date(),
      sentAt: microsoftMessage.sentDateTime ? new Date(microsoftMessage.sentDateTime) : new Date(),
      isRead: microsoftMessage.isRead || false,
      hasAttachments: microsoftMessage.hasAttachments || false,
      threadId: microsoftMessage.conversationId || '',
      messageId: microsoftMessage.internetMessageId || '',
      source: 'microsoft',
      sourceMessageId: microsoftMessage.id || '',
      userId: '', // Will be set by caller
      tenantId: '', // Will be set by caller
      projectId: null,
      direction: 'inbound', // Default, will be determined by caller
      labels: [],
      folderId: microsoftMessage.parentFolderId || 'inbox'
    };
  }
}

// Export singleton instance
export const microsoftMailService = new MicrosoftMailService();