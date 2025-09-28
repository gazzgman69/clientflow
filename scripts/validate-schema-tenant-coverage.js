#!/usr/bin/env node

/**
 * Schema validation script to ensure all tables have proper tenant_id coverage
 * Run with: node scripts/validate-schema-tenant-coverage.js
 */

const { Client } = require('pg');

const REQUIRED_TENANT_TABLES = [
  'users', 'leads', 'contacts', 'projects', 'quotes', 'contracts', 'invoices', 
  'tasks', 'emails', 'events', 'jobs', 'job_executions', 'members', 
  'payment_sessions', 'automations', 'message_templates', 'calendar_integrations',
  'email_attachments', 'email_threads', 'sms_messages', 'venues', 'activities'
];

const EXEMPT_TABLES = [
  'tenants', 'sessions', 'drizzle__migrations'
];

async function validateTenantCoverage() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/crm'
  });

  try {
    await client.connect();
    console.log('🔍 Validating tenant_id coverage across all tables...\n');

    // Get all tables with tenant_id column info
    const result = await client.query(`
      SELECT 
        t.table_name,
        c.column_name,
        c.is_nullable,
        c.data_type,
        EXISTS(
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = t.table_name 
            AND kcu.column_name = 'tenant_id'
            AND tc.constraint_type = 'FOREIGN KEY'
        ) as has_fk_constraint
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c ON t.table_name = c.table_name 
        AND c.column_name = 'tenant_id'
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE 'drizzle_%'
      ORDER BY t.table_name;
    `);

    let hasErrors = false;
    let warningCount = 0;

    console.log('📋 Tenant Coverage Report:');
    console.log('='.repeat(80));

    for (const row of result.rows) {
      const { table_name, column_name, is_nullable, has_fk_constraint } = row;
      
      if (EXEMPT_TABLES.includes(table_name)) {
        console.log(`⚪ ${table_name.padEnd(25)} - EXEMPT (system table)`);
        continue;
      }

      if (!column_name) {
        // Missing tenant_id column entirely
        if (REQUIRED_TENANT_TABLES.includes(table_name)) {
          console.log(`❌ ${table_name.padEnd(25)} - MISSING tenant_id column (REQUIRED)`);
          hasErrors = true;
        } else {
          console.log(`⚠️  ${table_name.padEnd(25)} - MISSING tenant_id column (check if needed)`);
          warningCount++;
        }
      } else {
        // Has tenant_id column, check constraints
        let status = '✅';
        let issues = [];

        if (is_nullable === 'YES') {
          status = '⚠️ ';
          issues.push('nullable');
        }
        
        if (!has_fk_constraint) {
          status = '⚠️ ';
          issues.push('no FK');
        }

        const issueText = issues.length > 0 ? ` (${issues.join(', ')})` : '';
        console.log(`${status} ${table_name.padEnd(25)} - has tenant_id${issueText}`);
        
        if (issues.length > 0) {
          warningCount++;
        }
      }
    }

    // Check for orphaned data
    console.log('\n🔍 Checking for orphaned data...');
    
    for (const tableName of REQUIRED_TENANT_TABLES) {
      try {
        const orphanCheck = await client.query(`
          SELECT COUNT(*) as orphaned_count 
          FROM ${tableName} 
          WHERE tenant_id IS NULL
        `);
        
        const orphanedCount = parseInt(orphanCheck.rows[0].orphaned_count);
        if (orphanedCount > 0) {
          console.log(`❌ ${tableName}: ${orphanedCount} orphaned records found`);
          hasErrors = true;
        }
      } catch (error) {
        // Table might not exist or have tenant_id column
        continue;
      }
    }

    console.log('\n' + '='.repeat(80));
    
    if (hasErrors) {
      console.log('❌ VALIDATION FAILED: Critical tenant isolation issues found');
      console.log('   Fix these issues before deploying to production');
      process.exit(1);
    } else if (warningCount > 0) {
      console.log(`⚠️  VALIDATION PASSED with ${warningCount} warnings`);
      console.log('   Consider reviewing warnings for production readiness');
      process.exit(0);
    } else {
      console.log('✅ VALIDATION PASSED: All tables properly tenant-isolated');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  validateTenantCoverage();
}

module.exports = { validateTenantCoverage };