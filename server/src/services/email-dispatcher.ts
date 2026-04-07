import { storage } from '../../storage';
import { GmailEmailProvider } from './email-provider-gmail';
import { MicrosoftEmailProvider } from './email-provider-microsoft';
import { SmtpEmailProvider } from './email-provider-smtp';
import { secureStore } from './secureStore';

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
  provider?: 'google' | 'microsoft' | 'smtp';
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
   * Dispatch email using the user's connected OAuth provider or SMTP account
   */
  async dispatchEmail(
    userId: string,
    tenantId: string,
    params: DispatchEmailParams
  ): Promise<DispatchEmailResult> {
    try {
      // Get tenant email preferences for BCC and read receipts
      const tenantPrefs = await storage.getTenantEmailPrefs(tenantId);
      let dispatchParams = params;

      // Apply BCC self preference — get sender's own email from their connected account
      if (tenantPrefs?.bccSelf) {
        const allAccounts = await storage.getEmailAccountsByUser(userId, tenantId);
        const senderAccount = allAccounts.find(acc => acc.status === 'connected');
        const senderEmail = senderAccount?.accountEmail;
        if (senderEmail) {
          const currentBcc = Array.isArray(params.bcc) ? params.bcc : (params.bcc ? [params.bcc] : []);
          if (!currentBcc.includes(senderEmail)) {
            dispatchParams = { ...params, bcc: [...currentBcc, senderEmail] };
          }
        }
      }

      // Apply read receipts preference
      if (tenantPrefs?.readReceipts && params.html) {
        const token = Buffer.from(`${tenantId}:${Date.now()}`).toString('base64url');
        dispatchParams = { ...dispatchParams, html: params.html + `\n<img src="/api/email/track/${token}" width="1" height="1" style="display:none;width:1px;height:1px;" alt="">` };
      }

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
          const result = await this.gmailProvider.sendEmail(googleIntegration, dispatchParams);
          
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
              const result = await this.microsoftProvider.sendEmail(microsoftIntegration, dispatchParams);
              
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
          const result = await this.microsoftProvider.sendEmail(microsoftIntegration, dispatchParams);
          
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

      // Check for SMTP account (authType === 'basic')
      const smtpAccount = emailAccounts.find(acc => acc.authType === 'basic' && acc.status === 'connected');
      if (smtpAccount && smtpAccount.secretsEnc) {
        try {
          const smtpProvider = new SmtpEmailProvider();

          // Decrypt SMTP credentials
          const decryptedSecrets = secureStore.decrypt(smtpAccount.secretsEnc);
          const secrets = JSON.parse(decryptedSecrets);

          const smtpConfig = {
            host: secrets.smtpHost,
            port: secrets.smtpPort,
            secure: secrets.smtpSecure,
            user: secrets.username,
            pass: secrets.password,
            fromEmail: smtpAccount.accountEmail
          };

          const result = await smtpProvider.sendEmail(smtpConfig, dispatchParams);

          if (result.success) {
            console.log(JSON.stringify({
              event: 'email_dispatched',
              provider: 'smtp',
              tenantId,
              userId,
              messageId: result.messageId,
              timestamp: new Date().toISOString()
            }));

            return {
              ok: true,
              messageId: result.messageId,
              provider: 'smtp',
              fromEmail: smtpAccount.accountEmail || ''
            };
          } else {
            console.error('❌ SMTP dispatch failed:', result.error);
            return {
              ok: false,
              error: `SMTP email send failed: ${result.error}. Please check your SMTP settings in settings.`
            };
          }
        } catch (smtpError: any) {
          console.error('❌ SMTP dispatch error:', smtpError);
          return {
            ok: false,
            error: `SMTP dispatch error: ${smtpError.message}. Please check your SMTP settings in settings.`
          };
        }
      }

      // No provider connected
      return {
        ok: false,
        error: 'No email provider connected. Please connect Gmail, Microsoft, or SMTP in settings.'
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
