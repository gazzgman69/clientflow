import { storage } from '../../storage';
import type { Lead } from '@shared/schema';

/**
 * LeadStatusAutomator - Handles event-driven automatic status transitions
 *
 * Triggers:
 * - Email sent to lead → auto-move to "contacted" (if currently "new")
 * - Proposal/quote sent → auto-move to "proposal_sent" (if currently "contacted" or "new")
 * - Project created from lead → auto-move to "converted"
 * - Hold expires → auto-move to "lost" with reason "Hold expired"
 * - No response timeout → auto-move to "lost" with reason "No response after follow-ups"
 *
 * Rules:
 * - Never downgrade status (e.g. don't move "proposal_sent" back to "contacted")
 * - Respect manual overrides (check lastManualStatusAt - don't auto-change if manually set within last 30 min)
 * - Log all changes to leadStatusHistory with reason "auto"
 * - Update lastContactAt when outbound communication happens
 */

const STATUS_ORDER = ['new', 'contacted', 'hold', 'proposal_sent', 'converted'];
const MANUAL_OVERRIDE_WINDOW_MINUTES = 30;

class LeadStatusAutomator {
  private static instance: LeadStatusAutomator;

  static getInstance(): LeadStatusAutomator {
    if (!this.instance) {
      this.instance = new LeadStatusAutomator();
    }
    return this.instance;
  }

  /**
   * Called when an email is sent to a lead
   */
  async onEmailSent(leadId: string, tenantId: string): Promise<void> {
    try {
      const lead = await storage.getLead(leadId, tenantId);
      if (!lead) {
        console.warn(`LeadStatusAutomator: Lead ${leadId} not found`);
        return;
      }

      // 1. Update lastContactAt
      const now = new Date();
      const updates: any = {
        lastContactAt: now,
      };

      // 2. If status is "new", auto-move to "contacted"
      if (lead.status === 'new') {
        // Check if we should respect a manual override
        if (!this.shouldRespectManualOverride(lead.lastManualStatusAt)) {
          updates.status = 'contacted';

          // 3. Log status change to history
          await this.logStatusChange(
            leadId,
            lead.status,
            'contacted',
            'Email sent to lead',
            { autoTransition: true }
          );
        }
      }

      // Update the lead
      if (Object.keys(updates).length > 0) {
        await storage.updateLead(leadId, updates, tenantId);
        console.log(`LeadStatusAutomator: Email sent - Lead ${leadId} updated`);
      }
    } catch (error) {
      console.error(`LeadStatusAutomator.onEmailSent error for lead ${leadId}:`, error);
    }
  }

  /**
   * Called when a proposal/quote is sent to a lead
   */
  async onProposalSent(leadId: string, tenantId: string): Promise<void> {
    try {
      const lead = await storage.getLead(leadId, tenantId);
      if (!lead) {
        console.warn(`LeadStatusAutomator: Lead ${leadId} not found`);
        return;
      }

      // 1. Update lastContactAt
      const now = new Date();
      const updates: any = {
        lastContactAt: now,
      };

      // 2. If status is "new" or "contacted", auto-move to "proposal_sent"
      if (lead.status === 'new' || lead.status === 'contacted') {
        // Check if we should respect a manual override
        if (!this.shouldRespectManualOverride(lead.lastManualStatusAt)) {
          const previousStatus = lead.status;
          updates.status = 'proposal_sent';

          // 3. Log status change to history
          await this.logStatusChange(
            leadId,
            previousStatus,
            'proposal_sent',
            'Proposal/quote sent to lead',
            { autoTransition: true }
          );
        }
      }

      // Update the lead
      if (Object.keys(updates).length > 0) {
        await storage.updateLead(leadId, updates, tenantId);
        console.log(`LeadStatusAutomator: Proposal sent - Lead ${leadId} updated`);
      }
    } catch (error) {
      console.error(`LeadStatusAutomator.onProposalSent error for lead ${leadId}:`, error);
    }
  }

  /**
   * Called when a project is created from a lead
   */
  async onProjectCreated(leadId: string, tenantId: string, projectId: string): Promise<void> {
    try {
      const lead = await storage.getLead(leadId, tenantId);
      if (!lead) {
        console.warn(`LeadStatusAutomator: Lead ${leadId} not found`);
        return;
      }

      // Don't auto-move if already converted or archived
      if (lead.status === 'converted' || lead.status === 'archived') {
        console.log(`LeadStatusAutomator: Lead ${leadId} already at terminal status ${lead.status}`);
        return;
      }

      const previousStatus = lead.status;
      const now = new Date();

      // 1. Auto-move to "converted" regardless of current status (except already converted/archived)
      // 2. Link the project to the lead
      const updates = {
        status: 'converted',
        projectId: projectId,
        updatedAt: now,
      };

      await storage.updateLead(leadId, updates, tenantId);

      // 3. Log status change to history
      await this.logStatusChange(
        leadId,
        previousStatus,
        'converted',
        'Project created from lead',
        { projectId, autoTransition: true }
      );

      console.log(`LeadStatusAutomator: Project created - Lead ${leadId} converted to project ${projectId}`);
    } catch (error) {
      console.error(`LeadStatusAutomator.onProjectCreated error for lead ${leadId}:`, error);
    }
  }

  /**
   * Called when a hold expires (checked by the automation tick)
   */
  async onHoldExpired(leadId: string, tenantId: string): Promise<void> {
    try {
      const lead = await storage.getLead(leadId, tenantId);
      if (!lead) {
        console.warn(`LeadStatusAutomator: Lead ${leadId} not found`);
        return;
      }

      // Only process if currently on hold
      if (lead.status !== 'hold') {
        console.log(`LeadStatusAutomator: Lead ${leadId} is not on hold, status is ${lead.status}`);
        return;
      }

      // Check if we should respect a manual override
      if (this.shouldRespectManualOverride(lead.lastManualStatusAt)) {
        console.log(`LeadStatusAutomator: Respecting manual override for hold expiry on lead ${leadId}`);
        return;
      }

      const now = new Date();

      // 1. Auto-move to "lost"
      // 2. Set lostReason to "Hold expired"
      const updates = {
        status: 'lost',
        lostReason: 'Hold expired',
        updatedAt: now,
      };

      await storage.updateLead(leadId, updates, tenantId);

      // 3. Log status change to history
      await this.logStatusChange(
        leadId,
        'hold',
        'lost',
        'Hold expired',
        { autoTransition: true }
      );

      console.log(`LeadStatusAutomator: Hold expired - Lead ${leadId} marked as lost`);
    } catch (error) {
      console.error(`LeadStatusAutomator.onHoldExpired error for lead ${leadId}:`, error);
    }
  }

  /**
   * Called when ghosting timeout is reached
   */
  async onGhostingTimeout(leadId: string, tenantId: string, daysInactive: number): Promise<void> {
    try {
      const lead = await storage.getLead(leadId, tenantId);
      if (!lead) {
        console.warn(`LeadStatusAutomator: Lead ${leadId} not found`);
        return;
      }

      // Only apply to leads in contacted or proposal_sent status
      if (lead.status !== 'contacted' && lead.status !== 'proposal_sent') {
        console.log(`LeadStatusAutomator: Lead ${leadId} not in applicable status for ghosting timeout`);
        return;
      }

      // Check if we should respect a manual override
      if (this.shouldRespectManualOverride(lead.lastManualStatusAt)) {
        console.log(`LeadStatusAutomator: Respecting manual override for ghosting timeout on lead ${leadId}`);
        return;
      }

      const previousStatus = lead.status;
      const now = new Date();

      // 1. Auto-move to "lost"
      // 2. Set lostReason to "No response"
      // 3. Set lostReasonNotes with details
      const updates = {
        status: 'lost',
        lostReason: 'No response',
        lostReasonNotes: `No response after ${daysInactive} days of inactivity`,
        updatedAt: now,
      };

      await storage.updateLead(leadId, updates, tenantId);

      // 4. Log status change to history
      await this.logStatusChange(
        leadId,
        previousStatus,
        'lost',
        'No response timeout',
        { daysInactive, autoTransition: true }
      );

      console.log(`LeadStatusAutomator: Ghosting timeout - Lead ${leadId} marked as lost after ${daysInactive} days`);
    } catch (error) {
      console.error(`LeadStatusAutomator.onGhostingTimeout error for lead ${leadId}:`, error);
    }
  }

  /**
   * Called when a lead has been lost for X days (auto-archive)
   */
  async onLostTimeout(leadId: string, tenantId: string, daysLost: number): Promise<void> {
    try {
      const lead = await storage.getLead(leadId, tenantId);
      if (!lead) {
        console.warn(`LeadStatusAutomator: Lead ${leadId} not found`);
        return;
      }

      // Only archive if status is lost
      if (lead.status !== 'lost') {
        console.log(`LeadStatusAutomator: Lead ${leadId} is not lost, status is ${lead.status}`);
        return;
      }

      // Check if we should respect a manual override
      if (this.shouldRespectManualOverride(lead.lastManualStatusAt)) {
        console.log(`LeadStatusAutomator: Respecting manual override for lost timeout on lead ${leadId}`);
        return;
      }

      const now = new Date();

      // 1. Auto-move to "archived"
      const updates = {
        status: 'archived',
        updatedAt: now,
      };

      await storage.updateLead(leadId, updates, tenantId);

      // 2. Log status change to history
      await this.logStatusChange(
        leadId,
        'lost',
        'archived',
        'Auto-archived after lost timeout',
        { daysLost, autoTransition: true }
      );

      console.log(`LeadStatusAutomator: Lost timeout - Lead ${leadId} archived after ${daysLost} days lost`);
    } catch (error) {
      console.error(`LeadStatusAutomator.onLostTimeout error for lead ${leadId}:`, error);
    }
  }

  /**
   * Helper: check if we should respect a manual override
   * Returns true if status was manually changed within the last MANUAL_OVERRIDE_WINDOW_MINUTES
   */
  private shouldRespectManualOverride(lastManualStatusAt: Date | null | undefined): boolean {
    if (!lastManualStatusAt) return false;
    const windowAgo = new Date(Date.now() - MANUAL_OVERRIDE_WINDOW_MINUTES * 60 * 1000);
    return new Date(lastManualStatusAt) > windowAgo;
  }

  /**
   * Helper: check if status transition is a valid "upgrade" (moving forward in the pipeline)
   */
  private isStatusUpgrade(fromStatus: string, toStatus: string): boolean {
    const fromIdx = STATUS_ORDER.indexOf(fromStatus);
    const toIdx = STATUS_ORDER.indexOf(toStatus);
    // If either status is not in the order list, allow it (for special statuses like 'archived')
    if (fromIdx === -1 || toIdx === -1) return true;
    return toIdx > fromIdx;
  }

  /**
   * Helper: log status change to history
   */
  private async logStatusChange(
    leadId: string,
    fromStatus: string,
    toStatus: string,
    trigger: string,
    metadata?: any
  ): Promise<void> {
    try {
      await storage.createLeadStatusHistory({
        leadId,
        fromStatus,
        toStatus,
        reason: 'auto',
        metadata: JSON.stringify({
          trigger,
          ...metadata
        }),
      });
      console.log(`LeadStatusAutomator: Status history logged for lead ${leadId}: ${fromStatus} → ${toStatus}`);
    } catch (error) {
      console.error(`LeadStatusAutomator: Failed to log status change for lead ${leadId}:`, error);
    }
  }
}

export const leadStatusAutomator = LeadStatusAutomator.getInstance();
export default leadStatusAutomator;
