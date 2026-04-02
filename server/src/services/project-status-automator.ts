import { storage } from '../../storage';

const STATUS_ORDER = ['new', 'contacted', 'hold', 'proposal_sent', 'booked', 'completed'];
const MANUAL_OVERRIDE_WINDOW_MINUTES = 30;

class ProjectStatusAutomator {
  private static instance: ProjectStatusAutomator;

  static getInstance(): ProjectStatusAutomator {
    if (!this.instance) {
      this.instance = new ProjectStatusAutomator();
    }
    return this.instance;
  }

  /**
   * Called when a manual (human) email is sent to a project contact.
   * Auto-responders must NOT call this — they fire without status changes.
   * Trigger: new → contacted
   */
  async onEmailSent(projectId: string, tenantId: string): Promise<void> {
    try {
      const project = await storage.getProject(projectId, tenantId);
      if (!project) return;

      const updates: any = { lastContactAt: new Date() };

      if (project.status === 'new' && !this.shouldRespectManualOverride(project.lastManualStatusAt)) {
        updates.status = 'contacted';
        console.log(`[ProjectStatusAutomator] Email sent — Project ${projectId}: new → contacted`);
      }

      await storage.updateProject(projectId, updates, tenantId);
    } catch (error) {
      console.error(`[ProjectStatusAutomator] onEmailSent error for project ${projectId}:`, error);
    }
  }

  /**
   * Called when a contract or invoice is sent to the client.
   * Trigger: new/contacted → proposal_sent
   */
  async onDocumentSent(projectId: string, tenantId: string): Promise<void> {
    try {
      const project = await storage.getProject(projectId, tenantId);
      if (!project) return;

      if (
        (project.status === 'new' || project.status === 'contacted') &&
        !this.shouldRespectManualOverride(project.lastManualStatusAt)
      ) {
        const prevStatus = project.status;
        await storage.updateProject(projectId, {
          status: 'proposal_sent',
          lastContactAt: new Date(),
        }, tenantId);
        console.log(`[ProjectStatusAutomator] Document sent — Project ${projectId}: ${prevStatus} → proposal_sent`);
      }
    } catch (error) {
      console.error(`[ProjectStatusAutomator] onDocumentSent error for project ${projectId}:`, error);
    }
  }

  /**
   * Called when a contract is fully signed OR an invoice is paid.
   * Checks that BOTH conditions are now true: signed contract + paid invoice.
   * Trigger: proposal_sent (or earlier) → booked
   */
  async onBookingConditionMet(projectId: string, tenantId: string): Promise<void> {
    try {
      const project = await storage.getProject(projectId, tenantId);
      if (!project) return;

      // Only progress forward — never downgrade
      if (!['new', 'contacted', 'proposal_sent'].includes(project.status)) return;
      if (this.shouldRespectManualOverride(project.lastManualStatusAt)) return;

      const projectContracts = await storage.getContractsByProject(projectId);
      const hasSigned = projectContracts.some((c: any) => c.status === 'signed');

      const projectInvoices = await storage.getInvoicesByProject(projectId);
      const hasPaid = projectInvoices.some((inv: any) => inv.status === 'paid');

      if (hasSigned && hasPaid) {
        await storage.updateProject(projectId, { status: 'booked' }, tenantId);
        console.log(`[ProjectStatusAutomator] Booked — Project ${projectId}: ${project.status} → booked`);
      }
    } catch (error) {
      console.error(`[ProjectStatusAutomator] onBookingConditionMet error for project ${projectId}:`, error);
    }
  }

  /**
   * Called by a scheduled job when a project hold has expired.
   * Trigger: hold → lost
   */
  async onHoldExpired(projectId: string, tenantId: string): Promise<void> {
    try {
      const project = await storage.getProject(projectId, tenantId);
      if (!project || project.status !== 'hold') return;
      if (this.shouldRespectManualOverride(project.lastManualStatusAt)) return;

      await storage.updateProject(projectId, {
        status: 'lost',
        lostReason: 'Hold expired',
      }, tenantId);
      console.log(`[ProjectStatusAutomator] Hold expired — Project ${projectId}: hold → lost`);
    } catch (error) {
      console.error(`[ProjectStatusAutomator] onHoldExpired error for project ${projectId}:`, error);
    }
  }

  /**
   * Called by a scheduled job when a project has had no contact for X days.
   * Trigger: new/contacted/proposal_sent → lost
   */
  async onGhostingTimeout(projectId: string, tenantId: string, daysInactive: number): Promise<void> {
    try {
      const project = await storage.getProject(projectId, tenantId);
      if (!project) return;
      if (!['new', 'contacted', 'proposal_sent'].includes(project.status)) return;
      if (this.shouldRespectManualOverride(project.lastManualStatusAt)) return;

      await storage.updateProject(projectId, {
        status: 'lost',
        lostReason: 'No response',
        lostReasonNotes: `No response after ${daysInactive} days of inactivity`,
      }, tenantId);
      console.log(`[ProjectStatusAutomator] Ghosting timeout — Project ${projectId}: ${project.status} → lost after ${daysInactive} days`);
    } catch (error) {
      console.error(`[ProjectStatusAutomator] onGhostingTimeout error for project ${projectId}:`, error);
    }
  }

  private shouldRespectManualOverride(lastManualStatusAt: Date | null | undefined): boolean {
    if (!lastManualStatusAt) return false;
    const windowAgo = new Date(Date.now() - MANUAL_OVERRIDE_WINDOW_MINUTES * 60 * 1000);
    return new Date(lastManualStatusAt) > windowAgo;
  }
}

export const projectStatusAutomator = ProjectStatusAutomator.getInstance();
export default projectStatusAutomator;
