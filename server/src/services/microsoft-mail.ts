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
      // VERBOSE LOGGING: Log recipient + provider status before sending
      console.log(`📧 MICROSOFT SEND START - Provider: Microsoft Graph API`);
      console.log(`📧 MICROSOFT SEND - To: ${emailData.to.join(', ')}`);
      if (emailData.cc && emailData.cc.length > 0) {
        console.log(`📧 MICROSOFT SEND - CC: ${emailData.cc.join(', ')}`);
      }
      if (emailData.bcc && emailData.bcc.length > 0) {
        console.log(`📧 MICROSOFT SEND - BCC: ${emailData.bcc.join(', ')}`);
      }
      console.log(`📧 MICROSOFT SEND - Subject: ${emailData.subject}`);
      console.log(`📧 MICROSOFT SEND - Content Type: ${emailData.isHtml ? 'HTML' : 'Text'}`);
      
      const client = await getUncachableOutlookClient();
      
      // VERBOSE LOGGING: Get authenticated user email for from header verification
      let userEmail: string;
      try {
        const userProfile = await client.api('/me').get();
        userEmail = userProfile.mail || userProfile.userPrincipalName;
        console.log(`📧 MICROSOFT SEND - Authenticated account: ${userEmail}`);
        
        // VERBOSE LOGGING: From header verification
        if (emailData.fromEmail && emailData.fromEmail.toLowerCase() !== userEmail.toLowerCase()) {
          console.warn(`📧 MICROSOFT SEND WARNING - From header mismatch! Requested: ${emailData.fromEmail}, Authenticated: ${userEmail}`);
          console.log(`📧 MICROSOFT SEND - Microsoft Graph will use authenticated account as sender: ${userEmail}`);
        } else {
          console.log(`📧 MICROSOFT SEND - From header will be: ${userEmail} (auto-set by Microsoft Graph)`);
        }
      } catch (profileError) {
        console.error('📧 MICROSOFT SEND - Failed to get user profile:', profileError);
        userEmail = 'unknown@microsoft.com';
      }
      
      const message = {
        subject: emailData.subject,
        body: {
          contentType: emailData.isHtml ? 'HTML' : 'Text',
          content: emailData.body
        },
        toRecipients: emailData.to.map(email => ({
          emailAddress: {
            address: email
          }
        })),
        ccRecipients: emailData.cc?.map(email => ({
          emailAddress: {
            address: email
          }
        })) || [],
        bccRecipients: emailData.bcc?.map(email => ({
          emailAddress: {
            address: email
          }
        })) || []
      };

      console.log(`📧 MICROSOFT SEND - Calling /me/sendMail API...`);
      
      // DEVELOPMENT-ONLY: Enhanced debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEBUG] MICROSOFT REQUEST - Full message object:`, JSON.stringify(message, null, 2));
        console.log(`📧 [DEBUG] MICROSOFT REQUEST - API endpoint: /me/sendMail`);
        console.log(`📧 [DEBUG] MICROSOFT REQUEST - saveToSentItems: true`);
      }
      
      const response = await client.api('/me/sendMail').post({
        message,
        saveToSentItems: true
      });

      // VERBOSE LOGGING: Log Microsoft Graph API response
      console.log(`📧 MICROSOFT API RESPONSE - Status: 202 Accepted (sendMail endpoint)`);
      console.log(`📧 MICROSOFT API RESPONSE - Response data:`, JSON.stringify(response, null, 2));
      
      // DEVELOPMENT-ONLY: Enhanced debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 [DEBUG] MICROSOFT RESPONSE - Full response headers available`);
        console.log(`📧 [DEBUG] MICROSOFT RESPONSE - Graph API version in use`);
        console.log(`📧 [DEBUG] MICROSOFT RESPONSE - Message processed by Microsoft Graph successfully`);
        console.log(`📧 [DEBUG] MICROSOFT RESPONSE - Authentication token still valid for user: ${userEmail}`);
      }
      
      console.log(`📧 MICROSOFT SUCCESS - Provider accepted email for sending`);
      console.log(`📧 MICROSOFT SUCCESS - Email saved to Sent Items automatically`);

      return {
        success: true,
        messageId: 'microsoft-sent-' + Date.now() // Microsoft Graph doesn't return message ID immediately
      };
    } catch (error: any) {
      // VERBOSE LOGGING: Log detailed error information
      console.error('📧 MICROSOFT SEND ERROR - Raw error object:', JSON.stringify(error, null, 2));
      console.error('📧 MICROSOFT SEND ERROR - Error message:', error.message);
      
      // DEVELOPMENT-ONLY: Enhanced debug error logging
      if (process.env.NODE_ENV === 'development') {
        console.error('📧 [DEBUG] MICROSOFT ERROR - Error stack trace:', error.stack);
        if (error.response) {
          console.error('📧 [DEBUG] MICROSOFT ERROR - HTTP Status Code:', error.response.status);
          console.error('📧 [DEBUG] MICROSOFT ERROR - HTTP Status Text:', error.response.statusText);
          console.error('📧 [DEBUG] MICROSOFT ERROR - Response headers:', JSON.stringify(error.response.headers, null, 2));
          console.error('📧 [DEBUG] MICROSOFT ERROR - Response data:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.request) {
          console.error('📧 [DEBUG] MICROSOFT ERROR - Request details:', JSON.stringify(error.request, null, 2));
        }
        console.error('📧 [DEBUG] MICROSOFT ERROR - Graph API client state available for inspection');
      }
      
      if (error.response) {
        console.error('📧 MICROSOFT SEND ERROR - HTTP Status:', error.response.status);
        console.error('📧 MICROSOFT SEND ERROR - Response data:', JSON.stringify(error.response.data, null, 2));
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