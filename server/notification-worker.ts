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

      // BATCH FETCH 3: Auto-reply logs for ALL leads
      // TODO: Add true batch method storage.getAutoReplyLogsByLeads(leadIds, tenantId) to eliminate N queries
      // Current implementation: Parallelized per-lead fetches (not ideal but better than sequential)
      // Limitation: Still issues N database queries, just in parallel
      const autoReplyLogsByLead = new Map<string, AutoReplyLog[]>();
      await Promise.all(activeLeads.map(async (lead) => {
        const logs = await storage.getAutoReplyLogs(lead.id, tenantId);
        if (logs.length > 0) {
          autoReplyLogsByLead.set(lead.id, logs);
        }
      }));

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

      // Track leads needing notifications for email digest
      const leadsNeedingNotification: Array<{ lead: Contact; urgency: any; message: string }> = [];

      // Check each lead for urgency
      for (const lead of activeLeads) {
        try {
          results.leadsAnalyzed++;

          // Get pre-fetched data for this lead
          const projects = projectsMap.get(lead.id) || [];
          const emails = emailsByContact.get(lead.id) || [];
          const autoReplyLogs = autoReplyLogsByLead.get(lead.id) || [];
          
          // Calculate urgency score using pre-fetched data
          const sortedEmails = emails.sort((a, b) => 
            new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
          );
          
          const hasAutoReply = autoReplyLogs.length > 0;
          const latestAutoReply = autoReplyLogs[0];
          const hasPersonalReply = sortedEmails.some(email => 
            email.direction === 'outbound' && 
            (!latestAutoReply || new Date(email.createdAt!) > new Date(latestAutoReply.sentAt!))
          );
          
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

          // Add to notification queue
          leadsNeedingNotification.push({ lead, urgency, message });

        } catch (error) {
          console.error(`❌ Error processing lead ${lead.id}:`, error);
          results.errors.push({
            leadId: lead.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Create in-app notifications ONLY if enabled
      if (settings.inAppNotificationsEnabled && leadsNeedingNotification.length > 0) {
        console.log(`📱 Creating ${leadsNeedingNotification.length} in-app notifications`);
        
        for (const { lead, urgency, message } of leadsNeedingNotification) {
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

            results.notificationsCreated++;
            console.log(`✅ Created in-app notification for lead ${lead.id} (urgency: ${urgency.score})`);
          } catch (error) {
            console.error(`❌ Failed to create notification for lead ${lead.id}:`, error);
          }
        }
      }

      // Send email digest ONLY if email notifications are enabled
      // This works independently of in-app notifications
      if (settings.emailNotificationsEnabled && leadsNeedingNotification.length > 0 && userId) {
        console.log(`📧 Sending email digest with ${leadsNeedingNotification.length} notifications`);
        
        try {
          const user = await storage.getUser(userId, tenantId);
          if (user?.email) {
            const subject = `You have ${leadsNeedingNotification.length} lead follow-up reminder${leadsNeedingNotification.length > 1 ? 's' : ''}`;
            
            let emailBody = `<h2>Lead Follow-Up Reminders</h2>`;
            emailBody += `<p>You have ${leadsNeedingNotification.length} lead${leadsNeedingNotification.length > 1 ? 's' : ''} that need your attention:</p>`;
            emailBody += `<ul>`;
            
            for (const { lead, urgency, message } of leadsNeedingNotification) {
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

            results.emailsQueued = leadsNeedingNotification.length;
            console.log(`✅ Sent email digest to ${user.email}`);
          } else {
            console.warn('⚠️ Cannot send email - user email not found');
          }
        } catch (error) {
          console.error('❌ Failed to send email digest:', error);
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
   * Send email digest of notifications based on user preferences
   */
  async sendEmailDigest(options: NotificationWorkerOptions): Promise<void> {
    const { tenantId, userId } = options;

    try {
      console.log('📧 Checking for email digest notifications', { tenantId, userId });

      // Get notification settings
      const settings = await storage.getNotificationSettings(tenantId, userId);
      
      if (!settings?.emailNotificationsEnabled) {
        console.log('⏩ Email notifications disabled, skipping digest');
        return;
      }

      // Must have userId to send emails
      if (!userId) {
        console.warn('⚠️ Cannot send digest - no userId provided');
        return;
      }

      // Check email frequency setting
      const frequency = settings.emailFrequency || 'daily_digest';
      
      if (frequency === 'disabled') {
        console.log('⏩ Email notifications are disabled');
        return;
      }

      // Get unread notifications (these are the in-app ones if enabled, or we use urgent leads)
      const notifications = await storage.getLeadNotifications(userId, tenantId, true);
      
      if (notifications.length === 0) {
        console.log('⏩ No unread notifications to send');
        return;
      }

      // Get user email
      const user = await storage.getUser(userId, tenantId);
      if (!user?.email) {
        console.warn('⚠️ Cannot send digest - user email not found');
        return;
      }

      // Build email content
      const subject = `You have ${notifications.length} lead follow-up reminder${notifications.length > 1 ? 's' : ''}`;
      
      let emailBody = `<h2>Lead Follow-Up Reminders</h2>`;
      emailBody += `<p>You have ${notifications.length} lead${notifications.length > 1 ? 's' : ''} that need your attention:</p>`;
      emailBody += `<ul>`;
      
      for (const notification of notifications) {
        emailBody += `<li><strong>${notification.title}</strong><br>${notification.message}</li>`;
      }
      
      emailBody += `</ul>`;
      emailBody += `<p><a href="${process.env.REPLIT_DEV_DOMAIN || ''}/contacts">View all leads</a></p>`;

      // Send email via EmailDispatcher
      await emailDispatcher.send({
        tenantId,
        to: user.email,
        subject,
        html: emailBody,
        tags: ['notification-digest']
      });

      console.log(`✅ Sent email digest to ${user.email} with ${notifications.length} notifications`);

    } catch (error) {
      console.error('❌ Error sending email digest:', error);
      throw error;
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
