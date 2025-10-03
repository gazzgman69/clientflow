import { IStorage } from '../types/storage';
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

  // Lead Custom Field Responses - SECURITY: Required for tenant-scoped form submissions
  async upsertLeadCustomFieldResponse(response: any) {
    return this.baseStorage.upsertLeadCustomFieldResponse(response, this.tenantId);
  }

  // Form Submissions - SECURITY: Idempotency tracking with tenant isolation
  async getFormSubmissionByKey(submissionKey: string) {
    return this.baseStorage.getFormSubmissionByKey(this.tenantId, submissionKey);
  }

  async createFormSubmission(submission: any) {
    // Ensure the submission includes the tenant ID for proper isolation
    const submissionWithTenant = { ...submission, tenantId: this.tenantId };
    return this.baseStorage.createFormSubmission(submissionWithTenant);
  }

  // Lead Consent - SECURITY: GDPR compliance with tenant isolation  
  async createLeadConsent(consent: any) {
    // Ensure the consent includes the tenant ID for proper isolation
    const consentWithTenant = { ...consent, tenantId: this.tenantId };
    return this.baseStorage.createLeadConsent(consentWithTenant);
  }

  async getLeadConsents(leadId: string) {
    return this.baseStorage.getLeadConsents(leadId, this.tenantId);
  }

  async updateLeadConsent(id: string, consent: any) {
    return this.baseStorage.updateLeadConsent(id, consent, this.tenantId);
  }

  // Auto-Responder Logs
  async createAutoResponderLog(log: any) {
    return this.baseStorage.createAutoResponderLog(log, this.tenantId);
  }

  async getAutoResponderLogsByLead(leadId: string) {
    return this.baseStorage.getAutoResponderLogsByLead(leadId, this.tenantId);
  }

  async getDueAutoResponderLogs() {
    return this.baseStorage.getDueAutoResponderLogs(this.tenantId);
  }

  async updateAutoResponderLog(id: string, log: any) {
    return this.baseStorage.updateAutoResponderLog(id, log, this.tenantId);
  }

  // Calendar Integrations
  async getCalendarIntegrations() {
    return this.baseStorage.getCalendarIntegrations(this.tenantId);
  }

  async getCalendarIntegrationsByTenant() {
    return this.baseStorage.getCalendarIntegrationsByTenant(this.tenantId);
  }

  async getCalendarIntegration(id: string) {
    return this.baseStorage.getCalendarIntegration(id, this.tenantId);
  }

  async getCalendarIntegrationsByUser(userId: string) {
    return this.baseStorage.getCalendarIntegrationsByUser(userId, this.tenantId);
  }

  async getCalendarIntegrationByEmail(email: string, userId: string) {
    return this.baseStorage.getCalendarIntegrationByEmail(email, userId, this.tenantId);
  }

  async createCalendarIntegration(integration: any) {
    return this.baseStorage.createCalendarIntegration(integration, this.tenantId);
  }

  async updateCalendarIntegration(id: string, integration: any) {
    return this.baseStorage.updateCalendarIntegration(id, integration, this.tenantId);
  }

  async deleteCalendarIntegration(id: string) {
    return this.baseStorage.deleteCalendarIntegration(id, this.tenantId);
  }

  // Members
  async getMembers() {
    return this.baseStorage.getMembers(this.tenantId);
  }

  async getMember(id: string) {
    return this.baseStorage.getMember(id, this.tenantId);
  }

  async getMembersByAvailability() {
    return this.baseStorage.getMembersByAvailability(this.tenantId);
  }

  async createMember(member: any) {
    return this.baseStorage.createMember(member, this.tenantId);
  }

  async updateMember(id: string, member: any) {
    return this.baseStorage.updateMember(id, member, this.tenantId);
  }

  async deleteMember(id: string) {
    return this.baseStorage.deleteMember(id, this.tenantId);
  }

  // Venues
  async getVenues() {
    return this.baseStorage.getVenues(this.tenantId);
  }

  async getVenue(id: string) {
    return this.baseStorage.getVenue(id, this.tenantId);
  }

  async getVenueByPlaceId(placeId: string) {
    return this.baseStorage.getVenueByPlaceId(placeId, this.tenantId);
  }

  async createVenue(venue: any) {
    return this.baseStorage.createVenue(venue, this.tenantId);
  }

  async updateVenue(id: string, venue: any) {
    return this.baseStorage.updateVenue(id, venue, this.tenantId);
  }

  async deleteVenue(id: string) {
    return this.baseStorage.deleteVenue(id, this.tenantId);
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