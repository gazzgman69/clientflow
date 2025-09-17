import { neon } from '@neondatabase/serverless';

/**
 * Direct SQL approach to add only the tenants table and tenant_id columns
 * Avoids Drizzle migrator conflicts with existing schema
 */
async function addTenancySupport() {
  console.log('🔄 Adding multitenancy support to database...');
  
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // Enable UUID extension
    console.log('📦 Enabling pgcrypto extension...');
    await sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    
    // Create tenants table if it doesn't exist
    console.log('📦 Creating tenants table...');
    await sql(`CREATE TABLE IF NOT EXISTS tenants (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      domain text,
      is_active boolean DEFAULT true,
      plan text DEFAULT 'starter',
      settings text,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )`);
    
    // Add tenant_id columns to core tables (whitelisted for security)
    const tables = ['users', 'contacts', 'projects', 'leads', 'quotes', 'contracts', 'invoices', 'tasks', 'email_threads', 'emails'];
    
    for (const table of tables) {
      console.log(`📦 Adding tenant_id to ${table} table...`);
      await sql(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS tenant_id varchar REFERENCES tenants(id)`);
      console.log(`✅ Added tenant_id to ${table}`);
    }
    
    // Create indexes for performance
    console.log('📦 Creating indexes...');
    for (const table of tables) {
      await sql(`CREATE INDEX IF NOT EXISTS "idx_${table}_tenant_id" ON "${table}" (tenant_id)`);
      console.log(`✅ Created index for ${table}`);
    }
    
    console.log('✅ Multitenancy support added successfully!');
    
    // Verify the changes
    console.log('🔍 Verifying changes...');
    const tenantsCheck = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'tenants'`;
    console.log('Tenants table exists:', tenantsCheck.length > 0);
    
    const columnCheck = await sql`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name = 'tenant_id' 
      ORDER BY table_name
    `;
    console.log('Tables with tenant_id:', columnCheck.map(r => r.table_name));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add tenancy support:', error);
    process.exit(1);
  }
}

addTenancySupport();