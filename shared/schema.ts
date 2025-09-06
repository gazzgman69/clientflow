import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatar: text("avatar"),
  role: text("role").notNull().default('client'), // admin, musician, client
  createdAt: timestamp("created_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  leadSource: text("lead_source"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  status: text("status").notNull().default('new'), // new, qualified, follow-up, converted, lost
  notes: text("notes"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  lastContactAt: timestamp("last_contact_at"), // updated on outbound email or logged call
  lastManualStatusAt: timestamp("last_manual_status_at"), // set when status changed by a user
  projectDate: timestamp("project_date"), // event/project date from form
  lastViewedAt: timestamp("last_viewed_at"), // when user last viewed this lead
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  leadId: varchar("lead_id").references(() => leads.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  status: text("status").notNull().default('active'), // active, completed, on-hold, cancelled
  progress: integer("progress").default(0), // 0-100
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  actualValue: decimal("actual_value", { precision: 10, scale: 2 }),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: text("quote_number").notNull().unique(),
  contactId: varchar("contact_id").references(() => contacts.id),
  leadId: varchar("lead_id").references(() => leads.id),
  title: text("title").notNull(),
  description: text("description"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default('draft'), // draft, sent, approved, rejected, expired
  validUntil: timestamp("valid_until"),
  sentAt: timestamp("sent_at"),
  approvedAt: timestamp("approved_at"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractNumber: text("contract_number").notNull().unique(),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  title: text("title").notNull(),
  description: text("description"),
  terms: text("terms"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default('draft'), // draft, sent, signed, cancelled
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  title: text("title").notNull(),
  description: text("description"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default('draft'), // draft, sent, paid, overdue, cancelled
  dueDate: timestamp("due_date"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default('medium'), // low, medium, high, urgent
  status: text("status").notNull().default('pending'), // pending, in-progress, completed, cancelled
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  leadId: varchar("lead_id").references(() => leads.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  projectId: varchar("project_id").references(() => projects.id),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  ccEmails: text("cc_emails").array(),
  bccEmails: text("bcc_emails").array(),
  status: text("status").notNull().default('draft'), // draft, sent, delivered, bounced, failed
  threadId: varchar("thread_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  projectId: varchar("project_id").references(() => projects.id),
  sentBy: varchar("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  body: text("body").notNull(),
  fromPhone: text("from_phone").notNull(),
  toPhone: text("to_phone").notNull(),
  status: text("status").notNull().default('queued'), // queued, sent, delivered, failed, undelivered
  direction: text("direction").notNull(), // inbound, outbound
  twilioSid: text("twilio_sid"), // Twilio message SID for tracking
  threadId: varchar("thread_id"),
  leadId: varchar("lead_id").references(() => leads.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  projectId: varchar("project_id").references(() => projects.id),
  sentBy: varchar("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // email, sms, whatsapp
  subject: text("subject"), // For email templates
  body: text("body").notNull(),
  variables: text("variables").array(), // Available template variables like {firstName}, {eventDate}
  category: text("category"), // reminder, confirmation, follow-up, etc.
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messageThreads = pgTable("message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject"),
  participants: text("participants").array().notNull(), // Phone numbers or emails
  leadId: varchar("lead_id").references(() => leads.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  projectId: varchar("project_id").references(() => projects.id),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // lead_created, quote_sent, contract_signed, etc.
  description: text("description").notNull(),
  entityType: text("entity_type"), // lead, client, project, quote, contract, invoice
  entityId: varchar("entity_id"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(), // lead_created, quote_sent, etc.
  actions: text("actions").array().notNull(), // send_email, create_task, etc.
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Members (Musicians) Management
export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  instruments: text("instruments").array(), // Array of instruments they play
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  preferredStatus: boolean("preferred_status").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Venues Management
export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  capacity: integer("capacity"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project Members Junction Table
export const projectMembers = pgTable("project_members", {
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  role: text("role"), // Lead, Support, etc.
  fee: decimal("fee", { precision: 10, scale: 2 }),
  status: text("status").notNull().default('pending'), // pending, confirmed, declined
  confirmedAt: timestamp("confirmed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Member Availability
export const memberAvailability = pgTable("member_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  date: timestamp("date").notNull(),
  available: boolean("available").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project Files
export const projectFiles = pgTable("project_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project Notes
export const projectNotes = pgTable("project_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  note: text("note").notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Calendar Integrations
export const calendarIntegrations = pgTable("calendar_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(), // google, outlook, apple, ical
  providerAccountId: text("provider_account_id"), // External calendar account ID
  calendarId: text("calendar_id"), // Specific calendar ID within the account
  calendarName: text("calendar_name").notNull(),
  accessToken: text("access_token"), // Encrypted access token for API access
  refreshToken: text("refresh_token"), // Encrypted refresh token
  syncToken: text("sync_token"), // For incremental sync
  webhookId: text("webhook_id"), // For real-time sync
  isActive: boolean("is_active").default(true),
  syncDirection: text("sync_direction").notNull().default('bidirectional'), // import, export, bidirectional
  lastSyncAt: timestamp("last_sync_at"),
  syncErrors: text("sync_errors"), // JSON string of sync error logs
  settings: text("settings"), // JSON string for provider-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Calendar Sync Log
export const calendarSyncLog = pgTable("calendar_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").references(() => calendarIntegrations.id).notNull(),
  syncType: text("sync_type").notNull(), // manual, automatic, webhook
  direction: text("direction").notNull(), // import, export
  eventsProcessed: integer("events_processed").default(0),
  eventsCreated: integer("events_created").default(0),
  eventsUpdated: integer("events_updated").default(0),
  eventsDeleted: integer("events_deleted").default(0),
  errors: text("errors"), // JSON string of errors during sync
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default('processing'), // processing, completed, failed
});

// Events/Calendar System
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  allDay: boolean("all_day").default(false),
  recurring: boolean("recurring").default(false),
  recurrenceRule: text("recurrence_rule"), // RRULE format for recurring events
  type: text("type").notNull().default('meeting'), // meeting, call, event, appointment, reminder
  status: text("status").notNull().default('confirmed'), // confirmed, tentative, cancelled
  priority: text("priority").notNull().default('medium'), // low, medium, high, urgent
  leadId: varchar("lead_id").references(() => leads.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  projectId: varchar("project_id").references(() => projects.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  externalEventId: text("external_event_id"), // For synced events from external calendars
  providerData: text("provider_data"), // JSON string of provider-specific data
  calendarIntegrationId: varchar("calendar_integration_id").references(() => calendarIntegrations.id),
  reminderMinutes: integer("reminder_minutes").default(15), // Minutes before event to send reminder
  attendees: text("attendees").array(), // Email addresses of attendees
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Templates table for auto-responders, emails, invoices, contracts
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // auto_responder, email, invoice, contract
  title: text("title").notNull(),
  subject: text("subject"), // nullable - for email types
  body: text("body").notNull(), // can include tokens like {{contact.firstName}}, {{project.title}}, {{project.date}}
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lead Capture Forms table
export const leadCaptureForms = pgTable("lead_capture_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  autoResponseTemplateId: varchar("auto_response_template_id").references(() => templates.id),
  notification: text("notification").notNull().default('email'), // email, sms
  calendarId: varchar("calendar_id").references(() => calendarIntegrations.id),
  lifecycleId: varchar("lifecycle_id"), // store id only (TODO automate later)
  workflowId: varchar("workflow_id"), // store id only (TODO automate later)
  contactTags: text("contact_tags"), // CSV for now (TODO normalize)
  projectTags: text("project_tags"), // CSV for now (TODO normalize)
  recaptchaEnabled: boolean("recaptcha_enabled").default(false),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailSchema = createInsertSchema(emails).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertAutomationSchema = createInsertSchema(automations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMemberSchema = createInsertSchema(members).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVenueSchema = createInsertSchema(venues).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({ createdAt: true });
export const insertMemberAvailabilitySchema = createInsertSchema(memberAvailability).omit({ id: true, createdAt: true });
export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({ id: true, createdAt: true });
export const insertProjectNoteSchema = createInsertSchema(projectNotes).omit({ id: true, createdAt: true });
export const insertSmsMessageSchema = createInsertSchema(smsMessages).omit({ id: true, createdAt: true });
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  startDate: z.string().or(z.date()).transform((val) => new Date(val)),
  endDate: z.string().or(z.date()).transform((val) => new Date(val)),
  attendees: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return [];
    return val.split(',')
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));
  }).or(z.array(z.string())).optional()
});
export const insertCalendarIntegrationSchema = createInsertSchema(calendarIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCalendarSyncLogSchema = createInsertSchema(calendarSyncLog).omit({ id: true, startedAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadCaptureFormSchema = createInsertSchema(leadCaptureForms).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Venue = typeof venues.$inferSelect;
export type InsertVenue = z.infer<typeof insertVenueSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type MemberAvailability = typeof memberAvailability.$inferSelect;
export type InsertMemberAvailability = z.infer<typeof insertMemberAvailabilitySchema>;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type ProjectNote = typeof projectNotes.$inferSelect;
export type InsertProjectNote = z.infer<typeof insertProjectNoteSchema>;
export type SmsMessage = typeof smsMessages.$inferSelect;
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageThread = typeof messageThreads.$inferSelect;
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;
export type InsertCalendarIntegration = z.infer<typeof insertCalendarIntegrationSchema>;
export type CalendarSyncLog = typeof calendarSyncLog.$inferSelect;
export type InsertCalendarSyncLog = z.infer<typeof insertCalendarSyncLogSchema>;
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export const leadStatusHistory = pgTable("lead_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull(), // manual, auto, event
  metadata: text("metadata"), // json text for rule info etc
  createdAt: timestamp("created_at").defaultNow(),
});

export const leadAutomationRules = pgTable("lead_automation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  fromStatus: text("from_status"), // null = any status
  toStatus: text("to_status").notNull(),
  triggerType: text("trigger_type").notNull(), // TIME_SINCE_CREATED, TIME_SINCE_LAST_CONTACT, PROJECT_DATE_IN_DAYS, FORM_ANSWER_EQUALS
  triggerConfig: text("trigger_config").notNull(), // json text for trigger parameters
  ifConflictBlock: boolean("if_conflict_block").default(false).notNull(),
  requireNoManualSinceMinutes: integer("require_no_manual_since_minutes"), // nullable
  actionEmailTemplateId: varchar("action_email_template_id").references(() => messageTemplates.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertLeadStatusHistorySchema = createInsertSchema(leadStatusHistory);
export const insertLeadAutomationRuleSchema = createInsertSchema(leadAutomationRules);

export type LeadCaptureForm = typeof leadCaptureForms.$inferSelect;
export type InsertLeadCaptureForm = z.infer<typeof insertLeadCaptureFormSchema>;
export type LeadStatusHistory = typeof leadStatusHistory.$inferSelect;
export type InsertLeadStatusHistory = z.infer<typeof insertLeadStatusHistorySchema>;
export type LeadAutomationRule = typeof leadAutomationRules.$inferSelect;
export type InsertLeadAutomationRule = z.infer<typeof insertLeadAutomationRuleSchema>;
