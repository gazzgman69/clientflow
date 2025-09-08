import { db } from '../../db';
import { mailSettings, mailSettingsAudit, type MailSettings, type InsertMailSettings, type InsertMailSettingsAudit } from '@shared/schema';
import { secureStore, MAIL_SENSITIVE_FIELDS } from './secureStore';
import { eq, and, desc } from 'drizzle-orm';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

/**
 * Provider presets for common email providers
 */
export const PROVIDER_PRESETS = {
  gmail: {
    name: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecurity: 'starttls'
  },
  outlook: {
    name: 'Outlook/Hotmail',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecurity: 'starttls'
  },
  icloud: {
    name: 'iCloud',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecurity: 'starttls'
  },
  yahoo: {
    name: 'Yahoo Mail',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecurity: 'ssl',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpSecurity: 'starttls'
  }
};

export class MailSettingsService {
  /**
   * Get current mail settings (with redacted passwords)
   */
  async getCurrentSettings(): Promise<MailSettings | null> {
    try {
      const [settings] = await db
        .select()
        .from(mailSettings)
        .where(eq(mailSettings.isActive, true))
        .orderBy(desc(mailSettings.isDefault), desc(mailSettings.createdAt))
        .limit(1);

      if (!settings) {
        return null;
      }

      // Redact sensitive fields before returning
      return secureStore.redactObject(settings, MAIL_SENSITIVE_FIELDS) as MailSettings;
      
    } catch (error) {
      console.error('Error fetching mail settings:', error);
      throw new Error('Failed to fetch mail settings');
    }
  }

  /**
   * Get decrypted settings for internal use (never send to client)
   */
  async getDecryptedSettings(): Promise<MailSettings | null> {
    try {
      const [settings] = await db
        .select()
        .from(mailSettings)
        .where(eq(mailSettings.isActive, true))
        .orderBy(desc(mailSettings.isDefault), desc(mailSettings.createdAt))
        .limit(1);

      if (!settings) {
        return null;
      }

      // Decrypt sensitive fields for internal use
      return secureStore.decryptObject(settings, MAIL_SENSITIVE_FIELDS) as MailSettings;
      
    } catch (error) {
      console.error('Error fetching decrypted mail settings:', error);
      throw new Error('Failed to fetch mail settings');
    }
  }

  /**
   * Save mail settings with encrypted credentials
   */
  async saveSettings(settingsData: InsertMailSettings & { 
    imapPassword?: string; 
    smtpPassword?: string; 
  }): Promise<{ success: boolean; settings?: MailSettings; error?: string }> {
    try {
      console.log('🔒 Saving mail settings with encryption...');

      // Validate sync interval (1-15 minutes)
      if (settingsData.syncIntervalMinutes && (settingsData.syncIntervalMinutes < 1 || settingsData.syncIntervalMinutes > 15)) {
        return { success: false, error: 'Sync interval must be between 1 and 15 minutes' };
      }

      // If this will be the default, remove default from other settings
      if (settingsData.isDefault) {
        await db
          .update(mailSettings)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(mailSettings.isDefault, true));
      }

      // Encrypt sensitive fields
      const encryptedData = secureStore.encryptObject(settingsData, MAIL_SENSITIVE_FIELDS);
      
      // Reset quota if it's a new day
      const now = new Date();
      const quotaResetAt = new Date(now);
      quotaResetAt.setHours(0, 0, 0, 0); // Start of today
      quotaResetAt.setDate(quotaResetAt.getDate() + 1); // Tomorrow

      const dataToInsert = {
        ...encryptedData,
        quotaResetAt,
        consecutiveFailures: 0,
        updatedAt: new Date()
      };

      const [savedSettings] = await db
        .insert(mailSettings)
        .values(dataToInsert)
        .returning();

      // Test the connection automatically
      await this.testConnection(savedSettings.id);

      // Return redacted settings
      const redactedSettings = secureStore.redactObject(savedSettings, MAIL_SENSITIVE_FIELDS) as MailSettings;

      console.log('✅ Mail settings saved and tested successfully');
      return { success: true, settings: redactedSettings };

    } catch (error) {
      console.error('❌ Error saving mail settings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save mail settings' 
      };
    }
  }

  /**
   * Test IMAP and SMTP connections
   */
  async testConnection(settingsId: string): Promise<{ 
    success: boolean; 
    imapResult?: { success: boolean; error?: string }; 
    smtpResult?: { success: boolean; error?: string }; 
    error?: string 
  }> {
    const startTime = Date.now();
    
    try {
      // Get decrypted settings
      const [settings] = await db
        .select()
        .from(mailSettings)
        .where(eq(mailSettings.id, settingsId))
        .limit(1);

      if (!settings) {
        return { success: false, error: 'Settings not found' };
      }

      const decryptedSettings = secureStore.decryptObject(settings, MAIL_SENSITIVE_FIELDS);

      // Test IMAP connection
      let imapResult: { success: boolean; error?: string } = { success: false, error: 'Not tested' };
      if (decryptedSettings.imapHost && decryptedSettings.imapUsername && decryptedSettings.imapPassword) {
        try {
          // Import imap service dynamically to avoid circular deps
          const { imapService } = await import('./imap');
          
          // Create a temporary connection test
          const Imap = (await import('imap')).default;
          const testImap = new Imap({
            user: decryptedSettings.imapUsername,
            password: decryptedSettings.imapPassword,
            host: decryptedSettings.imapHost,
            port: decryptedSettings.imapPort || 993,
            tls: decryptedSettings.imapSecurity === 'ssl',
            authTimeout: 5000,
            connTimeout: 5000
          });

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('IMAP connection timeout'));
            }, 5000);

            testImap.once('ready', () => {
              clearTimeout(timeout);
              testImap.end();
              resolve();
            });

            testImap.once('error', (err: Error) => {
              clearTimeout(timeout);
              reject(err);
            });

            testImap.connect();
          });

          imapResult = { success: true };
          
        } catch (error) {
          imapResult = { 
            success: false, 
            error: error instanceof Error ? error.message : 'IMAP connection failed' 
          };
        }
      }

      // Test SMTP connection
      let smtpResult: { success: boolean; error?: string } = { success: false, error: 'Not tested' };
      if (decryptedSettings.smtpHost && decryptedSettings.smtpUsername && decryptedSettings.smtpPassword) {
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.createTransport({
            host: decryptedSettings.smtpHost,
            port: decryptedSettings.smtpPort || 587,
            secure: decryptedSettings.smtpSecurity === 'ssl',
            auth: {
              user: decryptedSettings.smtpUsername,
              pass: decryptedSettings.smtpPassword
            }
          });

          await transporter.verify();
          smtpResult = { success: true };
          
        } catch (error) {
          smtpResult = { 
            success: false, 
            error: error instanceof Error ? error.message : 'SMTP connection failed' 
          };
        }
      }

      const durationMs = Date.now() - startTime;
      const overallSuccess = imapResult.success && smtpResult.success;

      // Update settings with test results
      await db
        .update(mailSettings)
        .set({
          lastTestedAt: new Date(),
          lastTestResult: overallSuccess ? 'ok' : 'fail',
          lastTestError: overallSuccess ? null : `IMAP: ${imapResult.error}, SMTP: ${smtpResult.error}`,
          consecutiveFailures: overallSuccess ? 0 : (settings.consecutiveFailures || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(mailSettings.id, settingsId));

      // Log the test results
      await this.logAudit(settingsId, overallSuccess ? 'imapTest' : 'testFail', overallSuccess, 
        overallSuccess ? null : `IMAP: ${imapResult.error}, SMTP: ${smtpResult.error}`, durationMs, {
          imapResult,
          smtpResult
        });

      return {
        success: overallSuccess,
        imapResult,
        smtpResult
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';

      // Log the error
      await this.logAudit(settingsId, 'testFail', false, errorMessage, durationMs);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Auto-detect email settings based on email domain
   */
  async autoDetectSettings(email: string): Promise<{ 
    success: boolean; 
    settings?: Partial<InsertMailSettings>; 
    error?: string 
  }> {
    try {
      const domain = email.split('@')[1];
      if (!domain) {
        return { success: false, error: 'Invalid email address' };
      }

      // Check for known providers first
      const lowerDomain = domain.toLowerCase();
      for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
        if (
          (key === 'gmail' && (lowerDomain.includes('gmail') || lowerDomain.includes('googlemail'))) ||
          (key === 'outlook' && (lowerDomain.includes('outlook') || lowerDomain.includes('hotmail') || lowerDomain.includes('live'))) ||
          (key === 'icloud' && (lowerDomain.includes('icloud') || lowerDomain.includes('me.com') || lowerDomain.includes('mac.com'))) ||
          (key === 'yahoo' && lowerDomain.includes('yahoo'))
        ) {
          return {
            success: true,
            settings: {
              name: `${preset.name} (${email})`,
              provider: key,
              fromEmail: email,
              imapHost: preset.imapHost,
              imapPort: preset.imapPort,
              imapSecurity: preset.imapSecurity as any,
              smtpHost: preset.smtpHost,
              smtpPort: preset.smtpPort,
              smtpSecurity: preset.smtpSecurity as any
            }
          };
        }
      }

      // Try MX record lookup for custom domains
      try {
        const mxRecords = await resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) {
          const primaryMx = mxRecords.sort((a, b) => a.priority - b.priority)[0];
          const mxHost = primaryMx.exchange.toLowerCase();

          // Guess IMAP/SMTP hosts based on MX record
          const imapHost = mxHost.replace(/^mx\.?/, 'imap.');
          const smtpHost = mxHost.replace(/^mx\.?/, 'smtp.');

          return {
            success: true,
            settings: {
              name: `Custom (${email})`,
              provider: 'custom',
              fromEmail: email,
              imapHost,
              imapPort: 993,
              imapSecurity: 'ssl',
              smtpHost,
              smtpPort: 587,
              smtpSecurity: 'starttls'
            }
          };
        }
      } catch (dnsError) {
        console.warn('MX lookup failed for domain:', domain, dnsError);
      }

      return { success: false, error: 'Could not auto-detect settings for this domain' };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Auto-detection failed' 
      };
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(settingsId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = await this.getDecryptedSettings();
      if (!settings || settings.id !== settingsId) {
        return { success: false, error: 'Settings not found or not active' };
      }

      if (!settings.fromEmail) {
        return { success: false, error: 'From email not configured' };
      }

      // Import SMTP service and send test email
      const { imapService } = await import('./imap');
      
      const result = await imapService.sendViaSmtp({
        to: settings.fromEmail,
        subject: 'BusinessCRM Test Email',
        text: `This is a test email sent from BusinessCRM at ${new Date().toLocaleString('en-GB', { 
          dateStyle: 'short', 
          timeStyle: 'short', 
          hour12: false 
        })}.\n\nIf you received this email, your email settings are working correctly.`,
        html: `
          <h2>BusinessCRM Test Email</h2>
          <p>This is a test email sent from BusinessCRM at <strong>${new Date().toLocaleString('en-GB', { 
            dateStyle: 'short', 
            timeStyle: 'short', 
            hour12: false 
          })}</strong>.</p>
          <p>If you received this email, your email settings are working correctly.</p>
        `
      });

      // Log the send attempt
      await this.logAudit(settingsId, 'send', result.success, result.error || null, 0, {
        to: settings.fromEmail,
        messageId: result.messageId
      });

      if (result.success) {
        // Increment quota
        await this.incrementQuota(settingsId);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send test email';
      await this.logAudit(settingsId, 'send', false, errorMessage, 0);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get recent audit logs
   */
  async getAuditLogs(settingsId?: string, limit = 20): Promise<any[]> {
    try {
      const query = db
        .select()
        .from(mailSettingsAudit)
        .orderBy(desc(mailSettingsAudit.createdAt))
        .limit(limit);

      if (settingsId) {
        query.where(eq(mailSettingsAudit.settingsId, settingsId));
      }

      return await query;

    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Increment quota usage
   */
  async incrementQuota(settingsId: string, increment = 1): Promise<void> {
    try {
      const [settings] = await db
        .select()
        .from(mailSettings)
        .where(eq(mailSettings.id, settingsId))
        .limit(1);

      if (!settings) return;

      // Check if quota needs to be reset (new day)
      const now = new Date();
      const resetTime = settings.quotaResetAt ? new Date(settings.quotaResetAt) : new Date();
      
      let newQuotaUsed = (settings.quotaUsed || 0) + increment;
      let newResetAt = settings.quotaResetAt;

      if (now >= resetTime) {
        // Reset quota for new day
        newQuotaUsed = increment;
        newResetAt = new Date(now);
        newResetAt.setHours(0, 0, 0, 0);
        newResetAt.setDate(newResetAt.getDate() + 1);
      }

      await db
        .update(mailSettings)
        .set({
          quotaUsed: newQuotaUsed,
          quotaResetAt: newResetAt,
          updatedAt: new Date()
        })
        .where(eq(mailSettings.id, settingsId));

      // Log quota usage if approaching limit
      const quotaLimit = settings.quotaLimit || 500;
      if (newQuotaUsed >= quotaLimit * 0.8) { // 80% threshold
        await this.logAudit(settingsId, 'quota', true, `Quota usage: ${newQuotaUsed}/${quotaLimit}`, 0, {
          quotaUsed: newQuotaUsed,
          quotaLimit,
          percentage: Math.round((newQuotaUsed / quotaLimit) * 100)
        });
      }

    } catch (error) {
      console.error('Error incrementing quota:', error);
    }
  }

  /**
   * Log audit entry
   */
  private async logAudit(
    settingsId: string, 
    kind: string, 
    ok: boolean, 
    error: string | null = null, 
    durationMs = 0, 
    meta: any = null
  ): Promise<void> {
    try {
      await db
        .insert(mailSettingsAudit)
        .values({
          settingsId,
          kind,
          ok,
          error,
          durationMs,
          meta: meta ? JSON.stringify(meta) : null
        });
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError);
    }
  }
}

// Export singleton instance
export const mailSettingsService = new MailSettingsService();