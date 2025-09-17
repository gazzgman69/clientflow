import { eq, and, lte, sql, isNull, or } from "drizzle-orm";
import { db } from "../../db";
import { leads, leadAutomationRules, leadStatusHistory, projects, messageTemplates } from "@shared/schema";
import type { LeadAutomationRule, Lead } from "@shared/schema";

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
      
      // Load enabled rules
      const rules = await db
        .select()
        .from(leadAutomationRules)
        .where(eq(leadAutomationRules.enabled, true));

      if (rules.length === 0) {
        console.log('🤖 No enabled automation rules found');
        return;
      }

      console.log(`🤖 Found ${rules.length} enabled rules`);
      let totalMoved = 0;

      for (const rule of rules) {
        try {
          const moved = await this.processRule(rule, now);
          totalMoved += moved;
        } catch (error) {
          console.error(`🤖 Error processing rule ${rule.name}:`, error);
        }
      }

      console.log(`🤖 Automation tick complete: ${totalMoved} leads moved`);
    } catch (error) {
      console.error('🤖 Automation tick failed:', error);
    }
  }

  private async processRule(rule: LeadAutomationRule, now: Date): Promise<number> {
    console.log(`🤖 Processing rule: ${rule.name}`);
    
    // Get candidate leads
    let candidateLeads: Lead[];
    
    if (rule.fromStatus) {
      candidateLeads = await db
        .select()
        .from(leads)
        .where(eq(leads.status, rule.fromStatus));
    } else {
      candidateLeads = await db.select().from(leads);
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