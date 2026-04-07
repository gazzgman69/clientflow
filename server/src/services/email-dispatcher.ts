import { storage } from '../../storage';
import { GmailEmailProvider } from './email-provider-gmail';
import { MicrosoftEmailProvider } from './email-provider-microsoft';

export interface DispatchEmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  inlineImages?: Array<{ cid: string; contentType: string; base64: string }>;
}

export interface DispatchEmailResult {
  ok: boolean;
  messageId?: string;
  threadId?: string;
  provider?: 'google' | 'microsoft';
  warning?: string;
  error?: string;
  fromEmail?: string;
}

export class EmailDispatcher {
  private gmailProvider: GmailEmailProvider;
  private microsoftProvider: MicrosoftEmailProvider;

  constructor() {
    this.gmailProvider = new GmailEmailProvider();
    this.microsoftProvider = new MicrosoftEmailProvider();
  }

  /**
   * Send email using any available provider for the tenant (for auto-responders)
   */
  async sendEmail(params: DispatchEmailParams & { tenantId: string }): Promise<{ success: boolean; messageId?: string; fromEmail?: string; error?: string }> {
    try {
      // Get any connected email account for this tenant
      const users = await storage.getUsers(params.tenantId);
      
      for (const user of users) {
        const emailAccounts = await storage.getEmailAccountsByUser(user.id, params.tenantId);
        const connectedAccount = emailAccounts.find(acc => acc.status === 'connected');
        
        if (connectedAccount) {
          // Found a connected account, use it
          const result = await this.dispatchEmail(user.id, params.tenantId, params);
          return {
            success: result.ok,
            messageId: result.messageId,
            fromEmail: result.fromEmail,
            error: result.error
          };
        }
      }
      
      return {
        success: false,
        error: 'No email provider connected for this tenant'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Dispatch email using the user's connected OAuth provider
   */
  async dispatchEmail(
    userId: string,
    tenantId: string,
    params: DispatchEmailParams
  ): Promise<DispatchEmailResult> {
    try {
      // Check for Google integration using new email_accounts table
      const emailAccounts = await storage.getEmailAccountsByUser(userId, tenantId);
      const googleAccount = emailAccounts.find(acc => acc.providerKey === 'google' && acc.status === 'connected');
      
      // Convert to legacy format for provider compatibility
      const googleIntegration = googleAccount ? {
        id: googleAccount.id,
        createdAt: null,
        updatedAt: null,
        userId: googleAccount.userId,
        tenantId: googleAccount.tenantId,
        provider: 'google' as const,
        providerKey: googleAccount.providerKey,
        accountEmail: googleAccount.accountEmail,
        status: googleAccount.status as 'connected',
        authType: googleAccount.authType,
        accessToken: '', // Will be decrypted by provider
        refreshToken: '', // Will be decrypted by provider
        scopes: [],
        secretsEnc: googleAccount.secretsEnc,
        lastSyncedAt: googleAccount.lastSyncAt,
        expiresAt: googleAccount.expiresAt,
        metadata: googleAccount.metadata
      } : null;

      if (googleIntegration && googleIntegration.status === 'connected') {
        try {
          const result = await this.gmailProvider.sendEmail(googleIntegration, params);
          
          console.log(JSON.stringify({
            event: 'email_dispatched',
            provider: 'google',
            tenantId,
            userId,
            messageId: result.messageId,
            timestamp: new Date().toISOString()
          }));

          return {
            ok: true,
            messageId: result.messageId,
            threadId: result.threadId,
            provider: 'google',
            warning: result.warning,
            fromEmail: googleIntegration.accountEmail || ''
          };
        } catch (gmailError: any) {
          console.error('❌ Gmail dispatch failed:', gmailError);
          // Try Microsoft fallback before giving up
          const microsoftAccount = emailAccounts.find(acc => acc.providerKey === 'microsoft' && acc.status === 'connected');
          
          // Convert to legacy format for provider compatibility
          const microsoftIntegration = microsoftAccount ? {
            id: microsoftAccount.id,
            createdAt: null,
            updatedAt: null,
            userId: microsoftAccount.userId,
            tenantId: microsoftAccount.tenantId,
            provider: 'microsoft' as const,
            providerKey: microsoftAccount.providerKey,
            accountEmail: microsoftAccount.accountEmail,
            status: microsoftAccount.status as 'connected',
            authType: microsoftAccount.authType,
            accessToken: '', // Will be decrypted by provider
            refreshToken: '', // Will be decrypted by provider
            scopes: [],
            secretsEnc: microsoftAccount.secretsEnc,
            lastSyncedAt: microsoftAccount.lastSyncAt,
            expiresAt: microsoftAccount.expiresAt,
            metadata: microsoftAccount.metadata
          } : null;
          
          if (microsoftIntegration && microsoftIntegration.status === 'connected') {
            try {
              const result = await this.microsoftProvider.sendEmail(microsoftIntegration, params);
              
              console.log(JSON.stringify({
                event: 'email_dispatched',
                provider: 'microsoft',
                tenantId,
                userId,
                messageId: result.messageId,
                timestamp: new Date().toISOString(),
                fallbackFrom: 'gmail'
              }));

              return {
                ok: true,
                messageId: result.messageId,
                provider: 'microsoft',
                warning: result.warning || `Gmail unavailable, sent via Microsoft instead.`,
                fromEmail: microsoftIntegration.accountEmail || ''
              };
            } catch (microsoftError: any) {
              console.error('❌ Microsoft fallback also failed:', microsoftError);
              return {
                ok: false,
                error: `Both providers failed. Gmail: ${gmailError.message}. Microsoft: ${microsoftError.message}. Please reconnect in settings.`
              };
            }
          }
          
          // No fallback available - return Gmail error
          return {
            ok: false,
            error: `Gmail send failed: ${gmailError.message}. Please reconnect your Gmail account in settings.`
          };
        }
      }

      // If no Gmail, check for Microsoft as primary
      const microsoftAccount = emailAccounts.find(acc => acc.providerKey === 'microsoft' && acc.status === 'connected');
      
      // Convert to legacy format for provider compatibility
      const microsoftIntegration = microsoftAccount ? {
        id: microsoftAccount.id,
        createdAt: null,
        updatedAt: null,
        userId: microsoftAccount.userId,
        tenantId: microsoftAccount.tenantId,
        provider: 'microsoft' as const,
        providerKey: microsoftAccount.providerKey,
        accountEmail: microsoftAccount.accountEmail,
        status: microsoftAccount.status as 'connected',
        authType: microsoftAccount.authType,
        accessToken: '', // Will be decrypted by provider
        refreshToken: '', // Will be decrypted by provider
        scopes: [],
        secretsEnc: microsoftAccount.secretsEnc,
        lastSyncedAt: microsoftAccount.lastSyncAt,
        expiresAt: microsoftAccount.expiresAt,
        metadata: microsoftAccount.metadata
      } : null;

      if (microsoftIntegration && microsoftIntegration.status === 'connected') {
        try {
          const result = await this.microsoftProvider.sendEmail(microsoftIntegration, params);
          
          console.log(JSON.stringify({
            event: 'email_dispatched',
            provider: 'microsoft',
            tenantId,
            userId,
            messageId: result.messageId,
            timestamp: new Date().toISOString()
          }));

          return {
            ok: true,
            messageId: result.messageId,
            provider: 'microsoft',
            warning: result.warning,
            fromEmail: microsoftIntegration.accountEmail || ''
          };
        } catch (error: any) {
          console.error('❌ Microsoft dispatch failed:', error);
          return {
            ok: false,
            error: `Microsoft email send failed: ${error.message}. Please reconnect your Microsoft account in settings.`
          };
        }
      }

      // No provider connected
      return {
        ok: false,
        error: 'No email provider connected. Please connect Gmail or Microsoft in settings.'
      };
    } catch (error: any) {
      console.error('❌ Email dispatch error:', error);
      return {
        ok: false,
        error: `Email dispatch failed: ${error.message}`
      };
    }
  }
}

// Export singleton
export const emailDispatcher = new EmailDispatcher();
