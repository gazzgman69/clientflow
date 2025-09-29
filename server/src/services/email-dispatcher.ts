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
}

export interface DispatchEmailResult {
  ok: boolean;
  messageId?: string;
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
   * Dispatch email using the user's connected OAuth provider
   */
  async dispatchEmail(
    userId: string,
    tenantId: string,
    params: DispatchEmailParams
  ): Promise<DispatchEmailResult> {
    try {
      // Check for Google integration
      const googleIntegration = await storage.getEmailProviderIntegration(
        userId,
        tenantId,
        'google'
      );

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
            provider: 'google',
            warning: result.warning,
            fromEmail: googleIntegration.accountEmail || ''
          };
        } catch (gmailError: any) {
          console.error('❌ Gmail dispatch failed:', gmailError);
          // Try Microsoft fallback before giving up
          const microsoftIntegration = await storage.getEmailProviderIntegration(
            userId,
            tenantId,
            'microsoft'
          );
          
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
      const microsoftIntegration = await storage.getEmailProviderIntegration(
        userId,
        tenantId,
        'microsoft'
      );

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
