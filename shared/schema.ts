import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
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

// Auth tokens table — replaces in-memory Maps for portal and password-reset tokens
export const authTokens = pgTable("auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenHash: text("token_hash").notNull().unique(), // SHA-256 hash of the actual token
  tokenType: text("token_type").notNull(), // 'portal_access' | 'password_reset'
  userId: varchar("user_id"), // For password_reset tokens
  contactId: varchar("contact_id"), // For portal_access tokens
  tenantId: varchar("tenant_id"), // Tenant scope for portal tokens
  email: text("email"), // Associated email
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // Set when token is consumed (single-use)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tokenHashIdx: uniqueIndex("auth_tokens_token_hash_idx").on(table.tokenHash),
  tokenTypeIdx: index("auth_tokens_type_idx").on(table.tokenType),
  expiresAtIdx: index("auth_tokens_expires_at_idx").on(table.expiresAt),
}));

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
  key: text("key").notNull(), // e.g., "emailViewMode", "has_seen_style_onboarding"
  value: text("value").notNull(), // "unified" | "rfc" | "true" | "false"
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("user_prefs_tenant_id_idx").on(table.tenantId),
    userKeyUnique: unique().on(table.userId, table.key)
  };
});

// User AI Style Samples - For learning writing style from pasted examples
export const userStyleSamples = pgTable("user_style_samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sampleText: text("sample_text").notNull(), // The email text pasted by user
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("user_style_samples_tenant_id_idx").on(table.tenantId),
    userIdIdx: index("user_style_samples_user_id_idx").on(table.userId),
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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  displayName: text("display_name"), // Optional display name for invoice
  poNumber: text("po_number"), // Purchase order number
  description: text("description"),
  notes: text("notes"), // Additional notes for the invoice
  currency: text("currency").default('GBP'),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default('0'), // Discount amount
  discountType: text("discount_type").default('percent'), // 'percent' or 'fixed'
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default('0'), // Track partial payments
  status: text("status").notNull().default('draft'), // draft, sent, partially_paid, paid, overdue, cancelled
  dueDate: timestamp("due_date"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  // Payment options
  onlinePaymentsEnabled: boolean("online_payments_enabled").default(true),
  partialPaymentsDisabled: boolean("partial_payments_disabled").default(false),
  hasPaymentSchedule: boolean("has_payment_schedule").default(false),
  isRecurring: boolean("is_recurring").default(false),
  // Stripe integration
  stripePaymentIntentId: text("stripe_payment_intent_id"), // Track Stripe payment intent
  stripeCustomerId: text("stripe_customer_id"), // Link to Stripe customer
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("invoices_tenant_id_idx").on(table.tenantId),
    tenantStatusIdx: index("invoices_tenant_status_idx").on(table.tenantId, table.status),
  };
});

// Invoice Line Items - items added to an invoice
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  invoiceItemId: varchar("invoice_item_id").references(() => invoiceItems.id), // Link to products/services
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  isTaxable: boolean("is_taxable").default(true),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("invoice_line_items_tenant_id_idx").on(table.tenantId),
    invoiceIdIdx: index("invoice_line_items_invoice_id_idx").on(table.invoiceId),
  };
});

// Payment Schedules - for installment payments
export const paymentSchedules = pgTable("payment_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  scheduleType: text("schedule_type").notNull(), // 'custom' or 'equal'
  numberOfPayments: integer("number_of_payments"), // For equal payments
  // Equal payment settings
  startDate: timestamp("start_date"),
  frequency: text("frequency"), // 'days', 'weeks', 'months'
  frequencyInterval: integer("frequency_interval"), // e.g., 1 for every month, 2 for every 2 months
  // Custom payment message
  customMessage: text("custom_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("payment_schedules_tenant_id_idx").on(table.tenantId),
    invoiceIdIdx: index("payment_schedules_invoice_id_idx").on(table.invoiceId),
  };
});

// Payment Schedule Installments - individual payments in a schedule
export const paymentInstallments = pgTable("payment_installments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  paymentScheduleId: varchar("payment_schedule_id").references(() => paymentSchedules.id, { onDelete: 'cascade' }).notNull(),
  installmentNumber: integer("installment_number").notNull(), // 1st, 2nd, 3rd, etc.
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  amountType: text("amount_type").notNull(), // 'percent' or 'fixed'
  dueDate: timestamp("due_date"),
  dueDateTrigger: text("due_date_trigger"), // 'on_receipt', 'after_receipt', 'on_project_date', 'after_project_date', 'before_project_date', 'on_due_date', 'after_due_date', 'before_due_date', 'custom_date'
  dueDateOffset: integer("due_date_offset"), // Number of days/months/weeks offset
  dueDateOffsetUnit: text("due_date_offset_unit"), // 'days', 'weeks', 'months'
  status: text("status").default('pending'), // 'pending', 'paid', 'overdue'
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default('0'),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("payment_installments_tenant_id_idx").on(table.tenantId),
    scheduleIdIdx: index("payment_installments_schedule_id_idx").on(table.paymentScheduleId),
  };
});

// Recurring Invoice Settings
export const recurringInvoiceSettings = pgTable("recurring_invoice_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  frequency: text("frequency").notNull(), // 'days', 'weeks', 'months'
  frequencyInterval: integer("frequency_interval").notNull(), // e.g., 1 for monthly, 2 for bi-monthly
  emailTemplateId: text("email_template_id"), // Future: link to email template
  endDate: timestamp("end_date"), // When to stop recurring (null = never)
  endAfterOccurrences: integer("end_after_occurrences"), // Alternative: stop after X occurrences
  nextSendDate: timestamp("next_send_date"), // When to send next invoice
  occurrenceCount: integer("occurrence_count").default(0), // How many times it has recurred
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("recurring_invoice_settings_tenant_id_idx").on(table.tenantId),
    invoiceIdIdx: index("recurring_invoice_settings_invoice_id_idx").on(table.invoiceId),
    nextSendDateIdx: index("recurring_invoice_settings_next_send_date_idx").on(table.nextSendDate),
  };
});

// Payment Transactions - track all payment attempts and successes
export const paymentTransactions = pgTable("payment_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  installmentId: varchar("installment_id").references(() => paymentInstallments.id, { onDelete: 'set null' }), // Optional: link to installment
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default('GBP'),
  paymentMethod: text("payment_method").notNull(), // 'stripe', 'manual', 'check', 'bank_transfer'
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  status: text("status").notNull(), // 'pending', 'succeeded', 'failed', 'refunded'
  failureReason: text("failure_reason"),
  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  metadata: text("metadata"), // JSON for additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    tenantIdIdx: index("payment_transactions_tenant_id_idx").on(table.tenantId),
    invoiceIdIdx: index("payment_transactions_invoice_id_idx").on(table.invoiceId),
    stripePaymentIntentIdx: index("payment_transactions_stripe_intent_idx").on(table.stripePaymentIntentId),
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
  instruments: text("instruments").array(), // Array of all instruments they can play
  primaryInstrument: text("primary_instrument"), // Their main role/instrument (e.g. "Vocalist", "Keys")
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  feeNotes: text("fee_notes"), // Fee arrangement notes (e.g. "flat rate only, no % deals")
  taxNumber: text("tax_number"), // UTR/VAT number for their invoicing
  paymentDetails: text("payment_details"), // Bank details / payment notes
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  preferredStatus: boolean("preferred_status").default(false),
  callOrder: integer("call_order"), // Default priority within their instrument (1 = first call)
  isActive: boolean("is_active").default(true), // Active vs retired/inactive
  portalAccess: boolean("portal_access").default(false), // Can log into member portal
  portalEmail: text("portal_email"), // Portal login email if different from contact email
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
  callOrder: integer("call_order"), // Which number in the offer sequence (1st call, 2nd call, etc.)
  offerType: text("offer_type"), // 'direct', 'shotgun', 'auto-book'
  offeredAt: timestamp("offered_at"), // When the offer/request was sent to the musician
  respondedAt: timestamp("responded_at"), // When they accepted or declined
  paymentStatus: text("payment_status").default('unpaid'), // 'unpaid', 'invoiced', 'paid'
  memberInvoiceId: varchar("member_invoice_id"), // Link to their submitted invoice if applicable
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
  date: timestamp("date").notNull(), // Kept for backwards compatibility
  startTime: timestamp("start_time"), // Start of availability/unavailability window
  endTime: timestamp("end_time"),     // End of window (null = all day)
  availabilityType: text("availability_type").default('available'), // 'available', 'pencilled', 'booked', 'unavailable', 'tentative'
  projectId: varchar("project_id").references(() => projects.id), // If pencilled/booked — which project
  available: boolean("available").default(true), // Kept for backwards compatibility
  isRecurring: boolean("is_recurring").default(false), // e.g. unavailable every Sunday
  recurrenceRule: text("recurrence_rule"), // iCal RRULE string for recurring blocks
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("member_availability_tenant_id_idx").on(table.tenantId),
  memberIdIdx: index("member_availability_member_id_idx").on(table.memberId),
}));

// Member Groups — for grouping musicians (e.g. "Full Band", "String Quartet", "Duo")
export const memberGroups = pgTable("member_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // e.g. "Full Band", "String Quartet"
  description: text("description"),
  colour: text("colour"), // For calendar/UI colour coding
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("member_groups_tenant_id_idx").on(table.tenantId),
}));

// Member Group Members — junction between groups and musicians
export const memberGroupMembers = pgTable("member_group_members", {
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  groupId: varchar("group_id").references(() => memberGroups.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  role: text("role"), // Their role within this specific group (e.g. "Lead Vocals")
  orderIndex: integer("order_index"), // Position in the group listing
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("member_group_members_tenant_id_idx").on(table.tenantId),
  groupIdIdx: index("member_group_members_group_id_idx").on(table.groupId),
  memberIdIdx: index("member_group_members_member_id_idx").on(table.memberId),
}));

// Performer Contracts — musician-specific contracts per gig, separate from client contracts
export const performerContracts = pgTable("performer_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  memberId: varchar("member_id").references(() => members.id).notNull(),
  templateId: varchar("template_id"), // If generated from a contract template
  title: text("title").notNull(),
  content: text("content").notNull(), // HTML/markdown contract body
  fee: decimal("fee", { precision: 10, scale: 2 }),
  callTime: timestamp("call_time"), // When they need to arrive
  dresscode: text("dresscode"),
  specialInstructions: text("special_instructions"),
  status: text("status").default('draft'), // 'draft', 'sent', 'signed', 'cancelled'
  sentAt: timestamp("sent_at"),
  signedAt: timestamp("signed_at"),
  signatureData: text("signature_data"), // Base64 signature image or typed name
  signerName: text("signer_name"),
  signerEmail: text("signer_email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("performer_contracts_tenant_id_idx").on(table.tenantId),
  projectIdIdx: index("performer_contracts_project_id_idx").on(table.projectId),
  memberIdIdx: index("performer_contracts_member_id_idx").on(table.memberId),
}));

// Repertoire — song library for the agency/band
export const repertoire = pgTable("repertoire", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  title: text("title").notNull(),
  artist: text("artist"),
  genre: text("genre"),
  key: text("key"), // Musical key (C, D, Eb, etc.)
  tempo: integer("tempo"), // BPM
  duration: integer("duration"), // Duration in seconds
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("repertoire_tenant_id_idx").on(table.tenantId),
}));

// Project Setlist — songs assigned to a specific project/gig
export const projectSetlist = pgTable("project_setlist", {
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  songId: varchar("song_id").references(() => repertoire.id).notNull(),
  setNumber: integer("set_number").default(1), // Set 1, Set 2, etc.
  orderIndex: integer("order_index").notNull(), // Position within the set
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("project_setlist_tenant_id_idx").on(table.tenantId),
  projectIdIdx: index("project_setlist_project_id_idx").on(table.projectId),
  songIdIdx: index("project_setlist_song_id_idx").on(table.songId),
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
  status: text("status").notNull().default('confirmed'), // confirmed, cancelled, tentative - event status for Google Calendar sync
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
  lineupSummary: text("lineup_summary"), // Music agency: description of performers/lineup
  fee: decimal("fee", { precision: 10, scale: 2 }), // Music agency: booking fee
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
  templateId: varchar("template_id").references(() => templates.id).notNull(),
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
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true, createdBy: true });
export const insertTaxSettingsSchema = createInsertSchema(taxSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({ id: true, createdAt: true, tenantId: true });
export const insertPaymentScheduleSchema = createInsertSchema(paymentSchedules).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertPaymentInstallmentSchema = createInsertSchema(paymentInstallments).omit({ id: true, createdAt: true, tenantId: true });
export const insertRecurringInvoiceSettingsSchema = createInsertSchema(recurringInvoiceSettings).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
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
export const insertMemberGroupSchema = createInsertSchema(memberGroups).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMemberGroupMemberSchema = createInsertSchema(memberGroupMembers).omit({ createdAt: true });
export const insertPerformerContractSchema = createInsertSchema(performerContracts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRepertoireSchema = createInsertSchema(repertoire).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSetlistSchema = createInsertSchema(projectSetlist).omit({ createdAt: true });
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
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type InsertPaymentSchedule = z.infer<typeof insertPaymentScheduleSchema>;
export type PaymentInstallment = typeof paymentInstallments.$inferSelect;
export type InsertPaymentInstallment = z.infer<typeof insertPaymentInstallmentSchema>;
export type RecurringInvoiceSettings = typeof recurringInvoiceSettings.$inferSelect;
export type InsertRecurringInvoiceSettings = z.infer<typeof insertRecurringInvoiceSettingsSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
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
export type MemberGroup = typeof memberGroups.$inferSelect;
export type InsertMemberGroup = z.infer<typeof insertMemberGroupSchema>;
export type MemberGroupMember = typeof memberGroupMembers.$inferSelect;
export type InsertMemberGroupMember = z.infer<typeof insertMemberGroupMemberSchema>;
export type PerformerContract = typeof performerContracts.$inferSelect;
export type InsertPerformerContract = z.infer<typeof insertPerformerContractSchema>;
export type Repertoire = typeof repertoire.$inferSelect;
export type InsertRepertoire = z.infer<typeof insertRepertoireSchema>;
export type ProjectSetlist = typeof projectSetlist.$inferSelect;
export type InsertProjectSetlist = z.infer<typeof insertProjectSetlistSchema>;
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
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // Multi-tenant isolation
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
  tenantIdIdx: index("mail_settings_tenant_id_idx").on(table.tenantId),
  // Note: Unique constraint on isDefault will be enforced in application logic
  // to ensure only one default account exists per tenant
}));

// Mail Settings Audit Log
export const mailSettingsAudit = pgTable("mail_settings_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(), // Multi-tenant isolation
  settingsId: varchar("settings_id").references(() => mailSettings.id).notNull(),
  kind: text("kind").notNull(), // 'imapTest', 'smtpTest', 'sync', 'send', 'quota'
  ok: boolean("ok").notNull(),
  error: text("error"),
  durationMs: integer("duration_ms"),
  meta: text("meta"), // JSON text for additional data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("mail_settings_audit_tenant_id_idx").on(table.tenantId),
  settingsIdCreatedAtIdx: index("mail_settings_audit_settings_id_created_at_idx").on(table.settingsId, table.createdAt.desc()),
}));

// Insert schemas for mail settings
export const insertMailSettingsSchema = createInsertSchema(mailSettings).omit({ 
  id: true, 
  tenantId: true, // Provided from session context
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
  tenantId: true, // Provided from session context
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

export const insertUserStyleSampleSchema = createInsertSchema(userStyleSamples).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertUserStyleSample = z.infer<typeof insertUserStyleSampleSchema>;
export type UserStyleSample = typeof userStyleSamples.$inferSelect;

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

// AI Business Context - Structured business information for AI personalization
export const aiBusinessContext = pgTable("ai_business_context", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  businessName: text("business_name"),
  businessType: text("business_type"), // e.g., "DJ Service", "Wedding Photography", etc.
  industry: text("industry"),
  services: text("services"), // JSON array of services offered
  pricingInfo: text("pricing_info"), // JSON object with pricing details
  businessHours: text("business_hours"), // JSON object
  targetAudience: text("target_audience"),
  brandVoice: text("brand_voice"), // e.g., "professional", "casual", "friendly"
  terminology: text("terminology"), // JSON object of custom terms (e.g., {"projects": "gigs", "clients": "customers"})
  standardResponses: text("standard_responses"), // JSON object of canned responses
  policies: text("policies"), // JSON object of business policies
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("ai_business_context_tenant_id_idx").on(table.tenantId),
}));

// AI Knowledge Base - Custom knowledge articles and documents
export const aiKnowledgeBase = pgTable("ai_knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  title: text("title").notNull(),
  category: text("category"), // e.g., "services", "pricing", "policies", "procedures"
  content: text("content").notNull(), // The actual knowledge content
  tags: text("tags"), // JSON array of tags for better search
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0), // Higher priority = more important
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("ai_knowledge_base_tenant_id_idx").on(table.tenantId),
  categoryIdx: index("ai_knowledge_base_category_idx").on(table.category),
  isActiveIdx: index("ai_knowledge_base_is_active_idx").on(table.isActive),
}));

// AI Custom Instructions - Specific instructions for AI behavior
export const aiCustomInstructions = pgTable("ai_custom_instructions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  instruction: text("instruction").notNull(),
  category: text("category"), // e.g., "communication_style", "data_handling", "responses"
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("ai_custom_instructions_tenant_id_idx").on(table.tenantId),
  categoryIdx: index("ai_custom_instructions_category_idx").on(table.category),
  isActiveIdx: index("ai_custom_instructions_is_active_idx").on(table.isActive),
}));

// AI Training Documents - Uploaded documents for AI to learn from
export const aiTrainingDocuments = pgTable("ai_training_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"), // pdf, docx, txt, etc.
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(), // Path to stored file
  extractedText: text("extracted_text"), // Text extracted from document
  category: text("category"), // e.g., "contracts", "manuals", "catalogs"
  isProcessed: boolean("is_processed").default(false),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("ai_training_documents_tenant_id_idx").on(table.tenantId),
  categoryIdx: index("ai_training_documents_category_idx").on(table.category),
  isProcessedIdx: index("ai_training_documents_is_processed_idx").on(table.isProcessed),
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

// AI Business Context insert schema and types
export const insertAiBusinessContextSchema = createInsertSchema(aiBusinessContext).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type AiBusinessContext = typeof aiBusinessContext.$inferSelect;
export type InsertAiBusinessContext = z.infer<typeof insertAiBusinessContextSchema>;

// AI Knowledge Base insert schema and types
export const insertAiKnowledgeBaseSchema = createInsertSchema(aiKnowledgeBase).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type AiKnowledgeBase = typeof aiKnowledgeBase.$inferSelect;
export type InsertAiKnowledgeBase = z.infer<typeof insertAiKnowledgeBaseSchema>;

// AI Custom Instructions insert schema and types
export const insertAiCustomInstructionSchema = createInsertSchema(aiCustomInstructions).omit({ 
  id: true, 
  createdAt: true 
});

export type AiCustomInstruction = typeof aiCustomInstructions.$inferSelect;
export type InsertAiCustomInstruction = z.infer<typeof insertAiCustomInstructionSchema>;

// AI Training Documents insert schema and types
export const insertAiTrainingDocumentSchema = createInsertSchema(aiTrainingDocuments).omit({ 
  id: true, 
  createdAt: true 
});

export type AiTrainingDocument = typeof aiTrainingDocuments.$inferSelect;
export type InsertAiTrainingDocument = z.infer<typeof insertAiTrainingDocumentSchema>;

// Notification System Tables

// Notification Settings - User/tenant preferences for notifications and auto-replies
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id), // Nullable - can be tenant-wide or user-specific
  emailNotificationsEnabled: boolean("email_notifications_enabled").default(true),
  emailFrequency: text("email_frequency").default('daily'), // 'realtime', 'daily', 'weekly'
  inAppNotificationsEnabled: boolean("in_app_notifications_enabled").default(true),
  autoReplyEnabled: boolean("auto_reply_enabled").default(false),
  autoReplyMessage: text("auto_reply_message"),
  daysWithoutReply: integer("days_without_reply").default(3), // Days without reply threshold for urgency
  daysSinceInquiry: integer("days_since_inquiry").default(7), // Days since inquiry threshold for urgency
  followUpThresholdHours: integer("follow_up_threshold_hours").default(24), // Hours before notifying about unanswered leads
  eventDateUrgencyDays: integer("event_date_urgency_days").default(30), // Days before event to mark as urgent
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("notification_settings_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("notification_settings_user_id_idx").on(table.userId),
  // Partial unique index for tenant-wide settings (user_id IS NULL)
  tenantWideUnique: uniqueIndex("notification_settings_tenant_wide_unique")
    .on(table.tenantId)
    .where(sql`${table.userId} IS NULL`),
  // Unique index for user-specific settings
  userSpecificUnique: uniqueIndex("notification_settings_user_specific_unique")
    .on(table.tenantId, table.userId)
    .where(sql`${table.userId} IS NOT NULL`),
}));

// Lead Follow-Up Notifications - AI-generated notifications for leads that need attention
export const leadFollowUpNotifications = pgTable("lead_follow_up_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(), // Who should be notified
  leadId: varchar("lead_id").references(() => contacts.id, { onDelete: 'cascade' }).notNull(), // Which lead needs attention
  notificationType: text("notification_type").notNull(), // 'needs_reply', 'overdue_response', 'event_approaching', 'going_cold', 'auto_reply_sent'
  priority: text("priority").notNull().default('medium'), // 'low', 'medium', 'high', 'urgent'
  message: text("message").notNull(), // Notification message
  urgencyScore: integer("urgency_score"), // 0-100 score calculated by AI
  read: boolean("read").default(false),
  readAt: timestamp("read_at"),
  dismissed: boolean("dismissed").default(false),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("lead_notifications_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("lead_notifications_user_id_idx").on(table.userId),
  leadIdIdx: index("lead_notifications_lead_id_idx").on(table.leadId),
  readIdx: index("lead_notifications_read_idx").on(table.read),
  priorityIdx: index("lead_notifications_priority_idx").on(table.priority),
}));

// Auto-Reply Log - Track auto-replies sent to leads
export const autoReplyLog = pgTable("auto_reply_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  leadId: varchar("lead_id").references(() => contacts.id, { onDelete: 'cascade' }).notNull(),
  emailId: varchar("email_id").references(() => emails.id, { onDelete: 'set null' }), // The email that was sent
  message: text("message").notNull(), // The auto-reply that was sent
  sentAt: timestamp("sent_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("auto_reply_log_tenant_id_idx").on(table.tenantId),
  leadIdIdx: index("auto_reply_log_lead_id_idx").on(table.leadId),
}));

// Insert schemas and types for notification tables
export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;

export const insertLeadFollowUpNotificationSchema = createInsertSchema(leadFollowUpNotifications).omit({ 
  id: true, 
  createdAt: true,
  readAt: true,
  dismissedAt: true
});

export type LeadFollowUpNotification = typeof leadFollowUpNotifications.$inferSelect;
export type InsertLeadFollowUpNotification = z.infer<typeof insertLeadFollowUpNotificationSchema>;

export const insertAutoReplyLogSchema = createInsertSchema(autoReplyLog).omit({ 
  id: true, 
  sentAt: true 
});

export type AutoReplyLog = typeof autoReplyLog.$inferSelect;
export type InsertAutoReplyLog = z.infer<typeof insertAutoReplyLogSchema>;

// ============================================================================
// AI ONBOARDING WIZARD SYSTEM
// ============================================================================

// Tenant Onboarding Progress - Track AI wizard progress for new tenants
export const tenantOnboardingProgress = pgTable("tenant_onboarding_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull().unique(),
  isCompleted: boolean("is_completed").default(false),
  isSkipped: boolean("is_skipped").default(false),
  currentStep: text("current_step"), // Current step being worked on
  completedSteps: text("completed_steps").array().default(sql`ARRAY[]::text[]`), // Array of completed step names
  skippedSteps: text("skipped_steps").array().default(sql`ARRAY[]::text[]`), // Array of skipped step names
  pendingOAuthProvider: text("pending_oauth_provider"), // 'gmail' | 'outlook' | null - tracks if AI is waiting for OAuth
  collectedData: text("collected_data"), // JSON object containing { userId, conversationHistory, extractedData }
  completedAt: timestamp("completed_at"),
  skippedAt: timestamp("skipped_at"),
  lastInteractionAt: timestamp("last_interaction_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("tenant_onboarding_progress_tenant_id_idx").on(table.tenantId),
  isCompletedIdx: index("tenant_onboarding_progress_is_completed_idx").on(table.isCompleted),
}));

export const insertTenantOnboardingProgressSchema = createInsertSchema(tenantOnboardingProgress).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastInteractionAt: true,
  completedAt: true,
  skippedAt: true
});

export type TenantOnboardingProgress = typeof tenantOnboardingProgress.$inferSelect;
export type InsertTenantOnboardingProgress = z.infer<typeof insertTenantOnboardingProgressSchema>;

// ============================================================================
// MEDIA LIBRARY SYSTEM
// ============================================================================

// Media Library - Photos, videos, audio for AI widget to share
export const mediaLibrary = pgTable("media_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // 'image', 'video', 'audio'
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(), // Path to stored file
  thumbnailPath: text("thumbnail_path"), // Thumbnail for videos/images
  title: text("title"), // Optional display title
  description: text("description"), // Optional description
  category: text("category"), // e.g., 'weddings', 'corporate', 'setups', 'equipment', 'venues'
  tags: text("tags").array(), // Array of tags for better search
  displayOrder: integer("display_order").default(0), // Order for gallery display
  isActive: boolean("is_active").default(true),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("media_library_tenant_id_idx").on(table.tenantId),
  categoryIdx: index("media_library_category_idx").on(table.category),
  isActiveIdx: index("media_library_is_active_idx").on(table.isActive),
  fileTypeIdx: index("media_library_file_type_idx").on(table.fileType),
}));

export const insertMediaLibrarySchema = createInsertSchema(mediaLibrary).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type MediaLibrary = typeof mediaLibrary.$inferSelect;
export type InsertMediaLibrary = z.infer<typeof insertMediaLibrarySchema>;

// ============================================================================
// PUBLIC AI CHAT WIDGET SYSTEM
// ============================================================================

// Widget Settings - Configuration for public AI chat widget
export const widgetSettings = pgTable("widget_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull().unique(),
  isEnabled: boolean("is_enabled").default(true),
  welcomeMessage: text("welcome_message").default('Hi! How can I help you today?'),
  brandColor: text("brand_color").default('#3b82f6'), // Primary brand color
  position: text("position").default('bottom-right'), // 'bottom-right', 'bottom-left'
  chatbotName: text("chatbot_name").default('Assistant'),
  avatarUrl: text("avatar_url"), // Optional custom avatar
  tone: text("tone").default('professional'), // 'professional', 'friendly', 'casual'
  bookingPromptAggressiveness: text("booking_prompt_aggressiveness").default('gentle'), // 'none', 'gentle', 'moderate', 'aggressive'
  collectEmailBefore: boolean("collect_email_before").default(false), // Collect email before chatting
  enableSoundNotifications: boolean("enable_sound_notifications").default(true),
  enableTypingIndicator: boolean("enable_typing_indicator").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("widget_settings_tenant_id_idx").on(table.tenantId),
}));

export const insertWidgetSettingsSchema = createInsertSchema(widgetSettings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type WidgetSettings = typeof widgetSettings.$inferSelect;
export type InsertWidgetSettings = z.infer<typeof insertWidgetSettingsSchema>;

// Chat Conversations - Track all AI widget conversations
export const chatConversations = pgTable("chat_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  visitorEmail: text("visitor_email"), // Collected email if available
  visitorName: text("visitor_name"), // Collected name if available
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'set null' }), // Linked contact if identified
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'set null' }), // Created lead if conversation converted
  sessionId: text("session_id").notNull(), // Browser session ID
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  isConverted: boolean("is_converted").default(false), // Did they book or become a lead?
  conversionType: text("conversion_type"), // 'booking', 'lead', 'contact'
  leadQualityScore: integer("lead_quality_score"), // 0-100 AI-calculated score
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("chat_conversations_tenant_id_idx").on(table.tenantId),
  sessionIdIdx: index("chat_conversations_session_id_idx").on(table.sessionId),
  contactIdIdx: index("chat_conversations_contact_id_idx").on(table.contactId),
  leadIdIdx: index("chat_conversations_lead_id_idx").on(table.leadId),
  isConvertedIdx: index("chat_conversations_is_converted_idx").on(table.isConverted),
}));

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({ 
  id: true, 
  createdAt: true,
  lastMessageAt: true
});

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;

// Chat Messages - Individual messages in conversations
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  conversationId: varchar("conversation_id").references(() => chatConversations.id, { onDelete: 'cascade' }).notNull(),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  mediaUrls: text("media_urls").array(), // URLs to media shared in message
  functionCalled: text("function_called"), // Name of function called by AI
  functionResult: text("function_result"), // JSON result of function call
  tokensUsed: integer("tokens_used"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("chat_messages_tenant_id_idx").on(table.tenantId),
  conversationIdIdx: index("chat_messages_conversation_id_idx").on(table.conversationId),
  roleIdx: index("chat_messages_role_idx").on(table.role),
}));

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ 
  id: true, 
  createdAt: true 
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// ============================================================================
// ONLINE SCHEDULER SYSTEM
// ============================================================================

// Bookable Services - Services that can be booked through the scheduler
export const bookableServices = pgTable("bookable_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // e.g., "Call With Club Kudo", "Pre-Event Call"
  description: text("description"), // Rich text description
  serviceType: text("service_type").default('individual'), // 'individual', 'group'
  duration: integer("duration").notNull(), // Duration in minutes
  bufferBefore: integer("buffer_before").default(0), // Minutes buffer before appointment
  bufferAfter: integer("buffer_after").default(0), // Minutes buffer after appointment
  startTimeInterval: integer("start_time_interval").default(30), // Booking intervals (e.g., every 30 minutes)
  
  // Service Questions - Always asked
  serviceQuestions: text("service_questions"), // JSON array of questions always asked
  
  // Project Setup Questions - Only for new contacts
  projectQuestions: text("project_questions"), // JSON array of questions for new contacts
  
  // Optional features
  requirePhone: boolean("require_phone").default(false),
  enableOnlinePayments: boolean("enable_online_payments").default(false),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  paymentType: text("payment_type"), // 'full', 'deposit'
  
  // Location
  location: text("location"), // e.g., "Consultation Phone Call", "Zoom", "In-person"
  locationDetails: text("location_details"),
  
  // Email templates
  confirmationMessageTemplateId: varchar("confirmation_message_template_id").references(() => messageTemplates.id),
  cancellationMessageTemplateId: varchar("cancellation_message_template_id").references(() => messageTemplates.id),
  reminderMessageTemplateId: varchar("reminder_message_template_id").references(() => messageTemplates.id),
  reminderDaysBefore: integer("reminder_days_before").default(1),
  
  // Project management
  autoCreateProject: boolean("auto_create_project").default(false),
  addContactTags: text("add_contact_tags").array(),
  addProjectTags: text("add_project_tags").array(),
  removeProjectTags: text("remove_project_tags").array(),
  updateProjectDateToBooking: boolean("update_project_date_to_booking").default(false),
  
  // Approval settings
  requireApproval: boolean("require_approval").default(false),
  approvalCalendarId: varchar("approval_calendar_id").references(() => calendarIntegrations.id),
  approvalWorkflowId: text("approval_workflow_id"),
  approvalAutoEmail: text("approval_auto_email"), // 'do_not_send', 'waiting_for_approval', custom template
  
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("bookable_services_tenant_id_idx").on(table.tenantId),
  isActiveIdx: index("bookable_services_is_active_idx").on(table.isActive),
}));

export const insertBookableServiceSchema = createInsertSchema(bookableServices).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type BookableService = typeof bookableServices.$inferSelect;
export type InsertBookableService = z.infer<typeof insertBookableServiceSchema>;

// Availability Schedules - Named schedules with rules
export const availabilitySchedules = pgTable("availability_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // e.g., "Consultation Call Availability"
  publicLink: text("public_link").unique(), // Public URL slug
  isActive: boolean("is_active").default(true),
  
  // Booking Limitations
  minAdvanceNoticeHours: integer("min_advance_notice_hours"), // Must book at least X hours in advance
  maxFutureDays: integer("max_future_days"), // Can't book more than X days in the future
  dailyBookingLimit: integer("daily_booking_limit"), // Max bookings per day (0 = unlimited)
  weeklyBookingLimit: integer("weekly_booking_limit"), // Max bookings per week (0 = unlimited)
  cancellationPolicyHours: integer("cancellation_policy_hours"), // Can't cancel within X hours of appointment
  
  // Visual Customization
  headerImageUrl: text("header_image_url"), // Public booking page header image
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("availability_schedules_tenant_id_idx").on(table.tenantId),
  publicLinkIdx: index("availability_schedules_public_link_idx").on(table.publicLink),
}));

export const insertAvailabilityScheduleSchema = createInsertSchema(availabilitySchedules).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type AvailabilitySchedule = typeof availabilitySchedules.$inferSelect;
export type InsertAvailabilitySchedule = z.infer<typeof insertAvailabilityScheduleSchema>;

// Schedule Services - Link services to schedules (many-to-many)
export const scheduleServices = pgTable("schedule_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").references(() => availabilitySchedules.id, { onDelete: 'cascade' }).notNull(),
  serviceId: varchar("service_id").references(() => bookableServices.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  scheduleIdIdx: index("schedule_services_schedule_id_idx").on(table.scheduleId),
  serviceIdIdx: index("schedule_services_service_id_idx").on(table.serviceId),
  scheduleServiceUnique: unique("schedule_services_schedule_service_unique").on(table.scheduleId, table.serviceId),
}));

export const insertScheduleServiceSchema = createInsertSchema(scheduleServices).omit({ 
  id: true, 
  createdAt: true 
});

export type ScheduleService = typeof scheduleServices.$inferSelect;
export type InsertScheduleService = z.infer<typeof insertScheduleServiceSchema>;

// Availability Rules - Define when slots are available
export const availabilityRules = pgTable("availability_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").references(() => availabilitySchedules.id, { onDelete: 'cascade' }).notNull(),
  frequency: text("frequency").notNull(), // 'daily', 'weekly', 'monthly'
  selectedDays: text("selected_days").array(), // ['MO', 'TU', 'WE', 'TH', 'FR'] for weekly
  dateStart: timestamp("date_start"), // Start date for this rule
  dateEnd: timestamp("date_end"), // End date for this rule (null = no end)
  timeStart: text("time_start").notNull(), // e.g., '10:00'
  timeEnd: text("time_end").notNull(), // e.g., '16:30'
  isException: boolean("is_exception").default(false), // True if this blocks out time instead
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  scheduleIdIdx: index("availability_rules_schedule_id_idx").on(table.scheduleId),
}));

export const insertAvailabilityRuleSchema = createInsertSchema(availabilityRules).omit({ 
  id: true, 
  createdAt: true 
});

export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type InsertAvailabilityRule = z.infer<typeof insertAvailabilityRuleSchema>;

// Schedule Calendar Checks - Link schedules to calendars for conflict detection
export const scheduleCalendarChecks = pgTable("schedule_calendar_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").references(() => availabilitySchedules.id, { onDelete: 'cascade' }).notNull(),
  calendarIntegrationId: varchar("calendar_integration_id").references(() => calendarIntegrations.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  scheduleIdIdx: index("schedule_calendar_checks_schedule_id_idx").on(table.scheduleId),
  calendarIntegrationIdIdx: index("schedule_calendar_checks_calendar_id_idx").on(table.calendarIntegrationId),
  scheduleCalendarUnique: unique("schedule_calendar_checks_unique").on(table.scheduleId, table.calendarIntegrationId),
}));

export const insertScheduleCalendarCheckSchema = createInsertSchema(scheduleCalendarChecks).omit({ 
  id: true, 
  createdAt: true 
});

export type ScheduleCalendarCheck = typeof scheduleCalendarChecks.$inferSelect;
export type InsertScheduleCalendarCheck = z.infer<typeof insertScheduleCalendarCheckSchema>;

// Schedule Team Members - Assign team members to schedules
export const scheduleTeamMembers = pgTable("schedule_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").references(() => availabilitySchedules.id, { onDelete: 'cascade' }).notNull(),
  memberId: varchar("member_id").references(() => members.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  scheduleIdIdx: index("schedule_team_members_schedule_id_idx").on(table.scheduleId),
  memberIdIdx: index("schedule_team_members_member_id_idx").on(table.memberId),
  scheduleMemberUnique: unique("schedule_team_members_unique").on(table.scheduleId, table.memberId),
}));

export const insertScheduleTeamMemberSchema = createInsertSchema(scheduleTeamMembers).omit({ 
  id: true, 
  createdAt: true 
});

export type ScheduleTeamMember = typeof scheduleTeamMembers.$inferSelect;
export type InsertScheduleTeamMember = z.infer<typeof insertScheduleTeamMemberSchema>;

// Bookings - Actual booked appointments
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  serviceId: varchar("service_id").references(() => bookableServices.id).notNull(),
  scheduleId: varchar("schedule_id").references(() => availabilitySchedules.id),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'cascade' }),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'set null' }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'set null' }),
  
  // Booking details
  bookedBy: text("booked_by").notNull(), // Name of person booking
  bookedEmail: text("booked_email").notNull(),
  bookedPhone: text("booked_phone"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  timezone: text("timezone").notNull().default('UTC'),
  
  // Question responses
  serviceResponses: text("service_responses"), // JSON of service question answers
  projectResponses: text("project_responses"), // JSON of project setup question answers
  
  // Status
  status: text("status").notNull().default('pending'), // 'pending', 'confirmed', 'cancelled', 'completed'
  approvalStatus: text("approval_status"), // 'pending_approval', 'approved', 'rejected' if approval required
  
  // Integration
  googleEventId: text("google_event_id"), // Google Calendar event ID from sync
  
  // Notifications
  confirmationSentAt: timestamp("confirmation_sent_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  cancellationSentAt: timestamp("cancellation_sent_at"),
  
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: text("cancelled_by"), // 'client', 'admin'
  cancellationReason: text("cancellation_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("bookings_tenant_id_idx").on(table.tenantId),
  serviceIdIdx: index("bookings_service_id_idx").on(table.serviceId),
  contactIdIdx: index("bookings_contact_id_idx").on(table.contactId),
  statusIdx: index("bookings_status_idx").on(table.status),
  startTimeIdx: index("bookings_start_time_idx").on(table.startTime),
}));

export const insertBookingSchema = createInsertSchema(bookings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  confirmationSentAt: true,
  reminderSentAt: true,
  cancellationSentAt: true,
  cancelledAt: true
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
