-- Multitenancy scaffolding migration
-- Add tenants table and tenant_id foreign keys to key tables

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create tenants table
CREATE TABLE tenants (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  domain text,
  is_active boolean DEFAULT true,
  plan text DEFAULT 'starter',
  settings text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Add tenant_id foreign keys to core tables
-- Note: Adding as nullable to allow safe migration of existing data
ALTER TABLE users ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE contacts ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE projects ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE leads ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE quotes ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE contracts ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE invoices ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE tasks ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE email_threads ADD COLUMN tenant_id varchar REFERENCES tenants(id);
ALTER TABLE emails ADD COLUMN tenant_id varchar REFERENCES tenants(id);

-- Create indexes for performance (optional but recommended)
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX idx_email_threads_tenant_id ON email_threads(tenant_id);
CREATE INDEX idx_emails_tenant_id ON emails(tenant_id);