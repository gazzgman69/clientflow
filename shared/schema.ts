import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tenants table for multitenancy support
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // Used for subdomain routing
  domain: text("domain"), // Custom domain support
  isActive: boolean("is_active").default(true),
  plan: text("plan").default('starter'), // starter, pro, enterprise
  settings: text("settings"), // JSON for tenant-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatar: text("avatar"),
  role: text("role").notNull().default('client'), // admin, musician, client
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPrefs = pgTable("user_prefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  key: text("key").notNull(), // e.g., "emailViewMode"
  value: text("value").notNull(), // "unified" | "rfc"
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    userKeyUnique: unique().on(table.userId, table.key)
  };
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  fullName: text("full_name"),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  jobTitle: text("job_title"),
  website: text("website"),
  // Personal/Business Address
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  // Venue Address (links to venues tab)
  venueAddress: text("venue_address"),
  venueCity: text("venue_city"),
  venueState: text("venue_state"),
  venueZipCode: text("venue_zip_code"),
  venueCountry: text("venue_country"),
  venueId: varchar("venue_id"),
  tags: text("tags").array(),
  leadSource: text("lead_source"),
  notes: text("notes"),
  leadId: varchar("lead_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  name: text("name").notNull(),
  description: text("description"),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  venueId: varchar("venue_id").references(() => venues.id),
  status: text("status").notNull().default('active'), // active, completed, on-hold, cancelled
  progress: integer("progress").default(0), // 0-100
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  actualValue: decimal("actual_value", { precision: 10, scale: 2 }),
  assignedTo: varchar("assigned_to").references(() => users.id),
  portalEnabledOverride: boolean("portal_enabled_override"), // null = follow tenant default, true/false = override
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  fullName: text("full_name"),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  leadSource: text("lead_source"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  status: text("status").notNull().default('new'), // new, qualified, follow-up, converted, lost
  notes: text("notes"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  projectId: varchar("project_id").references(() => projects.id),
  lastContactAt: timestamp("last_contact_at"), // updated on outbound email or logged call
  lastManualStatusAt: timestamp("last_manual_status_at"), // set when status changed by a user
  projectDate: timestamp("project_date"), // event/project date from form
  lastViewedAt: timestamp("last_viewed_at"), // when user last viewed this lead
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  quoteNumber: text("quote_number").notNull().unique(),
  contactId: varchar("contact_id").references(() => contacts.id),
  leadId: varchar("lead_id").references(() => leads.id),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date"), // Event/project date for quote
  venue: text("venue"), // Venue/location for the event
  currency: text("currency").default('GBP'), // Currency code (GBP, USD, EUR, etc.)
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default('draft'), // draft, sent, approved, rejected, expired
  validUntil: timestamp("valid_until"),
  sentAt: timestamp("sent_at"),
  approvedAt: timestamp("approved_at"),
  // Enhanced fields for package-based quotes
  vatMode: text("vat_mode").default('exclusive'), // 'inclusive' or 'exclusive' 
  contractText: text("contract_text"), // Custom contract text for this quote
  requiresSignature: boolean("requires_signature").default(true),
  acceptedAt: timestamp("accepted_at"), // When quote was accepted by client
  invoiceGenerated: boolean("invoice_generated").default(false),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  contractNumber: text("contract_number").notNull().unique(),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  title: text("title").notNull(),
  description: text("description"),
  terms: text("terms"),
  status: text("status").notNull().default('draft'), // draft, sent, signed, cancelled
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  // Signature workflow and fields
  signatureWorkflow: text("signature_workflow").default('counter_sign_after_client'), // not_required, sign_upon_creation, counter_sign_after_client
  businessSignature: text("business_signature"), // Base64 encoded signature or typed name
  clientSignature: text("client_signature"), // Base64 encoded signature or typed name
  businessSignedAt: timestamp("business_signed_at"),
  clientSignedAt: timestamp("client_signed_at"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
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
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
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

// Email Threading System - replaces existing emails table with proper threading
export const emailThreads = pgTable("email_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  projectId: varchar("project_id").references(() => projects.id),
  subject: text("subject"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectIdLastMessageAtIdx: index("email_threads_project_id_last_message_at_idx").on(table.projectId, table.lastMessageAt.desc()),
}));

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  threadId: varchar("thread_id").references(() => emailThreads.id).notNull(),
  provider: text("provider"), // 'gmail'
  providerMessageId: text("provider_message_id"),
  providerThreadId: text("provider_thread_id"),
  messageId: text("message_id"), // RFC Message-ID
  inReplyTo: text("in_reply_to"),
  references: text("references"),
  direction: text("direction"), // 'inbound' | 'outbound'
  fromEmail: text("from_email").notNull(),
  toEmails: text("to_emails").array(), // Changed from single to array
  ccEmails: text("cc_emails").array(),
  bccEmails: text("bcc_emails").array(),
  subject: text("subject"),
  snippet: text("snippet"),
  sentAt: timestamp("sent_at"),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  hasAttachments: boolean("has_attachments").default(false),
  contactId: varchar("contact_id").references(() => contacts.id),
  projectId: varchar("project_id").references(() => projects.id),
  leadId: varchar("lead_id").references(() => leads.id),
  clientId: varchar("client_id").references(() => contacts.id), // Alias for contactId for backward compatibility
  status: text("status").default('delivered'), // delivered, failed, pending
  sentBy: varchar("sent_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerMessageIdUnique: unique("emails_provider_provider_message_id_unique").on(table.provider, table.providerMessageId),
  threadIdIdx: index("emails_thread_id_idx").on(table.threadId),
  projectIdSentAtIdx: index("emails_project_id_sent_at_idx").on(table.projectId, table.sentAt.desc()),
  providerThreadIdIdx: index("emails_provider_thread_id_idx").on(table.providerThreadId),
}));

export const emailAttachments = pgTable("email_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailId: varchar("email_id").references(() => emails.id).notNull(),
  filename: text("filename"),
  mimeType: text("mime_type"),
  size: integer("size"),
  storageKey: text("storage_key"), // fs path or S3 key
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailThreadReads = pgTable("email_thread_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").references(() => emailThreads.id).notNull(),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  lastReadAt: timestamp("last_read_at"),
}, (table) => ({
  threadIdUserIdUnique: unique("email_thread_reads_thread_id_user_id_unique").on(table.threadId, table.userId),
}));

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
  clientId: varchar("client_id").references(() => contacts.id), // Alias for contactId for backward compatibility
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
  clientId: varchar("client_id").references(() => contacts.id), // Alias for contactId for backward compatibility
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
  contactId: varchar("contact_id").references(() => contacts.id),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
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
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
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
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  name: text("name").notNull(),
  address: text("address"),
  address2: text("address2"), // For suite/apartment numbers
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  countryCode: text("country_code"), // ISO country code
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  placeId: text("place_id"), // Google Places ID for caching
  capacity: integer("capacity"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  website: text("website"),
  restrictions: text("restrictions"), // e.g., "noise limiter 92dB"
  accessNotes: text("access_notes"), // load-in/parking/wifi/etc.
  managerName: text("manager_name"),
  managerPhone: text("manager_phone"),
  managerEmail: text("manager_email"),
  preferred: boolean("preferred").default(false),
  useCount: integer("use_count").default(0), // increments when linked to a project
  lastUsedAt: timestamp("last_used_at"), // timestamptz equivalent
  tags: text("tags").array(), // venue tags
  meta: text("meta"), // JSON string for free-form extras from Google or custom
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
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
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
  createdAt: timestamp("created_at").defaultNow(),
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
  slug: text("slug").notNull(), // unique constraint removed temporarily
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

// Enhanced Quotes System - Package-based quoting with public access
export const quotePackages = pgTable("quote_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Bronze, Silver, Gold, etc.
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).default('0.20'), // 20% = 0.20
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quoteAddons = pgTable("quote_addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Uplights, Saxophone, Percussion, etc.
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).default('0.20'),
  category: text("category"), // lighting, music, extras
  dependsOnPackage: boolean("depends_on_package").default(false), // Some add-ons only available with certain packages
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quoteItems = pgTable("quote_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  type: text("type").notNull(), // 'package' or 'addon'
  packageId: varchar("package_id").references(() => quotePackages.id),
  addonId: varchar("addon_id").references(() => quoteAddons.id),
  name: text("name").notNull(), // Store name at time of quote creation
  description: text("description"),
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quoteTokens = pgTable("quote_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  token: text("token").notNull().unique(), // Random unguesable token for public access
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quoteSignatures = pgTable("quote_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email"),
  agreementAccepted: boolean("agreement_accepted").default(false),
  signedAt: timestamp("signed_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// Quote Extra Info System - for configurable contract details collection
export const quoteExtraInfoFields = pgTable("quote_extra_info_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Owner of this custom field, NULL for global standard fields
  key: text("key").notNull(), // Unique key for this field (e.g., 'contact_full_name', 'custom_music_style')
  label: text("label").notNull(), // Display label for the field
  type: text("type").notNull(), // text, email, phone, date, time, textarea, select, checkbox, file, address
  helpText: text("help_text"), // Optional help text shown to user
  placeholder: text("placeholder"), // Placeholder text for inputs
  options: text("options").array(), // For select/checkbox types - array of option values
  isRequired: boolean("is_required").default(false), // Whether this field is required
  isStandard: boolean("is_standard").default(false), // true for predefined standard questions
  crmMapping: text("crm_mapping"), // Maps to CRM field like 'Contact.name', 'Event.date'
  validationRules: text("validation_rules"), // JSON string for additional validation rules
  displayOrder: integer("display_order").default(0), // Order to display fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    // Multi-tenant uniqueness constraints
    userKeyUnique: unique("quote_extra_info_fields_user_key_unique").on(table.userId, table.key),
    keyUnique: unique("quote_extra_info_fields_key_unique").on(table.key)
  };
});

export const quoteExtraInfoConfig = pgTable("quote_extra_info_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  isEnabled: boolean("is_enabled").default(false), // Master toggle for this quote
  enabledFields: text("enabled_fields").array().notNull().default([]), // Array of field keys enabled for this quote
  fieldRequiredOverrides: text("field_required_overrides"), // JSON object with field key -> boolean overrides
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    quoteIdUnique: unique().on(table.quoteId) // One config per quote
  };
});

export const quoteExtraInfoResponses = pgTable("quote_extra_info_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  fieldKey: text("field_key").notNull(), // References quoteExtraInfoFields.key
  value: text("value"), // The user's response value
  fileName: text("file_name"), // For file type fields
  fileSize: integer("file_size"), // For file type fields  
  mimeType: text("mime_type"), // For file type fields
  submittedAt: timestamp("submitted_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    quoteFieldUnique: unique().on(table.quoteId, table.fieldKey) // One response per field per quote
  };
});


// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailThreadSchema = createInsertSchema(emailThreads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailSchema = createInsertSchema(emails).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailAttachmentSchema = createInsertSchema(emailAttachments).omit({ id: true, createdAt: true });
export const insertEmailThreadReadSchema = createInsertSchema(emailThreadReads).omit({ id: true });
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

// Enhanced Quotes System schemas
export const insertQuotePackageSchema = createInsertSchema(quotePackages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteAddonSchema = createInsertSchema(quoteAddons).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({ id: true, createdAt: true });
export const insertQuoteTokenSchema = createInsertSchema(quoteTokens).omit({ id: true, createdAt: true });
export const insertQuoteSignatureSchema = createInsertSchema(quoteSignatures).omit({ id: true, signedAt: true });

// Quote Extra Info System schemas  
export const insertQuoteExtraInfoFieldSchema = createInsertSchema(quoteExtraInfoFields).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteExtraInfoConfigSchema = createInsertSchema(quoteExtraInfoConfig).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteExtraInfoResponseSchema = createInsertSchema(quoteExtraInfoResponses).omit({ id: true, submittedAt: true, updatedAt: true });

// Tenants
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });

// Authentication validation schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const portalAccessRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  projectId: z.string().optional(),
});

export const portalTokenVerifySchema = z.object({
  token: z.string().min(1, 'Access token is required'),
});

export const leadStatusUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'archived'], {
    errorMap: () => ({ message: 'Status must be one of: new, contacted, qualified, archived' })
  }),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
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
export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;
export type EmailThreadRead = typeof emailThreadReads.$inferSelect;
export type InsertEmailThreadRead = z.infer<typeof insertEmailThreadReadSchema>;
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

// Tenants
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

// Enhanced Quotes System types
export type QuotePackage = typeof quotePackages.$inferSelect;
export type InsertQuotePackage = z.infer<typeof insertQuotePackageSchema>;
export type QuoteAddon = typeof quoteAddons.$inferSelect;
export type InsertQuoteAddon = z.infer<typeof insertQuoteAddonSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteToken = typeof quoteTokens.$inferSelect;
export type InsertQuoteToken = z.infer<typeof insertQuoteTokenSchema>;
export type QuoteSignature = typeof quoteSignatures.$inferSelect;
export type InsertQuoteSignature = z.infer<typeof insertQuoteSignatureSchema>;

// Quote Extra Info System types
export type QuoteExtraInfoField = typeof quoteExtraInfoFields.$inferSelect;
export type InsertQuoteExtraInfoField = z.infer<typeof insertQuoteExtraInfoFieldSchema>;
export type QuoteExtraInfoConfig = typeof quoteExtraInfoConfig.$inferSelect;
export type InsertQuoteExtraInfoConfig = z.infer<typeof insertQuoteExtraInfoConfigSchema>;
export type QuoteExtraInfoResponse = typeof quoteExtraInfoResponses.$inferSelect;
export type InsertQuoteExtraInfoResponse = z.infer<typeof insertQuoteExtraInfoResponseSchema>;
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

// Mail Settings for encrypted IMAP/SMTP credentials
export const mailSettings = pgTable("mail_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Primary Email", "Support Email", etc
  provider: text("provider"), // "gmail", "outlook", "icloud", "custom"
  
  // IMAP Settings (encrypted)
  imapHost: text("imap_host"),
  imapPort: integer("imap_port").default(993),
  imapUsername: text("imap_username"),
  imapPassword: text("imap_password"), // Encrypted at rest
  imapSecurity: text("imap_security").default('ssl'), // ssl, starttls, none
  
  // SMTP Settings (encrypted)
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port").default(587),
  smtpUsername: text("smtp_username"),
  smtpPassword: text("smtp_password"), // Encrypted at rest
  smtpSecurity: text("smtp_security").default('starttls'), // ssl, starttls, none
  
  // Email Identity
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  replyToEmail: text("reply_to_email"),
  
  // Settings
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  syncIntervalMinutes: integer("sync_interval_minutes").default(5), // 1-15 mins
  
  // Status & Testing
  lastTestedAt: timestamp("last_tested_at"),
  lastTestResult: text("last_test_result"), // 'ok', 'fail'
  lastTestError: text("last_test_error"),
  
  // Quota Management
  quotaUsed: integer("quota_used").default(0),
  quotaLimit: integer("quota_limit").default(500), // daily send limit
  quotaResetAt: timestamp("quota_reset_at"),
  
  // Failure Tracking
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Note: Unique constraint on isDefault will be enforced in application logic
  // to ensure only one default account exists at a time
}));

// Mail Settings Audit Log
export const mailSettingsAudit = pgTable("mail_settings_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingsId: varchar("settings_id").references(() => mailSettings.id).notNull(),
  kind: text("kind").notNull(), // 'imapTest', 'smtpTest', 'sync', 'send', 'quota'
  ok: boolean("ok").notNull(),
  error: text("error"),
  durationMs: integer("duration_ms"),
  meta: text("meta"), // JSON text for additional data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  settingsIdCreatedAtIdx: index("mail_settings_audit_settings_id_created_at_idx").on(table.settingsId, table.createdAt.desc()),
}));

// Insert schemas for mail settings
export const insertMailSettingsSchema = createInsertSchema(mailSettings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastTestedAt: true,
  lastTestResult: true,
  lastTestError: true,
  quotaUsed: true,
  quotaResetAt: true,
  consecutiveFailures: true
});

export const insertMailSettingsAuditSchema = createInsertSchema(mailSettingsAudit).omit({ 
  id: true, 
  createdAt: true 
});

// Types
export type MailSettings = typeof mailSettings.$inferSelect;
export type InsertMailSettings = z.infer<typeof insertMailSettingsSchema>;
export type MailSettingsAudit = typeof mailSettingsAudit.$inferSelect;
export type InsertMailSettingsAudit = z.infer<typeof insertMailSettingsAuditSchema>;

// Email signatures table
export const emailSignatures = pgTable("email_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  name: text("name").notNull(), // e.g., "Professional", "Personal", "Company"
  content: text("content").notNull(), // HTML or plain text signature
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas and types for email signatures
export const insertEmailSignatureSchema = createInsertSchema(emailSignatures).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type EmailSignature = typeof emailSignatures.$inferSelect;
export type InsertEmailSignature = z.infer<typeof insertEmailSignatureSchema>;

export const insertUserPrefSchema = createInsertSchema(userPrefs).omit({ 
  id: true, 
  updatedAt: true 
});
export type InsertUserPref = z.infer<typeof insertUserPrefSchema>;
export type UserPref = typeof userPrefs.$inferSelect;

// Portal Forms - Project-specific questionnaires for clients
export const portalForms = pgTable("portal_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  formDefinition: text("form_definition").notNull(), // JSON schema
  status: text("status").notNull().default('not_started'), // not_started, in_progress, submitted
  draftData: text("draft_data"), // JSON saved progress
  submittedData: text("submitted_data"), // JSON final submission
  submittedAt: timestamp("submitted_at"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectIdIdx: index("portal_forms_project_id_idx").on(table.projectId),
  contactIdIdx: index("portal_forms_contact_id_idx").on(table.contactId),
}));

// Payment Sessions - Track payment attempts for invoices
export const paymentSessions = pgTable("payment_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id).notNull(),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  provider: text("provider").notNull(), // 'stripe', 'paypal'
  sessionId: text("session_id"), // provider session ID
  paymentIntentId: text("payment_intent_id"), // Stripe payment intent ID
  status: text("status").notNull().default('pending'), // pending, completed, failed, cancelled
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default('usd'), // Made nullable to avoid migration prompt
  successUrl: text("success_url"), // Temporarily added to match current database
  cancelUrl: text("cancel_url"), // Temporarily added to match current database  
  metadata: text("metadata"), // JSON provider-specific data
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  invoiceIdIdx: index("payment_sessions_invoice_id_idx").on(table.invoiceId),
  contactIdIdx: index("payment_sessions_contact_id_idx").on(table.contactId),
  sessionIdIdx: index("payment_sessions_session_id_idx").on(table.sessionId),
}));

// Insert schemas and types for portal forms
export const insertPortalFormSchema = createInsertSchema(portalForms).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type PortalForm = typeof portalForms.$inferSelect;
export type InsertPortalForm = z.infer<typeof insertPortalFormSchema>;

// Insert schemas and types for payment sessions
export const insertPaymentSessionSchema = createInsertSchema(paymentSessions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type PaymentSession = typeof paymentSessions.$inferSelect;
export type InsertPaymentSession = z.infer<typeof insertPaymentSessionSchema>;

