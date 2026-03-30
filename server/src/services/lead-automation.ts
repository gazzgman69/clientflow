import { eq, and, lte, sql, isNull, or, gte } from "drizzle-orm";
import { db } from "../../db";
import { leads, leadAutomationRules, leadStatusHistory, projects, messageTemplates } from "@shared/schema";
import type { LeadAutomationRule, Lead } from "@shared/schema";
import { leadStatusAutomator } from "./lead-status-automator";

class LeadAutomationService {
  private worker: NodeJS.Timeout | null = null;
  
  constructor() {
    // Don't auto-start to prevent duplicate timers when imported by job handlers
  }

  start() {
    // Run every 5 minutes
    this.worker = setInterval(() => {
      this.runTick().catch(console.error);
    }, 5 * 60 * 1000);
    
    console.log('🤖 Lead automation service started (5min intervals)');
  }

  stop() {
    if (this.worker) {
      clearInterval(this.worker);
      this.worker = null;
    }
  }

  async runTick(now = new Date()): Promise<void> {
    try {
      console.log('🤖 Running lead automation tick...', now.toISOString());
      
      // CRITICAL FIX: Get active tenants and process per tenant to ensure isolation
      const { storage } = await import('../../storage');
      const activeTenants = await storage.getActiveTenants();
      
      if (activeTenants.length === 0) {
        console.log('🏢 No active tenants found for lead automation');
        return;
      }
      
      console.log(`🏢 Processing lead automation for ${activeTenants.length} active tenants`);
      let totalMoved = 0;

      for (const tenant of activeTenants) {
        try {
          const tenantMoved = await this.processRulesForTenant(tenant.id, now);
          totalMoved += tenantMoved;
        } catch (error) {
          console.error(`🤖 Error processing rules for tenant ${tenant.id}:`, error);
        }
      }

      console.log(`🤖 Automation tick complete: ${totalMoved} leads moved across ${activeTenants.length} tenants`);
    } catch (error) {
      console.error('🤖 Automation tick failed:', error);
    }
  }

  private async processRulesForTenant(tenantId: string, now: Date): Promise<number> {
    console.log(`🏢 Processing automation rules for tenant: ${tenantId}`);

    // Import schema
    const { leadAutomationRules } = await import('@shared/schema');

    // Load enabled rules for this specific tenant
    const rules = await db
      .select()
      .from(leadAutomationRules)
      .where(and(
        eq(leadAutomationRules.enabled, true),
        eq(leadAutomationRules.tenantId, tenantId)
      ));

    if (rules.length === 0) {
      console.log(`🤖 No enabled automation rules found for tenant ${tenantId}`);
    } else {
      console.log(`🤖 Found ${rules.length} enabled rules for tenant ${tenantId}`);
    }

    let totalMoved = 0;

    for (const rule of rules) {
      try {
        const moved = await this.processRule(rule, now, tenantId);
        totalMoved += moved;
      } catch (error) {
        console.error(`🤖 Error processing rule ${rule.name} for tenant ${tenantId}:`, error);
      }
    }

    // Process hold expiry check - find leads with expired holds
    try {
      const expiredHolds = await db
        .select()
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, 'hold'),
          lte(leads.holdExpiresAt, now)
        ));

      for (const lead of expiredHolds) {
        try {
          await leadStatusAutomator.onHoldExpired(lead.id, tenantId);
          totalMoved++;
        } catch (error) {
          console.error(`🤖 Error processing hold expiry for lead ${lead.id}:`, error);
        }
      }

      if (expiredHolds.length > 0) {
        console.log(`🤖 Tenant ${tenantId}: ${expiredHolds.length} leads had expired holds`);
      }
    } catch (error) {
      console.error(`🤖 Error checking hold expiry for tenant ${tenantId}:`, error);
    }

    // Process ghosting timeout check - find leads inactive for 21 days
    try {
      const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const ghostedLeads = await db
        .select()
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          or(
            eq(leads.status, 'new'),
            eq(leads.status, 'contacted'),
            eq(leads.status, 'proposal_sent')
          ),
          lte(
            leads.lastContactAt || leads.createdAt,
            twentyOneDaysAgo
          )
        ));

      for (const lead of ghostedLeads) {
        try {
          // Only trigger if no manual status change in the last 24 hours
          if (!lead.lastManualStatusAt || new Date(lead.lastManualStatusAt) <= twentyFourHoursAgo) {
            const daysInactive = Math.floor((now.getTime() - (new Date(lead.lastContactAt || lead.createdAt).getTime())) / (24 * 60 * 60 * 1000));
            await leadStatusAutomator.onGhostingTimeout(lead.id, tenantId, daysInactive);
            totalMoved++;
          }
        } catch (error) {
          console.error(`🤖 Error processing ghosting timeout for lead ${lead.id}:`, error);
        }
      }

      if (ghostedLeads.length > 0) {
        console.log(`🤖 Tenant ${tenantId}: ${ghostedLeads.length} leads triggered ghosting timeout`);
      }
    } catch (error) {
      console.error(`🤖 Error checking ghosting timeout for tenant ${tenantId}:`, error);
    }

    // Process lost archiving check - find lost leads for 90 days
    try {
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const lostLeads = await db
        .select()
        .from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.status, 'lost'),
          lte(leads.updatedAt, ninetyDaysAgo)
        ));

      for (const lead of lostLeads) {
        try {
          const daysLost = Math.floor((now.getTime() - new Date(lead.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
          await leadStatusAutomator.onLostTimeout(lead.id, tenantId, daysLost);
          totalMoved++;
        } catch (error) {
          console.error(`🤖 Error processing lost timeout for lead ${lead.id}:`, error);
        }
      }

      if (lostLeads.length > 0) {
        console.log(`🤖 Tenant ${tenantId}: ${lostLeads.length} leads archived after lost timeout`);
      }
    } catch (error) {
      console.error(`🤖 Error checking lost timeout for tenant ${tenantId}:`, error);
    }

    console.log(`🤖 Tenant ${tenantId}: ${totalMoved} leads moved`);
    return totalMoved;
  }

  private async processRule(rule: LeadAutomationRule, now: Date, tenantId?: string): Promise<number> {
    console.log(`🤖 Processing rule: ${rule.name}`);
    
    // Get candidate leads - TENANT SCOPED
    let candidateLeads: Lead[];
    
    if (rule.fromStatus) {
      if (tenantId) {
        candidateLeads = await db
          .select()
          .from(leads)
          .where(and(
            eq(leads.tenantId, tenantId),
            eq(leads.status, rule.fromStatus)
          ));
      } else {
        candidateLeads = await db
          .select()
          .from(leads)
          .where(eq(leads.status, rule.fromStatus));
      }
    } else {
      if (tenantId) {
        candidateLeads = await db
          .select()
          .from(leads)
          .where(eq(leads.tenantId, tenantId));
      } else {
        candidateLeads = await db.select().from(leads);
      }
    }

    console.log(`🤖 Found ${candidateLeads.length} candidate leads for rule ${rule.name}`);
    
    let moved = 0;
    
    for (const lead of candidateLeads) {
      try {
        const shouldMove = await this.evaluateTrigger(rule, lead, now);
        
        if (shouldMove) {
          await this.moveLead(lead, rule, now);
          moved++;
        }
      } catch (error) {
        console.error(`🤖 Error evaluating lead ${lead.id} for rule ${rule.name}:`, error);
      }
    }

    console.log(`🤖 Rule ${rule.name}: moved ${moved} leads`);
    return moved;
  }

  private async evaluateTrigger(rule: LeadAutomationRule, lead: Lead, now: Date): Promise<boolean> {
    // Skip if already at target status
    if (lead.status === rule.toStatus) {
      return false;
    }

    // Check manual override protection
    if (rule.requireNoManualSinceMinutes && lead.lastManualStatusAt) {
      const minutesSinceManual = (now.getTime() - new Date(lead.lastManualStatusAt).getTime()) / (1000 * 60);
      if (minutesSinceManual < rule.requireNoManualSinceMinutes) {
        return false;
      }
    }

    // Check conflict blocking
    if (rule.ifConflictBlock) {
      const hasConflict = await this.hasConflict(lead);
      if (hasConflict) {
        return false;
      }
    }

    // Parse trigger config
    let triggerConfig: any;
    try {
      triggerConfig = JSON.parse(rule.triggerConfig);
    } catch {
      console.error(`🤖 Invalid trigger config for rule ${rule.name}`);
      return false;
    }

    // Evaluate trigger type
    switch (rule.triggerType) {
      case 'TIME_SINCE_CREATED':
        const minutesSinceCreated = (now.getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60);
        return minutesSinceCreated >= (triggerConfig.minutes || 0);

      case 'TIME_SINCE_LAST_CONTACT':
        if (!lead.lastContactAt) {
          // No contact = infinite time, so trigger fires
          return true;
        }
        const minutesSinceContact = (now.getTime() - new Date(lead.lastContactAt!).getTime()) / (1000 * 60);
        return minutesSinceContact >= (triggerConfig.minutes || 0);

      case 'PROJECT_DATE_IN_DAYS':
        // TODO: Implement project date checking
        return false;

      case 'FORM_ANSWER_EQUALS':
        const field = triggerConfig.field;
        const expectedValue = triggerConfig.equals;
        
        if (field === 'service' && lead.leadSource === expectedValue) {
          return true;
        }
        if (field === 'message' && lead.notes?.includes(expectedValue)) {
          return true;
        }
        return false;

      default:
        console.error(`🤖 Unknown trigger type: ${rule.triggerType}`);
        return false;
    }
  }

  private async hasConflict(lead: Lead): Promise<boolean> {
    // TODO: Implement conflict detection based on project dates
    // For now, return false
    return false;
  }

  private async moveLead(lead: Lead, rule: LeadAutomationRule, now: Date): Promise<void> {
    console.log(`🤖 Moving lead ${lead.id} from ${lead.status} to ${rule.toStatus} via rule ${rule.name}`);
    
    // Map pipeline status back to lead status
    let targetStatus = rule.toStatus;
    if (rule.toStatus === 'contacted') targetStatus = 'follow-up';
    if (rule.toStatus === 'archived') targetStatus = 'converted';

    // Update lead status
    await db
      .update(leads)
      .set({ 
        status: targetStatus,
        updatedAt: now
      })
      .where(eq(leads.id, lead.id));

    // Record status history
    await db.insert(leadStatusHistory).values({
      leadId: lead.id,
      fromStatus: lead.status,
      toStatus: rule.toStatus,
      reason: 'auto',
      metadata: JSON.stringify({ ruleId: rule.id, ruleName: rule.name }),
    });

    // TODO: Send email if actionEmailTemplateId is set
    if (rule.actionEmailTemplateId) {
      console.log(`🤖 TODO: Send email template ${rule.actionEmailTemplateId} to lead ${lead.id}`);
    }
  }

  async onEvent(type: string, payload: any): Promise<void> {
    console.log(`🤖 Automation event: ${type}`, payload);
    
    try {
      if (type === 'lead.created') {
        // Run rules that could apply to new leads immediately
        const rules = await db
          .select()
          .from(leadAutomationRules)
          .where(
            and(
              eq(leadAutomationRules.enabled, true),
              or(
                eq(leadAutomationRules.fromStatus, 'new'),
                isNull(leadAutomationRules.fromStatus)
              )
            )
          );

        for (const rule of rules) {
          const lead = await db.select().from(leads).where(eq(leads.id, payload.leadId)).limit(1);
          if (lead.length > 0) {
            const shouldMove = await this.evaluateTrigger(rule, lead[0], new Date());
            if (shouldMove) {
              await this.moveLead(lead[0], rule, new Date());
            }
          }
        }
      }
    } catch (error) {
      console.error(`🤖 Error handling event ${type}:`, error);
    }
  }

  // Admin function to get rule summary for UI
  async getRuleSummary(): Promise<{ [column: string]: boolean }> {
    const rules = await db
      .select()
      .from(leadAutomationRules)
      .where(eq(leadAutomationRules.enabled, true));

    const summary: { [column: string]: boolean } = {
      new: false,
      contacted: false,
      qualified: false,
      archived: false
    };

    for (const rule of rules) {
      if (rule.toStatus && summary.hasOwnProperty(rule.toStatus)) {
        summary[rule.toStatus] = true;
      }
    }

    return summary;
  }
}

// Singleton instance
export const leadAutomationService = new LeadAutomationService();
export default leadAutomationService;