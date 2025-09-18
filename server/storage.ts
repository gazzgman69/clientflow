import { 
  type User, type InsertUser,
  type Lead, type InsertLead,
  type Contact, type InsertContact,
  type Project, type InsertProject,
  type Quote, type InsertQuote,
  type Contract, type InsertContract,
  type Invoice, type InsertInvoice,
  type Task, type InsertTask,
  type Email, type InsertEmail,
  type Activity, type InsertActivity,
  type Automation, type InsertAutomation,
  type Member, type InsertMember,
  type Venue, type InsertVenue,
  type ProjectMember, type InsertProjectMember,
  type MemberAvailability, type InsertMemberAvailability,
  type ProjectFile, type InsertProjectFile,
  type ProjectNote, type InsertProjectNote,
  type SmsMessage, type InsertSmsMessage,
  type MessageTemplate, type InsertMessageTemplate,
  type MessageThread, type InsertMessageThread,
  type Event, type InsertEvent,
  type CalendarIntegration, type InsertCalendarIntegration,
  type CalendarSyncLog, type InsertCalendarSyncLog,
  type Template, type InsertTemplate,
  type LeadCaptureForm, type InsertLeadCaptureForm,
  type LeadStatusHistory, type InsertLeadStatusHistory,
  type EmailSignature, type InsertEmailSignature,
  type PortalForm, type InsertPortalForm,
  type PaymentSession, type InsertPaymentSession,
  type WebhookEvent, type InsertWebhookEvent,
  // Tenant types
  type Tenant, type InsertTenant,
  // Enhanced Quotes System types
  type QuotePackage, type InsertQuotePackage,
  type QuoteAddon, type InsertQuoteAddon,
  type QuoteItem, type InsertQuoteItem,
  type QuoteToken, type InsertQuoteToken,
  type QuoteSignature, type InsertQuoteSignature,
  // Quote Extra Info System types
  type QuoteExtraInfoField, type InsertQuoteExtraInfoField,
  type QuoteExtraInfoConfig, type InsertQuoteExtraInfoConfig,
  type QuoteExtraInfoResponse, type InsertQuoteExtraInfoResponse,
  users, leads, contacts, projects, quotes, contracts, invoices, tasks, emails, emailThreads, activities, automations, 
  members, venues, projectMembers, memberAvailability, projectFiles, projectNotes, smsMessages, 
  messageTemplates, messageThreads, events, calendarIntegrations, calendarSyncLog, templates, leadCaptureForms,
  leadStatusHistory, emailSignatures, portalForms, paymentSessions, webhookEvents, tenants,
  // Enhanced Quotes System tables
  quotePackages, quoteAddons, quoteItems, quoteTokens, quoteSignatures,
  // Quote Extra Info System tables
  quoteExtraInfoFields, quoteExtraInfoConfig, quoteExtraInfoResponses
} from "@shared/schema";
import { randomUUID } from "crypto";
import { TenantScopedStorage } from './utils/tenantScopedStorage';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, desc, or, isNull } from 'drizzle-orm';
import { secureStore } from './src/services/secureStore';

// Helper function to omit undefined values to prevent overwriting required fields
function omitUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value;
    }
  }
  return result;
}

export interface IStorage {
  // Tenants (for job scheduling and resolution)
  getActiveTenants(): Promise<{ id: string; name: string; slug: string }[]>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  getTenant(id: string): Promise<Tenant | undefined>;
  
  // Users
  getUsers(tenantId: string): Promise<User[]>;
  getUser(id: string, tenantId: string): Promise<User | undefined>;
  getUserByUsername(username: string, tenantId: string): Promise<User | undefined>;
  createUser(user: InsertUser, tenantId: string): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>, tenantId: string): Promise<User | undefined>;
  
  // Leads
  getLeads(tenantId: string, userId?: string): Promise<Lead[]>;
  getLead(id: string, tenantId: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead, tenantId: string): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>, tenantId: string): Promise<Lead | undefined>;
  deleteLead(id: string, tenantId: string): Promise<boolean>;
  
  // Contacts
  getContacts(tenantId: string, userId?: string): Promise<Contact[]>;
  getContact(id: string, tenantId: string): Promise<Contact | undefined>;
  getContactByEmail(email: string, tenantId: string): Promise<Contact | undefined>;
  getContactById(id: string, tenantId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact, tenantId: string): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>, tenantId: string): Promise<Contact | undefined>;
  deleteContact(id: string, tenantId: string): Promise<boolean>;
  
  // Projects
  getProjects(tenantId: string, userId?: string): Promise<Project[]>;
  getProject(id: string, tenantId: string): Promise<Project | undefined>;
  getProjectsByContact(contactId: string, tenantId: string): Promise<Project[]>;
  createProject(project: InsertProject, tenantId: string): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>, tenantId: string): Promise<Project | undefined>;
  deleteProject(id: string, tenantId: string): Promise<boolean>;
  
  // Quotes
  getQuotes(tenantId: string): Promise<Quote[]>;
  getQuote(id: string, tenantId: string): Promise<Quote | undefined>;
  getQuotesByContact(contactId: string, tenantId: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote, tenantId: string): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>, tenantId: string): Promise<Quote | undefined>;
  deleteQuote(id: string, tenantId: string): Promise<boolean>;

  // Enhanced Quotes System
  // Quote Packages
  getQuotePackages(tenantId: string): Promise<QuotePackage[]>;
  getQuotePackage(id: string, tenantId: string): Promise<QuotePackage | undefined>;
  createQuotePackage(pkg: InsertQuotePackage, tenantId: string): Promise<QuotePackage>;
  updateQuotePackage(id: string, pkg: Partial<InsertQuotePackage>, tenantId: string): Promise<QuotePackage | undefined>;
  deleteQuotePackage(id: string, tenantId: string): Promise<boolean>;

  // Quote Add-ons
  getQuoteAddons(tenantId: string): Promise<QuoteAddon[]>;
  getQuoteAddon(id: string, tenantId: string): Promise<QuoteAddon | undefined>;
  createQuoteAddon(addon: InsertQuoteAddon, tenantId: string): Promise<QuoteAddon>;
  updateQuoteAddon(id: string, addon: Partial<InsertQuoteAddon>, tenantId: string): Promise<QuoteAddon | undefined>;
  deleteQuoteAddon(id: string, tenantId: string): Promise<boolean>;

  // Quote Items (line items for quotes)
  getQuoteItems(quoteId: string, tenantId: string): Promise<QuoteItem[]>;
  createQuoteItem(item: InsertQuoteItem, tenantId: string): Promise<QuoteItem>;
  updateQuoteItem(id: string, item: Partial<InsertQuoteItem>, tenantId: string): Promise<QuoteItem | undefined>;
  deleteQuoteItem(id: string, tenantId: string): Promise<boolean>;

  // Quote Tokens (for public access)
  getQuoteByToken(token: string, tenantId: string): Promise<{ quote: Quote; items: QuoteItem[]; packages: QuotePackage[]; addons: QuoteAddon[] } | undefined>;
  createQuoteToken(quoteId: string, tenantId: string, expiresAt?: Date): Promise<QuoteToken>;
  getQuoteToken(token: string, tenantId: string): Promise<QuoteToken | undefined>;
  deactivateQuoteToken(token: string, tenantId: string): Promise<boolean>;

  // Quote Signatures
  getQuoteSignatures(quoteId: string, tenantId: string): Promise<QuoteSignature[]>;
  createQuoteSignature(signature: InsertQuoteSignature, tenantId: string): Promise<QuoteSignature>;
  getQuoteSignature(quoteId: string, tenantId: string): Promise<QuoteSignature | undefined>;
  
  // Quote Extra Info System
  // Extra Info Fields (standard + custom field definitions)
  getQuoteExtraInfoFields(tenantId: string, userId?: string): Promise<QuoteExtraInfoField[]>;
  getQuoteExtraInfoField(id: string, tenantId: string): Promise<QuoteExtraInfoField | undefined>;
  getQuoteExtraInfoFieldByKey(key: string, tenantId: string, userId?: string): Promise<QuoteExtraInfoField | undefined>;
  createQuoteExtraInfoField(field: InsertQuoteExtraInfoField, tenantId: string): Promise<QuoteExtraInfoField>;
  updateQuoteExtraInfoField(id: string, field: Partial<InsertQuoteExtraInfoField>, tenantId: string): Promise<QuoteExtraInfoField | undefined>;
  deleteQuoteExtraInfoField(id: string, tenantId: string): Promise<boolean>;
  
  // Extra Info Configuration (per-quote settings)
  getQuoteExtraInfoConfig(quoteId: string, tenantId: string): Promise<QuoteExtraInfoConfig | undefined>;
  createQuoteExtraInfoConfig(config: InsertQuoteExtraInfoConfig, tenantId: string): Promise<QuoteExtraInfoConfig>;
  updateQuoteExtraInfoConfig(quoteId: string, config: Partial<InsertQuoteExtraInfoConfig>, tenantId: string): Promise<QuoteExtraInfoConfig | undefined>;
  deleteQuoteExtraInfoConfig(quoteId: string, tenantId: string): Promise<boolean>;
  
  // Extra Info Responses (user-submitted values)
  getQuoteExtraInfoResponses(quoteId: string, tenantId: string): Promise<QuoteExtraInfoResponse[]>;
  getQuoteExtraInfoResponse(quoteId: string, fieldKey: string, tenantId: string): Promise<QuoteExtraInfoResponse | undefined>;
  createQuoteExtraInfoResponse(response: InsertQuoteExtraInfoResponse, tenantId: string): Promise<QuoteExtraInfoResponse>;
  updateQuoteExtraInfoResponse(quoteId: string, fieldKey: string, response: Partial<InsertQuoteExtraInfoResponse>, tenantId: string): Promise<QuoteExtraInfoResponse | undefined>;
  upsertQuoteExtraInfoResponse(response: InsertQuoteExtraInfoResponse, tenantId: string): Promise<QuoteExtraInfoResponse>;
  deleteQuoteExtraInfoResponse(quoteId: string, fieldKey: string, tenantId: string): Promise<boolean>;
  
  // Contracts
  getContracts(tenantId: string): Promise<Contract[]>;
  getContract(id: string, tenantId: string): Promise<Contract | undefined>;
  getContractsByClient(clientId: string, tenantId: string): Promise<Contract[]>;
  createContract(contract: InsertContract, tenantId: string): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>, tenantId: string): Promise<Contract | undefined>;
  deleteContract(id: string, tenantId: string): Promise<boolean>;
  
  // Invoices
  getInvoices(tenantId: string): Promise<Invoice[]>;
  getInvoice(id: string, tenantId: string): Promise<Invoice | undefined>;
  getInvoicesByClient(clientId: string, tenantId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice, tenantId: string): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>, tenantId: string): Promise<Invoice | undefined>;
  deleteInvoice(id: string, tenantId: string): Promise<boolean>;
  
  // Tasks  
  getTasks(tenantId: string, userId?: string): Promise<Task[]>;
  getTask(id: string, tenantId: string): Promise<Task | undefined>;
  getTasksByAssignee(userId: string, tenantId: string): Promise<Task[]>;
  getTodayTasks(userId: string, tenantId: string): Promise<Task[]>;
  createTask(task: InsertTask, tenantId: string): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>, tenantId: string): Promise<Task | undefined>;
  deleteTask(id: string, tenantId: string): Promise<boolean>;
  
  // Emails
  getEmails(tenantId: string): Promise<Email[]>;
  getEmail(id: string, tenantId: string): Promise<Email | undefined>;
  getEmailsByThread(threadId: string, tenantId: string): Promise<Email[]>;
  getEmailsByClient(clientId: string, tenantId: string): Promise<Email[]>;
  createEmail(email: InsertEmail, tenantId: string): Promise<Email>;
  updateEmail(id: string, email: Partial<InsertEmail>, tenantId: string): Promise<Email | undefined>;
  
  // SMS Messages
  getSmsMessages(tenantId: string): Promise<SmsMessage[]>;
  getSmsMessage(id: string, tenantId: string): Promise<SmsMessage | undefined>;
  getSmsMessagesByThread(threadId: string, tenantId: string): Promise<SmsMessage[]>;
  getSmsMessagesByClient(clientId: string, tenantId: string): Promise<SmsMessage[]>;
  getSmsMessagesByPhone(phoneNumber: string, tenantId: string): Promise<SmsMessage[]>;
  createSmsMessage(sms: InsertSmsMessage, tenantId: string): Promise<SmsMessage>;
  updateSmsMessage(id: string, sms: Partial<InsertSmsMessage>, tenantId: string): Promise<SmsMessage | undefined>;
  
  // Message Templates
  getMessageTemplates(tenantId: string): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string, tenantId: string): Promise<MessageTemplate | undefined>;
  getMessageTemplatesByType(type: string, tenantId: string): Promise<MessageTemplate[]>;
  createMessageTemplate(template: InsertMessageTemplate, tenantId: string): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, template: Partial<InsertMessageTemplate>, tenantId: string): Promise<MessageTemplate | undefined>;
  deleteMessageTemplate(id: string, tenantId: string): Promise<boolean>;
  
  // Message Threads
  getMessageThreads(tenantId: string): Promise<MessageThread[]>;
  getMessageThread(id: string, tenantId: string): Promise<MessageThread | undefined>;
  getMessageThreadsByClient(clientId: string, tenantId: string): Promise<MessageThread[]>;
  createMessageThread(thread: InsertMessageThread, tenantId: string): Promise<MessageThread>;
  updateMessageThread(id: string, thread: Partial<InsertMessageThread>, tenantId: string): Promise<MessageThread | undefined>;
  
  // Activities
  getActivities(tenantId: string): Promise<Activity[]>;
  getRecentActivities(tenantId: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity, tenantId: string): Promise<Activity>;
  
  // Automations
  getAutomations(tenantId: string): Promise<Automation[]>;
  getAutomation(id: string, tenantId: string): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation, tenantId: string): Promise<Automation>;
  updateAutomation(id: string, automation: Partial<InsertAutomation>, tenantId: string): Promise<Automation | undefined>;
  deleteAutomation(id: string, tenantId: string): Promise<boolean>;
  
  // Members (Musicians)
  getMembers(tenantId: string): Promise<Member[]>;
  getMember(id: string, tenantId: string): Promise<Member | undefined>;
  createMember(member: InsertMember, tenantId: string): Promise<Member>;
  updateMember(id: string, member: Partial<InsertMember>, tenantId: string): Promise<Member | undefined>;
  deleteMember(id: string, tenantId: string): Promise<boolean>;
  
  // Venues
  getVenues(tenantId: string): Promise<Venue[]>;
  getVenue(id: string, tenantId: string): Promise<Venue | undefined>;
  createVenue(venue: InsertVenue, tenantId: string): Promise<Venue>;
  updateVenue(id: string, venue: Partial<InsertVenue>, tenantId: string): Promise<Venue | undefined>;
  deleteVenue(id: string, tenantId: string): Promise<boolean>;
  
  // Project Members
  getProjectMembers(projectId: string, tenantId: string): Promise<ProjectMember[]>;
  addProjectMember(projectMember: InsertProjectMember, tenantId: string): Promise<ProjectMember>;
  updateProjectMember(projectId: string, memberId: string, data: Partial<InsertProjectMember>, tenantId: string): Promise<ProjectMember | undefined>;
  removeProjectMember(projectId: string, memberId: string, tenantId: string): Promise<boolean>;
  
  // Member Availability
  getMemberAvailability(memberId: string, tenantId: string, startDate?: Date, endDate?: Date): Promise<MemberAvailability[]>;
  setMemberAvailability(availability: InsertMemberAvailability, tenantId: string): Promise<MemberAvailability>;
  
  // Project Files
  getProjectFiles(projectId: string, tenantId: string): Promise<ProjectFile[]>;
  addProjectFile(file: InsertProjectFile, tenantId: string): Promise<ProjectFile>;
  deleteProjectFile(id: string, tenantId: string): Promise<boolean>;
  
  // Project Notes
  getProjectNotes(projectId: string, tenantId: string): Promise<ProjectNote[]>;
  addProjectNote(note: InsertProjectNote, tenantId: string): Promise<ProjectNote>;
  deleteProjectNote(id: string, tenantId: string): Promise<boolean>;
  
  // Authentication
  validateUser(username: string, password: string, tenantId: string): Promise<User | undefined>;
  
  // Events
  getEvents(tenantId: string): Promise<Event[]>;
  getEvent(id: string, tenantId: string): Promise<Event | undefined>;
  getEventsByUser(userId: string, tenantId: string): Promise<Event[]>;
  getEventsByDateRange(startDate: Date, endDate: Date, tenantId: string): Promise<Event[]>;
  getEventsByClient(clientId: string, tenantId: string): Promise<Event[]>;
  getEventsByIntegration(integrationId: string, tenantId: string): Promise<Event[]>;
  createEvent(event: InsertEvent, tenantId: string): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>, tenantId: string): Promise<Event | undefined>;
  deleteEvent(id: string, tenantId: string): Promise<boolean>;
  
  // Calendar Integrations
  getCalendarIntegrations(tenantId: string): Promise<CalendarIntegration[]>;
  getCalendarIntegrationsByTenant(tenantId: string): Promise<CalendarIntegration[]>;
  getCalendarIntegration(id: string, tenantId: string): Promise<CalendarIntegration | undefined>;
  getCalendarIntegrationsByUser(userId: string, tenantId: string): Promise<CalendarIntegration[]>;
  getCalendarIntegrationByEmail(email: string, userId: string, tenantId: string): Promise<CalendarIntegration | undefined>;
  createCalendarIntegration(integration: InsertCalendarIntegration, tenantId: string): Promise<CalendarIntegration>;
  updateCalendarIntegration(id: string, integration: Partial<InsertCalendarIntegration>, tenantId: string): Promise<CalendarIntegration | undefined>;
  deleteCalendarIntegration(id: string, tenantId: string): Promise<boolean>;
  
  // Event sync helpers
  getEventByExternalId(externalId: string, tenantId: string): Promise<Event | undefined>;
  
  // Calendar Sync Logs
  getCalendarSyncLogs(tenantId: string, integrationId?: string): Promise<CalendarSyncLog[]>;
  createCalendarSyncLog(log: InsertCalendarSyncLog, tenantId: string): Promise<CalendarSyncLog>;
  updateCalendarSyncLog(id: string, log: Partial<InsertCalendarSyncLog>, tenantId: string): Promise<CalendarSyncLog | undefined>;

  // Dashboard metrics
  getDashboardMetrics(tenantId: string, userId?: string): Promise<{
    totalLeads: number;
    activeProjects: number;
    revenue: number;
    pendingInvoices: number;
  }>;

  // Templates
  getTemplates(tenantId: string): Promise<Template[]>;
  getTemplate(id: string, tenantId: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate, tenantId: string): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>, tenantId: string): Promise<Template | undefined>;
  deleteTemplate(id: string, tenantId: string): Promise<boolean>;

  // Email Signatures
  getUserSignatures(userId: string, tenantId: string): Promise<EmailSignature[]>;
  getSignature(id: string, userId: string, tenantId: string): Promise<EmailSignature | null>;
  getDefaultSignature(userId: string, tenantId: string): Promise<EmailSignature | null>;
  createSignature(signature: InsertEmailSignature, tenantId: string): Promise<EmailSignature>;
  updateSignature(id: string, userId: string, signature: Partial<InsertEmailSignature>, tenantId: string): Promise<EmailSignature | null>;
  deleteSignature(id: string, userId: string, tenantId: string): Promise<boolean>;
  clearDefaultSignatures(userId: string, tenantId: string): Promise<void>;

  // Lead Capture Forms
  getLeadCaptureForms(tenantId: string): Promise<LeadCaptureForm[]>;
  getLeadCaptureForm(id: string, tenantId: string): Promise<LeadCaptureForm | undefined>;
  getLeadCaptureFormBySlug(slug: string, tenantId: string): Promise<LeadCaptureForm | undefined>;
  createLeadCaptureForm(form: InsertLeadCaptureForm, tenantId: string): Promise<LeadCaptureForm>;
  updateLeadCaptureForm(id: string, form: Partial<InsertLeadCaptureForm>, tenantId: string): Promise<LeadCaptureForm | undefined>;
  deleteLeadCaptureForm(id: string, tenantId: string): Promise<boolean>;

  // Portal Forms - Project-specific questionnaires
  getPortalFormsByContact(contactId: string, tenantId: string): Promise<PortalForm[]>;
  getPortalFormsByProjectAndContact(projectId: string, contactId: string, tenantId: string): Promise<PortalForm[]>;
  getPortalFormById(id: string, tenantId: string): Promise<PortalForm | undefined>;
  createPortalForm(form: InsertPortalForm, tenantId: string): Promise<PortalForm>;
  updatePortalForm(id: string, form: Partial<InsertPortalForm>, tenantId: string): Promise<PortalForm | undefined>;
  deletePortalForm(id: string, tenantId: string): Promise<boolean>;

  // Payment Sessions - Track payment attempts
  getPaymentSessionsByContactId(contactId: string, tenantId: string): Promise<PaymentSession[]>;
  getPaymentSessionById(id: string, tenantId: string): Promise<PaymentSession | undefined>;
  createPaymentSession(session: InsertPaymentSession, tenantId: string): Promise<PaymentSession>;
  updatePaymentSession(sessionId: string, session: Partial<InsertPaymentSession>, tenantId: string): Promise<PaymentSession | undefined>;

  // Webhook Events - Track processed webhooks for idempotency
  getWebhookEventByProviderAndEventId(provider: string, eventId: string, tenantId: string): Promise<WebhookEvent | undefined>;
  createWebhookEvent(event: InsertWebhookEvent, tenantId: string): Promise<WebhookEvent>;
  updateWebhookEvent(eventId: string, event: Partial<InsertWebhookEvent>, tenantId: string): Promise<WebhookEvent | undefined>;

  // Additional invoice methods for portal
  getInvoiceById(id: string, tenantId: string): Promise<Invoice | undefined>;
  getInvoicesByContactId(contactId: string, tenantId: string): Promise<Invoice[]>;

  // Additional contact methods for portal
  // getContactById already declared above in Contacts section

  // Additional event methods for appointment booking
  getEventById(id: string, tenantId: string): Promise<Event | undefined>;
  getEventsByContactEmail(email: string, tenantId: string): Promise<Event[]>;

  // Tenant-scoped storage wrapper
  withTenant(tenantId: string): TenantScopedStorage;
}

export class MemStorage implements IStorage {
  /**
   * Safely decrypt a token - handles migration from plain text to encrypted tokens
   */
  private safeDecrypt(token: string): string {
    if (!token) return '';
    
    try {
      // Try to decrypt the token - if it succeeds, it was encrypted
      return secureStore.decrypt(token);
    } catch (error) {
      // If decryption fails, treat as plain text (legacy tokens during migration)
      // Only log this occasionally to avoid spam, and only in development
      if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
        console.warn('⚠️ Token appears to be plain text (legacy format) - consider re-authenticating');
      }
      return token;
    }
  }
  private users: Map<string, User> = new Map();
  private leads: Map<string, Lead> = new Map();
  private contacts: Map<string, Contact> = new Map();
  private projects: Map<string, Project> = new Map();
  private quotes: Map<string, Quote> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private tasks: Map<string, Task> = new Map();
  private emails: Map<string, Email> = new Map();
  private activities: Map<string, Activity> = new Map();
  private automations: Map<string, Automation> = new Map();
  private members: Map<string, Member> = new Map();
  private venues: Map<string, Venue> = new Map();
  private projectMembers: Map<string, ProjectMember[]> = new Map();
  private memberAvailability: Map<string, MemberAvailability[]> = new Map();
  private projectFiles: Map<string, ProjectFile[]> = new Map();
  private projectNotes: Map<string, ProjectNote[]> = new Map();
  private smsMessages: Map<string, SmsMessage> = new Map();
  private messageTemplates: Map<string, MessageTemplate> = new Map();
  private messageThreads: Map<string, MessageThread> = new Map();
  private events: Map<string, Event> = new Map();
  private calendarIntegrations: Map<string, CalendarIntegration> = new Map();
  private calendarSyncLogs: Map<string, CalendarSyncLog> = new Map();
  private templates: Map<string, Template> = new Map();
  private leadCaptureForms: Map<string, LeadCaptureForm> = new Map();
  private emailSignatures: Map<string, EmailSignature> = new Map();

  constructor() {
    // Initialize with default admin user (DEVELOPMENT ONLY)
    // TODO: In production, remove this default user or require strong random credentials via environment variables
    if (process.env.NODE_ENV !== 'production') {
      const defaultUser: User = {
        id: randomUUID(),
        username: "admin",
        password: "$2b$12$SM67YK8RyHHkIISwIXS/OOjT5FQiKCOrMBRXzBljj4JlIqD6e/mhi", // bcrypt hashed "password" - CHANGE IN PRODUCTION
        email: "admin@localhost.dev",
        role: "admin",
        firstName: "Admin",
        lastName: "User",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
        createdAt: new Date(),
      };
      this.users.set(defaultUser.id, defaultUser);
    }
  }

  // Users
  async getUsers(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.tenantId === tenantId || !user.tenantId);
  }

  async getUser(id: string, tenantId: string): Promise<User | undefined> {
    const user = this.users.get(id);
    return (user && (user.tenantId === tenantId || !user.tenantId)) ? user : undefined;
  }

  async getUserByUsername(username: string, tenantId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => 
      user.username === username && (user.tenantId === tenantId || !user.tenantId)
    );
  }

  async createUser(insertUser: InsertUser, tenantId: string): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      avatar: insertUser.avatar ?? null,
      role: insertUser.role ?? 'client',
      tenantId,
      id, 
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  // Leads
  async getLeads(tenantId: string, userId?: string): Promise<Lead[]> {
    let leads = Array.from(this.leads.values()).filter(lead => 
      lead.tenantId === tenantId || !lead.tenantId
    );
    if (userId) {
      leads = leads.filter(lead => lead.userId === userId);
    }
    return leads.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getLead(id: string, tenantId: string): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    return (lead && (lead.tenantId === tenantId || !lead.tenantId)) ? lead : undefined;
  }

  async createLead(insertLead: InsertLead, tenantId: string): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = {
      ...insertLead,
      fullName: insertLead.fullName ?? null,
      middleName: insertLead.middleName ?? null,
      status: insertLead.status ?? 'new',
      phone: insertLead.phone ?? null,
      company: insertLead.company ?? null,
      leadSource: insertLead.leadSource ?? null,
      estimatedValue: insertLead.estimatedValue ?? null,
      notes: insertLead.notes ?? null,
      assignedTo: insertLead.assignedTo ?? null,
      projectId: insertLead.projectId ?? null,
      lastContactAt: insertLead.lastContactAt ?? null,
      lastManualStatusAt: insertLead.lastManualStatusAt ?? null,
      projectDate: insertLead.projectDate ?? null,
      lastViewedAt: insertLead.lastViewedAt ?? null,
      tenantId,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.leads.set(id, lead);
    
    // Create activity
    await this.createActivity({
      type: 'lead_created',
      description: `New lead added: ${lead.firstName} ${lead.lastName}`,
      entityType: 'lead',
      entityId: id,
      userId: insertLead.assignedTo || Array.from(this.users.keys())[0],
    });
    
    return lead;
  }

  async updateLead(id: string, leadUpdate: Partial<InsertLead>): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    
    const updatedLead: Lead = {
      ...lead,
      ...omitUndefined(leadUpdate),
      updatedAt: new Date(),
    };
    this.leads.set(id, updatedLead);
    return updatedLead;
  }

  async deleteLead(id: string): Promise<boolean> {
    return this.leads.delete(id);
  }

  // Contacts
  async getContacts(userId?: string): Promise<Contact[]> {
    let contacts = Array.from(this.contacts.values());
    if (userId) {
      contacts = contacts.filter(contact => contact.userId === userId);
    }
    return contacts.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = {
      ...insertContact,
      fullName: insertContact.fullName ?? null,
      middleName: insertContact.middleName ?? null,
      phone: insertContact.phone ?? null,
      company: insertContact.company ?? null,
      jobTitle: insertContact.jobTitle ?? null,
      website: insertContact.website ?? null,
      address: insertContact.address ?? null,
      city: insertContact.city ?? null,
      state: insertContact.state ?? null,
      zipCode: insertContact.zipCode ?? null,
      country: insertContact.country ?? null,
      venueAddress: insertContact.venueAddress ?? null,
      venueCity: insertContact.venueCity ?? null,
      venueState: insertContact.venueState ?? null,
      venueZipCode: insertContact.venueZipCode ?? null,
      venueCountry: insertContact.venueCountry ?? null,
      venueId: insertContact.venueId ?? null,
      tags: insertContact.tags ?? null,
      leadSource: insertContact.leadSource ?? null,
      notes: insertContact.notes ?? null,
      leadId: insertContact.leadId ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, contactUpdate: Partial<InsertContact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact) return undefined;
    
    const updatedContact: Contact = {
      ...contact,
      ...omitUndefined(contactUpdate),
      updatedAt: new Date(),
    };
    this.contacts.set(id, updatedContact);
    return updatedContact;
  }

  async deleteContact(id: string): Promise<boolean> {
    return this.contacts.delete(id);
  }

  async getContactByEmail(email: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find(contact => contact.email === email);
  }

  async getContactById(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  // Projects
  async getProjects(userId?: string): Promise<Project[]> {
    let projects = Array.from(this.projects.values());
    if (userId) {
      projects = projects.filter(project => project.userId === userId || project.assignedTo === userId);
    }
    return projects.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectsByContact(contactId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(project => project.contactId === contactId);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      status: insertProject.status ?? 'active',
      description: insertProject.description ?? null,
      venueId: insertProject.venueId ?? null,
      progress: insertProject.progress ?? 0,
      startDate: insertProject.startDate ?? null,
      endDate: insertProject.endDate ?? null,
      estimatedValue: insertProject.estimatedValue ?? null,
      actualValue: insertProject.actualValue ?? null,
      assignedTo: insertProject.assignedTo ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, projectUpdate: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject: Project = {
      ...project,
      ...omitUndefined(projectUpdate),
      updatedAt: new Date(),
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Quotes
  async getQuotes(): Promise<Quote[]> {
    return Array.from(this.quotes.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async getQuotesByContact(contactId: string): Promise<Quote[]> {
    return Array.from(this.quotes.values()).filter(quote => quote.contactId === contactId);
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const id = randomUUID();
    const quoteNumber = `Q-${Date.now()}`;
    const quote: Quote = {
      ...insertQuote,
      status: insertQuote.status ?? 'draft',
      description: insertQuote.description ?? null,
      contactId: insertQuote.contactId ?? null,
      leadId: insertQuote.leadId ?? null,
      taxAmount: insertQuote.taxAmount ?? '0',
      validUntil: insertQuote.validUntil ?? null,
      sentAt: insertQuote.sentAt ?? null,
      approvedAt: insertQuote.approvedAt ?? null,
      id,
      quoteNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.quotes.set(id, quote);
    return quote;
  }

  async updateQuote(id: string, quoteUpdate: Partial<InsertQuote>): Promise<Quote | undefined> {
    const quote = this.quotes.get(id);
    if (!quote) return undefined;
    
    const updatedQuote: Quote = {
      ...quote,
      ...omitUndefined(quoteUpdate),
      updatedAt: new Date(),
    };
    this.quotes.set(id, updatedQuote);
    return updatedQuote;
  }

  async deleteQuote(id: string): Promise<boolean> {
    return this.quotes.delete(id);
  }

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async getContractsByClient(clientId: string): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter(contract => contract.contactId === clientId);
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const id = randomUUID();
    const contractNumber = `C-${Date.now()}`;
    const contract: Contract = {
      ...insertContract,
      status: insertContract.status ?? 'draft',
      description: insertContract.description ?? null,
      projectId: insertContract.projectId ?? null,
      quoteId: insertContract.quoteId ?? null,
      terms: insertContract.terms ?? null,
      signedAt: insertContract.signedAt ?? null,
      expiresAt: insertContract.expiresAt ?? null,
      id,
      contractNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contracts.set(id, contract);
    return contract;
  }

  async updateContract(id: string, contractUpdate: Partial<InsertContract>): Promise<Contract | undefined> {
    const contract = this.contracts.get(id);
    if (!contract) return undefined;
    
    const updatedContract: Contract = {
      ...contract,
      ...omitUndefined(contractUpdate),
      updatedAt: new Date(),
    };
    this.contracts.set(id, updatedContract);
    return updatedContract;
  }

  async deleteContract(id: string): Promise<boolean> {
    return this.contracts.delete(id);
  }

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async getInvoicesByClient(clientId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(invoice => invoice.contactId === clientId);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const invoiceNumber = `INV-${Date.now()}`;
    const invoice: Invoice = {
      ...insertInvoice,
      status: insertInvoice.status ?? 'draft',
      description: insertInvoice.description ?? null,
      projectId: insertInvoice.projectId ?? null,
      contractId: insertInvoice.contractId ?? null,
      taxAmount: insertInvoice.taxAmount ?? null,
      dueDate: insertInvoice.dueDate ?? null,
      sentAt: insertInvoice.sentAt ?? null,
      paidAt: insertInvoice.paidAt ?? null,
      id,
      invoiceNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, invoiceUpdate: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    
    const updatedInvoice: Invoice = {
      ...invoice,
      ...omitUndefined(invoiceUpdate),
      updatedAt: new Date(),
    };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  // Tasks
  async getTasks(userId?: string): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    if (userId) {
      tasks = tasks.filter(task => task.assignedTo === userId || task.createdBy === userId);
    }
    return tasks.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksByAssignee(userId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.assignedTo === userId);
  }

  async getTodayTasks(userId: string): Promise<Task[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return Array.from(this.tasks.values()).filter(task => 
      task.assignedTo === userId && 
      task.dueDate && 
      new Date(task.dueDate) >= today && 
      new Date(task.dueDate) < tomorrow
    );
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = {
      ...insertTask,
      status: insertTask.status ?? 'pending',
      description: insertTask.description ?? null,
      priority: insertTask.priority ?? 'medium',
      dueDate: insertTask.dueDate ?? null,
      completedAt: insertTask.completedAt ?? null,
      assignedTo: insertTask.assignedTo ?? null,
      leadId: insertTask.leadId ?? null,
      contactId: insertTask.contactId ?? null,
      projectId: insertTask.projectId ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, taskUpdate: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updatedTask: Task = {
      ...task,
      ...omitUndefined(taskUpdate),
      updatedAt: new Date(),
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  // Emails
  async getEmails(): Promise<Email[]> {
    return Array.from(this.emails.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getEmail(id: string): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async getEmailsByThread(threadId: string): Promise<Email[]> {
    return Array.from(this.emails.values()).filter(email => email.threadId === threadId);
  }

  async getEmailsByClient(clientId: string): Promise<Email[]> {
    return Array.from(this.emails.values()).filter(email => email.clientId === clientId);
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const id = randomUUID();
    const email: Email = {
      ...insertEmail,
      status: insertEmail.status ?? 'draft',
      leadId: insertEmail.leadId ?? null,
      contactId: insertEmail.contactId ?? null,
      clientId: insertEmail.clientId ?? null,
      projectId: insertEmail.projectId ?? null,
      threadId: insertEmail.threadId ?? null,
      ccEmails: insertEmail.ccEmails ?? null,
      bccEmails: insertEmail.bccEmails ?? null,
      sentAt: insertEmail.sentAt ?? null,
      sentBy: insertEmail.sentBy ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.emails.set(id, email);
    return email;
  }

  async updateEmail(id: string, emailUpdate: Partial<InsertEmail>): Promise<Email | undefined> {
    const email = this.emails.get(id);
    if (!email) return undefined;
    
    const updatedEmail: Email = {
      ...email,
      ...emailUpdate,
    };
    this.emails.set(id, updatedEmail);
    return updatedEmail;
  }

  // SMS Messages
  async getSmsMessages(): Promise<SmsMessage[]> {
    return Array.from(this.smsMessages.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getSmsMessage(id: string): Promise<SmsMessage | undefined> {
    return this.smsMessages.get(id);
  }

  async getSmsMessagesByThread(threadId: string): Promise<SmsMessage[]> {
    return Array.from(this.smsMessages.values())
      .filter(sms => sms.threadId === threadId)
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  }

  async getSmsMessagesByClient(clientId: string): Promise<SmsMessage[]> {
    return Array.from(this.smsMessages.values())
      .filter(sms => sms.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getSmsMessagesByPhone(phoneNumber: string): Promise<SmsMessage[]> {
    return Array.from(this.smsMessages.values())
      .filter(sms => sms.toPhone === phoneNumber || sms.fromPhone === phoneNumber)
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  }

  async createSmsMessage(insertSms: InsertSmsMessage): Promise<SmsMessage> {
    const id = randomUUID();
    const sms: SmsMessage = {
      ...insertSms,
      status: insertSms.status ?? 'queued',
      direction: insertSms.direction ?? 'outbound',
      leadId: insertSms.leadId ?? null,
      contactId: insertSms.contactId ?? null,
      clientId: insertSms.clientId ?? null,
      projectId: insertSms.projectId ?? null,
      threadId: insertSms.threadId ?? null,
      twilioSid: insertSms.twilioSid ?? null,
      sentAt: insertSms.sentAt ?? null,
      sentBy: insertSms.sentBy ?? null,
      id,
      createdAt: new Date(),
    };
    this.smsMessages.set(id, sms);
    return sms;
  }

  async updateSmsMessage(id: string, smsUpdate: Partial<InsertSmsMessage>): Promise<SmsMessage | undefined> {
    const sms = this.smsMessages.get(id);
    if (!sms) return undefined;
    
    const updatedSms: SmsMessage = {
      ...sms,
      ...smsUpdate,
    };
    this.smsMessages.set(id, updatedSms);
    return updatedSms;
  }

  // Message Templates
  async getMessageTemplates(): Promise<MessageTemplate[]> {
    return Array.from(this.messageTemplates.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | undefined> {
    return this.messageTemplates.get(id);
  }

  async getMessageTemplatesByType(type: string): Promise<MessageTemplate[]> {
    return Array.from(this.messageTemplates.values())
      .filter(template => template.type === type && template.isActive)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createMessageTemplate(insertTemplate: InsertMessageTemplate): Promise<MessageTemplate> {
    const id = randomUUID();
    const template: MessageTemplate = {
      ...insertTemplate,
      subject: insertTemplate.subject ?? null,
      variables: insertTemplate.variables ?? null,
      category: insertTemplate.category ?? null,
      isActive: insertTemplate.isActive ?? true,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.messageTemplates.set(id, template);
    return template;
  }

  async updateMessageTemplate(id: string, templateUpdate: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined> {
    const template = this.messageTemplates.get(id);
    if (!template) return undefined;
    
    const updatedTemplate: MessageTemplate = {
      ...template,
      ...templateUpdate,
      updatedAt: new Date(),
    };
    this.messageTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteMessageTemplate(id: string): Promise<boolean> {
    return this.messageTemplates.delete(id);
  }

  // Message Threads
  async getMessageThreads(): Promise<MessageThread[]> {
    return Array.from(this.messageThreads.values()).sort((a, b) => 
      new Date(b.lastMessageAt || b.createdAt!).getTime() - new Date(a.lastMessageAt || a.createdAt!).getTime()
    );
  }

  async getMessageThread(id: string): Promise<MessageThread | undefined> {
    return this.messageThreads.get(id);
  }

  async getMessageThreadsByClient(clientId: string): Promise<MessageThread[]> {
    return Array.from(this.messageThreads.values())
      .filter(thread => thread.clientId === clientId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt!).getTime() - new Date(a.lastMessageAt || a.createdAt!).getTime());
  }

  async createMessageThread(insertThread: InsertMessageThread): Promise<MessageThread> {
    const id = randomUUID();
    const thread: MessageThread = {
      ...insertThread,
      subject: insertThread.subject ?? null,
      leadId: insertThread.leadId ?? null,
      contactId: insertThread.contactId ?? null,
      clientId: insertThread.clientId ?? null,
      projectId: insertThread.projectId ?? null,
      lastMessageAt: insertThread.lastMessageAt ?? null,
      id,
      createdAt: new Date(),
    };
    this.messageThreads.set(id, thread);
    return thread;
  }

  async updateMessageThread(id: string, threadUpdate: Partial<InsertMessageThread>): Promise<MessageThread | undefined> {
    const thread = this.messageThreads.get(id);
    if (!thread) return undefined;
    
    const updatedThread: MessageThread = {
      ...thread,
      ...threadUpdate,
    };
    this.messageThreads.set(id, updatedThread);
    return updatedThread;
  }

  // Activities
  async getActivities(): Promise<Activity[]> {
    return Array.from(this.activities.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    const activities = await this.getActivities();
    return activities.slice(0, limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const activity: Activity = {
      ...insertActivity,
      entityType: insertActivity.entityType ?? null,
      entityId: insertActivity.entityId ?? null,
      contactId: insertActivity.contactId ?? null,
      projectId: insertActivity.projectId ?? null,
      id,
      createdAt: new Date(),
    };
    this.activities.set(id, activity);
    return activity;
  }

  // Automations
  async getAutomations(): Promise<Automation[]> {
    return Array.from(this.automations.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    return this.automations.get(id);
  }

  async createAutomation(insertAutomation: InsertAutomation): Promise<Automation> {
    const id = randomUUID();
    const automation: Automation = {
      ...insertAutomation,
      description: insertAutomation.description ?? null,
      isActive: insertAutomation.isActive ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.automations.set(id, automation);
    return automation;
  }

  async updateAutomation(id: string, automationUpdate: Partial<InsertAutomation>): Promise<Automation | undefined> {
    const automation = this.automations.get(id);
    if (!automation) return undefined;
    
    const updatedAutomation: Automation = {
      ...automation,
      ...automationUpdate,
      updatedAt: new Date(),
    };
    this.automations.set(id, updatedAutomation);
    return updatedAutomation;
  }

  async deleteAutomation(id: string): Promise<boolean> {
    return this.automations.delete(id);
  }

  // Members (Musicians)
  async getMembers(): Promise<Member[]> {
    return Array.from(this.members.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getMember(id: string): Promise<Member | undefined> {
    return this.members.get(id);
  }

  async createMember(insertMember: InsertMember): Promise<Member> {
    const id = randomUUID();
    const member: Member = {
      ...insertMember,
      phone: insertMember.phone ?? null,
      instruments: insertMember.instruments ?? null,
      hourlyRate: insertMember.hourlyRate ?? null,
      address: insertMember.address ?? null,
      city: insertMember.city ?? null,
      state: insertMember.state ?? null,
      zipCode: insertMember.zipCode ?? null,
      preferredStatus: insertMember.preferredStatus ?? null,
      notes: insertMember.notes ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.members.set(id, member);
    return member;
  }

  async updateMember(id: string, memberUpdate: Partial<InsertMember>): Promise<Member | undefined> {
    const member = this.members.get(id);
    if (!member) return undefined;
    
    const updatedMember: Member = {
      ...member,
      ...omitUndefined(memberUpdate),
      updatedAt: new Date(),
    };
    this.members.set(id, updatedMember);
    return updatedMember;
  }

  async deleteMember(id: string): Promise<boolean> {
    return this.members.delete(id);
  }

  // Venues
  async getVenues(): Promise<Venue[]> {
    return Array.from(this.venues.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getVenue(id: string): Promise<Venue | undefined> {
    return this.venues.get(id);
  }

  async createVenue(insertVenue: InsertVenue): Promise<Venue> {
    const id = randomUUID();
    const venue: Venue = {
      ...insertVenue,
      address: insertVenue.address ?? null,
      address2: insertVenue.address2 ?? null,
      city: insertVenue.city ?? null,
      state: insertVenue.state ?? null,
      zipCode: insertVenue.zipCode ?? null,
      country: insertVenue.country ?? null,
      countryCode: insertVenue.countryCode ?? null,
      latitude: insertVenue.latitude ?? null,
      longitude: insertVenue.longitude ?? null,
      placeId: insertVenue.placeId ?? null,
      capacity: insertVenue.capacity ?? null,
      contactName: insertVenue.contactName ?? null,
      contactPhone: insertVenue.contactPhone ?? null,
      contactEmail: insertVenue.contactEmail ?? null,
      website: insertVenue.website ?? null,
      restrictions: insertVenue.restrictions ?? null,
      accessNotes: insertVenue.accessNotes ?? null,
      managerName: insertVenue.managerName ?? null,
      managerPhone: insertVenue.managerPhone ?? null,
      managerEmail: insertVenue.managerEmail ?? null,
      preferred: insertVenue.preferred ?? false,
      useCount: insertVenue.useCount ?? 0,
      lastUsedAt: insertVenue.lastUsedAt ?? null,
      tags: insertVenue.tags ?? [],
      notes: insertVenue.notes ?? null,
      meta: insertVenue.meta ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.venues.set(id, venue);
    return venue;
  }

  async updateVenue(id: string, venueUpdate: Partial<InsertVenue>): Promise<Venue | undefined> {
    const venue = this.venues.get(id);
    if (!venue) return undefined;
    
    const updatedVenue: Venue = {
      ...venue,
      ...omitUndefined(venueUpdate),
      updatedAt: new Date(),
    };
    this.venues.set(id, updatedVenue);
    return updatedVenue;
  }

  async deleteVenue(id: string): Promise<boolean> {
    return this.venues.delete(id);
  }

  // Project Members
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return this.projectMembers.get(projectId) || [];
  }

  async addProjectMember(insertProjectMember: InsertProjectMember): Promise<ProjectMember> {
    const projectMember: ProjectMember = {
      ...insertProjectMember,
      role: insertProjectMember.role ?? null,
      fee: insertProjectMember.fee ?? null,
      status: insertProjectMember.status ?? 'pending',
      confirmedAt: insertProjectMember.confirmedAt ?? null,
      notes: insertProjectMember.notes ?? null,
      createdAt: new Date(),
    };
    
    const existing = this.projectMembers.get(insertProjectMember.projectId) || [];
    existing.push(projectMember);
    this.projectMembers.set(insertProjectMember.projectId, existing);
    
    return projectMember;
  }

  async updateProjectMember(projectId: string, memberId: string, data: Partial<InsertProjectMember>): Promise<ProjectMember | undefined> {
    const projectMembers = this.projectMembers.get(projectId);
    if (!projectMembers) return undefined;
    
    const index = projectMembers.findIndex(pm => pm.memberId === memberId);
    if (index === -1) return undefined;
    
    projectMembers[index] = {
      ...projectMembers[index],
      ...data,
    };
    
    this.projectMembers.set(projectId, projectMembers);
    return projectMembers[index];
  }

  async removeProjectMember(projectId: string, memberId: string): Promise<boolean> {
    const projectMembers = this.projectMembers.get(projectId);
    if (!projectMembers) return false;
    
    const filtered = projectMembers.filter(pm => pm.memberId !== memberId);
    if (filtered.length === projectMembers.length) return false;
    
    this.projectMembers.set(projectId, filtered);
    return true;
  }

  // Member Availability
  async getMemberAvailability(memberId: string, startDate?: Date, endDate?: Date): Promise<MemberAvailability[]> {
    const availability = this.memberAvailability.get(memberId) || [];
    
    if (!startDate && !endDate) {
      return availability;
    }
    
    return availability.filter(a => {
      const date = new Date(a.date);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });
  }

  async setMemberAvailability(insertAvailability: InsertMemberAvailability): Promise<MemberAvailability> {
    const id = randomUUID();
    const availability: MemberAvailability = {
      ...insertAvailability,
      available: insertAvailability.available ?? true,
      notes: insertAvailability.notes ?? null,
      id,
      createdAt: new Date(),
    };
    
    const existing = this.memberAvailability.get(insertAvailability.memberId) || [];
    existing.push(availability);
    this.memberAvailability.set(insertAvailability.memberId, existing);
    
    return availability;
  }

  // Project Files
  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return this.projectFiles.get(projectId) || [];
  }

  async addProjectFile(insertFile: InsertProjectFile): Promise<ProjectFile> {
    const id = randomUUID();
    const file: ProjectFile = {
      ...insertFile,
      fileSize: insertFile.fileSize ?? null,
      mimeType: insertFile.mimeType ?? null,
      id,
      createdAt: new Date(),
    };
    
    const existing = this.projectFiles.get(insertFile.projectId) || [];
    existing.push(file);
    this.projectFiles.set(insertFile.projectId, existing);
    
    return file;
  }

  async deleteProjectFile(id: string): Promise<boolean> {
    for (const [projectId, files] of Array.from(this.projectFiles.entries())) {
      const index = files.findIndex((f: ProjectFile) => f.id === id);
      if (index !== -1) {
        files.splice(index, 1);
        this.projectFiles.set(projectId, files);
        return true;
      }
    }
    return false;
  }

  // Project Notes
  async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
    return this.projectNotes.get(projectId) || [];
  }

  async addProjectNote(insertNote: InsertProjectNote): Promise<ProjectNote> {
    const id = randomUUID();
    const note: ProjectNote = {
      ...insertNote,
      id,
      createdAt: new Date(),
    };
    
    const existing = this.projectNotes.get(insertNote.projectId) || [];
    existing.push(note);
    this.projectNotes.set(insertNote.projectId, existing);
    
    return note;
  }

  async deleteProjectNote(id: string): Promise<boolean> {
    for (const [projectId, notes] of Array.from(this.projectNotes.entries())) {
      const index = notes.findIndex((n: ProjectNote) => n.id === id);
      if (index !== -1) {
        notes.splice(index, 1);
        this.projectNotes.set(projectId, notes);
        return true;
      }
    }
    return false;
  }

  // Authentication
  async validateUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByUsername(username);
    if (!user) return undefined;
    
    // Simple password check (in production, this should use bcrypt)
    if (user.password === password) {
      return user;
    }
    
    return undefined;
  }

  async updateUser(id: string, userUpdate: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...omitUndefined(userUpdate),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventsByUser(userId: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => 
      event.assignedTo === userId || event.createdBy === userId
    );
  }

  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return (eventStart <= endDate && eventEnd >= startDate);
    });
  }

  async getEventsByClient(clientId: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => event.contactId === clientId);
  }

  async getEventsByIntegration(integrationId: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => event.calendarIntegrationId === integrationId);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = {
      ...insertEvent,
      type: insertEvent.type ?? 'meeting',
      status: insertEvent.status ?? 'confirmed',
      priority: insertEvent.priority ?? 'medium',
      allDay: insertEvent.allDay ?? false,
      recurring: insertEvent.recurring ?? false,
      description: insertEvent.description ?? null,
      location: insertEvent.location ?? null,
      recurrenceRule: insertEvent.recurrenceRule ?? null,
      leadId: insertEvent.leadId ?? null,
      contactId: insertEvent.contactId ?? null,
      projectId: insertEvent.projectId ?? null,
      assignedTo: insertEvent.assignedTo ?? null,
      externalEventId: insertEvent.externalEventId ?? null,
      providerData: insertEvent.providerData ?? null,
      calendarIntegrationId: insertEvent.calendarIntegrationId ?? null,
      reminderMinutes: insertEvent.reminderMinutes ?? 15,
      attendees: insertEvent.attendees ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, eventUpdate: Partial<InsertEvent>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    const updatedEvent: Event = {
      ...event,
      ...omitUndefined(eventUpdate),
      updatedAt: new Date(),
    };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    return this.events.delete(id);
  }

  // Calendar Integrations
  async getCalendarIntegrations(): Promise<CalendarIntegration[]> {
    return Array.from(this.calendarIntegrations.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getCalendarIntegration(id: string): Promise<CalendarIntegration | undefined> {
    const integration = this.calendarIntegrations.get(id);
    if (!integration) return undefined;
    
    // Decrypt tokens for use
    return {
      ...integration,
      accessToken: integration.accessToken ? secureStore.decrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? secureStore.decrypt(integration.refreshToken) : null,
    };
  }

  async getCalendarIntegrationsByUser(userId: string): Promise<CalendarIntegration[]> {
    const integrations = Array.from(this.calendarIntegrations.values()).filter(integration => 
      integration.userId === userId
    );
    
    // Decrypt tokens for use
    return integrations.map(integration => ({
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    }));
  }
  
  async getCalendarIntegrationByEmail(email: string, userId: string): Promise<CalendarIntegration | undefined> {
    const integration = Array.from(this.calendarIntegrations.values()).find(integration => 
      integration.providerAccountId === email && integration.userId === userId && integration.provider === 'google'
    );
    
    if (!integration) return undefined;
    
    // Decrypt tokens for use
    return {
      ...integration,
      accessToken: integration.accessToken ? secureStore.decrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? secureStore.decrypt(integration.refreshToken) : null,
    };
  }

  async createCalendarIntegration(insertIntegration: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const id = randomUUID();
    const integration: CalendarIntegration = {
      ...insertIntegration,
      providerAccountId: insertIntegration.providerAccountId ?? null,
      calendarId: insertIntegration.calendarId ?? null,
      accessToken: insertIntegration.accessToken ? secureStore.encrypt(insertIntegration.accessToken) : null,
      refreshToken: insertIntegration.refreshToken ? secureStore.encrypt(insertIntegration.refreshToken) : null,
      syncToken: insertIntegration.syncToken ?? null,
      webhookId: insertIntegration.webhookId ?? null,
      isActive: insertIntegration.isActive ?? true,
      syncDirection: insertIntegration.syncDirection ?? 'bidirectional',
      lastSyncAt: insertIntegration.lastSyncAt ?? null,
      syncErrors: insertIntegration.syncErrors ?? null,
      settings: insertIntegration.settings ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.calendarIntegrations.set(id, integration);
    
    // Return with decrypted tokens for immediate use
    return {
      ...integration,
      accessToken: integration.accessToken ? secureStore.decrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? secureStore.decrypt(integration.refreshToken) : null,
    };
  }

  async updateCalendarIntegration(id: string, integrationUpdate: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined> {
    const integration = this.calendarIntegrations.get(id);
    if (!integration) return undefined;
    
    // Encrypt sensitive OAuth tokens if they're being updated
    const secureUpdate = { ...integrationUpdate };
    if (integrationUpdate.accessToken !== undefined) {
      secureUpdate.accessToken = integrationUpdate.accessToken ? secureStore.encrypt(integrationUpdate.accessToken) : null;
    }
    if (integrationUpdate.refreshToken !== undefined) {
      secureUpdate.refreshToken = integrationUpdate.refreshToken ? secureStore.encrypt(integrationUpdate.refreshToken) : null;
    }
    
    const updatedIntegration: CalendarIntegration = {
      ...integration,
      ...omitUndefined(secureUpdate),
      updatedAt: new Date(),
    };
    this.calendarIntegrations.set(id, updatedIntegration);
    
    // Return with decrypted tokens for immediate use
    return {
      ...updatedIntegration,
      accessToken: updatedIntegration.accessToken ? secureStore.decrypt(updatedIntegration.accessToken) : null,
      refreshToken: updatedIntegration.refreshToken ? secureStore.decrypt(updatedIntegration.refreshToken) : null,
    };
  }

  async deleteCalendarIntegration(id: string): Promise<boolean> {
    return this.calendarIntegrations.delete(id);
  }
  
  async getEventByExternalId(externalId: string): Promise<Event | undefined> {
    return Array.from(this.events.values()).find(event => event.externalEventId === externalId);
  }

  // Calendar Sync Logs
  async getCalendarSyncLogs(integrationId?: string): Promise<CalendarSyncLog[]> {
    const logs = Array.from(this.calendarSyncLogs.values());
    if (integrationId) {
      return logs.filter(log => log.integrationId === integrationId);
    }
    return logs.sort((a, b) => 
      new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime()
    );
  }

  async createCalendarSyncLog(insertLog: InsertCalendarSyncLog): Promise<CalendarSyncLog> {
    const id = randomUUID();
    const log: CalendarSyncLog = {
      ...insertLog,
      eventsProcessed: insertLog.eventsProcessed ?? 0,
      eventsCreated: insertLog.eventsCreated ?? 0,
      eventsUpdated: insertLog.eventsUpdated ?? 0,
      eventsDeleted: insertLog.eventsDeleted ?? 0,
      errors: insertLog.errors ?? null,
      completedAt: insertLog.completedAt ?? null,
      status: insertLog.status ?? 'processing',
      id,
      startedAt: new Date(),
      createdAt: new Date(),
    };
    this.calendarSyncLogs.set(id, log);
    return log;
  }

  async updateCalendarSyncLog(id: string, logUpdate: Partial<InsertCalendarSyncLog>): Promise<CalendarSyncLog | undefined> {
    const log = this.calendarSyncLogs.get(id);
    if (!log) return undefined;
    
    const updatedLog: CalendarSyncLog = {
      ...log,
      ...logUpdate,
    };
    this.calendarSyncLogs.set(id, updatedLog);
    return updatedLog;
  }

  // Dashboard metrics
  async getDashboardMetrics(userId?: string): Promise<{
    totalLeads: number;
    activeProjects: number;
    revenue: number;
    pendingInvoices: number;
  }> {
    const leads = await this.getLeads(userId);
    const projects = await this.getProjects(userId);
    const invoices = await this.getInvoices();
    
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').length;
    
    const revenue = paidInvoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.total || '0');
    }, 0);

    return {
      totalLeads: leads.length,
      activeProjects,
      revenue,
      pendingInvoices,
    };
  }

  // Templates
  async getTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values()).sort((a, b) => 
      (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0)
    );
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const template: Template = { 
      ...insertTemplate,
      subject: insertTemplate.subject ?? null,
      isActive: insertTemplate.isActive ?? true,
      id, 
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.templates.set(id, template);
    return template;
  }

  async updateTemplate(id: string, updateData: Partial<InsertTemplate>): Promise<Template | undefined> {
    const existing = this.templates.get(id);
    if (!existing) return undefined;

    const updated: Template = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };
    this.templates.set(id, updated);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  // Email Signatures
  async getUserSignatures(userId: string): Promise<EmailSignature[]> {
    return Array.from(this.emailSignatures.values())
      .filter(signature => signature.userId === userId && signature.isActive)
      .sort((a, b) => (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0));
  }

  async getSignature(id: string, userId: string): Promise<EmailSignature | null> {
    const signature = this.emailSignatures.get(id);
    if (!signature || signature.userId !== userId) return null;
    return signature;
  }

  async getDefaultSignature(userId: string): Promise<EmailSignature | null> {
    return Array.from(this.emailSignatures.values())
      .find(signature => signature.userId === userId && signature.isDefault && signature.isActive) || null;
  }

  async createSignature(insertSignature: InsertEmailSignature): Promise<EmailSignature> {
    const id = randomUUID();
    const signature: EmailSignature = { 
      ...insertSignature,
      isActive: insertSignature.isActive ?? true,
      isDefault: insertSignature.isDefault ?? false,
      id, 
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.emailSignatures.set(id, signature);
    return signature;
  }

  async updateSignature(id: string, userId: string, updateData: Partial<InsertEmailSignature>): Promise<EmailSignature | null> {
    const existing = this.emailSignatures.get(id);
    if (!existing || existing.userId !== userId) return null;

    const updated: EmailSignature = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };
    this.emailSignatures.set(id, updated);
    return updated;
  }

  async deleteSignature(id: string, userId: string): Promise<boolean> {
    const signature = this.emailSignatures.get(id);
    if (!signature || signature.userId !== userId) return false;
    return this.emailSignatures.delete(id);
  }

  async clearDefaultSignatures(userId: string): Promise<void> {
    Array.from(this.emailSignatures.values())
      .filter(signature => signature.userId === userId && signature.isDefault)
      .forEach(signature => {
        this.emailSignatures.set(signature.id, {
          ...signature,
          isDefault: false,
          updatedAt: new Date()
        });
      });
  }

  // Lead Capture Forms
  async getLeadCaptureForms(): Promise<LeadCaptureForm[]> {
    return Array.from(this.leadCaptureForms.values()).sort((a, b) => 
      (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0)
    );
  }

  async getLeadCaptureForm(id: string): Promise<LeadCaptureForm | undefined> {
    return this.leadCaptureForms.get(id);
  }

  async getLeadCaptureFormBySlug(slug: string): Promise<LeadCaptureForm | undefined> {
    return Array.from(this.leadCaptureForms.values()).find(form => form.slug === slug);
  }

  async createLeadCaptureForm(insertForm: InsertLeadCaptureForm): Promise<LeadCaptureForm> {
    const id = randomUUID();
    const form: LeadCaptureForm = { 
      ...insertForm,
      notification: insertForm.notification ?? 'email',
      isActive: insertForm.isActive ?? true,
      calendarId: insertForm.calendarId ?? null,
      autoResponseTemplateId: insertForm.autoResponseTemplateId ?? null,
      lifecycleId: insertForm.lifecycleId ?? null,
      workflowId: insertForm.workflowId ?? null,
      contactTags: insertForm.contactTags ?? null,
      projectTags: insertForm.projectTags ?? null,
      recaptchaEnabled: insertForm.recaptchaEnabled ?? false,
      id, 
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.leadCaptureForms.set(id, form);
    return form;
  }

  async updateLeadCaptureForm(id: string, updateData: Partial<InsertLeadCaptureForm>): Promise<LeadCaptureForm | undefined> {
    const existing = this.leadCaptureForms.get(id);
    if (!existing) return undefined;

    const updated: LeadCaptureForm = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };
    this.leadCaptureForms.set(id, updated);
    return updated;
  }

  async deleteLeadCaptureForm(id: string): Promise<boolean> {
    return this.leadCaptureForms.delete(id);
  }

  // Portal Forms - MemStorage implementation
  private portalForms: Map<string, PortalForm> = new Map();
  
  async getPortalFormsByContact(contactId: string): Promise<PortalForm[]> {
    return Array.from(this.portalForms.values()).filter(form => form.contactId === contactId);
  }
  
  async getPortalFormsByProjectAndContact(projectId: string, contactId: string): Promise<PortalForm[]> {
    return Array.from(this.portalForms.values()).filter(
      form => form.projectId === projectId && form.contactId === contactId
    );
  }
  
  async getPortalFormById(id: string): Promise<PortalForm | undefined> {
    return this.portalForms.get(id);
  }
  
  async createPortalForm(form: InsertPortalForm): Promise<PortalForm> {
    const id = randomUUID();
    const portalForm: PortalForm = {
      ...form,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.portalForms.set(id, portalForm);
    return portalForm;
  }
  
  async updatePortalForm(id: string, form: Partial<InsertPortalForm>): Promise<PortalForm | undefined> {
    const existing = this.portalForms.get(id);
    if (!existing) return undefined;
    
    const updated: PortalForm = {
      ...existing,
      ...form,
      updatedAt: new Date(),
    };
    this.portalForms.set(id, updated);
    return updated;
  }
  
  async deletePortalForm(id: string): Promise<boolean> {
    return this.portalForms.delete(id);
  }

  // Payment Sessions - MemStorage implementation
  private paymentSessions: Map<string, PaymentSession> = new Map();

  // Webhook Events - MemStorage implementation  
  private webhookEvents: Map<string, WebhookEvent> = new Map();
  
  async getPaymentSessionsByContactId(contactId: string): Promise<PaymentSession[]> {
    return Array.from(this.paymentSessions.values()).filter(session => session.contactId === contactId);
  }
  
  async getPaymentSessionById(id: string): Promise<PaymentSession | undefined> {
    return this.paymentSessions.get(id);
  }
  
  async createPaymentSession(session: InsertPaymentSession): Promise<PaymentSession> {
    const id = randomUUID();
    const paymentSession: PaymentSession = {
      ...session,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.paymentSessions.set(id, paymentSession);
    return paymentSession;
  }
  
  async updatePaymentSession(sessionId: string, session: Partial<InsertPaymentSession>): Promise<PaymentSession | undefined> {
    const existing = this.paymentSessions.get(sessionId);
    if (!existing) return undefined;
    
    const updated: PaymentSession = {
      ...existing,
      ...session,
      updatedAt: new Date(),
    };
    this.paymentSessions.set(sessionId, updated);
    return updated;
  }

  // Webhook Events - MemStorage implementation
  async getWebhookEventByProviderAndEventId(provider: string, eventId: string): Promise<WebhookEvent | undefined> {
    return Array.from(this.webhookEvents.values()).find(
      event => event.provider === provider && event.eventId === eventId
    );
  }

  async createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent> {
    const id = randomUUID();
    const webhookEvent: WebhookEvent = {
      ...event,
      id,
      createdAt: new Date(),
    };
    this.webhookEvents.set(id, webhookEvent);
    return webhookEvent;
  }

  async updateWebhookEvent(eventId: string, event: Partial<InsertWebhookEvent>): Promise<WebhookEvent | undefined> {
    // Find by eventId (provider event ID), not by our internal ID
    const existing = Array.from(this.webhookEvents.values()).find(e => e.eventId === eventId);
    if (!existing) return undefined;

    const updated: WebhookEvent = { ...existing, ...event };
    this.webhookEvents.set(existing.id, updated);
    return updated;
  }

  // Additional invoice methods
  async getInvoiceById(id: string, tenantId: string): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    return (invoice && (invoice.tenantId === tenantId || !invoice.tenantId)) ? invoice : undefined;
  }
  
  async getInvoicesByContactId(contactId: string, tenantId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(invoice => 
      invoice.contactId === contactId && (invoice.tenantId === tenantId || !invoice.tenantId)
    );
  }

  // Additional event methods
  async getEventById(id: string, tenantId: string): Promise<Event | undefined> {
    const event = this.events.get(id);
    return (event && (event.tenantId === tenantId || !event.tenantId)) ? event : undefined;
  }
  
  async getEventsByContactEmail(email: string, tenantId: string): Promise<Event[]> {
    // Find contact by email first, then get events
    const contact = await this.getContactByEmail(email, tenantId);
    if (!contact) return [];
    return Array.from(this.events.values()).filter(event => 
      event.contactId === contact.id && (event.tenantId === tenantId || !event.tenantId)
    );
  }

  // Tenant-scoped storage wrapper
  withTenant(tenantId: string): TenantScopedStorage {
    return new TenantScopedStorage(this, tenantId);
  }
}

// Database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export class DrizzleStorage implements IStorage {
  /**
   * Safely decrypt a token - handles migration from plain text to encrypted tokens
   */
  private safeDecrypt(token: string): string {
    if (!token) return '';
    
    try {
      // Try to decrypt the token - if it succeeds, it was encrypted
      return secureStore.decrypt(token);
    } catch (error) {
      // If decryption fails, treat as plain text (legacy tokens during migration)
      // Only log this occasionally to avoid spam, and only in development
      if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
        console.warn('⚠️ Token appears to be plain text (legacy format) - consider re-authenticating');
      }
      return token;
    }
  }
  private db = drizzle(sql);
  
  // Tenants (for job scheduling and resolution)
  async getActiveTenants(): Promise<{ id: string; name: string; slug: string }[]> {
    const { withTenant } = await import('./utils/tenantQueries');
    const { tenants } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    return await this.db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug
    })
    .from(tenants)
    .where(eq(tenants.isActive, true));
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const { tenants } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const result = await this.db.select()
      .from(tenants)
      .where(and(
        eq(tenants.slug, slug),
        eq(tenants.isActive, true)
      ))
      .limit(1);
      
    return result[0];
  }

  async getTenantByDomain(domain: string): Promise<Tenant | undefined> {
    const { tenants } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const result = await this.db.select()
      .from(tenants)
      .where(and(
        eq(tenants.domain, domain),
        eq(tenants.isActive, true)
      ))
      .limit(1);
      
    return result[0];
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const { tenants } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const result = await this.db.select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
      
    return result[0];
  }
  
  // Calendar Integrations - Core functionality for Google Calendar
  async getCalendarIntegrations(): Promise<CalendarIntegration[]> {
    return await this.db.select().from(calendarIntegrations);
  }

  async getCalendarIntegrationsByTenant(tenantId: string): Promise<CalendarIntegration[]> {
    // Filter calendar integrations through user relationship to ensure tenant isolation
    const { users, calendarIntegrations } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    return await this.db.select({
      id: calendarIntegrations.id,
      userId: calendarIntegrations.userId,
      provider: calendarIntegrations.provider,
      providerAccountId: calendarIntegrations.providerAccountId,
      calendarId: calendarIntegrations.calendarId,
      calendarName: calendarIntegrations.calendarName,
      accessToken: calendarIntegrations.accessToken,
      refreshToken: calendarIntegrations.refreshToken,
      syncToken: calendarIntegrations.syncToken,
      webhookId: calendarIntegrations.webhookId,
      isActive: calendarIntegrations.isActive,
      syncDirection: calendarIntegrations.syncDirection,
      lastSyncAt: calendarIntegrations.lastSyncAt,
      syncErrors: calendarIntegrations.syncErrors,
      settings: calendarIntegrations.settings,
      createdAt: calendarIntegrations.createdAt,
      updatedAt: calendarIntegrations.updatedAt,
    })
    .from(calendarIntegrations)
    .innerJoin(users, eq(calendarIntegrations.userId, users.id))
    .where(eq(users.tenantId, tenantId));
  }

  async getCalendarIntegrationsByUser(userId: string): Promise<CalendarIntegration[]> {
    const integrations = await db.select().from(calendarIntegrations).where(eq(calendarIntegrations.userId, userId));
    
    // Decrypt tokens for use
    return integrations.map(integration => ({
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    }));
  }

  async getCalendarIntegration(id: string): Promise<CalendarIntegration | undefined> {
    const result = await db.select().from(calendarIntegrations).where(eq(calendarIntegrations.id, id));
    
    if (!result[0]) return undefined;
    
    // Decrypt tokens for use
    const integration = result[0];
    return {
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    };
  }

  async getCalendarIntegrationByEmail(email: string, userId: string): Promise<CalendarIntegration | undefined> {
    const result = await db.select().from(calendarIntegrations)
      .where(and(eq(calendarIntegrations.providerAccountId, email), eq(calendarIntegrations.userId, userId)));
    
    if (!result[0]) return undefined;
    
    // Decrypt tokens for use
    const integration = result[0];
    return {
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    };
  }

  async createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration> {
    // Encrypt sensitive OAuth tokens before storing
    const secureIntegration = {
      ...integration,
      accessToken: integration.accessToken ? secureStore.encrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? secureStore.encrypt(integration.refreshToken) : null,
    };
    
    const result = await db.insert(calendarIntegrations).values(secureIntegration).returning();
    
    // Return with decrypted tokens for immediate use
    const storedIntegration = result[0];
    return {
      ...storedIntegration,
      accessToken: storedIntegration.accessToken ? this.safeDecrypt(storedIntegration.accessToken) : null,
      refreshToken: storedIntegration.refreshToken ? this.safeDecrypt(storedIntegration.refreshToken) : null,
    };
  }

  async updateCalendarIntegration(id: string, updates: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined> {
    // Encrypt sensitive OAuth tokens if they're being updated
    const secureUpdates = { ...updates };
    if (updates.accessToken !== undefined) {
      secureUpdates.accessToken = updates.accessToken ? secureStore.encrypt(updates.accessToken) : null;
    }
    if (updates.refreshToken !== undefined) {
      secureUpdates.refreshToken = updates.refreshToken ? secureStore.encrypt(updates.refreshToken) : null;
    }
    
    const result = await db.update(calendarIntegrations).set(secureUpdates).where(eq(calendarIntegrations.id, id)).returning();
    
    if (!result[0]) return undefined;
    
    // Return with decrypted tokens for immediate use
    const storedIntegration = result[0];
    return {
      ...storedIntegration,
      accessToken: storedIntegration.accessToken ? this.safeDecrypt(storedIntegration.accessToken) : null,
      refreshToken: storedIntegration.refreshToken ? this.safeDecrypt(storedIntegration.refreshToken) : null,
    };
  }

  async deleteCalendarIntegration(id: string): Promise<boolean> {
    const result = await db.delete(calendarIntegrations).where(eq(calendarIntegrations.id, id));
    return result.rowCount > 0;
  }

  // Events - Core functionality for calendar events
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events);
  }

  async getEventsByUser(userId: string): Promise<Event[]> {
    return await db.select().from(events)
      .where(or(eq(events.createdBy, userId), eq(events.assignedTo, userId)));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id));
    return result[0];
  }

  async getEventByExternalId(externalId: string): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.externalEventId, externalId));
    return result[0];
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const result = await db.insert(events).values(event).returning();
    return result[0];
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const result = await db.update(events).set(updates).where(eq(events.id, id)).returning();
    return result[0];
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return result.rowCount > 0;
  }

  // All storage methods now use PostgreSQL database
  // Users - PostgreSQL implementation
  async getUsers() { 
    return await this.db.select().from(users);
  }
  async getUser(id: string) { 
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  async getUserByUsername(username: string, tenantId: string): Promise<User | undefined> { 
    const result = await this.db.select().from(users).where(
      and(
        or(eq(users.username, username), eq(users.email, username)),
        eq(users.tenantId, tenantId)
      )
    );
    return result[0];
  }
  async createUser(user: InsertUser) { 
    const result = await this.db.insert(users).values(user).returning();
    return result[0];
  }
  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await this.db.update(users).set(user).where(eq(users.id, id)).returning();
    return result[0];
  }
  
  async getLeads(userId?: string): Promise<Lead[]> {
    if (userId) {
      return await this.db.select().from(leads)
        .where(eq(leads.userId, userId))
        .orderBy(desc(leads.createdAt));
    }
    return await this.db.select().from(leads).orderBy(desc(leads.createdAt));
  }
  async getLead(id: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(eq(leads.id, id));
    return result[0];
  }
  async createLead(insertLead: InsertLead): Promise<Lead> {
    const result = await db.insert(leads).values({
      ...insertLead,
      status: insertLead.status ?? 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateLead(id: string, leadUpdate: Partial<InsertLead>): Promise<Lead | undefined> {
    const result = await db.update(leads).set({
      ...leadUpdate,
      updatedAt: new Date(),
    }).where(eq(leads.id, id)).returning();
    return result[0];
  }
  async deleteLead(id: string): Promise<boolean> {
    // First delete any lead status history records to avoid foreign key constraint
    await this.db.delete(leadStatusHistory).where(eq(leadStatusHistory.leadId, id));
    
    // Then delete the lead itself
    const result = await this.db.delete(leads).where(eq(leads.id, id));
    return result.rowCount > 0;
  }
  async getLeadsByProject(projectId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.projectId, projectId));
  }
  async getEmailsByContact(contactId: string): Promise<Email[]> {
    return await this.db.select().from(emails).where(eq(emails.contactId, contactId));
  }
  
  // Contacts - Using PostgreSQL
  async getContacts(userId?: string): Promise<Contact[]> {
    if (userId) {
      return await this.db.select().from(contacts)
        .where(eq(contacts.userId, userId))
        .orderBy(desc(contacts.createdAt));
    }
    return await this.db.select().from(contacts).orderBy(desc(contacts.createdAt));
  }
  async getContactById(id: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }
  async getContact(id: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }

  async getContactByEmail(email: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.email, email));
    return result[0];
  }
  async createContact(contact: InsertContact): Promise<Contact> {
    const result = await this.db.insert(contacts).values({
      ...contact,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateContact(id: string, contactUpdate: Partial<InsertContact>): Promise<Contact | undefined> {
    const result = await this.db.update(contacts).set({
      ...contactUpdate,
      updatedAt: new Date(),
    }).where(eq(contacts.id, id)).returning();
    return result[0];
  }
  async deleteContact(id: string): Promise<boolean> {
    const result = await this.db.delete(contacts).where(eq(contacts.id, id));
    return result.rowCount > 0;
  }
  
  // Projects - Using PostgreSQL
  async getProjects(userId?: string): Promise<Project[]> {
    if (userId) {
      return await this.db.select().from(projects)
        .where(or(eq(projects.userId, userId), eq(projects.assignedTo, userId)))
        .orderBy(desc(projects.createdAt));
    }
    return await this.db.select().from(projects).orderBy(desc(projects.createdAt));
  }
  async getProject(id: string): Promise<Project | undefined> {
    const result = await this.db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }
  async getProjectsByContact(contactId: string): Promise<Project[]> {
    return await this.db.select().from(projects).where(eq(projects.contactId, contactId)).orderBy(desc(projects.createdAt));
  }
  async createProject(project: InsertProject): Promise<Project> {
    const result = await this.db.insert(projects).values({
      ...project,
      userId: project.userId,  // Explicitly ensure userId is included
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateProject(id: string, projectUpdate: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await this.db.update(projects).set({
      ...projectUpdate,
      updatedAt: new Date(),
    }).where(eq(projects.id, id)).returning();
    return result[0];
  }
  async deleteProject(id: string): Promise<boolean> {
    try {
      // First, remove project references from related tables to avoid foreign key constraint violations
      await this.db.update(emails).set({ projectId: null }).where(eq(emails.projectId, id));
      await this.db.update(emailThreads).set({ projectId: null }).where(eq(emailThreads.projectId, id));
      await this.db.update(leads).set({ projectId: null }).where(eq(leads.projectId, id));
      await this.db.update(messageThreads).set({ projectId: null }).where(eq(messageThreads.projectId, id));
      
      // Delete contracts entirely since they're project-specific
      await this.db.delete(contracts).where(eq(contracts.projectId, id));
      
      // Finally delete the project itself
      const result = await this.db.delete(projects).where(eq(projects.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }
  
  // Quotes - PostgreSQL implementation
  async getQuotes() { 
    return await this.db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }
  async getQuote(id: string) { 
    const result = await this.db.select().from(quotes).where(eq(quotes.id, id));
    return result[0];
  }
  async getQuotesByClient(clientId: string) { 
    return await this.db.select().from(quotes).where(eq(quotes.contactId, clientId));
  }
  async createQuote(quote: InsertQuote) { 
    const result = await this.db.insert(quotes).values({
      ...quote,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateQuote(id: string, quote: Partial<InsertQuote>) { 
    const result = await this.db.update(quotes).set({
      ...quote,
      updatedAt: new Date(),
    }).where(eq(quotes.id, id)).returning();
    return result[0];
  }
  async deleteQuote(id: string) { 
    const result = await this.db.delete(quotes).where(eq(quotes.id, id));
    return result.rowCount > 0;
  }
  async getQuotesByProject(projectId: string) { 
    return await this.db.select().from(quotes).where(eq(quotes.leadId, projectId));
  }
  async getQuotesByContact(contactId: string) { 
    return await this.db.select().from(quotes).where(eq(quotes.contactId, contactId));
  }
  
  // Contracts - PostgreSQL implementation  
  async getContracts() { 
    return await this.db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }
  async getContract(id: string) { 
    const result = await this.db.select().from(contracts).where(eq(contracts.id, id));
    return result[0];
  }
  async getContractsByClient(clientId: string) { 
    return await this.db.select().from(contracts).where(eq(contracts.contactId, clientId));
  }
  async createContract(contract: InsertContract) { 
    const result = await this.db.insert(contracts).values({
      ...contract,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateContract(id: string, contract: Partial<InsertContract>) { 
    const result = await this.db.update(contracts).set({
      ...contract,
      updatedAt: new Date(),
    }).where(eq(contracts.id, id)).returning();
    return result[0];
  }
  async deleteContract(id: string) { 
    const result = await this.db.delete(contracts).where(eq(contracts.id, id));
    return result.rowCount > 0;
  }
  async getContractsByProject(projectId: string) { 
    return await this.db.select().from(contracts).where(eq(contracts.projectId, projectId));
  }
  
  // Invoices - PostgreSQL implementation
  async getInvoices() { 
    return await this.db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }
  async getInvoice(id: string) { 
    const result = await this.db.select().from(invoices).where(eq(invoices.id, id));
    return result[0];
  }
  async getInvoicesByClient(clientId: string) { 
    return await this.db.select().from(invoices).where(eq(invoices.contactId, clientId));
  }
  async createInvoice(invoice: InsertInvoice) { 
    const result = await this.db.insert(invoices).values({
      ...invoice,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateInvoice(id: string, invoice: Partial<InsertInvoice>) { 
    const result = await this.db.update(invoices).set({
      ...invoice,
      updatedAt: new Date(),
    }).where(eq(invoices.id, id)).returning();
    return result[0];
  }
  async deleteInvoice(id: string) { 
    const result = await this.db.delete(invoices).where(eq(invoices.id, id));
    return result.rowCount > 0;
  }
  async getInvoicesByProject(projectId: string) { 
    return await this.db.select().from(invoices).where(eq(invoices.projectId, projectId));
  }
  async getInvoiceById(id: string): Promise<Invoice | undefined> {
    const result = await this.db.select().from(invoices).where(eq(invoices.id, id));
    return result[0];
  }
  async getInvoicesByContactId(contactId: string): Promise<Invoice[]> {
    return await this.db.select().from(invoices).where(eq(invoices.contactId, contactId));
  }
  
  // Tasks - PostgreSQL implementation
  async getTasks(userId?: string, tenantId?: string): Promise<Task[]> { 
    const { withTenant, withTenantAnd } = await import('./utils/tenantQueries');
    
    try {
      let whereCondition;
      
      if (tenantId && userId) {
        // Filter by both tenant and user
        whereCondition = withTenantAnd(
          tasks.tenantId, 
          tenantId, 
          or(eq(tasks.assignedTo, userId), eq(tasks.createdBy, userId))
        );
      } else if (tenantId) {
        // Filter by tenant only
        whereCondition = withTenant(tasks.tenantId, tenantId);
      } else if (userId) {
        // Filter by user only (legacy mode)
        whereCondition = or(eq(tasks.assignedTo, userId), eq(tasks.createdBy, userId));
      } else {
        // SECURITY: In production multitenant mode, require tenantId for data isolation
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SECURITY: tenantId required for data isolation in production');
        }
        // Development fallback only - avoid in production
        console.warn('⚠️  SECURITY: getTasks called without tenant filtering - development mode only');
        return await this.db.select().from(tasks).orderBy(desc(tasks.createdAt));
      }
      
      return await this.db.select().from(tasks)
        .where(whereCondition)
        .orderBy(desc(tasks.createdAt));
    } catch (error: any) {
      // If any column doesn't exist, fallback to all tasks
      if (error.code === '42703') { // column does not exist
        console.warn('Column not found in tasks table, returning all tasks without filtering');
        return await this.db.select().from(tasks).orderBy(desc(tasks.createdAt));
      }
      throw error;
    }
  }
  async getTask(id: string, tenantId?: string) { 
    const { withTenantAnd } = await import('./utils/tenantQueries');
    
    // Build tenant-aware where condition
    const whereCondition = tenantId 
      ? withTenantAnd(tasks.tenantId, tenantId, eq(tasks.id, id))
      : eq(tasks.id, id);
    
    const result = await this.db.select().from(tasks).where(whereCondition);
    return result[0];
  }
  async getTasksByClient(clientId: string) { 
    return await this.db.select().from(tasks).where(eq(tasks.contactId, clientId));
  }
  async getTasksByProject(projectId: string) { 
    return await this.db.select().from(tasks).where(eq(tasks.projectId, projectId));
  }
  async getTasksByUser(userId: string) { 
    return await this.db.select().from(tasks).where(eq(tasks.assignedTo, userId));
  }
  async createTask(task: InsertTask) { 
    const result = await this.db.insert(tasks).values({
      ...task,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateTask(id: string, task: Partial<InsertTask>, tenantId?: string) { 
    const { withTenantAnd } = await import('./utils/tenantQueries');
    
    // Build tenant-aware where condition
    const whereCondition = tenantId 
      ? withTenantAnd(tasks.tenantId, tenantId, eq(tasks.id, id))
      : eq(tasks.id, id);
    
    const result = await this.db.update(tasks).set({
      ...task,
      updatedAt: new Date(),
    }).where(whereCondition).returning();
    
    // Return undefined if no rows were updated (task not found or wrong tenant)
    return result[0] || undefined;
  }
  async deleteTask(id: string, tenantId?: string) { 
    const { withTenantAnd } = await import('./utils/tenantQueries');
    
    // Build tenant-aware where condition
    const whereCondition = tenantId 
      ? withTenantAnd(tasks.tenantId, tenantId, eq(tasks.id, id))
      : eq(tasks.id, id);
    
    const result = await this.db.delete(tasks).where(whereCondition);
    return result.rowCount > 0;
  }
  
  // Emails - PostgreSQL implementation
  async getEmails() { 
    return await this.db.select().from(emails).orderBy(desc(emails.createdAt));
  }
  async getEmail(id: string) { 
    const result = await this.db.select().from(emails).where(eq(emails.id, id));
    return result[0];
  }
  async getEmailsByClient(clientId: string) { 
    return await this.db.select().from(emails).where(eq(emails.contactId, clientId));
  }
  async getEmailsByProject(projectId: string) { 
    return await this.db.select().from(emails).where(eq(emails.projectId, projectId));
  }
  async createEmail(email: InsertEmail) { 
    const result = await this.db.insert(emails).values({
      ...email,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateEmail(id: string, email: Partial<InsertEmail>) { 
    const result = await this.db.update(emails).set(email).where(eq(emails.id, id)).returning();
    return result[0];
  }
  async deleteEmail(id: string) { 
    const result = await this.db.delete(emails).where(eq(emails.id, id));
    return result.rowCount > 0;
  }
  
  // Activities - PostgreSQL implementation
  async getActivities() { 
    return await this.db.select().from(activities).orderBy(desc(activities.createdAt));
  }
  async getActivity(id: string) { 
    const result = await this.db.select().from(activities).where(eq(activities.id, id));
    return result[0];
  }
  async getActivitiesByClient(clientId: string) { 
    return await this.db.select().from(activities).where(eq(activities.contactId, clientId));
  }
  async getActivitiesByProject(projectId: string) { 
    return await this.db.select().from(activities).where(eq(activities.projectId, projectId));
  }
  async createActivity(activity: InsertActivity) { 
    const result = await this.db.insert(activities).values(activity).returning();
    return result[0];
  }
  async updateActivity(id: string, activity: Partial<InsertActivity>) { 
    const result = await this.db.update(activities).set(activity).where(eq(activities.id, id)).returning();
    return result[0];
  }
  async deleteActivity(id: string) { 
    const result = await this.db.delete(activities).where(eq(activities.id, id));
    return result.rowCount > 0;
  }
  
  // Automations - PostgreSQL implementation
  async getAutomations(): Promise<Automation[]> {
    return await this.db.select().from(automations);
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    const result = await this.db.select().from(automations).where(eq(automations.id, id));
    return result[0];
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    const result = await this.db.insert(automations).values(automation).returning();
    return result[0];
  }

  async updateAutomation(id: string, automation: Partial<InsertAutomation>): Promise<Automation | undefined> {
    const result = await this.db.update(automations).set(automation).where(eq(automations.id, id)).returning();
    return result[0];
  }

  async deleteAutomation(id: string): Promise<boolean> {
    const result = await this.db.delete(automations).where(eq(automations.id, id));
    return result.rowCount > 0;
  }
  
  // Members - PostgreSQL implementation
  async getMembers(): Promise<Member[]> {
    return await this.db.select().from(members);
  }

  async getMember(id: string): Promise<Member | undefined> {
    const result = await this.db.select().from(members).where(eq(members.id, id));
    return result[0];
  }

  async createMember(member: InsertMember): Promise<Member> {
    const result = await this.db.insert(members).values(member).returning();
    return result[0];
  }

  async updateMember(id: string, member: Partial<InsertMember>): Promise<Member | undefined> {
    const result = await this.db.update(members).set(member).where(eq(members.id, id)).returning();
    return result[0];
  }

  async deleteMember(id: string): Promise<boolean> {
    const result = await this.db.delete(members).where(eq(members.id, id));
    return result.rowCount > 0;
  }
  
  // Venues - PostgreSQL implementation
  async getVenues(): Promise<Venue[]> {
    return await this.db.select().from(venues);
  }

  async getVenue(id: string): Promise<Venue | undefined> {
    const result = await this.db.select().from(venues).where(eq(venues.id, id));
    return result[0];
  }

  async createVenue(venue: InsertVenue): Promise<Venue> {
    const result = await this.db.insert(venues).values(venue).returning();
    return result[0];
  }

  async updateVenue(id: string, venue: Partial<InsertVenue>): Promise<Venue | undefined> {
    const result = await this.db.update(venues).set(venue).where(eq(venues.id, id)).returning();
    return result[0];
  }

  async deleteVenue(id: string): Promise<boolean> {
    const result = await this.db.delete(venues).where(eq(venues.id, id));
    return result.rowCount > 0;
  }
  
  // Project Members - PostgreSQL implementation
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return await this.db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
  }

  async addProjectMember(projectMember: InsertProjectMember): Promise<ProjectMember> {
    const result = await this.db.insert(projectMembers).values(projectMember).returning();
    return result[0];
  }

  async removeProjectMember(projectId: string, memberId: string): Promise<boolean> {
    const result = await this.db.delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.memberId, memberId)));
    return result.rowCount > 0;
  }

  async updateProjectMemberRole(projectId: string, memberId: string, role: string): Promise<ProjectMember | undefined> {
    const result = await this.db.update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.memberId, memberId)))
      .returning();
    return result[0];
  }
  
  // Member Availability - PostgreSQL implementation
  async getMemberAvailability(memberId: string): Promise<MemberAvailability[]> {
    return await this.db.select().from(memberAvailability).where(eq(memberAvailability.memberId, memberId));
  }

  async addMemberAvailability(availability: InsertMemberAvailability): Promise<MemberAvailability> {
    const result = await this.db.insert(memberAvailability).values(availability).returning();
    return result[0];
  }

  async updateMemberAvailability(id: string, availability: Partial<InsertMemberAvailability>): Promise<MemberAvailability | undefined> {
    const result = await this.db.update(memberAvailability).set(availability).where(eq(memberAvailability.id, id)).returning();
    return result[0];
  }

  async deleteMemberAvailability(id: string): Promise<boolean> {
    const result = await this.db.delete(memberAvailability).where(eq(memberAvailability.id, id));
    return result.rowCount > 0;
  }
  
  // Project Files - PostgreSQL implementation
  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return await this.db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId));
  }

  async addProjectFile(file: InsertProjectFile): Promise<ProjectFile> {
    const result = await this.db.insert(projectFiles).values(file).returning();
    return result[0];
  }

  async deleteProjectFile(id: string): Promise<boolean> {
    const result = await this.db.delete(projectFiles).where(eq(projectFiles.id, id));
    return result.rowCount > 0;
  }
  
  // Project Notes - PostgreSQL implementation
  async getProjectNotes(projectId: string): Promise<ProjectNote[]> {
    return await this.db.select().from(projectNotes).where(eq(projectNotes.projectId, projectId));
  }

  async addProjectNote(note: InsertProjectNote): Promise<ProjectNote> {
    const result = await this.db.insert(projectNotes).values(note).returning();
    return result[0];
  }

  async updateProjectNote(id: string, note: Partial<InsertProjectNote>): Promise<ProjectNote | undefined> {
    const result = await this.db.update(projectNotes).set(note).where(eq(projectNotes.id, id)).returning();
    return result[0];
  }

  async deleteProjectNote(id: string): Promise<boolean> {
    const result = await this.db.delete(projectNotes).where(eq(projectNotes.id, id));
    return result.rowCount > 0;
  }
  
  // SMS Messages - PostgreSQL implementation
  async getSmsMessages() { 
    return await this.db.select().from(smsMessages).orderBy(desc(smsMessages.createdAt));
  }
  async getSmsMessage(id: string) { 
    const result = await this.db.select().from(smsMessages).where(eq(smsMessages.id, id));
    return result[0];
  }
  async createSmsMessage(message: InsertSmsMessage) { 
    const result = await this.db.insert(smsMessages).values({
      ...message,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateSmsMessage(id: string, message: Partial<InsertSmsMessage>) { 
    const result = await this.db.update(smsMessages).set(message).where(eq(smsMessages.id, id)).returning();
    return result[0];
  }
  async deleteSmsMessage(id: string) { 
    const result = await this.db.delete(smsMessages).where(eq(smsMessages.id, id));
    return result.rowCount > 0;
  }
  
  // Message Templates - PostgreSQL implementation
  async getMessageTemplates(): Promise<MessageTemplate[]> {
    return await this.db.select().from(messageTemplates);
  }

  async getMessageTemplate(id: string): Promise<MessageTemplate | undefined> {
    const result = await this.db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
    return result[0];
  }

  async createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate> {
    const result = await this.db.insert(messageTemplates).values(template).returning();
    return result[0];
  }

  async updateMessageTemplate(id: string, template: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined> {
    const result = await this.db.update(messageTemplates).set(template).where(eq(messageTemplates.id, id)).returning();
    return result[0];
  }

  async deleteMessageTemplate(id: string): Promise<boolean> {
    const result = await this.db.delete(messageTemplates).where(eq(messageTemplates.id, id));
    return result.rowCount > 0;
  }
  
  // Message Threads - PostgreSQL implementation
  async getMessageThreads() { 
    return await this.db.select().from(messageThreads).orderBy(desc(messageThreads.createdAt));
  }
  async getMessageThread(id: string) { 
    const result = await this.db.select().from(messageThreads).where(eq(messageThreads.id, id));
    return result[0];
  }
  async createMessageThread(thread: InsertMessageThread) { 
    const result = await this.db.insert(messageThreads).values({
      ...thread,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateMessageThread(id: string, thread: Partial<InsertMessageThread>) { 
    const result = await this.db.update(messageThreads).set(thread).where(eq(messageThreads.id, id)).returning();
    return result[0];
  }
  async deleteMessageThread(id: string) { 
    const result = await this.db.delete(messageThreads).where(eq(messageThreads.id, id));
    return result.rowCount > 0;
  }
  
  // Events filtering methods - PostgreSQL implementation
  async getEventsByClient(clientId: string) { 
    return await this.db.select().from(events).where(eq(events.contactId, clientId));
  }
  async getEventsByIntegration(integrationId: string) { 
    return await this.db.select().from(events).where(eq(events.calendarIntegrationId, integrationId));
  }
  async getEventsByProject(projectId: string) { 
    return await this.db.select().from(events).where(eq(events.projectId, projectId));
  }
  
  // Calendar Sync Logs - PostgreSQL implementation
  async getCalendarSyncLogs() { 
    return await this.db.select().from(calendarSyncLog).orderBy(desc(calendarSyncLog.createdAt));
  }
  async getCalendarSyncLog(id: string) { 
    const result = await this.db.select().from(calendarSyncLog).where(eq(calendarSyncLog.id, id));
    return result[0];
  }
  async createCalendarSyncLog(log: InsertCalendarSyncLog) { 
    const result = await this.db.insert(calendarSyncLog).values({
      ...log,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateCalendarSyncLog(id: string, log: Partial<InsertCalendarSyncLog>) { 
    const result = await this.db.update(calendarSyncLog).set(log).where(eq(calendarSyncLog.id, id)).returning();
    return result[0];
  }
  
  // Dashboard Metrics - PostgreSQL implementation
  async getDashboardMetrics(userId?: string): Promise<{
    totalLeads: number;
    activeProjects: number;
    revenue: number;
    pendingInvoices: number;
  }> { 
    // Calculate metrics from PostgreSQL data
    const leads = await this.getLeads(userId);
    const projects = await this.getProjects(userId);
    const invoices = await this.getInvoices();
    
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').length;
    
    const revenue = paidInvoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.total || '0');
    }, 0);

    return {
      totalLeads: leads.length,
      activeProjects,
      revenue,
      pendingInvoices,
    };
  }
  
  // Missing methods for API compatibility
  async getRecentActivities(limit: number) { 
    const activities = await this.getActivities();
    return activities.slice(0, limit);
  }
  async getTodayTasks() { return []; }
  async getTasksByAssignee(userId: string, tenantId?: string): Promise<Task[]> { 
    const { withTenantAnd } = await import('./utils/tenantQueries');
    
    // SECURITY: In production multitenant mode, require tenantId for data isolation
    if (!tenantId && process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY: tenantId required for getTasksByAssignee in production');
    }
    
    // Build tenant-aware where condition
    const whereCondition = tenantId 
      ? withTenantAnd(tasks.tenantId, tenantId, eq(tasks.assignedTo, userId))
      : eq(tasks.assignedTo, userId);
    
    return await this.db.select().from(tasks).where(whereCondition);
  }
  async getEmailsByThread(threadId: string) { return []; }
  async getSmsMessagesByThread(threadId: string) { return []; }
  async getSmsMessagesByClient(clientId: string) { return []; }
  async getSmsMessagesByPhone(phone: string) { return []; }
  async getMessageTemplatesByType(type: string) { return []; }
  async getMessageThreadsByClient(clientId: string) { return []; }
  async validateUser(username: string, password: string): Promise<User | undefined> { 
    const result = await this.db.select().from(users).where(and(
      eq(users.username, username),
      eq(users.password, password) // Note: In production, use proper password hashing
    ));
    return result[0];
  }
  async setMemberAvailability(availability: InsertMemberAvailability): Promise<MemberAvailability> {
    const result = await this.db.insert(memberAvailability).values(availability).returning();
    return result[0];
  }
  async getEventsByDateRange(startDate: Date, endDate: Date) { return []; }

  // Templates
  // Templates - PostgreSQL implementation
  async getTemplates(): Promise<Template[]> {
    return await this.db.select().from(templates);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const result = await this.db.select().from(templates).where(eq(templates.id, id));
    return result[0];
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const result = await this.db.insert(templates).values(template).returning();
    return result[0];
  }

  async updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template | undefined> {
    const result = await this.db.update(templates).set(template).where(eq(templates.id, id)).returning();
    return result[0];
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await this.db.delete(templates).where(eq(templates.id, id));
    return result.rowCount > 0;
  }

  // Email Signatures - PostgreSQL implementation
  async getUserSignatures(userId: string): Promise<EmailSignature[]> {
    return await this.db.select().from(emailSignatures)
      .where(and(eq(emailSignatures.userId, userId), eq(emailSignatures.isActive, true)))
      .orderBy(desc(emailSignatures.updatedAt));
  }

  async getSignature(id: string, userId: string): Promise<EmailSignature | null> {
    const result = await this.db.select().from(emailSignatures)
      .where(and(eq(emailSignatures.id, id), eq(emailSignatures.userId, userId)));
    return result[0] || null;
  }

  async getDefaultSignature(userId: string): Promise<EmailSignature | null> {
    const result = await this.db.select().from(emailSignatures)
      .where(and(
        eq(emailSignatures.userId, userId), 
        eq(emailSignatures.isDefault, true), 
        eq(emailSignatures.isActive, true)
      ));
    return result[0] || null;
  }

  async createSignature(signature: InsertEmailSignature): Promise<EmailSignature> {
    const result = await this.db.insert(emailSignatures).values(signature).returning();
    return result[0];
  }

  async updateSignature(id: string, userId: string, signature: Partial<InsertEmailSignature>): Promise<EmailSignature | null> {
    const result = await this.db.update(emailSignatures)
      .set(signature)
      .where(and(eq(emailSignatures.id, id), eq(emailSignatures.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteSignature(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(emailSignatures)
      .where(and(eq(emailSignatures.id, id), eq(emailSignatures.userId, userId)));
    return result.rowCount > 0;
  }

  async clearDefaultSignatures(userId: string): Promise<void> {
    await this.db.update(emailSignatures)
      .set({ isDefault: false })
      .where(and(eq(emailSignatures.userId, userId), eq(emailSignatures.isDefault, true)));
  }

  // Lead Capture Forms - PostgreSQL implementation
  async getLeadCaptureForms(): Promise<LeadCaptureForm[]> {
    return await this.db.select().from(leadCaptureForms).orderBy(desc(leadCaptureForms.updatedAt));
  }

  async getLeadCaptureForm(id: string): Promise<LeadCaptureForm | undefined> {
    const result = await this.db.select().from(leadCaptureForms).where(eq(leadCaptureForms.id, id));
    return result[0];
  }

  async getLeadCaptureFormBySlug(slug: string): Promise<LeadCaptureForm | undefined> {
    const result = await this.db.select().from(leadCaptureForms).where(eq(leadCaptureForms.slug, slug));
    return result[0];
  }

  async createLeadCaptureForm(insertForm: InsertLeadCaptureForm): Promise<LeadCaptureForm> {
    const result = await this.db.insert(leadCaptureForms).values({
      ...insertForm,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateLeadCaptureForm(id: string, updateData: Partial<InsertLeadCaptureForm>): Promise<LeadCaptureForm | undefined> {
    const result = await this.db.update(leadCaptureForms).set({
      ...updateData,
      updatedAt: new Date(),
    }).where(eq(leadCaptureForms.id, id)).returning();
    return result[0];
  }

  async deleteLeadCaptureForm(id: string): Promise<boolean> {
    const result = await this.db.delete(leadCaptureForms).where(eq(leadCaptureForms.id, id));
    return result.rowCount > 0;
  }

  // Portal Forms - PostgreSQL implementation
  async getPortalFormsByContact(contactId: string): Promise<PortalForm[]> {
    return await this.db.select().from(portalForms)
      .where(eq(portalForms.contactId, contactId))
      .orderBy(desc(portalForms.createdAt));
  }

  async getPortalFormsByProjectAndContact(projectId: string, contactId: string): Promise<PortalForm[]> {
    return await this.db.select().from(portalForms)
      .where(and(eq(portalForms.projectId, projectId), eq(portalForms.contactId, contactId)))
      .orderBy(desc(portalForms.createdAt));
  }

  async getPortalFormById(id: string): Promise<PortalForm | undefined> {
    const result = await this.db.select().from(portalForms).where(eq(portalForms.id, id));
    return result[0];
  }

  async createPortalForm(form: InsertPortalForm): Promise<PortalForm> {
    const result = await this.db.insert(portalForms).values({
      ...form,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updatePortalForm(id: string, form: Partial<InsertPortalForm>): Promise<PortalForm | undefined> {
    const result = await this.db.update(portalForms).set({
      ...form,
      updatedAt: new Date(),
    }).where(eq(portalForms.id, id)).returning();
    return result[0];
  }

  async deletePortalForm(id: string): Promise<boolean> {
    const result = await this.db.delete(portalForms).where(eq(portalForms.id, id));
    return result.rowCount > 0;
  }

  // Payment Sessions - PostgreSQL implementation
  async getPaymentSessionsByContactId(contactId: string): Promise<PaymentSession[]> {
    return await this.db.select().from(paymentSessions)
      .where(eq(paymentSessions.contactId, contactId))
      .orderBy(desc(paymentSessions.createdAt));
  }

  async getPaymentSessionById(id: string): Promise<PaymentSession | undefined> {
    const result = await this.db.select().from(paymentSessions).where(eq(paymentSessions.id, id));
    return result[0];
  }

  async createPaymentSession(session: InsertPaymentSession): Promise<PaymentSession> {
    const result = await this.db.insert(paymentSessions).values({
      ...session,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updatePaymentSession(sessionId: string, session: Partial<InsertPaymentSession>): Promise<PaymentSession | undefined> {
    const result = await this.db.update(paymentSessions).set({
      ...session,
      updatedAt: new Date(),
    }).where(eq(paymentSessions.sessionId, sessionId)).returning();
    return result[0];
  }

  // Webhook Events - PostgreSQL implementation
  async getWebhookEventByProviderAndEventId(provider: string, eventId: string): Promise<WebhookEvent | undefined> {
    const result = await this.db.select().from(webhookEvents)
      .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)));
    return result[0];
  }

  async createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent> {
    const result = await this.db.insert(webhookEvents).values({
      ...event,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateWebhookEvent(eventId: string, event: Partial<InsertWebhookEvent>): Promise<WebhookEvent | undefined> {
    const result = await this.db.update(webhookEvents).set(event)
      .where(eq(webhookEvents.eventId, eventId)).returning();
    return result[0];
  }

  // Additional invoice methods for portal
  async getInvoiceById(id: string): Promise<Invoice | undefined> {
    const result = await this.db.select().from(invoices).where(eq(invoices.id, id));
    return result[0];
  }

  async getInvoicesByContactId(contactId: string): Promise<Invoice[]> {
    return await this.db.select().from(invoices)
      .where(eq(invoices.contactId, contactId))
      .orderBy(desc(invoices.createdAt));
  }

  // Additional contact methods for portal
  async getContactById(id: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }

  // Additional event methods for appointment booking
  async getEventById(id: string): Promise<Event | undefined> {
    const result = await this.db.select().from(events).where(eq(events.id, id));
    return result[0];
  }

  async getEventsByContactEmail(email: string): Promise<Event[]> {
    return await this.db.select().from(events)
      .where(or(
        eq(events.attendees, [email]) // This may need adjustment based on how attendees are stored
      ))
      .orderBy(desc(events.startDate));
  }

  // Enhanced Quotes System - PostgreSQL implementation
  // Quote Packages
  async getQuotePackages(): Promise<QuotePackage[]> {
    return await this.db.select().from(quotePackages)
      .where(eq(quotePackages.isActive, true))
      .orderBy(quotePackages.sortOrder);
  }

  async getQuotePackage(id: string): Promise<QuotePackage | undefined> {
    const result = await this.db.select().from(quotePackages).where(eq(quotePackages.id, id));
    return result[0];
  }

  async createQuotePackage(pkg: InsertQuotePackage): Promise<QuotePackage> {
    const result = await this.db.insert(quotePackages).values({
      ...pkg,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateQuotePackage(id: string, pkg: Partial<InsertQuotePackage>): Promise<QuotePackage | undefined> {
    const result = await this.db.update(quotePackages).set({
      ...pkg,
      updatedAt: new Date(),
    }).where(eq(quotePackages.id, id)).returning();
    return result[0];
  }

  async deleteQuotePackage(id: string): Promise<boolean> {
    const result = await this.db.update(quotePackages).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(quotePackages.id, id));
    return result.rowCount > 0;
  }

  // Quote Add-ons
  async getQuoteAddons(): Promise<QuoteAddon[]> {
    return await this.db.select().from(quoteAddons)
      .where(eq(quoteAddons.isActive, true))
      .orderBy(quoteAddons.sortOrder);
  }

  async getQuoteAddon(id: string): Promise<QuoteAddon | undefined> {
    const result = await this.db.select().from(quoteAddons).where(eq(quoteAddons.id, id));
    return result[0];
  }

  async createQuoteAddon(addon: InsertQuoteAddon): Promise<QuoteAddon> {
    const result = await this.db.insert(quoteAddons).values({
      ...addon,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateQuoteAddon(id: string, addon: Partial<InsertQuoteAddon>): Promise<QuoteAddon | undefined> {
    const result = await this.db.update(quoteAddons).set({
      ...addon,
      updatedAt: new Date(),
    }).where(eq(quoteAddons.id, id)).returning();
    return result[0];
  }

  async deleteQuoteAddon(id: string): Promise<boolean> {
    const result = await this.db.update(quoteAddons).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(quoteAddons.id, id));
    return result.rowCount > 0;
  }

  // Quote Items (line items for quotes)
  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return await this.db.select().from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId))
      .orderBy(quoteItems.createdAt);
  }

  async createQuoteItem(item: InsertQuoteItem): Promise<QuoteItem> {
    const result = await this.db.insert(quoteItems).values({
      ...item,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateQuoteItem(id: string, item: Partial<InsertQuoteItem>): Promise<QuoteItem | undefined> {
    const result = await this.db.update(quoteItems).set(item).where(eq(quoteItems.id, id)).returning();
    return result[0];
  }

  async deleteQuoteItem(id: string): Promise<boolean> {
    const result = await this.db.delete(quoteItems).where(eq(quoteItems.id, id));
    return result.rowCount > 0;
  }

  // Quote Tokens (for public access)
  async getQuoteByToken(token: string, tenantId: string): Promise<{ quote: Quote; items: QuoteItem[]; packages: QuotePackage[]; addons: QuoteAddon[] } | undefined> {
    // First, get the token and verify it's active, not expired, and belongs to the correct tenant
    const tokenResult = await this.db.select().from(quoteTokens)
      .where(and(
        eq(quoteTokens.token, token),
        eq(quoteTokens.tenantId, tenantId),
        eq(quoteTokens.isActive, true)
      ));
    
    if (!tokenResult[0]) return undefined;
    
    const tokenData = tokenResult[0];
    
    // Check if token is expired
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      return undefined;
    }
    
    // Get the quote (with tenant validation)
    const quoteResult = await this.db.select().from(quotes)
      .where(and(
        eq(quotes.id, tokenData.quoteId),
        eq(quotes.tenantId, tenantId)
      ));
    if (!quoteResult[0]) return undefined;
    
    const quote = quoteResult[0];
    
    // Get quote items, packages, and addons (with tenant filtering)
    const [items, packages, addons] = await Promise.all([
      this.getQuoteItems(quote.id, tenantId),
      this.getQuotePackages(tenantId),
      this.getQuoteAddons(tenantId)
    ]);
    
    return { quote, items, packages, addons };
  }

  async createQuoteToken(quoteId: string, tenantId: string, expiresAt?: Date): Promise<QuoteToken> {
    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const result = await this.db.insert(quoteTokens).values({
      quoteId,
      token,
      tenantId,
      expiresAt,
      isActive: true,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async getQuoteToken(token: string, tenantId: string): Promise<QuoteToken | undefined> {
    const result = await this.db.select().from(quoteTokens)
      .where(and(
        eq(quoteTokens.token, token),
        eq(quoteTokens.tenantId, tenantId)
      ));
    return result[0];
  }

  async deactivateQuoteToken(token: string, tenantId: string): Promise<boolean> {
    const result = await this.db.update(quoteTokens).set({
      isActive: false,
    }).where(and(
      eq(quoteTokens.token, token),
      eq(quoteTokens.tenantId, tenantId)
    ));
    return result.rowCount > 0;
  }

  // Quote Signatures
  async getQuoteSignatures(quoteId: string, tenantId: string): Promise<QuoteSignature[]> {
    return await this.db.select().from(quoteSignatures)
      .where(and(
        eq(quoteSignatures.quoteId, quoteId),
        eq(quoteSignatures.tenantId, tenantId)
      ))
      .orderBy(desc(quoteSignatures.signedAt));
  }

  async createQuoteSignature(signature: InsertQuoteSignature, tenantId: string): Promise<QuoteSignature> {
    const result = await this.db.insert(quoteSignatures).values({
      ...signature,
      tenantId,
      signedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getQuoteSignature(quoteId: string, tenantId: string): Promise<QuoteSignature | undefined> {
    const result = await this.db.select().from(quoteSignatures)
      .where(and(
        eq(quoteSignatures.quoteId, quoteId),
        eq(quoteSignatures.tenantId, tenantId)
      ))
      .orderBy(desc(quoteSignatures.signedAt));
    return result[0];
  }

  // Quote Extra Info System Implementation
  
  // Extra Info Fields (standard + custom field definitions)
  async getQuoteExtraInfoFields(userId?: string): Promise<QuoteExtraInfoField[]> {
    if (userId) {
      return await this.db.select().from(quoteExtraInfoFields)
        .where(or(
          eq(quoteExtraInfoFields.userId, userId),
          and(eq(quoteExtraInfoFields.isStandard, true), isNull(quoteExtraInfoFields.userId))
        ))
        .orderBy(quoteExtraInfoFields.displayOrder, quoteExtraInfoFields.createdAt);
    }
    // Return only standard fields if no userId provided
    return await this.db.select().from(quoteExtraInfoFields)
      .where(and(eq(quoteExtraInfoFields.isStandard, true), isNull(quoteExtraInfoFields.userId)))
      .orderBy(quoteExtraInfoFields.displayOrder);
  }

  async getQuoteExtraInfoField(id: string): Promise<QuoteExtraInfoField | undefined> {
    const result = await this.db.select().from(quoteExtraInfoFields).where(eq(quoteExtraInfoFields.id, id));
    return result[0];
  }

  async getQuoteExtraInfoFieldByKey(key: string, userId?: string): Promise<QuoteExtraInfoField | undefined> {
    if (userId) {
      const result = await this.db.select().from(quoteExtraInfoFields)
        .where(and(
          eq(quoteExtraInfoFields.key, key),
          or(
            eq(quoteExtraInfoFields.userId, userId),
            and(eq(quoteExtraInfoFields.isStandard, true), isNull(quoteExtraInfoFields.userId))
          )
        ));
      return result[0];
    }
    // Return only standard fields if no userId provided
    const result = await this.db.select().from(quoteExtraInfoFields)
      .where(and(
        eq(quoteExtraInfoFields.key, key),
        and(eq(quoteExtraInfoFields.isStandard, true), isNull(quoteExtraInfoFields.userId))
      ));
    return result[0];
  }

  async createQuoteExtraInfoField(field: InsertQuoteExtraInfoField): Promise<QuoteExtraInfoField> {
    const result = await this.db.insert(quoteExtraInfoFields).values({
      ...field,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateQuoteExtraInfoField(id: string, field: Partial<InsertQuoteExtraInfoField>): Promise<QuoteExtraInfoField | undefined> {
    const result = await this.db.update(quoteExtraInfoFields).set({
      ...field,
      updatedAt: new Date(),
    }).where(eq(quoteExtraInfoFields.id, id)).returning();
    return result[0];
  }

  async deleteQuoteExtraInfoField(id: string): Promise<boolean> {
    const result = await this.db.delete(quoteExtraInfoFields).where(eq(quoteExtraInfoFields.id, id));
    return result.rowCount > 0;
  }

  // Extra Info Configuration (per-quote settings)
  async getQuoteExtraInfoConfig(quoteId: string, tenantId: string): Promise<QuoteExtraInfoConfig | undefined> {
    const result = await this.db.select().from(quoteExtraInfoConfig)
      .where(and(
        eq(quoteExtraInfoConfig.quoteId, quoteId),
        eq(quoteExtraInfoConfig.tenantId, tenantId)
      ));
    return result[0];
  }

  async createQuoteExtraInfoConfig(config: InsertQuoteExtraInfoConfig, tenantId: string): Promise<QuoteExtraInfoConfig> {
    const result = await this.db.insert(quoteExtraInfoConfig).values({
      ...config,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateQuoteExtraInfoConfig(quoteId: string, config: Partial<InsertQuoteExtraInfoConfig>, tenantId: string): Promise<QuoteExtraInfoConfig | undefined> {
    const result = await this.db.update(quoteExtraInfoConfig).set({
      ...config,
      updatedAt: new Date(),
    }).where(and(
      eq(quoteExtraInfoConfig.quoteId, quoteId),
      eq(quoteExtraInfoConfig.tenantId, tenantId)
    )).returning();
    return result[0];
  }

  async deleteQuoteExtraInfoConfig(quoteId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(quoteExtraInfoConfig)
      .where(and(
        eq(quoteExtraInfoConfig.quoteId, quoteId),
        eq(quoteExtraInfoConfig.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }

  // Extra Info Responses (user-submitted values)
  async getQuoteExtraInfoResponses(quoteId: string, tenantId: string): Promise<QuoteExtraInfoResponse[]> {
    return await this.db.select().from(quoteExtraInfoResponses)
      .where(and(
        eq(quoteExtraInfoResponses.quoteId, quoteId),
        eq(quoteExtraInfoResponses.tenantId, tenantId)
      ))
      .orderBy(quoteExtraInfoResponses.submittedAt);
  }

  async getQuoteExtraInfoResponse(quoteId: string, fieldKey: string, tenantId: string): Promise<QuoteExtraInfoResponse | undefined> {
    const result = await this.db.select().from(quoteExtraInfoResponses)
      .where(and(
        eq(quoteExtraInfoResponses.quoteId, quoteId),
        eq(quoteExtraInfoResponses.fieldKey, fieldKey),
        eq(quoteExtraInfoResponses.tenantId, tenantId)
      ));
    return result[0];
  }

  async createQuoteExtraInfoResponse(response: InsertQuoteExtraInfoResponse, tenantId: string): Promise<QuoteExtraInfoResponse> {
    const result = await this.db.insert(quoteExtraInfoResponses).values({
      ...response,
      tenantId,
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateQuoteExtraInfoResponse(quoteId: string, fieldKey: string, response: Partial<InsertQuoteExtraInfoResponse>, tenantId: string): Promise<QuoteExtraInfoResponse | undefined> {
    const result = await this.db.update(quoteExtraInfoResponses).set({
      ...response,
      updatedAt: new Date(),
    }).where(and(
      eq(quoteExtraInfoResponses.quoteId, quoteId),
      eq(quoteExtraInfoResponses.fieldKey, fieldKey),
      eq(quoteExtraInfoResponses.tenantId, tenantId)
    )).returning();
    return result[0];
  }

  async upsertQuoteExtraInfoResponse(response: InsertQuoteExtraInfoResponse, tenantId: string): Promise<QuoteExtraInfoResponse> {
    const existing = await this.getQuoteExtraInfoResponse(response.quoteId, response.fieldKey, tenantId);
    if (existing) {
      return await this.updateQuoteExtraInfoResponse(response.quoteId, response.fieldKey, response, tenantId) || existing;
    } else {
      return await this.createQuoteExtraInfoResponse(response, tenantId);
    }
  }

  async deleteQuoteExtraInfoResponse(quoteId: string, fieldKey: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(quoteExtraInfoResponses)
      .where(and(
        eq(quoteExtraInfoResponses.quoteId, quoteId),
        eq(quoteExtraInfoResponses.fieldKey, fieldKey),
        eq(quoteExtraInfoResponses.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }

  // Tenant-scoped storage wrapper
  withTenant(tenantId: string): TenantScopedStorage {
    return new TenantScopedStorage(this, tenantId);
  }
}

export const storage = new DrizzleStorage();
