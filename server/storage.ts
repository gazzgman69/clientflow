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
  type Automation, type InsertAutomation
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
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

  constructor() {
    // Initialize with default user
    const defaultUser: User = {
      id: randomUUID(),
      username: "admin",
      password: "password",
      email: "john@company.com",
      firstName: "John",
      lastName: "Smith",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);
  }

  // Users
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

export const storage = new MemStorage();
