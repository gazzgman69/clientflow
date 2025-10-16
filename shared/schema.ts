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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatar: text("avatar"),
  role: text("role").notNull().default('client'), // admin, musician, client
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("users_tenant_id_idx").on(table.tenantId),
    tenantEmailIdx: index("users_tenant_email_idx").on(table.tenantId, table.email),
  };
});

export const userPrefs = pgTable("user_prefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  key: text("key").notNull(), // e.g., "emailViewMode"
  value: text("value").notNull(), // "unified" | "rfc"
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("user_prefs_tenant_id_idx").on(table.tenantId),
    userKeyUnique: unique().on(table.userId, table.key)
  };
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
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
  venueId: varchar("venue_id"), // Note: Removed .references(() => venues.id) to break circular FK dependency
  tags: text("tags").array(),
  leadSource: text("lead_source"),
  notes: text("notes"),
  leadId: varchar("lead_id"), // Note: Removed .references(() => leads.id) to break circular FK dependency
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("contacts_tenant_id_idx").on(table.tenantId),
    tenantEmailIdx: index("contacts_tenant_email_idx").on(table.tenantId, table.email),
  };
});

// Custom Contact Fields - Field Definitions (global per tenant)
export const contactFieldDefinitions = pgTable("contact_field_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // Internal field name (e.g., 'wedding_date', 'dietary_requirements')
  label: text("label").notNull(), // Display label for the field
  fieldType: text("field_type").notNull(), // 'text', 'number', 'date', 'dropdown', 'checkbox', 'textarea'
  options: text("options").array(), // For dropdown fields: array of options
  required: boolean("required").default(false),
  displayOrder: integer("display_order").default(0), // Order in which fields appear
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("contact_field_defs_tenant_id_idx").on(table.tenantId),
    tenantNameUnique: unique("contact_field_defs_tenant_name_unique").on(table.tenantId, table.name),
  };
});

// Custom Contact Fields - Values (per contact)
export const contactFieldValues = pgTable("contact_field_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  fieldDefinitionId: varchar("field_definition_id").notNull().references(() => contactFieldDefinitions.id, { onDelete: 'cascade' }),
  value: text("value"), // Stored as text, parsed based on field type
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("contact_field_values_tenant_id_idx").on(table.tenantId),
    contactFieldUnique: unique("contact_field_values_contact_field_unique").on(table.contactId, table.fieldDefinitionId),
    tenantContactIdx: index("contact_field_values_tenant_contact_idx").on(table.tenantId, table.contactId),
  };
});

// Tags - Reusable tags for contacts with color coding and categories
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // Tag name (e.g., "Wedding", "VIP", "Follow-up")
  color: text("color").notNull().default('#3b82f6'), // Hex color code for visual distinction
  category: text("category"), // Optional category (e.g., "Lead Source", "Event Type", "Status")
  usageCount: integer("usage_count").default(0), // Track how often this tag is used
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("tags_tenant_id_idx").on(table.tenantId),
    tenantNameUnique: unique("tags_tenant_name_unique").on(table.tenantId, table.name),
    tenantCategoryIdx: index("tags_tenant_category_idx").on(table.tenantId, table.category),
  };
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  name: text("name").notNull(),
  description: text("description"),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  venueId: varchar("venue_id"),
  status: text("status").notNull().default('lead'), // lead, booked, completed, cancelled - calendar pipeline states
  progress: integer("progress").default(0), // 0-100
  primaryEventId: varchar("primary_event_id"), // Link to the primary calendar event for this project
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  actualValue: decimal("actual_value", { precision: 10, scale: 2 }),
  assignedTo: varchar("assigned_to").references(() => users.id),
  portalEnabledOverride: boolean("portal_enabled_override"), // null = follow tenant default, true/false = override
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("projects_tenant_id_idx").on(table.tenantId),
    tenantContactIdx: index("projects_tenant_contact_idx").on(table.tenantId, table.contactId),
    tenantStatusIdx: index("projects_tenant_status_idx").on(table.tenantId, table.status),
  };
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
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
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  lastContactAt: timestamp("last_contact_at"), // updated on outbound email or logged call
  lastManualStatusAt: timestamp("last_manual_status_at"), // set when status changed by a user
  projectDate: timestamp("project_date"), // event/project date from form
  lastViewedAt: timestamp("last_viewed_at"), // when user last viewed this lead
  eventType: text("event_type"), // Type of event (Wedding, Corporate, etc.)
  eventLocation: text("event_location"), // Event location/venue
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // SECURITY FIX: Added compound indexes for tenant isolation + performance
  tenantIdIdx: index("leads_tenant_id_idx").on(table.tenantId),
  tenantEventTypeIdx: index("idx_leads_tenant_event_type").on(table.tenantId, table.eventType),
  tenantStatusIdx: index("leads_tenant_status_idx").on(table.tenantId, table.status),
  tenantEmailIdx: index("leads_tenant_email_idx").on(table.tenantId, table.email),
  eventLocationIdx: index("idx_leads_event_location").on(table.eventLocation),
}));

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  quoteNumber: text("quote_number").notNull().unique(),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'cascade' }),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }),
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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  contractNumber: text("contract_number").notNull().unique(),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").references(() => contractTemplates.id, { onDelete: 'set null' }), // Track which template was used
  title: text("title").notNull(), // Internal title
  displayTitle: text("display_title"), // Display title shown to client
  bodyHtml: text("body_html"), // Rich text content with tokens and embedded forms
  dueDate: timestamp("due_date"), // When contract is due
  status: text("status").notNull().default('draft'), // draft, sent, awaiting_counter_signature, signed, cancelled
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
  // Signature workflow and fields
  signatureWorkflow: text("signature_workflow").default('counter_sign_after_client'), // not_required, sign_upon_creation, counter_sign_after_client
  businessSignature: text("business_signature"), // Typed name for soft signature
  clientSignature: text("client_signature"), // Typed name for soft signature
  businessSignedAt: timestamp("business_signed_at"),
  clientSignedAt: timestamp("client_signed_at"),
  // Embedded form fields and responses
  formFields: text("form_fields"), // JSON array of embedded form field definitions
  formResponses: text("form_responses"), // JSON object of client responses to form fields
  sentAt: timestamp("sent_at"), // When contract was sent to client
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("contracts_tenant_id_idx").on(table.tenantId),
  };
});

// Document Views - Track when documents are viewed by clients
export const documentViews = pgTable("document_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  documentType: text("document_type").notNull(), // 'contract', 'quote', 'invoice'
  documentId: varchar("document_id").notNull(), // ID of the contract/quote/invoice
  viewedAt: timestamp("viewed_at").defaultNow(),
  ipAddress: text("ip_address"), // Optional: track IP for security
  userAgent: text("user_agent"), // Optional: track browser/device
}, (table) => {
  return {
    tenantDocumentIdx: index("document_views_tenant_document_idx").on(table.tenantId, table.documentType, table.documentId),
  };
});

// Contract Templates table
export const contractTemplates = pgTable("contract_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // Template name
  displayTitle: text("display_title"), // Default display title
  bodyHtml: text("body_html"), // Rich text content with tokens and form fields
  formFields: text("form_fields"), // JSON array of embedded form field definitions
  signatureWorkflow: text("signature_workflow").default('counter_sign_after_client'),
  isDefault: boolean("is_default").default(false), // Mark as default template
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("contract_templates_tenant_id_idx").on(table.tenantId),
  };
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  invoiceNumber: text("invoice_number").notNull().unique(),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'cascade' }),
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
}, (table) => {
  return {
    tenantIdIdx: index("invoices_tenant_id_idx").on(table.tenantId),
  };
});

// Income Categories - for categorizing invoice items
export const incomeCategories = pgTable("income_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  isSystem: boolean("is_system").default(false), // Predefined categories: Sales, Services, Rentals, Other
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("income_categories_tenant_id_idx").on(table.tenantId),
    tenantNameUnique: unique("income_categories_tenant_name_unique").on(table.tenantId, table.name),
  };
});

// Invoice Items (Products & Services)
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  internalName: text("internal_name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"), // HTML content with token support
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  isTaxable: boolean("is_taxable").default(true),
  incomeCategoryId: varchar("income_category_id").references(() => incomeCategories.id),
  workflowId: varchar("workflow_id"), // Placeholder for future workflow integration
  photoUrl: text("photo_url"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("invoice_items_tenant_id_idx").on(table.tenantId),
    tenantInternalNameUnique: unique("invoice_items_tenant_internal_name_unique").on(table.tenantId, table.internalName),
  };
});

// Tax Settings - per tenant tax configuration
export const taxSettings = pgTable("tax_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull().unique(), // One tax setting per tenant
  taxName: text("tax_name").notNull().default('VAT'), // VAT, GST, Sales Tax, etc.
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default('20.00'), // Default 20% for UK VAT
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("tax_settings_tenant_id_idx").on(table.tenantId),
  };
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default('medium'), // low, medium, high, urgent
  status: text("status").notNull().default('pending'), // pending, in-progress, completed, cancelled
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email Threading System - replaces existing emails table with proper threading
export const emailThreads = pgTable("email_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'set null' }), // Changed to SET NULL to prevent FK errors when project deleted
  subject: text("subject"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectIdLastMessageAtIdx: index("email_threads_project_id_last_message_at_idx").on(table.projectId, table.lastMessageAt.desc()),
}));

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // SECURITY FIX: Made NOT NULL for tenant isolation
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  threadId: varchar("thread_id").references(() => emailThreads.id, { onDelete: 'cascade' }).notNull(),
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
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }),
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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  emailId: varchar("email_id").references(() => emails.id).notNull(),
  filename: text("filename"),
  mimeType: text("mime_type"),
  size: integer("size"),
  storageKey: text("storage_key"), // fs path or S3 key
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("email_attachments_tenant_id_idx").on(table.tenantId),
  emailIdIdx: index("email_attachments_email_id_idx").on(table.emailId),
}));

export const emailThreadReads = pgTable("email_thread_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  threadId: varchar("thread_id").references(() => emailThreads.id).notNull(),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  lastReadAt: timestamp("last_read_at"),
}, (table) => ({
  tenantIdIdx: index("email_thread_reads_tenant_id_idx").on(table.tenantId),
  threadIdUserIdUnique: unique("email_thread_reads_thread_id_user_id_unique").on(table.threadId, table.userId),
}));

export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  type: text("type").notNull(), // lead_created, quote_sent, contract_signed, etc.
  description: text("description").notNull(),
  entityType: text("entity_type"), // lead, client, project, quote, contract, invoice
  entityId: varchar("entity_id"),
  contactId: varchar("contact_id").references(() => contacts.id),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Ensure activities belong to same tenant through contact/project/user relationships
  tenantIdIdx: index("activities_tenant_id_idx").on(table.tenantId),
  contactIdIdx: index("activities_contact_id_idx").on(table.contactId),
  projectIdIdx: index("activities_project_id_idx").on(table.projectId),
  userIdIdx: index("activities_user_id_idx").on(table.userId),
}));

export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(), // lead_created, quote_sent, etc.
  actions: text("actions").array().notNull(), // send_email, create_task, etc.
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure automations belong to same tenant as the user through the user relationship
  createdByIdx: index("automations_created_by_idx").on(table.createdBy),
  tenantIdIdx: index("automations_tenant_id_idx").on(table.tenantId),
}));

// Members (Musicians) Management
export const members = pgTable("members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
}, (table) => ({
  // Ensure members belong to same tenant as the user through the user relationship
  userIdIdx: index("members_user_id_idx").on(table.userId),
  tenantIdIdx: index("members_tenant_id_idx").on(table.tenantId),
}));

// Venues Management
export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
  // Normalized fields for deduplication
  normalizedName: text("normalized_name"), // Lowercase, trimmed, punctuation-free name
  normalizedAddress: text("normalized_address"), // Lowercase, trimmed, punctuation-free address
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure venues belong to same tenant as the user through the user relationship
  userIdIdx: index("venues_user_id_idx").on(table.userId),
  tenantIdIdx: index("venues_tenant_id_idx").on(table.tenantId),
  // Performance indexes for common query patterns
  tenantCreatedIdx: index("venues_tenant_created_idx").on(table.tenantId, table.createdAt),
  tenantNameIdx: index("venues_tenant_name_idx").on(table.tenantId, table.name),
  // Indexes for deduplication queries using normalized fields
  tenantNormalizedNameIdx: index("venues_tenant_normalized_name_idx").on(table.tenantId, table.normalizedName),
  tenantNormalizedAddressIdx: index("venues_tenant_normalized_address_idx").on(table.tenantId, table.normalizedAddress),
}));

// Project Members Junction Table
export const projectMembers = pgTable("project_members", {
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  role: text("role"), // Lead, Support, etc.
  fee: decimal("fee", { precision: 10, scale: 2 }),
  status: text("status").notNull().default('pending'), // pending, confirmed, declined
  confirmedAt: timestamp("confirmed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("project_members_tenant_id_idx").on(table.tenantId),
  projectIdIdx: index("project_members_project_id_idx").on(table.projectId),
  memberIdIdx: index("project_members_member_id_idx").on(table.memberId),
}));

// Member Availability
export const memberAvailability = pgTable("member_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  date: timestamp("date").notNull(),
  available: boolean("available").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("member_availability_tenant_id_idx").on(table.tenantId),
  memberIdIdx: index("member_availability_member_id_idx").on(table.memberId),
}));

// Project Files
export const projectFiles = pgTable("project_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Ensure project files belong to same tenant as the project through the project relationship
  tenantIdIdx: index("project_files_tenant_id_idx").on(table.tenantId),
  projectIdIdx: index("project_files_project_id_idx").on(table.projectId),
  uploadedByIdx: index("project_files_uploaded_by_idx").on(table.uploadedBy),
}));

// Project Notes
export const projectNotes = pgTable("project_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  note: text("note").notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Ensure project notes belong to same tenant as the project through the project relationship
  tenantIdIdx: index("project_notes_tenant_id_idx").on(table.tenantId),
  projectIdIdx: index("project_notes_project_id_idx").on(table.projectId),
  createdByIdx: index("project_notes_created_by_idx").on(table.createdBy),
}));

// Calendar Integrations
export const calendarIntegrations = pgTable("calendar_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  provider: text("provider").notNull(), // google, outlook, apple, ical
  serviceType: text("service_type").notNull().default('calendar'), // calendar, gmail - distinguishes Google service type
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
  connectedAt: timestamp("connected_at").defaultNow(), // When the integration was first connected
  disconnectedAt: timestamp("disconnected_at"), // When the integration was disconnected
  disconnectReason: text("disconnect_reason"), // Reason for disconnection (user action, token revoked, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure calendar integrations belong to same tenant as the user through the user relationship
  userIdIdx: index("calendar_integrations_user_id_idx").on(table.userId),
  tenantIdIdx: index("calendar_integrations_tenant_id_idx").on(table.tenantId),
  providerServiceIdx: index("calendar_integrations_provider_service_idx").on(table.provider, table.serviceType),
}));

// Calendar Sync Log
export const calendarSyncLog = pgTable("calendar_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
}, (table) => ({
  tenantIdIdx: index("calendar_sync_log_tenant_id_idx").on(table.tenantId),
  integrationIdIdx: index("calendar_sync_log_integration_id_idx").on(table.integrationId),
}));

// Audit Logs for tracking calendar operations
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // calendar_connected, calendar_disconnected, events_purged, events_exported, calendar_reconnected
  resourceType: text("resource_type").notNull(), // calendar_integration, event
  resourceId: varchar("resource_id"), // ID of the affected resource
  metadata: text("metadata"), // JSON string with details (event counts, filters, etc.)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("audit_logs_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
}));

// System Calendars (Leads, Booked, Completed)
export const calendars = pgTable("calendars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // "Leads", "Booked", "Completed", or custom
  color: text("color").notNull().default('#3b82f6'), // Hex color for calendar display
  type: text("type").notNull(), // 'leads', 'booked', 'completed', 'custom'
  isSystem: boolean("is_system").default(false), // true for auto-created system calendars
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("calendars_tenant_id_idx").on(table.tenantId),
  tenantTypeIdx: index("calendars_tenant_type_idx").on(table.tenantId, table.type),
}));

// Events/Calendar System
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  calendarId: varchar("calendar_id").references(() => calendars.id), // Link to system calendar (Leads/Booked/Completed)
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  allDay: boolean("all_day").default(false),
  transparency: text("transparency").default('busy'), // 'free' or 'busy' - for calendar availability
  recurring: boolean("recurring").default(false),
  recurrenceRule: text("recurrence_rule"), // RRULE format for recurring events
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'set null' }),
  assignedTo: varchar("assigned_to").references(() => users.id),
  isCancelled: boolean("is_cancelled").default(false), // True when linked project/lead is deleted
  cancelledAt: timestamp("cancelled_at"), // Timestamp when event was marked as cancelled
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  externalEventId: text("external_event_id"), // For synced events from external calendars (Google event ID)
  externalCalendarId: text("external_calendar_id"), // External calendar ID where this event belongs
  providerData: text("provider_data"), // JSON string of provider-specific data
  calendarIntegrationId: varchar("calendar_integration_id").references(() => calendarIntegrations.id),
  source: text("source").notNull().default('crm'), // google, microsoft, crm, ical - origin of the event
  syncState: text("sync_state").notNull().default('active'), // active, disconnected - sync status
  isReadonly: boolean("is_readonly").default(false), // true when calendar is disconnected
  lastSyncedAt: timestamp("last_synced_at"), // Last time this event was synced from provider
  reminderMinutes: integer("reminder_minutes").default(15), // Minutes before event to send reminder
  attendees: text("attendees").array(), // Email addresses of attendees
  isOrphaned: boolean("is_orphaned").default(false), // Flag for events with tenant_id=NULL (quarantine)
  timezone: text("timezone").default('UTC'), // Timezone for the event (e.g., 'Europe/London', 'America/New_York')
  history: text("history"), // JSON array of change history [{ timestamp, action, userId, changes }]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("events_tenant_id_idx").on(table.tenantId),
  calendarIdIdx: index("events_calendar_id_idx").on(table.calendarId),
  sourceStateIdx: index("events_source_state_idx").on(table.source, table.syncState),
  externalEventIdx: index("events_external_event_idx").on(table.externalEventId),
}));

// Templates table for auto-responders, emails, invoices, contracts
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // Added for tenant isolation
  name: text("name").notNull(),
  slug: text("slug").notNull(), // unique constraint removed temporarily
  questions: text("questions"), // JSON string of form questions
  autoResponseTemplateId: varchar("auto_response_template_id").references(() => templates.id),
  autoResponderTemplateId: varchar("auto_responder_template_id").references(() => templates.id), // Lead auto-responder template
  autoResponderDelaySeconds: integer("auto_responder_delay_seconds").default(60), // Delay in seconds: 60, 300, 600, 1800, 3600 (default: 1 minute)
  bookingLink: text("booking_link"), // Optional booking link for [booking.link] token
  notification: text("notification").notNull().default('email'), // email, sms
  calendarId: varchar("calendar_id").references(() => calendarIntegrations.id),
  lifecycleId: varchar("lifecycle_id"), // store id only (TODO automate later)
  workflowId: varchar("workflow_id"), // store id only (TODO automate later)
  contactTags: text("contact_tags"), // CSV for now (TODO normalize)
  projectTags: text("project_tags"), // CSV for now (TODO normalize)
  recaptchaEnabled: boolean("recaptcha_enabled").default(false),
  consentText: text("consent_text").default('I consent to processing my personal data for contact purposes.'),
  consentRequired: boolean("consent_required").default(false), // Optional by default
  dataRetentionDays: integer("data_retention_days").default(730), // 2+ years for events far in future
  privacyPolicyUrl: text("privacy_policy_url"),
  fromAddress: text("from_address"), // Tenant-specific from address for notifications
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdSlugIdx: index("lead_capture_forms_tenant_id_slug_idx").on(table.tenantId, table.slug),
}));

// Form submission idempotency tracking to prevent duplicates
export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  formId: varchar("form_id").references(() => leadCaptureForms.id).notNull(),
  submissionKey: text("submission_key").notNull(), // Hash of form data for deduplication
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  leadId: varchar("lead_id").references(() => leads.id), // Link to created lead
  status: text("status").notNull().default('processed'), // processed, failed, spam
  metadata: text("metadata"), // JSON string for additional tracking data
  submittedAt: timestamp("submitted_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // TTL for cleanup
}, (table) => ({
  tenantIdSubmissionKeyUnique: unique("form_submissions_tenant_submission_key_unique").on(table.tenantId, table.submissionKey),
  tenantIdFormIdIdx: index("form_submissions_tenant_id_form_id_idx").on(table.tenantId, table.formId),
  expiresAtIdx: index("form_submissions_expires_at_idx").on(table.expiresAt),
}));

// Lead consent tracking for GDPR compliance
export const leadConsents = pgTable("lead_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  formId: varchar("form_id").references(() => leadCaptureForms.id),
  consentType: text("consent_type").notNull().default('marketing'), // marketing, processing, storage
  consentGiven: boolean("consent_given").notNull(),
  consentText: text("consent_text"), // The exact consent text shown to user
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentDate: timestamp("consent_date").defaultNow(),
  withdrawnDate: timestamp("withdrawn_date"),
  expiresAt: timestamp("expires_at"), // For automatic consent expiry
}, (table) => ({
  tenantIdLeadIdIdx: index("lead_consents_tenant_id_lead_id_idx").on(table.tenantId, table.leadId),
  leadIdConsentTypeUnique: unique("lead_consents_lead_consent_type_unique").on(table.leadId, table.consentType),
}));

// Auto-responder send logs for lead capture forms
export const autoResponderLogs = pgTable("auto_responder_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  templateId: varchar("template_id").references(() => messageTemplates.id).notNull(),
  formId: varchar("form_id").references(() => leadCaptureForms.id),
  provider: text("provider"), // google, microsoft - which email provider was used
  status: text("status").notNull().default('queued'), // queued, sent, failed, pending_auth, retrying
  errorCode: text("error_code"), // provider_disconnected, rate_limit, etc.
  errorMessage: text("error_message"),
  providerMessageId: text("provider_message_id"), // Gmail/Outlook message ID for tracking
  retryCount: integer("retry_count").default(0),
  scheduledFor: timestamp("scheduled_for").notNull(), // When to send (now + delay)
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("auto_responder_logs_tenant_id_idx").on(table.tenantId),
  tenantLeadTemplateIdx: index("auto_responder_logs_tenant_lead_template_idx").on(table.tenantId, table.leadId, table.templateId),
  statusScheduledIdx: index("auto_responder_logs_status_scheduled_idx").on(table.status, table.scheduledFor),
}));

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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
}, (table) => ({
  // Ensure quote items belong to same tenant as the quote through the quote relationship
  tenantIdIdx: index("quote_items_tenant_id_idx").on(table.tenantId),
  quoteIdIdx: index("quote_items_quote_id_idx").on(table.quoteId),
}));

export const quoteTokens = pgTable("quote_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  token: text("token").notNull().unique(), // Random unguesable token for public access
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Ensure quote tokens belong to same tenant as the quote through the quote relationship
  quoteIdIdx: index("quote_tokens_quote_id_idx").on(table.quoteId),
}));

export const quoteSignatures = pgTable("quote_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email"),
  agreementAccepted: boolean("agreement_accepted").default(false),
  signedAt: timestamp("signed_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => ({
  // Ensure quote signatures belong to same tenant as the quote through the quote relationship
  quoteIdIdx: index("quote_signatures_quote_id_idx").on(table.quoteId),
}));

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

// Lead Custom Fields System - for configurable custom field collection on lead forms  
export const leadCustomFields = pgTable("lead_custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  userId: varchar("user_id").references(() => users.id), // Owner of this custom field, NULL for global standard fields
  key: text("key").notNull(), // Unique key for this field (e.g., 'custom_music_style', 'dietary_requirements')
  label: text("label").notNull(), // Display label for the field
  type: text("type").notNull(), // text, email, phone, date, time, textarea, select, checkbox, file, address
  helpText: text("help_text"), // Optional help text shown to user
  placeholder: text("placeholder"), // Placeholder text for inputs
  options: text("options").array(), // For select/checkbox types - array of option values
  isRequired: boolean("is_required").default(false), // Whether this field is required
  isStandard: boolean("is_standard").default(false), // true for predefined standard fields
  crmMapping: text("crm_mapping"), // Maps to CRM field like 'Lead.customField1', 'Contact.customData'
  validationRules: text("validation_rules"), // JSON string for additional validation rules
  displayOrder: integer("display_order").default(0), // Order to display fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    // Multi-tenant uniqueness constraints
    tenantKeyUnique: unique("lead_custom_fields_tenant_key_unique").on(table.tenantId, table.key),
    tenantIdIdx: index("idx_lead_custom_fields_tenant_id").on(table.tenantId),
  };
});

export const leadCustomFieldResponses = pgTable("lead_custom_field_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id), // Nullable initially for safe migration
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  fieldKey: text("field_key").notNull(), // References leadCustomFields.key
  value: text("value"), // The user's response value
  fileName: text("file_name"), // For file type fields
  fileSize: integer("file_size"), // For file type fields  
  mimeType: text("mime_type"), // For file type fields
  submittedAt: timestamp("submitted_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    leadFieldUnique: unique().on(table.leadId, table.fieldKey), // One response per field per lead
    tenantIdIdx: index("idx_lead_custom_field_responses_tenant_id").on(table.tenantId),
    leadIdIdx: index("idx_lead_custom_field_responses_lead_id").on(table.leadId),
  };
});


// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true, contractNumber: true, createdBy: true });
export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true, createdBy: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIncomeCategorySchema = createInsertSchema(incomeCategories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaxSettingsSchema = createInsertSchema(taxSettings).omit({ id: true, createdAt: true, updatedAt: true });
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

// Template Categories - organized by document/feature type (similar to 17hats)
export const TEMPLATE_CATEGORIES = {
  // Contract-related templates
  CONTRACT_SEND: 'contract_send',
  CONTRACT_CONFIRMATION: 'contract_confirmation',
  CONTRACT_UPCOMING_SEND: 'contract_upcoming_send',
  CONTRACT_DUE_SEND: 'contract_due_send',
  
  // Invoice-related templates
  INVOICE_SEND: 'invoice_send',
  INVOICE_CONFIRMATION: 'invoice_confirmation',
  INVOICE_UPCOMING_SEND: 'invoice_upcoming_send',
  INVOICE_DUE_SEND: 'invoice_due_send',
  INVOICE_AUTOBILL_CONFIRMATION: 'invoice_autobill_confirmation',
  INVOICE_AUTOBILL_UPCOMING_SEND: 'invoice_autobill_upcoming_send',
  INVOICE_DUE_AND_UPCOMING_SEND: 'invoice_due_and_upcoming_send',
  
  // Quote-related templates
  QUOTE_SEND: 'quote_send',
  QUOTE_CONFIRMATION: 'quote_confirmation',
  QUOTE_UPCOMING_SEND: 'quote_upcoming_send',
  QUOTE_DUE_SEND: 'quote_due_send',
  
  // Questionnaire-related templates
  QUESTIONNAIRE_SEND: 'questionnaire_send',
  QUESTIONNAIRE_CONFIRMATION: 'questionnaire_confirmation',
  QUESTIONNAIRE_UPCOMING_SEND: 'questionnaire_upcoming_send',
  QUESTIONNAIRE_DUE_SEND: 'questionnaire_due_send',
  
  // Scheduling templates
  SCHEDULING: 'scheduling',
  
  // Lead-related templates
  LEAD_SEND: 'lead_send',
  
  // Regular/General email
  REGULAR_EMAIL: 'regular_email',
} as const;

// Helper function to get display name for category
export function getTemplateCategoryDisplay(category: string | null): string {
  if (!category) return 'Regular Email';
  
  const displays: Record<string, string> = {
    [TEMPLATE_CATEGORIES.CONTRACT_SEND]: 'Contract Send',
    [TEMPLATE_CATEGORIES.CONTRACT_CONFIRMATION]: 'Contract Confirmation',
    [TEMPLATE_CATEGORIES.CONTRACT_UPCOMING_SEND]: 'Contract Upcoming Reminder',
    [TEMPLATE_CATEGORIES.CONTRACT_DUE_SEND]: 'Contract Overdue Reminder',
    
    [TEMPLATE_CATEGORIES.INVOICE_SEND]: 'Invoice Send',
    [TEMPLATE_CATEGORIES.INVOICE_CONFIRMATION]: 'Invoice Confirmation',
    [TEMPLATE_CATEGORIES.INVOICE_UPCOMING_SEND]: 'Invoice Upcoming Reminder',
    [TEMPLATE_CATEGORIES.INVOICE_DUE_SEND]: 'Invoice Overdue Reminder',
    [TEMPLATE_CATEGORIES.INVOICE_AUTOBILL_CONFIRMATION]: 'Invoice Auto-Bill Confirmation',
    [TEMPLATE_CATEGORIES.INVOICE_AUTOBILL_UPCOMING_SEND]: 'Invoice Auto-Bill Upcoming',
    [TEMPLATE_CATEGORIES.INVOICE_DUE_AND_UPCOMING_SEND]: 'Invoice Due & Upcoming',
    
    [TEMPLATE_CATEGORIES.QUOTE_SEND]: 'Quote Send',
    [TEMPLATE_CATEGORIES.QUOTE_CONFIRMATION]: 'Quote Confirmation',
    [TEMPLATE_CATEGORIES.QUOTE_UPCOMING_SEND]: 'Quote Upcoming Reminder',
    [TEMPLATE_CATEGORIES.QUOTE_DUE_SEND]: 'Quote Overdue Reminder',
    
    [TEMPLATE_CATEGORIES.QUESTIONNAIRE_SEND]: 'Questionnaire Send',
    [TEMPLATE_CATEGORIES.QUESTIONNAIRE_CONFIRMATION]: 'Questionnaire Confirmation',
    [TEMPLATE_CATEGORIES.QUESTIONNAIRE_UPCOMING_SEND]: 'Questionnaire Upcoming Reminder',
    [TEMPLATE_CATEGORIES.QUESTIONNAIRE_DUE_SEND]: 'Questionnaire Overdue Reminder',
    
    [TEMPLATE_CATEGORIES.SCHEDULING]: 'Scheduling',
    [TEMPLATE_CATEGORIES.LEAD_SEND]: 'Lead Response',
    [TEMPLATE_CATEGORIES.REGULAR_EMAIL]: 'Regular Email',
  };
  
  return displays[category] || category;
}

// Group categories for UI dropdowns
export const TEMPLATE_CATEGORY_GROUPS = [
  {
    label: 'Contract Templates',
    categories: [
      { value: TEMPLATE_CATEGORIES.CONTRACT_SEND, label: 'Contract Send' },
      { value: TEMPLATE_CATEGORIES.CONTRACT_CONFIRMATION, label: 'Contract Confirmation' },
      { value: TEMPLATE_CATEGORIES.CONTRACT_UPCOMING_SEND, label: 'Contract Upcoming Reminder' },
      { value: TEMPLATE_CATEGORIES.CONTRACT_DUE_SEND, label: 'Contract Overdue Reminder' },
    ]
  },
  {
    label: 'Invoice Templates',
    categories: [
      { value: TEMPLATE_CATEGORIES.INVOICE_SEND, label: 'Invoice Send' },
      { value: TEMPLATE_CATEGORIES.INVOICE_CONFIRMATION, label: 'Invoice Confirmation' },
      { value: TEMPLATE_CATEGORIES.INVOICE_UPCOMING_SEND, label: 'Invoice Upcoming Reminder' },
      { value: TEMPLATE_CATEGORIES.INVOICE_DUE_SEND, label: 'Invoice Overdue Reminder' },
      { value: TEMPLATE_CATEGORIES.INVOICE_AUTOBILL_CONFIRMATION, label: 'Invoice Auto-Bill Confirmation' },
      { value: TEMPLATE_CATEGORIES.INVOICE_AUTOBILL_UPCOMING_SEND, label: 'Invoice Auto-Bill Upcoming' },
      { value: TEMPLATE_CATEGORIES.INVOICE_DUE_AND_UPCOMING_SEND, label: 'Invoice Due & Upcoming' },
    ]
  },
  {
    label: 'Quote Templates',
    categories: [
      { value: TEMPLATE_CATEGORIES.QUOTE_SEND, label: 'Quote Send' },
      { value: TEMPLATE_CATEGORIES.QUOTE_CONFIRMATION, label: 'Quote Confirmation' },
      { value: TEMPLATE_CATEGORIES.QUOTE_UPCOMING_SEND, label: 'Quote Upcoming Reminder' },
      { value: TEMPLATE_CATEGORIES.QUOTE_DUE_SEND, label: 'Quote Overdue Reminder' },
    ]
  },
  {
    label: 'Questionnaire Templates',
    categories: [
      { value: TEMPLATE_CATEGORIES.QUESTIONNAIRE_SEND, label: 'Questionnaire Send' },
      { value: TEMPLATE_CATEGORIES.QUESTIONNAIRE_CONFIRMATION, label: 'Questionnaire Confirmation' },
      { value: TEMPLATE_CATEGORIES.QUESTIONNAIRE_UPCOMING_SEND, label: 'Questionnaire Upcoming Reminder' },
      { value: TEMPLATE_CATEGORIES.QUESTIONNAIRE_DUE_SEND, label: 'Questionnaire Overdue Reminder' },
    ]
  },
  {
    label: 'Other Templates',
    categories: [
      { value: TEMPLATE_CATEGORIES.SCHEDULING, label: 'Scheduling' },
      { value: TEMPLATE_CATEGORIES.LEAD_SEND, label: 'Lead Response' },
      { value: TEMPLATE_CATEGORIES.REGULAR_EMAIL, label: 'Regular Email' },
    ]
  }
];
export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, tenantId: true, createdAt: true, updatedAt: true }).extend({
  startDate: z.string().or(z.date()).transform((val) => new Date(val)),
  endDate: z.string().or(z.date()).transform((val) => new Date(val)),
  attendees: z.union([
    z.string().transform((val) => {
      if (!val || val.trim() === '') return [];
      return val.split(',')
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    }),
    z.array(z.string()),
    z.null(),
    z.undefined()
  ]).optional().transform((val) => {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) return val;
    return [];
  })
});
export const insertCalendarSchema = createInsertSchema(calendars).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCalendarIntegrationSchema = createInsertSchema(calendarIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCalendarSyncLogSchema = createInsertSchema(calendarSyncLog).omit({ id: true, startedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });
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

// Lead Custom Fields System schemas  
export const insertLeadCustomFieldSchema = createInsertSchema(leadCustomFields).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadCustomFieldResponseSchema = createInsertSchema(leadCustomFieldResponses).omit({ id: true, submittedAt: true, updatedAt: true });

// Tenants
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });

// Authentication validation schemas
export const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
});

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
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type IncomeCategory = typeof incomeCategories.$inferSelect;
export type InsertIncomeCategory = z.infer<typeof insertIncomeCategorySchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type TaxSettings = typeof taxSettings.$inferSelect;
export type InsertTaxSettings = z.infer<typeof insertTaxSettingsSchema>;
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
export type Calendar = typeof calendars.$inferSelect;
export type InsertCalendar = z.infer<typeof insertCalendarSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;
export type InsertCalendarIntegration = z.infer<typeof insertCalendarIntegrationSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
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

// Lead Custom Fields System types
export type LeadCustomField = typeof leadCustomFields.$inferSelect;
export type InsertLeadCustomField = z.infer<typeof insertLeadCustomFieldSchema>;
export type LeadCustomFieldResponse = typeof leadCustomFieldResponses.$inferSelect;
export type InsertLeadCustomFieldResponse = z.infer<typeof insertLeadCustomFieldResponseSchema>;
export const leadStatusHistory = pgTable("lead_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull(), // manual, auto, event
  metadata: text("metadata"), // json text for rule info etc
  createdAt: timestamp("created_at").defaultNow(),
});

export const leadAutomationRules = pgTable("lead_automation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
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
}, (table) => ({
  tenantIdIdx: index("lead_automation_rules_tenant_id_idx").on(table.tenantId),
}));

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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  name: text("name").notNull(), // e.g., "Professional", "Personal", "Company"
  content: text("content").notNull(), // HTML or plain text signature
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("email_signatures_tenant_id_idx").on(table.tenantId),
    tenantUserIdx: index("email_signatures_tenant_user_idx").on(table.tenantId, table.userId),
  };
});

// Insert schemas and types for email signatures
export const insertEmailSignatureSchema = createInsertSchema(emailSignatures).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type EmailSignature = typeof emailSignatures.$inferSelect;
export type InsertEmailSignature = z.infer<typeof insertEmailSignatureSchema>;

// Email Provider Catalog table (global, not tenant-scoped)
export const emailProviderCatalog = pgTable("email_provider_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // google, microsoft, yahoo, icloud, zoho, etc.
  displayName: text("display_name").notNull(), // "Google Gmail", "Microsoft 365", etc.
  category: text("category").notNull(), // 'oauth' | 'imap_smtp'
  
  // Capabilities
  incoming: boolean("incoming").notNull().default(true),
  outgoing: boolean("outgoing").notNull().default(true),
  
  // OAuth settings (for oauth providers)
  oauthScopes: text("oauth_scopes"), // JSON array as text: ["gmail.send", "gmail.modify"]
  
  // IMAP Settings (for imap_smtp providers)
  imapHost: text("imap_host"),
  imapPort: integer("imap_port"),
  imapSecure: boolean("imap_secure"), // TLS enabled
  imapAuth: text("imap_auth"), // 'basic' | 'xoauth2'
  
  // SMTP Settings (for imap_smtp providers)
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure"), // TLS enabled
  smtpAuth: text("smtp_auth"), // 'basic' | 'xoauth2'
  
  // Help text for users
  helpBlurb: text("help_blurb"), // Provider-specific setup instructions
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas and types for email provider catalog
export const insertEmailProviderCatalogSchema = createInsertSchema(emailProviderCatalog).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type EmailProviderCatalog = typeof emailProviderCatalog.$inferSelect;
export type InsertEmailProviderCatalog = z.infer<typeof insertEmailProviderCatalogSchema>;

// Tenant Email Preferences table (per-tenant email settings)
export const tenantEmailPrefs = pgTable("tenant_email_prefs", {
  tenantId: varchar("tenant_id").primaryKey().notNull().references(() => tenants.id),
  bccSelf: boolean("bcc_self").notNull().default(false),
  readReceipts: boolean("read_receipts").notNull().default(false),
  showOnDashboard: boolean("show_on_dashboard").notNull().default(true),
  contactsOnly: boolean("contacts_only").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas and types for tenant email preferences
export const insertTenantEmailPrefsSchema = createInsertSchema(tenantEmailPrefs).omit({ 
  updatedAt: true 
});

export type TenantEmailPrefs = typeof tenantEmailPrefs.$inferSelect;
export type InsertTenantEmailPrefs = z.infer<typeof insertTenantEmailPrefsSchema>;

// Email Accounts table (per-user/tenant connection - OAuth or IMAP/SMTP)
export const emailAccounts = pgTable("email_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  providerKey: text("provider_key").notNull(), // FK to email_provider_catalog.key
  status: text("status").notNull().default('connected'), // 'connected' | 'disconnected' | 'error'
  accountEmail: text("account_email"), // primary email for this connection
  authType: text("auth_type").notNull(), // 'oauth' | 'basic'
  
  // Encrypted secrets (access/refresh tokens OR username/password)
  secretsEnc: text("secrets_enc"), // encrypted {access_token, refresh_token, expires_at} | {username,password}
  expiresAt: timestamp("expires_at"),
  
  // Sync tracking
  lastSyncedAt: timestamp("last_synced_at"),
  metadata: text("metadata"), // JSONB - cursor/historyId, error codes, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantUserProviderUnique: unique("email_accounts_tenant_user_provider_unique").on(table.tenantId, table.userId, table.providerKey),
  tenantIdIdx: index("email_accounts_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("email_accounts_user_id_idx").on(table.userId),
  statusIdx: index("email_accounts_status_idx").on(table.status),
}));

// Keep old name as alias for backward compatibility during migration
export const emailProviderIntegrations = emailAccounts;

// Insert schemas and types for email accounts
export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type EmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;

// Legacy types for backward compatibility
export const insertEmailProviderIntegrationSchema = insertEmailAccountSchema;
export type EmailProviderIntegration = EmailAccount;
export type InsertEmailProviderIntegration = InsertEmailAccount;

// Email Provider Configurations table
export const emailProviderConfigs = pgTable("email_provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id), // Made nullable initially for safe migration
  name: text("name").notNull(), // "Primary Gmail", "Support Email", etc.
  providerCode: text("provider_code").notNull(), // gmail, microsoft, icloud, etc.
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false), // Only one primary config per tenant
  
  // Authentication Configuration (encrypted/secured)
  authConfig: text("auth_config").notNull(), // JSON - encrypted sensitive auth data
  
  // Provider Identity Settings
  fromEmail: text("from_email"), // Sending email address
  fromName: text("from_name"), // Sending name
  replyToEmail: text("reply_to_email"), // Reply-to address
  
  // Provider Capabilities & Status
  capabilities: text("capabilities"), // JSON - canSend, canReceive, supportsWebhooks, etc.
  isVerified: boolean("is_verified").default(false), // Whether credentials have been verified
  lastVerifiedAt: timestamp("last_verified_at"),
  verificationError: text("verification_error"), // Last verification error if any
  
  // Usage Tracking
  lastUsedAt: timestamp("last_used_at"),
  messagesSent: integer("messages_sent").default(0),
  messagesReceived: integer("messages_received").default(0),
  
  // Health Monitoring
  isHealthy: boolean("is_healthy").default(true),
  lastHealthCheckAt: timestamp("last_health_check_at"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("email_provider_configs_tenant_id_idx").on(table.tenantId),
  tenantPrimaryUnique: unique("email_provider_configs_tenant_primary_unique").on(table.tenantId, table.isPrimary),
  tenantProviderNameUnique: unique("email_provider_configs_tenant_provider_name_unique").on(table.tenantId, table.name),
}));

// Insert schemas and types for email provider configurations
export const insertEmailProviderConfigSchema = createInsertSchema(emailProviderConfigs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastVerifiedAt: true,
  lastUsedAt: true,
  lastHealthCheckAt: true,
  messagesSent: true,
  messagesReceived: true,
  consecutiveFailures: true
});

export type EmailProviderConfig = typeof emailProviderConfigs.$inferSelect;
export type InsertEmailProviderConfig = z.infer<typeof insertEmailProviderConfigSchema>;

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

// Webhook Events - Track processed webhook events for idempotency
export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  provider: text("provider").notNull(), // 'stripe', 'paypal', etc.
  eventId: text("event_id").notNull(), // Provider's unique event ID (e.g., Stripe event.id)
  eventType: text("event_type").notNull(), // e.g., 'payment_intent.succeeded'
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  payload: text("payload"), // JSON of full webhook payload for debugging
  errorMessage: text("error_message"), // If processing failed
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  providerEventIdIdx: unique("webhook_events_provider_event_id_unique").on(table.provider, table.eventId),
  eventTypeIdx: index("webhook_events_event_type_idx").on(table.eventType),
  processedIdx: index("webhook_events_processed_idx").on(table.processed),
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

// Insert schemas and types for webhook events
export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({ 
  id: true, 
  createdAt: true 
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;

// Background Jobs Tables for Persistent Job Queue
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // Tenant isolation for background jobs
  type: text("type").notNull(), // Job type (e.g., 'email-sync', 'calendar-sync')
  payload: text("payload").notNull(), // JSON payload
  priority: text("priority").notNull().default('normal'), // 'low', 'normal', 'high', 'critical'
  maxRetries: integer("max_retries").notNull().default(3),
  delay: integer("delay"), // Delay in milliseconds before execution
  schedule: text("schedule"), // JSON for recurring jobs
  status: text("status").notNull().default('pending'), // 'pending', 'running', 'completed', 'failed', 'retrying', 'cancelled'
  nextRunAt: timestamp("next_run_at"), // When the job should be executed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("jobs_status_idx").on(table.status),
  typeIdx: index("jobs_type_idx").on(table.type),
  nextRunAtIdx: index("jobs_next_run_at_idx").on(table.nextRunAt),
  priorityIdx: index("jobs_priority_idx").on(table.priority),
  tenantIdIdx: index("idx_jobs_tenant_id").on(table.tenantId),
  tenantStatusIdx: index("idx_jobs_tenant_status").on(table.tenantId, table.status),
}));

export const jobExecutions = pgTable("job_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // Tenant isolation for job execution logs
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  status: text("status").notNull(), // 'running', 'completed', 'failed', 'retrying', 'cancelled'
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  error: text("error"), // Error message if failed
  result: text("result"), // JSON result if successful
  attempt: integer("attempt").notNull().default(1),
}, (table) => ({
  jobIdIdx: index("job_executions_job_id_idx").on(table.jobId),
  statusIdx: index("job_executions_status_idx").on(table.status),
  startedAtIdx: index("job_executions_started_at_idx").on(table.startedAt),
  tenantIdIdx: index("idx_job_executions_tenant_id").on(table.tenantId),
  tenantJobIdx: index("idx_job_executions_tenant_job").on(table.tenantId, table.jobId),
}));

// Admin Audit Logs for SUPERADMIN impersonation tracking
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").references(() => users.id).notNull(), // SUPERADMIN performing the action
  impersonatedUserId: varchar("impersonated_user_id").references(() => users.id), // User being impersonated (null for non-impersonation actions)
  tenantId: varchar("tenant_id").references(() => tenants.id), // Tenant context when action occurred
  action: text("action").notNull(), // 'impersonate_start', 'impersonate_end', 'admin_action'
  details: text("details"), // JSON string with additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"), // Link to session if available
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  adminUserIdIdx: index("admin_audit_logs_admin_user_id_idx").on(table.adminUserId),
  impersonatedUserIdIdx: index("admin_audit_logs_impersonated_user_id_idx").on(table.impersonatedUserId),
  tenantIdIdx: index("admin_audit_logs_tenant_id_idx").on(table.tenantId),
  actionIdx: index("admin_audit_logs_action_idx").on(table.action),
  createdAtIdx: index("admin_audit_logs_created_at_idx").on(table.createdAt),
}));

// Insert schemas and types for jobs
export const insertJobSchema = createInsertSchema(jobs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

// Insert schemas and types for job executions
export const insertJobExecutionSchema = createInsertSchema(jobExecutions).omit({ 
  id: true,
  startedAt: true
});

export type JobExecution = typeof jobExecutions.$inferSelect;
export type InsertJobExecution = z.infer<typeof insertJobExecutionSchema>;

// Insert schemas and types for admin audit logs
export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs).omit({ 
  id: true, 
  createdAt: true 
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;

// Insert schemas and types for form submissions (idempotency)
export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({ 
  id: true, 
  submittedAt: true 
});

export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;

// Insert schemas and types for lead consents (GDPR)
export const insertLeadConsentSchema = createInsertSchema(leadConsents).omit({ 
  id: true, 
  consentDate: true 
});

export type LeadConsent = typeof leadConsents.$inferSelect;
export type InsertLeadConsent = z.infer<typeof insertLeadConsentSchema>;

// Insert schemas and types for auto-responder logs
export const insertAutoResponderLogSchema = createInsertSchema(autoResponderLogs).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});

export type AutoResponderLog = typeof autoResponderLogs.$inferSelect;
export type InsertAutoResponderLog = z.infer<typeof insertAutoResponderLogSchema>;

// Insert schemas and types for contact field definitions
export const insertContactFieldDefinitionSchema = createInsertSchema(contactFieldDefinitions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type ContactFieldDefinition = typeof contactFieldDefinitions.$inferSelect;
export type InsertContactFieldDefinition = z.infer<typeof insertContactFieldDefinitionSchema>;

// Insert schemas and types for contact field values
export const insertContactFieldValueSchema = createInsertSchema(contactFieldValues).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type ContactFieldValue = typeof contactFieldValues.$inferSelect;
export type InsertContactFieldValue = z.infer<typeof insertContactFieldValueSchema>;

// Insert schemas and types for tags
export const insertTagSchema = createInsertSchema(tags).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  usageCount: true,
  tenantId: true 
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

// AI-Generated Content Tables

// Email Summaries - AI-generated summaries of email threads
export const emailSummaries = pgTable("email_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  threadId: varchar("thread_id").references(() => emailThreads.id, { onDelete: 'cascade' }).notNull(),
  summary: text("summary").notNull(),
  model: text("model").notNull(), // AI model used (e.g., 'gpt-5')
  tokensUsed: integer("tokens_used"), // For usage tracking
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("email_summaries_tenant_id_idx").on(table.tenantId),
  threadIdIdx: index("email_summaries_thread_id_idx").on(table.threadId),
  tenantThreadUnique: unique("email_summaries_tenant_thread_unique").on(table.tenantId, table.threadId),
}));

// Email Drafts - AI-generated draft replies
export const emailDrafts = pgTable("email_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  threadId: varchar("thread_id").references(() => emailThreads.id, { onDelete: 'cascade' }).notNull(),
  inReplyToEmailId: varchar("in_reply_to_email_id").references(() => emails.id, { onDelete: 'cascade' }),
  draftContent: text("draft_content").notNull(),
  model: text("model").notNull(),
  tokensUsed: integer("tokens_used"),
  createdBy: varchar("created_by").references(() => users.id),
  used: boolean("used").default(false), // Track if user actually sent this draft
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("email_drafts_tenant_id_idx").on(table.tenantId),
  threadIdIdx: index("email_drafts_thread_id_idx").on(table.threadId),
}));

// Email Action Items - AI-extracted tasks and action items
export const emailActionItems = pgTable("email_action_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  emailId: varchar("email_id").references(() => emails.id, { onDelete: 'cascade' }).notNull(),
  threadId: varchar("thread_id").references(() => emailThreads.id, { onDelete: 'cascade' }),
  actionText: text("action_text").notNull(),
  dueDate: timestamp("due_date"),
  priority: text("priority"), // 'high', 'medium', 'low'
  status: text("status").default('pending'), // 'pending', 'completed', 'dismissed'
  model: text("model").notNull(),
  tokensUsed: integer("tokens_used"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  tenantIdIdx: index("email_action_items_tenant_id_idx").on(table.tenantId),
  emailIdIdx: index("email_action_items_email_id_idx").on(table.emailId),
  threadIdIdx: index("email_action_items_thread_id_idx").on(table.threadId),
  statusIdx: index("email_action_items_status_idx").on(table.status),
}));

// Insert schemas and types for AI tables
export const insertEmailSummarySchema = createInsertSchema(emailSummaries).omit({ 
  id: true, 
  createdAt: true 
});

export type EmailSummary = typeof emailSummaries.$inferSelect;
export type InsertEmailSummary = z.infer<typeof insertEmailSummarySchema>;

export const insertEmailDraftSchema = createInsertSchema(emailDrafts).omit({ 
  id: true, 
  createdAt: true 
});

export type EmailDraft = typeof emailDrafts.$inferSelect;
export type InsertEmailDraft = z.infer<typeof insertEmailDraftSchema>;

export const insertEmailActionItemSchema = createInsertSchema(emailActionItems).omit({ 
  id: true, 
  createdAt: true,
  completedAt: true 
});

export type EmailActionItem = typeof emailActionItems.$inferSelect;
export type InsertEmailActionItem = z.infer<typeof insertEmailActionItemSchema>;

