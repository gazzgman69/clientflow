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
  type MemberGroup, type InsertMemberGroup,
  type MemberGroupMember, type InsertMemberGroupMember,
  type PerformerContract, type InsertPerformerContract,
  type Repertoire, type InsertRepertoire,
  type ProjectSetlist, type InsertProjectSetlist,
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
  type Tenant, type InsertTenant,
  type QuotePackage, type InsertQuotePackage,
  type QuoteAddon, type InsertQuoteAddon,
  type QuoteItem, type InsertQuoteItem,
  type QuoteToken, type InsertQuoteToken,
  type QuoteSignature, type InsertQuoteSignature,
  type QuoteExtraInfoField, type InsertQuoteExtraInfoField,
  type QuoteExtraInfoConfig, type InsertQuoteExtraInfoConfig,
  type QuoteExtraInfoResponse, type InsertQuoteExtraInfoResponse,
  type LeadCustomField, type InsertLeadCustomField,
  type LeadCustomFieldResponse, type InsertLeadCustomFieldResponse,
  type AdminAuditLog, type InsertAdminAuditLog,
  type FormSubmission, type InsertFormSubmission,
  type LeadConsent, type InsertLeadConsent,
} from "@shared/schema";

export interface IStorage {
  // Tenants (for job scheduling and resolution)
  getActiveTenants(): Promise<{ id: string; name: string; slug: string }[]>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  getTenantByDomain(domain: string): Promise<Tenant | undefined>;
  getTenant(id: string): Promise<Tenant | undefined>;
  
  // Users
  getUsers(tenantId: string): Promise<User[]>;
  getUser(id: string, tenantId: string): Promise<User | undefined>;
  getUserGlobal(id: string): Promise<User | undefined>; // Global lookup across all tenants for SUPERADMIN verification
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
  getContacts(tenantId: string, userId?: string, limit?: number, offset?: number): Promise<Contact[]>;
  getContactsCount(tenantId: string, userId?: string): Promise<number>;
  getContact(id: string, tenantId: string): Promise<Contact | undefined>;
  getContactByEmail(email: string, tenantId: string): Promise<Contact | undefined>;
  getContactById(id: string, tenantId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact, tenantId: string): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>, tenantId: string): Promise<Contact | undefined>;
  deleteContact(id: string, tenantId: string): Promise<boolean>;
  
  // Projects
  getProjects(tenantId: string, userId?: string, limit?: number, offset?: number): Promise<Project[]>;
  getProjectsCount(tenantId: string, userId?: string): Promise<number>;
  getProject(id: string, tenantId: string): Promise<Project | undefined>;
  getProjectsByContact(contactId: string, tenantId: string): Promise<Project[]>;
  getActiveProjectsByContact(contactId: string, tenantId: string): Promise<Project[]>;
  createProject(project: InsertProject, tenantId: string): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>, tenantId: string): Promise<Project | undefined>;
  deleteProject(id: string, tenantId: string): Promise<boolean>;
  
  // Quotes
  getQuotes(tenantId: string): Promise<Quote[]>;
  getQuote(id: string, tenantId: string): Promise<Quote | undefined>;
  getQuoteByNumber(quoteNumber: string, tenantId: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote, tenantId: string): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>, tenantId: string): Promise<Quote | undefined>;
  deleteQuote(id: string, tenantId: string): Promise<boolean>;
  
  // Contracts
  getContracts(tenantId: string): Promise<Contract[]>;
  getContract(id: string, tenantId: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract, tenantId: string): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>, tenantId: string): Promise<Contract | undefined>;
  deleteContract(id: string, tenantId: string): Promise<boolean>;
  
  // Invoices
  getInvoices(tenantId: string): Promise<Invoice[]>;
  getInvoice(id: string, tenantId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice, tenantId: string): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>, tenantId: string): Promise<Invoice | undefined>;
  deleteInvoice(id: string, tenantId: string): Promise<boolean>;
  
  // Tasks
  getTasks(tenantId: string): Promise<Task[]>;
  getTask(id: string, tenantId: string): Promise<Task | undefined>;
  createTask(task: InsertTask, tenantId: string): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>, tenantId: string): Promise<Task | undefined>;
  deleteTask(id: string, tenantId: string): Promise<boolean>;
  
  // Emails
  getEmails(tenantId: string): Promise<Email[]>;
  getEmail(id: string, tenantId: string): Promise<Email | undefined>;
  createEmail(email: InsertEmail, tenantId: string): Promise<Email>;
  updateEmail(id: string, email: Partial<InsertEmail>, tenantId: string): Promise<Email | undefined>;
  deleteEmail(id: string, tenantId: string): Promise<boolean>;
  
  // Activities
  getActivities(tenantId: string): Promise<Activity[]>;
  getActivity(id: string, tenantId: string): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity, tenantId: string): Promise<Activity>;
  updateActivity(id: string, activity: Partial<InsertActivity>, tenantId: string): Promise<Activity | undefined>;
  deleteActivity(id: string, tenantId: string): Promise<boolean>;
  
  // Automations
  getAutomations(tenantId: string): Promise<Automation[]>;
  getAutomation(id: string, tenantId: string): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation, tenantId: string): Promise<Automation>;
  updateAutomation(id: string, automation: Partial<InsertAutomation>, tenantId: string): Promise<Automation | undefined>;
  deleteAutomation(id: string, tenantId: string): Promise<boolean>;
  
  // Members
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
  getMemberAvailability(memberId: string, tenantId: string): Promise<MemberAvailability[]>;
  addMemberAvailability(availability: InsertMemberAvailability, tenantId: string): Promise<MemberAvailability>;
  updateMemberAvailability(id: string, availability: Partial<InsertMemberAvailability>, tenantId: string): Promise<MemberAvailability | undefined>;
  deleteMemberAvailability(id: string, tenantId: string): Promise<boolean>;

  // Member Groups
  getMemberGroups(tenantId: string): Promise<MemberGroup[]>;
  getMemberGroup(id: string, tenantId: string): Promise<MemberGroup | undefined>;
  createMemberGroup(group: InsertMemberGroup, tenantId: string): Promise<MemberGroup>;
  updateMemberGroup(id: string, group: Partial<InsertMemberGroup>, tenantId: string): Promise<MemberGroup | undefined>;
  deleteMemberGroup(id: string, tenantId: string): Promise<boolean>;
  getMemberGroupMembers(groupId: string, tenantId: string): Promise<MemberGroupMember[]>;
  addMemberToGroup(data: InsertMemberGroupMember, tenantId: string): Promise<MemberGroupMember>;
  removeMemberFromGroup(groupId: string, memberId: string, tenantId: string): Promise<boolean>;

  // Performer Contracts
  getPerformerContracts(tenantId: string, projectId?: string): Promise<PerformerContract[]>;
  getPerformerContract(id: string, tenantId: string): Promise<PerformerContract | undefined>;
  createPerformerContract(contract: InsertPerformerContract, tenantId: string): Promise<PerformerContract>;
  updatePerformerContract(id: string, contract: Partial<InsertPerformerContract>, tenantId: string): Promise<PerformerContract | undefined>;
  deletePerformerContract(id: string, tenantId: string): Promise<boolean>;

  // Repertoire
  getRepertoire(tenantId: string): Promise<Repertoire[]>;
  getRepertoireItem(id: string, tenantId: string): Promise<Repertoire | undefined>;
  createRepertoireItem(item: InsertRepertoire, tenantId: string): Promise<Repertoire>;
  updateRepertoireItem(id: string, item: Partial<InsertRepertoire>, tenantId: string): Promise<Repertoire | undefined>;
  deleteRepertoireItem(id: string, tenantId: string): Promise<boolean>;

  // Project Setlist
  getProjectSetlist(projectId: string, tenantId: string): Promise<ProjectSetlist[]>;
  addSongToSetlist(item: InsertProjectSetlist, tenantId: string): Promise<ProjectSetlist>;
  updateSetlistItem(projectId: string, songId: string, data: Partial<InsertProjectSetlist>, tenantId: string): Promise<ProjectSetlist | undefined>;
  removeSongFromSetlist(projectId: string, songId: string, tenantId: string): Promise<boolean>;
  
  // Project Files
  getProjectFiles(projectId: string, tenantId: string): Promise<ProjectFile[]>;
  addProjectFile(file: InsertProjectFile, tenantId: string): Promise<ProjectFile>;
  deleteProjectFile(id: string, tenantId: string): Promise<boolean>;
  
  // Project Notes
  getProjectNotes(projectId: string, tenantId: string): Promise<ProjectNote[]>;
  addProjectNote(note: InsertProjectNote, tenantId: string): Promise<ProjectNote>;
  updateProjectNote(id: string, note: Partial<InsertProjectNote>, tenantId: string): Promise<ProjectNote | undefined>;
  deleteProjectNote(id: string, tenantId: string): Promise<boolean>;
  
  // SMS Messages
  getSmsMessages(tenantId: string): Promise<SmsMessage[]>;
  getSmsMessage(id: string, tenantId: string): Promise<SmsMessage | undefined>;
  createSmsMessage(message: InsertSmsMessage, tenantId: string): Promise<SmsMessage>;
  
  // Message Templates
  getMessageTemplates(tenantId: string): Promise<MessageTemplate[]>;
  getMessageTemplate(id: string, tenantId: string): Promise<MessageTemplate | undefined>;
  createMessageTemplate(template: InsertMessageTemplate, tenantId: string): Promise<MessageTemplate>;
  updateMessageTemplate(id: string, template: Partial<InsertMessageTemplate>, tenantId: string): Promise<MessageTemplate | undefined>;
  deleteMessageTemplate(id: string, tenantId: string): Promise<boolean>;
  
  // Message Threads
  getMessageThreads(tenantId: string): Promise<MessageThread[]>;
  getMessageThread(id: string, tenantId: string): Promise<MessageThread | undefined>;
  createMessageThread(thread: InsertMessageThread, tenantId: string): Promise<MessageThread>;
  updateMessageThread(id: string, thread: Partial<InsertMessageThread>, tenantId: string): Promise<MessageThread | undefined>;
  deleteMessageThread(id: string, tenantId: string): Promise<boolean>;
  
  // Events
  getEvents(tenantId: string): Promise<Event[]>;
  getEvent(id: string, tenantId: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent, tenantId: string): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>, tenantId: string): Promise<Event | undefined>;
  deleteEvent(id: string, tenantId: string): Promise<boolean>;
  
  // Calendar Integrations
  getCalendarIntegrations(tenantId: string): Promise<CalendarIntegration[]>;
  getCalendarIntegration(id: string, tenantId: string): Promise<CalendarIntegration | undefined>;
  createCalendarIntegration(integration: InsertCalendarIntegration, tenantId: string): Promise<CalendarIntegration>;
  updateCalendarIntegration(id: string, integration: Partial<InsertCalendarIntegration>, tenantId: string): Promise<CalendarIntegration | undefined>;
  deleteCalendarIntegration(id: string, tenantId: string): Promise<boolean>;
  
  // Calendar Sync Logs
  getCalendarSyncLogs(tenantId: string): Promise<CalendarSyncLog[]>;
  createCalendarSyncLog(log: InsertCalendarSyncLog, tenantId: string): Promise<CalendarSyncLog>;
  
  // Templates
  getTemplates(tenantId: string): Promise<Template[]>;
  getTemplate(id: string, tenantId: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate, tenantId: string): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>, tenantId: string): Promise<Template | undefined>;
  deleteTemplate(id: string, tenantId: string): Promise<boolean>;
  
  // Lead Capture Forms
  getLeadCaptureForms(tenantId: string): Promise<LeadCaptureForm[]>;
  getLeadCaptureForm(id: string, tenantId: string): Promise<LeadCaptureForm | undefined>;
  getLeadCaptureFormByToken(token: string): Promise<LeadCaptureForm | undefined>;
  createLeadCaptureForm(form: InsertLeadCaptureForm, tenantId: string): Promise<LeadCaptureForm>;
  updateLeadCaptureForm(id: string, form: Partial<InsertLeadCaptureForm>, tenantId: string): Promise<LeadCaptureForm | undefined>;
  deleteLeadCaptureForm(id: string, tenantId: string): Promise<boolean>;
  
  // Lead Status History
  getLeadStatusHistory(leadId: string, tenantId: string): Promise<LeadStatusHistory[]>;
  createLeadStatusHistory(history: InsertLeadStatusHistory, tenantId: string): Promise<LeadStatusHistory>;
  
  // Email Signatures
  getEmailSignatures(tenantId: string): Promise<EmailSignature[]>;
  getEmailSignature(id: string, tenantId: string): Promise<EmailSignature | undefined>;
  createEmailSignature(signature: InsertEmailSignature, tenantId: string): Promise<EmailSignature>;
  updateEmailSignature(id: string, signature: Partial<InsertEmailSignature>, tenantId: string): Promise<EmailSignature | undefined>;
  deleteEmailSignature(id: string, tenantId: string): Promise<boolean>;
  
  // Portal Forms
  getPortalForms(tenantId: string): Promise<PortalForm[]>;
  getPortalForm(id: string, tenantId: string): Promise<PortalForm | undefined>;
  createPortalForm(form: InsertPortalForm, tenantId: string): Promise<PortalForm>;
  updatePortalForm(id: string, form: Partial<InsertPortalForm>, tenantId: string): Promise<PortalForm | undefined>;
  deletePortalForm(id: string, tenantId: string): Promise<boolean>;
  
  // Payment Sessions
  getPaymentSessions(tenantId: string): Promise<PaymentSession[]>;
  getPaymentSession(id: string, tenantId: string): Promise<PaymentSession | undefined>;
  createPaymentSession(session: InsertPaymentSession, tenantId: string): Promise<PaymentSession>;
  updatePaymentSession(id: string, session: Partial<InsertPaymentSession>, tenantId: string): Promise<PaymentSession | undefined>;
  deletePaymentSession(id: string, tenantId: string): Promise<boolean>;
  
  // Webhook Events
  getWebhookEvents(tenantId: string): Promise<WebhookEvent[]>;
  getWebhookEvent(id: string, tenantId: string): Promise<WebhookEvent | undefined>;
  createWebhookEvent(event: InsertWebhookEvent, tenantId: string): Promise<WebhookEvent>;
  
  // Enhanced Quotes System
  getQuotePackages(tenantId: string): Promise<QuotePackage[]>;
  getQuotePackage(id: string, tenantId: string): Promise<QuotePackage | undefined>;
  createQuotePackage(pkg: InsertQuotePackage, tenantId: string): Promise<QuotePackage>;
  updateQuotePackage(id: string, pkg: Partial<InsertQuotePackage>, tenantId: string): Promise<QuotePackage | undefined>;
  deleteQuotePackage(id: string, tenantId: string): Promise<boolean>;
  
  getQuoteAddons(tenantId: string): Promise<QuoteAddon[]>;
  getQuoteAddon(id: string, tenantId: string): Promise<QuoteAddon | undefined>;
  createQuoteAddon(addon: InsertQuoteAddon, tenantId: string): Promise<QuoteAddon>;
  updateQuoteAddon(id: string, addon: Partial<InsertQuoteAddon>, tenantId: string): Promise<QuoteAddon | undefined>;
  deleteQuoteAddon(id: string, tenantId: string): Promise<boolean>;
  
  getQuoteItems(tenantId: string): Promise<QuoteItem[]>;
  getQuoteItem(id: string, tenantId: string): Promise<QuoteItem | undefined>;
  createQuoteItem(item: InsertQuoteItem, tenantId: string): Promise<QuoteItem>;
  updateQuoteItem(id: string, item: Partial<InsertQuoteItem>, tenantId: string): Promise<QuoteItem | undefined>;
  deleteQuoteItem(id: string, tenantId: string): Promise<boolean>;
  
  getQuoteTokens(tenantId: string): Promise<QuoteToken[]>;
  getQuoteToken(id: string, tenantId: string): Promise<QuoteToken | undefined>;
  getQuoteTokenByToken(token: string): Promise<QuoteToken | undefined>;
  createQuoteToken(token: InsertQuoteToken, tenantId: string): Promise<QuoteToken>;
  updateQuoteToken(id: string, token: Partial<InsertQuoteToken>, tenantId: string): Promise<QuoteToken | undefined>;
  deleteQuoteToken(id: string, tenantId: string): Promise<boolean>;
  
  getQuoteSignatures(tenantId: string): Promise<QuoteSignature[]>;
  getQuoteSignature(id: string, tenantId: string): Promise<QuoteSignature | undefined>;
  createQuoteSignature(signature: InsertQuoteSignature, tenantId: string): Promise<QuoteSignature>;
  updateQuoteSignature(id: string, signature: Partial<InsertQuoteSignature>, tenantId: string): Promise<QuoteSignature | undefined>;
  deleteQuoteSignature(id: string, tenantId: string): Promise<boolean>;
  
  // Quote Extra Info System
  getQuoteExtraInfoFields(tenantId: string): Promise<QuoteExtraInfoField[]>;
  getQuoteExtraInfoField(id: string, tenantId: string): Promise<QuoteExtraInfoField | undefined>;
  createQuoteExtraInfoField(field: InsertQuoteExtraInfoField, tenantId: string): Promise<QuoteExtraInfoField>;
  updateQuoteExtraInfoField(id: string, field: Partial<InsertQuoteExtraInfoField>, tenantId: string): Promise<QuoteExtraInfoField | undefined>;
  deleteQuoteExtraInfoField(id: string, tenantId: string): Promise<boolean>;
  
  getQuoteExtraInfoConfigs(tenantId: string): Promise<QuoteExtraInfoConfig[]>;
  getQuoteExtraInfoConfig(id: string, tenantId: string): Promise<QuoteExtraInfoConfig | undefined>;
  createQuoteExtraInfoConfig(config: InsertQuoteExtraInfoConfig, tenantId: string): Promise<QuoteExtraInfoConfig>;
  updateQuoteExtraInfoConfig(id: string, config: Partial<InsertQuoteExtraInfoConfig>, tenantId: string): Promise<QuoteExtraInfoConfig | undefined>;
  deleteQuoteExtraInfoConfig(id: string, tenantId: string): Promise<boolean>;
  
  getQuoteExtraInfoResponses(tenantId: string): Promise<QuoteExtraInfoResponse[]>;
  getQuoteExtraInfoResponse(id: string, tenantId: string): Promise<QuoteExtraInfoResponse | undefined>;
  createQuoteExtraInfoResponse(response: InsertQuoteExtraInfoResponse, tenantId: string): Promise<QuoteExtraInfoResponse>;
  updateQuoteExtraInfoResponse(id: string, response: Partial<InsertQuoteExtraInfoResponse>, tenantId: string): Promise<QuoteExtraInfoResponse | undefined>;
  deleteQuoteExtraInfoResponse(id: string, tenantId: string): Promise<boolean>;
  
  // Lead Custom Fields System
  getLeadCustomFields(tenantId: string): Promise<LeadCustomField[]>;
  getLeadCustomField(id: string, tenantId: string): Promise<LeadCustomField | undefined>;
  createLeadCustomField(field: InsertLeadCustomField, tenantId: string): Promise<LeadCustomField>;
  updateLeadCustomField(id: string, field: Partial<InsertLeadCustomField>, tenantId: string): Promise<LeadCustomField | undefined>;
  deleteLeadCustomField(id: string, tenantId: string): Promise<boolean>;
  
  getLeadCustomFieldResponses(tenantId: string): Promise<LeadCustomFieldResponse[]>;
  getLeadCustomFieldResponse(id: string, tenantId: string): Promise<LeadCustomFieldResponse | undefined>;
  createLeadCustomFieldResponse(response: InsertLeadCustomFieldResponse, tenantId: string): Promise<LeadCustomFieldResponse>;
  updateLeadCustomFieldResponse(id: string, response: Partial<InsertLeadCustomFieldResponse>, tenantId: string): Promise<LeadCustomFieldResponse | undefined>;
  deleteLeadCustomFieldResponse(id: string, tenantId: string): Promise<boolean>;
  
  // Admin Audit Logs
  getAdminAuditLogs(tenantId: string): Promise<AdminAuditLog[]>;
  getAdminAuditLog(id: string, tenantId: string): Promise<AdminAuditLog | undefined>;
  createAdminAuditLog(log: InsertAdminAuditLog, tenantId: string): Promise<AdminAuditLog>;
  
  // Security and compliance
  getFormSubmissions(tenantId: string): Promise<FormSubmission[]>;
  getFormSubmission(id: string, tenantId: string): Promise<FormSubmission | undefined>;
  createFormSubmission(submission: InsertFormSubmission, tenantId: string): Promise<FormSubmission>;
  updateFormSubmission(id: string, submission: Partial<InsertFormSubmission>, tenantId: string): Promise<FormSubmission | undefined>;
  deleteFormSubmission(id: string, tenantId: string): Promise<boolean>;
  
  getLeadConsents(tenantId: string): Promise<LeadConsent[]>;
  getLeadConsent(id: string, tenantId: string): Promise<LeadConsent | undefined>;
  createLeadConsent(consent: InsertLeadConsent, tenantId: string): Promise<LeadConsent>;
  updateLeadConsent(id: string, consent: Partial<InsertLeadConsent>, tenantId: string): Promise<LeadConsent | undefined>;
  deleteLeadConsent(id: string, tenantId: string): Promise<boolean>;

  // Utility methods for tenant-scoped access
  withTenant(tenantId: string): any; // Returns TenantScopedStorage instance
}