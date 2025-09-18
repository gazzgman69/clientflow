-- Add Row Level Security (RLS) policies for multi-tenant data isolation
-- This migration enables RLS on all tenant-scoped tables and creates policies

-- Enable RLS on all multi-tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_thread_reads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
-- Users table
CREATE POLICY users_tenant_isolation ON users
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Contacts table
CREATE POLICY contacts_tenant_isolation ON contacts
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Projects table
CREATE POLICY projects_tenant_isolation ON projects
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Leads table
CREATE POLICY leads_tenant_isolation ON leads
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Quotes table
CREATE POLICY quotes_tenant_isolation ON quotes
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Contracts table
CREATE POLICY contracts_tenant_isolation ON contracts
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Invoices table
CREATE POLICY invoices_tenant_isolation ON invoices
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Tasks table
CREATE POLICY tasks_tenant_isolation ON tasks
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Emails table
CREATE POLICY emails_tenant_isolation ON emails
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Email threads table
CREATE POLICY email_threads_tenant_isolation ON email_threads
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Members table
CREATE POLICY members_tenant_isolation ON members
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Venues table
CREATE POLICY venues_tenant_isolation ON venues
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Activities table
CREATE POLICY activities_tenant_isolation ON activities
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Automations table
CREATE POLICY automations_tenant_isolation ON automations
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Message templates table
CREATE POLICY message_templates_tenant_isolation ON message_templates
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Message threads table
CREATE POLICY message_threads_tenant_isolation ON message_threads
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- SMS messages table
CREATE POLICY sms_messages_tenant_isolation ON sms_messages
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Project members table
CREATE POLICY project_members_tenant_isolation ON project_members
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Email attachments table
CREATE POLICY email_attachments_tenant_isolation ON email_attachments
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Email thread reads table
CREATE POLICY email_thread_reads_tenant_isolation ON email_thread_reads
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Create authenticated role if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END
$$;

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;