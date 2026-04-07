import { storage } from '../../storage';
import { emailDispatcher } from './email-dispatcher';
import { leadStatusAutomator } from './lead-status-automator';
import type { AutoResponderLog } from '@shared/schema';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

class AutoResponderWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  start() {
    if (this.intervalId) {
      console.log('[AutoResponderWorker] Already running');
      return;
    }

    console.log('[AutoResponderWorker] Starting background worker');
    
    // Run immediately on start
    this.processQueue().catch(err => {
      console.error('[AutoResponderWorker] Error in initial run:', err);
    });

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.processQueue().catch(err => {
        console.error('[AutoResponderWorker] Error processing queue:', err);
      });
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[AutoResponderWorker] Stopped background worker');
    }
  }

  async processQueue() {
    if (this.isProcessing) {
      console.log('[AutoResponderWorker] Already processing, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      // Fetch all tenants so auto-responders are processed for every account
      const tenants = await storage.getAllTenants();

      let totalProcessed = 0;
      for (const tenant of tenants) {
        const dueLogs = await storage.getDueAutoResponderLogs(tenant.id);
        if (dueLogs.length === 0) continue;

        console.log(`[AutoResponderWorker] Processing ${dueLogs.length} due auto-responders for tenant ${tenant.id}`);
        totalProcessed += dueLogs.length;

        for (const log of dueLogs) {
          await this.processAutoResponder(log);
        }
      }

      if (totalProcessed === 0) {
        return;
      }
    } catch (error) {
      console.error('[AutoResponderWorker] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processAutoResponder(log: AutoResponderLog) {
    try {
      // Get the lead for email and context
      const lead = await storage.getLead(log.leadId, log.tenantId);
      if (!lead || !lead.email) {
        throw new Error('Lead not found or has no email');
      }

      // Get the template
      const template = await storage.getTemplate(log.templateId, log.tenantId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Build context for token resolution
      const context = {
        lead: {
          firstName: lead.firstName || '',
          lastName: lead.lastName || '',
          email: lead.email,
          phone: lead.phone || '',
          projectDate: lead.projectDate || null,
        },
        contact: {
          first_name: lead.firstName || '',
          last_name: lead.lastName || '',
        },
        booking: {
          link: log.bookingLink || ''
        }
      };

      // Resolve tokens in subject and body
      const subject = this.resolveTokens(template.subject || template.title, context);
      const htmlBody = this.resolveTokens(template.body, context);

      // Convert HTML to plain text for fallback
      const { convert } = await import('html-to-text');
      
      // First normalize smart quotes and special characters in HTML
      let normalizedHtml = htmlBody
        .replace(/&#8217;/g, "'")  // Right single quotation mark
        .replace(/&#8216;/g, "'")  // Left single quotation mark
        .replace(/&rsquo;/g, "'")  // Right single quote entity
        .replace(/&lsquo;/g, "'")  // Left single quote entity
        .replace(/&#8220;/g, '"')  // Left double quotation mark
        .replace(/&#8221;/g, '"')  // Right double quotation mark
        .replace(/&ldquo;/g, '"')  // Left double quote entity
        .replace(/&rdquo;/g, '"')  // Right double quote entity
        .replace(/&#8211;/g, '-')  // En dash
        .replace(/&#8212;/g, '--') // Em dash
        .replace(/&ndash;/g, '-')  // En dash entity
        .replace(/&mdash;/g, '--'); // Em dash entity
      
      const textBody = convert(normalizedHtml, { 
        wordwrap: 130,
        preserveNewlines: true
      });

      // Send email via dispatcher
      const result = await emailDispatcher.sendEmail({
        to: lead.email,
        subject,
        text: textBody,
        html: htmlBody,
        tenantId: log.tenantId
      });

      if (!result.success) {
        throw new Error(result.error || 'Email dispatch failed');
      }

      // Store the sent email in the database for project email tracking
      if (result.messageId && lead.projectId) {
        try {
          const createdBy = template.createdBy || log.tenantId;
          await storage.createEmail({
            tenantId: log.tenantId,
            userId: createdBy,
            threadId: result.messageId,
            fromEmail: result.fromEmail || '',
            toEmails: [lead.email],
            ccEmails: [],
            bccEmails: [],
            subject,
            bodyText: textBody,
            bodyHtml: htmlBody,
            sentAt: new Date(),
            projectId: lead.projectId,
            isSent: true,
            direction: 'outbound',
            snippet: textBody?.substring(0, 100)
          }, log.tenantId);
          console.log(`[AutoResponderWorker] Stored auto-responder email in database for project ${lead.projectId}`);

          // Trigger lead status automator for auto-responder email sent
          try {
            if (log.leadId) {
              await leadStatusAutomator.onEmailSent(log.leadId, log.tenantId);
            }
          } catch (automatorError) {
            console.error('[AutoResponderWorker] Lead status automator error after auto-responder send:', automatorError);
            // Continue - email was sent successfully regardless
          }
        } catch (dbError) {
          console.error(`[AutoResponderWorker] Failed to store email in database:`, dbError);
          // Continue - email was sent successfully
        }
      }

      // Update log to sent
      await storage.updateAutoResponderLog(log.id, {
        status: 'sent',
        sentAt: new Date(),
        providerMessageId: result.messageId || null,
        errorMessage: null
      }, log.tenantId);

      console.log(`[AutoResponderWorker] Successfully sent auto-responder ${log.id} to ${lead.email}`);

    } catch (error: any) {
      console.error(`[AutoResponderWorker] Error sending auto-responder ${log.id}:`, error);

      const isAuthError = error.message?.includes('No active email provider') || 
                         error.message?.includes('authentication') ||
                         error.message?.includes('unauthorized');

      // Determine if we should retry
      const shouldRetry = log.retryCount < MAX_RETRIES && !isAuthError;

      if (shouldRetry) {
        // Calculate next retry time with exponential backoff
        const retryDelay = RETRY_DELAYS[log.retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        const nextScheduledFor = new Date(Date.now() + retryDelay);

        await storage.updateAutoResponderLog(log.id, {
          status: 'queued',
          retryCount: log.retryCount + 1,
          scheduledFor: nextScheduledFor,
          errorMessage: error.message || 'Unknown error'
        }, log.tenantId);

        console.log(`[AutoResponderWorker] Scheduled retry ${log.retryCount + 1}/${MAX_RETRIES} for ${log.id} at ${nextScheduledFor.toISOString()}`);
      } else {
        // Mark as failed or pending_auth
        const status = isAuthError ? 'pending_auth' : 'failed';
        
        await storage.updateAutoResponderLog(log.id, {
          status,
          errorMessage: error.message || 'Unknown error'
        }, log.tenantId);

        console.log(`[AutoResponderWorker] Marked auto-responder ${log.id} as ${status}`);
      }
    }
  }

  private resolveTokens(text: string, context: any): string {
    let resolved = text;

    // Replace [FirstName] with lead firstName
    resolved = resolved.replace(/\[FirstName\]/gi, context.lead.firstName || '[FirstName]');
    
    // Replace [LastName] with lead lastName
    resolved = resolved.replace(/\[LastName\]/gi, context.lead.lastName || '[LastName]');
    
    // Replace [Email] with lead email
    resolved = resolved.replace(/\[Email\]/gi, context.lead.email || '[Email]');
    
    // Replace [Phone] with lead phone
    resolved = resolved.replace(/\[Phone\]/gi, context.lead.phone || '[Phone]');
    
    // Replace [ProjectDate] with formatted project date
    if (context.lead.projectDate) {
      const date = new Date(context.lead.projectDate);
      const formatted = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      resolved = resolved.replace(/\[ProjectDate\]/gi, formatted);
    } else {
      resolved = resolved.replace(/\[ProjectDate\]/gi, '[ProjectDate]');
    }
    
    // Replace [booking.link] with booking link
    resolved = resolved.replace(/\[booking\.link\]/gi, context.booking.link || '[booking.link]');

    // Support for {{contact.first_name}} legacy format
    resolved = resolved.replace(/\{\{contact\.first_name\}\}/gi, context.contact.first_name || '{{contact.first_name}}');
    resolved = resolved.replace(/\{\{contact\.last_name\}\}/gi, context.contact.last_name || '{{contact.last_name}}');

    return resolved;
  }
}

export const autoResponderWorker = new AutoResponderWorker();
