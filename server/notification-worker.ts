import { storage } from './storage';
import { urgencyService } from './urgency-service';
import { emailDispatcher } from './email-dispatcher';
import { Contact, LeadFollowUpNotification, Email, AutoReplyLog } from '@shared/schema';

interface NotificationWorkerOptions {
  tenantId: string;
  userId?: string;
  forceRun?: boolean;
}

interface NotificationCheckResult {
  notificationsCreated: number;
  emailsQueued: number;
  leadsAnalyzed: number;
  errors: Array<{ leadId: string; error: string }>;
}

class NotificationWorker {
  private isRunning = false;
  private lastRunTime: Map<string, Date> = new Map();

  async run(options: NotificationWorkerOptions): Promise<NotificationCheckResult> {
    const { tenantId, userId, forceRun = false } = options;
    const workerKey = `${tenantId}-${userId || 'all'}`;

    if (this.isRunning && !forceRun) {
      console.log('⏩ Notification worker already running, skipping');
      return { notificationsCreated: 0, emailsQueued: 0, leadsAnalyzed: 0, errors: [] };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🔔 Starting notification worker', { tenantId, userId, forceRun });

      // Get notification settings
      const settings = await storage.getNotificationSettings(tenantId, userId);
      
      if (!settings?.emailNotificationsEnabled && !settings?.inAppNotificationsEnabled) {
        console.log('⏩ Notifications disabled for this tenant/user, skipping');
        return { notificationsCreated: 0, emailsQueued: 0, leadsAnalyzed: 0, errors: [] };
      }

      // Get all contacts (leads) - we'll use contacts instead of a separate leads table
      const contacts = await storage.getContacts(tenantId);
      let activeLeads = contacts.filter(c => c.type === 'lead' || c.isLead);
      
      // CRITICAL: Filter to only the target user's leads to respect per-user settings
      if (userId) {
        activeLeads = activeLeads.filter(lead => lead.userId === userId);
        console.log(`📊 Analyzing ${activeLeads.length} leads for user ${userId}`);
      } else {
        console.log(`📊 Analyzing ${activeLeads.length} leads for entire tenant (all users)`);
      }

      if (activeLeads.length === 0) {
        return { notificationsCreated: 0, emailsQueued: 0, leadsAnalyzed: 0, errors: [] };
      }

      const contactIds = activeLeads.map(c => c.id);

      // BATCH FETCH 1: Projects for all leads to avoid N+1
      const projectsMap = await storage.getProjectsByContacts(contactIds);

      // BATCH FETCH 2: Emails for all leads to avoid N+1
      const allEmails = await storage.getEmails(tenantId);
      const emailsByContact = new Map<string, Email[]>();
      for (const email of allEmails) {
        if (email.contactId && contactIds.includes(email.contactId)) {
          if (!emailsByContact.has(email.contactId)) {
            emailsByContact.set(email.contactId, []);
          }
          emailsByContact.get(email.contactId)!.push(email);
        }
      }

      // BATCH FETCH 3: Auto-reply logs for ALL leads in a single query
      const leadIds = activeLeads.map(l => l.id);
      const autoReplyLogsByLead = await storage.getAutoReplyLogsByLeads(leadIds, tenantId);

      // BATCH FETCH 4: Existing notifications to avoid duplicates
      const existingNotifications = userId 
        ? await storage.getLeadNotifications(userId, tenantId, true)
        : [];
      const notificationsByLead = new Map<string, LeadFollowUpNotification[]>();
      for (const notification of existingNotifications) {
        if (notification.leadId) {
          if (!notificationsByLead.has(notification.leadId)) {
            notificationsByLead.set(notification.leadId, []);
          }
          notificationsByLead.get(notification.leadId)!.push(notification);
        }
      }

      const results: NotificationCheckResult = {
        notificationsCreated: 0,
        emailsQueued: 0,
        leadsAnalyzed: 0,
        errors: []
      };

      // Analyze leads for urgent follow-ups
      const urgentLeads = await this.analyzeUrgentLeads({
        activeLeads,
        projectsMap,
        emailsByContact,
        autoReplyLogsByLead,
        notificationsByLead,
        settings,
        tenantId,
        userId
      });

      results.leadsAnalyzed = urgentLeads.analyzed;
      results.errors = urgentLeads.errors;

      // Create in-app notifications ONLY if enabled
      if (settings.inAppNotificationsEnabled && urgentLeads.leads.length > 0) {
        results.notificationsCreated = await this.createInAppNotifications({
          urgentLeads: urgentLeads.leads,
          tenantId,
          userId
        });
      }

      // Queue email digest ONLY if email notifications are enabled
      // Email digest works independently of in-app notifications
      if (settings.emailNotificationsEnabled && urgentLeads.leads.length > 0 && userId) {
        const emailSent = await this.queueEmailDigest({
          urgentLeads: urgentLeads.leads,
          tenantId,
          userId,
          settings
        });
        if (emailSent) {
          results.emailsQueued = urgentLeads.leads.length;
        }
      }

      // Update last run time
      this.lastRunTime.set(workerKey, new Date());

      const duration = Date.now() - startTime;
      console.log(`🔔 Notification worker completed in ${duration}ms`, {
        notificationsCreated: results.notificationsCreated,
        emailsQueued: results.emailsQueued,
        leadsAnalyzed: results.leadsAnalyzed,
        errors: results.errors.length,
        tenantId
      });

      return results;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Analyze leads and identify those needing urgent follow-up
   */
  private async analyzeUrgentLeads(params: {
    activeLeads: Contact[];
    projectsMap: Map<string, any[]>;
    emailsByContact: Map<string, Email[]>;
    autoReplyLogsByLead: Map<string, AutoReplyLog[]>;
    notificationsByLead: Map<string, LeadFollowUpNotification[]>;
    settings: any;
    tenantId: string;
    userId?: string;
  }): Promise<{
    leads: Array<{ lead: Contact; urgency: any; message: string }>;
    analyzed: number;
    errors: Array<{ leadId: string; error: string }>;
  }> {
    const { activeLeads, projectsMap, emailsByContact, autoReplyLogsByLead, notificationsByLead, settings, tenantId, userId } = params;
    
    const urgentLeads: Array<{ lead: Contact; urgency: any; message: string }> = [];
    const errors: Array<{ leadId: string; error: string }> = [];
    let analyzed = 0;

    for (const lead of activeLeads) {
      try {
        analyzed++;

        // Get pre-fetched data for this lead
        const projects = projectsMap.get(lead.id) || [];
        const emails = emailsByContact.get(lead.id) || [];
        const autoReplyLogs = autoReplyLogsByLead.get(lead.id) || [];
        
        // Calculate urgency
        const urgency = await urgencyService.calculateLeadUrgency(
          lead,
          tenantId,
          userId || lead.userId || '',
          projects
        );

        // Check if urgency score is high enough
        if (urgency.score < 50) {
          continue; // Not urgent enough to notify
        }

        // Check if we already have a recent notification for this lead
        const leadNotifications = notificationsByLead.get(lead.id) || [];
        const recentNotification = leadNotifications.find((n: LeadFollowUpNotification) => {
          const createdAt = new Date(n.createdAt!);
          const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
          const threshold = settings.followUpThresholdHours || 24;
          return hoursSince < threshold;
        });

        if (recentNotification) {
          console.log(`⏩ Skipping lead ${lead.id} - recent notification exists`);
          continue;
        }

        // Generate notification message
        const message = urgencyService.generateNotificationMessage(lead, urgency);

        urgentLeads.push({ lead, urgency, message });

      } catch (error) {
        console.error(`❌ Error processing lead ${lead.id}:`, error);
        errors.push({
          leadId: lead.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { leads: urgentLeads, analyzed, errors };
  }

  /**
   * Create in-app notifications for urgent leads
   */
  private async createInAppNotifications(params: {
    urgentLeads: Array<{ lead: Contact; urgency: any; message: string }>;
    tenantId: string;
    userId?: string;
  }): Promise<number> {
    const { urgentLeads, tenantId, userId } = params;
    let created = 0;

    console.log(`📱 Creating ${urgentLeads.length} in-app notifications`);

    for (const { lead, urgency, message } of urgentLeads) {
      try {
        await storage.createLeadNotification({
          tenantId,
          userId: userId || lead.userId,
          leadId: lead.id,
          type: 'follow_up_reminder',
          title: `Follow up needed: ${lead.firstName} ${lead.lastName}`,
          message,
          urgencyScore: urgency.score,
          priority: urgency.priority,
          actionUrl: `/contacts?selected=${lead.id}`,
          metadata: JSON.stringify({
            leadName: `${lead.firstName} ${lead.lastName}`,
            leadEmail: lead.email,
            urgencyReasons: urgency.reasons,
            daysSinceContact: urgency.daysSinceContact,
            daysUntilEvent: urgency.daysUntilEvent,
            needsReply: urgency.needsReply
          })
        }, tenantId);

        created++;
        console.log(`✅ Created in-app notification for lead ${lead.id} (urgency: ${urgency.score})`);
      } catch (error) {
        console.error(`❌ Failed to create notification for lead ${lead.id}:`, error);
      }
    }

    return created;
  }

  /**
   * Queue email digest based on frequency settings
   * Works independently from in-app notifications
   */
  private async queueEmailDigest(params: {
    urgentLeads: Array<{ lead: Contact; urgency: any; message: string }>;
    tenantId: string;
    userId: string;
    settings: any;
  }): Promise<boolean> {
    const { urgentLeads, tenantId, userId, settings } = params;

    try {
      console.log(`📧 Queueing email digest with ${urgentLeads.length} urgent leads`);

      // Get user email
      const user = await storage.getUser(userId, tenantId);
      if (!user?.email) {
        console.warn('⚠️ Cannot send email - user email not found');
        return false;
      }

      // Check email frequency and last digest time
      const frequency = settings.emailFrequency || 'daily_digest';
      
      if (frequency === 'disabled') {
        console.log('⏩ Email notifications are disabled');
        return false;
      }

      // TODO: Add frequency checking logic here
      // - For 'real_time': send immediately
      // - For 'daily_digest': check if we already sent today
      // - For 'weekly_digest': check if we already sent this week
      // For now, send immediately regardless of frequency

      // Build email content
      const subject = `You have ${urgentLeads.length} lead follow-up reminder${urgentLeads.length > 1 ? 's' : ''}`;
      
      let emailBody = `<h2>Lead Follow-Up Reminders</h2>`;
      emailBody += `<p>You have ${urgentLeads.length} lead${urgentLeads.length > 1 ? 's' : ''} that need your attention:</p>`;
      emailBody += `<ul>`;
      
      for (const { lead, urgency, message } of urgentLeads) {
        emailBody += `<li><strong>${lead.firstName} ${lead.lastName}</strong> (Urgency: ${urgency.score}/100)<br>${message}</li>`;
      }
      
      emailBody += `</ul>`;
      emailBody += `<p><a href="${process.env.REPLIT_DEV_DOMAIN || ''}/contacts">View all leads</a></p>`;

      await emailDispatcher.send({
        tenantId,
        to: user.email,
        subject,
        html: emailBody,
        tags: ['notification-digest']
      });

      console.log(`✅ Sent email digest to ${user.email}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to send email digest:', error);
      return false;
    }
  }

  /**
   * Get last run time for a tenant/user
   */
  getLastRunTime(tenantId: string, userId?: string): Date | undefined {
    const workerKey = `${tenantId}-${userId || 'all'}`;
    return this.lastRunTime.get(workerKey);
  }

  /**
   * Clear last run time (useful for testing)
   */
  clearLastRunTime(tenantId: string, userId?: string): void {
    const workerKey = `${tenantId}-${userId || 'all'}`;
    this.lastRunTime.delete(workerKey);
  }
}

export const notificationWorker = new NotificationWorker();
