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
    description: "Get detailed information about specific projects",
    parameters: {
      type: "object",
      properties: {
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
        sorted.sort((a, b) => (a.fullName || a.lastName || '').localeCompare(b.fullName || b.lastName || ''));
      } else if (args.sortBy === 'recent') {
        sorted.sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      }
      // Note: revenue sorting would require joining with invoices

      if (args.limit) {
        sorted = sorted.slice(0, args.limit);
      }

      return {
        count: sorted.length,
        clients: sorted.map(c => ({
          name: c.fullName || `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          phone: c.phone
        }))
      };
    }

    case "get_project_details": {
      const projects = await storage.getProjects(tenantId);
      let filtered = projects;

      if (args.status) {
        filtered = filtered.filter(p => p.status === args.status);
      }

      if (args.limit) {
        filtered = filtered.slice(0, args.limit);
      }

      return {
        count: filtered.length,
        projects: filtered.map(p => ({
          name: p.name,
          status: p.status,
          startDate: p.startDate,
          contactId: p.contactId
        }))
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
        .filter(e => {
          if (!e.startTime) return false;
          const eventStart = new Date(e.startTime);
          return eventStart >= startDate && eventStart <= endDate;
        })
        .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
        .map(e => ({
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
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
        filtered = filtered.filter(m => m.role?.toLowerCase().includes(args.role.toLowerCase()));
      }

      // Note: Availability filtering would require checking member_availability table
      // which isn't directly accessible through current storage interface

      return {
        count: filtered.length,
        members: filtered.map(m => ({
          firstName: m.firstName,
          lastName: m.lastName,
          role: m.role,
          email: m.email
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
        venues: filtered.map(v => ({
          name: v.name,
          address: v.address,
          capacity: v.capacity
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
        activities: filtered.map(a => ({
          type: a.type,
          description: a.description,
          createdAt: a.createdAt,
          contactId: a.contactId,
          projectId: a.projectId
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
  context: AssistantContext
): Promise<{ response: string; data?: any; tokensUsed?: number }> {
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a helpful CRM assistant for a business management system. You can answer questions about:
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

Be concise and friendly. Always format numbers nicely (add commas, currency symbols). When showing dates, use readable formats. If you use a function to get data, summarize it in a natural, conversational way. Focus on actionable insights.`
      },
      {
        role: "user",
        content: query
      }
    ];

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

      // Execute the function
      functionData = await executeFunction(functionName, functionArgs, context);

      // Add function result to conversation and get final response
      messages.push(message as any);
      messages.push({
        role: "function",
        name: functionName,
        content: JSON.stringify(functionData)
      } as any);

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
