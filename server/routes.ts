import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { twilioService } from "./services/twilio";
import { 
  insertLeadSchema, 
  insertClientSchema, 
  insertProjectSchema, 
  insertQuoteSchema, 
  insertContractSchema, 
  insertInvoiceSchema, 
  insertTaskSchema, 
  insertEmailSchema,
  insertAutomationSchema,
  insertMemberSchema,
  insertVenueSchema,
  insertProjectMemberSchema,
  insertMemberAvailabilitySchema,
  insertProjectFileSchema,
  insertProjectNoteSchema,
  insertSmsMessageSchema,
  insertMessageTemplateSchema,
  insertMessageThreadSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
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

  // Leads
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
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.status(201).json(client);
    } catch (error) {
      res.status(400).json({ message: "Invalid client data" });
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
        tasks = await storage.getTodayTasks(assignedTo as string);
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
      const user = await storage.validateUser(username, password);
      if (!user) {
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
          clientId: "client-1",
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
          clientId: "client-2",
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
        clientName: q.clientId, // In real implementation, would join with client data
        projectName: q.leadId || 'General Project',
        sentDate: q.createdAt,
        amount: parseFloat(q.subtotal),
        status: q.status,
        clientId: q.clientId,
        projectId: q.leadId,
        urgency: 'medium'
      }));

      const pendingContracts = contracts.filter(c => c.status === 'sent').map(c => ({
        id: c.id,
        type: 'contract',
        title: c.title,
        clientName: c.clientId,
        projectName: c.leadId || 'General Project',
        sentDate: c.createdAt,
        status: c.status,
        clientId: c.clientId,
        projectId: c.leadId,
        urgency: 'high'
      }));

      const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').map(i => ({
        id: i.id,
        type: 'invoice',
        title: i.title,
        clientName: i.clientId,
        projectName: i.projectId || 'General Project',
        sentDate: i.createdAt,
        amount: parseFloat(i.total),
        status: i.status,
        clientId: i.clientId,
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
        clientId: l.id
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
        clientId: t.clientId,
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
          clientName: e.clientId || 'Unknown',
          projectId: e.projectId,
          clientId: e.clientId,
          priority: 'medium',
          labels: []
        }));

      res.json(recentEmails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent emails" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
