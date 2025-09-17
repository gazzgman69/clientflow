import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';

/**
 * One-time migration runner to apply multitenancy schema changes
 * This bypasses drizzle-kit interactive prompts
 */
async function runMigrations() {
  console.log('🔄 Starting database migration...');
  
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);
    
    console.log('📦 Applying migrations from ./migrations folder...');
    await migrate(db, { migrationsFolder: './migrations' });
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the changes were applied
    console.log('🔍 Verifying tenants table was created...');
    const tenantsCheck = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'tenants'`;
    console.log('Tenants table exists:', tenantsCheck.length > 0);
    
    console.log('🔍 Verifying tenant_id columns were added...');
    const columnCheck = await sql`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name = 'tenant_id' 
      ORDER BY table_name
    `;
    console.log('Tables with tenant_id column:', columnCheck.map(r => r.table_name));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run immediately (ES module style)
runMigrations();

export { runMigrations };