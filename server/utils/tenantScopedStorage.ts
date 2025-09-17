import { IStorage } from '../storage';
import { withTenant, withTenantAnd, withTenantData } from './tenantQueries';

/**
 * Tenant-scoped storage wrapper that enforces tenant isolation
 * 
 * This wrapper binds a tenant context and provides methods without explicit tenantId parameters,
 * automatically applying tenant filtering to all operations.
 * 
 * Usage:
 *   const tenantStorage = storage.withTenant(req.tenantId);
 *   const leads = await tenantStorage.getLeads(); // Automatically filtered by tenant
 */
export class TenantScopedStorage {
  constructor(
    private readonly baseStorage: IStorage,
    private readonly tenantId: string
  ) {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('TenantScopedStorage requires a valid tenantId');
    }
  }

  // Users
  async getUsers() {
    return this.baseStorage.getUsers(this.tenantId);
  }

  async getUser(id: string) {
    return this.baseStorage.getUser(id, this.tenantId);
  }

  async getUserByUsername(username: string) {
    return this.baseStorage.getUserByUsername(username, this.tenantId);
  }

  async createUser(user: any) {
    return this.baseStorage.createUser(user, this.tenantId);
  }

  async updateUser(id: string, user: any) {
    return this.baseStorage.updateUser(id, user, this.tenantId);
  }

  // Leads
  async getLeads(userId?: string) {
    return this.baseStorage.getLeads(this.tenantId, userId);
  }

  async getLead(id: string) {
    return this.baseStorage.getLead(id, this.tenantId);
  }

  async createLead(lead: any) {
    return this.baseStorage.createLead(lead, this.tenantId);
  }

  async updateLead(id: string, lead: any) {
    return this.baseStorage.updateLead(id, lead, this.tenantId);
  }

  async deleteLead(id: string) {
    return this.baseStorage.deleteLead(id, this.tenantId);
  }

  // Contacts
  async getContacts(userId?: string) {
    return this.baseStorage.getContacts(this.tenantId, userId);
  }

  async getContact(id: string) {
    return this.baseStorage.getContact(id, this.tenantId);
  }

  async getContactByEmail(email: string) {
    return this.baseStorage.getContactByEmail(email, this.tenantId);
  }

  async getContactById(id: string) {
    return this.baseStorage.getContactById(id, this.tenantId);
  }

  async createContact(contact: any) {
    return this.baseStorage.createContact(contact, this.tenantId);
  }

  async updateContact(id: string, contact: any) {
    return this.baseStorage.updateContact(id, contact, this.tenantId);
  }

  async deleteContact(id: string) {
    return this.baseStorage.deleteContact(id, this.tenantId);
  }

  // Projects
  async getProjects(userId?: string) {
    return this.baseStorage.getProjects(this.tenantId, userId);
  }

  async getProject(id: string) {
    return this.baseStorage.getProject(id, this.tenantId);
  }

  async getProjectsByContact(contactId: string) {
    return this.baseStorage.getProjectsByContact(contactId, this.tenantId);
  }

  async createProject(project: any) {
    return this.baseStorage.createProject(project, this.tenantId);
  }

  async updateProject(id: string, project: any) {
    return this.baseStorage.updateProject(id, project, this.tenantId);
  }

  async deleteProject(id: string) {
    return this.baseStorage.deleteProject(id, this.tenantId);
  }

  // Quotes
  async getQuotes() {
    return this.baseStorage.getQuotes(this.tenantId);
  }

  async getQuote(id: string) {
    return this.baseStorage.getQuote(id, this.tenantId);
  }

  async getQuotesByContact(contactId: string) {
    return this.baseStorage.getQuotesByContact(contactId, this.tenantId);
  }

  async createQuote(quote: any) {
    return this.baseStorage.createQuote(quote, this.tenantId);
  }

  async updateQuote(id: string, quote: any) {
    return this.baseStorage.updateQuote(id, quote, this.tenantId);
  }

  async deleteQuote(id: string) {
    return this.baseStorage.deleteQuote(id, this.tenantId);
  }

  // Tasks
  async getTasks(userId?: string) {
    return this.baseStorage.getTasks(this.tenantId, userId);
  }

  async getTask(id: string) {
    return this.baseStorage.getTask(id, this.tenantId);
  }

  async getTasksByAssignee(userId: string) {
    return this.baseStorage.getTasksByAssignee(userId, this.tenantId);
  }

  async getTodayTasks(userId: string) {
    return this.baseStorage.getTodayTasks(userId, this.tenantId);
  }

  async createTask(task: any) {
    return this.baseStorage.createTask(task, this.tenantId);
  }

  async updateTask(id: string, task: any) {
    return this.baseStorage.updateTask(id, task, this.tenantId);
  }

  async deleteTask(id: string) {
    return this.baseStorage.deleteTask(id, this.tenantId);
  }

  // Activities
  async getActivities() {
    return this.baseStorage.getActivities(this.tenantId);
  }

  async getRecentActivities(limit?: number) {
    return this.baseStorage.getRecentActivities(this.tenantId, limit);
  }

  async createActivity(activity: any) {
    return this.baseStorage.createActivity(activity, this.tenantId);
  }

  // Get the tenant ID for this scope
  get currentTenantId(): string {
    return this.tenantId;
  }
}

/**
 * Extend IStorage interface to include the tenant scoping method
 */
declare module '../storage' {
  interface IStorage {
    withTenant(tenantId: string): TenantScopedStorage;
  }
}