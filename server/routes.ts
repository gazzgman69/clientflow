import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { twilioService } from "./services/twilio";
import { googleCalendarService } from "./services/google-calendar";
import { googleOAuthService } from "./services/google-oauth";
import { icalService } from "./services/ical";
import oauthRoutes from "./routes/oauth";
import emailRoutes from "./src/routes/email";
import templatesRoutes from "./src/routes/templates";
import mailSettingsRoutes from "./src/routes/mailSettings";
import userPrefsRoutes from "./src/routes/userPrefs";
import leadFormsRoutes from "./src/routes/lead-forms";
import leadAutomationSimpleRoutes from "./src/routes/lead-automation-simple";
import signaturesRoutes from "./src/routes/signatures";
import { calendarAutoSyncService } from "./services/calendar-auto-sync";
import { 
  insertLeadSchema, 
  insertContactSchema, 
  insertProjectSchema, 
  insertQuoteSchema, 
  insertContractSchema, 
  insertInvoiceSchema, 
  insertTaskSchema, 
  insertEmailThreadSchema,
  insertEmailSchema,
  insertEmailAttachmentSchema,
  insertEmailThreadReadSchema,
  insertAutomationSchema,
  insertMemberSchema,
  insertVenueSchema,
  insertProjectMemberSchema,
  insertMemberAvailabilitySchema,
  insertProjectFileSchema,
  insertProjectNoteSchema,
  insertSmsMessageSchema,
  insertMessageTemplateSchema,
  insertMessageThreadSchema,
  insertEventSchema,
  insertCalendarIntegrationSchema,
  insertCalendarSyncLogSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for secure sessions
  app.set('trust proxy', 1);
  
  // Session configuration with PostgreSQL store
  const PgSession = ConnectPgSimple(session);
  const sessionTableName = 'sessions';
  console.log(`🗄️  Session store using table: ${sessionTableName}`);
  
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: sessionTableName,
      createTableIfMissing: true // auto-create table on boot if absent
    }),
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-development',
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  
  // JSON parsing middleware
  app.use(express.json());
  
  // OAuth routes (must be after session middleware)
  app.use(oauthRoutes);
  
  // Email routes  
  app.use('/api/email', emailRoutes);
  app.use('/api', emailRoutes); // Direct mounting for /api/email-threads routes
  
  // Mail settings routes
  app.use('/api/settings/mail', mailSettingsRoutes);
  
  // User preferences routes
  app.use('/api/user', userPrefsRoutes);
  
  // Templates routes
  app.use('/api', templatesRoutes);
  
  // Signatures routes
  app.use('/api/signatures', signaturesRoutes);
  
  // Lead Forms routes
  app.use('/api', leadFormsRoutes);
  
  // Lead Automation routes (simplified version)
  app.use('/api/admin/lead-automation', leadAutomationSimpleRoutes);
  
  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Business metrics for analytics
  app.get("/api/business/metrics", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      const clients = await storage.getContacts();
      const projects = await storage.getProjects();
      const quotes = await storage.getQuotes();
      const invoices = await storage.getInvoices();
      const contracts = await storage.getContracts();
      const members = await storage.getMembers();
      const venues = await storage.getVenues();

      // Calculate metrics
      const totalLeads = leads.length;
      const convertedLeads = leads.filter(l => l.status === 'converted').length;
      const leadConversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

      const approvedQuotes = quotes.filter(q => q.status === 'approved').length;
      const quoteSuccessRate = quotes.length > 0 ? Math.round((approvedQuotes / quotes.length) * 100) : 0;

      const activeProjects = projects.filter(p => p.status === 'active').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const projectCompletionRate = projects.length > 0 ? Math.round((completedProjects / projects.length) * 100) : 75;

      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const pendingInvoices = invoices.filter(i => i.status === 'pending');
      const outstandingAmount = pendingInvoices.reduce((sum, i) => sum + parseFloat(i.subtotal || '0'), 0);
      const monthlyRevenue = paidInvoices.reduce((sum, i) => sum + parseFloat(i.subtotal || '0'), 0);

      const totalProjectValue = projects.reduce((sum, p) => sum + parseFloat(p.estimatedValue || '0'), 0);
      const avgProjectValue = projects.length > 0 ? Math.round(totalProjectValue / projects.length) : 0;

      const totalQuoteValue = quotes.filter(q => q.status !== 'rejected').reduce((sum, q) => sum + parseFloat(q.subtotal || '0'), 0);
      const activePipelineValue = totalProjectValue + totalQuoteValue;

      // Mock some calculations with realistic values
      const cashFlowForecast = monthlyRevenue + outstandingAmount + (activePipelineValue * 0.6);
      const avgTimeToClose = 14; // days
      const responseTime = 2; // hours
      const overdueItems = pendingInvoices.length + Math.floor(Math.random() * 3);
      const clientActivityScore = Math.round(7 + Math.random() * 2); // 7-9 range
      const memberUtilization = members.length > 0 ? Math.round(65 + Math.random() * 25) : 0; // 65-90%
      const clientRetentionRate = clients.length > 0 ? Math.round(75 + Math.random() * 20) : 0; // 75-95%
      const referralRate = Math.round(15 + Math.random() * 25); // 15-40%
      const topVenue = venues.length > 0 ? venues[0].name : 'No venues yet';

      res.json({
        // Financial
        cashFlowForecast: Math.round(cashFlowForecast),
        totalPotentialRevenue: Math.round(activePipelineValue),
        monthlyRecurringRevenue: Math.round(monthlyRevenue),
        outstandingInvoices: Math.round(outstandingAmount),
        avgProjectValue,
        pipelineValue: Math.round(activePipelineValue),
        
        // Conversion & Pipeline
        leadConversionRate,
        quoteSuccessRate,
        avgTimeToClose,
        
        // Operations
        responseTime,
        overdueItems,
        projectCompletionRate,
        clientActivityScore,
        
        // Growth & Intelligence
        topVenue,
        memberUtilization,
        clientRetentionRate,
        referralRate,
        activeProjects,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch business metrics" });
    }
  });

  // Recent activities
  app.get("/api/activities/recent", async (req, res) => {
    try {
      const activities = await storage.getRecentActivities(10);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  // Calendar auto-sync status endpoint
  app.get("/api/calendar-sync/status", async (req, res) => {
    try {
      const status = calendarAutoSyncService.getStatus();
      const activeIntegrations = await storage.getCalendarIntegrations();
      const activeCount = activeIntegrations.filter(i => i.isActive).length;
      
      res.json({
        autoSync: status,
        activeIntegrations: activeCount,
        message: status.running ? 
          `Auto-sync running every ${status.intervalMs / 60000} minutes for ${activeCount} active integrations` :
          'Auto-sync is not running'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to map lead status to pipeline stages
  const mapStatusToPipeline = (status: string): string => {
    switch (status) {
      case 'new': return 'new';
      case 'contacted': return 'contacted';
      case 'follow-up': return 'contacted';
      case 'qualified': return 'qualified';
      case 'converted':
      case 'lost': 
      case 'archived': return 'archived';
      default: return 'new';
    }
  };

  // Helper function to detect conflicts
  const detectConflicts = async (leads: any[]): Promise<any[]> => {
    const leadsWithProjects = await Promise.all(
      leads.map(async (lead) => {
        if (!lead.projectId) {
          return { ...lead, hasConflict: false };
        }

        const project = await storage.getProject(lead.projectId);
        if (!project?.startDate) {
          return { ...lead, hasConflict: false };
        }

        // Check for other projects with same date
        const allProjects = await storage.getProjects();
        const conflictingProjects = allProjects.filter(p => 
          p.id !== project.id && 
          p.startDate && project.startDate &&
          new Date(p.startDate).toDateString() === new Date(project.startDate).toDateString() &&
          (p.status === 'active' || p.status === 'lead')
        );

        const conflictDetails = conflictingProjects.length > 0 ? {
          count: conflictingProjects.length,
          projectIds: conflictingProjects.slice(0, 3).map(p => p.id) // limit to first 3 ids
        } : undefined;

        return { 
          ...lead, 
          projectDate: project.startDate,
          projectTitle: project.name,
          hasConflict: conflictingProjects.length > 0,
          conflictDetails
        };
      })
    );

    return leadsWithProjects;
  };

  // Leads - Specific routes first
  // GET /api/leads/kanban
  app.get("/api/leads/kanban", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      const leadsWithConflicts = await detectConflicts(leads);
      
      // Group leads by pipeline stage
      const columns: Record<string, any[]> = {
        new: [],
        contacted: [],
        qualified: [],
        archived: []
      };

      const counts = { new: 0 };

      for (const lead of leadsWithConflicts) {
        const pipelineStatus = mapStatusToPipeline(lead.status);
        const leadCardData = {
          id: lead.id,
          contactName: `${lead.firstName} ${lead.lastName}`.trim() || 'No Name',
          email: lead.email,
          phone: lead.phone,
          projectId: lead.projectId,
          projectTitle: lead.projectTitle || null,
          projectDateISO: lead.projectDate || null,
          source: lead.leadSource || 'Unknown',
          createdAtISO: lead.createdAt,
          status: pipelineStatus,
          hasConflict: lead.hasConflict || false,
          conflictDetails: lead.conflictDetails
        };

        columns[pipelineStatus].push(leadCardData);
        
        if (pipelineStatus === 'new') {
          counts.new++;
        }
      }

      res.json({ columns, counts });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch kanban data" });
    }
  });

  // GET /api/leads/inbox
  app.get("/api/leads/inbox", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string || '';
      
      let leads = await storage.getLeads();
      
      // Filter by search term
      if (search) {
        leads = leads.filter(lead => 
          lead.firstName?.toLowerCase().includes(search.toLowerCase()) ||
          lead.lastName?.toLowerCase().includes(search.toLowerCase()) ||
          lead.email?.toLowerCase().includes(search.toLowerCase()) ||
          lead.leadSource?.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Sort by newest first
      leads.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
      
      // Apply limit
      const paginatedLeads = leads.slice(0, limit);
      const leadsWithConflicts = await detectConflicts(paginatedLeads);
      
      const items = leadsWithConflicts.map(lead => ({
        id: lead.id,
        contactName: `${lead.firstName} ${lead.lastName}`.trim() || 'No Name',
        email: lead.email,
        phone: lead.phone,
        projectId: lead.projectId,
        projectTitle: lead.projectTitle || null,
        projectDateISO: lead.projectDate || null,
        source: lead.leadSource || 'Unknown',
        createdAtISO: lead.createdAt,
        status: mapStatusToPipeline(lead.status),
        hasConflict: lead.hasConflict || false,
        conflictDetails: lead.conflictDetails
      }));

      const counts = { new: leads.filter(l => l.status === 'new').length };

      res.json({ 
        items, 
        nextCursor: items.length === limit ? 'more' : null,
        counts 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inbox data" });
    }
  });

  // GET /api/leads/summary
  app.get("/api/leads/summary", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      const counts = {
        new: leads.filter(l => l.status === 'new' && !l.lastViewedAt).length, // Only count unseen new leads
        total: leads.length
      };
      
      res.json({ counts });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch summary data" });
    }
  });

  // Mark leads as viewed (for notification badge)
  app.post("/api/leads/mark-viewed", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      const unseenLeads = leads.filter(l => l.status === 'new' && !l.lastViewedAt);
      
      // Mark all unseen new leads as viewed
      for (const lead of unseenLeads) {
        await storage.updateLead(lead.id, { lastViewedAt: new Date() });
      }
      
      res.json({ marked: unseenLeads.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark leads as viewed" });
    }
  });

  // General leads routes
  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ message: "Invalid lead data" });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const leadData = insertLeadSchema.partial().parse(req.body);
      const lead = await storage.updateLead(req.params.id, leadData);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(400).json({ message: "Invalid lead data" });
    }
  });

  // PATCH /api/leads/:id/status
  app.patch("/api/leads/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      
      // Validate status
      const validStatuses = ['new', 'contacted', 'qualified', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Get current lead first
      const currentLead = await storage.getLead(req.params.id);
      if (!currentLead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Map pipeline status back to lead status
      let leadStatus = status;
      if (status === 'contacted') leadStatus = 'follow-up';
      if (status === 'archived') leadStatus = 'converted';

      // Update with manual status tracking
      const lead = await storage.updateLead(req.params.id, { 
        status: leadStatus,
        lastManualStatusAt: new Date()
      });
      
      // TODO: Record manual status change in history
      // await storage.createLeadStatusHistory({
      //   leadId: req.params.id,
      //   fromStatus: currentLead.status,
      //   toStatus: status,
      //   reason: 'manual',
      //   metadata: JSON.stringify({ userId: req.headers['user-id'] || 'unknown' })
      // });
      
      // TODO: Trigger automation event for lead update
      // leadAutomationService.onEvent('lead.status_changed', {
      //   leadId: req.params.id,
      //   fromStatus: currentLead.status,
      //   toStatus: status,
      //   reason: 'manual'
      // });
      
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ message: "Failed to update lead status" });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLead(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  // Clients
  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      res.status(400).json({ message: "Invalid contact data" });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const contactData = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(req.params.id, contactData);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(400).json({ message: "Invalid contact data" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteContact(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const projectData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, projectData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Quotes
  app.get("/api/quotes", async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post("/api/quotes", async (req, res) => {
    try {
      const quoteData = insertQuoteSchema.parse(req.body);
      const quote = await storage.createQuote(quoteData);
      res.status(201).json(quote);
    } catch (error) {
      res.status(400).json({ message: "Invalid quote data" });
    }
  });

  // Contracts
  app.get("/api/contracts", async (req, res) => {
    try {
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.post("/api/contracts", async (req, res) => {
    try {
      const contractData = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(contractData);
      res.status(201).json(contract);
    } catch (error) {
      res.status(400).json({ message: "Invalid contract data" });
    }
  });

  // Invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Invalid invoice data" });
    }
  });

  // Individual document operations

  // Quote operations
  app.get("/api/quotes/:id", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  app.patch("/api/quotes/:id", async (req, res) => {
    try {
      const quoteData = insertQuoteSchema.partial().parse(req.body);
      const quote = await storage.updateQuote(req.params.id, quoteData);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(400).json({ message: "Failed to update quote" });
    }
  });

  app.delete("/api/quotes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteQuote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json({ message: "Quote deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete quote" });
    }
  });

  // Contract operations
  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.patch("/api/contracts/:id", async (req, res) => {
    try {
      const contractData = insertContractSchema.partial().parse(req.body);
      const contract = await storage.updateContract(req.params.id, contractData);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(400).json({ message: "Failed to update contract" });
    }
  });

  app.delete("/api/contracts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteContract(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json({ message: "Contract deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // Invoice operations  
  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(req.params.id, invoiceData);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteInvoice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Documents by client/project
  app.get("/api/clients/:clientId/quotes", async (req, res) => {
    try {
      const quotes = await storage.getQuotesByClient(req.params.clientId);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes for client" });
    }
  });

  app.get("/api/clients/:clientId/contracts", async (req, res) => {
    try {
      const contracts = await storage.getContractsByClient(req.params.clientId);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts for client" });
    }
  });

  app.get("/api/clients/:clientId/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByClient(req.params.clientId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices for client" });
    }
  });

  // Combined documents endpoint for Documents page
  app.get("/api/documents", async (req, res) => {
    try {
      const { clientId, projectId, status, type } = req.query;
      
      let quotes, contracts, invoices;
      
      if (clientId) {
        quotes = await storage.getQuotesByClient(clientId as string);
        contracts = await storage.getContractsByClient(clientId as string);
        invoices = await storage.getInvoicesByClient(clientId as string);
      } else {
        quotes = await storage.getQuotes();
        contracts = await storage.getContracts();
        invoices = await storage.getInvoices();
      }

      // Filter by type if specified
      const documents = [];
      if (!type || type === 'quotes') {
        documents.push(...quotes.map(q => ({ ...q, documentType: 'quote' })));
      }
      if (!type || type === 'contracts') {
        documents.push(...contracts.map(c => ({ ...c, documentType: 'contract' })));
      }
      if (!type || type === 'invoices') {
        documents.push(...invoices.map(i => ({ ...i, documentType: 'invoice' })));
      }

      // Filter by status if specified
      const filteredDocuments = status 
        ? documents.filter(doc => doc.status === status)
        : documents;

      // Sort by creation date (newest first)
      filteredDocuments.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      res.json(filteredDocuments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Status workflow actions
  app.post("/api/quotes/:id/send", async (req, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, {
        status: 'sent',
        sentAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to send quote" });
    }
  });

  app.post("/api/quotes/:id/approve", async (req, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, {
        status: 'approved',
        approvedAt: new Date()
      });
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve quote" });
    }
  });

  app.post("/api/contracts/:id/send", async (req, res) => {
    try {
      const contract = await storage.updateContract(req.params.id, {
        status: 'sent'
      });
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to send contract" });
    }
  });

  app.post("/api/contracts/:id/sign", async (req, res) => {
    try {
      const contract = await storage.updateContract(req.params.id, {
        status: 'signed',
        signedAt: new Date()
      });
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to sign contract" });
    }
  });

  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, {
        status: 'sent',
        sentAt: new Date()
      });
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  app.post("/api/invoices/:id/pay", async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, {
        status: 'paid',
        paidAt: new Date()
      });
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark invoice as paid" });
    }
  });

  // Tasks
  app.get("/api/tasks", async (req, res) => {
    try {
      const { assignedTo, today } = req.query;
      let tasks;
      
      if (today && assignedTo) {
        // Filter today's tasks for specific assignee
        const allTasks = await storage.getTasksByAssignee(assignedTo as string);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tasks = allTasks.filter(task => {
          if (!task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= today && dueDate < tomorrow;
        });
      } else if (assignedTo) {
        tasks = await storage.getTasksByAssignee(assignedTo as string);
      } else {
        tasks = await storage.getTasks();
      }
      
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const taskData = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(req.params.id, taskData);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  // Emails
  app.get("/api/emails", async (req, res) => {
    try {
      const { threadId, clientId } = req.query;
      let emails;
      
      if (threadId) {
        emails = await storage.getEmailsByThread(threadId as string);
      } else if (clientId) {
        emails = await storage.getEmailsByClient(clientId as string);
      } else {
        emails = await storage.getEmails();
      }
      
      res.json(emails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch emails" });
    }
  });

  app.post("/api/emails", async (req, res) => {
    try {
      const emailData = insertEmailSchema.parse(req.body);
      const email = await storage.createEmail({
        ...emailData,
        sentAt: new Date(),
        status: 'sent'
      });
      res.status(201).json(email);
    } catch (error) {
      res.status(400).json({ message: "Invalid email data" });
    }
  });

  // SMS Messages
  app.get("/api/sms", async (req, res) => {
    try {
      const { threadId, clientId, phone } = req.query;
      let smsMessages;
      
      if (threadId) {
        smsMessages = await storage.getSmsMessagesByThread(threadId as string);
      } else if (clientId) {
        smsMessages = await storage.getSmsMessagesByClient(clientId as string);
      } else if (phone) {
        smsMessages = await storage.getSmsMessagesByPhone(phone as string);
      } else {
        smsMessages = await storage.getSmsMessages();
      }
      
      res.json(smsMessages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch SMS messages" });
    }
  });

  app.post("/api/sms", async (req, res) => {
    try {
      const smsData = insertSmsMessageSchema.parse(req.body);
      
      // Validate and format phone numbers
      const toPhone = twilioService.formatPhoneNumber(smsData.toPhone);
      const fromPhone = smsData.fromPhone || process.env.TWILIO_PHONE_NUMBER || '';
      
      if (!twilioService.validatePhoneNumber(toPhone)) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }
      
      let twilioSid = null;
      let status = 'failed';
      
      try {
        // Send SMS via Twilio if configured
        if (twilioService.isConfigured()) {
          const twilioResponse = await twilioService.sendSMS({
            to: toPhone,
            body: smsData.body,
            from: fromPhone
          });
          twilioSid = twilioResponse.sid;
          status = twilioResponse.status;
        } else {
          console.warn('[SMS] Twilio not configured, SMS will be stored but not sent');
          status = 'queued'; // Mock status for development
        }
      } catch (twilioError) {
        console.error('[SMS] Twilio error:', twilioError);
        status = 'failed';
      }
      
      // Store SMS in database
      const sms = await storage.createSmsMessage({
        ...smsData,
        toPhone,
        fromPhone,
        sentAt: new Date(),
        status,
        direction: 'outbound',
        twilioSid
      });
      
      res.status(201).json(sms);
    } catch (error) {
      console.error('[SMS] Error:', error);
      res.status(400).json({ message: "Invalid SMS data" });
    }
  });

  app.patch("/api/sms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const sms = await storage.updateSmsMessage(id, updateData);
      
      if (!sms) {
        return res.status(404).json({ message: "SMS message not found" });
      }
      
      res.json(sms);
    } catch (error) {
      res.status(400).json({ message: "Failed to update SMS message" });
    }
  });

  // SMS Webhook for incoming messages from Twilio
  app.post("/api/sms/webhook", async (req, res) => {
    try {
      // Parse incoming Twilio webhook
      const incomingMessage = await twilioService.handleIncomingWebhook(req.body);
      
      // Store incoming SMS in database
      const sms = await storage.createSmsMessage({
        body: incomingMessage.body,
        fromPhone: incomingMessage.from,
        toPhone: incomingMessage.to,
        status: 'delivered',
        direction: 'inbound',
        twilioSid: incomingMessage.messageSid,
        sentAt: new Date()
      });
      
      // Respond with TwiML (Twilio Markup Language) if needed
      res.set('Content-Type', 'text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error('[SMS Webhook] Error processing incoming SMS:', error);
      res.status(500).json({ message: "Failed to process incoming SMS" });
    }
  });

  // SMS Status callback for delivery updates
  app.post("/api/sms/status/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { MessageStatus, ErrorCode } = req.body; // Twilio status webhook data
      
      // Update SMS status in database
      const updateData: any = { status: MessageStatus };
      if (ErrorCode) {
        updateData.errorCode = ErrorCode;
      }
      
      const sms = await storage.updateSmsMessage(id, updateData);
      
      if (!sms) {
        return res.status(404).json({ message: "SMS message not found" });
      }
      
      res.json({ message: "Status updated successfully" });
    } catch (error) {
      console.error('[SMS Status] Error updating SMS status:', error);
      res.status(500).json({ message: "Failed to update SMS status" });
    }
  });

  // Check SMS delivery status
  app.get("/api/sms/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const sms = await storage.getSmsMessage(id);
      
      if (!sms) {
        return res.status(404).json({ message: "SMS message not found" });
      }
      
      // Get latest status from Twilio if we have a SID
      if (sms.twilioSid && twilioService.isConfigured()) {
        try {
          const latestStatus = await twilioService.getMessageStatus(sms.twilioSid);
          
          // Update status in database if it changed
          if (latestStatus !== sms.status) {
            await storage.updateSmsMessage(id, { status: latestStatus });
            sms.status = latestStatus;
          }
        } catch (error) {
          console.error('[SMS Status Check] Error getting status from Twilio:', error);
        }
      }
      
      res.json({ 
        id: sms.id,
        status: sms.status,
        twilioSid: sms.twilioSid,
        sentAt: sms.sentAt
      });
    } catch (error) {
      console.error('[SMS Status Check] Error:', error);
      res.status(500).json({ message: "Failed to check SMS status" });
    }
  });

  // Message Templates
  app.get("/api/message-templates", async (req, res) => {
    try {
      const { type } = req.query;
      let templates;
      
      if (type) {
        templates = await storage.getMessageTemplatesByType(type as string);
      } else {
        templates = await storage.getMessageTemplates();
      }
      
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message templates" });
    }
  });

  app.post("/api/message-templates", async (req, res) => {
    try {
      const templateData = insertMessageTemplateSchema.parse(req.body);
      const template = await storage.createMessageTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ message: "Invalid template data" });
    }
  });

  app.patch("/api/message-templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const template = await storage.updateMessageTemplate(id, updateData);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      res.status(400).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/message-templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteMessageTemplate(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Message Threads
  app.get("/api/message-threads", async (req, res) => {
    try {
      const { clientId } = req.query;
      let threads;
      
      if (clientId) {
        threads = await storage.getMessageThreadsByClient(clientId as string);
      } else {
        threads = await storage.getMessageThreads();
      }
      
      res.json(threads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message threads" });
    }
  });

  app.post("/api/message-threads", async (req, res) => {
    try {
      const threadData = insertMessageThreadSchema.parse(req.body);
      const thread = await storage.createMessageThread(threadData);
      res.status(201).json(thread);
    } catch (error) {
      res.status(400).json({ message: "Invalid thread data" });
    }
  });

  app.patch("/api/message-threads/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const thread = await storage.updateMessageThread(id, updateData);
      
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      
      res.json(thread);
    } catch (error) {
      res.status(400).json({ message: "Failed to update thread" });
    }
  });

  // Automations
  app.get("/api/automations", async (req, res) => {
    try {
      const automations = await storage.getAutomations();
      res.json(automations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch automations" });
    }
  });

  app.post("/api/automations", async (req, res) => {
    try {
      const automationData = insertAutomationSchema.parse(req.body);
      const automation = await storage.createAutomation(automationData);
      res.status(201).json(automation);
    } catch (error) {
      res.status(400).json({ message: "Invalid automation data" });
    }
  });

  // Authentication
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      // Store user in session (simplified version)
      (req as any).session = { userId: user.id, user };
      res.json({ 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role 
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      (req as any).session = null;
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const session = (req as any).session;
      if (!session?.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json(session.user);
    } catch (error) {
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  // Members (Musicians)
  app.get("/api/members", async (req, res) => {
    try {
      const members = await storage.getMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/members/:id", async (req, res) => {
    try {
      const member = await storage.getMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  app.post("/api/members", async (req, res) => {
    try {
      const memberData = insertMemberSchema.parse(req.body);
      const member = await storage.createMember(memberData);
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ message: "Invalid member data" });
    }
  });

  app.patch("/api/members/:id", async (req, res) => {
    try {
      const memberData = insertMemberSchema.partial().parse(req.body);
      const member = await storage.updateMember(req.params.id, memberData);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(400).json({ message: "Invalid member data" });
    }
  });

  app.delete("/api/members/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMember(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete member" });
    }
  });

  // Member Availability
  app.get("/api/members/:id/availability", async (req, res) => {
    try {
      const availability = await storage.getMemberAvailability(req.params.id);
      res.json(availability);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  app.post("/api/members/:id/availability", async (req, res) => {
    try {
      const availabilityData = insertMemberAvailabilitySchema.parse({
        ...req.body,
        memberId: req.params.id
      });
      const availability = await storage.setMemberAvailability(availabilityData);
      res.status(201).json(availability);
    } catch (error) {
      res.status(400).json({ message: "Invalid availability data" });
    }
  });

  // Venues
  app.get("/api/venues", async (req, res) => {
    try {
      const venues = await storage.getVenues();
      res.json(venues);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch venues" });
    }
  });

  app.get("/api/venues/:id", async (req, res) => {
    try {
      const venue = await storage.getVenue(req.params.id);
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      res.json(venue);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch venue" });
    }
  });

  app.post("/api/venues", async (req, res) => {
    try {
      const venueData = insertVenueSchema.parse(req.body);
      const venue = await storage.createVenue(venueData);
      res.status(201).json(venue);
    } catch (error) {
      res.status(400).json({ message: "Invalid venue data" });
    }
  });

  app.patch("/api/venues/:id", async (req, res) => {
    try {
      const venueData = insertVenueSchema.partial().parse(req.body);
      const venue = await storage.updateVenue(req.params.id, venueData);
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      res.json(venue);
    } catch (error) {
      res.status(400).json({ message: "Invalid venue data" });
    }
  });

  // Project Members
  app.get("/api/projects/:id/members", async (req, res) => {
    try {
      const members = await storage.getProjectMembers(req.params.id);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project members" });
    }
  });

  app.post("/api/projects/:id/members", async (req, res) => {
    try {
      const memberData = insertProjectMemberSchema.parse({
        ...req.body,
        projectId: req.params.id
      });
      const member = await storage.addProjectMember(memberData);
      res.status(201).json(member);
    } catch (error) {
      res.status(400).json({ message: "Invalid project member data" });
    }
  });

  app.delete("/api/projects/:projectId/members/:memberId", async (req, res) => {
    try {
      const deleted = await storage.removeProjectMember(req.params.projectId, req.params.memberId);
      if (!deleted) {
        return res.status(404).json({ message: "Project member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove project member" });
    }
  });

  // Project Files
  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const files = await storage.getProjectFiles(req.params.id);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project files" });
    }
  });

  app.post("/api/projects/:id/files", async (req, res) => {
    try {
      const fileData = insertProjectFileSchema.parse({
        ...req.body,
        projectId: req.params.id
      });
      const file = await storage.addProjectFile(fileData);
      res.status(201).json(file);
    } catch (error) {
      res.status(400).json({ message: "Invalid file data" });
    }
  });

  app.delete("/api/files/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProjectFile(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "File not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Project Notes
  app.get("/api/projects/:id/notes", async (req, res) => {
    try {
      const notes = await storage.getProjectNotes(req.params.id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project notes" });
    }
  });

  app.post("/api/projects/:id/notes", async (req, res) => {
    try {
      const noteData = insertProjectNoteSchema.parse({
        ...req.body,
        projectId: req.params.id
      });
      const note = await storage.addProjectNote(noteData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ message: "Invalid note data" });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProjectNote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // Enhanced Dashboard APIs
  app.get("/api/dashboard/client-activity", async (req, res) => {
    try {
      // Mock client activity data - in real implementation, would aggregate from multiple sources
      const activities = [
        {
          id: "1",
          type: "contract_viewed",
          clientName: "Sarah Johnson",
          projectName: "Wedding Reception",
          documentTitle: "Performance Contract #WR-2024-001",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          description: "Opened and viewed contract",
          contactId: "contact-1",
          projectId: "project-1"
        },
        {
          id: "2",
          type: "quote_opened",
          clientName: "Mike Thompson",
          projectName: "Corporate Event",
          documentTitle: "Event Quote #CE-2024-015",
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          description: "Opened quote document",
          contactId: "contact-2",
          projectId: "project-2"
        }
      ];
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client activity" });
    }
  });

  app.get("/api/dashboard/pending-items", async (req, res) => {
    try {
      // Get pending quotes, contracts, invoices from database
      const quotes = await storage.getQuotes();
      const contracts = await storage.getContracts();
      const invoices = await storage.getInvoices();
      
      const pendingQuotes = quotes.filter(q => q.status === 'sent').map(q => ({
        id: q.id,
        type: 'quote',
        title: q.title,
        clientName: q.contactId, // In real implementation, would join with contact data
        projectName: q.leadId || 'General Project',
        sentDate: q.createdAt,
        amount: parseFloat(q.subtotal),
        status: q.status,
        contactId: q.contactId,
        projectId: q.leadId,
        urgency: 'medium'
      }));

      const pendingContracts = contracts.filter(c => c.status === 'sent').map(c => ({
        id: c.id,
        type: 'contract',
        title: c.title,
        clientName: c.contactId,
        projectName: c.projectId || 'General Project',
        sentDate: c.createdAt,
        status: c.status,
        contactId: c.contactId,
        projectId: c.projectId,
        urgency: 'high'
      }));

      const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').map(i => ({
        id: i.id,
        type: 'invoice',
        title: i.title,
        clientName: i.contactId,
        projectName: i.projectId || 'General Project',
        sentDate: i.createdAt,
        amount: parseFloat(i.total),
        status: i.status,
        contactId: i.contactId,
        projectId: i.projectId,
        urgency: i.status === 'overdue' ? 'critical' : 'medium'
      }));

      const allPending = [...pendingQuotes, ...pendingContracts, ...pendingInvoices];
      res.json(allPending);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending items" });
    }
  });

  app.get("/api/dashboard/business-priorities", async (req, res) => {
    try {
      // Get leads that need attention
      const leads = await storage.getLeads();
      const newLeads = leads.filter(l => l.status === 'new').map(l => ({
        id: l.id,
        type: 'new_lead',
        title: `${l.firstName} ${l.lastName} - General Inquiry`,
        description: l.notes || 'New lead requires follow-up',
        clientName: `${l.firstName} ${l.lastName}`,
        createdDate: l.createdAt,
        urgency: 'high',
        contactId: l.id
      }));

      // Get overdue tasks
      const tasks = await storage.getTasks();
      const overdueTasks = tasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
      ).map(t => ({
        id: t.id,
        type: 'todo',
        title: t.title,
        description: t.description || 'Task is overdue',
        dueDate: t.dueDate,
        createdDate: t.createdAt,
        urgency: 'critical',
        contactId: t.contactId,
        projectId: t.projectId
      }));

      const allPriorities = [...newLeads, ...overdueTasks];
      res.json(allPriorities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch business priorities" });
    }
  });

  app.get("/api/dashboard/recent-emails", async (req, res) => {
    try {
      const emails = await storage.getEmails();
      const recentEmails = emails
        .filter(e => e.createdAt !== null)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 20)
        .map(e => ({
          id: e.id,
          subject: e.subject,
          fromEmail: e.fromEmail,
          fromName: e.fromEmail.split('@')[0], // Simple name extraction
          toEmail: e.toEmail,
          body: e.body,
          receivedAt: e.createdAt!,
          isRead: e.status === 'delivered',
          hasAttachments: false,
          projectName: e.projectId || 'General',
          clientName: e.contactId || 'Unknown',
          projectId: e.projectId,
          contactId: e.contactId,
          priority: 'medium',
          labels: []
        }));

      res.json(recentEmails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent emails" });
    }
  });

  // Events/Calendar API
  app.get("/api/events", async (req, res) => {
    try {
      const { userId, startDate, endDate, clientId } = req.query;
      
      let events;
      if (startDate && endDate) {
        events = await storage.getEventsByDateRange(new Date(startDate as string), new Date(endDate as string));
      } else if (userId) {
        events = await storage.getEventsByUser(userId as string);
      } else if (clientId) {
        events = await storage.getEventsByClient(clientId as string);
      } else {
        events = await storage.getEvents();
      }
      
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(validatedData);
      
      // Auto-sync to Google Calendar if user has an active integration
      try {
        console.log(`Attempting to sync new event "${event.title}" to Google Calendar`);
        const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy);
        const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
        
        if (googleIntegration) {
          console.log('Found active Google integration, starting sync...');
          const syncResult = await googleOAuthService.syncToGoogle(googleIntegration, event.id);
          console.log(`Successfully synced event "${event.title}" to Google Calendar:`, syncResult);
        } else {
          console.log('No active Google integration found for user:', event.createdBy);
        }
      } catch (syncError: any) {
        console.error('Failed to sync new event to Google:', syncError);
        console.error('Sync error details:', syncError?.response?.data || syncError?.message);
        // Don't fail the creation if sync fails
      }
      
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ message: "Invalid event data", error });
    }
  });

  app.patch("/api/events/:id", async (req, res) => {
    try {
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(req.params.id, validatedData);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Auto-sync to Google Calendar if user has an active integration
      try {
        const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy);
        const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
        
        if (googleIntegration) {
          await googleOAuthService.syncToGoogle(googleIntegration, event.id);
        }
      } catch (syncError: any) {
        console.error('Failed to sync updated event to Google:', syncError);
        // Don't fail the update if sync fails
      }
      
      res.json(event);
    } catch (error) {
      res.status(400).json({ message: "Invalid event data", error });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      // Get event before deletion for Google sync
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Delete from Google Calendar if it was synced
      if (event.externalEventId) {
        try {
          const integrations = await storage.getCalendarIntegrationsByUser(event.createdBy);
          const googleIntegration = integrations.find(int => int.provider === 'google' && int.isActive);
          
          if (googleIntegration) {
            console.log(`Deleting event "${event.title}" from Google Calendar:`, event.externalEventId);
            await googleOAuthService.deleteFromGoogle(googleIntegration, event.externalEventId);
            console.log(`Successfully deleted "${event.title}" from Google Calendar`);
          } else {
            console.log('No active Google integration found for deletion sync');
          }
        } catch (syncError: any) {
          console.error('Failed to delete from Google Calendar:', syncError);
          console.error('Error details:', syncError?.response?.data || syncError?.message);
          // Continue with CRM deletion even if Google sync fails
        }
      } else {
        console.log(`Event "${event.title}" has no external event ID, skipping Google deletion`);
      }
      
      const deleted = await storage.deleteEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Calendar Integrations API
  app.get("/api/calendar-integrations", async (req, res) => {
    try {
      const { userId } = req.query;
      let integrations;
      if (userId) {
        integrations = await storage.getCalendarIntegrationsByUser(userId as string);
      } else {
        integrations = await storage.getCalendarIntegrations();
      }
      res.json(integrations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar integrations" });
    }
  });

  app.get("/api/calendar-integrations/:id", async (req, res) => {
    try {
      const integration = await storage.getCalendarIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      res.json(integration);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar integration" });
    }
  });

  app.post("/api/calendar-integrations", async (req, res) => {
    try {
      const validatedData = insertCalendarIntegrationSchema.parse(req.body);
      const integration = await storage.createCalendarIntegration(validatedData);
      res.status(201).json(integration);
    } catch (error) {
      res.status(400).json({ message: "Invalid calendar integration data", error });
    }
  });

  app.patch("/api/calendar-integrations/:id", async (req, res) => {
    try {
      const validatedData = insertCalendarIntegrationSchema.partial().parse(req.body);
      const integration = await storage.updateCalendarIntegration(req.params.id, validatedData);
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      res.json(integration);
    } catch (error) {
      res.status(400).json({ message: "Invalid calendar integration data", error });
    }
  });

  app.delete("/api/calendar-integrations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCalendarIntegration(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete calendar integration" });
    }
  });

  // Calendar Sync API - Enhanced with bidirectional Google sync
  app.post("/api/calendar-integrations/:id/sync", async (req, res) => {
    try {
      console.log('🚀 Sync endpoint called for integration:', req.params.id);
      const integrationId = req.params.id;
      const integration = await storage.getCalendarIntegration(integrationId);
      
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }

      if (!integration.isActive) {
        return res.status(400).json({ message: "Calendar integration is not active" });
      }

      let result;
      
      if (integration.provider === 'google') {
        try {
          console.log('🔄 Starting enhanced Google Calendar bidirectional sync...');
          // Use the enhanced Google OAuth service for full bidirectional sync
          result = await googleOAuthService.syncFromGoogle(integration);
          console.log('🎉 Enhanced Google Calendar sync completed:', result);
        } catch (error: any) {
          console.error('❌ Enhanced Google Calendar sync failed:', error);
          throw new Error(`Google Calendar sync failed: ${error.message}`);
        }
      } else if (integration.provider === 'ical') {
        if (integration.syncDirection === 'import' || integration.syncDirection === 'bidirectional') {
          result = { message: "iCal sync not yet implemented" };
        } else {
          result = { message: "Only import/bidirectional sync is supported for iCal" };
        }
      } else {
        return res.status(400).json({ message: "Unsupported calendar provider" });
      }
      
      // Update last sync time
      console.log('⏰ Updating last sync time...');
      await storage.updateCalendarIntegration(integrationId, {
        lastSyncAt: new Date()
      });

      res.json(result);
    } catch (error: any) {
      console.error('🚨 Sync endpoint error:', error);
      res.status(500).json({ message: "Failed to sync calendar", error: error.message });
    }
  });

  // Calendar Sync Logs API
  app.get("/api/calendar-sync-logs", async (req, res) => {
    try {
      const { integrationId } = req.query;
      const logs = await storage.getCalendarSyncLogs(integrationId as string || undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sync logs" });
    }
  });

  app.post("/api/calendar-sync-logs", async (req, res) => {
    try {
      const validatedData = insertCalendarSyncLogSchema.parse(req.body);
      const log = await storage.createCalendarSyncLog(validatedData);
      res.status(201).json(log);
    } catch (error) {
      res.status(400).json({ message: "Invalid sync log data", error });
    }
  });

  app.patch("/api/calendar-sync-logs/:id", async (req, res) => {
    try {
      const validatedData = insertCalendarSyncLogSchema.partial().parse(req.body);
      const log = await storage.updateCalendarSyncLog(req.params.id, validatedData);
      if (!log) {
        return res.status(404).json({ message: "Sync log not found" });
      }
      res.json(log);
    } catch (error) {
      res.status(400).json({ message: "Invalid sync log data", error });
    }
  });

  // Google Calendar OAuth Routes
  app.get("/auth/google", async (req, res) => {
    try {
      const authUrl = googleCalendarService.getAuthUrl();
      res.redirect(authUrl);
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate Google Calendar authentication" });
    }
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({ message: "Authorization code not provided" });
      }
      
      // Exchange code for tokens
      const tokens = await googleCalendarService.getTokensFromCode(code as string);
      
      // Set credentials to get calendar list
      googleCalendarService.setCredentials(tokens);
      const calendars = await googleCalendarService.getCalendarList();
      
      // Find primary calendar or use the first one
      const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];
      
      if (!primaryCalendar) {
        return res.status(400).json({ message: "No accessible calendars found" });
      }
      
      // Create calendar integration record
      // Note: In a real app, you'd get the userId from the session/JWT
      const users = await storage.getUsers();
      const defaultUserId = users[0]?.id || 'default-user';
      
      const integration = await storage.createCalendarIntegration({
        userId: defaultUserId,
        provider: 'google',
        providerAccountId: primaryCalendar.id,
        calendarId: primaryCalendar.id,
        calendarName: primaryCalendar.summary,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        isActive: true,
        syncDirection: 'bidirectional'
      });
      
      // Redirect to frontend with success
      res.redirect(`/?connected=google&calendar=${encodeURIComponent(primaryCalendar.summary)}`);
    } catch (error) {
      console.error('Google Calendar OAuth error:', error);
      res.redirect('/?error=oauth_failed');
    }
  });

  // Enhanced sync endpoint with Google Calendar integration
  app.post("/api/calendar-integrations/:id/sync", async (req, res) => {
    try {
      const integrationId = req.params.id;
      const integration = await storage.getCalendarIntegration(integrationId);
      
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }

      if (!integration.isActive) {
        return res.status(400).json({ message: "Calendar integration is not active" });
      }

      // Create sync log
      const syncLog = await storage.createCalendarSyncLog({
        integrationId,
        syncType: 'manual',
        direction: integration.syncDirection === 'export' ? 'export' : 'import',
      });

      let syncResult = {
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsDeleted: 0
      };

      try {
        if (integration.provider === 'google') {
          // Note: In a real app, you'd get the userId from the session/JWT
          const users = await storage.getUsers();
          const defaultUserId = users[0]?.id || 'default-user';
          
          if (integration.syncDirection === 'import' || integration.syncDirection === 'bidirectional') {
            // Sync from Google to CRM
            const importResult = await googleCalendarService.syncFromGoogle(integration, defaultUserId);
            syncResult.eventsCreated += importResult.eventsCreated;
            syncResult.eventsUpdated += importResult.eventsUpdated;
            syncResult.eventsDeleted += importResult.eventsDeleted;
          }
          
          if (integration.syncDirection === 'export' || integration.syncDirection === 'bidirectional') {
            // Sync from CRM to Google
            const exportResult = await googleCalendarService.syncToGoogle(integration);
            syncResult.eventsCreated += exportResult.eventsCreated;
            syncResult.eventsUpdated += exportResult.eventsUpdated;
            syncResult.eventsDeleted += exportResult.eventsDeleted;
          }
        } else if (integration.provider === 'ical') {
          // iCal integration (import only)
          if (integration.syncDirection === 'import' || integration.syncDirection === 'bidirectional') {
            const users = await storage.getUsers();
            const defaultUserId = users[0]?.id || 'default-user';
            
            const importResult = await icalService.importFromICal(integration, defaultUserId);
            syncResult.eventsCreated += importResult.eventsCreated;
            syncResult.eventsUpdated += importResult.eventsUpdated;
            syncResult.eventsDeleted += importResult.eventsDeleted;
          }
        }
        
        // Update sync log as completed
        await storage.updateCalendarSyncLog(syncLog.id, {
          status: 'completed',
          completedAt: new Date(),
          eventsProcessed: syncResult.eventsCreated + syncResult.eventsUpdated + syncResult.eventsDeleted,
          eventsCreated: syncResult.eventsCreated,
          eventsUpdated: syncResult.eventsUpdated,
          eventsDeleted: syncResult.eventsDeleted,
        });

        res.json({ 
          message: "Sync completed", 
          syncLogId: syncLog.id,
          ...syncResult
        });
      } catch (syncError) {
        const errorMessage = syncError instanceof Error ? syncError.message : 'Unknown sync error';
        // Update sync log as failed
        await storage.updateCalendarSyncLog(syncLog.id, {
          status: 'failed',
          completedAt: new Date(),
          errors: JSON.stringify({ error: errorMessage, timestamp: new Date() })
        });
        
        throw syncError;
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      console.error('Sync error:', error);
      res.status(500).json({ message: "Failed to sync calendar", error: errorMessage });
    }
  });

  // Cleanup orphaned Google Calendar events
  app.post("/api/calendar-integrations/:id/cleanup", async (req, res) => {
    try {
      const integration = await storage.getCalendarIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      
      const { eventTitles } = req.body;
      if (!eventTitles || !Array.isArray(eventTitles)) {
        return res.status(400).json({ message: "eventTitles array is required" });
      }
      
      const result = await googleOAuthService.cleanupOrphanedEvents(integration, eventTitles);
      res.json({ 
        message: "Cleanup completed successfully", 
        deletedCount: result.deletedCount 
      });
    } catch (error: any) {
      console.error('Calendar cleanup error:', error);
      res.status(500).json({ message: "Failed to cleanup orphaned events", error: error.message });
    }
  });

  // iCal Routes
  app.post("/api/calendar-integrations/ical", async (req, res) => {
    try {
      const { icalUrl, calendarName, userId } = req.body;
      
      if (!icalUrl) {
        return res.status(400).json({ message: "iCal URL is required" });
      }
      
      // Test parsing the iCal URL
      try {
        await icalService.parseICalFromUrl(icalUrl);
      } catch (error) {
        return res.status(400).json({ 
          message: "Invalid iCal URL or unable to parse iCal data",
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Create iCal integration
      const integration = await storage.createCalendarIntegration({
        userId: userId || 'default-user',
        provider: 'ical',
        calendarName: calendarName || 'iCal Import',
        isActive: true,
        syncDirection: 'import',
        settings: JSON.stringify({ icalUrl })
      });
      
      res.json(integration);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to create iCal integration", error: errorMessage });
    }
  });

  // Export CRM events as iCal feed
  app.get("/api/calendar/ical/:integrationId", async (req, res) => {
    try {
      const integrationId = req.params.integrationId;
      
      // Get integration to verify access
      const integration = await storage.getCalendarIntegration(integrationId);
      if (!integration) {
        return res.status(404).json({ message: "Calendar integration not found" });
      }
      
      // Get events to export
      let events;
      if (integration.provider === 'google' || integration.provider === 'ical') {
        // Export events from this integration
        const allEvents = await storage.getEvents();
        events = allEvents.filter(e => e.calendarIntegrationId === integrationId);
      } else {
        // Export all CRM events
        events = await storage.getEvents();
      }
      
      // Generate iCal feed
      const icalFeed = await icalService.generateICalFeed(events, integration.calendarName);
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${integration.calendarName.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
      res.send(icalFeed);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to generate iCal feed", error: errorMessage });
    }
  });

  // Export all CRM events as iCal feed
  app.get("/api/calendar/ical", async (req, res) => {
    try {
      const events = await storage.getEvents();
      const icalFeed = await icalService.generateICalFeed(events, 'CRM Calendar');
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="crm_calendar.ics"');
      res.send(icalFeed);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to generate iCal feed", error: errorMessage });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
