import { storage } from '../../storage';
import { emailDispatcher } from './email-dispatcher';
import {
  followUpSequences,
  followUpSequenceSteps,
  followUpSequenceLogs,
  type FollowUpSequence,
  type FollowUpSequenceStep,
  type FollowUpSequenceLog
} from '@shared/schema';
import { eq, and, lte, gt } from 'drizzle-orm';

/**
 * FollowUpEngine - Processes follow-up sequences on a timer
 *
 * How it works:
 * 1. When a lead enters a trigger status, a sequence log is created with nextSendAt set
 * 2. The engine runs every 60 seconds checking for due sequence steps
 * 3. For each due step, it sends the email and advances to the next step
 * 4. If the lead replies (lastContactAt updated) or status changes, the sequence stops
 *
 * Integration points:
 * - startSequenceForLead(leadId, sequenceId, tenantId) - called when lead enters trigger status
 * - stopSequenceForLead(leadId, reason) - called when lead replies or status changes manually
 * - checkAndStartSequences(leadId, newStatus, tenantId) - called when lead status changes
 * - tick() - called by interval, processes all due steps
 */

class FollowUpEngine {
  private static instance: FollowUpEngine;
  private intervalId: NodeJS.Timeout | null = null;

  static getInstance() {
    if (!this.instance) this.instance = new FollowUpEngine();
    return this.instance;
  }

  start() {
    if (this.intervalId) return;
    console.log('📧 Starting follow-up sequence engine (every 60 seconds)');
    this.intervalId = setInterval(() => this.tick().catch(err => {
      console.error('[FollowUpEngine] Error in tick:', err);
    }), 60 * 1000);

    // Run immediately on startup
    this.tick().catch(err => {
      console.error('[FollowUpEngine] Error in initial tick:', err);
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[FollowUpEngine] Stopped follow-up sequence engine');
    }
  }

  /**
   * Start a follow-up sequence for a lead
   */
  async startSequenceForLead(leadId: string, sequenceId: string, tenantId: string): Promise<void> {
    try {
      const db = (storage as any).db;

      // Get the sequence
      const sequences = await db
        .select()
        .from(followUpSequences)
        .where(eq(followUpSequences.id, sequenceId));

      if (!sequences.length) {
        throw new Error(`Sequence ${sequenceId} not found`);
      }

      const sequence = sequences[0];

      // Check if lead is already in this sequence (avoid duplicates)
      const existingLogs = await db
        .select()
        .from(followUpSequenceLogs)
        .where(
          and(
            eq(followUpSequenceLogs.leadId, leadId),
            eq(followUpSequenceLogs.sequenceId, sequenceId),
            eq(followUpSequenceLogs.status, 'active')
          )
        );

      if (existingLogs.length > 0) {
        console.log(`📧 Lead ${leadId} already in active sequence ${sequenceId}, skipping`);
        return;
      }

      // Get first step
      const firstSteps = await db
        .select()
        .from(followUpSequenceSteps)
        .where(eq(followUpSequenceSteps.sequenceId, sequenceId))
        .orderBy(followUpSequenceSteps.stepNumber);

      if (!firstSteps.length) {
        throw new Error(`Sequence ${sequenceId} has no steps`);
      }

      const firstStep = firstSteps[0];

      // Calculate when to send first email
      const nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + firstStep.delayDays);

      // Create sequence log with status "active"
      const logs = await db
        .insert(followUpSequenceLogs)
        .values({
          tenantId,
          sequenceId,
          leadId,
          currentStep: 1,
          status: 'active',
          nextSendAt,
          startedAt: new Date()
        })
        .returning();

      if (logs.length > 0) {
        console.log(`📧 Started follow-up sequence ${sequenceId} for lead ${leadId}, first email in ${firstStep.delayDays} days`);
      }
    } catch (error: any) {
      console.error(`[FollowUpEngine] Error starting sequence for lead ${leadId}:`, error);
      throw error;
    }
  }

  /**
   * Stop all active sequences for a lead
   */
  async stopSequencesForLead(leadId: string, reason: string, tenantId: string): Promise<void> {
    try {
      const db = (storage as any).db;

      const updates = await db
        .update(followUpSequenceLogs)
        .set({
          status: 'stopped_manual',
          stoppedReason: reason,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(followUpSequenceLogs.leadId, leadId),
            eq(followUpSequenceLogs.tenantId, tenantId),
            eq(followUpSequenceLogs.status, 'active')
          )
        )
        .returning();

      if (updates.length > 0) {
        console.log(`📧 Stopped ${updates.length} sequence(s) for lead ${leadId}: ${reason}`);
      }
    } catch (error: any) {
      console.error(`[FollowUpEngine] Error stopping sequences for lead ${leadId}:`, error);
    }
  }

  /**
   * Process all due follow-up steps
   */
  async tick(): Promise<void> {
    try {
      const db = (storage as any).db;
      const now = new Date();

      // Find all sequence logs where nextSendAt <= now and status = 'active'
      const dueLogs = await db
        .select()
        .from(followUpSequenceLogs)
        .where(
          and(
            lte(followUpSequenceLogs.nextSendAt, now),
            eq(followUpSequenceLogs.status, 'active')
          )
        );

      if (dueLogs.length === 0) {
        return;
      }

      console.log(`📧 [FollowUpEngine] Found ${dueLogs.length} due follow-up step(s)`);

      for (const log of dueLogs) {
        await this.processSequenceStep(log, db);
      }
    } catch (error: any) {
      console.error('[FollowUpEngine] Error in tick:', error);
    }
  }

  /**
   * Process a single sequence step
   */
  private async processSequenceStep(log: FollowUpSequenceLog, db: any): Promise<void> {
    try {
      // Get sequence
      const sequences = await db
        .select()
        .from(followUpSequences)
        .where(eq(followUpSequences.id, log.sequenceId));

      if (!sequences.length) {
        throw new Error(`Sequence ${log.sequenceId} not found`);
      }

      const sequence = sequences[0];

      // Get the lead
      const lead = await storage.getLead(log.leadId, log.tenantId);
      if (!lead || !lead.email) {
        throw new Error('Lead not found or has no email');
      }

      // Check stop conditions
      // 1. Check if lead replied (lastContactAt changed after sequence started)
      if (sequence.stopOnReply && lead.lastContactAt && lead.lastContactAt > log.startedAt) {
        await db
          .update(followUpSequenceLogs)
          .set({
            status: 'stopped_reply',
            stoppedReason: 'Lead replied',
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(followUpSequenceLogs.id, log.id));

        console.log(`📧 Follow-up: Stopped sequence for lead ${log.leadId} - lead replied`);
        return;
      }

      // 2. Check if status changed manually
      if (sequence.stopOnStatusChange && lead.status !== sequence.triggerStatus) {
        await db
          .update(followUpSequenceLogs)
          .set({
            status: 'stopped_status_change',
            stoppedReason: `Status changed from ${sequence.triggerStatus} to ${lead.status}`,
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(followUpSequenceLogs.id, log.id));

        console.log(`📧 Follow-up: Stopped sequence for lead ${log.leadId} - status changed to ${lead.status}`);
        return;
      }

      // Get current step
      const steps = await db
        .select()
        .from(followUpSequenceSteps)
        .where(eq(followUpSequenceSteps.sequenceId, log.sequenceId))
        .orderBy(followUpSequenceSteps.stepNumber);

      const currentStep = steps.find(s => s.stepNumber === log.currentStep);
      if (!currentStep) {
        throw new Error(`Step ${log.currentStep} not found for sequence ${log.sequenceId}`);
      }

      // Get template if specified
      let subject = currentStep.subject;
      let bodyHtml = currentStep.body;

      if (currentStep.templateId) {
        const template = await storage.getTemplate(currentStep.templateId, log.tenantId);
        if (template) {
          subject = currentStep.subject || template.subject || template.title;
          bodyHtml = currentStep.body || template.body;
        }
      }

      if (!subject || !bodyHtml) {
        throw new Error(`Step ${log.currentStep} has no subject or body content`);
      }

      // Resolve tokens in subject and body
      const resolvedSubject = this.resolveTokens(subject, lead);
      const resolvedHtml = this.resolveTokens(bodyHtml, lead);

      // Convert HTML to plain text for fallback
      const { convert } = await import('html-to-text');

      // Normalize smart quotes and special characters
      let normalizedHtml = resolvedHtml
        .replace(/&#8217;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&#8211;/g, '-')
        .replace(/&#8212;/g, '--')
        .replace(/&ndash;/g, '-')
        .replace(/&mdash;/g, '--');

      const textBody = convert(normalizedHtml, {
        wordwrap: 130,
        preserveNewlines: true
      });

      // Send email via dispatcher
      const result = await emailDispatcher.sendEmail({
        to: lead.email,
        subject: resolvedSubject,
        text: textBody,
        html: normalizedHtml,
        tenantId: log.tenantId
      });

      if (!result.success) {
        throw new Error(result.error || 'Email dispatch failed');
      }

      // Store the sent email in the database if projectId exists
      if (result.messageId && lead.projectId) {
        try {
          await storage.createEmail({
            tenantId: log.tenantId,
            userId: log.tenantId, // Use tenantId as fallback user
            threadId: result.messageId,
            fromEmail: result.fromEmail || '',
            toEmails: [lead.email],
            ccEmails: [],
            bccEmails: [],
            subject: resolvedSubject,
            bodyText: textBody,
            bodyHtml: normalizedHtml,
            sentAt: new Date(),
            projectId: lead.projectId,
            isSent: true,
            direction: 'outbound',
            snippet: textBody?.substring(0, 100)
          }, log.tenantId);
          console.log(`📧 Follow-up: Stored email in database for project ${lead.projectId}`);
        } catch (dbError) {
          console.error(`[FollowUpEngine] Failed to store email in database:`, dbError);
          // Continue - email was sent successfully
        }
      }

      console.log(`📧 Follow-up: Sending step ${log.currentStep} of sequence ${log.sequenceId} to lead ${log.leadId}`);

      // Check if there's a next step
      const nextStep = steps.find(s => s.stepNumber === log.currentStep + 1);

      if (nextStep) {
        // Calculate when to send next email
        const nextSendAt = new Date();
        nextSendAt.setDate(nextSendAt.getDate() + nextStep.delayDays);

        // Advance to next step
        await db
          .update(followUpSequenceLogs)
          .set({
            currentStep: log.currentStep + 1,
            nextSendAt,
            updatedAt: new Date()
          })
          .where(eq(followUpSequenceLogs.id, log.id));

        console.log(`📧 Follow-up: Advanced to step ${log.currentStep + 1}, next send in ${nextStep.delayDays} days`);
      } else {
        // No more steps - mark as completed
        await db
          .update(followUpSequenceLogs)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(followUpSequenceLogs.id, log.id));

        console.log(`📧 Follow-up: Completed sequence ${log.sequenceId} for lead ${log.leadId}`);
      }
    } catch (error: any) {
      console.error(`[FollowUpEngine] Error processing sequence step for log ${log.id}:`, error);

      // Mark as failed
      const db = (storage as any).db;
      try {
        await db
          .update(followUpSequenceLogs)
          .set({
            status: 'stopped_manual',
            stoppedReason: `Error: ${error.message}`,
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(followUpSequenceLogs.id, log.id));
      } catch (updateError) {
        console.error(`[FollowUpEngine] Failed to mark log as failed:`, updateError);
      }
    }
  }

  /**
   * Check all active sequences for a trigger status and start them for new leads
   */
  async checkAndStartSequences(leadId: string, newStatus: string, tenantId: string): Promise<void> {
    try {
      const db = (storage as any).db;

      // Find sequences that trigger on this status
      const triggeredSequences = await db
        .select()
        .from(followUpSequences)
        .where(
          and(
            eq(followUpSequences.tenantId, tenantId),
            eq(followUpSequences.triggerStatus, newStatus),
            eq(followUpSequences.isActive, true)
          )
        );

      if (triggeredSequences.length === 0) {
        return;
      }

      console.log(`📧 Found ${triggeredSequences.length} sequence(s) triggered by status "${newStatus}"`);

      for (const sequence of triggeredSequences) {
        await this.startSequenceForLead(leadId, sequence.id, tenantId);
      }
    } catch (error: any) {
      console.error(`[FollowUpEngine] Error checking sequences for lead ${leadId}:`, error);
    }
  }

  /**
   * Resolve tokens in template text
   */
  private resolveTokens(text: string, lead: any): string {
    let resolved = text;

    // Replace [FirstName] with lead firstName
    resolved = resolved.replace(/\[FirstName\]/gi, lead.firstName || '[FirstName]');

    // Replace [LastName] with lead lastName
    resolved = resolved.replace(/\[LastName\]/gi, lead.lastName || '[LastName]');

    // Replace [Email] with lead email
    resolved = resolved.replace(/\[Email\]/gi, lead.email || '[Email]');

    // Replace [Phone] with lead phone
    resolved = resolved.replace(/\[Phone\]/gi, lead.phone || '[Phone]');

    // Replace [ProjectDate] with formatted project date
    if (lead.projectDate) {
      const date = new Date(lead.projectDate);
      const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      resolved = resolved.replace(/\[ProjectDate\]/gi, formatted);
    } else {
      resolved = resolved.replace(/\[ProjectDate\]/gi, '[ProjectDate]');
    }

    // Support for {{contact.first_name}} legacy format
    resolved = resolved.replace(/\{\{contact\.first_name\}\}/gi, lead.firstName || '{{contact.first_name}}');
    resolved = resolved.replace(/\{\{contact\.last_name\}\}/gi, lead.lastName || '{{contact.last_name}}');

    return resolved;
  }
}

export const followUpEngine = FollowUpEngine.getInstance();
