import { Contact, Email, AutoReplyLog, Project } from '@shared/schema';
import { storage } from './storage';

export interface UrgencyAnalysis {
  score: number; // 0-100
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reasons: string[];
  needsReply: boolean;
  daysSinceContact: number;
  daysUntilEvent: number | null;
  hasAutoReply: boolean;
  hasPersonalReply: boolean;
}

export class UrgencyService {
  /**
   * Calculate urgency score for a lead
   * Factors:
   * 1. Time since last contact (0-40 points)
   * 2. Event date proximity (0-30 points)
   * 3. Response status (0-30 points)
   */
  async calculateLeadUrgency(
    lead: Contact,
    tenantId: string,
    userId: string,
    projects?: Project[] // Optional pre-fetched projects to avoid N+1
  ): Promise<UrgencyAnalysis> {
    const reasons: string[] = [];
    let score = 0;
    
    // Get lead's project to check event date (use pre-fetched if available)
    const leadProjects = projects || await storage.getProjectsByContact(lead.id, tenantId);
    const primaryProject = leadProjects.find(p => p.id === lead.projectId) || leadProjects[0];
    
    // Get emails for this lead
    const emails = await storage.getEmailsByContact(lead.id, tenantId);
    const sortedEmails = emails.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
    
    // Get auto-reply logs
    const autoReplyLogs = await storage.getAutoReplyLogs(lead.id, tenantId);
    const hasAutoReply = autoReplyLogs.length > 0;
    
    // Check if there's been a personal reply (outbound email after auto-reply)
    const latestAutoReply = autoReplyLogs[0];
    const hasPersonalReply = sortedEmails.some(email => 
      email.direction === 'outbound' && 
      (!latestAutoReply || new Date(email.createdAt!) > new Date(latestAutoReply.sentAt!))
    );
    
    // FACTOR 1: Time since last contact (0-40 points)
    const latestEmail = sortedEmails[0];
    const daysSinceContact = latestEmail
      ? (Date.now() - new Date(latestEmail.createdAt!).getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    
    if (daysSinceContact < 1) {
      score += 40;
      reasons.push('New inquiry (less than 24 hours old)');
    } else if (daysSinceContact < 2) {
      score += 30;
      reasons.push('Recent inquiry (1-2 days ago)');
    } else if (daysSinceContact < 3) {
      score += 20;
      reasons.push('Inquiry from 2-3 days ago');
    } else if (daysSinceContact < 7) {
      score += 10;
      reasons.push('Inquiry from this week');
    } else {
      score += 5;
      reasons.push(`No contact in ${Math.floor(daysSinceContact)} days`);
    }
    
    // FACTOR 2: Event date proximity (0-30 points)
    let daysUntilEvent: number | null = null;
    if (primaryProject?.eventDate) {
      daysUntilEvent = (new Date(primaryProject.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilEvent < 7) {
        score += 30;
        reasons.push('Event is less than 1 week away!');
      } else if (daysUntilEvent < 14) {
        score += 25;
        reasons.push('Event is within 2 weeks');
      } else if (daysUntilEvent < 30) {
        score += 20;
        reasons.push('Event is within 1 month');
      } else if (daysUntilEvent < 60) {
        score += 10;
        reasons.push('Event is within 2 months');
      } else {
        score += 5;
      }
    }
    
    // FACTOR 3: Response status (0-30 points)
    const inboundEmails = sortedEmails.filter(e => e.direction === 'inbound');
    const outboundEmails = sortedEmails.filter(e => e.direction === 'outbound');
    
    let needsReply = false;
    if (inboundEmails.length > 0 && outboundEmails.length === 0) {
      // Never replied at all
      score += 30;
      reasons.push('No reply sent yet');
      needsReply = true;
    } else if (hasAutoReply && !hasPersonalReply && inboundEmails.length > 0) {
      // Auto-replied but no personal reply yet
      score += 25;
      reasons.push('Only auto-reply sent, needs personal response');
      needsReply = true;
    } else if (inboundEmails.length > 0 && outboundEmails.length > 0) {
      // Check if latest message is from them (awaiting our response)
      const latestMessage = sortedEmails[0];
      if (latestMessage.direction === 'inbound') {
        score += 20;
        reasons.push('Waiting for your response');
        needsReply = true;
      }
    }
    
    // Determine priority based on score
    let priority: 'low' | 'medium' | 'high' | 'urgent';
    if (score >= 70) {
      priority = 'urgent';
    } else if (score >= 50) {
      priority = 'high';
    } else if (score >= 30) {
      priority = 'medium';
    } else {
      priority = 'low';
    }
    
    return {
      score,
      priority,
      reasons,
      needsReply,
      daysSinceContact: Math.floor(daysSinceContact),
      daysUntilEvent,
      hasAutoReply,
      hasPersonalReply
    };
  }
  
  /**
   * Generate notification message based on urgency analysis
   */
  generateNotificationMessage(lead: Contact, analysis: UrgencyAnalysis): string {
    if (analysis.needsReply && analysis.daysSinceContact < 1) {
      return `New lead: ${lead.firstName} ${lead.lastName} needs a response`;
    }
    
    if (analysis.needsReply && analysis.hasAutoReply && !analysis.hasPersonalReply) {
      return `${lead.firstName} ${lead.lastName} received auto-reply ${analysis.daysSinceContact} days ago - needs personal response`;
    }
    
    if (analysis.needsReply && analysis.daysSinceContact >= 2) {
      return `${lead.firstName} ${lead.lastName} hasn't been replied to in ${analysis.daysSinceContact} days`;
    }
    
    if (analysis.daysUntilEvent !== null && analysis.daysUntilEvent < 7) {
      return `${lead.firstName} ${lead.lastName}'s event is in ${Math.floor(analysis.daysUntilEvent)} days`;
    }
    
    if (analysis.needsReply) {
      return `${lead.firstName} ${lead.lastName} is waiting for your response`;
    }
    
    return `Follow up with ${lead.firstName} ${lead.lastName}`;
  }
  
  /**
   * Determine notification type based on analysis
   */
  getNotificationType(analysis: UrgencyAnalysis): string {
    if (analysis.daysSinceContact < 1 && analysis.needsReply) {
      return 'needs_reply';
    }
    
    if (analysis.daysSinceContact >= 2 && analysis.needsReply) {
      return 'overdue_response';
    }
    
    if (analysis.daysUntilEvent !== null && analysis.daysUntilEvent < 14) {
      return 'event_approaching';
    }
    
    if (analysis.daysSinceContact >= 7 && !analysis.needsReply) {
      return 'going_cold';
    }
    
    if (analysis.hasAutoReply && !analysis.hasPersonalReply) {
      return 'auto_reply_sent';
    }
    
    return 'needs_reply';
  }
}

export const urgencyService = new UrgencyService();
