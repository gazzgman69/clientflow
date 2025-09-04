import { 
  type User, type InsertUser,
  type Lead, type InsertLead,
  type Client, type InsertClient,
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
  users, leads, clients, projects, quotes, contracts, invoices, tasks, emails, activities, automations, 
  members, venues, projectMembers, memberAvailability, projectFiles, projectNotes, smsMessages, 
  messageTemplates, messageThreads, events, calendarIntegrations, calendarSyncLog
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, desc, or } from 'drizzle-orm';

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Leads
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;
  
  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByClient(clientId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Quotes
  getQuotes(): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuotesByClient(clientId: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<boolean>;
  
  // Contracts
  getContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  getContractsByClient(clientId: string): Promise<Contract[]>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined>;
  deleteContract(id: string): Promise<boolean>;
  
  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicesByClient(clientId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  
  // Tasks
  getTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  getTasksByAssignee(userId: string): Promise<Task[]>;
  getTodayTasks(userId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  
  // Emails
  getEmails(): Promise<Email[]>;
  getEmail(id: string): Promise<Email | undefined>;
  getEmailsByThread(threadId: string): Promise<Email[]>;
  getEmailsByClient(clientId: string): Promise<Email[]>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: string, email: Partial<InsertEmail>): Promise<Email | undefined>;
  
  // SMS Messages
  getSmsMessages(): Promise<SmsMessage[]>;
  getSmsMessage(id: string): Promise<SmsMessage | undefined>;
  getSmsMessagesByThread(threadId: string): Promise<SmsMessage[]>;
  getSmsMessagesByClient(clientId: string): Promise<SmsMessage[]>;
  getSmsMessagesByPhone(phoneNumber: string): Promise<SmsMessage[]>;
  createSmsMessage(sms: InsertSmsMessage): Promise<SmsMessage>;
  updateSmsMessage(id: string, sms: Partial<InsertSmsMessage>): Promise<SmsMessage | undefined>;
  
  // Message Templates
  getMessageTemplates(): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string): Promise<MessageTemplate | undefined>;
  getMessageTemplatesByType(type: string): Promise<MessageTemplate[]>;
  createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, template: Partial<InsertMessageTemplate>): Promise<MessageTemplate | undefined>;
  deleteMessageTemplate(id: string): Promise<boolean>;
  
  // Message Threads
  getMessageThreads(): Promise<MessageThread[]>;
  getMessageThread(id: string): Promise<MessageThread | undefined>;
  getMessageThreadsByClient(clientId: string): Promise<MessageThread[]>;
  createMessageThread(thread: InsertMessageThread): Promise<MessageThread>;
  updateMessageThread(id: string, thread: Partial<InsertMessageThread>): Promise<MessageThread | undefined>;
  
  // Activities
  getActivities(): Promise<Activity[]>;
  getRecentActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  
  // Automations
  getAutomations(): Promise<Automation[]>;
  getAutomation(id: string): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  updateAutomation(id: string, automation: Partial<InsertAutomation>): Promise<Automation | undefined>;
  deleteAutomation(id: string): Promise<boolean>;
  
  // Members (Musicians)
  getMembers(): Promise<Member[]>;
  getMember(id: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(id: string, member: Partial<InsertMember>): Promise<Member | undefined>;
  deleteMember(id: string): Promise<boolean>;
  
  // Venues
  getVenues(): Promise<Venue[]>;
  getVenue(id: string): Promise<Venue | undefined>;
  createVenue(venue: InsertVenue): Promise<Venue>;
  updateVenue(id: string, venue: Partial<InsertVenue>): Promise<Venue | undefined>;
  deleteVenue(id: string): Promise<boolean>;
  
  // Project Members
  getProjectMembers(projectId: string): Promise<ProjectMember[]>;
  addProjectMember(projectMember: InsertProjectMember): Promise<ProjectMember>;
  updateProjectMember(projectId: string, memberId: string, data: Partial<InsertProjectMember>): Promise<ProjectMember | undefined>;
  removeProjectMember(projectId: string, memberId: string): Promise<boolean>;
  
  // Member Availability
  getMemberAvailability(memberId: string, startDate?: Date, endDate?: Date): Promise<MemberAvailability[]>;
  setMemberAvailability(availability: InsertMemberAvailability): Promise<MemberAvailability>;
  
  // Project Files
  getProjectFiles(projectId: string): Promise<ProjectFile[]>;
  addProjectFile(file: InsertProjectFile): Promise<ProjectFile>;
  deleteProjectFile(id: string): Promise<boolean>;
  
  // Project Notes
  getProjectNotes(projectId: string): Promise<ProjectNote[]>;
  addProjectNote(note: InsertProjectNote): Promise<ProjectNote>;
  deleteProjectNote(id: string): Promise<boolean>;
  
  // Authentication
  validateUser(username: string, password: string): Promise<User | undefined>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  
  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventsByUser(userId: string): Promise<Event[]>;
  getEventsByDateRange(startDate: Date, endDate: Date): Promise<Event[]>;
  getEventsByClient(clientId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  
  // Calendar Integrations
  getCalendarIntegrations(): Promise<CalendarIntegration[]>;
  getCalendarIntegration(id: string): Promise<CalendarIntegration | undefined>;
  getCalendarIntegrationsByUser(userId: string): Promise<CalendarIntegration[]>;
  getCalendarIntegrationByEmail(email: string, userId: string): Promise<CalendarIntegration | undefined>;
  createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration>;
  updateCalendarIntegration(id: string, integration: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined>;
  deleteCalendarIntegration(id: string): Promise<boolean>;
  
  // Event sync helpers
  getEventByExternalId(externalId: string): Promise<Event | undefined>;
  
  // Calendar Sync Logs
  getCalendarSyncLogs(integrationId?: string): Promise<CalendarSyncLog[]>;
  createCalendarSyncLog(log: InsertCalendarSyncLog): Promise<CalendarSyncLog>;
  updateCalendarSyncLog(id: string, log: Partial<InsertCalendarSyncLog>): Promise<CalendarSyncLog | undefined>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    totalLeads: number;
    activeProjects: number;
    revenue: number;
    pendingInvoices: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private leads: Map<string, Lead> = new Map();
  private clients: Map<string, Client> = new Map();
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

  constructor() {
    // Initialize with default admin user
    const defaultUser: User = {
      id: randomUUID(),
      username: "admin",
      password: "password",
      email: "john@company.com",
      role: "admin",
      firstName: "John",
      lastName: "Smith",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);
  }

  // Users
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      avatar: insertUser.avatar ?? null,
      role: insertUser.role ?? 'client',
      id, 
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  // Leads
  async getLeads(): Promise<Lead[]> {
    return Array.from(this.leads.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const lead: Lead = {
      ...insertLead,
      status: insertLead.status ?? 'new',
      phone: insertLead.phone ?? null,
      company: insertLead.company ?? null,
      leadSource: insertLead.leadSource ?? null,
      estimatedValue: insertLead.estimatedValue ?? null,
      notes: insertLead.notes ?? null,
      assignedTo: insertLead.assignedTo ?? null,
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
      ...leadUpdate,
      updatedAt: new Date(),
    };
    this.leads.set(id, updatedLead);
    return updatedLead;
  }

  async deleteLead(id: string): Promise<boolean> {
    return this.leads.delete(id);
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = {
      ...insertClient,
      phone: insertClient.phone ?? null,
      company: insertClient.company ?? null,
      address: insertClient.address ?? null,
      city: insertClient.city ?? null,
      state: insertClient.state ?? null,
      zipCode: insertClient.zipCode ?? null,
      country: insertClient.country ?? null,
      leadId: insertClient.leadId ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, clientUpdate: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;
    
    const updatedClient: Client = {
      ...client,
      ...clientUpdate,
      updatedAt: new Date(),
    };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectsByClient(clientId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(project => project.clientId === clientId);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      status: insertProject.status ?? 'active',
      description: insertProject.description ?? null,
      progress: insertProject.progress ?? null,
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
      ...projectUpdate,
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

  async getQuotesByClient(clientId: string): Promise<Quote[]> {
    return Array.from(this.quotes.values()).filter(quote => quote.clientId === clientId);
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const id = randomUUID();
    const quoteNumber = `Q-${Date.now()}`;
    const quote: Quote = {
      ...insertQuote,
      status: insertQuote.status ?? 'draft',
      description: insertQuote.description ?? null,
      clientId: insertQuote.clientId ?? null,
      leadId: insertQuote.leadId ?? null,
      taxAmount: insertQuote.taxAmount ?? null,
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
      ...quoteUpdate,
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
    return Array.from(this.contracts.values()).filter(contract => contract.clientId === clientId);
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
      ...contractUpdate,
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
    return Array.from(this.invoices.values()).filter(invoice => invoice.clientId === clientId);
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
      ...invoiceUpdate,
      updatedAt: new Date(),
    };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values()).sort((a, b) => 
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
      assignedTo: insertTask.assignedTo ?? null,
      leadId: insertTask.leadId ?? null,
      clientId: insertTask.clientId ?? null,
      projectId: insertTask.projectId ?? null,
      dueDate: insertTask.dueDate ?? null,
      priority: insertTask.priority ?? 'medium',
      completedAt: insertTask.completedAt ?? null,
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
      ...taskUpdate,
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
      clientId: insertEmail.clientId ?? null,
      projectId: insertEmail.projectId ?? null,
      threadId: insertEmail.threadId ?? null,
      ccEmails: insertEmail.ccEmails ?? null,
      bccEmails: insertEmail.bccEmails ?? null,
      sentAt: insertEmail.sentAt ?? null,
      sentBy: insertEmail.sentBy ?? null,
      id,
      createdAt: new Date(),
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
      ...memberUpdate,
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
      city: insertVenue.city ?? null,
      state: insertVenue.state ?? null,
      zipCode: insertVenue.zipCode ?? null,
      capacity: insertVenue.capacity ?? null,
      contactName: insertVenue.contactName ?? null,
      contactPhone: insertVenue.contactPhone ?? null,
      contactEmail: insertVenue.contactEmail ?? null,
      notes: insertVenue.notes ?? null,
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
      ...venueUpdate,
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
      ...userUpdate,
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
    return Array.from(this.events.values()).filter(event => event.clientId === clientId);
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
      clientId: insertEvent.clientId ?? null,
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
      ...eventUpdate,
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
    return this.calendarIntegrations.get(id);
  }

  async getCalendarIntegrationsByUser(userId: string): Promise<CalendarIntegration[]> {
    return Array.from(this.calendarIntegrations.values()).filter(integration => 
      integration.userId === userId
    );
  }
  
  async getCalendarIntegrationByEmail(email: string, userId: string): Promise<CalendarIntegration | undefined> {
    return Array.from(this.calendarIntegrations.values()).find(integration => 
      integration.providerAccountId === email && integration.userId === userId && integration.provider === 'google'
    );
  }

  async createCalendarIntegration(insertIntegration: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const id = randomUUID();
    const integration: CalendarIntegration = {
      ...insertIntegration,
      providerAccountId: insertIntegration.providerAccountId ?? null,
      calendarId: insertIntegration.calendarId ?? null,
      accessToken: insertIntegration.accessToken ?? null,
      refreshToken: insertIntegration.refreshToken ?? null,
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
    return integration;
  }

  async updateCalendarIntegration(id: string, integrationUpdate: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined> {
    const integration = this.calendarIntegrations.get(id);
    if (!integration) return undefined;
    
    const updatedIntegration: CalendarIntegration = {
      ...integration,
      ...integrationUpdate,
      updatedAt: new Date(),
    };
    this.calendarIntegrations.set(id, updatedIntegration);
    return updatedIntegration;
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
  async getDashboardMetrics(): Promise<{
    totalLeads: number;
    activeProjects: number;
    revenue: number;
    pendingInvoices: number;
  }> {
    const leads = await this.getLeads();
    const projects = await this.getProjects();
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
}

// Database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export class DrizzleStorage implements IStorage {
  // Calendar Integrations - Core functionality for Google Calendar
  async getCalendarIntegrations(): Promise<CalendarIntegration[]> {
    return await db.select().from(calendarIntegrations);
  }

  async getCalendarIntegrationsByUser(userId: string): Promise<CalendarIntegration[]> {
    return await db.select().from(calendarIntegrations).where(eq(calendarIntegrations.userId, userId));
  }

  async getCalendarIntegration(id: string): Promise<CalendarIntegration | undefined> {
    const result = await db.select().from(calendarIntegrations).where(eq(calendarIntegrations.id, id));
    return result[0];
  }

  async getCalendarIntegrationByEmail(email: string, userId: string): Promise<CalendarIntegration | undefined> {
    const result = await db.select().from(calendarIntegrations)
      .where(and(eq(calendarIntegrations.providerAccountId, email), eq(calendarIntegrations.userId, userId)));
    return result[0];
  }

  async createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const result = await db.insert(calendarIntegrations).values(integration).returning();
    return result[0];
  }

  async updateCalendarIntegration(id: string, updates: Partial<InsertCalendarIntegration>): Promise<CalendarIntegration | undefined> {
    const result = await db.update(calendarIntegrations).set(updates).where(eq(calendarIntegrations.id, id)).returning();
    return result[0];
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

  // Basic implementations for other required methods (using MemStorage pattern for now)
  private memStorage = new MemStorage();

  // Delegate non-calendar methods to MemStorage for now
  async getUsers() { return this.memStorage.getUsers(); }
  async getUser(id: string) { return this.memStorage.getUser(id); }
  async getUserByUsername(username: string) { return this.memStorage.getUserByUsername(username); }
  async createUser(user: InsertUser) { return this.memStorage.createUser(user); }
  
  async getLeads() { return this.memStorage.getLeads(); }
  async getLead(id: string) { return this.memStorage.getLead(id); }
  async createLead(lead: InsertLead) { return this.memStorage.createLead(lead); }
  async updateLead(id: string, lead: Partial<InsertLead>) { return this.memStorage.updateLead(id, lead); }
  async deleteLead(id: string) { return this.memStorage.deleteLead(id); }
  
  async getClients() { return this.memStorage.getClients(); }
  async getClient(id: string) { return this.memStorage.getClient(id); }
  async createClient(client: InsertClient) { return this.memStorage.createClient(client); }
  async updateClient(id: string, client: Partial<InsertClient>) { return this.memStorage.updateClient(id, client); }
  async deleteClient(id: string) { return this.memStorage.deleteClient(id); }
  
  async getProjects() { return this.memStorage.getProjects(); }
  async getProject(id: string) { return this.memStorage.getProject(id); }
  async getProjectsByClient(clientId: string) { return this.memStorage.getProjectsByClient(clientId); }
  async createProject(project: InsertProject) { return this.memStorage.createProject(project); }
  async updateProject(id: string, project: Partial<InsertProject>) { return this.memStorage.updateProject(id, project); }
  async deleteProject(id: string) { return this.memStorage.deleteProject(id); }
  
  async getQuotes() { return this.memStorage.getQuotes(); }
  async getQuote(id: string) { return this.memStorage.getQuote(id); }
  async getQuotesByClient(clientId: string) { return this.memStorage.getQuotesByClient(clientId); }
  async createQuote(quote: InsertQuote) { return this.memStorage.createQuote(quote); }
  async updateQuote(id: string, quote: Partial<InsertQuote>) { return this.memStorage.updateQuote(id, quote); }
  async deleteQuote(id: string) { return this.memStorage.deleteQuote(id); }
  async getQuotesByProject(projectId: string) { return this.memStorage.getQuotesByProject(projectId); }
  
  async getContracts() { return this.memStorage.getContracts(); }
  async getContract(id: string) { return this.memStorage.getContract(id); }
  async getContractsByClient(clientId: string) { return this.memStorage.getContractsByClient(clientId); }
  async createContract(contract: InsertContract) { return this.memStorage.createContract(contract); }
  async updateContract(id: string, contract: Partial<InsertContract>) { return this.memStorage.updateContract(id, contract); }
  async deleteContract(id: string) { return this.memStorage.deleteContract(id); }
  async getContractsByProject(projectId: string) { return this.memStorage.getContractsByProject(projectId); }
  
  async getInvoices() { return this.memStorage.getInvoices(); }
  async getInvoice(id: string) { return this.memStorage.getInvoice(id); }
  async getInvoicesByClient(clientId: string) { return this.memStorage.getInvoicesByClient(clientId); }
  async createInvoice(invoice: InsertInvoice) { return this.memStorage.createInvoice(invoice); }
  async updateInvoice(id: string, invoice: Partial<InsertInvoice>) { return this.memStorage.updateInvoice(id, invoice); }
  async deleteInvoice(id: string) { return this.memStorage.deleteInvoice(id); }
  async getInvoicesByProject(projectId: string) { return this.memStorage.getInvoicesByProject(projectId); }
  
  async getTasks() { return this.memStorage.getTasks(); }
  async getTask(id: string) { return this.memStorage.getTask(id); }
  async getTasksByClient(clientId: string) { return this.memStorage.getTasksByClient(clientId); }
  async getTasksByProject(projectId: string) { return this.memStorage.getTasksByProject(projectId); }
  async getTasksByUser(userId: string) { return this.memStorage.getTasksByUser(userId); }
  async createTask(task: InsertTask) { return this.memStorage.createTask(task); }
  async updateTask(id: string, task: Partial<InsertTask>) { return this.memStorage.updateTask(id, task); }
  async deleteTask(id: string) { return this.memStorage.deleteTask(id); }
  
  async getEmails() { return this.memStorage.getEmails(); }
  async getEmail(id: string) { return this.memStorage.getEmail(id); }
  async getEmailsByClient(clientId: string) { return this.memStorage.getEmailsByClient(clientId); }
  async getEmailsByProject(projectId: string) { return this.memStorage.getEmailsByProject(projectId); }
  async createEmail(email: InsertEmail) { return this.memStorage.createEmail(email); }
  async updateEmail(id: string, email: Partial<InsertEmail>) { return this.memStorage.updateEmail(id, email); }
  async deleteEmail(id: string) { return this.memStorage.deleteEmail(id); }
  
  async getActivities() { return this.memStorage.getActivities(); }
  async getActivity(id: string) { return this.memStorage.getActivity(id); }
  async getActivitiesByClient(clientId: string) { return this.memStorage.getActivitiesByClient(clientId); }
  async getActivitiesByProject(projectId: string) { return this.memStorage.getActivitiesByProject(projectId); }
  async createActivity(activity: InsertActivity) { return this.memStorage.createActivity(activity); }
  async updateActivity(id: string, activity: Partial<InsertActivity>) { return this.memStorage.updateActivity(id, activity); }
  async deleteActivity(id: string) { return this.memStorage.deleteActivity(id); }
  
  async getAutomations() { return this.memStorage.getAutomations(); }
  async getAutomation(id: string) { return this.memStorage.getAutomation(id); }
  async createAutomation(automation: InsertAutomation) { return this.memStorage.createAutomation(automation); }
  async updateAutomation(id: string, automation: Partial<InsertAutomation>) { return this.memStorage.updateAutomation(id, automation); }
  async deleteAutomation(id: string) { return this.memStorage.deleteAutomation(id); }
  
  async getMembers() { return this.memStorage.getMembers(); }
  async getMember(id: string) { return this.memStorage.getMember(id); }
  async createMember(member: InsertMember) { return this.memStorage.createMember(member); }
  async updateMember(id: string, member: Partial<InsertMember>) { return this.memStorage.updateMember(id, member); }
  async deleteMember(id: string) { return this.memStorage.deleteMember(id); }
  
  async getVenues() { return this.memStorage.getVenues(); }
  async getVenue(id: string) { return this.memStorage.getVenue(id); }
  async createVenue(venue: InsertVenue) { return this.memStorage.createVenue(venue); }
  async updateVenue(id: string, venue: Partial<InsertVenue>) { return this.memStorage.updateVenue(id, venue); }
  async deleteVenue(id: string) { return this.memStorage.deleteVenue(id); }
  
  async getProjectMembers(projectId: string) { return this.memStorage.getProjectMembers(projectId); }
  async addProjectMember(projectMember: InsertProjectMember) { return this.memStorage.addProjectMember(projectMember); }
  async removeProjectMember(projectId: string, memberId: string) { return this.memStorage.removeProjectMember(projectId, memberId); }
  async updateProjectMemberRole(projectId: string, memberId: string, role: string) { return this.memStorage.updateProjectMemberRole(projectId, memberId, role); }
  
  async getMemberAvailability(memberId: string) { return this.memStorage.getMemberAvailability(memberId); }
  async addMemberAvailability(availability: InsertMemberAvailability) { return this.memStorage.addMemberAvailability(availability); }
  async updateMemberAvailability(id: string, availability: Partial<InsertMemberAvailability>) { return this.memStorage.updateMemberAvailability(id, availability); }
  async deleteMemberAvailability(id: string) { return this.memStorage.deleteMemberAvailability(id); }
  
  async getProjectFiles(projectId: string) { return this.memStorage.getProjectFiles(projectId); }
  async addProjectFile(file: InsertProjectFile) { return this.memStorage.addProjectFile(file); }
  async deleteProjectFile(id: string) { return this.memStorage.deleteProjectFile(id); }
  
  async getProjectNotes(projectId: string) { return this.memStorage.getProjectNotes(projectId); }
  async addProjectNote(note: InsertProjectNote) { return this.memStorage.addProjectNote(note); }
  async updateProjectNote(id: string, note: Partial<InsertProjectNote>) { return this.memStorage.updateProjectNote(id, note); }
  async deleteProjectNote(id: string) { return this.memStorage.deleteProjectNote(id); }
  
  async getSmsMessages() { return this.memStorage.getSmsMessages(); }
  async getSmsMessage(id: string) { return this.memStorage.getSmsMessage(id); }
  async createSmsMessage(message: InsertSmsMessage) { return this.memStorage.createSmsMessage(message); }
  async updateSmsMessage(id: string, message: Partial<InsertSmsMessage>) { return this.memStorage.updateSmsMessage(id, message); }
  async deleteSmsMessage(id: string) { return this.memStorage.deleteSmsMessage(id); }
  
  async getMessageTemplates() { return this.memStorage.getMessageTemplates(); }
  async getMessageTemplate(id: string) { return this.memStorage.getMessageTemplate(id); }
  async createMessageTemplate(template: InsertMessageTemplate) { return this.memStorage.createMessageTemplate(template); }
  async updateMessageTemplate(id: string, template: Partial<InsertMessageTemplate>) { return this.memStorage.updateMessageTemplate(id, template); }
  async deleteMessageTemplate(id: string) { return this.memStorage.deleteMessageTemplate(id); }
  
  async getMessageThreads() { return this.memStorage.getMessageThreads(); }
  async getMessageThread(id: string) { return this.memStorage.getMessageThread(id); }
  async createMessageThread(thread: InsertMessageThread) { return this.memStorage.createMessageThread(thread); }
  async updateMessageThread(id: string, thread: Partial<InsertMessageThread>) { return this.memStorage.updateMessageThread(id, thread); }
  async deleteMessageThread(id: string) { return this.memStorage.deleteMessageThread(id); }
  
  async getEventsByClient(clientId: string) { return this.memStorage.getEventsByClient(clientId); }
  async getEventsByProject(projectId: string) { return this.memStorage.getEventsByProject(projectId); }
  
  async getCalendarSyncLogs() { return this.memStorage.getCalendarSyncLogs(); }
  async getCalendarSyncLog(id: string) { return this.memStorage.getCalendarSyncLog(id); }
  async createCalendarSyncLog(log: InsertCalendarSyncLog) { return this.memStorage.createCalendarSyncLog(log); }
  async updateCalendarSyncLog(id: string, log: Partial<InsertCalendarSyncLog>) { return this.memStorage.updateCalendarSyncLog(id, log); }
  
  async getDashboardMetrics() { return this.memStorage.getDashboardMetrics(); }
}

export const storage = new DrizzleStorage();
