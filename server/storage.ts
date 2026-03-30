import { 
  type User, type InsertUser,
  type Lead, type InsertLead,
  type Contact, type InsertContact,
  type Project, type InsertProject,
  type Quote, type InsertQuote,
  type Contract, type InsertContract,
  type ContractTemplate, type InsertContractTemplate,
  type Invoice, type InsertInvoice,
  type IncomeCategory, type InsertIncomeCategory,
  type InvoiceItem, type InsertInvoiceItem,
  type InvoiceLineItem, type InsertInvoiceLineItem,
  type PaymentSchedule, type InsertPaymentSchedule,
  type PaymentInstallment, type InsertPaymentInstallment,
  type RecurringInvoiceSettings, type InsertRecurringInvoiceSettings,
  type PaymentTransaction, type InsertPaymentTransaction,
  type TaxSettings, type InsertTaxSettings,
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
  type Calendar, type InsertCalendar,
  type Event, type InsertEvent,
  type CalendarIntegration, type InsertCalendarIntegration,
  type CalendarSyncLog, type InsertCalendarSyncLog,
  type Template, type InsertTemplate,
  type LeadCaptureForm, type InsertLeadCaptureForm,
  type LeadStatusHistory, type InsertLeadStatusHistory,
  type EmailSignature, type InsertEmailSignature,
  type EmailProviderCatalog, type InsertEmailProviderCatalog,
  type EmailProviderConfig, type InsertEmailProviderConfig,
  type EmailProviderIntegration, type InsertEmailProviderIntegration,
  type TenantEmailPrefs, type InsertTenantEmailPrefs,
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
  // Lead Custom Fields System types
  type LeadCustomField, type InsertLeadCustomField,
  type LeadCustomFieldResponse, type InsertLeadCustomFieldResponse,
  type AdminAuditLog, type InsertAdminAuditLog,
  // Audit logs
  type AuditLog, type InsertAuditLog,
  // Form submission and consent types
  type FormSubmission, type InsertFormSubmission,
  type LeadConsent, type InsertLeadConsent,
  // Auto-responder types
  type AutoResponderLog, type InsertAutoResponderLog,
  // Custom Contact Fields types
  type ContactFieldDefinition, type InsertContactFieldDefinition,
  type ContactFieldValue, type InsertContactFieldValue,
  // Tags types
  type Tag, type InsertTag,
  // AI-Generated Content types
  type EmailSummary, type InsertEmailSummary,
  type EmailDraft, type InsertEmailDraft,
  type EmailActionItem, type InsertEmailActionItem,
  type UserStyleSample, type InsertUserStyleSample,
  // AI Training & Knowledge Base types
  type AiBusinessContext, type InsertAiBusinessContext,
  type AiKnowledgeBase, type InsertAiKnowledgeBase,
  type AiCustomInstruction, type InsertAiCustomInstruction,
  type AiTrainingDocument, type InsertAiTrainingDocument,
  // Notification System types
  type NotificationSettings, type InsertNotificationSettings,
  type LeadFollowUpNotification, type InsertLeadFollowUpNotification,
  type AutoReplyLog, type InsertAutoReplyLog,
  // AI Onboarding, Media Library, Chat Widget, Scheduler types
  type TenantOnboardingProgress, type InsertTenantOnboardingProgress,
  type MediaLibrary, type InsertMediaLibrary,
  type WidgetSettings, type InsertWidgetSettings,
  type ChatConversation, type InsertChatConversation,
  type ChatMessage, type InsertChatMessage,
  type BookableService, type InsertBookableService,
  type AvailabilitySchedule, type InsertAvailabilitySchedule,
  type ScheduleService, type InsertScheduleService,
  type AvailabilityRule, type InsertAvailabilityRule,
  type ScheduleCalendarCheck, type InsertScheduleCalendarCheck,
  type ScheduleTeamMember, type InsertScheduleTeamMember,
  type Booking, type InsertBooking,
  users, leads, contacts, projects, quotes, contracts, contractTemplates, invoices, incomeCategories, invoiceItems, invoiceLineItems, paymentSchedules, paymentInstallments, recurringInvoiceSettings, paymentTransactions, taxSettings, tasks, emails, emailThreads, activities, automations, 
  members, venues, projectMembers, memberAvailability, memberGroups, memberGroupMembers, performerContracts, repertoire, projectSetlist, projectFiles, projectNotes, smsMessages, 
  messageTemplates, messageThreads, calendars, events, calendarIntegrations, calendarSyncLog, templates, leadCaptureForms,
  leadStatusHistory, emailSignatures, emailProviderCatalog, emailProviderConfigs, emailAccounts, emailProviderIntegrations, tenantEmailPrefs, portalForms, paymentSessions, webhookEvents, tenants,
  // Enhanced Quotes System tables
  quotePackages, quoteAddons, quoteItems, quoteTokens, quoteSignatures,
  // Quote Extra Info System tables
  quoteExtraInfoFields, quoteExtraInfoConfig, quoteExtraInfoResponses,
  // Lead Custom Fields System tables
  leadCustomFields, leadCustomFieldResponses,
  // Admin Audit Logs table
  adminAuditLogs,
  // Audit Logs table
  auditLogs,
  // Security and compliance tables
  formSubmissions, leadConsents, autoResponderLogs,
  // Document views
  documentViews,
  // Custom Contact Fields tables
  contactFieldDefinitions, contactFieldValues,
  // Tags table
  tags,
  // AI-Generated Content tables
  emailSummaries, emailDrafts, emailActionItems, userStyleSamples,
  // AI Training & Knowledge Base tables
  aiBusinessContext, aiKnowledgeBase, aiCustomInstructions, aiTrainingDocuments,
  // User Preferences table
  userPrefs,
  // Notification System tables
  notificationSettings, leadFollowUpNotifications, autoReplyLog,
  // AI Onboarding, Media Library, Chat Widget, Scheduler tables
  tenantOnboardingProgress, mediaLibrary, widgetSettings, chatConversations, chatMessages,
  bookableServices, availabilitySchedules, scheduleServices, availabilityRules, bookings,
  scheduleCalendarChecks, scheduleTeamMembers
} from "@shared/schema";
import crypto from "crypto";
import { TenantScopedStorage } from './utils/tenantScopedStorage';
import { db as poolDb, pool } from './db';
import { eq, and, desc, or, isNull, isNotNull, leftJoin, sql, lte, inArray } from 'drizzle-orm';
import { secureStore } from './src/services/secureStore';
import { validateAndCleanVenueAddress } from '@shared/addressUtils';
import { IStorage } from './types/storage';

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
  getTenantById(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenantSettings(id: string, settings: string): Promise<Tenant | undefined>;
  
  // Users
  getUsers(tenantId: string): Promise<User[]>;
  getUser(id: string, tenantId: string): Promise<User | undefined>;
  getUserGlobal(id: string): Promise<User | undefined>; // Global lookup across all tenants for SUPERADMIN verification
  getUserByUsername(username: string, tenantId: string): Promise<User | undefined>;
  getUserByUsernameGlobal(username: string): Promise<User | undefined>; // Global username check for signup
  getUserByEmailGlobal(email: string): Promise<User | undefined>; // Global email check for signup
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
  
  // Custom Contact Fields
  getContactFieldDefinitions(tenantId: string): Promise<ContactFieldDefinition[]>;
  getContactFieldDefinition(id: string, tenantId: string): Promise<ContactFieldDefinition | undefined>;
  createContactFieldDefinition(field: InsertContactFieldDefinition, tenantId: string): Promise<ContactFieldDefinition>;
  updateContactFieldDefinition(id: string, field: Partial<InsertContactFieldDefinition>, tenantId: string): Promise<ContactFieldDefinition | undefined>;
  deleteContactFieldDefinition(id: string, tenantId: string): Promise<boolean>;
  getContactFieldValues(contactId: string, tenantId: string): Promise<ContactFieldValue[]>;
  getContactFieldValue(contactId: string, fieldDefinitionId: string, tenantId: string): Promise<ContactFieldValue | undefined>;
  setContactFieldValue(value: InsertContactFieldValue, tenantId: string): Promise<ContactFieldValue>;
  deleteContactFieldValue(contactId: string, fieldDefinitionId: string, tenantId: string): Promise<boolean>;
  
  // Tags
  getTags(tenantId: string, category?: string): Promise<Tag[]>;
  getTag(id: string, tenantId: string): Promise<Tag | undefined>;
  getTagByName(name: string, tenantId: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag, tenantId: string): Promise<Tag>;
  updateTag(id: string, tag: Partial<InsertTag>, tenantId: string): Promise<Tag | undefined>;
  deleteTag(id: string, tenantId: string): Promise<boolean>;
  incrementTagUsage(id: string, tenantId: string): Promise<void>;
  
  // Projects
  getProjects(tenantId: string, userId?: string, limit?: number, offset?: number): Promise<Project[]>;
  getProjectsCount(tenantId: string, userId?: string): Promise<number>;
  getProject(id: string, tenantId: string): Promise<Project | undefined>;
  getProjectWithDetails(id: string, tenantId: string): Promise<any>; // Returns project with embedded contact & venue data
  getProjectsByContact(contactId: string, tenantId: string): Promise<Project[]>;
  getProjectsByContacts(contactIds: string[], tenantId: string): Promise<Map<string, Project[]>>; // Batch fetch for multiple contacts
  createProject(project: InsertProject, tenantId: string): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>, tenantId: string): Promise<Project | undefined>;
  deleteProject(id: string, tenantId: string): Promise<boolean>;
  canUserAccessProject(userId: string, tenantId: string, projectId: string): Promise<boolean>;
  getProjectDocumentStatus(projectId: string, tenantId: string): Promise<{
    quotes: { total: number; draft: number; sent: number; approved: number; rejected: number; expired: number };
    contracts: { total: number; draft: number; sent: number; awaitingCounterSignature: number; signed: number; cancelled: number };
    invoices: { total: number; draft: number; sent: number; paid: number; overdue: number; cancelled: number };
  }>;
  
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
  
  // Lead Custom Fields System
  // Lead Custom Field Definitions
  getLeadCustomFields(tenantId: string, userId?: string): Promise<LeadCustomField[]>;
  getLeadCustomField(id: string, tenantId: string): Promise<LeadCustomField | undefined>;
  getLeadCustomFieldByKey(key: string, tenantId: string, userId?: string): Promise<LeadCustomField | undefined>;
  createLeadCustomField(field: InsertLeadCustomField, tenantId: string): Promise<LeadCustomField>;
  updateLeadCustomField(id: string, field: Partial<InsertLeadCustomField>, tenantId: string): Promise<LeadCustomField | undefined>;
  deleteLeadCustomField(id: string, tenantId: string): Promise<boolean>;
  
  // Lead Custom Field Responses (user-submitted values)
  getLeadCustomFieldResponses(leadId: string, tenantId: string): Promise<LeadCustomFieldResponse[]>;
  getLeadCustomFieldResponse(leadId: string, fieldKey: string, tenantId: string): Promise<LeadCustomFieldResponse | undefined>;
  createLeadCustomFieldResponse(response: InsertLeadCustomFieldResponse, tenantId: string): Promise<LeadCustomFieldResponse>;
  updateLeadCustomFieldResponse(leadId: string, fieldKey: string, response: Partial<InsertLeadCustomFieldResponse>, tenantId: string): Promise<LeadCustomFieldResponse | undefined>;
  upsertLeadCustomFieldResponse(response: InsertLeadCustomFieldResponse, tenantId: string): Promise<LeadCustomFieldResponse>;
  deleteLeadCustomFieldResponse(leadId: string, fieldKey: string, tenantId: string): Promise<boolean>;
  
  // Contracts
  getContracts(tenantId: string): Promise<Contract[]>;
  getContract(id: string, tenantId: string): Promise<Contract | undefined>;
  getContractsByClient(clientId: string, tenantId: string): Promise<Contract[]>;
  getContractsByContact(contactId: string, tenantId: string): Promise<Contract[]>;
  createContract(contract: InsertContract, tenantId: string): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>, tenantId: string): Promise<Contract | undefined>;
  deleteContract(id: string, tenantId: string): Promise<boolean>;
  
  // Contract Templates
  getContractTemplates(tenantId: string): Promise<ContractTemplate[]>;
  getContractTemplate(id: string, tenantId: string): Promise<ContractTemplate | undefined>;
  createContractTemplate(template: InsertContractTemplate, tenantId: string): Promise<ContractTemplate>;
  updateContractTemplate(id: string, template: Partial<InsertContractTemplate>, tenantId: string): Promise<ContractTemplate | undefined>;
  deleteContractTemplate(id: string, tenantId: string): Promise<boolean>;
  
  // Document Views
  recordDocumentView(tenantId: string, documentType: string, documentId: string, ipAddress: string | null, userAgent: string | null): Promise<void>;
  getDocumentViews(tenantId: string, documentType: string, documentId: string): Promise<any[]>;
  
  // Invoices
  getInvoices(tenantId: string): Promise<Invoice[]>;
  getInvoice(id: string, tenantId: string): Promise<Invoice | undefined>;
  getInvoicesByClient(clientId: string, tenantId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice, tenantId: string): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>, tenantId: string): Promise<Invoice | undefined>;
  deleteInvoice(id: string, tenantId: string): Promise<boolean>;
  
  // Income Categories
  getIncomeCategories(tenantId: string): Promise<IncomeCategory[]>;
  getIncomeCategory(id: string, tenantId: string): Promise<IncomeCategory | undefined>;
  createIncomeCategory(category: InsertIncomeCategory, tenantId: string): Promise<IncomeCategory>;
  updateIncomeCategory(id: string, category: Partial<InsertIncomeCategory>, tenantId: string): Promise<IncomeCategory | undefined>;
  deleteIncomeCategory(id: string, tenantId: string): Promise<boolean>;
  
  // Invoice Items (Products & Services)
  getInvoiceItems(tenantId: string): Promise<InvoiceItem[]>;
  getInvoiceItem(id: string, tenantId: string): Promise<InvoiceItem | undefined>;
  createInvoiceItem(item: InsertInvoiceItem, tenantId: string): Promise<InvoiceItem>;
  updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>, tenantId: string): Promise<InvoiceItem | undefined>;
  deleteInvoiceItem(id: string, tenantId: string): Promise<boolean>;
  
  // Tax Settings
  getTaxSettings(tenantId: string): Promise<TaxSettings | undefined>;
  createTaxSettings(settings: InsertTaxSettings, tenantId: string): Promise<TaxSettings>;
  updateTaxSettings(tenantId: string, settings: Partial<InsertTaxSettings>): Promise<TaxSettings | undefined>;
  
  // Invoice Line Items
  getInvoiceLineItems(invoiceId: string, tenantId: string): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(item: InsertInvoiceLineItem, tenantId: string): Promise<InvoiceLineItem>;
  deleteInvoiceLineItems(invoiceId: string, tenantId: string): Promise<boolean>;
  
  // Payment Schedules
  getPaymentSchedule(invoiceId: string, tenantId: string): Promise<PaymentSchedule | undefined>;
  createPaymentSchedule(schedule: InsertPaymentSchedule, tenantId: string): Promise<PaymentSchedule>;
  updatePaymentSchedule(id: string, schedule: Partial<InsertPaymentSchedule>, tenantId: string): Promise<PaymentSchedule | undefined>;
  deletePaymentSchedule(id: string, tenantId: string): Promise<boolean>;
  
  // Payment Installments
  getPaymentInstallments(scheduleId: string, tenantId: string): Promise<PaymentInstallment[]>;
  createPaymentInstallment(installment: InsertPaymentInstallment, tenantId: string): Promise<PaymentInstallment>;
  updatePaymentInstallment(id: string, installment: Partial<InsertPaymentInstallment>, tenantId: string): Promise<PaymentInstallment | undefined>;
  deletePaymentInstallments(scheduleId: string, tenantId: string): Promise<boolean>;
  
  // Recurring Invoice Settings
  getRecurringInvoiceSettings(invoiceId: string, tenantId: string): Promise<RecurringInvoiceSettings | undefined>;
  createRecurringInvoiceSettings(settings: InsertRecurringInvoiceSettings, tenantId: string): Promise<RecurringInvoiceSettings>;
  updateRecurringInvoiceSettings(id: string, settings: Partial<InsertRecurringInvoiceSettings>, tenantId: string): Promise<RecurringInvoiceSettings | undefined>;
  deleteRecurringInvoiceSettings(id: string, tenantId: string): Promise<boolean>;
  
  // Payment Transactions
  getPaymentTransactions(invoiceId: string, tenantId: string): Promise<PaymentTransaction[]>;
  createPaymentTransaction(transaction: InsertPaymentTransaction, tenantId: string): Promise<PaymentTransaction>;
  updatePaymentTransaction(id: string, transaction: Partial<InsertPaymentTransaction>, tenantId: string): Promise<PaymentTransaction | undefined>;
  
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
  
  // Auto-responder Logs
  getAutoResponderLogs(tenantId: string): Promise<AutoResponderLog[]>;
  getAutoResponderLog(id: string, tenantId: string): Promise<AutoResponderLog | undefined>;
  getAutoResponderLogsByLead(leadId: string, tenantId: string): Promise<AutoResponderLog[]>;
  getDueAutoResponderLogs(tenantId: string): Promise<AutoResponderLog[]>; // Get logs scheduled to send now or earlier
  createAutoResponderLog(log: InsertAutoResponderLog, tenantId: string): Promise<AutoResponderLog>;
  updateAutoResponderLog(id: string, log: Partial<InsertAutoResponderLog>, tenantId: string): Promise<AutoResponderLog | undefined>;
  
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
  getVenues(tenantId: string, limit?: number, offset?: number): Promise<Venue[]>;
  getVenuesCount(tenantId: string): Promise<number>;
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
  markEventsCancelledForProject(projectId: string, tenantId: string, userId: string): Promise<number>; // Returns count of events marked as cancelled
  markEventsCancelledForContact(contactId: string, tenantId: string, userId: string): Promise<number>; // Returns count of events marked as cancelled
  linkLeadEventsToProject(contactId: string, projectId: string, tenantId: string): Promise<number>; // Returns count of events linked to project (via contact's leadId)
  
  // System Calendars (Leads, Booked, Completed)
  getCalendars(tenantId: string): Promise<Calendar[]>;
  getCalendar(id: string, tenantId: string): Promise<Calendar | undefined>;
  getCalendarByType(type: string, tenantId: string): Promise<Calendar | undefined>;
  createCalendar(calendar: InsertCalendar, tenantId: string): Promise<Calendar>;
  updateCalendar(id: string, calendar: Partial<InsertCalendar>, tenantId: string): Promise<Calendar | undefined>;
  createSystemCalendars(tenantId: string): Promise<Calendar[]>;
  getEventsByCalendar(calendarId: string, tenantId: string): Promise<Event[]>;
  moveEventToCalendar(eventId: string, targetCalendarId: string, tenantId: string): Promise<Event | undefined>;
  checkEventConflict(startDate: Date, endDate: Date, tenantId: string, userId?: string, excludeEventId?: string): Promise<{ hasConflict: boolean; conflictingEvents: Event[] }>;
  
  // Calendar Integrations
  getCalendarIntegrations(tenantId: string): Promise<CalendarIntegration[]>;
  getCalendarIntegrationsByTenant(tenantId: string): Promise<CalendarIntegration[]>;
  getCalendarIntegration(id: string, tenantId: string): Promise<CalendarIntegration | undefined>;
  getCalendarIntegrationsByUser(userId: string, tenantId: string): Promise<CalendarIntegration[]>;
  getCalendarIntegrationByEmail(email: string, userId: string, tenantId: string): Promise<CalendarIntegration | undefined>;
  createCalendarIntegration(integration: InsertCalendarIntegration, tenantId: string): Promise<CalendarIntegration>;
  updateCalendarIntegration(id: string, integration: Partial<InsertCalendarIntegration>, tenantId: string): Promise<CalendarIntegration | undefined>;
  upsertCalendarIntegration(integration: InsertCalendarIntegration, tenantId: string): Promise<CalendarIntegration>;
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
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: string, tenantId: string): Promise<boolean>;

  // Email Signatures
  getUserSignatures(userId: string, tenantId: string): Promise<EmailSignature[]>;
  getSignature(id: string, userId: string, tenantId: string): Promise<EmailSignature | null>;
  getDefaultSignature(userId: string, tenantId: string): Promise<EmailSignature | null>;
  createSignature(signature: InsertEmailSignature, tenantId: string): Promise<EmailSignature>;
  updateSignature(id: string, userId: string, signature: Partial<InsertEmailSignature>, tenantId: string): Promise<EmailSignature | null>;
  deleteSignature(id: string, userId: string, tenantId: string): Promise<boolean>;
  clearDefaultSignatures(userId: string, tenantId: string): Promise<void>;

  // Email Provider Catalog (global provider list)
  getEmailProviderCatalog(): Promise<EmailProviderCatalog[]>;
  getActiveEmailProviders(): Promise<EmailProviderCatalog[]>;
  getEmailProviderByKey(key: string): Promise<EmailProviderCatalog | undefined>;
  seedEmailProviders(providers: Omit<EmailProviderCatalog, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void>;

  // Tenant Email Preferences  
  getTenantEmailPrefs(tenantId: string): Promise<TenantEmailPrefs | null>;
  upsertTenantEmailPrefs(tenantId: string, prefs: Partial<InsertTenantEmailPrefs>): Promise<TenantEmailPrefs>;

  // Email Provider Configurations
  getEmailProviderConfigs(tenantId: string, userId?: string): Promise<EmailProviderConfig[]>;
  getEmailProviderConfig(id: string, tenantId: string): Promise<EmailProviderConfig | undefined>;
  getPrimaryEmailProviderConfig(tenantId: string): Promise<EmailProviderConfig | undefined>;
  getEmailProviderConfigByName(name: string, tenantId: string): Promise<EmailProviderConfig | undefined>;
  createEmailProviderConfig(config: InsertEmailProviderConfig, tenantId: string): Promise<EmailProviderConfig>;
  updateEmailProviderConfig(id: string, config: Partial<InsertEmailProviderConfig>, tenantId: string): Promise<EmailProviderConfig | undefined>;
  deleteEmailProviderConfig(id: string, tenantId: string): Promise<boolean>;

  // Email Provider OAuth Integrations
  getActiveEmailProvider(userId: string, tenantId: string): Promise<EmailProviderIntegration | null>;
  getEmailProviderIntegration(userId: string, tenantId: string, provider: string): Promise<EmailProviderIntegration | null>;
  getAllActiveEmailIntegrations(): Promise<EmailProviderIntegration[]>;
  upsertEmailProviderIntegration(integration: InsertEmailProviderIntegration, tenantId: string): Promise<EmailProviderIntegration>;
  disconnectEmailProvider(userId: string, tenantId: string, provider: string): Promise<boolean>;
  setPrimaryEmailProviderConfig(id: string, tenantId: string): Promise<boolean>;
  updateEmailProviderConfigHealth(id: string, isHealthy: boolean, consecutiveFailures: number, tenantId: string): Promise<boolean>;
  updateEmailProviderConfigUsage(id: string, messagesSent?: number, messagesReceived?: number, tenantId: string): Promise<boolean>;
  updateEmailIntegrationLastSync(userId: string, tenantId: string, provider: string): Promise<boolean>;
  updateEmailIntegrationStatus(userId: string, tenantId: string, provider: string, status: string): Promise<boolean>;

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

  // Admin Audit Logs - SUPERADMIN impersonation tracking
  getAdminAuditLogs(adminUserId?: string, impersonatedUserId?: string, tenantId?: string): Promise<AdminAuditLog[]>;
  getAdminAuditLog(id: string): Promise<AdminAuditLog | undefined>;
  createAdminAuditLog(auditLog: InsertAdminAuditLog): Promise<AdminAuditLog>;

  // Form Submissions - Idempotency tracking for security
  getFormSubmissionByKey(tenantId: string, submissionKey: string): Promise<FormSubmission | undefined>;
  createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission>;
  
  // Lead Consent - GDPR compliance tracking
  createLeadConsent(consent: InsertLeadConsent): Promise<LeadConsent>;
  getLeadConsents(leadId: string, tenantId: string): Promise<LeadConsent[]>;
  updateLeadConsent(id: string, consent: Partial<InsertLeadConsent>, tenantId: string): Promise<LeadConsent | undefined>;

  // Tenant management
  getAllTenants(): Promise<import('@shared/schema').Tenant[]>;

  // Calendar Disconnect Flow
  markEventsAsReadonly(integrationId: string, tenantId: string, userId: string): Promise<number>;
  purgeGoogleEvents(integrationId: string, tenantId: string, userId: string): Promise<number>;
  getDisconnectedIntegrations(tenantId: string, userId: string): Promise<CalendarIntegration[]>;
  
  // Audit Logs
  createAuditLog(auditLog: InsertAuditLog, tenantId: string): Promise<AuditLog>;
  getAuditLogs(tenantId: string, userId?: string, action?: string): Promise<AuditLog[]>;

  // AI-Generated Content
  createEmailSummary(summary: InsertEmailSummary, tenantId: string): Promise<EmailSummary>;
  getEmailSummary(threadId: string, tenantId: string): Promise<EmailSummary | undefined>;
  createEmailDraft(draft: InsertEmailDraft, tenantId: string): Promise<EmailDraft>;
  getEmailDrafts(threadId: string, tenantId: string): Promise<EmailDraft[]>;
  markDraftAsUsed(id: string, tenantId: string): Promise<void>;
  createEmailActionItems(actionItems: InsertEmailActionItem[], tenantId: string): Promise<EmailActionItem[]>;
  getEmailActionItems(emailId: string, tenantId: string): Promise<EmailActionItem[]>;
  getThreadActionItems(threadId: string, tenantId: string): Promise<EmailActionItem[]>;
  updateActionItemStatus(id: string, status: string, tenantId: string): Promise<void>;

  // User Style Samples for AI personalization
  createUserStyleSample(sample: InsertUserStyleSample, tenantId: string): Promise<UserStyleSample>;
  getUserStyleSamples(userId: string, tenantId: string): Promise<UserStyleSample[]>;
  deleteUserStyleSample(id: string, tenantId: string): Promise<boolean>;
  deleteAllUserStyleSamples(userId: string, tenantId: string): Promise<void>;

  // AI Business Context - Guided questionnaire data
  getAiBusinessContext(tenantId: string): Promise<AiBusinessContext | undefined>;
  upsertAiBusinessContext(context: InsertAiBusinessContext, tenantId: string): Promise<AiBusinessContext>;

  // AI Knowledge Base
  getAiKnowledgeBase(tenantId: string, isActive?: boolean): Promise<AiKnowledgeBase[]>;
  getAiKnowledgeBaseItem(id: string, tenantId: string): Promise<AiKnowledgeBase | undefined>;
  createAiKnowledgeBaseItem(item: InsertAiKnowledgeBase, tenantId: string): Promise<AiKnowledgeBase>;
  updateAiKnowledgeBaseItem(id: string, item: Partial<InsertAiKnowledgeBase>, tenantId: string): Promise<AiKnowledgeBase | undefined>;
  deleteAiKnowledgeBaseItem(id: string, tenantId: string): Promise<boolean>;

  // AI Custom Instructions
  getAiCustomInstructions(tenantId: string, isActive?: boolean): Promise<AiCustomInstruction[]>;
  createAiCustomInstruction(instruction: InsertAiCustomInstruction, tenantId: string): Promise<AiCustomInstruction>;
  updateAiCustomInstruction(id: string, instruction: Partial<InsertAiCustomInstruction>, tenantId: string): Promise<AiCustomInstruction | undefined>;
  deleteAiCustomInstruction(id: string, tenantId: string): Promise<boolean>;

  // AI Training Documents
  getAiTrainingDocuments(tenantId: string): Promise<AiTrainingDocument[]>;
  createAiTrainingDocument(doc: InsertAiTrainingDocument, tenantId: string): Promise<AiTrainingDocument>;
  updateAiTrainingDocument(id: string, doc: Partial<InsertAiTrainingDocument>, tenantId: string): Promise<AiTrainingDocument | undefined>;
  deleteAiTrainingDocument(id: string, tenantId: string): Promise<boolean>;

  // User Preferences
  getUserPref(userId: string, key: string, tenantId: string): Promise<{ key: string; value: string } | undefined>;
  setUserPref(userId: string, key: string, value: string, tenantId: string): Promise<void>;

  // Notification System
  getNotificationSettings(tenantId: string, userId?: string): Promise<NotificationSettings | undefined>;
  upsertNotificationSettings(settings: InsertNotificationSettings, tenantId: string): Promise<NotificationSettings>;
  updateNotificationSettings(id: string, settings: Partial<InsertNotificationSettings>, tenantId: string): Promise<NotificationSettings | undefined>;
  
  getLeadNotifications(userId: string, tenantId: string, unreadOnly?: boolean): Promise<LeadFollowUpNotification[]>;
  getLeadNotification(id: string, tenantId: string): Promise<LeadFollowUpNotification | undefined>;
  createLeadNotification(notification: InsertLeadFollowUpNotification, tenantId: string): Promise<LeadFollowUpNotification>;
  markNotificationAsRead(id: string, tenantId: string): Promise<void>;
  markNotificationAsDismissed(id: string, tenantId: string): Promise<void>;
  deleteLeadNotification(id: string, tenantId: string): Promise<boolean>;
  getUnreadNotificationCount(userId: string, tenantId: string): Promise<number>;
  
  getAutoReplyLogs(leadId: string, tenantId: string): Promise<AutoReplyLog[]>;
  getAutoReplyLogsByLeads(leadIds: string[], tenantId: string): Promise<Map<string, AutoReplyLog[]>>;
  createAutoReplyLog(log: InsertAutoReplyLog, tenantId: string): Promise<AutoReplyLog>;

  // Tenant Onboarding Progress
  getTenantOnboardingProgress(tenantId: string): Promise<TenantOnboardingProgress | undefined>;
  createTenantOnboardingProgress(progress: InsertTenantOnboardingProgress, tenantId: string): Promise<TenantOnboardingProgress>;
  updateTenantOnboardingProgress(id: string, progress: Partial<InsertTenantOnboardingProgress>, tenantId: string): Promise<TenantOnboardingProgress | undefined>;
  
  // Media Library
  getMediaLibrary(tenantId: string, category?: string, isActive?: boolean): Promise<MediaLibrary[]>;
  getMediaLibraryItem(id: string, tenantId: string): Promise<MediaLibrary | undefined>;
  createMediaLibraryItem(item: InsertMediaLibrary, tenantId: string): Promise<MediaLibrary>;
  updateMediaLibraryItem(id: string, item: Partial<InsertMediaLibrary>, tenantId: string): Promise<MediaLibrary | undefined>;
  deleteMediaLibraryItem(id: string, tenantId: string): Promise<boolean>;
  
  // Widget Settings
  getWidgetSettings(tenantId: string): Promise<WidgetSettings | undefined>;
  upsertWidgetSettings(settings: InsertWidgetSettings, tenantId: string): Promise<WidgetSettings>;
  
  // Chat Conversations
  getChatConversations(tenantId: string, limit?: number): Promise<ChatConversation[]>;
  getChatConversation(id: string, tenantId: string): Promise<ChatConversation | undefined>;
  getChatConversationBySession(sessionId: string, tenantId: string): Promise<ChatConversation | undefined>;
  createChatConversation(conversation: InsertChatConversation, tenantId: string): Promise<ChatConversation>;
  updateChatConversation(id: string, conversation: Partial<InsertChatConversation>, tenantId: string): Promise<ChatConversation | undefined>;
  
  // Chat Messages
  getChatMessages(conversationId: string, tenantId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage, tenantId: string): Promise<ChatMessage>;
  
  // Bookable Services
  getBookableServices(tenantId: string, isActive?: boolean): Promise<BookableService[]>;
  getBookableService(id: string, tenantId: string): Promise<BookableService | undefined>;
  createBookableService(service: InsertBookableService, tenantId: string): Promise<BookableService>;
  updateBookableService(id: string, service: Partial<InsertBookableService>, tenantId: string): Promise<BookableService | undefined>;
  deleteBookableService(id: string, tenantId: string): Promise<boolean>;
  
  // Availability Schedules
  getAvailabilitySchedules(tenantId: string, isActive?: boolean): Promise<AvailabilitySchedule[]>;
  getAvailabilitySchedule(id: string, tenantId: string): Promise<AvailabilitySchedule | undefined>;
  getAvailabilityScheduleByPublicLink(publicLink: string): Promise<AvailabilitySchedule | undefined>;
  createAvailabilitySchedule(schedule: InsertAvailabilitySchedule, tenantId: string): Promise<AvailabilitySchedule>;
  updateAvailabilitySchedule(id: string, schedule: Partial<InsertAvailabilitySchedule>, tenantId: string): Promise<AvailabilitySchedule | undefined>;
  deleteAvailabilitySchedule(id: string, tenantId: string): Promise<boolean>;
  
  // Schedule Services (many-to-many)
  getScheduleServices(scheduleId: string): Promise<ScheduleService[]>;
  addServiceToSchedule(scheduleService: InsertScheduleService): Promise<ScheduleService>;
  removeServiceFromSchedule(scheduleId: string, serviceId: string): Promise<boolean>;
  
  // Availability Rules
  getAvailabilityRules(scheduleId: string): Promise<AvailabilityRule[]>;
  createAvailabilityRule(rule: InsertAvailabilityRule): Promise<AvailabilityRule>;
  updateAvailabilityRule(id: string, rule: Partial<InsertAvailabilityRule>): Promise<AvailabilityRule | undefined>;
  deleteAvailabilityRule(id: string): Promise<boolean>;
  
  // Schedule Calendar Checks
  getScheduleCalendarChecks(scheduleId: string): Promise<ScheduleCalendarCheck[]>;
  addCalendarCheck(check: InsertScheduleCalendarCheck): Promise<ScheduleCalendarCheck>;
  removeCalendarCheck(scheduleId: string, calendarIntegrationId: string): Promise<boolean>;
  
  // Schedule Team Members
  getScheduleTeamMembers(scheduleId: string): Promise<ScheduleTeamMember[]>;
  addTeamMember(member: InsertScheduleTeamMember): Promise<ScheduleTeamMember>;
  removeTeamMember(scheduleId: string, memberId: string): Promise<boolean>;
  
  // Bookings
  getBookings(tenantId: string, filters?: { contactId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<Booking[]>;
  getBooking(id: string, tenantId: string): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking, tenantId: string): Promise<Booking>;
  updateBooking(id: string, booking: Partial<InsertBooking>, tenantId: string): Promise<Booking | undefined>;
  cancelBooking(id: string, cancelledBy: string, cancellationReason: string, tenantId: string): Promise<Booking | undefined>;

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
  private inMemoryContractTemplates: Map<string, ContractTemplate> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private incomeCategories: Map<string, IncomeCategory> = new Map();
  private invoiceItems: Map<string, InvoiceItem> = new Map();
  private taxSettingsMap: Map<string, TaxSettings> = new Map();
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
  private calendars: Map<string, Calendar> = new Map();
  private events: Map<string, Event> = new Map();
  private calendarIntegrations: Map<string, CalendarIntegration> = new Map();
  private calendarSyncLogs: Map<string, CalendarSyncLog> = new Map();
  private templates: Map<string, Template> = new Map();
  private leadCaptureForms: Map<string, LeadCaptureForm> = new Map();
  private emailSignatures: Map<string, EmailSignature> = new Map();
  private emailProviderConfigs: Map<string, EmailProviderConfig> = new Map();
  private adminAuditLogs: Map<string, AdminAuditLog> = new Map();
  private tenants: Map<string, import('@shared/schema').Tenant> = new Map();
  // Security and compliance storage
  private formSubmissions: Map<string, FormSubmission> = new Map();
  private leadConsents: Map<string, LeadConsent> = new Map();

  constructor() {
    // Initialize with default admin user (DEVELOPMENT ONLY)
    // TODO: In production, remove this default user or require strong random credentials via environment variables
    if (process.env.NODE_ENV !== 'production') {
      const defaultUserId = "feeaaeef-9bbb-4d93-9de1-313db0c223cd"; // Match the session user ID
      const defaultUser: User = {
        id: defaultUserId,
        username: "admin",
        password: "$2b$12$SM67YK8RyHHkIISwIXS/OOjT5FQiKCOrMBRXzBljj4JlIqD6e/mhi", // bcrypt hashed "password" - CHANGE IN PRODUCTION
        email: "admin@localhost.dev",
        role: "super_admin",
        firstName: "Admin",
        lastName: "User",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1pYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
        createdAt: new Date(),
        tenantId: "default-tenant",
      };
      this.users.set(defaultUser.id, defaultUser);

      // Add test user for public demo
      const testUserId = "test-user-id-123";
      const testUser: User = {
        id: testUserId,
        username: "test@example.com", 
        password: "$2b$12$WTf3VAZeYeOufKqH9T1xQudck3V8mbN6MG88u/a1cwL2hIai8jpR2", // bcrypt hashed "testpass123"
        email: "test@example.com",
        role: "admin",
        firstName: "Test",
        lastName: "User",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b739?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
        createdAt: new Date(),
        tenantId: "default-tenant",
      };
      this.users.set(testUser.id, testUser);
    
      // Initialize default tenant for development
      const defaultTenant: import('@shared/schema').Tenant = {
        id: 'default-tenant',
        name: 'Default Tenant',
        slug: 'default',
        domain: null,
        isActive: true,
        plan: 'starter',
        settings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.tenants.set(defaultTenant.id, defaultTenant);
      
      // Add sample data for immediate access
      const tenantId = "default-tenant";
      
      // Sample contacts
      this.contacts.set("contact-1", {
        id: "contact-1",
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@example.com",
        phone: "+1 555 0123",
        company: "Smith Events Ltd",
        status: "active",
        tenantId,
        userId: defaultUserId,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        updatedAt: new Date(),
      });

      this.contacts.set("contact-2", {
        id: "contact-2", 
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah.johnson@weddings.com",
        phone: "+1 555 0456",
        company: "Johnson Weddings",
        status: "active",
        tenantId,
        userId: defaultUserId,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        updatedAt: new Date(),
      });

      // Sample projects
      this.projects.set("project-1", {
        id: "project-1",
        name: "Summer Music Festival 2024",
        description: "Annual outdoor music festival with multiple stages",
        status: "active",
        startDate: new Date(2024, 5, 15), // June 15, 2024
        endDate: new Date(2024, 5, 17), // June 17, 2024
        budget: "50000.00",
        clientContactId: "contact-1",
        tenantId,
        userId: defaultUserId,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        updatedAt: new Date(),
      });

      this.projects.set("project-2", {
        id: "project-2",
        name: "Corporate Conference 2024",
        description: "Annual company conference and networking event",
        status: "planning",
        startDate: new Date(2024, 8, 10), // September 10, 2024
        endDate: new Date(2024, 8, 12), // September 12, 2024
        budget: "25000.00",
        clientContactId: "contact-2",
        tenantId,
        userId: defaultUserId,
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        updatedAt: new Date(),
      });

      // Sample venues
      this.venues.set("venue-1", {
        id: "venue-1",
        name: "Stratton Court Barn",
        description: "Beautiful rustic barn venue perfect for weddings and events",
        address: "123 Country Lane",
        city: "Countryside",
        state: "CA",
        zipCode: "90210",
        country: "USA",
        capacity: 150,
        pricePerHour: "200.00",
        amenities: ["Parking", "Kitchen", "Restrooms", "Dance Floor"],
        contactEmail: "info@strattoncourt.com",
        contactPhone: "+1 555 0789",
        tenantId,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        updatedAt: new Date(),
      });

      this.venues.set("venue-2", {
        id: "venue-2",
        name: "The Post Barn",
        description: "Historic converted barn with modern amenities",
        address: "456 Heritage Road",
        city: "Historic District",
        state: "CA",
        zipCode: "90211",
        country: "USA", 
        capacity: 200,
        pricePerHour: "300.00",
        amenities: ["Parking", "Catering Kitchen", "Bridal Suite", "Sound System"],
        contactEmail: "events@thepostbarn.com",
        contactPhone: "+1 555 0321",
        tenantId,
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
        updatedAt: new Date(),
      });

      // Sample lead with venue information (matching existing session data)
      this.leads.set("lead-1", {
        id: "lead-1",
        firstName: "Gareth",
        lastName: "Gwyn",
        email: "gareth.gwyn@example.com",
        phone: "+1 555 0987",
        status: "new",
        leadSource: "website",
        notes: "Wedding - Gareth Gwyn at venue location",
        projectDate: new Date(2024, 5, 20),
        estimatedValue: "15000.00",
        eventLocation: "Stratton Court Barn", // Add venue information
        eventType: "Wedding",
        tenantId,
        userId: defaultUserId,
        assignedTo: defaultUserId,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        updatedAt: new Date(),
      });
    }
  }

  // Tenant methods (required by tenant resolver)
  async getActiveTenants(): Promise<{ id: string; name: string; slug: string }[]> {
    return Array.from(this.tenants.values())
      .filter(tenant => tenant.isActive)
      .map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      }));
  }

  async getTenantBySlug(slug: string): Promise<import('@shared/schema').Tenant | undefined> {
    return Array.from(this.tenants.values())
      .find(tenant => tenant.slug === slug && tenant.isActive);
  }

  async getTenantByDomain(domain: string): Promise<import('@shared/schema').Tenant | undefined> {
    return Array.from(this.tenants.values())
      .find(tenant => tenant.domain === domain && tenant.isActive);
  }

  async getTenant(id: string): Promise<import('@shared/schema').Tenant | undefined> {
    return this.tenants.get(id);
  }

  async getTenantById(id: string): Promise<import('@shared/schema').Tenant | undefined> {
    return this.tenants.get(id);
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const { randomUUID } = await import('crypto');
    const id = randomUUID();
    const newTenant: Tenant = {
      ...tenant,
      id,
      isActive: tenant.isActive ?? true,
      plan: tenant.plan ?? 'starter',
      domain: tenant.domain ?? null,
      settings: tenant.settings ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.tenants.set(id, newTenant);
    return newTenant;
  }

  async updateTenantSettings(id: string, settings: string): Promise<import('@shared/schema').Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;
    
    const updated = { ...tenant, settings, updatedAt: new Date() };
    this.tenants.set(id, updated);
    return updated;
  }

  // Users
  async getUsers(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.tenantId === tenantId || !user.tenantId);
  }

  async getUser(id: string, tenantId: string): Promise<User | undefined> {
    const user = this.users.get(id);
    return (user && (user.tenantId === tenantId || !user.tenantId)) ? user : undefined;
  }

  async getUserGlobal(id: string): Promise<User | undefined> {
    // Global lookup across all tenants for SUPERADMIN verification
    return this.users.get(id);
  }

  async getUserByUsername(username: string, tenantId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => 
      user.username === username && (user.tenantId === tenantId || !user.tenantId)
    );
  }

  async getUserByUsernameGlobal(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmailGlobal(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
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

  async updateLead(id: string, leadUpdate: Partial<InsertLead>, tenantId: string): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead || lead.tenantId !== tenantId) return undefined;
    
    const updatedLead: Lead = {
      ...lead,
      ...omitUndefined(leadUpdate),
      updatedAt: new Date(),
    };
    this.leads.set(id, updatedLead);
    return updatedLead;
  }

  async deleteLead(id: string, tenantId: string): Promise<boolean> {
    const lead = this.leads.get(id);
    if (!lead || lead.tenantId !== tenantId) return false;
    return this.leads.delete(id);
  }

  async createLeadStatusHistory(history: InsertLeadStatusHistory): Promise<LeadStatusHistory> {
    const id = crypto.randomUUID();
    const entry: LeadStatusHistory = {
      id,
      ...history,
      createdAt: new Date(),
    };
    return entry;
  }

  // Contacts
  async getContacts(tenantId: string, userId?: string): Promise<Contact[]> {
    let contacts = Array.from(this.contacts.values()).filter(contact => 
      contact.tenantId === tenantId || !contact.tenantId
    );
    if (userId) {
      contacts = contacts.filter(contact => contact.userId === userId);
    }
    return contacts.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getContactsCount(tenantId: string, userId?: string): Promise<number> {
    let contacts = Array.from(this.contacts.values()).filter(contact => 
      contact.tenantId === tenantId || !contact.tenantId
    );
    if (userId) {
      contacts = contacts.filter(contact => contact.userId === userId);
    }
    return contacts.length;
  }

  async getContact(id: string, tenantId: string): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    return (contact && contact.tenantId === tenantId) ? contact : undefined;
  }

  async createContact(insertContact: InsertContact, tenantId: string): Promise<Contact> {
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
      tenantId,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, contactUpdate: Partial<InsertContact>, tenantId: string): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact || contact.tenantId !== tenantId) return undefined;
    
    const updatedContact: Contact = {
      ...contact,
      ...omitUndefined(contactUpdate),
      updatedAt: new Date(),
    };
    this.contacts.set(id, updatedContact);
    return updatedContact;
  }

  async deleteContact(id: string, tenantId: string): Promise<boolean> {
    const contact = this.contacts.get(id);
    if (!contact || contact.tenantId !== tenantId) return false;
    return this.contacts.delete(id);
  }

  async getContactByEmail(email: string, tenantId: string): Promise<Contact | undefined> {
    return Array.from(this.contacts.values()).find(contact => 
      contact.email === email && contact.tenantId === tenantId
    );
  }

  async getContactById(id: string, tenantId: string): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    return (contact && contact.tenantId === tenantId) ? contact : undefined;
  }

  // Projects
  async getProjects(tenantId: string, userId?: string): Promise<Project[]> {
    let projects = Array.from(this.projects.values()).filter(project => 
      project.tenantId === tenantId || !project.tenantId
    );
    if (userId) {
      projects = projects.filter(project => project.userId === userId || project.assignedTo === userId);
    }
    
    // Include venue information by joining with venues
    const projectsWithVenues = projects.map(project => {
      if (project.venueId) {
        const venue = this.venues.get(project.venueId);
        if (venue && venue.tenantId === tenantId) {
          return {
            ...project,
            venue_name: venue.name,
            venue_address: venue.address,
            venue_city: venue.city,
            venue_state: venue.state,
            venue_zip_code: venue.zipCode,
            venue_country: venue.country,
            venue_phone: venue.contactPhone
          } as any;
        }
      }
      return project;
    });
    
    return projectsWithVenues.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getProjectsCount(tenantId: string, userId?: string): Promise<number> {
    let projects = Array.from(this.projects.values()).filter(project => 
      project.tenantId === tenantId || !project.tenantId
    );
    if (userId) {
      projects = projects.filter(project => project.userId === userId || project.assignedTo === userId);
    }
    return projects.length;
  }

  async getProject(id: string, tenantId: string): Promise<Project | undefined> {
    const project = this.projects.get(id);
    return (project && project.tenantId === tenantId) ? project : undefined;
  }

  async getProjectWithDetails(id: string, tenantId: string): Promise<any> {
    const project = await this.getProject(id, tenantId);
    if (!project) return undefined;
    
    const contact = project.contactId ? await this.getContact(project.contactId, tenantId) : null;
    const venue = project.venueId ? this.venues.get(project.venueId) : null;
    
    return {
      ...project,
      contactFirstName: contact?.firstName,
      contactLastName: contact?.lastName,
      contactEmail: contact?.email,
      contactPhone: contact?.phone,
      contactAddress: contact?.address,
      contactJobTitle: contact?.jobTitle,
      contactWebsite: contact?.website,
      venueName: venue?.name,
      venueAddress: venue?.address,
      venueCity: venue?.city,
      venueState: venue?.state,
    };
  }

  async getProjectsByContact(contactId: string, tenantId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(project => 
      project.contactId === contactId && project.tenantId === tenantId
    );
  }

  async getProjectsByContacts(contactIds: string[], tenantId: string): Promise<Map<string, Project[]>> {
    const result = new Map<string, Project[]>();
    
    // Initialize empty arrays for all contact IDs
    contactIds.forEach(id => result.set(id, []));
    
    // Group projects by contact ID
    Array.from(this.projects.values()).forEach(project => {
      if (project.tenantId === tenantId && contactIds.includes(project.contactId)) {
        const existing = result.get(project.contactId) || [];
        existing.push(project);
        result.set(project.contactId, existing);
      }
    });
    
    return result;
  }

  async getActiveProjectsByContact(contactId: string, tenantId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(project => 
      project.contactId === contactId && 
      project.tenantId === tenantId &&
      project.status === 'active'
    );
  }

  async createProject(insertProject: InsertProject, tenantId: string): Promise<Project> {
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
      tenantId,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, projectUpdate: Partial<InsertProject>, tenantId: string): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project || project.tenantId !== tenantId) return undefined;
    
    const updatedProject: Project = {
      ...project,
      ...omitUndefined(projectUpdate),
      updatedAt: new Date(),
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string, tenantId: string): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project || project.tenantId !== tenantId) return false;
    return this.projects.delete(id);
  }
  
  async canUserAccessProject(userId: string, tenantId: string, projectId: string): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project || project.tenantId !== tenantId) {
      return false;
    }
    // For MemStorage, just check ownership or allow all users in same tenant
    if (project.userId === userId || project.assignedTo === userId) {
      return true;
    }
    // For development, allow all authenticated users in the same tenant
    return true;
  }

  async getProjectDocumentStatus(projectId: string, tenantId: string) {
    // Get all quotes for the project
    const projectQuotes = Array.from(this.quotes.values()).filter(
      q => q.tenantId === tenantId && (q as any).projectId === projectId
    );
    
    // Get all contracts for the project
    const projectContracts = Array.from(this.contracts.values()).filter(
      c => c.tenantId === tenantId && c.projectId === projectId
    );
    
    // Get all invoices for the project
    const projectInvoices = Array.from(this.invoices.values()).filter(
      i => i.tenantId === tenantId && i.projectId === projectId
    );
    
    return {
      quotes: {
        total: projectQuotes.length,
        draft: projectQuotes.filter(q => q.status === 'draft').length,
        sent: projectQuotes.filter(q => q.status === 'sent').length,
        approved: projectQuotes.filter(q => q.status === 'approved').length,
        rejected: projectQuotes.filter(q => q.status === 'rejected').length,
        expired: projectQuotes.filter(q => q.status === 'expired').length,
      },
      contracts: {
        total: projectContracts.length,
        draft: projectContracts.filter(c => c.status === 'draft').length,
        sent: projectContracts.filter(c => c.status === 'sent').length,
        awaitingCounterSignature: projectContracts.filter(c => c.status === 'awaiting_counter_signature').length,
        signed: projectContracts.filter(c => c.status === 'signed').length,
        cancelled: projectContracts.filter(c => c.status === 'cancelled').length,
      },
      invoices: {
        total: projectInvoices.length,
        draft: projectInvoices.filter(i => i.status === 'draft').length,
        sent: projectInvoices.filter(i => i.status === 'sent').length,
        paid: projectInvoices.filter(i => i.status === 'paid').length,
        overdue: projectInvoices.filter(i => i.status === 'overdue').length,
        cancelled: projectInvoices.filter(i => i.status === 'cancelled').length,
      },
    };
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

  async getQuotesByContact(contactId: string, tenantId?: string): Promise<Quote[]> {
    return Array.from(this.quotes.values()).filter(quote => 
      quote.contactId === contactId && (!tenantId || quote.tenantId === tenantId)
    );
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

  async getContractsByClient(clientId: string, tenantId?: string): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter(contract => 
      contract.contactId === clientId && (!tenantId || contract.tenantId === tenantId)
    );
  }

  async getContractsByContact(contactId: string): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter(contract => contract.contactId === contactId);
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

  // Contract Templates
  async getContractTemplates(tenantId: string): Promise<ContractTemplate[]> {
    return Array.from(this.inMemoryContractTemplates.values())
      .filter(t => t.tenantId === tenantId)
      .sort((a, b) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
  }

  async getContractTemplate(id: string, tenantId: string): Promise<ContractTemplate | undefined> {
    const template = this.inMemoryContractTemplates.get(id);
    if (template && template.tenantId === tenantId) {
      return template;
    }
    return undefined;
  }

  async createContractTemplate(insertTemplate: InsertContractTemplate, tenantId: string): Promise<ContractTemplate> {
    const id = randomUUID();
    const template: ContractTemplate = {
      ...insertTemplate,
      id,
      tenantId,
      isDefault: insertTemplate.isDefault ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inMemoryContractTemplates.set(id, template);
    return template;
  }

  async updateContractTemplate(id: string, updates: Partial<InsertContractTemplate>, tenantId: string): Promise<ContractTemplate | undefined> {
    const template = this.inMemoryContractTemplates.get(id);
    if (!template || template.tenantId !== tenantId) return undefined;

    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date(),
    };
    this.contractTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteContractTemplate(id: string, tenantId: string): Promise<boolean> {
    const template = this.inMemoryContractTemplates.get(id);
    if (template && template.tenantId === tenantId) {
      return this.inMemoryContractTemplates.delete(id);
    }
    return false;
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

  // Income Categories
  async getIncomeCategories(tenantId: string): Promise<IncomeCategory[]> {
    const categories = Array.from(this.incomeCategories.values())
      .filter(category => category.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    
    // Auto-seed predefined categories if none exist for this tenant
    if (categories.length === 0) {
      const predefinedCategories = [
        { name: 'Sales', isSystem: true },
        { name: 'Services', isSystem: true },
        { name: 'Rentals', isSystem: true },
        { name: 'Other', isSystem: true },
      ];
      
      const seededCategories = await Promise.all(
        predefinedCategories.map(cat => 
          this.createIncomeCategory(cat, tenantId)
        )
      );
      
      return seededCategories;
    }
    
    return categories;
  }

  async getIncomeCategory(id: string, tenantId: string): Promise<IncomeCategory | undefined> {
    const category = this.incomeCategories.get(id);
    if (category && category.tenantId === tenantId) {
      return category;
    }
    return undefined;
  }

  async createIncomeCategory(insertCategory: InsertIncomeCategory, tenantId: string): Promise<IncomeCategory> {
    const id = randomUUID();
    const category: IncomeCategory = {
      ...insertCategory,
      id,
      tenantId,
      isSystem: insertCategory.isSystem ?? false,
      isActive: insertCategory.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.incomeCategories.set(id, category);
    return category;
  }

  async updateIncomeCategory(id: string, categoryUpdate: Partial<InsertIncomeCategory>, tenantId: string): Promise<IncomeCategory | undefined> {
    const category = this.incomeCategories.get(id);
    if (!category || category.tenantId !== tenantId) return undefined;
    
    const updatedCategory: IncomeCategory = {
      ...category,
      ...omitUndefined(categoryUpdate),
      updatedAt: new Date(),
    };
    this.incomeCategories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteIncomeCategory(id: string, tenantId: string): Promise<boolean> {
    const category = this.incomeCategories.get(id);
    if (!category || category.tenantId !== tenantId) return false;
    return this.incomeCategories.delete(id);
  }

  // Invoice Items (Products & Services)
  async getInvoiceItems(tenantId: string): Promise<InvoiceItem[]> {
    return Array.from(this.invoiceItems.values())
      .filter(item => item.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getInvoiceItem(id: string, tenantId: string): Promise<InvoiceItem | undefined> {
    const item = this.invoiceItems.get(id);
    if (item && item.tenantId === tenantId) {
      return item;
    }
    return undefined;
  }

  async createInvoiceItem(insertItem: InsertInvoiceItem, tenantId: string): Promise<InvoiceItem> {
    const id = randomUUID();
    const item: InvoiceItem = {
      ...insertItem,
      id,
      tenantId,
      description: insertItem.description ?? null,
      isTaxable: insertItem.isTaxable ?? true,
      incomeCategoryId: insertItem.incomeCategoryId ?? null,
      workflowId: insertItem.workflowId ?? null,
      photoUrl: insertItem.photoUrl ?? null,
      isActive: insertItem.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.invoiceItems.set(id, item);
    return item;
  }

  async updateInvoiceItem(id: string, itemUpdate: Partial<InsertInvoiceItem>, tenantId: string): Promise<InvoiceItem | undefined> {
    const item = this.invoiceItems.get(id);
    if (!item || item.tenantId !== tenantId) return undefined;
    
    const updatedItem: InvoiceItem = {
      ...item,
      ...omitUndefined(itemUpdate),
      updatedAt: new Date(),
    };
    this.invoiceItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteInvoiceItem(id: string, tenantId: string): Promise<boolean> {
    const item = this.invoiceItems.get(id);
    if (!item || item.tenantId !== tenantId) return false;
    return this.invoiceItems.delete(id);
  }

  // Tax Settings
  async getTaxSettings(tenantId: string): Promise<TaxSettings | undefined> {
    return Array.from(this.taxSettingsMap.values())
      .find(settings => settings.tenantId === tenantId);
  }

  async createTaxSettings(insertSettings: InsertTaxSettings, tenantId: string): Promise<TaxSettings> {
    const id = randomUUID();
    const settings: TaxSettings = {
      ...insertSettings,
      id,
      tenantId,
      taxName: insertSettings.taxName ?? 'VAT',
      taxRate: insertSettings.taxRate ?? '20.00',
      isEnabled: insertSettings.isEnabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.taxSettingsMap.set(id, settings);
    return settings;
  }

  async updateTaxSettings(tenantId: string, settingsUpdate: Partial<InsertTaxSettings>): Promise<TaxSettings | undefined> {
    const existing = await this.getTaxSettings(tenantId);
    if (!existing) return undefined;
    
    const updatedSettings: TaxSettings = {
      ...existing,
      ...omitUndefined(settingsUpdate),
      updatedAt: new Date(),
    };
    this.taxSettingsMap.set(existing.id, updatedSettings);
    return updatedSettings;
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

  // Emails - with optional contacts-only filtering
  async getEmails(tenantId?: string, options?: { userId?: string; limit?: number; contactsOnly?: boolean }): Promise<Email[]> {
    let filteredEmails = Array.from(this.emails.values());
    
    // Filter by tenant if provided
    if (tenantId) {
      filteredEmails = filteredEmails.filter(email => email.tenantId === tenantId);
    }
    
    // Filter by user if provided
    if (options?.userId) {
      filteredEmails = filteredEmails.filter(email => email.userId === options.userId);
    }
    
    // CONTACTS-ONLY FILTERING: Only return emails with contact_id
    if (options?.contactsOnly) {
      filteredEmails = filteredEmails.filter(email => email.contactId !== null && email.contactId !== undefined);
    }
    
    // Sort by creation date descending
    filteredEmails.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
    
    // Apply limit if provided
    if (options?.limit) {
      filteredEmails = filteredEmails.slice(0, options.limit);
    }
    
    return filteredEmails;
  }

  async getEmail(id: string, tenantId?: string): Promise<Email | undefined> {
    const email = this.emails.get(id);
    if (!email) return undefined;
    
    // Verify tenant access if tenantId provided
    if (tenantId && email.tenantId !== tenantId) {
      return undefined;
    }
    
    return email;
  }

  async getEmailsByThread(threadId: string, tenantId: string): Promise<Email[]> {
    return Array.from(this.emails.values()).filter(email => email.threadId === threadId && email.tenantId === tenantId);
  }

  async getEmailsByClient(clientId: string): Promise<Email[]> {
    return Array.from(this.emails.values()).filter(email => email.clientId === clientId);
  }

  async createEmail(insertEmail: InsertEmail, tenantId: string): Promise<Email> {
    // RUNTIME GUARD: Ensure contactId is present for contacts-only ingestion
    if (!insertEmail.contactId) {
      console.warn('🚫 INGESTION GUARD: Skipped orphaned email without contact_id:', insertEmail.subject);
      throw new Error('CONTACTS_ONLY_VIOLATION: contactId required for email creation');
    }
    
    const id = randomUUID();
    const email: Email = {
      ...insertEmail,
      status: insertEmail.status ?? 'draft',
      leadId: insertEmail.leadId ?? null,
      contactId: insertEmail.contactId,
      clientId: insertEmail.clientId ?? null,
      projectId: insertEmail.projectId ?? null,
      threadId: insertEmail.threadId ?? null,
      ccEmails: insertEmail.ccEmails ?? null,
      bccEmails: insertEmail.bccEmails ?? null,
      sentAt: insertEmail.sentAt ?? null,
      sentBy: insertEmail.sentBy ?? null,
      tenantId,
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

  async getRecentActivities(tenantId: string, limit: number = 10): Promise<Activity[]> {
    const activities = await this.getActivities();
    return activities
      .filter(a => (a as any).tenantId === tenantId)
      .slice(0, limit);
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
  async getMembers(tenantId: string): Promise<Member[]> {
    return Array.from(this.members.values())
      .filter(member => member.tenantId === tenantId)
      .sort((a, b) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
  }

  async getMember(id: string, tenantId: string): Promise<Member | undefined> {
    const member = this.members.get(id);
    return member && member.tenantId === tenantId ? member : undefined;
  }

  async createMember(insertMember: InsertMember, tenantId: string): Promise<Member> {
    const id = randomUUID();
    const member: Member = {
      ...insertMember,
      tenantId,
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

  async updateMember(id: string, memberUpdate: Partial<InsertMember>, tenantId: string): Promise<Member | undefined> {
    const member = this.members.get(id);
    if (!member || member.tenantId !== tenantId) return undefined;
    
    const updatedMember: Member = {
      ...member,
      ...omitUndefined(memberUpdate),
      updatedAt: new Date(),
    };
    this.members.set(id, updatedMember);
    return updatedMember;
  }

  async deleteMember(id: string, tenantId: string): Promise<boolean> {
    const member = this.members.get(id);
    if (!member || member.tenantId !== tenantId) return false;
    return this.members.delete(id);
  }

  // Venues
  async getVenues(tenantId: string, limit?: number, offset?: number): Promise<Venue[]> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    let venuesList = Array.from(this.venues.values())
      .filter(venue => venue.tenantId === tenantId)
      .sort((a, b) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
    
    if (offset !== undefined) {
      venuesList = venuesList.slice(offset);
    }
    if (limit !== undefined) {
      venuesList = venuesList.slice(0, limit);
    }
    
    return venuesList;
  }

  async getVenuesCount(tenantId: string): Promise<number> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    return Array.from(this.venues.values()).filter(venue => venue.tenantId === tenantId).length;
  }

  async getVenue(id: string, tenantId: string): Promise<Venue | undefined> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    const venue = this.venues.get(id);
    return venue && venue.tenantId === tenantId ? venue : undefined;
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
    
    let processedUpdate = { ...venueUpdate };
    
    // Apply address cleaning if any address fields are being updated
    const addressFields = ['name', 'address', 'city', 'state', 'zipCode', 'country'];
    const hasAddressUpdate = addressFields.some(field => processedUpdate[field as keyof InsertVenue] !== undefined);
    
    if (hasAddressUpdate) {
      const currentData = { ...venue, ...omitUndefined(venueUpdate) };
      const cleanedAddress = validateAndCleanVenueAddress({
        venueName: currentData.name || '',
        address: currentData.address || undefined,
        city: currentData.city || undefined,
        state: currentData.state || undefined,
        zipCode: currentData.zipCode || undefined,
        country: currentData.country || undefined
      });
      
      // Apply cleaned address data to the update
      if (processedUpdate.address !== undefined) processedUpdate.address = cleanedAddress.address;
      if (processedUpdate.city !== undefined) processedUpdate.city = cleanedAddress.city;
      if (processedUpdate.state !== undefined) processedUpdate.state = cleanedAddress.state;
      if (processedUpdate.zipCode !== undefined) processedUpdate.zipCode = cleanedAddress.zipCode;
      if (processedUpdate.country !== undefined) processedUpdate.country = cleanedAddress.country;
    }
    
    const updatedVenue: Venue = {
      ...venue,
      ...omitUndefined(processedUpdate),
      updatedAt: new Date(),
    };
    this.venues.set(id, updatedVenue);
    return updatedVenue;
  }

  async deleteVenue(id: string): Promise<boolean> {
    return this.venues.delete(id);
  }

  // Project Members
  async getProjectMembers(projectId: string, tenantId: string): Promise<ProjectMember[]> {
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
  async getProjectNotes(projectId: string, tenantId: string): Promise<ProjectNote[]> {
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
  async getEvents(tenantId: string): Promise<Event[]> {
    console.log('📅 EVENTS FETCH (MemStorage)', {
      action: 'getEvents',
      tenantId,
      timestamp: new Date().toISOString()
    });
    
    const filtered = Array.from(this.events.values())
      .filter(event => event.tenantId === tenantId)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
    console.log('📊 EVENTS FETCH RESULTS (MemStorage)', {
      action: 'getEvents',
      tenantId,
      eventsFound: filtered.length,
      timestamp: new Date().toISOString()
    });
    
    return filtered;
  }

  async getEvent(id: string, tenantId: string): Promise<Event | undefined> {
    const event = this.events.get(id);
    return (event && event.tenantId === tenantId) ? event : undefined;
  }

  async getEventsByUser(userId: string, tenantId: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => 
      event.tenantId === tenantId &&
      (event.assignedTo === userId || event.createdBy === userId)
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

  async createEvent(insertEvent: InsertEvent, tenantId: string): Promise<Event> {
    // Structured log for tenant-scoped event creation (MemStorage)
    console.log('📅 EVENT CREATION (MemStorage)', {
      action: 'createEvent',
      tenantId,
      eventTitle: insertEvent.title,
      eventType: insertEvent.type || 'meeting',
      calendarIntegrationId: insertEvent.calendarIntegrationId || null,
      timestamp: new Date().toISOString()
    });
    
    const id = randomUUID();
    const event: Event = {
      ...insertEvent,
      tenantId, // Always include tenantId for tenant isolation
      type: insertEvent.type ?? 'meeting',
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
    
    console.log('✅ EVENT CREATED (MemStorage)', {
      action: 'createEvent',
      tenantId,
      eventId: event.id,
      eventTitle: event.title,
      hasTenantId: !!event.tenantId,
      timestamp: new Date().toISOString()
    });
    
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, eventUpdate: Partial<InsertEvent>, tenantId: string): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event || event.tenantId !== tenantId) return undefined;
    
    const updatedEvent: Event = {
      ...event,
      ...omitUndefined(eventUpdate),
      updatedAt: new Date(),
    };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: string, tenantId: string): Promise<boolean> {
    const event = this.events.get(id);
    if (!event || event.tenantId !== tenantId) return false;
    return this.events.delete(id);
  }

  async markEventsCancelledForProject(projectId: string, tenantId: string, userId: string): Promise<number> {
    const projectEvents = Array.from(this.events.values()).filter(
      e => e.projectId === projectId && e.tenantId === tenantId
    );
    
    let markedCount = 0;
    for (const event of projectEvents) {
      // Only prefix if not already cancelled (idempotent)
      if (!event.title.startsWith('(CANCELLED) ')) {
        event.title = `(CANCELLED) ${event.title}`;
        event.isCancelled = true;
        event.cancelledAt = new Date();
        event.updatedAt = new Date();
        markedCount++;
        
        console.log('📅 EVENT MARKED AS CANCELLED (MemStorage)', {
          eventId: event.id,
          projectId,
          tenantId,
          userId,
          newTitle: event.title
        });
      }
    }
    
    return markedCount;
  }

  async markEventsCancelledForContact(contactId: string, tenantId: string, userId: string): Promise<number> {
    const contactEvents = Array.from(this.events.values()).filter(
      e => e.contactId === contactId && e.tenantId === tenantId
    );
    
    let markedCount = 0;
    for (const event of contactEvents) {
      // Only prefix if not already cancelled (idempotent)
      if (!event.title.startsWith('(CANCELLED) ')) {
        event.title = `(CANCELLED) ${event.title}`;
        event.isCancelled = true;
        event.cancelledAt = new Date();
        event.updatedAt = new Date();
        markedCount++;
        
        console.log('📅 EVENT MARKED AS CANCELLED FOR CONTACT (MemStorage)', {
          eventId: event.id,
          contactId,
          tenantId,
          userId,
          newTitle: event.title
        });
      }
    }
    
    return markedCount;
  }

  async linkLeadEventsToProject(contactId: string, projectId: string, tenantId: string): Promise<number> {
    // Get the contact to find its leadId
    const contact = this.contacts.get(contactId);
    if (!contact || !contact.leadId) {
      return 0; // No lead associated with this contact
    }
    
    const leadId = contact.leadId;
    const leadEvents = Array.from(this.events.values()).filter(
      e => e.leadId === leadId && e.tenantId === tenantId && !e.projectId
    );
    
    let linkedCount = 0;
    for (const event of leadEvents) {
      event.projectId = projectId;
      event.updatedAt = new Date();
      linkedCount++;
      
      console.log('📅 EVENT LINKED TO PROJECT (MemStorage)', {
        eventId: event.id,
        leadId,
        contactId,
        projectId,
        tenantId,
        eventTitle: event.title
      });
    }
    
    return linkedCount;
  }

  // System Calendars (Leads, Booked, Completed)
  async getCalendars(tenantId: string): Promise<Calendar[]> {
    return Array.from(this.calendars.values()).filter(cal => cal.tenantId === tenantId);
  }

  async getCalendar(id: string, tenantId: string): Promise<Calendar | undefined> {
    const calendar = this.calendars.get(id);
    return calendar?.tenantId === tenantId ? calendar : undefined;
  }

  async getCalendarByType(type: string, tenantId: string): Promise<Calendar | undefined> {
    return Array.from(this.calendars.values()).find(cal => cal.type === type && cal.tenantId === tenantId);
  }

  async createCalendar(insertCalendar: InsertCalendar, tenantId: string): Promise<Calendar> {
    const id = crypto.randomUUID();
    const calendar: Calendar = {
      ...insertCalendar,
      id,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.calendars.set(id, calendar);
    return calendar;
  }

  async updateCalendar(id: string, updates: Partial<InsertCalendar>, tenantId: string): Promise<Calendar | undefined> {
    const calendar = this.calendars.get(id);
    if (!calendar || calendar.tenantId !== tenantId) return undefined;
    const updated = { ...calendar, ...updates, updatedAt: new Date() };
    this.calendars.set(id, updated);
    return updated;
  }

  async createSystemCalendars(tenantId: string): Promise<Calendar[]> {
    const systemCalendars = [
      { name: 'Leads', type: 'leads', color: '#10b981', isSystem: true },
      { name: 'Booked', type: 'booked', color: '#3b82f6', isSystem: true },
      { name: 'Completed', type: 'completed', color: '#8b5cf6', isSystem: true },
    ];
    
    const created: Calendar[] = [];
    for (const cal of systemCalendars) {
      const existing = await this.getCalendarByType(cal.type, tenantId);
      if (!existing) {
        const calendar = await this.createCalendar({ ...cal, tenantId, isActive: true }, tenantId);
        created.push(calendar);
      }
    }
    return created;
  }

  async getEventsByCalendar(calendarId: string, tenantId: string): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      event => event.calendarId === calendarId && event.tenantId === tenantId
    );
  }

  async moveEventToCalendar(eventId: string, targetCalendarId: string, tenantId: string): Promise<Event | undefined> {
    const event = this.events.get(eventId);
    if (!event || event.tenantId !== tenantId) return undefined;
    
    const history = event.history ? JSON.parse(event.history) : [];
    history.push({
      timestamp: new Date().toISOString(),
      action: 'moved',
      from: event.calendarId,
      to: targetCalendarId,
      userId: event.createdBy
    });
    
    const updated = { ...event, calendarId: targetCalendarId, history: JSON.stringify(history), updatedAt: new Date() };
    this.events.set(eventId, updated);
    return updated;
  }

  async checkEventConflict(startDate: Date, endDate: Date, tenantId: string, userId?: string, excludeEventId?: string): Promise<{ hasConflict: boolean; conflictingEvents: Event[] }> {
    const conflictingEvents = Array.from(this.events.values()).filter(event => {
      if (event.tenantId !== tenantId) return false;
      if (excludeEventId && event.id === excludeEventId) return false;
      if (userId && event.assignedTo !== userId) return false;
      
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      
      return (
        (startDate >= eventStart && startDate < eventEnd) ||
        (endDate > eventStart && endDate <= eventEnd) ||
        (startDate <= eventStart && endDate >= eventEnd)
      );
    });
    
    return { hasConflict: conflictingEvents.length > 0, conflictingEvents };
  }

  // Calendar Integrations
  async getCalendarIntegrations(tenantId?: string): Promise<CalendarIntegration[]> {
    let integrations = Array.from(this.calendarIntegrations.values());
    if (tenantId) {
      integrations = integrations.filter(i => i.tenantId === tenantId);
    }
    return integrations.sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getCalendarIntegration(id: string, tenantId?: string): Promise<CalendarIntegration | undefined> {
    const integration = this.calendarIntegrations.get(id);
    if (!integration) return undefined;
    if (tenantId && integration.tenantId !== tenantId) return undefined;
    
    // Decrypt tokens for use
    return {
      ...integration,
      accessToken: integration.accessToken ? secureStore.decrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? secureStore.decrypt(integration.refreshToken) : null,
    };
  }

  async getCalendarIntegrationsByUser(userId: string, tenantId: string): Promise<CalendarIntegration[]> {
    // Structured log for tenant-scoped lookup
    console.log('🔍 CALENDAR INTEGRATION LOOKUP (MemStorage)', {
      action: 'getCalendarIntegrationsByUser',
      userId,
      tenantId,
      timestamp: new Date().toISOString()
    });
    
    // Filter by BOTH userId AND tenantId to ensure tenant isolation
    const integrations = Array.from(this.calendarIntegrations.values()).filter(integration => 
      integration.userId === userId && integration.tenantId === tenantId
    );
    
    console.log('📊 CALENDAR INTEGRATION LOOKUP RESULTS (MemStorage)', {
      action: 'getCalendarIntegrationsByUser',
      userId,
      tenantId,
      foundCount: integrations.length,
      integrationIds: integrations.map(i => i.id),
      timestamp: new Date().toISOString()
    });
    
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

  async upsertCalendarIntegration(insertIntegration: InsertCalendarIntegration, tenantId: string): Promise<CalendarIntegration> {
    // Find existing integration by tenantId + userId + provider + serviceType + providerAccountId
    const existing = Array.from(this.calendarIntegrations.values()).find(
      integration =>
        integration.tenantId === tenantId &&
        integration.userId === insertIntegration.userId &&
        integration.provider === insertIntegration.provider &&
        integration.serviceType === insertIntegration.serviceType &&
        integration.providerAccountId === insertIntegration.providerAccountId
    );

    if (existing) {
      // Update existing integration
      return this.updateCalendarIntegration(existing.id, insertIntegration, tenantId) as Promise<CalendarIntegration>;
    } else {
      // Create new integration
      return this.createCalendarIntegration(insertIntegration, tenantId);
    }
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
  async getDashboardMetrics(tenantId: string, userId?: string): Promise<{
    totalLeads: number;
    activeProjects: number;
    revenue: number;
    pendingInvoices: number;
  }> {
    const leads = await this.getLeads(tenantId, userId);
    const projects = await this.getProjects(tenantId, userId);
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
  async getTemplates(tenantId: string): Promise<Template[]> {
    return Array.from(this.templates.values())
      .filter(template => template.tenantId === tenantId)
      .sort((a, b) => 
        (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0)
      );
  }

  async getTemplate(id: string, tenantId: string): Promise<Template | undefined> {
    // SECURITY FIX: Added tenant scoping to prevent cross-tenant template access
    const template = this.templates.get(id);
    if (template && template.tenantId === tenantId) {
      return template;
    }
    return undefined;
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

  // Email Provider Catalog (global)
  async getEmailProviderCatalog(): Promise<EmailProviderCatalog[]> {
    // Return empty array for MemStorage - this is a global catalog that should be loaded from DB
    return [];
  }

  async getActiveEmailProviders(): Promise<EmailProviderCatalog[]> {
    // Return empty array for MemStorage - this is a global catalog that should be loaded from DB
    return [];
  }

  async getEmailProviderByKey(key: string): Promise<EmailProviderCatalog | undefined> {
    // Return undefined for MemStorage - this is a global catalog that should be loaded from DB
    return undefined;
  }

  async seedEmailProviders(providers: Omit<EmailProviderCatalog, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    // No-op for MemStorage - seeding should happen in DB
    return;
  }

  async getTenantEmailPrefs(tenantId: string): Promise<TenantEmailPrefs | null> {
    // Return null for MemStorage - prefs should be in DB
    return null;
  }

  async upsertTenantEmailPrefs(tenantId: string, prefs: Partial<InsertTenantEmailPrefs>): Promise<TenantEmailPrefs> {
    // Return default prefs for MemStorage
    return {
      tenantId,
      bccSelf: prefs.bccSelf ?? false,
      readReceipts: prefs.readReceipts ?? false,
      showOnDashboard: prefs.showOnDashboard ?? true,
      contactsOnly: prefs.contactsOnly ?? true,
      updatedAt: new Date()
    };
  }

  // Email Provider Configurations
  async getEmailProviderConfigs(tenantId: string, userId?: string): Promise<EmailProviderConfig[]> {
    return Array.from(this.emailProviderConfigs.values())
      .filter(config => config.tenantId === tenantId && (!userId || config.userId === userId))
      .sort((a, b) => (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0));
  }

  async getEmailProviderConfig(id: string, tenantId: string): Promise<EmailProviderConfig | undefined> {
    const config = this.emailProviderConfigs.get(id);
    if (!config || config.tenantId !== tenantId) return undefined;
    return config;
  }

  async getPrimaryEmailProviderConfig(tenantId: string): Promise<EmailProviderConfig | undefined> {
    return Array.from(this.emailProviderConfigs.values())
      .find(config => config.tenantId === tenantId && config.isPrimary && config.isActive);
  }

  async getEmailProviderConfigByName(name: string, tenantId: string): Promise<EmailProviderConfig | undefined> {
    return Array.from(this.emailProviderConfigs.values())
      .find(config => config.tenantId === tenantId && config.name === name);
  }

  async createEmailProviderConfig(insertConfig: InsertEmailProviderConfig, tenantId: string): Promise<EmailProviderConfig> {
    const id = randomUUID();
    
    // If this is set as primary, clear other primary configs for this tenant
    if (insertConfig.isPrimary) {
      Array.from(this.emailProviderConfigs.values())
        .filter(config => config.tenantId === tenantId && config.isPrimary)
        .forEach(config => {
          this.emailProviderConfigs.set(config.id, {
            ...config,
            isPrimary: false,
            updatedAt: new Date()
          });
        });
    }

    const config: EmailProviderConfig = {
      ...insertConfig,
      tenantId,
      id,
      isActive: insertConfig.isActive ?? true,
      isPrimary: insertConfig.isPrimary ?? false,
      isVerified: insertConfig.isVerified ?? false,
      isHealthy: insertConfig.isHealthy ?? true,
      messagesSent: insertConfig.messagesSent ?? 0,
      messagesReceived: insertConfig.messagesReceived ?? 0,
      consecutiveFailures: insertConfig.consecutiveFailures ?? 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.emailProviderConfigs.set(id, config);
    return config;
  }

  async updateEmailProviderConfig(id: string, updateData: Partial<InsertEmailProviderConfig>, tenantId: string): Promise<EmailProviderConfig | undefined> {
    const existing = this.emailProviderConfigs.get(id);
    if (!existing || existing.tenantId !== tenantId) return undefined;

    // If setting as primary, clear other primary configs for this tenant
    if (updateData.isPrimary) {
      Array.from(this.emailProviderConfigs.values())
        .filter(config => config.tenantId === tenantId && config.isPrimary && config.id !== id)
        .forEach(config => {
          this.emailProviderConfigs.set(config.id, {
            ...config,
            isPrimary: false,
            updatedAt: new Date()
          });
        });
    }

    const updated: EmailProviderConfig = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };
    
    this.emailProviderConfigs.set(id, updated);
    return updated;
  }

  async deleteEmailProviderConfig(id: string, tenantId: string): Promise<boolean> {
    const config = this.emailProviderConfigs.get(id);
    if (!config || config.tenantId !== tenantId) return false;
    return this.emailProviderConfigs.delete(id);
  }

  async setPrimaryEmailProviderConfig(id: string, tenantId: string): Promise<boolean> {
    const config = this.emailProviderConfigs.get(id);
    if (!config || config.tenantId !== tenantId) return false;

    // Clear all primary configs for this tenant
    Array.from(this.emailProviderConfigs.values())
      .filter(c => c.tenantId === tenantId && c.isPrimary)
      .forEach(c => {
        this.emailProviderConfigs.set(c.id, {
          ...c,
          isPrimary: false,
          updatedAt: new Date()
        });
      });

    // Set this config as primary
    this.emailProviderConfigs.set(id, {
      ...config,
      isPrimary: true,
      updatedAt: new Date()
    });

    return true;
  }

  async updateEmailProviderConfigHealth(id: string, isHealthy: boolean, consecutiveFailures: number, tenantId: string): Promise<boolean> {
    const config = this.emailProviderConfigs.get(id);
    if (!config || config.tenantId !== tenantId) return false;

    this.emailProviderConfigs.set(id, {
      ...config,
      isHealthy,
      consecutiveFailures,
      lastHealthCheckAt: new Date(),
      updatedAt: new Date()
    });

    return true;
  }

  async updateEmailProviderConfigUsage(id: string, messagesSent?: number, messagesReceived?: number, tenantId: string): Promise<boolean> {
    const config = this.emailProviderConfigs.get(id);
    if (!config || config.tenantId !== tenantId) return false;

    const updates: Partial<EmailProviderConfig> = {
      lastUsedAt: new Date(),
      updatedAt: new Date()
    };

    if (messagesSent !== undefined) {
      updates.messagesSent = (config.messagesSent || 0) + messagesSent;
    }

    if (messagesReceived !== undefined) {
      updates.messagesReceived = (config.messagesReceived || 0) + messagesReceived;
    }

    this.emailProviderConfigs.set(id, {
      ...config,
      ...updates
    });

    return true;
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

  // Admin Audit Logs - MemStorage implementation
  async getAdminAuditLogs(adminUserId?: string, impersonatedUserId?: string, tenantId?: string): Promise<AdminAuditLog[]> {
    let logs = Array.from(this.adminAuditLogs.values());
    
    if (adminUserId) {
      logs = logs.filter(log => log.adminUserId === adminUserId);
    }
    if (impersonatedUserId) {
      logs = logs.filter(log => log.impersonatedUserId === impersonatedUserId);
    }
    if (tenantId) {
      logs = logs.filter(log => log.tenantId === tenantId);
    }
    
    return logs.sort((a, b) => 
      new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
    );
  }

  async getAdminAuditLog(id: string): Promise<AdminAuditLog | undefined> {
    return this.adminAuditLogs.get(id);
  }

  async createAdminAuditLog(auditLog: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const id = randomUUID();
    const log: AdminAuditLog = {
      ...auditLog,
      id,
      timestamp: new Date()
    };
    this.adminAuditLogs.set(id, log);
    return log;
  }

  // Tenant management - MemStorage implementation
  async getAllTenants(): Promise<import('@shared/schema').Tenant[]> {
    return Array.from(this.tenants.values());
  }

  // Tenant-scoped storage wrapper
  withTenant(tenantId: string): TenantScopedStorage {
    return new TenantScopedStorage(this, tenantId);
  }
}

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
  private db = poolDb;
  
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

  async getTenantById(id: string): Promise<Tenant | undefined> {
    return this.getTenant(id);
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const { tenants } = await import('@shared/schema');
    
    const [created] = await this.db
      .insert(tenants)
      .values(tenant)
      .returning();
    
    return created;
  }

  async updateTenantSettings(id: string, settings: string): Promise<Tenant | undefined> {
    const { tenants } = await import('@shared/schema');
    const { eq, sql } = await import('drizzle-orm');
    
    const result = await this.db.update(tenants)
      .set({ 
        settings,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, id))
      .returning();
      
    return result[0];
  }

  // Tenant management - DrizzleStorage implementation
  async getAllTenants(): Promise<import('@shared/schema').Tenant[]> {
    const { tenants } = await import('@shared/schema');
    return await this.db.select().from(tenants);
  }
  
  // Calendar Integrations - Core functionality for Google Calendar
  async getCalendarIntegrations(tenantId?: string): Promise<CalendarIntegration[]> {
    if (tenantId) {
      return await this.db.select().from(calendarIntegrations)
        .where(eq(calendarIntegrations.tenantId, tenantId));
    }
    return await this.db.select().from(calendarIntegrations);
  }

  async getCalendarIntegrationsByTenant(tenantId: string): Promise<CalendarIntegration[]> {
    // Filter calendar integrations by tenantId directly
    const { calendarIntegrations } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const integrations = await this.db.select()
      .from(calendarIntegrations)
      .where(eq(calendarIntegrations.tenantId, tenantId));
    
    // Decrypt tokens for use
    return integrations.map(integration => ({
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    }));
  }

  async getCalendarIntegrationsByUser(userId: string, tenantId: string): Promise<CalendarIntegration[]> {
    // Structured log for tenant-scoped lookup
    console.log('🔍 CALENDAR INTEGRATION LOOKUP', {
      action: 'getCalendarIntegrationsByUser',
      userId,
      tenantId,
      timestamp: new Date().toISOString()
    });
    
    // Filter by BOTH userId AND tenantId to ensure tenant isolation
    const integrations = await db.select().from(calendarIntegrations)
      .where(and(
        eq(calendarIntegrations.userId, userId),
        eq(calendarIntegrations.tenantId, tenantId)
      ));
    
    console.log('📊 CALENDAR INTEGRATION LOOKUP RESULTS', {
      action: 'getCalendarIntegrationsByUser',
      userId,
      tenantId,
      foundCount: integrations.length,
      integrationIds: integrations.map(i => i.id),
      timestamp: new Date().toISOString()
    });
    
    // Decrypt tokens for use
    return integrations.map(integration => ({
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    }));
  }

  async getCalendarIntegration(id: string, tenantId?: string): Promise<CalendarIntegration | undefined> {
    const conditions = [eq(calendarIntegrations.id, id)];
    if (tenantId) {
      conditions.push(eq(calendarIntegrations.tenantId, tenantId));
    }
    const result = await db.select().from(calendarIntegrations).where(and(...conditions));
    
    if (!result[0]) return undefined;
    
    // Decrypt tokens for use
    const integration = result[0];
    return {
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    };
  }

  async getCalendarIntegrationByEmail(email: string, userId: string, tenantId: string): Promise<CalendarIntegration | undefined> {
    const result = await db.select().from(calendarIntegrations)
      .where(and(
        eq(calendarIntegrations.providerAccountId, email), 
        eq(calendarIntegrations.userId, userId),
        eq(calendarIntegrations.tenantId, tenantId)
      ));
    
    if (!result[0]) return undefined;
    
    // Decrypt tokens for use
    const integration = result[0];
    return {
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    };
  }

  async createCalendarIntegration(integration: InsertCalendarIntegration, tenantId: string): Promise<CalendarIntegration> {
    // Validate tenant isolation - ensure tenantId in integration matches the parameter
    if (integration.tenantId && integration.tenantId !== tenantId) {
      throw new Error(`Tenant ID mismatch: integration.tenantId (${integration.tenantId}) !== tenantId parameter (${tenantId})`);
    }

    // Ensure tenantId is always included in the integration object
    const secureIntegration = {
      ...integration,
      tenantId, // Always use the parameter to ensure tenant isolation
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

  async updateCalendarIntegration(id: string, updates: Partial<InsertCalendarIntegration>, tenantId: string): Promise<CalendarIntegration | undefined> {
    // Encrypt sensitive OAuth tokens if they're being updated
    const secureUpdates: any = { 
      ...updates,
      updatedAt: new Date() // Always update timestamp
    };
    if (updates.accessToken !== undefined) {
      secureUpdates.accessToken = updates.accessToken ? secureStore.encrypt(updates.accessToken) : null;
    }
    if (updates.refreshToken !== undefined) {
      secureUpdates.refreshToken = updates.refreshToken ? secureStore.encrypt(updates.refreshToken) : null;
    }
    
    const result = await db.update(calendarIntegrations).set(secureUpdates).where(and(
      eq(calendarIntegrations.id, id),
      eq(calendarIntegrations.tenantId, tenantId)
    )).returning();
    
    if (!result[0]) return undefined;
    
    // Return with decrypted tokens for immediate use
    const storedIntegration = result[0];
    return {
      ...storedIntegration,
      accessToken: storedIntegration.accessToken ? this.safeDecrypt(storedIntegration.accessToken) : null,
      refreshToken: storedIntegration.refreshToken ? this.safeDecrypt(storedIntegration.refreshToken) : null,
    };
  }

  async upsertCalendarIntegration(integration: InsertCalendarIntegration, tenantId: string): Promise<CalendarIntegration> {
    // Validate tenant isolation
    if (!tenantId) {
      throw new Error('tenantId is required for calendar integration operations');
    }
    if (integration.tenantId && integration.tenantId !== tenantId) {
      throw new Error(`Tenant ID mismatch: integration.tenantId (${integration.tenantId}) !== tenantId parameter (${tenantId})`);
    }

    // Check if integration already exists
    const existing = await db.select().from(calendarIntegrations)
      .where(and(
        eq(calendarIntegrations.tenantId, tenantId),
        eq(calendarIntegrations.userId, integration.userId!),
        eq(calendarIntegrations.provider, integration.provider),
        eq(calendarIntegrations.serviceType, integration.serviceType),
        eq(calendarIntegrations.providerAccountId, integration.providerAccountId!)
      ));

    if (existing.length > 0) {
      // Update existing integration
      const updated = await this.updateCalendarIntegration(existing[0].id, integration, tenantId);
      if (!updated) {
        throw new Error('Failed to update calendar integration');
      }
      return updated;
    } else {
      // Create new integration
      return this.createCalendarIntegration(integration, tenantId);
    }
  }

  async deleteCalendarIntegration(id: string): Promise<boolean> {
    const result = await db.delete(calendarIntegrations).where(eq(calendarIntegrations.id, id));
    return result.rowCount > 0;
  }

  // Events - Core functionality for calendar events
  async getEvents(tenantId: string): Promise<Event[]> {
    console.log('📅 EVENTS FETCH (DrizzleStorage)', {
      action: 'getEvents',
      tenantId,
      timestamp: new Date().toISOString()
    });
    
    // Filter by tenantId and exclude orphaned events
    const results = await db.select().from(events).where(and(
      eq(events.tenantId, tenantId),
      or(
        isNull(events.isOrphaned),
        eq(events.isOrphaned, false)
      )
    ));
    
    console.log('📊 EVENTS FETCH RESULTS (DrizzleStorage)', {
      action: 'getEvents',
      tenantId,
      eventsFound: results.length,
      orphanedFiltered: true,
      timestamp: new Date().toISOString()
    });
    
    // DEFENSIVE: Auto-fix any cancelled events missing the (CANCELLED) prefix
    for (const event of results) {
      if (event.isCancelled && !event.title.startsWith('(CANCELLED)')) {
        const oldTitle = event.title;
        const fixedTitle = `(CANCELLED) ${event.title}`;
        await db.update(events)
          .set({ title: fixedTitle })
          .where(eq(events.id, event.id));
        event.title = fixedTitle; // Update in-memory too
        console.log('🔧 AUTO-FIXED: Added (CANCELLED) prefix to event', {
          eventId: event.id,
          oldTitle,
          newTitle: fixedTitle
        });
      }
    }
    
    return results;
  }

  async getEventsByUser(userId: string, tenantId: string): Promise<Event[]> {
    return await db.select().from(events)
      .where(and(
        eq(events.tenantId, tenantId),
        or(eq(events.createdBy, userId), eq(events.assignedTo, userId)),
        or(
          isNull(events.isOrphaned),
          eq(events.isOrphaned, false)
        )
      ));
  }

  async getEvent(id: string, tenantId: string): Promise<Event | undefined> {
    const result = await db.select().from(events)
      .where(and(
        eq(events.id, id),
        eq(events.tenantId, tenantId),
        or(
          isNull(events.isOrphaned),
          eq(events.isOrphaned, false)
        )
      ));
    return result[0];
  }

  async getEventByExternalId(externalId: string, tenantId: string): Promise<Event | undefined> {
    const result = await db.select().from(events)
      .where(and(
        eq(events.externalEventId, externalId),
        eq(events.tenantId, tenantId),
        or(
          isNull(events.isOrphaned),
          eq(events.isOrphaned, false)
        )
      ));
    return result[0];
  }

  async createEvent(event: InsertEvent, tenantId: string): Promise<Event> {
    // Defensive check: tenantId is required for all event writes
    if (!tenantId) {
      const error = 'SECURITY: tenantId is required for event creation to prevent cross-tenant data access';
      console.error('❌ EVENT CREATION FAILED', { error, event: event.title });
      throw new Error(error);
    }
    
    // Structured log for tenant-scoped event creation
    console.log('📅 EVENT CREATION', {
      action: 'createEvent',
      tenantId,
      eventTitle: event.title,
      eventType: event.type || 'meeting',
      calendarIntegrationId: event.calendarIntegrationId || null,
      timestamp: new Date().toISOString()
    });
    
    // Ensure tenantId is always included in the event object
    const secureEvent = {
      ...event,
      tenantId // Always use the parameter to ensure tenant isolation
    };
    
    const result = await db.insert(events).values(secureEvent).returning();
    
    console.log('✅ EVENT CREATED', {
      action: 'createEvent',
      tenantId,
      eventId: result[0].id,
      eventTitle: result[0].title,
      hasTenantId: !!result[0].tenantId,
      timestamp: new Date().toISOString()
    });
    
    return result[0];
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>, tenantId: string): Promise<Event | undefined> {
    // Defensive check: tenantId is required for all event updates
    if (!tenantId) {
      const error = 'SECURITY: tenantId is required for event updates to prevent cross-tenant data access';
      console.error('❌ EVENT UPDATE FAILED', { error, eventId: id });
      throw new Error(error);
    }
    
    console.log('📅 EVENT UPDATE', {
      action: 'updateEvent',
      tenantId,
      eventId: id,
      updateFields: Object.keys(updates),
      timestamp: new Date().toISOString()
    });
    
    const result = await db.update(events)
      .set(updates)
      .where(and(
        eq(events.id, id),
        eq(events.tenantId, tenantId)
      ))
      .returning();
      
    if (result[0]) {
      console.log('✅ EVENT UPDATED', {
        action: 'updateEvent',
        tenantId,
        eventId: result[0].id,
        eventTitle: result[0].title,
        timestamp: new Date().toISOString()
      });
    }
    
    return result[0];
  }

  async deleteEvent(id: string, tenantId: string): Promise<boolean> {
    // Defensive check: tenantId is required for all event deletions
    if (!tenantId) {
      const error = 'SECURITY: tenantId is required for event deletion to prevent cross-tenant data access';
      console.error('❌ EVENT DELETION FAILED', { error, eventId: id });
      throw new Error(error);
    }
    
    console.log('📅 EVENT DELETION', {
      action: 'deleteEvent',
      tenantId,
      eventId: id,
      timestamp: new Date().toISOString()
    });
    
    const result = await db.delete(events)
      .where(and(
        eq(events.id, id),
        eq(events.tenantId, tenantId)
      ));
      
    const deleted = result.rowCount > 0;
    
    if (deleted) {
      console.log('✅ EVENT DELETED', {
        action: 'deleteEvent',
        tenantId,
        eventId: id,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('⚠️ EVENT NOT FOUND', {
        action: 'deleteEvent',
        tenantId,
        eventId: id,
        reason: 'Event not found or access denied',
        timestamp: new Date().toISOString()
      });
    }
    
    return deleted;
  }

  async markEventsCancelledForProject(projectId: string, tenantId: string, userId: string): Promise<number> {
    // Defensive check: tenantId is required
    if (!tenantId) {
      const error = 'SECURITY: tenantId is required to mark events as cancelled';
      console.error('❌ EVENT CANCEL FAILED', { error, projectId });
      throw new Error(error);
    }
    
    console.log('📅 MARKING EVENTS AS CANCELLED', {
      action: 'markEventsCancelledForProject',
      projectId,
      tenantId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Get all events for this project
    const projectEvents = await db.select().from(events).where(and(
      eq(events.projectId, projectId),
      eq(events.tenantId, tenantId)
    ));
    
    let markedCount = 0;
    
    for (const event of projectEvents) {
      // Only prefix if not already cancelled (idempotent)
      if (!event.title.startsWith('(CANCELLED) ')) {
        const newTitle = `(CANCELLED) ${event.title}`;
        
        await db.update(events)
          .set({
            title: newTitle,
            status: 'cancelled',
            isCancelled: true,
            cancelledAt: new Date(),
            updatedAt: new Date()
          })
          .where(and(
            eq(events.id, event.id),
            eq(events.tenantId, tenantId)
          ));
        
        markedCount++;
        
        console.log('✅ EVENT MARKED AS CANCELLED', {
          eventId: event.id,
          projectId,
          tenantId,
          userId,
          oldTitle: event.title,
          newTitle,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log('📅 EVENTS CANCELLATION COMPLETE', {
      projectId,
      tenantId,
      userId,
      eventsMarked: markedCount,
      timestamp: new Date().toISOString()
    });
    
    return markedCount;
  }

  async markEventsCancelledForContact(contactId: string, tenantId: string, userId: string): Promise<number> {
    // Defensive check: tenantId is required
    if (!tenantId) {
      const error = 'SECURITY: tenantId is required to mark events as cancelled';
      console.error('❌ EVENT CANCEL FAILED', { error, contactId });
      throw new Error(error);
    }
    
    console.log('📅 MARKING EVENTS AS CANCELLED FOR CONTACT', {
      action: 'markEventsCancelledForContact',
      contactId,
      tenantId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Get all events for this contact
    const contactEvents = await db.select().from(events).where(and(
      eq(events.contactId, contactId),
      eq(events.tenantId, tenantId)
    ));
    
    let markedCount = 0;
    
    for (const event of contactEvents) {
      // Only prefix if not already cancelled (idempotent)
      if (!event.title.startsWith('(CANCELLED) ')) {
        const newTitle = `(CANCELLED) ${event.title}`;
        
        await db.update(events)
          .set({
            title: newTitle,
            status: 'cancelled',
            isCancelled: true,
            cancelledAt: new Date(),
            updatedAt: new Date()
          })
          .where(and(
            eq(events.id, event.id),
            eq(events.tenantId, tenantId)
          ));
        
        markedCount++;
        
        console.log('✅ EVENT MARKED AS CANCELLED FOR CONTACT', {
          eventId: event.id,
          contactId,
          tenantId,
          userId,
          oldTitle: event.title,
          newTitle,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log('📅 CONTACT EVENTS CANCELLATION COMPLETE', {
      contactId,
      tenantId,
      userId,
      eventsMarked: markedCount,
      timestamp: new Date().toISOString()
    });
    
    return markedCount;
  }

  async linkLeadEventsToProject(contactId: string, projectId: string, tenantId: string): Promise<number> {
    // Defensive check: tenantId is required
    if (!tenantId) {
      const error = 'SECURITY: tenantId is required to link lead events to project';
      console.error('❌ EVENT LINK FAILED', { error, contactId, projectId });
      throw new Error(error);
    }
    
    // Get the contact to find its leadId
    const contact = await db.select().from(contacts).where(and(
      eq(contacts.id, contactId),
      eq(contacts.tenantId, tenantId)
    )).limit(1);
    
    if (!contact[0] || !contact[0].leadId) {
      console.log('ℹ️ No lead associated with contact, skipping event linking', { contactId, projectId, tenantId });
      return 0; // No lead associated with this contact
    }
    
    const leadId = contact[0].leadId;
    
    console.log('🔗 LINKING LEAD EVENTS TO PROJECT', {
      action: 'linkLeadEventsToProject',
      leadId,
      contactId,
      projectId,
      tenantId,
      timestamp: new Date().toISOString()
    });
    
    // Get all events for this lead that don't already have a projectId
    const leadEvents = await db.select().from(events).where(and(
      eq(events.leadId, leadId),
      eq(events.tenantId, tenantId),
      isNull(events.projectId)
    ));
    
    let linkedCount = 0;
    
    for (const event of leadEvents) {
      await db.update(events)
        .set({
          projectId: projectId,
          updatedAt: new Date()
        })
        .where(and(
          eq(events.id, event.id),
          eq(events.tenantId, tenantId)
        ));
      
      linkedCount++;
      
      console.log('✅ EVENT LINKED TO PROJECT', {
        eventId: event.id,
        leadId,
        contactId,
        projectId,
        tenantId,
        eventTitle: event.title,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('🔗 LEAD EVENTS LINK COMPLETE', {
      leadId,
      contactId,
      projectId,
      tenantId,
      eventsLinked: linkedCount,
      timestamp: new Date().toISOString()
    });
    
    return linkedCount;
  }

  // System Calendars (Leads, Booked, Completed)
  async getCalendars(tenantId: string): Promise<Calendar[]> {
    return await db.select().from(calendars).where(eq(calendars.tenantId, tenantId));
  }

  async getCalendar(id: string, tenantId: string): Promise<Calendar | undefined> {
    const result = await db.select().from(calendars)
      .where(and(eq(calendars.id, id), eq(calendars.tenantId, tenantId)));
    return result[0];
  }

  async getCalendarByType(type: string, tenantId: string): Promise<Calendar | undefined> {
    const result = await db.select().from(calendars)
      .where(and(eq(calendars.type, type), eq(calendars.tenantId, tenantId)));
    return result[0];
  }

  async createCalendar(calendar: InsertCalendar, tenantId: string): Promise<Calendar> {
    const result = await db.insert(calendars).values({ ...calendar, tenantId }).returning();
    return result[0];
  }

  async updateCalendar(id: string, updates: Partial<InsertCalendar>, tenantId: string): Promise<Calendar | undefined> {
    const result = await db.update(calendars)
      .set(updates)
      .where(and(eq(calendars.id, id), eq(calendars.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async createSystemCalendars(tenantId: string): Promise<Calendar[]> {
    const systemCalendars = [
      { name: 'Leads', type: 'leads', color: '#10b981', isSystem: true },
      { name: 'Booked', type: 'booked', color: '#3b82f6', isSystem: true },
      { name: 'Completed', type: 'completed', color: '#8b5cf6', isSystem: true },
    ];
    
    const created: Calendar[] = [];
    for (const cal of systemCalendars) {
      const existing = await this.getCalendarByType(cal.type, tenantId);
      if (!existing) {
        const calendar = await this.createCalendar({ ...cal, tenantId, isActive: true }, tenantId);
        created.push(calendar);
      }
    }
    return created;
  }

  async getEventsByCalendar(calendarId: string, tenantId: string): Promise<Event[]> {
    return await db.select().from(events)
      .where(and(
        eq(events.calendarId, calendarId),
        eq(events.tenantId, tenantId)
      ));
  }

  async moveEventToCalendar(eventId: string, targetCalendarId: string, tenantId: string): Promise<Event | undefined> {
    const event = await this.getEvent(eventId, tenantId);
    if (!event) return undefined;
    
    const history = event.history ? JSON.parse(event.history) : [];
    history.push({
      timestamp: new Date().toISOString(),
      action: 'moved',
      from: event.calendarId,
      to: targetCalendarId,
      userId: event.createdBy
    });
    
    const result = await db.update(events)
      .set({ calendarId: targetCalendarId, history: JSON.stringify(history) })
      .where(and(eq(events.id, eventId), eq(events.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async checkEventConflict(startDate: Date, endDate: Date, tenantId: string, userId?: string, excludeEventId?: string): Promise<{ hasConflict: boolean; conflictingEvents: Event[] }> {
    let query = db.select().from(events)
      .where(and(
        eq(events.tenantId, tenantId),
        sql`${events.startDate} < ${endDate}`,
        sql`${events.endDate} > ${startDate}`
      ));
    
    const results = await query;
    
    const conflictingEvents = results.filter(event => {
      if (excludeEventId && event.id === excludeEventId) return false;
      if (userId && event.assignedTo !== userId) return false;
      return true;
    });
    
    return { hasConflict: conflictingEvents.length > 0, conflictingEvents };
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
  async getUserGlobal(id: string): Promise<User | undefined> {
    // Global lookup across all tenants for SUPERADMIN verification - bypasses tenant isolation
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

  async getUserByUsernameGlobal(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmailGlobal(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  async createUser(user: InsertUser, tenantId: string): Promise<User> { 
    const result = await this.db.insert(users).values({ ...user, tenantId }).returning();
    return result[0];
  }
  async updateUser(id: string, user: Partial<InsertUser>, tenantId: string): Promise<User | undefined> {
    const result = await this.db.update(users).set(user).where(
      and(eq(users.id, id), eq(users.tenantId, tenantId))
    ).returning();
    return result[0];
  }
  
  async getLeads(tenantId: string, userId?: string): Promise<Lead[]> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    let whereCondition = eq(leads.tenantId, tenantId);
    if (userId) {
      whereCondition = and(eq(leads.tenantId, tenantId), eq(leads.userId, userId));
    }
    
    const result = await this.db.select({
      id: leads.id,
      tenantId: leads.tenantId,
      userId: leads.userId,
      firstName: leads.firstName,
      middleName: leads.middleName,
      lastName: leads.lastName,
      fullName: leads.fullName,
      email: leads.email,
      phone: leads.phone,
      company: leads.company,
      leadSource: leads.leadSource,
      estimatedValue: leads.estimatedValue,
      status: leads.status,
      notes: leads.notes,
      assignedTo: leads.assignedTo,
      projectId: leads.projectId,
      lastContactAt: leads.lastContactAt,
      lastManualStatusAt: leads.lastManualStatusAt,
      projectDate: leads.projectDate,
      eventLocation: leads.eventLocation,
      eventType: leads.eventType,
      lastViewedAt: leads.lastViewedAt,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      venueName: venues.name,
    }).from(leads)
      .leftJoin(projects, eq(leads.projectId, projects.id))
      .leftJoin(venues, eq(projects.venueId, venues.id))
      .where(whereCondition)
      .orderBy(desc(leads.createdAt));
    
    // Map the results to the Lead type format with venue name
    return result.map(row => ({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      firstName: row.firstName,
      middleName: row.middleName,
      lastName: row.lastName,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      company: row.company,
      leadSource: row.leadSource,
      estimatedValue: row.estimatedValue,
      status: row.status,
      notes: row.notes,
      assignedTo: row.assignedTo,
      projectId: row.projectId,
      lastContactAt: row.lastContactAt,
      lastManualStatusAt: row.lastManualStatusAt,
      projectDate: row.projectDate,
      eventLocation: row.eventLocation,
      eventType: row.eventType,
      lastViewedAt: row.lastViewedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // Add venue name as a property that can be accessed
      projectVenueName: row.venueName,
    } as any));
  }
  async getLead(id: string, tenantId: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)));
    return result[0];
  }
  async createLead(insertLead: InsertLead, tenantId: string): Promise<Lead> {
    if (!tenantId) {
      throw new Error("Tenant ID is required for multi-tenant lead creation");
    }
    const result = await db.insert(leads).values({
      ...insertLead,
      tenantId,
      status: insertLead.status ?? 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateLead(id: string, leadUpdate: Partial<InsertLead>, tenantId: string): Promise<Lead | undefined> {
    const result = await db.update(leads).set({
      ...leadUpdate,
      updatedAt: new Date(),
    }).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId))).returning();
    return result[0];
  }
  async deleteLead(id: string, tenantId: string): Promise<boolean> {
    // First delete related records to avoid foreign key constraints
    
    // Delete lead consent records
    await this.db.delete(leadConsents).where(eq(leadConsents.leadId, id));
    
    // Delete form submission references (set leadId to null)
    await this.db.update(formSubmissions)
      .set({ leadId: null })
      .where(eq(formSubmissions.leadId, id));
    
    // Delete lead status history records
    await this.db.delete(leadStatusHistory).where(eq(leadStatusHistory.leadId, id));
    
    // Then delete the lead itself - WITH TENANT ISOLATION
    const result = await this.db.delete(leads).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)));
    return result.rowCount > 0;
  }
  async getLeadsByProject(projectId: string, tenantId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(and(eq(leads.projectId, projectId), eq(leads.tenantId, tenantId)));
  }
  async getEmailsByContact(contactId: string, tenantId: string): Promise<Email[]> {
    return await this.db.select().from(emails).where(and(eq(emails.contactId, contactId), eq(emails.tenantId, tenantId)));
  }

  async createLeadStatusHistory(history: InsertLeadStatusHistory): Promise<LeadStatusHistory> {
    const [entry] = await this.db.insert(leadStatusHistory).values(history).returning();
    return entry;
  }

  // Contacts - Using PostgreSQL
  async getContacts(tenantId: string, userId?: string, limit?: number, offset?: number): Promise<Contact[]> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    // Set default limit for performance - prevent fetching unlimited data
    const defaultLimit = limit ?? 100;
    const defaultOffset = offset ?? 0;
    
    // WORKAROUND: Use pool directly to bypass Drizzle orderSelectedFields recursion issue
    if (userId) {
      const query = `
        SELECT * FROM contacts 
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT ${defaultLimit}
        OFFSET ${defaultOffset}
      `;
      const { rows: result } = await pool.query(query, [tenantId, userId]);
      return result as Contact[];
    } else {
      const query = `
        SELECT * FROM contacts 
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT ${defaultLimit}
        OFFSET ${defaultOffset}
      `;
      const { rows: result } = await pool.query(query, [tenantId]);
      return result as Contact[];
    }
  }

  async getContactsCount(tenantId: string, userId?: string): Promise<number> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    let whereCondition = eq(contacts.tenantId, tenantId);
    if (userId) {
      whereCondition = and(eq(contacts.tenantId, tenantId), eq(contacts.userId, userId));
    }
    
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(whereCondition);
    
    return result[0]?.count || 0;
  }
  async getContactById(id: string, tenantId: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
    return result[0];
  }
  async getContact(id: string, tenantId: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
    return result[0];
  }

  async getContactByEmail(email: string, tenantId: string): Promise<Contact | undefined> {
    const result = await this.db.select().from(contacts).where(and(eq(contacts.email, email), eq(contacts.tenantId, tenantId)));
    return result[0];
  }
  async createContact(contact: InsertContact, tenantId: string): Promise<Contact> {
    if (!tenantId) {
      throw new Error("Tenant ID is required for multi-tenant contact creation");
    }
    const result = await this.db.insert(contacts).values({
      ...contact,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateContact(id: string, contactUpdate: Partial<InsertContact>, tenantId: string): Promise<Contact | undefined> {
    const result = await this.db.update(contacts).set({
      ...contactUpdate,
      updatedAt: new Date(),
    }).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId))).returning();
    return result[0];
  }
  async deleteContact(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
    return result.rowCount > 0;
  }
  
  // Custom Contact Fields - Using PostgreSQL
  async getContactFieldDefinitions(tenantId: string): Promise<ContactFieldDefinition[]> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    return await this.db.select().from(contactFieldDefinitions).where(
      and(
        eq(contactFieldDefinitions.tenantId, tenantId),
        eq(contactFieldDefinitions.isActive, true)
      )
    ).orderBy(contactFieldDefinitions.displayOrder);
  }

  async getContactFieldDefinition(id: string, tenantId: string): Promise<ContactFieldDefinition | undefined> {
    const result = await this.db.select().from(contactFieldDefinitions).where(
      and(eq(contactFieldDefinitions.id, id), eq(contactFieldDefinitions.tenantId, tenantId))
    );
    return result[0];
  }

  async createContactFieldDefinition(field: InsertContactFieldDefinition, tenantId: string): Promise<ContactFieldDefinition> {
    if (!tenantId) {
      throw new Error("Tenant ID is required for multi-tenant field definition creation");
    }
    const result = await this.db.insert(contactFieldDefinitions).values({
      ...field,
      tenantId,
    }).returning();
    return result[0];
  }

  async updateContactFieldDefinition(id: string, fieldUpdate: Partial<InsertContactFieldDefinition>, tenantId: string): Promise<ContactFieldDefinition | undefined> {
    const result = await this.db.update(contactFieldDefinitions).set({
      ...fieldUpdate,
      updatedAt: new Date(),
    }).where(and(eq(contactFieldDefinitions.id, id), eq(contactFieldDefinitions.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteContactFieldDefinition(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(contactFieldDefinitions).where(
      and(eq(contactFieldDefinitions.id, id), eq(contactFieldDefinitions.tenantId, tenantId))
    );
    return result.rowCount > 0;
  }

  async getContactFieldValues(contactId: string, tenantId: string): Promise<ContactFieldValue[]> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    return await this.db.select().from(contactFieldValues).where(
      and(
        eq(contactFieldValues.contactId, contactId),
        eq(contactFieldValues.tenantId, tenantId)
      )
    );
  }

  async getContactFieldValue(contactId: string, fieldDefinitionId: string, tenantId: string): Promise<ContactFieldValue | undefined> {
    const result = await this.db.select().from(contactFieldValues).where(
      and(
        eq(contactFieldValues.contactId, contactId),
        eq(contactFieldValues.fieldDefinitionId, fieldDefinitionId),
        eq(contactFieldValues.tenantId, tenantId)
      )
    );
    return result[0];
  }

  async setContactFieldValue(value: InsertContactFieldValue, tenantId: string): Promise<ContactFieldValue> {
    if (!tenantId) {
      throw new Error("Tenant ID is required for multi-tenant field value creation");
    }
    
    // Use upsert pattern - insert or update if exists
    const existing = await this.getContactFieldValue(value.contactId, value.fieldDefinitionId, tenantId);
    
    if (existing) {
      const result = await this.db.update(contactFieldValues).set({
        value: value.value,
        updatedAt: new Date(),
      }).where(
        and(
          eq(contactFieldValues.contactId, value.contactId),
          eq(contactFieldValues.fieldDefinitionId, value.fieldDefinitionId),
          eq(contactFieldValues.tenantId, tenantId)
        )
      ).returning();
      return result[0];
    } else {
      const result = await this.db.insert(contactFieldValues).values({
        ...value,
        tenantId,
      }).returning();
      return result[0];
    }
  }

  async deleteContactFieldValue(contactId: string, fieldDefinitionId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(contactFieldValues).where(
      and(
        eq(contactFieldValues.contactId, contactId),
        eq(contactFieldValues.fieldDefinitionId, fieldDefinitionId),
        eq(contactFieldValues.tenantId, tenantId)
      )
    );
    return result.rowCount > 0;
  }

  // Tags
  async getTags(tenantId: string, category?: string): Promise<Tag[]> {
    const conditions = [eq(tags.tenantId, tenantId)];
    if (category) {
      conditions.push(eq(tags.category, category));
    }
    return await this.db.select().from(tags).where(and(...conditions)).orderBy(desc(tags.usageCount), tags.name);
  }

  async getTag(id: string, tenantId: string): Promise<Tag | undefined> {
    const result = await this.db.select().from(tags).where(
      and(eq(tags.id, id), eq(tags.tenantId, tenantId))
    );
    return result[0];
  }

  async getTagByName(name: string, tenantId: string): Promise<Tag | undefined> {
    const { rows } = await pool.query(
      'SELECT * FROM tags WHERE LOWER(name) = LOWER($1) AND tenant_id = $2 LIMIT 1',
      [name, tenantId]
    );
    return rows[0] as Tag | undefined;
  }

  async createTag(tag: InsertTag, tenantId: string): Promise<Tag> {
    const result = await this.db.insert(tags).values({
      ...tag,
      tenantId,
    }).returning();
    return result[0];
  }

  async updateTag(id: string, tag: Partial<InsertTag>, tenantId: string): Promise<Tag | undefined> {
    const result = await this.db.update(tags)
      .set({
        ...omitUndefined(tag),
        updatedAt: new Date(),
      })
      .where(and(eq(tags.id, id), eq(tags.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async deleteTag(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(tags).where(
      and(eq(tags.id, id), eq(tags.tenantId, tenantId))
    );
    return result.rowCount > 0;
  }

  async incrementTagUsage(id: string, tenantId: string): Promise<void> {
    await pool.query(
      'UPDATE tags SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  }
  
  // Projects - Using PostgreSQL
  async getProjects(tenantId: string, userId?: string, limit?: number, offset?: number): Promise<Project[]> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    // Set default limit for performance - prevent fetching unlimited data
    const defaultLimit = limit ?? 100;
    const defaultOffset = offset ?? 0;
    
    // WORKAROUND: Use pool directly to bypass Drizzle orderSelectedFields recursion issue
    if (userId) {
      const query = `
        SELECT 
          p.*,
          v.name as venue_name,
          v.address as venue_address,
          v.city as venue_city,
          v.state as venue_state,
          v.zip_code as venue_zip_code,
          v.country as venue_country,
          v.contact_phone as venue_phone,
          c.first_name as contact_first_name,
          c.last_name as contact_last_name,
          c.email as contact_email
        FROM projects p
        LEFT JOIN venues v ON p.venue_id = v.id AND v.tenant_id = p.tenant_id
        LEFT JOIN contacts c ON p.contact_id = c.id AND c.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1 AND (p.user_id = $2 OR p.assigned_to = $2)
        ORDER BY p.created_at DESC
        LIMIT ${defaultLimit}
        OFFSET ${defaultOffset}
      `;
      const { rows: result } = await pool.query(query, [tenantId, userId]);
      return result as Project[];
    } else {
      const query = `
        SELECT 
          p.*,
          v.name as venue_name,
          v.address as venue_address,
          v.city as venue_city,
          v.state as venue_state,
          v.zip_code as venue_zip_code,
          v.country as venue_country,
          v.contact_phone as venue_phone,
          c.first_name as contact_first_name,
          c.last_name as contact_last_name,
          c.email as contact_email
        FROM projects p
        LEFT JOIN venues v ON p.venue_id = v.id AND v.tenant_id = p.tenant_id
        LEFT JOIN contacts c ON p.contact_id = c.id AND c.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1
        ORDER BY p.created_at DESC
        LIMIT ${defaultLimit}
        OFFSET ${defaultOffset}
      `;
      const { rows: result } = await pool.query(query, [tenantId]);
      return result as Project[];
    }
  }

  async getProjectsCount(tenantId: string, userId?: string): Promise<number> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    let whereCondition = eq(projects.tenantId, tenantId);
    if (userId) {
      whereCondition = and(
        eq(projects.tenantId, tenantId),
        or(eq(projects.userId, userId), eq(projects.assignedTo, userId))
      );
    }
    
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereCondition);
    
    return result[0]?.count || 0;
  }
  async getProject(id: string, tenantId: string): Promise<Project | undefined> {
    const result = await this.db.select().from(projects).where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)));
    return result[0];
  }

  async getProjectWithDetails(id: string, tenantId: string): Promise<any> {
    const result = await this.db
      .select({
        // All project fields
        id: projects.id,
        name: projects.name,
        description: projects.description,
        contactId: projects.contactId,
        status: projects.status,
        progress: projects.progress,
        startDate: projects.startDate,
        endDate: projects.endDate,
        estimatedValue: projects.estimatedValue,
        actualValue: projects.actualValue,
        assignedTo: projects.assignedTo,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        venueId: projects.venueId,
        portalEnabledOverride: projects.portalEnabledOverride,
        userId: projects.userId,
        tenantId: projects.tenantId,
        primaryEventId: projects.primaryEventId,
        // Contact fields
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactEmail: contacts.email,
        contactPhone: contacts.phone,
        contactAddress: contacts.address,
        contactJobTitle: contacts.jobTitle,
        contactWebsite: contacts.website,
        // Venue fields
        venueName: venues.name,
        venueAddress: venues.address,
        venueCity: venues.city,
        venueState: venues.state,
      })
      .from(projects)
      .leftJoin(contacts, and(
        eq(projects.contactId, contacts.id),
        eq(projects.tenantId, contacts.tenantId)
      ))
      .leftJoin(venues, and(
        eq(projects.venueId, venues.id),
        eq(projects.tenantId, venues.tenantId)
      ))
      .where(and(
        eq(projects.id, id),
        eq(projects.tenantId, tenantId)
      ))
      .limit(1);
    
    return result[0];
  }

  async getProjectsByContact(contactId: string, tenantId: string): Promise<Project[]> {
    return await this.db.select().from(projects).where(and(eq(projects.contactId, contactId), eq(projects.tenantId, tenantId))).orderBy(desc(projects.createdAt));
  }

  async getProjectsByContacts(contactIds: string[], tenantId: string): Promise<Map<string, Project[]>> {
    if (contactIds.length === 0) {
      return new Map();
    }
    
    // Fetch all projects for the given contact IDs in one query
    const allProjects = await this.db.select()
      .from(projects)
      .where(and(
        inArray(projects.contactId, contactIds),
        eq(projects.tenantId, tenantId)
      ))
      .orderBy(desc(projects.createdAt));
    
    // Group by contact ID
    const result = new Map<string, Project[]>();
    
    // Initialize empty arrays for all contact IDs
    contactIds.forEach(id => result.set(id, []));
    
    // Group projects by contact ID
    allProjects.forEach(project => {
      const existing = result.get(project.contactId) || [];
      existing.push(project);
      result.set(project.contactId, existing);
    });
    
    return result;
  }

  async getActiveProjectsByContact(contactId: string, tenantId: string): Promise<Project[]> {
    return await this.db.select().from(projects).where(and(
      eq(projects.contactId, contactId), 
      eq(projects.tenantId, tenantId),
      eq(projects.status, 'active')
    )).orderBy(desc(projects.createdAt));
  }
  async createProject(project: InsertProject, tenantId: string): Promise<Project> {
    if (!tenantId) {
      throw new Error("Tenant ID is required for multi-tenant project creation");
    }
    const result = await this.db.insert(projects).values({
      ...project,
      tenantId,
      userId: project.userId,  // Explicitly ensure userId is included
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateProject(id: string, projectUpdate: Partial<InsertProject>, tenantId: string): Promise<Project | undefined> {
    const result = await this.db.update(projects).set({
      ...projectUpdate,
      updatedAt: new Date(),
    }).where(and(eq(projects.id, id), eq(projects.tenantId, tenantId))).returning();
    return result[0];
  }
  async touchProject(projectId: string, tenantId: string): Promise<void> {
    if (projectId && tenantId) {
      await this.db.update(projects).set({
        updatedAt: new Date(),
      }).where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)));
    }
  }
  
  async deleteProject(id: string, tenantId: string): Promise<boolean> {
    try {
      // First, remove project references from related tables to avoid foreign key constraint violations
      await this.db.update(emails).set({ projectId: null }).where(and(eq(emails.projectId, id), eq(emails.tenantId, tenantId)));
      await this.db.update(emailThreads).set({ projectId: null }).where(and(eq(emailThreads.projectId, id), eq(emailThreads.tenantId, tenantId)));
      await this.db.update(leads).set({ projectId: null }).where(and(eq(leads.projectId, id), eq(leads.tenantId, tenantId)));
      await this.db.update(messageThreads).set({ projectId: null }).where(and(eq(messageThreads.projectId, id), eq(messageThreads.tenantId, tenantId)));
      
      // Mark calendar events as cancelled when project is deleted
      // Get events first to properly update titles
      const projectEvents = await this.db.select().from(events).where(and(
        eq(events.projectId, id),
        eq(events.tenantId, tenantId)
      ));
      
      for (const event of projectEvents) {
        if (!event.title.startsWith('(CANCELLED) ')) {
          await this.db.update(events).set({
            title: `(CANCELLED) ${event.title}`,
            status: 'cancelled',
            isCancelled: true,
            cancelledAt: new Date(),
            updatedAt: new Date()
          }).where(and(
            eq(events.id, event.id),
            eq(events.tenantId, tenantId)
          ));
        }
      }
      
      // Delete contracts entirely since they're project-specific - with tenant filtering
      await this.db.delete(contracts).where(and(eq(contracts.projectId, id), eq(contracts.tenantId, tenantId)));
      
      // Finally delete the project itself - WITH TENANT ISOLATION
      const result = await this.db.delete(projects).where(and(eq(projects.id, id), eq(projects.tenantId, tenantId)));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }
  
  async canUserAccessProject(userId: string, tenantId: string, projectId: string): Promise<boolean> {
    // 1. Get project and verify it belongs to tenant
    const project = await this.db.select().from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
      .limit(1);
    
    if (!project || project.length === 0) {
      return false; // Project doesn't exist or doesn't belong to this tenant
    }
    
    const projectData = project[0];
    
    // 2. Check if user is project owner or assigned user
    if (projectData.userId === userId || projectData.assignedTo === userId) {
      return true;
    }
    
    // 3. Check if user is tenant admin
    const user = await this.db.select().from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);
    
    if (user && user.length > 0 && (user[0].role === 'admin' || user[0].role === 'owner')) {
      return true;
    }
    
    // 4. Check if user is a project member
    // First, find the member record for this user
    const member = await this.db.select().from(members)
      .where(and(eq(members.userId, userId), eq(members.tenantId, tenantId)))
      .limit(1);
    
    if (member && member.length > 0) {
      // Check if this member is assigned to the project
      const projectMember = await this.db.select().from(projectMembers)
        .where(and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.memberId, member[0].id)
        ))
        .limit(1);
      
      if (projectMember && projectMember.length > 0) {
        return true;
      }
    }
    
    // No access found
    return false;
  }

  async getProjectDocumentStatus(projectId: string, tenantId: string) {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }

    // Get quote counts by status
    const quoteCounts = await this.db
      .select({
        status: quotes.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(quotes)
      .where(and(
        eq(quotes.tenantId, tenantId),
        eq(quotes.projectId, projectId)
      ))
      .groupBy(quotes.status);

    // Get contract counts by status
    const contractCounts = await this.db
      .select({
        status: contracts.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(contracts)
      .where(and(
        eq(contracts.tenantId, tenantId),
        eq(contracts.projectId, projectId)
      ))
      .groupBy(contracts.status);

    // Get invoice counts by status
    const invoiceCounts = await this.db
      .select({
        status: invoices.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.projectId, projectId)
      ))
      .groupBy(invoices.status);

    // Build the response
    const quoteStatusMap = new Map(quoteCounts.map(q => [q.status, q.count]));
    const contractStatusMap = new Map(contractCounts.map(c => [c.status, c.count]));
    const invoiceStatusMap = new Map(invoiceCounts.map(i => [i.status, i.count]));

    return {
      quotes: {
        total: quoteCounts.reduce((sum, q) => sum + q.count, 0),
        draft: quoteStatusMap.get('draft') || 0,
        sent: quoteStatusMap.get('sent') || 0,
        approved: quoteStatusMap.get('approved') || 0,
        rejected: quoteStatusMap.get('rejected') || 0,
        expired: quoteStatusMap.get('expired') || 0,
      },
      contracts: {
        total: contractCounts.reduce((sum, c) => sum + c.count, 0),
        draft: contractStatusMap.get('draft') || 0,
        sent: contractStatusMap.get('sent') || 0,
        awaitingCounterSignature: contractStatusMap.get('awaiting_counter_signature') || 0,
        signed: contractStatusMap.get('signed') || 0,
        cancelled: contractStatusMap.get('cancelled') || 0,
      },
      invoices: {
        total: invoiceCounts.reduce((sum, i) => sum + i.count, 0),
        draft: invoiceStatusMap.get('draft') || 0,
        sent: invoiceStatusMap.get('sent') || 0,
        paid: invoiceStatusMap.get('paid') || 0,
        overdue: invoiceStatusMap.get('overdue') || 0,
        cancelled: invoiceStatusMap.get('cancelled') || 0,
      },
    };
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
    
    // Update project timestamp
    if (result[0].projectId && result[0].tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
    return result[0];
  }
  async updateQuote(id: string, quote: Partial<InsertQuote>) { 
    const result = await this.db.update(quotes).set({
      ...quote,
      updatedAt: new Date(),
    }).where(eq(quotes.id, id)).returning();
    
    // Update project timestamp
    if (result[0]?.projectId && result[0]?.tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
    return result[0];
  }
  async deleteQuote(id: string) { 
    const result = await this.db.delete(quotes).where(eq(quotes.id, id));
    return result.rowCount > 0;
  }
  async getQuotesByProject(projectId: string) { 
    return await this.db.select().from(quotes).where(eq(quotes.leadId, projectId));
  }
  async getQuotesByContact(contactId: string, tenantId?: string) { 
    const conditions = [eq(quotes.contactId, contactId)];
    if (tenantId) conditions.push(eq(quotes.tenantId, tenantId));
    return await this.db.select().from(quotes).where(and(...conditions));
  }
  
  // Contracts - PostgreSQL implementation  
  async getContracts() { 
    return await this.db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }
  async getContract(id: string) { 
    const result = await this.db.select().from(contracts).where(eq(contracts.id, id));
    return result[0];
  }
  async getContractsByClient(clientId: string, tenantId?: string) { 
    const conditions = [eq(contracts.contactId, clientId)];
    if (tenantId) conditions.push(eq(contracts.tenantId, tenantId));
    return await this.db.select().from(contracts).where(and(...conditions));
  }
  async getContractsByContact(contactId: string) { 
    return await this.db.select().from(contracts).where(eq(contracts.contactId, contactId));
  }
  async createContract(contract: InsertContract) { 
    const result = await this.db.insert(contracts).values({
      ...contract,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    // Update project timestamp
    if (result[0].projectId && result[0].tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
    return result[0];
  }
  async updateContract(id: string, contract: Partial<InsertContract>) { 
    const result = await this.db.update(contracts).set({
      ...contract,
      updatedAt: new Date(),
    }).where(eq(contracts.id, id)).returning();
    
    // Update project timestamp
    if (result[0]?.projectId && result[0]?.tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
    return result[0];
  }
  async deleteContract(id: string) { 
    const result = await this.db.delete(contracts).where(eq(contracts.id, id));
    return result.rowCount > 0;
  }
  async getContractsByProject(projectId: string) { 
    return await this.db.select().from(contracts).where(eq(contracts.projectId, projectId));
  }
  
  // Contract Templates - PostgreSQL implementation
  async getContractTemplates(tenantId: string) {
    return await this.db.select().from(contractTemplates)
      .where(eq(contractTemplates.tenantId, tenantId))
      .orderBy(desc(contractTemplates.createdAt));
  }
  async getContractTemplate(id: string, tenantId: string) {
    const result = await this.db.select().from(contractTemplates)
      .where(and(eq(contractTemplates.id, id), eq(contractTemplates.tenantId, tenantId)));
    return result[0];
  }
  async createContractTemplate(template: InsertContractTemplate, tenantId: string) {
    const result = await this.db.insert(contractTemplates).values({
      ...template,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateContractTemplate(id: string, template: Partial<InsertContractTemplate>, tenantId: string) {
    const result = await this.db.update(contractTemplates).set({
      ...template,
      updatedAt: new Date(),
    }).where(and(eq(contractTemplates.id, id), eq(contractTemplates.tenantId, tenantId))).returning();
    return result[0];
  }
  async deleteContractTemplate(id: string, tenantId: string) {
    const result = await this.db.delete(contractTemplates)
      .where(and(eq(contractTemplates.id, id), eq(contractTemplates.tenantId, tenantId)));
    return result.rowCount > 0;
  }
  
  // Document Views - PostgreSQL implementation
  async recordDocumentView(tenantId: string, documentType: string, documentId: string, ipAddress: string | null, userAgent: string | null): Promise<void> {
    await this.db.insert(documentViews).values({
      tenantId,
      documentType,
      documentId,
      ipAddress,
      userAgent,
      viewedAt: new Date(),
    });
  }
  
  async getDocumentViews(tenantId: string, documentType: string, documentId: string): Promise<any[]> {
    return await this.db.select().from(documentViews)
      .where(and(
        eq(documentViews.tenantId, tenantId),
        eq(documentViews.documentType, documentType),
        eq(documentViews.documentId, documentId)
      ))
      .orderBy(desc(documentViews.viewedAt));
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
    
    // Update project timestamp
    if (result[0].projectId && result[0].tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
    return result[0];
  }
  async updateInvoice(id: string, invoice: Partial<InsertInvoice>) { 
    const result = await this.db.update(invoices).set({
      ...invoice,
      updatedAt: new Date(),
    }).where(eq(invoices.id, id)).returning();
    
    // Update project timestamp
    if (result[0]?.projectId && result[0]?.tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
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
  
  // Income Categories - Drizzle implementation
  async getIncomeCategories(tenantId: string): Promise<IncomeCategory[]> {
    const categories = await this.db.select().from(incomeCategories)
      .where(eq(incomeCategories.tenantId, tenantId))
      .orderBy(desc(incomeCategories.createdAt));
    
    // Auto-seed predefined categories if none exist for this tenant
    if (categories.length === 0) {
      const predefinedCategories = [
        { name: 'Sales', isSystem: true },
        { name: 'Services', isSystem: true },
        { name: 'Rentals', isSystem: true },
        { name: 'Other', isSystem: true },
      ];
      
      const seededCategories = await Promise.all(
        predefinedCategories.map(cat => 
          this.createIncomeCategory(cat, tenantId)
        )
      );
      
      return seededCategories;
    }
    
    return categories;
  }

  async getIncomeCategory(id: string, tenantId: string): Promise<IncomeCategory | undefined> {
    const result = await this.db.select().from(incomeCategories)
      .where(and(
        eq(incomeCategories.id, id),
        eq(incomeCategories.tenantId, tenantId)
      ));
    return result[0];
  }

  async createIncomeCategory(insertCategory: InsertIncomeCategory, tenantId: string): Promise<IncomeCategory> {
    const result = await this.db.insert(incomeCategories).values({
      ...insertCategory,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateIncomeCategory(id: string, categoryUpdate: Partial<InsertIncomeCategory>, tenantId: string): Promise<IncomeCategory | undefined> {
    const result = await this.db.update(incomeCategories).set({
      ...categoryUpdate,
      updatedAt: new Date(),
    }).where(and(
      eq(incomeCategories.id, id),
      eq(incomeCategories.tenantId, tenantId)
    )).returning();
    return result[0];
  }

  async deleteIncomeCategory(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(incomeCategories).where(and(
      eq(incomeCategories.id, id),
      eq(incomeCategories.tenantId, tenantId)
    ));
    return result.rowCount > 0;
  }

  // Invoice Items (Products & Services) - Drizzle implementation
  async getInvoiceItems(tenantId: string): Promise<InvoiceItem[]> {
    return await this.db.select().from(invoiceItems)
      .where(eq(invoiceItems.tenantId, tenantId))
      .orderBy(desc(invoiceItems.createdAt));
  }

  async getInvoiceItem(id: string, tenantId: string): Promise<InvoiceItem | undefined> {
    const result = await this.db.select().from(invoiceItems)
      .where(and(
        eq(invoiceItems.id, id),
        eq(invoiceItems.tenantId, tenantId)
      ));
    return result[0];
  }

  async createInvoiceItem(insertItem: InsertInvoiceItem, tenantId: string): Promise<InvoiceItem> {
    const result = await this.db.insert(invoiceItems).values({
      ...insertItem,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateInvoiceItem(id: string, itemUpdate: Partial<InsertInvoiceItem>, tenantId: string): Promise<InvoiceItem | undefined> {
    const result = await this.db.update(invoiceItems).set({
      ...itemUpdate,
      updatedAt: new Date(),
    }).where(and(
      eq(invoiceItems.id, id),
      eq(invoiceItems.tenantId, tenantId)
    )).returning();
    return result[0];
  }

  async deleteInvoiceItem(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(invoiceItems).where(and(
      eq(invoiceItems.id, id),
      eq(invoiceItems.tenantId, tenantId)
    ));
    return result.rowCount > 0;
  }

  // Tax Settings - Drizzle implementation
  async getTaxSettings(tenantId: string): Promise<TaxSettings | undefined> {
    const result = await this.db.select().from(taxSettings)
      .where(eq(taxSettings.tenantId, tenantId));
    return result[0];
  }

  async createTaxSettings(insertSettings: InsertTaxSettings, tenantId: string): Promise<TaxSettings> {
    const result = await this.db.insert(taxSettings).values({
      ...insertSettings,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateTaxSettings(tenantId: string, settingsUpdate: Partial<InsertTaxSettings>): Promise<TaxSettings | undefined> {
    const result = await this.db.update(taxSettings).set({
      ...settingsUpdate,
      updatedAt: new Date(),
    }).where(eq(taxSettings.tenantId, tenantId)).returning();
    return result[0];
  }
  
  // Invoice Line Items - Drizzle implementation
  async getInvoiceLineItems(invoiceId: string, tenantId: string): Promise<InvoiceLineItem[]> {
    return await this.db.select().from(invoiceLineItems)
      .where(and(
        eq(invoiceLineItems.invoiceId, invoiceId),
        eq(invoiceLineItems.tenantId, tenantId)
      ))
      .orderBy(invoiceLineItems.displayOrder);
  }

  async createInvoiceLineItem(item: InsertInvoiceLineItem, tenantId: string): Promise<InvoiceLineItem> {
    const result = await this.db.insert(invoiceLineItems).values({
      ...item,
      tenantId,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async deleteInvoiceLineItems(invoiceId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(invoiceLineItems).where(and(
      eq(invoiceLineItems.invoiceId, invoiceId),
      eq(invoiceLineItems.tenantId, tenantId)
    ));
    return result.rowCount > 0;
  }

  // Payment Schedules - Drizzle implementation
  async getPaymentSchedule(invoiceId: string, tenantId: string): Promise<PaymentSchedule | undefined> {
    const result = await this.db.select().from(paymentSchedules)
      .where(and(
        eq(paymentSchedules.invoiceId, invoiceId),
        eq(paymentSchedules.tenantId, tenantId)
      ));
    return result[0];
  }

  async createPaymentSchedule(schedule: InsertPaymentSchedule, tenantId: string): Promise<PaymentSchedule> {
    const result = await this.db.insert(paymentSchedules).values({
      ...schedule,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updatePaymentSchedule(id: string, schedule: Partial<InsertPaymentSchedule>, tenantId: string): Promise<PaymentSchedule | undefined> {
    const result = await this.db.update(paymentSchedules).set({
      ...schedule,
      updatedAt: new Date(),
    }).where(and(
      eq(paymentSchedules.id, id),
      eq(paymentSchedules.tenantId, tenantId)
    )).returning();
    return result[0];
  }

  async deletePaymentSchedule(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(paymentSchedules).where(and(
      eq(paymentSchedules.id, id),
      eq(paymentSchedules.tenantId, tenantId)
    ));
    return result.rowCount > 0;
  }

  // Payment Installments - Drizzle implementation
  async getPaymentInstallments(scheduleId: string, tenantId: string): Promise<PaymentInstallment[]> {
    return await this.db.select().from(paymentInstallments)
      .where(and(
        eq(paymentInstallments.paymentScheduleId, scheduleId),
        eq(paymentInstallments.tenantId, tenantId)
      ))
      .orderBy(paymentInstallments.installmentNumber);
  }

  async createPaymentInstallment(installment: InsertPaymentInstallment, tenantId: string): Promise<PaymentInstallment> {
    const result = await this.db.insert(paymentInstallments).values({
      ...installment,
      tenantId,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async updatePaymentInstallment(id: string, installment: Partial<InsertPaymentInstallment>, tenantId: string): Promise<PaymentInstallment | undefined> {
    const result = await this.db.update(paymentInstallments).set(installment)
      .where(and(
        eq(paymentInstallments.id, id),
        eq(paymentInstallments.tenantId, tenantId)
      )).returning();
    return result[0];
  }

  async deletePaymentInstallments(scheduleId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(paymentInstallments).where(and(
      eq(paymentInstallments.paymentScheduleId, scheduleId),
      eq(paymentInstallments.tenantId, tenantId)
    ));
    return result.rowCount > 0;
  }

  // Recurring Invoice Settings - Drizzle implementation
  async getRecurringInvoiceSettings(invoiceId: string, tenantId: string): Promise<RecurringInvoiceSettings | undefined> {
    const result = await this.db.select().from(recurringInvoiceSettings)
      .where(and(
        eq(recurringInvoiceSettings.invoiceId, invoiceId),
        eq(recurringInvoiceSettings.tenantId, tenantId)
      ));
    return result[0];
  }

  async createRecurringInvoiceSettings(settings: InsertRecurringInvoiceSettings, tenantId: string): Promise<RecurringInvoiceSettings> {
    const result = await this.db.insert(recurringInvoiceSettings).values({
      ...settings,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateRecurringInvoiceSettings(id: string, settings: Partial<InsertRecurringInvoiceSettings>, tenantId: string): Promise<RecurringInvoiceSettings | undefined> {
    const result = await this.db.update(recurringInvoiceSettings).set({
      ...settings,
      updatedAt: new Date(),
    }).where(and(
      eq(recurringInvoiceSettings.id, id),
      eq(recurringInvoiceSettings.tenantId, tenantId)
    )).returning();
    return result[0];
  }

  async deleteRecurringInvoiceSettings(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(recurringInvoiceSettings).where(and(
      eq(recurringInvoiceSettings.id, id),
      eq(recurringInvoiceSettings.tenantId, tenantId)
    ));
    return result.rowCount > 0;
  }

  // Payment Transactions - Drizzle implementation
  async getPaymentTransactions(invoiceId: string, tenantId: string): Promise<PaymentTransaction[]> {
    return await this.db.select().from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.invoiceId, invoiceId),
        eq(paymentTransactions.tenantId, tenantId)
      ))
      .orderBy(desc(paymentTransactions.createdAt));
  }

  async createPaymentTransaction(transaction: InsertPaymentTransaction, tenantId: string): Promise<PaymentTransaction> {
    const result = await this.db.insert(paymentTransactions).values({
      ...transaction,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updatePaymentTransaction(id: string, transaction: Partial<InsertPaymentTransaction>, tenantId: string): Promise<PaymentTransaction | undefined> {
    const result = await this.db.update(paymentTransactions).set({
      ...transaction,
      updatedAt: new Date(),
    }).where(and(
      eq(paymentTransactions.id, id),
      eq(paymentTransactions.tenantId, tenantId)
    )).returning();
    return result[0];
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
    
    // Update project timestamp
    if (result[0].projectId && result[0].tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
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
    
    // Update project timestamp
    if (result[0]?.projectId && result[0]?.tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
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
  
  // Emails - PostgreSQL implementation with tenant isolation
  async getEmails(tenantId?: string) { 
    // QUERY GUARD: Only return emails with valid contact links AND proper tenant isolation
    const { withTenantAnd } = await import('./utils/tenantQueries');
    const whereCondition = tenantId 
      ? withTenantAnd(emails.tenantId, tenantId, isNotNull(emails.contactId))
      : isNotNull(emails.contactId);
    return await this.db.select().from(emails)
      .where(whereCondition)
      .orderBy(desc(emails.createdAt));
  }
  async getEmail(id: string, tenantId?: string) { 
    // QUERY GUARD: Only return emails with valid contact links AND proper tenant isolation
    const { withTenantAnd } = await import('./utils/tenantQueries');
    const whereCondition = tenantId 
      ? withTenantAnd(emails.tenantId, tenantId, and(eq(emails.id, id), isNotNull(emails.contactId)))
      : and(eq(emails.id, id), isNotNull(emails.contactId));
    const result = await this.db.select().from(emails).where(whereCondition);
    return result[0];
  }
  async getEmailsByClient(clientId: string, tenantId?: string) { 
    // QUERY GUARD: contactId filter ensures valid contact links AND proper tenant isolation
    const { withTenantAnd } = await import('./utils/tenantQueries');
    const whereCondition = tenantId 
      ? withTenantAnd(emails.tenantId, tenantId, eq(emails.contactId, clientId))
      : eq(emails.contactId, clientId);
    return await this.db.select().from(emails).where(whereCondition);
  }
  async getEmailsByProject(projectId: string, tenantId?: string) { 
    // QUERY GUARD: Only return emails with valid contact links AND proper tenant isolation
    const { withTenantAnd } = await import('./utils/tenantQueries');
    const whereCondition = tenantId 
      ? withTenantAnd(emails.tenantId, tenantId, and(eq(emails.projectId, projectId), isNotNull(emails.contactId)))
      : and(eq(emails.projectId, projectId), isNotNull(emails.contactId));
    return await this.db.select().from(emails).where(whereCondition);
  }
  async createEmail(email: InsertEmail) { 
    const result = await this.db.insert(emails).values({
      ...email,
      createdAt: new Date(),
    }).returning();
    
    // Update project timestamp
    if (result[0].projectId && result[0].tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
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
    
    // Update project timestamp
    if (result[0].projectId && result[0].tenantId) {
      await this.touchProject(result[0].projectId, result[0].tenantId);
    }
    
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
  async getMembers(tenantId: string): Promise<Member[]> {
    return await this.db.select().from(members).where(eq(members.tenantId, tenantId));
  }

  async getMember(id: string, tenantId: string): Promise<Member | undefined> {
    const result = await this.db.select().from(members).where(and(eq(members.id, id), eq(members.tenantId, tenantId)));
    return result[0];
  }

  async createMember(member: InsertMember, tenantId: string): Promise<Member> {
    const result = await this.db.insert(members).values({ ...member, tenantId }).returning();
    return result[0];
  }

  async updateMember(id: string, member: Partial<InsertMember>, tenantId: string): Promise<Member | undefined> {
    const result = await this.db.update(members).set(member).where(and(eq(members.id, id), eq(members.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteMember(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(members).where(and(eq(members.id, id), eq(members.tenantId, tenantId)));
    return result.rowCount > 0;
  }
  
  // Venues - PostgreSQL implementation
  async getVenues(tenantId: string, limit?: number, offset?: number): Promise<Venue[]> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    // Use Drizzle ORM instead of raw SQL to properly map column names to camelCase
    let query = this.db.select()
      .from(venues)
      .where(eq(venues.tenantId, tenantId))
      .orderBy(desc(venues.createdAt));
    
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    
    if (offset !== undefined) {
      query = query.offset(offset);
    }
    
    return await query;
  }

  async getVenuesCount(tenantId: string): Promise<number> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(venues)
      .where(eq(venues.tenantId, tenantId));
    return result[0]?.count || 0;
  }

  async getVenue(id: string, tenantId: string): Promise<Venue | undefined> {
    if (!tenantId) {
      throw new Error("SECURITY: tenantId is required to prevent cross-tenant data access");
    }
    
    const result = await this.db.select().from(venues)
      .where(and(eq(venues.id, id), eq(venues.tenantId, tenantId)));
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
  async getProjectMembers(projectId: string, tenantId: string): Promise<ProjectMember[]> {
    // Get project to verify tenantId
    const project = await this.db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId))).limit(1);
    if (!project || project.length === 0) {
      return [];
    }
    return await this.db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
  }

  async addProjectMember(projectMember: InsertProjectMember): Promise<ProjectMember> {
    const result = await this.db.insert(projectMembers).values(projectMember).returning();
    return result[0];
  }

  async updateProjectMember(projectId: string, memberId: string, data: Partial<InsertProjectMember>, tenantId: string): Promise<ProjectMember | undefined> {
    const result = await this.db.update(projectMembers)
      .set(data)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.memberId, memberId), eq(projectMembers.tenantId, tenantId)))
      .returning();
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

  async addMemberAvailability(availability: InsertMemberAvailability, tenantId?: string): Promise<MemberAvailability> {
    const result = await this.db.insert(memberAvailability).values({ ...availability, tenantId: tenantId || availability.tenantId }).returning();
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

  // Member Groups - PostgreSQL implementation
  async getMemberGroups(tenantId: string): Promise<MemberGroup[]> {
    return await this.db.select().from(memberGroups).where(eq(memberGroups.tenantId, tenantId)).orderBy(memberGroups.name);
  }

  async getMemberGroup(id: string, tenantId: string): Promise<MemberGroup | undefined> {
    const result = await this.db.select().from(memberGroups).where(and(eq(memberGroups.id, id), eq(memberGroups.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createMemberGroup(group: InsertMemberGroup, tenantId: string): Promise<MemberGroup> {
    const result = await this.db.insert(memberGroups).values({ ...group, tenantId }).returning();
    return result[0];
  }

  async updateMemberGroup(id: string, group: Partial<InsertMemberGroup>, tenantId: string): Promise<MemberGroup | undefined> {
    const result = await this.db.update(memberGroups).set({ ...group, updatedAt: new Date() }).where(and(eq(memberGroups.id, id), eq(memberGroups.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteMemberGroup(id: string, tenantId: string): Promise<boolean> {
    await this.db.delete(memberGroupMembers).where(and(eq(memberGroupMembers.groupId, id), eq(memberGroupMembers.tenantId, tenantId)));
    const result = await this.db.delete(memberGroups).where(and(eq(memberGroups.id, id), eq(memberGroups.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  async getMemberGroupMembers(groupId: string, tenantId: string): Promise<MemberGroupMember[]> {
    return await this.db.select().from(memberGroupMembers).where(and(eq(memberGroupMembers.groupId, groupId), eq(memberGroupMembers.tenantId, tenantId))).orderBy(memberGroupMembers.orderIndex);
  }

  async addMemberToGroup(data: InsertMemberGroupMember, tenantId: string): Promise<MemberGroupMember> {
    const result = await this.db.insert(memberGroupMembers).values({ ...data, tenantId }).returning();
    return result[0];
  }

  async removeMemberFromGroup(groupId: string, memberId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(memberGroupMembers).where(and(eq(memberGroupMembers.groupId, groupId), eq(memberGroupMembers.memberId, memberId), eq(memberGroupMembers.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Performer Contracts - PostgreSQL implementation
  async getPerformerContracts(tenantId: string, projectId?: string): Promise<PerformerContract[]> {
    const conditions = projectId
      ? and(eq(performerContracts.tenantId, tenantId), eq(performerContracts.projectId, projectId))
      : eq(performerContracts.tenantId, tenantId);
    return await this.db.select().from(performerContracts).where(conditions).orderBy(desc(performerContracts.createdAt));
  }

  async getPerformerContract(id: string, tenantId: string): Promise<PerformerContract | undefined> {
    const result = await this.db.select().from(performerContracts).where(and(eq(performerContracts.id, id), eq(performerContracts.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createPerformerContract(contract: InsertPerformerContract, tenantId: string): Promise<PerformerContract> {
    const result = await this.db.insert(performerContracts).values({ ...contract, tenantId }).returning();
    return result[0];
  }

  async updatePerformerContract(id: string, contract: Partial<InsertPerformerContract>, tenantId: string): Promise<PerformerContract | undefined> {
    const result = await this.db.update(performerContracts).set({ ...contract, updatedAt: new Date() }).where(and(eq(performerContracts.id, id), eq(performerContracts.tenantId, tenantId))).returning();
    return result[0];
  }

  async deletePerformerContract(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(performerContracts).where(and(eq(performerContracts.id, id), eq(performerContracts.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Repertoire - PostgreSQL implementation
  async getRepertoire(tenantId: string): Promise<Repertoire[]> {
    return await this.db.select().from(repertoire).where(eq(repertoire.tenantId, tenantId)).orderBy(repertoire.title);
  }

  async getRepertoireItem(id: string, tenantId: string): Promise<Repertoire | undefined> {
    const result = await this.db.select().from(repertoire).where(and(eq(repertoire.id, id), eq(repertoire.tenantId, tenantId))).limit(1);
    return result[0];
  }

  async createRepertoireItem(item: InsertRepertoire, tenantId: string): Promise<Repertoire> {
    const result = await this.db.insert(repertoire).values({ ...item, tenantId }).returning();
    return result[0];
  }

  async updateRepertoireItem(id: string, item: Partial<InsertRepertoire>, tenantId: string): Promise<Repertoire | undefined> {
    const result = await this.db.update(repertoire).set({ ...item, updatedAt: new Date() }).where(and(eq(repertoire.id, id), eq(repertoire.tenantId, tenantId))).returning();
    return result[0];
  }

  async deleteRepertoireItem(id: string, tenantId: string): Promise<boolean> {
    await this.db.delete(projectSetlist).where(eq(projectSetlist.songId, id));
    const result = await this.db.delete(repertoire).where(and(eq(repertoire.id, id), eq(repertoire.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Project Setlist - PostgreSQL implementation
  async getProjectSetlist(projectId: string, tenantId: string): Promise<ProjectSetlist[]> {
    return await this.db.select().from(projectSetlist).where(and(eq(projectSetlist.projectId, projectId), eq(projectSetlist.tenantId, tenantId))).orderBy(projectSetlist.setNumber, projectSetlist.orderIndex);
  }

  async addSongToSetlist(item: InsertProjectSetlist, tenantId: string): Promise<ProjectSetlist> {
    const result = await this.db.insert(projectSetlist).values({ ...item, tenantId }).returning();
    return result[0];
  }

  async updateSetlistItem(projectId: string, songId: string, data: Partial<InsertProjectSetlist>, tenantId: string): Promise<ProjectSetlist | undefined> {
    const result = await this.db.update(projectSetlist).set(data).where(and(eq(projectSetlist.projectId, projectId), eq(projectSetlist.songId, songId), eq(projectSetlist.tenantId, tenantId))).returning();
    return result[0];
  }

  async removeSongFromSetlist(projectId: string, songId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(projectSetlist).where(and(eq(projectSetlist.projectId, projectId), eq(projectSetlist.songId, songId), eq(projectSetlist.tenantId, tenantId)));
    return result.rowCount > 0;
  }
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
  async getProjectNotes(projectId: string, tenantId: string): Promise<ProjectNote[]> {
    // Get project to verify tenantId
    const project = await this.db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId))).limit(1);
    if (!project || project.length === 0) {
      return [];
    }
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
  async getMessageTemplates(tenantId: string): Promise<MessageTemplate[]> {
    return await this.db.select().from(messageTemplates).where(eq(messageTemplates.tenantId, tenantId));
  }

  async getMessageTemplatesByType(type: string, tenantId: string): Promise<MessageTemplate[]> {
    return await this.db.select().from(messageTemplates)
      .where(and(
        eq(messageTemplates.type, type),
        eq(messageTemplates.tenantId, tenantId)
      ));
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
  
  // Auto-responder Logs - PostgreSQL implementation (TENANT SECURE)
  async getAutoResponderLogs(tenantId: string): Promise<AutoResponderLog[]> {
    return await this.db.select().from(autoResponderLogs)
      .where(eq(autoResponderLogs.tenantId, tenantId))
      .orderBy(desc(autoResponderLogs.createdAt));
  }

  async getAutoResponderLog(id: string, tenantId: string): Promise<AutoResponderLog | undefined> {
    const result = await this.db.select().from(autoResponderLogs).where(and(
      eq(autoResponderLogs.id, id),
      eq(autoResponderLogs.tenantId, tenantId)
    ));
    return result[0];
  }

  async getAutoResponderLogsByLead(leadId: string, tenantId: string): Promise<AutoResponderLog[]> {
    return await this.db.select().from(autoResponderLogs)
      .where(and(
        eq(autoResponderLogs.leadId, leadId),
        eq(autoResponderLogs.tenantId, tenantId)
      ))
      .orderBy(desc(autoResponderLogs.createdAt));
  }

  async getDueAutoResponderLogs(tenantId: string): Promise<AutoResponderLog[]> {
    const now = new Date();
    return await this.db.select().from(autoResponderLogs)
      .where(and(
        eq(autoResponderLogs.tenantId, tenantId),
        eq(autoResponderLogs.status, 'queued'),
        lte(autoResponderLogs.scheduledFor, now)
      ))
      .orderBy(autoResponderLogs.scheduledFor);
  }

  async createAutoResponderLog(log: InsertAutoResponderLog, tenantId: string): Promise<AutoResponderLog> {
    const result = await this.db.insert(autoResponderLogs).values({
      ...log,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateAutoResponderLog(id: string, log: Partial<InsertAutoResponderLog>, tenantId: string): Promise<AutoResponderLog | undefined> {
    const result = await this.db.update(autoResponderLogs)
      .set({ ...log, updatedAt: new Date() })
      .where(and(
        eq(autoResponderLogs.id, id),
        eq(autoResponderLogs.tenantId, tenantId)
      ))
      .returning();
    return result[0];
  }
  
  // Message Threads - PostgreSQL implementation (TENANT SECURE)
  async getMessageThreads(tenantId: string) { 
    return await this.db.select().from(messageThreads)
      .where(eq(messageThreads.tenantId, tenantId))
      .orderBy(desc(messageThreads.createdAt));
  }
  async getMessageThread(id: string, tenantId: string) { 
    const result = await this.db.select().from(messageThreads)
      .where(and(
        eq(messageThreads.id, id),
        eq(messageThreads.tenantId, tenantId)
      ));
    return result[0];
  }
  async createMessageThread(thread: InsertMessageThread) { 
    // tenantId must be included in thread data for security
    if (!thread.tenantId) {
      throw new Error('tenantId is required for message thread creation');
    }
    const result = await this.db.insert(messageThreads).values({
      ...thread,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }
  async updateMessageThread(id: string, thread: Partial<InsertMessageThread>, tenantId: string) { 
    const result = await this.db.update(messageThreads)
      .set(thread)
      .where(and(
        eq(messageThreads.id, id),
        eq(messageThreads.tenantId, tenantId)
      ))
      .returning();
    return result[0];
  }
  async deleteMessageThread(id: string, tenantId: string) { 
    const result = await this.db.delete(messageThreads)
      .where(and(
        eq(messageThreads.id, id),
        eq(messageThreads.tenantId, tenantId)
      ));
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
  async getDashboardMetrics(tenantId: string, userId?: string): Promise<{
    totalLeads: number;
    activeProjects: number;
    revenue: number;
    pendingInvoices: number;
  }> { 
    // Calculate metrics from PostgreSQL data
    const leads = await this.getLeads(tenantId, userId);
    const projects = await this.getProjects(tenantId, userId);
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
  async getRecentActivities(tenantId: string, limit: number = 10) { 
    return await this.db.select().from(activities)
      .where(eq(activities.tenantId, tenantId))
      .orderBy(desc(activities.createdAt))
      .limit(limit);
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
  async getEmailsByThread(threadId: string, tenantId: string): Promise<Email[]> {
    return await this.db.select().from(emails).where(and(eq(emails.threadId, threadId), eq(emails.tenantId, tenantId)));
  }
  async getSmsMessagesByThread(threadId: string) { return []; }
  async getSmsMessagesByClient(clientId: string) { return []; }
  async getSmsMessagesByPhone(phone: string) { return []; }
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
  async getTemplates(tenantId: string): Promise<Template[]> {
    console.log('🔍 [getTemplates] Called with tenantId:', tenantId);
    const result = await this.db.select().from(templates).where(eq(templates.tenantId, tenantId));
    console.log('📦 [getTemplates] Query result:', result.length, 'templates found');
    console.log('📦 [getTemplates] Full results:', JSON.stringify(result, null, 2));
    return result;
  }

  async getTemplate(id: string, tenantId: string): Promise<Template | undefined> {
    // SECURITY FIX: Added tenant scoping to prevent cross-tenant template access
    const result = await this.db.select().from(templates).where(and(
      eq(templates.id, id),
      eq(templates.tenantId, tenantId)
    ));
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

  // Quote Items (line items for quotes) - TENANT SECURE
  async getQuoteItems(quoteId: string, tenantId: string): Promise<QuoteItem[]> {
    return await this.db.select().from(quoteItems)
      .where(and(
        eq(quoteItems.quoteId, quoteId),
        eq(quoteItems.tenantId, tenantId)
      ))
      .orderBy(quoteItems.createdAt);
  }

  async createQuoteItem(item: InsertQuoteItem): Promise<QuoteItem> {
    // tenantId must be included for security
    if (!item.tenantId) {
      throw new Error('tenantId is required for quote item creation');
    }
    const result = await this.db.insert(quoteItems).values({
      ...item,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateQuoteItem(id: string, item: Partial<InsertQuoteItem>, tenantId: string): Promise<QuoteItem | undefined> {
    const result = await this.db.update(quoteItems)
      .set(item)
      .where(and(
        eq(quoteItems.id, id),
        eq(quoteItems.tenantId, tenantId)
      ))
      .returning();
    return result[0];
  }

  async deleteQuoteItem(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(quoteItems)
      .where(and(
        eq(quoteItems.id, id),
        eq(quoteItems.tenantId, tenantId)
      ));
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

  // Lead Custom Fields System Implementation
  
  // Lead Custom Field Definitions
  async getLeadCustomFields(tenantId: string, userId?: string): Promise<LeadCustomField[]> {
    const conditions = [eq(leadCustomFields.tenantId, tenantId)];
    
    if (userId) {
      conditions.push(or(
        eq(leadCustomFields.userId, userId),
        and(eq(leadCustomFields.isStandard, true), isNull(leadCustomFields.userId))
      ));
    } else {
      // Return only standard fields if no userId provided
      conditions.push(and(eq(leadCustomFields.isStandard, true), isNull(leadCustomFields.userId)));
    }
    
    return await this.db.select().from(leadCustomFields)
      .where(and(...conditions))
      .orderBy(leadCustomFields.displayOrder, leadCustomFields.createdAt);
  }

  async getLeadCustomField(id: string, tenantId: string): Promise<LeadCustomField | undefined> {
    const result = await this.db.select().from(leadCustomFields)
      .where(and(eq(leadCustomFields.id, id), eq(leadCustomFields.tenantId, tenantId)));
    return result[0];
  }

  async getLeadCustomFieldByKey(key: string, tenantId: string, userId?: string): Promise<LeadCustomField | undefined> {
    const conditions = [
      eq(leadCustomFields.tenantId, tenantId),
      eq(leadCustomFields.key, key)
    ];
    
    if (userId) {
      conditions.push(or(
        eq(leadCustomFields.userId, userId),
        and(eq(leadCustomFields.isStandard, true), isNull(leadCustomFields.userId))
      ));
    } else {
      conditions.push(and(eq(leadCustomFields.isStandard, true), isNull(leadCustomFields.userId)));
    }
    
    const result = await this.db.select().from(leadCustomFields)
      .where(and(...conditions));
    return result[0];
  }

  async createLeadCustomField(field: InsertLeadCustomField, tenantId: string): Promise<LeadCustomField> {
    const newField = { ...field, tenantId };
    const result = await this.db.insert(leadCustomFields).values(newField).returning();
    return result[0];
  }

  async updateLeadCustomField(id: string, field: Partial<InsertLeadCustomField>, tenantId: string): Promise<LeadCustomField | undefined> {
    const result = await this.db.update(leadCustomFields)
      .set({ ...omitUndefined(field), updatedAt: new Date() })
      .where(and(eq(leadCustomFields.id, id), eq(leadCustomFields.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async deleteLeadCustomField(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(leadCustomFields)
      .where(and(eq(leadCustomFields.id, id), eq(leadCustomFields.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Lead Custom Field Responses
  async getLeadCustomFieldResponses(leadId: string, tenantId: string): Promise<LeadCustomFieldResponse[]> {
    return await this.db.select().from(leadCustomFieldResponses)
      .where(and(
        eq(leadCustomFieldResponses.leadId, leadId),
        eq(leadCustomFieldResponses.tenantId, tenantId)
      ));
  }

  async getLeadCustomFieldResponse(leadId: string, fieldKey: string, tenantId: string): Promise<LeadCustomFieldResponse | undefined> {
    const result = await this.db.select().from(leadCustomFieldResponses)
      .where(and(
        eq(leadCustomFieldResponses.leadId, leadId),
        eq(leadCustomFieldResponses.fieldKey, fieldKey),
        eq(leadCustomFieldResponses.tenantId, tenantId)
      ));
    return result[0];
  }

  async createLeadCustomFieldResponse(response: InsertLeadCustomFieldResponse, tenantId: string): Promise<LeadCustomFieldResponse> {
    const newResponse = { ...response, tenantId };
    const result = await this.db.insert(leadCustomFieldResponses).values(newResponse).returning();
    return result[0];
  }

  async updateLeadCustomFieldResponse(leadId: string, fieldKey: string, response: Partial<InsertLeadCustomFieldResponse>, tenantId: string): Promise<LeadCustomFieldResponse | undefined> {
    const result = await this.db.update(leadCustomFieldResponses)
      .set({ ...omitUndefined(response), updatedAt: new Date() })
      .where(and(
        eq(leadCustomFieldResponses.leadId, leadId),
        eq(leadCustomFieldResponses.fieldKey, fieldKey),
        eq(leadCustomFieldResponses.tenantId, tenantId)
      ))
      .returning();
    return result[0];
  }

  async upsertLeadCustomFieldResponse(response: InsertLeadCustomFieldResponse, tenantId: string): Promise<LeadCustomFieldResponse> {
    const newResponse = { ...response, tenantId };
    const result = await this.db.insert(leadCustomFieldResponses)
      .values(newResponse)
      .onConflictDoUpdate({
        target: [leadCustomFieldResponses.leadId, leadCustomFieldResponses.fieldKey],
        set: {
          value: response.value,
          fileName: response.fileName,
          fileSize: response.fileSize,
          mimeType: response.mimeType,
          updatedAt: new Date()
        }
      })
      .returning();
    return result[0];
  }

  async deleteLeadCustomFieldResponse(leadId: string, fieldKey: string, tenantId: string): Promise<boolean> {
    const result = await this.db.delete(leadCustomFieldResponses)
      .where(and(
        eq(leadCustomFieldResponses.leadId, leadId),
        eq(leadCustomFieldResponses.fieldKey, fieldKey),
        eq(leadCustomFieldResponses.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }

  // Admin Audit Logs - DrizzleStorage implementation
  async getAdminAuditLogs(adminUserId?: string, impersonatedUserId?: string, tenantId?: string): Promise<AdminAuditLog[]> {
    const conditions = [];
    
    if (adminUserId) {
      conditions.push(eq(adminAuditLogs.adminUserId, adminUserId));
    }
    if (impersonatedUserId) {
      conditions.push(eq(adminAuditLogs.impersonatedUserId, impersonatedUserId));
    }
    if (tenantId) {
      conditions.push(eq(adminAuditLogs.tenantId, tenantId));
    }
    
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    return await this.db
      .select()
      .from(adminAuditLogs)
      .where(whereCondition)
      .orderBy(desc(adminAuditLogs.timestamp));
  }

  async getAdminAuditLog(id: string): Promise<AdminAuditLog | undefined> {
    const result = await this.db
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.id, id))
      .limit(1);
    return result[0];
  }

  async createAdminAuditLog(auditLog: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const result = await this.db
      .insert(adminAuditLogs)
      .values(auditLog)
      .returning();
    return result[0];
  }

  // Form Submissions - Security idempotency tracking
  async getFormSubmissionByKey(tenantId: string, submissionKey: string): Promise<FormSubmission | undefined> {
    const result = await this.db
      .select()
      .from(formSubmissions)
      .where(and(
        eq(formSubmissions.tenantId, tenantId),
        eq(formSubmissions.submissionKey, submissionKey)
      ))
      .limit(1);
    return result[0];
  }

  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const result = await this.db
      .insert(formSubmissions)
      .values(submission)
      .returning();
    return result[0];
  }

  async deleteFormSubmission(id: string): Promise<boolean> {
    const result = await this.db
      .delete(formSubmissions)
      .where(eq(formSubmissions.id, id));
    return result.rowCount > 0;
  }
  
  // Lead Consent - GDPR compliance tracking
  async createLeadConsent(consent: InsertLeadConsent): Promise<LeadConsent> {
    const result = await this.db
      .insert(leadConsents)
      .values(consent)
      .returning();
    return result[0];
  }

  async getLeadConsents(leadId: string, tenantId: string): Promise<LeadConsent[]> {
    return await this.db
      .select()
      .from(leadConsents)
      .where(and(
        eq(leadConsents.leadId, leadId),
        eq(leadConsents.tenantId, tenantId)
      ))
      .orderBy(desc(leadConsents.createdAt));
  }

  async updateLeadConsent(id: string, consent: Partial<InsertLeadConsent>, tenantId: string): Promise<LeadConsent | undefined> {
    const result = await this.db
      .update(leadConsents)
      .set({ ...omitUndefined(consent), updatedAt: new Date() })
      .where(and(
        eq(leadConsents.id, id),
        eq(leadConsents.tenantId, tenantId)
      ))
      .returning();
    return result[0];
  }

  // Email Provider Catalog (global)
  async getEmailProviderCatalog(): Promise<EmailProviderCatalog[]> {
    return await this.db
      .select()
      .from(emailProviderCatalog)
      .orderBy(emailProviderCatalog.displayName);
  }

  async getActiveEmailProviders(): Promise<EmailProviderCatalog[]> {
    return await this.db
      .select()
      .from(emailProviderCatalog)
      .where(eq(emailProviderCatalog.isActive, true))
      .orderBy(emailProviderCatalog.displayName);
  }

  async getEmailProviderByKey(key: string): Promise<EmailProviderCatalog | undefined> {
    const result = await this.db
      .select()
      .from(emailProviderCatalog)
      .where(eq(emailProviderCatalog.key, key))
      .limit(1);
    return result[0];
  }

  async seedEmailProviders(providers: Omit<EmailProviderCatalog, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    // Insert providers, skip if they already exist (based on unique code constraint)
    for (const provider of providers) {
      try {
        await this.db
          .insert(emailProviderCatalog)
          .values(provider)
          .onConflictDoNothing({ target: emailProviderCatalog.code });
      } catch (error) {
        console.error(`Error seeding provider ${provider.code}:`, error);
      }
    }
  }

  async getTenantEmailPrefs(tenantId: string): Promise<TenantEmailPrefs | null> {
    const result = await this.db
      .select()
      .from(tenantEmailPrefs)
      .where(eq(tenantEmailPrefs.tenantId, tenantId))
      .limit(1);
    return result[0] || null;
  }

  async upsertTenantEmailPrefs(tenantId: string, prefs: Partial<InsertTenantEmailPrefs>): Promise<TenantEmailPrefs> {
    const result = await this.db
      .insert(tenantEmailPrefs)
      .values({
        tenantId,
        ...prefs
      })
      .onConflictDoUpdate({
        target: tenantEmailPrefs.tenantId,
        set: {
          ...omitUndefined(prefs),
          updatedAt: new Date()
        }
      })
      .returning();
    return result[0];
  }

  // Email Provider Configurations
  async getEmailProviderConfigs(tenantId: string, userId?: string): Promise<EmailProviderConfig[]> {
    let query = this.db
      .select()
      .from(emailProviderConfigs)
      .where(eq(emailProviderConfigs.tenantId, tenantId));
    
    if (userId) {
      query = query.where(and(
        eq(emailProviderConfigs.tenantId, tenantId),
        eq(emailProviderConfigs.userId, userId)
      ));
    }
    
    return await query.orderBy(desc(emailProviderConfigs.updatedAt));
  }

  async getEmailProviderConfig(id: string, tenantId: string): Promise<EmailProviderConfig | undefined> {
    const result = await this.db
      .select()
      .from(emailProviderConfigs)
      .where(and(
        eq(emailProviderConfigs.id, id),
        eq(emailProviderConfigs.tenantId, tenantId)
      ))
      .limit(1);
    
    return result[0];
  }

  async getPrimaryEmailProviderConfig(tenantId: string): Promise<EmailProviderConfig | undefined> {
    const result = await this.db
      .select()
      .from(emailProviderConfigs)
      .where(and(
        eq(emailProviderConfigs.tenantId, tenantId),
        eq(emailProviderConfigs.isPrimary, true),
        eq(emailProviderConfigs.isActive, true)
      ))
      .limit(1);
    
    return result[0];
  }

  async getEmailProviderConfigByName(name: string, tenantId: string): Promise<EmailProviderConfig | undefined> {
    const result = await this.db
      .select()
      .from(emailProviderConfigs)
      .where(and(
        eq(emailProviderConfigs.name, name),
        eq(emailProviderConfigs.tenantId, tenantId)
      ))
      .limit(1);
    
    return result[0];
  }

  async createEmailProviderConfig(config: InsertEmailProviderConfig, tenantId: string): Promise<EmailProviderConfig> {
    // If this is set as primary, clear other primary configs for this tenant
    if (config.isPrimary) {
      await this.db
        .update(emailProviderConfigs)
        .set({ 
          isPrimary: false, 
          updatedAt: new Date() 
        })
        .where(and(
          eq(emailProviderConfigs.tenantId, tenantId),
          eq(emailProviderConfigs.isPrimary, true)
        ));
    }

    const result = await this.db
      .insert(emailProviderConfigs)
      .values({
        ...config,
        tenantId,
      })
      .returning();
    
    return result[0];
  }

  async updateEmailProviderConfig(id: string, config: Partial<InsertEmailProviderConfig>, tenantId: string): Promise<EmailProviderConfig | undefined> {
    // If this is being set as primary, clear other primary configs for this tenant
    if (config.isPrimary) {
      await this.db
        .update(emailProviderConfigs)
        .set({ 
          isPrimary: false, 
          updatedAt: new Date() 
        })
        .where(and(
          eq(emailProviderConfigs.tenantId, tenantId),
          eq(emailProviderConfigs.isPrimary, true)
        ));
    }

    const result = await this.db
      .update(emailProviderConfigs)
      .set({ 
        ...omitUndefined(config), 
        updatedAt: new Date() 
      })
      .where(and(
        eq(emailProviderConfigs.id, id),
        eq(emailProviderConfigs.tenantId, tenantId)
      ))
      .returning();
    
    return result[0];
  }

  async deleteEmailProviderConfig(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(emailProviderConfigs)
      .where(and(
        eq(emailProviderConfigs.id, id),
        eq(emailProviderConfigs.tenantId, tenantId)
      ))
      .returning();
    
    return result.length > 0;
  }

  async setPrimaryEmailProviderConfig(id: string, tenantId: string): Promise<boolean> {
    // First clear all primary flags for this tenant
    await this.db
      .update(emailProviderConfigs)
      .set({ 
        isPrimary: false, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(emailProviderConfigs.tenantId, tenantId),
        eq(emailProviderConfigs.isPrimary, true)
      ));

    // Then set the specified config as primary
    const result = await this.db
      .update(emailProviderConfigs)
      .set({ 
        isPrimary: true, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(emailProviderConfigs.id, id),
        eq(emailProviderConfigs.tenantId, tenantId)
      ))
      .returning();
    
    return result.length > 0;
  }

  async updateEmailProviderConfigHealth(id: string, isHealthy: boolean, consecutiveFailures: number, tenantId: string): Promise<boolean> {
    const result = await this.db
      .update(emailProviderConfigs)
      .set({ 
        isHealthy, 
        consecutiveFailures,
        lastHealthCheckAt: new Date(),
        updatedAt: new Date() 
      })
      .where(and(
        eq(emailProviderConfigs.id, id),
        eq(emailProviderConfigs.tenantId, tenantId)
      ))
      .returning();
    
    return result.length > 0;
  }

  async updateEmailProviderConfigUsage(id: string, messagesSent?: number, messagesReceived?: number, tenantId: string): Promise<boolean> {
    const updates: any = {
      lastUsedAt: new Date(),
      updatedAt: new Date()
    };
    
    if (messagesSent !== undefined) {
      updates.messagesSent = messagesSent;
    }
    if (messagesReceived !== undefined) {
      updates.messagesReceived = messagesReceived;
    }

    const result = await this.db
      .update(emailProviderConfigs)
      .set(updates)
      .where(and(
        eq(emailProviderConfigs.id, id),
        eq(emailProviderConfigs.tenantId, tenantId)
      ))
      .returning();
    
    return result.length > 0;
  }

  // Email Provider OAuth Integrations
  async getActiveEmailProvider(userId: string, tenantId: string): Promise<EmailProviderIntegration | null> {
    const result = await this.db
      .select()
      .from(emailAccounts)
      .where(and(
        eq(emailAccounts.tenantId, tenantId),
        eq(emailAccounts.userId, userId),
        eq(emailAccounts.status, 'connected')
      ))
      .orderBy(desc(emailAccounts.updatedAt))
      .limit(1);
    
    if (!result[0]) return null;

    // Always map to legacy format for backward compatibility
    const account = result[0];
    const legacyAccount: any = {
      ...account,
      provider: account.providerKey,
      accessTokenEnc: null,
      refreshTokenEnc: null,
      scopes: []
    };

    // Decrypt secrets if present
    if (account.secretsEnc) {
      const decrypted = secureStore.decrypt(account.secretsEnc);
      const secrets = JSON.parse(decrypted);
      legacyAccount.accessTokenEnc = secrets.access_token;
      legacyAccount.refreshTokenEnc = secrets.refresh_token;
      legacyAccount.scopes = secrets.scopes || [];
    }
    
    return legacyAccount as EmailProviderIntegration;
  }

  async getEmailProviderIntegration(userId: string, tenantId: string, provider: string): Promise<EmailProviderIntegration | null> {
    const result = await this.db
      .select()
      .from(emailAccounts)
      .where(and(
        eq(emailAccounts.tenantId, tenantId),
        eq(emailAccounts.userId, userId),
        eq(emailAccounts.providerKey, provider)
      ))
      .limit(1);
    
    if (!result[0]) return null;

    // Always map to legacy format for backward compatibility
    const account = result[0];
    const legacyAccount: any = {
      ...account,
      provider: account.providerKey,
      accessTokenEnc: null,
      refreshTokenEnc: null,
      scopes: []
    };

    // Decrypt secrets if present
    if (account.secretsEnc) {
      const decrypted = secureStore.decrypt(account.secretsEnc);
      const secrets = JSON.parse(decrypted);
      legacyAccount.accessTokenEnc = secrets.access_token;
      legacyAccount.refreshTokenEnc = secrets.refresh_token;
      legacyAccount.scopes = secrets.scopes || [];
    }
    
    return legacyAccount as EmailProviderIntegration;
  }

  async upsertEmailProviderIntegration(integration: InsertEmailProviderIntegration, tenantId: string): Promise<EmailProviderIntegration> {
    // Ensure tenant scoping
    if (!tenantId) {
      throw new Error('tenantId is required for email provider integration operations');
    }

    // When connecting a new provider, set all other providers for this user/tenant to 'disconnected'
    if (integration.status === 'connected') {
      await this.db
        .update(emailAccounts)
        .set({ 
          status: 'disconnected',
          updatedAt: new Date()
        })
        .where(and(
          eq(emailAccounts.tenantId, tenantId),
          eq(emailAccounts.userId, integration.userId)
        ));
    }

    // Prepare account data with encrypted secrets
    const accountData: any = {
      tenantId,
      userId: integration.userId,
      providerKey: integration.provider || integration.providerKey, // Support legacy field
      status: integration.status,
      accountEmail: integration.accountEmail,
      authType: 'oauth',
      expiresAt: integration.expiresAt,
      metadata: integration.metadata,
      updatedAt: new Date(),
      // Set lastSyncedAt on connection/reconnection so UI shows current timestamp
      lastSyncedAt: integration.status === 'connected' ? new Date() : undefined
    };

    // Create encrypted secrets JSON
    const secrets: any = {
      access_token: integration.accessTokenEnc,
      refresh_token: integration.refreshTokenEnc,
      scopes: integration.scopes || []
    };
    accountData.secretsEnc = secureStore.encrypt(JSON.stringify(secrets));

    // Upsert (insert or update if exists)
    const result = await this.db
      .insert(emailAccounts)
      .values(accountData)
      .onConflictDoUpdate({
        target: [
          emailAccounts.tenantId,
          emailAccounts.userId,
          emailAccounts.providerKey
        ],
        set: {
          ...omitUndefined(accountData),
          updatedAt: new Date()
        }
      })
      .returning();

    const savedAccount = result[0];

    // Decrypt and map to legacy format for return
    if (savedAccount.secretsEnc) {
      const decrypted = secureStore.decrypt(savedAccount.secretsEnc);
      const parsedSecrets = JSON.parse(decrypted);
      return {
        ...savedAccount,
        provider: savedAccount.providerKey,
        accessTokenEnc: parsedSecrets.access_token,
        refreshTokenEnc: parsedSecrets.refresh_token,
        scopes: parsedSecrets.scopes || []
      } as EmailProviderIntegration;
    }

    return savedAccount as EmailProviderIntegration;
  }

  async disconnectEmailProvider(userId: string, tenantId: string, provider: string): Promise<boolean> {
    const result = await this.db
      .update(emailAccounts)
      .set({ 
        status: 'disconnected',
        secretsEnc: null,
        updatedAt: new Date()
      })
      .where(and(
        eq(emailAccounts.tenantId, tenantId),
        eq(emailAccounts.userId, userId),
        eq(emailAccounts.providerKey, provider)
      ))
      .returning();
    
    return result.length > 0;
  }

  async getAllActiveEmailIntegrations(): Promise<EmailProviderIntegration[]> {
    const accounts = await this.db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.status, 'connected'));
    
    return accounts.map(account => {
      // Always map to legacy format for backward compatibility
      const legacyAccount: any = {
        ...account,
        provider: account.providerKey,
        accessTokenEnc: null,
        refreshTokenEnc: null,
        scopes: []
      };

      // Decrypt secrets if present
      if (account.secretsEnc) {
        const decrypted = secureStore.decrypt(account.secretsEnc);
        const secrets = JSON.parse(decrypted);
        legacyAccount.accessTokenEnc = secrets.access_token;
        legacyAccount.refreshTokenEnc = secrets.refresh_token;
        legacyAccount.scopes = secrets.scopes || [];
      }

      return legacyAccount as EmailProviderIntegration;
    });
  }

  async updateEmailIntegrationLastSync(userId: string, tenantId: string, provider: string): Promise<boolean> {
    const result = await this.db
      .update(emailAccounts)
      .set({ 
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(emailAccounts.tenantId, tenantId),
        eq(emailAccounts.userId, userId),
        eq(emailAccounts.providerKey, provider)
      ))
      .returning();
    
    return result.length > 0;
  }

  async updateEmailIntegrationStatus(userId: string, tenantId: string, provider: string, status: string): Promise<boolean> {
    const result = await this.db
      .update(emailAccounts)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(and(
        eq(emailAccounts.tenantId, tenantId),
        eq(emailAccounts.userId, userId),
        eq(emailAccounts.providerKey, provider)
      ))
      .returning();
    
    return result.length > 0;
  }

  async getEmailAccountsByUser(userId: string, tenantId: string): Promise<any[]> {
    return await this.db
      .select()
      .from(emailAccounts)
      .where(and(
        eq(emailAccounts.tenantId, tenantId),
        eq(emailAccounts.userId, userId)
      ))
      .orderBy(desc(emailAccounts.updatedAt));
  }

  async deleteEmailAccount(id: number, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(emailAccounts)
      .where(and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.tenantId, tenantId)
      ))
      .returning({ id: emailAccounts.id });
    
    return result.length > 0;
  }

  async decryptEmailAccountSecrets(secretsEnc: string | null): Promise<{ accessToken?: string; refreshToken?: string; scopes?: string[] } | null> {
    if (!secretsEnc) return null;
    
    try {
      const decrypted = secureStore.decrypt(secretsEnc);
      const secrets = JSON.parse(decrypted);
      return {
        accessToken: secrets.access_token,
        refreshToken: secrets.refresh_token,
        scopes: secrets.scopes || []
      };
    } catch (error) {
      console.error('Error decrypting email account secrets:', error);
      return null;
    }
  }

  // Calendar Disconnect Flow
  async markEventsAsReadonly(integrationId: string, tenantId: string, userId: string): Promise<number> {
    const result = await this.db
      .update(events)
      .set({
        isReadonly: true,
        syncState: 'disconnected',
        updatedAt: new Date()
      })
      .where(and(
        eq(events.tenantId, tenantId),
        eq(events.calendarIntegrationId, integrationId),
        eq(events.source, 'google')
      ))
      .returning({ id: events.id });
    
    console.log(`📅 Marked ${result.length} Google events as read-only for integration ${integrationId}`);
    return result.length;
  }

  async purgeGoogleEvents(integrationId: string, tenantId: string, userId: string): Promise<number> {
    const result = await this.db
      .delete(events)
      .where(and(
        eq(events.tenantId, tenantId),
        eq(events.calendarIntegrationId, integrationId),
        eq(events.source, 'google')
      ))
      .returning({ id: events.id });
    
    console.log(`🗑️ Purged ${result.length} Google events for integration ${integrationId}`);
    return result.length;
  }

  async getDisconnectedIntegrations(tenantId: string, userId: string): Promise<CalendarIntegration[]> {
    const integrations = await this.db
      .select()
      .from(calendarIntegrations)
      .where(and(
        eq(calendarIntegrations.tenantId, tenantId),
        eq(calendarIntegrations.userId, userId),
        eq(calendarIntegrations.isActive, false),
        isNotNull(calendarIntegrations.disconnectedAt)
      ))
      .orderBy(desc(calendarIntegrations.disconnectedAt));
    
    // Decrypt tokens for use
    return integrations.map(integration => ({
      ...integration,
      accessToken: integration.accessToken ? this.safeDecrypt(integration.accessToken) : null,
      refreshToken: integration.refreshToken ? this.safeDecrypt(integration.refreshToken) : null,
    }));
  }

  // Audit Logs
  async createAuditLog(auditLog: InsertAuditLog, tenantId: string): Promise<AuditLog> {
    const result = await this.db
      .insert(auditLogs)
      .values({
        ...auditLog,
        tenantId,
        timestamp: new Date()
      })
      .returning();
    
    console.log(`📝 Audit log created: ${auditLog.action} for user ${auditLog.userId}`);
    return result[0];
  }

  async getAuditLogs(tenantId: string, userId?: string, action?: string): Promise<AuditLog[]> {
    const conditions = [eq(auditLogs.tenantId, tenantId)];
    
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    
    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }
    
    return await this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.timestamp));
  }

  // AI-Generated Content methods
  async createEmailSummary(summary: InsertEmailSummary, tenantId: string): Promise<EmailSummary> {
    const result = await this.db.insert(emailSummaries).values({
      ...summary,
      tenantId,
      createdAt: new Date()
    }).returning();
    return result[0];
  }

  async getEmailSummary(threadId: string, tenantId: string): Promise<EmailSummary | undefined> {
    const result = await this.db
      .select()
      .from(emailSummaries)
      .where(and(
        eq(emailSummaries.threadId, threadId),
        eq(emailSummaries.tenantId, tenantId)
      ))
      .limit(1);
    return result[0];
  }

  async createEmailDraft(draft: InsertEmailDraft, tenantId: string): Promise<EmailDraft> {
    const result = await this.db.insert(emailDrafts).values({
      ...draft,
      tenantId,
      createdAt: new Date()
    }).returning();
    return result[0];
  }

  async getEmailDrafts(threadId: string, tenantId: string): Promise<EmailDraft[]> {
    return await this.db
      .select()
      .from(emailDrafts)
      .where(and(
        eq(emailDrafts.threadId, threadId),
        eq(emailDrafts.tenantId, tenantId)
      ))
      .orderBy(desc(emailDrafts.createdAt));
  }

  async markDraftAsUsed(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(emailDrafts)
      .set({ used: true })
      .where(and(
        eq(emailDrafts.id, id),
        eq(emailDrafts.tenantId, tenantId)
      ));
  }

  async createEmailActionItems(actionItems: InsertEmailActionItem[], tenantId: string): Promise<EmailActionItem[]> {
    if (actionItems.length === 0) return [];
    
    const result = await this.db.insert(emailActionItems).values(
      actionItems.map(item => ({
        ...item,
        tenantId,
        createdAt: new Date()
      }))
    ).returning();
    return result;
  }

  async getEmailActionItems(emailId: string, tenantId: string): Promise<EmailActionItem[]> {
    return await this.db
      .select()
      .from(emailActionItems)
      .where(and(
        eq(emailActionItems.emailId, emailId),
        eq(emailActionItems.tenantId, tenantId)
      ))
      .orderBy(desc(emailActionItems.createdAt));
  }

  async getThreadActionItems(threadId: string, tenantId: string): Promise<EmailActionItem[]> {
    return await this.db
      .select()
      .from(emailActionItems)
      .where(and(
        eq(emailActionItems.threadId, threadId),
        eq(emailActionItems.tenantId, tenantId)
      ))
      .orderBy(desc(emailActionItems.createdAt));
  }

  async updateActionItemStatus(id: string, status: string, tenantId: string): Promise<void> {
    const updates: any = { status };
    if (status === 'completed') {
      updates.completedAt = new Date();
    }
    
    await this.db
      .update(emailActionItems)
      .set(updates)
      .where(and(
        eq(emailActionItems.id, id),
        eq(emailActionItems.tenantId, tenantId)
      ));
  }

  async createUserStyleSample(sample: InsertUserStyleSample, tenantId: string): Promise<UserStyleSample> {
    const result = await this.db
      .insert(userStyleSamples)
      .values({
        ...sample,
        tenantId,
        createdAt: new Date()
      })
      .returning();
    return result[0];
  }

  async getUserStyleSamples(userId: string, tenantId: string): Promise<UserStyleSample[]> {
    return await this.db
      .select()
      .from(userStyleSamples)
      .where(and(
        eq(userStyleSamples.userId, userId),
        eq(userStyleSamples.tenantId, tenantId)
      ))
      .orderBy(desc(userStyleSamples.createdAt));
  }

  async deleteUserStyleSample(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(userStyleSamples)
      .where(and(
        eq(userStyleSamples.id, id),
        eq(userStyleSamples.tenantId, tenantId)
      ))
      .returning();
    return result.length > 0;
  }

  async deleteAllUserStyleSamples(userId: string, tenantId: string): Promise<void> {
    await this.db
      .delete(userStyleSamples)
      .where(and(
        eq(userStyleSamples.userId, userId),
        eq(userStyleSamples.tenantId, tenantId)
      ));
  }

  async getUserPref(userId: string, key: string, tenantId: string): Promise<{ key: string; value: string } | undefined> {
    const prefs = await this.db
      .select()
      .from(userPrefs)
      .where(and(
        eq(userPrefs.userId, userId),
        eq(userPrefs.key, key),
        eq(userPrefs.tenantId, tenantId)
      ))
      .limit(1);
    
    return prefs[0] ? { key: prefs[0].key, value: prefs[0].value } : undefined;
  }

  async setUserPref(userId: string, key: string, value: string, tenantId: string): Promise<void> {
    const existing = await this.getUserPref(userId, key, tenantId);
    
    if (existing) {
      await this.db
        .update(userPrefs)
        .set({ value, updatedAt: new Date() })
        .where(and(
          eq(userPrefs.userId, userId),
          eq(userPrefs.key, key),
          eq(userPrefs.tenantId, tenantId)
        ));
    } else {
      await this.db
        .insert(userPrefs)
        .values({
          userId,
          key,
          value,
          tenantId,
          updatedAt: new Date()
        });
    }
  }

  // AI Business Context
  async getAiBusinessContext(tenantId: string): Promise<AiBusinessContext | undefined> {
    const result = await this.db
      .select()
      .from(aiBusinessContext)
      .where(eq(aiBusinessContext.tenantId, tenantId))
      .limit(1);
    
    return result[0];
  }

  async upsertAiBusinessContext(context: InsertAiBusinessContext, tenantId: string): Promise<AiBusinessContext> {
    const existing = await this.getAiBusinessContext(tenantId);
    
    if (existing) {
      const [updated] = await this.db
        .update(aiBusinessContext)
        .set({ 
          ...context,
          updatedAt: new Date() 
        })
        .where(eq(aiBusinessContext.tenantId, tenantId))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(aiBusinessContext)
        .values({ 
          ...context, 
          tenantId,
          updatedAt: new Date()
        })
        .returning();
      return created;
    }
  }

  // AI Knowledge Base
  async getAiKnowledgeBase(tenantId: string, isActive?: boolean): Promise<AiKnowledgeBase[]> {
    const conditions = [eq(aiKnowledgeBase.tenantId, tenantId)];
    
    if (isActive !== undefined) {
      conditions.push(eq(aiKnowledgeBase.isActive, isActive));
    }
    
    return await this.db
      .select()
      .from(aiKnowledgeBase)
      .where(and(...conditions))
      .orderBy(desc(aiKnowledgeBase.createdAt));
  }

  async getAiKnowledgeBaseItem(id: string, tenantId: string): Promise<AiKnowledgeBase | undefined> {
    const result = await this.db
      .select()
      .from(aiKnowledgeBase)
      .where(and(
        eq(aiKnowledgeBase.id, id),
        eq(aiKnowledgeBase.tenantId, tenantId)
      ))
      .limit(1);
    
    return result[0];
  }

  async createAiKnowledgeBaseItem(item: InsertAiKnowledgeBase, tenantId: string): Promise<AiKnowledgeBase> {
    const [created] = await this.db
      .insert(aiKnowledgeBase)
      .values({ 
        ...item, 
        tenantId,
        updatedAt: new Date()
      })
      .returning();
    return created;
  }

  async updateAiKnowledgeBaseItem(id: string, item: Partial<InsertAiKnowledgeBase>, tenantId: string): Promise<AiKnowledgeBase | undefined> {
    const [updated] = await this.db
      .update(aiKnowledgeBase)
      .set({ 
        ...omitUndefined(item),
        updatedAt: new Date() 
      })
      .where(and(
        eq(aiKnowledgeBase.id, id),
        eq(aiKnowledgeBase.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async deleteAiKnowledgeBaseItem(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(aiKnowledgeBase)
      .where(and(
        eq(aiKnowledgeBase.id, id),
        eq(aiKnowledgeBase.tenantId, tenantId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // AI Custom Instructions
  async getAiCustomInstructions(tenantId: string, isActive?: boolean): Promise<AiCustomInstruction[]> {
    const conditions = [eq(aiCustomInstructions.tenantId, tenantId)];
    
    if (isActive !== undefined) {
      conditions.push(eq(aiCustomInstructions.isActive, isActive));
    }
    
    return await this.db
      .select()
      .from(aiCustomInstructions)
      .where(and(...conditions))
      .orderBy(desc(aiCustomInstructions.createdAt));
  }

  async createAiCustomInstruction(instruction: InsertAiCustomInstruction, tenantId: string): Promise<AiCustomInstruction> {
    const [created] = await this.db
      .insert(aiCustomInstructions)
      .values({ 
        ...instruction, 
        tenantId,
        updatedAt: new Date()
      })
      .returning();
    return created;
  }

  async updateAiCustomInstruction(id: string, instruction: Partial<InsertAiCustomInstruction>, tenantId: string): Promise<AiCustomInstruction | undefined> {
    const [updated] = await this.db
      .update(aiCustomInstructions)
      .set({ 
        ...omitUndefined(instruction),
        updatedAt: new Date() 
      })
      .where(and(
        eq(aiCustomInstructions.id, id),
        eq(aiCustomInstructions.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async deleteAiCustomInstruction(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(aiCustomInstructions)
      .where(and(
        eq(aiCustomInstructions.id, id),
        eq(aiCustomInstructions.tenantId, tenantId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // AI Training Documents
  async getAiTrainingDocuments(tenantId: string): Promise<AiTrainingDocument[]> {
    return await this.db
      .select()
      .from(aiTrainingDocuments)
      .where(eq(aiTrainingDocuments.tenantId, tenantId))
      .orderBy(desc(aiTrainingDocuments.uploadedAt));
  }

  async createAiTrainingDocument(doc: InsertAiTrainingDocument, tenantId: string): Promise<AiTrainingDocument> {
    const [created] = await this.db
      .insert(aiTrainingDocuments)
      .values({ 
        ...doc, 
        tenantId,
        uploadedAt: new Date()
      })
      .returning();
    return created;
  }

  async updateAiTrainingDocument(id: string, doc: Partial<InsertAiTrainingDocument>, tenantId: string): Promise<AiTrainingDocument | undefined> {
    const [updated] = await this.db
      .update(aiTrainingDocuments)
      .set(omitUndefined(doc))
      .where(and(
        eq(aiTrainingDocuments.id, id),
        eq(aiTrainingDocuments.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async deleteAiTrainingDocument(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(aiTrainingDocuments)
      .where(and(
        eq(aiTrainingDocuments.id, id),
        eq(aiTrainingDocuments.tenantId, tenantId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Notification System
  async getNotificationSettings(tenantId: string, userId?: string): Promise<NotificationSettings | undefined> {
    const conditions = [eq(notificationSettings.tenantId, tenantId)];
    
    if (userId) {
      conditions.push(eq(notificationSettings.userId, userId));
    } else {
      conditions.push(isNull(notificationSettings.userId));
    }
    
    const [settings] = await this.db
      .select()
      .from(notificationSettings)
      .where(and(...conditions));
    
    return settings;
  }

  async upsertNotificationSettings(settings: InsertNotificationSettings, tenantId: string): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(tenantId, settings.userId || undefined);
    
    if (existing) {
      const [updated] = await this.db
        .update(notificationSettings)
        .set({ 
          ...omitUndefined(settings),
          updatedAt: new Date() 
        })
        .where(eq(notificationSettings.id, existing.id))
        .returning();
      
      return updated;
    } else {
      const [created] = await this.db
        .insert(notificationSettings)
        .values({ 
          ...settings, 
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      return created;
    }
  }

  async updateNotificationSettings(id: string, settings: Partial<InsertNotificationSettings>, tenantId: string): Promise<NotificationSettings | undefined> {
    const [updated] = await this.db
      .update(notificationSettings)
      .set({ 
        ...omitUndefined(settings),
        updatedAt: new Date() 
      })
      .where(and(
        eq(notificationSettings.id, id),
        eq(notificationSettings.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async getLeadNotifications(userId: string, tenantId: string, unreadOnly?: boolean): Promise<LeadFollowUpNotification[]> {
    const conditions = [
      eq(leadFollowUpNotifications.tenantId, tenantId),
      eq(leadFollowUpNotifications.userId, userId),
      eq(leadFollowUpNotifications.dismissed, false)
    ];
    
    if (unreadOnly) {
      conditions.push(eq(leadFollowUpNotifications.read, false));
    }
    
    return await this.db
      .select()
      .from(leadFollowUpNotifications)
      .where(and(...conditions))
      .orderBy(desc(leadFollowUpNotifications.createdAt));
  }

  async getLeadNotification(id: string, tenantId: string): Promise<LeadFollowUpNotification | undefined> {
    const [notification] = await this.db
      .select()
      .from(leadFollowUpNotifications)
      .where(and(
        eq(leadFollowUpNotifications.id, id),
        eq(leadFollowUpNotifications.tenantId, tenantId)
      ));
    
    return notification;
  }

  async createLeadNotification(notification: InsertLeadFollowUpNotification, tenantId: string): Promise<LeadFollowUpNotification> {
    const [created] = await this.db
      .insert(leadFollowUpNotifications)
      .values({ 
        ...notification, 
        tenantId,
        createdAt: new Date()
      })
      .returning();
    
    return created;
  }

  async markNotificationAsRead(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(leadFollowUpNotifications)
      .set({ 
        read: true,
        readAt: new Date()
      })
      .where(and(
        eq(leadFollowUpNotifications.id, id),
        eq(leadFollowUpNotifications.tenantId, tenantId)
      ));
  }

  async markNotificationAsDismissed(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(leadFollowUpNotifications)
      .set({ 
        dismissed: true,
        dismissedAt: new Date()
      })
      .where(and(
        eq(leadFollowUpNotifications.id, id),
        eq(leadFollowUpNotifications.tenantId, tenantId)
      ));
  }

  async deleteLeadNotification(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(leadFollowUpNotifications)
      .where(and(
        eq(leadFollowUpNotifications.id, id),
        eq(leadFollowUpNotifications.tenantId, tenantId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getUnreadNotificationCount(userId: string, tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(leadFollowUpNotifications)
      .where(and(
        eq(leadFollowUpNotifications.tenantId, tenantId),
        eq(leadFollowUpNotifications.userId, userId),
        eq(leadFollowUpNotifications.read, false),
        eq(leadFollowUpNotifications.dismissed, false)
      ));
    
    return Number(result[0]?.count || 0);
  }

  async getAutoReplyLogs(leadId: string, tenantId: string): Promise<AutoReplyLog[]> {
    return await this.db
      .select()
      .from(autoReplyLog)
      .where(and(
        eq(autoReplyLog.leadId, leadId),
        eq(autoReplyLog.tenantId, tenantId)
      ))
      .orderBy(desc(autoReplyLog.sentAt));
  }

  async getAutoReplyLogsByLeads(leadIds: string[], tenantId: string): Promise<Map<string, AutoReplyLog[]>> {
    if (leadIds.length === 0) {
      return new Map();
    }

    // Fetch all auto-reply logs for the given leads in a single query
    const logs = await this.db
      .select()
      .from(autoReplyLog)
      .where(and(
        sql`${autoReplyLog.leadId} = ANY(${leadIds})`,
        eq(autoReplyLog.tenantId, tenantId)
      ))
      .orderBy(desc(autoReplyLog.sentAt));

    // Group logs by leadId
    const logsByLead = new Map<string, AutoReplyLog[]>();
    for (const log of logs) {
      if (!logsByLead.has(log.leadId)) {
        logsByLead.set(log.leadId, []);
      }
      logsByLead.get(log.leadId)!.push(log);
    }

    return logsByLead;
  }

  async createAutoReplyLog(log: InsertAutoReplyLog, tenantId: string): Promise<AutoReplyLog> {
    const [created] = await this.db
      .insert(autoReplyLog)
      .values({ 
        ...log, 
        tenantId,
        sentAt: new Date()
      })
      .returning();
    
    return created;
  }

  // ============================================================================
  // TENANT ONBOARDING PROGRESS
  // ============================================================================

  async getTenantOnboardingProgress(tenantId: string): Promise<TenantOnboardingProgress | undefined> {
    const [progress] = await this.db
      .select()
      .from(tenantOnboardingProgress)
      .where(eq(tenantOnboardingProgress.tenantId, tenantId));
    
    return progress;
  }

  async createTenantOnboardingProgress(progress: InsertTenantOnboardingProgress, tenantId: string): Promise<TenantOnboardingProgress> {
    const [created] = await this.db
      .insert(tenantOnboardingProgress)
      .values({ ...progress, tenantId })
      .returning();
    
    return created;
  }

  async updateTenantOnboardingProgress(id: string, progress: Partial<InsertTenantOnboardingProgress>, tenantId: string): Promise<TenantOnboardingProgress | undefined> {
    const [updated] = await this.db
      .update(tenantOnboardingProgress)
      .set({ ...progress, updatedAt: new Date() })
      .where(and(
        eq(tenantOnboardingProgress.id, id),
        eq(tenantOnboardingProgress.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  // ============================================================================
  // MEDIA LIBRARY
  // ============================================================================

  async getMediaLibrary(tenantId: string, category?: string, isActive?: boolean): Promise<MediaLibrary[]> {
    const conditions = [eq(mediaLibrary.tenantId, tenantId)];
    
    if (category) {
      conditions.push(eq(mediaLibrary.category, category));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(mediaLibrary.isActive, isActive));
    }
    
    return await this.db
      .select()
      .from(mediaLibrary)
      .where(and(...conditions))
      .orderBy(mediaLibrary.displayOrder, mediaLibrary.createdAt);
  }

  async getMediaLibraryItem(id: string, tenantId: string): Promise<MediaLibrary | undefined> {
    const [item] = await this.db
      .select()
      .from(mediaLibrary)
      .where(and(
        eq(mediaLibrary.id, id),
        eq(mediaLibrary.tenantId, tenantId)
      ));
    
    return item;
  }

  async createMediaLibraryItem(item: InsertMediaLibrary, tenantId: string): Promise<MediaLibrary> {
    const [created] = await this.db
      .insert(mediaLibrary)
      .values({ ...item, tenantId })
      .returning();
    
    return created;
  }

  async updateMediaLibraryItem(id: string, item: Partial<InsertMediaLibrary>, tenantId: string): Promise<MediaLibrary | undefined> {
    const [updated] = await this.db
      .update(mediaLibrary)
      .set({ ...item, updatedAt: new Date() })
      .where(and(
        eq(mediaLibrary.id, id),
        eq(mediaLibrary.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async deleteMediaLibraryItem(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(mediaLibrary)
      .where(and(
        eq(mediaLibrary.id, id),
        eq(mediaLibrary.tenantId, tenantId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // WIDGET SETTINGS
  // ============================================================================

  async getWidgetSettings(tenantId: string): Promise<WidgetSettings | undefined> {
    const [settings] = await this.db
      .select()
      .from(widgetSettings)
      .where(eq(widgetSettings.tenantId, tenantId));
    
    return settings;
  }

  async upsertWidgetSettings(settings: InsertWidgetSettings, tenantId: string): Promise<WidgetSettings> {
    const existing = await this.getWidgetSettings(tenantId);
    
    if (existing) {
      const [updated] = await this.db
        .update(widgetSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(widgetSettings.tenantId, tenantId))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(widgetSettings)
        .values({ ...settings, tenantId })
        .returning();
      return created;
    }
  }

  // ============================================================================
  // CHAT CONVERSATIONS
  // ============================================================================

  async getChatConversations(tenantId: string, limit: number = 50): Promise<ChatConversation[]> {
    return await this.db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.tenantId, tenantId))
      .orderBy(desc(chatConversations.lastMessageAt))
      .limit(limit);
  }

  async getChatConversation(id: string, tenantId: string): Promise<ChatConversation | undefined> {
    const [conversation] = await this.db
      .select()
      .from(chatConversations)
      .where(and(
        eq(chatConversations.id, id),
        eq(chatConversations.tenantId, tenantId)
      ));
    
    return conversation;
  }

  async getChatConversationBySession(sessionId: string, tenantId: string): Promise<ChatConversation | undefined> {
    const [conversation] = await this.db
      .select()
      .from(chatConversations)
      .where(and(
        eq(chatConversations.sessionId, sessionId),
        eq(chatConversations.tenantId, tenantId)
      ));
    
    return conversation;
  }

  async createChatConversation(conversation: InsertChatConversation, tenantId: string): Promise<ChatConversation> {
    const [created] = await this.db
      .insert(chatConversations)
      .values({ ...conversation, tenantId })
      .returning();
    
    return created;
  }

  async updateChatConversation(id: string, conversation: Partial<InsertChatConversation>, tenantId: string): Promise<ChatConversation | undefined> {
    const [updated] = await this.db
      .update(chatConversations)
      .set(conversation)
      .where(and(
        eq(chatConversations.id, id),
        eq(chatConversations.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  // ============================================================================
  // CHAT MESSAGES
  // ============================================================================

  async getChatMessages(conversationId: string, tenantId: string): Promise<ChatMessage[]> {
    return await this.db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.conversationId, conversationId),
        eq(chatMessages.tenantId, tenantId)
      ))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(message: InsertChatMessage, tenantId: string): Promise<ChatMessage> {
    const [created] = await this.db
      .insert(chatMessages)
      .values({ ...message, tenantId })
      .returning();
    
    // Update conversation's last message timestamp
    await this.db
      .update(chatConversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatConversations.id, message.conversationId));
    
    return created;
  }

  // ============================================================================
  // BOOKABLE SERVICES
  // ============================================================================

  async getBookableServices(tenantId: string, isActive?: boolean): Promise<BookableService[]> {
    const conditions = [eq(bookableServices.tenantId, tenantId)];
    
    if (isActive !== undefined) {
      conditions.push(eq(bookableServices.isActive, isActive));
    }
    
    return await this.db
      .select()
      .from(bookableServices)
      .where(and(...conditions))
      .orderBy(bookableServices.displayOrder, bookableServices.name);
  }

  async getBookableService(id: string, tenantId: string): Promise<BookableService | undefined> {
    const [service] = await this.db
      .select()
      .from(bookableServices)
      .where(and(
        eq(bookableServices.id, id),
        eq(bookableServices.tenantId, tenantId)
      ));
    
    return service;
  }

  async createBookableService(service: InsertBookableService, tenantId: string): Promise<BookableService> {
    const [created] = await this.db
      .insert(bookableServices)
      .values({ ...service, tenantId })
      .returning();
    
    return created;
  }

  async updateBookableService(id: string, service: Partial<InsertBookableService>, tenantId: string): Promise<BookableService | undefined> {
    const [updated] = await this.db
      .update(bookableServices)
      .set({ ...service, updatedAt: new Date() })
      .where(and(
        eq(bookableServices.id, id),
        eq(bookableServices.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async deleteBookableService(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(bookableServices)
      .where(and(
        eq(bookableServices.id, id),
        eq(bookableServices.tenantId, tenantId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // AVAILABILITY SCHEDULES
  // ============================================================================

  async getAvailabilitySchedules(tenantId: string, isActive?: boolean): Promise<AvailabilitySchedule[]> {
    const conditions = [eq(availabilitySchedules.tenantId, tenantId)];
    
    if (isActive !== undefined) {
      conditions.push(eq(availabilitySchedules.isActive, isActive));
    }
    
    return await this.db
      .select()
      .from(availabilitySchedules)
      .where(and(...conditions))
      .orderBy(availabilitySchedules.name);
  }

  async getAvailabilitySchedule(id: string, tenantId: string): Promise<AvailabilitySchedule | undefined> {
    const [schedule] = await this.db
      .select()
      .from(availabilitySchedules)
      .where(and(
        eq(availabilitySchedules.id, id),
        eq(availabilitySchedules.tenantId, tenantId)
      ));
    
    return schedule;
  }

  async getAvailabilityScheduleByPublicLink(publicLink: string): Promise<AvailabilitySchedule | undefined> {
    const [schedule] = await this.db
      .select()
      .from(availabilitySchedules)
      .where(eq(availabilitySchedules.publicLink, publicLink));
    
    return schedule;
  }

  async createAvailabilitySchedule(schedule: InsertAvailabilitySchedule, tenantId: string): Promise<AvailabilitySchedule> {
    const [created] = await this.db
      .insert(availabilitySchedules)
      .values({ ...schedule, tenantId })
      .returning();
    
    return created;
  }

  async updateAvailabilitySchedule(id: string, schedule: Partial<InsertAvailabilitySchedule>, tenantId: string): Promise<AvailabilitySchedule | undefined> {
    const [updated] = await this.db
      .update(availabilitySchedules)
      .set({ ...schedule, updatedAt: new Date() })
      .where(and(
        eq(availabilitySchedules.id, id),
        eq(availabilitySchedules.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async deleteAvailabilitySchedule(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(availabilitySchedules)
      .where(and(
        eq(availabilitySchedules.id, id),
        eq(availabilitySchedules.tenantId, tenantId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // SCHEDULE SERVICES (Many-to-Many)
  // ============================================================================

  async getScheduleServices(scheduleId: string): Promise<ScheduleService[]> {
    return await this.db
      .select()
      .from(scheduleServices)
      .where(eq(scheduleServices.scheduleId, scheduleId));
  }

  async addServiceToSchedule(scheduleService: InsertScheduleService): Promise<ScheduleService> {
    const [created] = await this.db
      .insert(scheduleServices)
      .values(scheduleService)
      .returning();
    
    return created;
  }

  async removeServiceFromSchedule(scheduleId: string, serviceId: string): Promise<boolean> {
    const result = await this.db
      .delete(scheduleServices)
      .where(and(
        eq(scheduleServices.scheduleId, scheduleId),
        eq(scheduleServices.serviceId, serviceId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // AVAILABILITY RULES
  // ============================================================================

  async getAvailabilityRules(scheduleId: string): Promise<AvailabilityRule[]> {
    return await this.db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.scheduleId, scheduleId))
      .orderBy(availabilityRules.createdAt);
  }

  async createAvailabilityRule(rule: InsertAvailabilityRule): Promise<AvailabilityRule> {
    const [created] = await this.db
      .insert(availabilityRules)
      .values(rule)
      .returning();
    
    return created;
  }

  async updateAvailabilityRule(id: string, rule: Partial<InsertAvailabilityRule>): Promise<AvailabilityRule | undefined> {
    const [updated] = await this.db
      .update(availabilityRules)
      .set(rule)
      .where(eq(availabilityRules.id, id))
      .returning();
    
    return updated;
  }

  async deleteAvailabilityRule(id: string): Promise<boolean> {
    const result = await this.db
      .delete(availabilityRules)
      .where(eq(availabilityRules.id, id));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // SCHEDULE CALENDAR CHECKS
  // ============================================================================

  async getScheduleCalendarChecks(scheduleId: string): Promise<ScheduleCalendarCheck[]> {
    return await this.db
      .select()
      .from(scheduleCalendarChecks)
      .where(eq(scheduleCalendarChecks.scheduleId, scheduleId));
  }

  async addCalendarCheck(check: InsertScheduleCalendarCheck): Promise<ScheduleCalendarCheck> {
    const [created] = await this.db
      .insert(scheduleCalendarChecks)
      .values(check)
      .returning();
    
    return created;
  }

  async removeCalendarCheck(scheduleId: string, calendarIntegrationId: string): Promise<boolean> {
    const result = await this.db
      .delete(scheduleCalendarChecks)
      .where(and(
        eq(scheduleCalendarChecks.scheduleId, scheduleId),
        eq(scheduleCalendarChecks.calendarIntegrationId, calendarIntegrationId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // SCHEDULE TEAM MEMBERS
  // ============================================================================

  async getScheduleTeamMembers(scheduleId: string): Promise<ScheduleTeamMember[]> {
    return await this.db
      .select()
      .from(scheduleTeamMembers)
      .where(eq(scheduleTeamMembers.scheduleId, scheduleId));
  }

  async addTeamMember(member: InsertScheduleTeamMember): Promise<ScheduleTeamMember> {
    const [created] = await this.db
      .insert(scheduleTeamMembers)
      .values(member)
      .returning();
    
    return created;
  }

  async removeTeamMember(scheduleId: string, memberId: string): Promise<boolean> {
    const result = await this.db
      .delete(scheduleTeamMembers)
      .where(and(
        eq(scheduleTeamMembers.scheduleId, scheduleId),
        eq(scheduleTeamMembers.memberId, memberId)
      ));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ============================================================================
  // BOOKINGS
  // ============================================================================

  async getBookings(tenantId: string, filters?: { contactId?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<Booking[]> {
    const conditions = [eq(bookings.tenantId, tenantId)];
    
    if (filters?.contactId) {
      conditions.push(eq(bookings.contactId, filters.contactId));
    }
    
    if (filters?.status) {
      conditions.push(eq(bookings.status, filters.status));
    }
    
    if (filters?.startDate) {
      conditions.push(sql`${bookings.startTime} >= ${filters.startDate}`);
    }
    
    if (filters?.endDate) {
      conditions.push(sql`${bookings.startTime} <= ${filters.endDate}`);
    }
    
    return await this.db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.startTime));
  }

  async getBooking(id: string, tenantId: string): Promise<Booking | undefined> {
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(and(
        eq(bookings.id, id),
        eq(bookings.tenantId, tenantId)
      ));
    
    return booking;
  }

  async createBooking(booking: InsertBooking, tenantId: string): Promise<Booking> {
    const [created] = await this.db
      .insert(bookings)
      .values({ ...booking, tenantId })
      .returning();
    
    return created;
  }

  async updateBooking(id: string, booking: Partial<InsertBooking>, tenantId: string): Promise<Booking | undefined> {
    const [updated] = await this.db
      .update(bookings)
      .set({ ...booking, updatedAt: new Date() })
      .where(and(
        eq(bookings.id, id),
        eq(bookings.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  async cancelBooking(id: string, cancelledBy: string, cancellationReason: string, tenantId: string): Promise<Booking | undefined> {
    const [updated] = await this.db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason,
        updatedAt: new Date()
      })
      .where(and(
        eq(bookings.id, id),
        eq(bookings.tenantId, tenantId)
      ))
      .returning();
    
    return updated;
  }

  // Tenant-scoped storage wrapper
  withTenant(tenantId: string): TenantScopedStorage {
    return new TenantScopedStorage(this, tenantId);
  }
}

// Fixed circular reference by moving IStorage to separate file
export const storage = new DrizzleStorage();
