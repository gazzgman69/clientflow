import OpenAI from 'openai';
import type { IStorage } from './storage';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const MODEL = "gpt-4o-mini";

// Define available functions for AI to call
const FUNCTIONS = [
  {
    name: "get_projects_count",
    description: "Get the total number of projects, optionally filtered by status or date range",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "completed", "cancelled", "pending"],
          description: "Filter by project status"
        },
        startDate: {
          type: "string",
          description: "Start date in ISO format (YYYY-MM-DD)"
        },
        endDate: {
          type: "string",
          description: "End date in ISO format (YYYY-MM-DD)"
        }
      }
    }
  },
  {
    name: "get_revenue_stats",
    description: "Get revenue statistics from invoices, optionally filtered by date range or status",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date in ISO format (YYYY-MM-DD)"
        },
        endDate: {
          type: "string",
          description: "End date in ISO format (YYYY-MM-DD)"
        },
        status: {
          type: "string",
          enum: ["paid", "unpaid", "overdue"],
          description: "Filter by payment status"
        }
      }
    }
  },
  {
    name: "get_upcoming_events",
    description: "Get upcoming calendar events/projects/gigs within a date range",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days ahead to look (default 30)"
        },
        startDate: {
          type: "string",
          description: "Start date in ISO format (YYYY-MM-DD)"
        },
        endDate: {
          type: "string",
          description: "End date in ISO format (YYYY-MM-DD)"
        }
      }
    }
  },
  {
    name: "get_unpaid_invoices",
    description: "Get list of unpaid or overdue invoices",
    parameters: {
      type: "object",
      properties: {
        onlyOverdue: {
          type: "boolean",
          description: "Only show overdue invoices (past due date)"
        },
        minAge: {
          type: "number",
          description: "Minimum age in days"
        }
      }
    }
  },
  {
    name: "get_clients_list",
    description: "Get list of clients, optionally sorted by various criteria",
    parameters: {
      type: "object",
      properties: {
        sortBy: {
          type: "string",
          enum: ["revenue", "recent", "name"],
          description: "How to sort clients"
        },
        limit: {
          type: "number",
          description: "Maximum number of clients to return"
        }
      }
    }
  },
  {
    name: "get_project_details",
    description: "Get detailed information about specific projects, optionally filtered by contact name",
    parameters: {
      type: "object",
      properties: {
        contactName: {
          type: "string",
          description: "Filter projects by contact name (e.g., 'John Smith')"
        },
        contactId: {
          type: "string",
          description: "Filter projects by contact ID"
        },
        status: {
          type: "string",
          enum: ["active", "completed", "cancelled", "pending"],
          description: "Filter by status"
        },
        limit: {
          type: "number",
          description: "Maximum number of projects to return"
        }
      }
    }
  },
  {
    name: "get_leads_summary",
    description: "Get summary of leads including count by status and conversion metrics",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
          description: "Filter by lead status"
        },
        startDate: {
          type: "string",
          description: "Start date for filtering (ISO format)"
        },
        endDate: {
          type: "string",
          description: "End date for filtering (ISO format)"
        }
      }
    }
  },
  {
    name: "get_quotes_summary",
    description: "Get quotes information including total value and status breakdown",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "sent", "viewed", "accepted", "declined", "expired"],
          description: "Filter by quote status"
        },
        startDate: {
          type: "string",
          description: "Start date for filtering (ISO format)"
        },
        endDate: {
          type: "string",
          description: "End date for filtering (ISO format)"
        }
      }
    }
  },
  {
    name: "get_contracts_summary",
    description: "Get contracts information including count by status",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "sent", "signed", "expired", "cancelled"],
          description: "Filter by contract status"
        }
      }
    }
  },
  {
    name: "get_tasks_summary",
    description: "Get tasks information including pending, completed, and overdue tasks",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "completed"],
          description: "Filter by task status"
        },
        dueDate: {
          type: "string",
          description: "Filter tasks by due date (ISO format)"
        },
        includeOverdue: {
          type: "boolean",
          description: "Include overdue tasks"
        }
      }
    }
  },
  {
    name: "get_calendar_events",
    description: "Get calendar events within a date range",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date (ISO format)"
        },
        endDate: {
          type: "string",
          description: "End date (ISO format)"
        },
        days: {
          type: "number",
          description: "Number of days ahead to look (default 30)"
        }
      }
    }
  },
  {
    name: "get_members_list",
    description: "Get list of team members/musicians",
    parameters: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description: "Filter by member role"
        },
        availability: {
          type: "string",
          description: "Check availability on specific date (ISO format)"
        }
      }
    }
  },
  {
    name: "get_venues_list",
    description: "Get list of venues",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of venues to return"
        }
      }
    }
  },
  {
    name: "get_activities_summary",
    description: "Get recent business activities and timeline events",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of activities to return (default 20)"
        },
        type: {
          type: "string",
          enum: ["email", "note", "task", "call", "meeting"],
          description: "Filter by activity type"
        },
        startDate: {
          type: "string",
          description: "Start date for filtering (ISO format)"
        }
      }
    }
  },
  {
    name: "get_emails_by_contact",
    description: "Get email history (incoming and outgoing) for a specific contact/client. You can search by contact name or ID.",
    parameters: {
      type: "object",
      properties: {
        contactName: {
          type: "string",
          description: "The contact/client name to search for (e.g., 'Gareth Gwyn', 'John Smith')"
        },
        contactId: {
          type: "string",
          description: "The contact/client ID if you already have it"
        },
        limit: {
          type: "number",
          description: "Maximum number of emails to return (default 20)"
        },
        direction: {
          type: "string",
          enum: ["inbound", "outbound", "all"],
          description: "Filter by email direction (default 'all')"
        }
      }
    }
  },
  {
    name: "get_recent_emails",
    description: "Get recent emails from the CRM, optionally filtered by contact, project, or date",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of emails to return (default 10)"
        },
        contactId: {
          type: "string",
          description: "Filter by specific contact ID"
        },
        projectId: {
          type: "string",
          description: "Filter by specific project ID"
        },
        startDate: {
          type: "string",
          description: "Start date for filtering (ISO format)"
        },
        direction: {
          type: "string",
          enum: ["inbound", "outbound", "all"],
          description: "Filter by email direction (default 'all')"
        }
      }
    }
  }
];

interface AssistantContext {
  storage: IStorage;
  tenantId: string;
  userId: string;
}

// Execute function calls made by the AI
async function executeFunction(
  functionName: string,
  args: any,
  context: AssistantContext
): Promise<any> {
  const { storage, tenantId, userId } = context;

  switch (functionName) {
    case "get_projects_count": {
      const projects = await storage.getProjects(tenantId);
      let filtered = projects;

      if (args.status) {
        filtered = filtered.filter(p => p.status === args.status);
      }

      if (args.startDate || args.endDate) {
        filtered = filtered.filter(p => {
          if (!p.startDate) return false;
          const startDate = new Date(p.startDate);
          if (args.startDate && startDate < new Date(args.startDate)) return false;
          if (args.endDate && startDate > new Date(args.endDate)) return false;
          return true;
        });
      }

      return {
        total: filtered.length,
        breakdown: {
          active: projects.filter(p => p.status === 'active').length,
          completed: projects.filter(p => p.status === 'completed').length,
          cancelled: projects.filter(p => p.status === 'cancelled').length,
          pending: projects.filter(p => p.status === 'pending').length
        }
      };
    }

    case "get_revenue_stats": {
      const invoices = await storage.getInvoices(tenantId);
      let filtered = invoices;

      if (args.startDate || args.endDate) {
        filtered = filtered.filter(inv => {
          if (!inv.createdAt) return false;
          const createdAt = new Date(inv.createdAt);
          if (args.startDate && createdAt < new Date(args.startDate)) return false;
          if (args.endDate && createdAt > new Date(args.endDate)) return false;
          return true;
        });
      }

      if (args.status === 'paid') {
        filtered = filtered.filter(inv => inv.status === 'paid');
      } else if (args.status === 'unpaid') {
        filtered = filtered.filter(inv => inv.status !== 'paid');
      } else if (args.status === 'overdue') {
        filtered = filtered.filter(inv => 
          inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date()
        );
      }

      const total = filtered.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      const paid = filtered.filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      const unpaid = filtered.filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

      return {
        total: total.toFixed(2),
        paid: paid.toFixed(2),
        unpaid: unpaid.toFixed(2),
        invoiceCount: filtered.length
      };
    }

    case "get_upcoming_events": {
      const projects = await storage.getProjects(tenantId);
      const now = new Date();
      
      let startDate = args.startDate ? new Date(args.startDate) : now;
      let endDate: Date;
      
      if (args.endDate) {
        endDate = new Date(args.endDate);
      } else {
        const days = args.days || 30;
        endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      }

      const upcoming = projects
        .filter(p => {
          if (!p.startDate) return false;
          const projectStartDate = new Date(p.startDate);
          return projectStartDate >= startDate && projectStartDate <= endDate;
        })
        .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
        .map(p => ({
          name: p.name,
          date: p.startDate,
          status: p.status
        }));

      return {
        count: upcoming.length,
        events: upcoming
      };
    }

    case "get_unpaid_invoices": {
      const invoices = await storage.getInvoices(tenantId);
      let unpaid = invoices.filter(inv => inv.status !== 'paid');

      if (args.onlyOverdue) {
        unpaid = unpaid.filter(inv => 
          inv.dueDate && new Date(inv.dueDate) < new Date()
        );
      }

      if (args.minAge) {
        const cutoffDate = new Date(Date.now() - args.minAge * 24 * 60 * 60 * 1000);
        unpaid = unpaid.filter(inv => 
          inv.createdAt && new Date(inv.createdAt) < cutoffDate
        );
      }

      const total = unpaid.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

      return {
        count: unpaid.length,
        totalAmount: total.toFixed(2),
        invoices: unpaid.map(inv => ({
          invoiceNumber: inv.invoiceNumber,
          contactId: inv.contactId,
          amount: Number(inv.total || 0).toFixed(2),
          dueDate: inv.dueDate,
          daysOverdue: inv.dueDate ? 
            Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))) 
            : 0
        }))
      };
    }

    case "get_clients_list": {
      const clients = await storage.getContacts(tenantId);
      let sorted = [...clients];

      if (args.sortBy === 'name') {
        sorted.sort((a: any, b: any) => {
          const aName = a.fullName || a.full_name || a.lastName || a.last_name || '';
          const bName = b.fullName || b.full_name || b.lastName || b.last_name || '';
          return aName.localeCompare(bName);
        });
      } else if (args.sortBy === 'recent') {
        sorted.sort((a: any, b: any) => 
          new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime()
        );
      }
      // Note: revenue sorting would require joining with invoices

      if (args.limit) {
        sorted = sorted.slice(0, args.limit);
      }

      return {
        count: sorted.length,
        clients: sorted.map((c: any) => ({
          name: c.fullName || c.full_name || `${c.firstName || c.first_name || ''} ${c.lastName || c.last_name || ''}`.trim(),
          email: c.email,
          phone: c.phone
        }))
      };
    }

    case "get_project_details": {
      const projects = await storage.getProjects(tenantId);
      const venues = await storage.getVenues(tenantId);
      let filtered = projects;

      // Filter by contact if provided
      if (args.contactName || args.contactId) {
        let targetContactId = args.contactId;

        // Look up contact by name if contactName provided
        if (args.contactName && !targetContactId) {
          const contacts = await storage.getContacts(tenantId);
          const contact = contacts.find((c: any) => {
            const fullName = c.fullName || c.full_name || `${c.firstName || c.first_name || ''} ${c.lastName || c.last_name || ''}`.trim();
            return fullName.toLowerCase().includes(args.contactName.toLowerCase());
          });
          if (contact) {
            targetContactId = contact.id;
          }
        }

        if (targetContactId) {
          filtered = filtered.filter((p: any) => (p.contactId || p.contact_id) === targetContactId);
        }
      }

      if (args.status) {
        filtered = filtered.filter(p => p.status === args.status);
      }

      if (args.limit) {
        filtered = filtered.slice(0, args.limit);
      }

      return {
        count: filtered.length,
        projects: filtered.map((p: any) => {
          const venueId = p.venueId || p.venue_id;
          const venue = venueId ? venues.find((v: any) => v.id === venueId) : null;
          
          return {
            name: p.name,
            status: p.status,
            startDate: p.startDate || p.start_date,
            endDate: p.endDate || p.end_date,
            estimatedValue: p.estimatedValue || p.estimated_value,
            actualValue: p.actualValue || p.actual_value,
            contactId: p.contactId || p.contact_id,
            venue: venue ? {
              name: venue.name,
              address: venue.address,
              city: venue.city,
              state: venue.state,
              zipCode: venue.zipCode || venue.zip_code
            } : null
          };
        })
      };
    }

    case "get_leads_summary": {
      const leads = await storage.getLeads(tenantId);
      let filtered = leads;

      if (args.status) {
        filtered = filtered.filter(l => l.status === args.status);
      }

      if (args.startDate || args.endDate) {
        filtered = filtered.filter(l => {
          if (!l.createdAt) return false;
          const createdAt = new Date(l.createdAt);
          if (args.startDate && createdAt < new Date(args.startDate)) return false;
          if (args.endDate && createdAt > new Date(args.endDate)) return false;
          return true;
        });
      }

      const statusBreakdown = {
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        proposal: leads.filter(l => l.status === 'proposal').length,
        negotiation: leads.filter(l => l.status === 'negotiation').length,
        won: leads.filter(l => l.status === 'won').length,
        lost: leads.filter(l => l.status === 'lost').length
      };

      return {
        total: filtered.length,
        statusBreakdown
      };
    }

    case "get_quotes_summary": {
      const quotes = await storage.getQuotes(tenantId);
      let filtered = quotes;

      if (args.status) {
        filtered = filtered.filter(q => q.status === args.status);
      }

      if (args.startDate || args.endDate) {
        filtered = filtered.filter(q => {
          if (!q.createdAt) return false;
          const createdAt = new Date(q.createdAt);
          if (args.startDate && createdAt < new Date(args.startDate)) return false;
          if (args.endDate && createdAt > new Date(args.endDate)) return false;
          return true;
        });
      }

      const totalValue = filtered.reduce((sum, q) => sum + Number(q.total || 0), 0);
      const statusBreakdown = {
        draft: quotes.filter(q => q.status === 'draft').length,
        sent: quotes.filter(q => q.status === 'sent').length,
        viewed: quotes.filter(q => q.status === 'viewed').length,
        accepted: quotes.filter(q => q.status === 'accepted').length,
        declined: quotes.filter(q => q.status === 'declined').length,
        expired: quotes.filter(q => q.status === 'expired').length
      };

      return {
        count: filtered.length,
        totalValue: totalValue.toFixed(2),
        statusBreakdown
      };
    }

    case "get_contracts_summary": {
      const contracts = await storage.getContracts(tenantId);
      let filtered = contracts;

      if (args.status) {
        filtered = filtered.filter(c => c.status === args.status);
      }

      const statusBreakdown = {
        draft: contracts.filter(c => c.status === 'draft').length,
        sent: contracts.filter(c => c.status === 'sent').length,
        signed: contracts.filter(c => c.status === 'signed').length,
        expired: contracts.filter(c => c.status === 'expired').length,
        cancelled: contracts.filter(c => c.status === 'cancelled').length
      };

      return {
        total: filtered.length,
        statusBreakdown
      };
    }

    case "get_tasks_summary": {
      const tasks = await storage.getTasks(tenantId);
      let filtered = tasks;
      const now = new Date();

      if (args.status) {
        filtered = filtered.filter(t => t.status === args.status);
      }

      if (args.dueDate) {
        filtered = filtered.filter(t => {
          if (!t.dueDate) return false;
          return new Date(t.dueDate).toDateString() === new Date(args.dueDate).toDateString();
        });
      }

      const overdue = tasks.filter(t => 
        t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now
      );

      return {
        total: filtered.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: overdue.length,
        overdueList: args.includeOverdue ? overdue.map(t => ({
          title: t.title,
          dueDate: t.dueDate,
          projectId: t.projectId
        })) : undefined
      };
    }

    case "get_calendar_events": {
      const events = await storage.getEvents(tenantId);
      const now = new Date();
      
      let startDate = args.startDate ? new Date(args.startDate) : now;
      let endDate: Date;
      
      if (args.endDate) {
        endDate = new Date(args.endDate);
      } else {
        const days = args.days || 30;
        endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      }

      const upcoming = events
        .filter((e: any) => {
          const startTime = e.startTime || e.start_time || e.eventDate || e.event_date;
          if (!startTime) return false;
          const eventStart = new Date(startTime);
          return eventStart >= startDate && eventStart <= endDate;
        })
        .sort((a: any, b: any) => {
          const aStart = new Date(a.startTime || a.start_time || a.eventDate || a.event_date || 0);
          const bStart = new Date(b.startTime || b.start_time || b.eventDate || b.event_date || 0);
          return aStart.getTime() - bStart.getTime();
        })
        .map((e: any) => ({
          title: e.title,
          startTime: e.startTime || e.start_time || e.eventDate || e.event_date,
          endTime: e.endTime || e.end_time,
          location: e.location
        }));

      return {
        count: upcoming.length,
        events: upcoming
      };
    }

    case "get_members_list": {
      const members = await storage.getMembers(tenantId);
      let filtered = members;

      if (args.role) {
        filtered = filtered.filter((m: any) => {
          const instruments = m.instruments || [];
          return instruments.some((i: string) => i.toLowerCase().includes(args.role.toLowerCase()));
        });
      }

      // Note: Availability filtering would require checking member_availability table
      // which isn't directly accessible through current storage interface

      return {
        count: filtered.length,
        members: filtered.map((m: any) => ({
          firstName: m.firstName || m.first_name,
          lastName: m.lastName || m.last_name,
          instruments: m.instruments || [],
          email: m.email,
          phone: m.phone,
          hourlyRate: m.hourlyRate || m.hourly_rate
        }))
      };
    }

    case "get_venues_list": {
      const venues = await storage.getVenues(tenantId);
      let filtered = venues;

      if (args.limit) {
        filtered = filtered.slice(0, args.limit);
      }

      return {
        count: filtered.length,
        venues: filtered.map((v: any) => ({
          name: v.name,
          address: v.address,
          city: v.city,
          state: v.state,
          zipCode: v.zipCode || v.zip_code,
          capacity: v.capacity,
          contactName: v.contactName || v.contact_name,
          contactPhone: v.contactPhone || v.contact_phone,
          contactEmail: v.contactEmail || v.contact_email
        }))
      };
    }

    case "get_activities_summary": {
      const activities = await storage.getActivities(tenantId);
      let filtered = activities;

      if (args.type) {
        filtered = filtered.filter(a => a.type === args.type);
      }

      if (args.startDate) {
        filtered = filtered.filter(a => {
          if (!a.createdAt) return false;
          return new Date(a.createdAt) >= new Date(args.startDate);
        });
      }

      // Sort by most recent
      filtered.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      if (args.limit) {
        filtered = filtered.slice(0, args.limit);
      } else {
        filtered = filtered.slice(0, 20); // Default to 20
      }

      return {
        count: filtered.length,
        activities: filtered.map((a: any) => ({
          type: a.type,
          description: a.description,
          createdAt: a.createdAt || a.created_at,
          contactId: a.contactId || a.contact_id,
          projectId: a.projectId || a.project_id
        }))
      };
    }

    case "get_emails_by_contact": {
      let contactId = args.contactId;

      // If contact name provided, look up the contact
      if (!contactId && args.contactName) {
        const contacts = await storage.getContacts(tenantId);
        const contact = contacts.find((c: any) => {
          // Handle both camelCase and snake_case (database returns snake_case)
          const fullName = c.fullName || c.full_name || `${c.firstName || c.first_name || ''} ${c.lastName || c.last_name || ''}`.trim();
          return fullName.toLowerCase().includes(args.contactName.toLowerCase()) ||
                 (c.email && c.email.toLowerCase().includes(args.contactName.toLowerCase()));
        });
        
        if (contact) {
          contactId = contact.id;
        } else {
          return {
            count: 0,
            emails: [],
            error: `No contact found matching "${args.contactName}"`
          };
        }
      }

      if (!contactId) {
        return {
          count: 0,
          emails: [],
          error: "Please provide either contactName or contactId"
        };
      }

      let emails = await storage.getEmailsByClient(contactId, tenantId);

      // Filter by direction if specified
      if (args.direction && args.direction !== 'all') {
        emails = emails.filter(e => e.direction === args.direction);
      }

      // Sort by most recent
      emails.sort((a: any, b: any) => 
        new Date(b.sentAt || b.sent_at || b.createdAt || b.created_at || 0).getTime() - 
        new Date(a.sentAt || a.sent_at || a.createdAt || a.created_at || 0).getTime()
      );

      // Apply limit
      const limit = args.limit || 20;
      emails = emails.slice(0, limit);

      return {
        count: emails.length,
        emails: emails.map((e: any) => ({
          subject: e.subject,
          from: e.fromEmail || e.from_email || e.from,
          to: e.toEmails || e.to_emails || e.to,
          direction: e.direction,
          sentAt: e.sentAt || e.sent_at,
          // Include more content for AI to analyze - up to 1000 chars or full text if shorter
          body: e.bodyText || e.body_text ? ((e.bodyText || e.body_text).length > 1000 ? (e.bodyText || e.body_text).substring(0, 1000) + '...' : (e.bodyText || e.body_text)) : (e.snippet || 'No content'),
          hasAttachments: e.hasAttachments || e.has_attachments
        }))
      };
    }

    case "get_recent_emails": {
      let emails: any[] = [];

      // Get emails based on filters
      if (args.contactId) {
        emails = await storage.getEmailsByClient(args.contactId, tenantId);
      } else if (args.projectId) {
        // Note: getEmailsByProject doesn't exist in IStorage yet
        // For now, get all emails and filter client-side
        const allEmails = await storage.getEmails(tenantId);
        emails = allEmails.filter((e: any) => (e.projectId || e.project_id) === args.projectId);
      } else {
        emails = await storage.getEmails(tenantId);
      }

      // Filter by direction if specified
      if (args.direction && args.direction !== 'all') {
        emails = emails.filter((e: any) => e.direction === args.direction);
      }

      // Filter by date if specified
      if (args.startDate) {
        emails = emails.filter((e: any) => {
          const emailDate = new Date(e.sentAt || e.sent_at || e.createdAt || e.created_at);
          return emailDate >= new Date(args.startDate);
        });
      }

      // Sort by most recent
      emails.sort((a: any, b: any) => 
        new Date(b.sentAt || b.sent_at || b.createdAt || b.created_at || 0).getTime() - 
        new Date(a.sentAt || a.sent_at || a.createdAt || a.created_at || 0).getTime()
      );

      // Apply limit
      const limit = args.limit || 10;
      emails = emails.slice(0, limit);

      return {
        count: emails.length,
        emails: emails.map((e: any) => ({
          subject: e.subject,
          from: e.fromEmail || e.from_email || e.from,
          to: e.toEmails || e.to_emails || e.to,
          direction: e.direction,
          sentAt: e.sentAt || e.sent_at,
          // Include more content for AI to analyze - up to 1000 chars or full text if shorter
          body: e.bodyText || e.body_text ? ((e.bodyText || e.body_text).length > 1000 ? (e.bodyText || e.body_text).substring(0, 1000) + '...' : (e.bodyText || e.body_text)) : (e.snippet || 'No content'),
          contactId: e.contactId || e.contact_id,
          projectId: e.projectId || e.project_id
        }))
      };
    }

    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

// Main AI assistant query handler
export async function processAssistantQuery(
  query: string,
  context: AssistantContext,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ response: string; data?: any; tokensUsed?: number }> {
  try {
    // Fetch AI training data
    const businessContext = await context.storage.getAiBusinessContext(context.tenantId);
    const knowledgeBase = await context.storage.getAiKnowledgeBase(context.tenantId, true); // Only active items
    const customInstructions = await context.storage.getAiCustomInstructions(context.tenantId, true); // Only active items

    // Build enhanced system message with training data
    let systemMessage = `You are a helpful CRM assistant for a business management system specializing in music and entertainment businesses.

## Domain Knowledge
You understand the music and entertainment industry, including:
- Common instruments: DJ equipment, saxophones, keyboards, drums, guitars, percussion (bongos, congas), trumpets, violins, etc.
- Event types: Weddings, corporate events, private parties, club nights, festivals, concerts
- Industry terminology: Gigs/bookings, setup/teardown, sound check, MC duties, playlist curation, live mixing, equipment rental, backup equipment
- Common services: DJ services, live music performances, ceremony music, cocktail hour entertainment, reception entertainment
- Typical requirements: Song requests, do-not-play lists, timeline coordination, venue restrictions, power requirements, space needs
- Business considerations: Deposits, cancellation policies, overtime rates, travel fees, equipment insurance, backup performers

When users ask about music-related topics, draw on this knowledge to provide informed, industry-appropriate responses.`;

    // Add business context if available
    if (businessContext) {
      systemMessage += `\n\n## Business Information\n`;
      if (businessContext.businessName) systemMessage += `- Business Name: ${businessContext.businessName}\n`;
      if (businessContext.businessType) systemMessage += `- Business Type: ${businessContext.businessType}\n`;
      if (businessContext.industry) systemMessage += `- Industry: ${businessContext.industry}\n`;
      if (businessContext.targetAudience) systemMessage += `- Target Audience: ${businessContext.targetAudience}\n`;
      if (businessContext.services) systemMessage += `- Services Offered: ${businessContext.services}\n`;
      if (businessContext.pricingInfo) systemMessage += `- Pricing: ${businessContext.pricingInfo}\n`;
      if (businessContext.businessHours) systemMessage += `- Business Hours: ${businessContext.businessHours}\n`;
      if (businessContext.brandVoice) systemMessage += `- Brand Voice: ${businessContext.brandVoice}\n`;
      if (businessContext.terminology) systemMessage += `- Industry Terms: ${businessContext.terminology}\n`;
      if (businessContext.standardResponses) systemMessage += `- Standard Responses: ${businessContext.standardResponses}\n`;
      if (businessContext.policies) systemMessage += `- Business Policies: ${businessContext.policies}\n`;
    }

    // Add knowledge base if available
    if (knowledgeBase.length > 0) {
      systemMessage += `\n\n## Knowledge Base\n`;
      knowledgeBase.forEach((item: any) => {
        systemMessage += `\n### ${item.title}${item.category ? ` (${item.category})` : ''}\n${item.content}\n`;
      });
    }

    // Add custom instructions if available
    if (customInstructions.length > 0) {
      systemMessage += `\n\n## Custom Instructions\n`;
      customInstructions.forEach((instruction: any, index: number) => {
        systemMessage += `${index + 1}. ${instruction.instruction}${instruction.category ? ` [${instruction.category}]` : ''}\n`;
      });
    }

    // Add standard capabilities
    systemMessage += `\n\n## CRM Capabilities\nYou can answer questions about:
- Projects & Gigs (count, details, upcoming events)
- Leads (status, conversion metrics)
- Clients/Contacts (lists, information)
- Quotes (value, status breakdown)
- Contracts (status summary)
- Invoices & Revenue (stats, unpaid, overdue)
- Tasks (pending, completed, overdue)
- Calendar Events (upcoming events)
- Team Members (musicians, roles)
- Venues (locations, capacity)
- Activities (recent business timeline, emails, notes, calls)
- Emails (incoming/outgoing correspondence with contacts)

You have access to email history for all contacts within the tenant's CRM. You can retrieve emails by contact, project, or date range, and filter by direction (inbound/outbound).

Be concise and friendly. Always format numbers nicely (add commas, currency symbols). When showing dates, use readable formats. If you use a function to get data, summarize it in a natural, conversational way. Focus on actionable insights.`;

    // Log system message length for debugging
    console.log(`🤖 AI Assistant Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
    console.log(`📝 System message length: ${systemMessage.length} characters`);
    console.log(`💬 Conversation history: ${conversationHistory?.length || 0} messages`);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemMessage
      }
    ];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Add current user query
    messages.push({
      role: "user",
      content: query
    });

    // First completion - AI decides which function to call
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      functions: FUNCTIONS as any,
      function_call: "auto"
    });

    const message = response.choices[0].message;
    let finalResponse = message.content || "I'm not sure how to answer that.";
    let functionData: any = null;

    // If AI wants to call a function
    if (message.function_call) {
      const functionName = message.function_call.name;
      const functionArgs = JSON.parse(message.function_call.arguments || '{}');

      console.log(`🔧 Calling function: ${functionName} with args:`, functionArgs);

      // Execute the function
      functionData = await executeFunction(functionName, functionArgs, context);

      console.log(`📊 Function ${functionName} returned ${JSON.stringify(functionData).length} characters of data`);

      // Add function result to conversation and get final response
      messages.push(message as any);
      const functionResultContent = JSON.stringify(functionData);
      messages.push({
        role: "function",
        name: functionName,
        content: functionResultContent
      } as any);

      console.log(`🤖 Sending ${messages.length} messages to AI (${messages.reduce((acc, m: any) => acc + (m.content?.length || 0), 0)} total chars)`);

      const finalCompletion = await openai.chat.completions.create({
        model: MODEL,
        messages
      });

      finalResponse = finalCompletion.choices[0].message.content || finalResponse;
    }

    return {
      response: finalResponse,
      data: functionData,
      tokensUsed: response.usage?.total_tokens
    };

  } catch (error: any) {
    console.error('AI Assistant error:', error);
    throw new Error(error.message || 'Failed to process query');
  }
}
