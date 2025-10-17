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
        content: `You are a helpful CRM assistant. You can answer questions about projects, clients, invoices, revenue, and upcoming events. Be concise and friendly. Always format numbers nicely (add commas, currency symbols). When showing dates, use readable formats. If you use a function to get data, summarize it in a natural, conversational way.`
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
