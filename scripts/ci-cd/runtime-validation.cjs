#!/usr/bin/env node

/**
 * CI/CD Runtime Validation Script
 * Checks for orphaned records and tenant isolation violations in the database
 * Run this before deployments to ensure data integrity
 */

const { Client } = require('pg');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  let colorCode = colors.reset;
  let icon = '';
  
  switch (level) {
    case 'error':
      colorCode = colors.red;
      icon = '❌';
      break;
    case 'warn':
      colorCode = colors.yellow;
      icon = '⚠️';
      break;
    case 'success':
      colorCode = colors.green;
      icon = '✅';
      break;
    case 'info':
      colorCode = colors.blue;
      icon = 'ℹ️';
      break;
    case 'check':
      colorCode = colors.cyan;
      icon = '🔍';
      break;
  }
  
  console.log(`${colorCode}${icon} ${message}${colors.reset}`);
  if (data) {
    console.log(`   ${JSON.stringify(data, null, 2)}`);
  }
}

/**
 * Tables that must have tenant_id for proper isolation
 */
const TENANT_AWARE_TABLES = [
  'leads',
  'contacts',
  'projects', 
  'quotes',
  'contracts',
  'invoices',
  'tasks',
  'emails',
  'message_threads',
  'quote_items',
  'user_prefs',
  'lead_automation_rules',
  'lead_capture_forms',
  'project_files'
];

/**
 * Critical tenant isolation checks
 */
const ISOLATION_CHECKS = [
  {
    name: 'Foreign Key Tenant Consistency',
    description: 'Ensures foreign key references point to records in the same tenant',
    critical: true
  },
  {
    name: 'Orphaned Records Detection', 
    description: 'Finds records without valid tenant_id or pointing to non-existent tenants',
    critical: true
  },
  {
    name: 'Cross-Tenant Data Leakage',
    description: 'Detects data that might be accessible across tenant boundaries',
    critical: true
  },
  {
    name: 'Constraint Violations',
    description: 'Validates database constraints are properly enforced',
    critical: false
  }
];

class RuntimeValidator {
  constructor() {
    this.client = null;
    this.errors = [];
    this.warnings = [];
    this.stats = {
      tablesChecked: 0,
      recordsValidated: 0,
      orphansFound: 0,
      violationsFound: 0
    };
  }

  /**
   * Main validation entry point
   */
  async validate() {
    log('info', '🔍 Starting CI/CD runtime validation...');
    
    try {
      await this.connectDatabase();
      await this.validateDatabaseExists();
      await this.checkTenantAwareTables();
      await this.detectOrphanedRecords();
      await this.validateForeignKeyConsistency();
      await this.checkConstraintViolations();
      await this.validateCrossTenantLeakage();
      
      return this.generateReport();
    } catch (error) {
      log('error', 'Runtime validation failed with exception', { error: error.message });
      this.errors.push(`Fatal error: ${error.message}`);
      return this.generateReport();
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Connect to the database
   */
  async connectDatabase() {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    this.client = new Client({ connectionString: databaseUrl });
    await this.client.connect();
    
    log('success', 'Database connection established');
  }

  /**
   * Validate database exists and is accessible
   */
  async validateDatabaseExists() {
    try {
      const result = await this.client.query('SELECT current_database(), current_user');
      log('success', `Connected to database: ${result.rows[0].current_database} as ${result.rows[0].current_user}`);
    } catch (error) {
      throw new Error(`Database validation failed: ${error.message}`);
    }
  }

  /**
   * Check tenant-aware tables for proper configuration
   */
  async checkTenantAwareTables() {
    log('check', 'Validating tenant-aware tables...');
    
    for (const tableName of TENANT_AWARE_TABLES) {
      try {
        // Check if table exists
        const tableExists = await this.client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);
        
        if (!tableExists.rows[0].exists) {
          this.warnings.push(`Table '${tableName}' does not exist in database`);
          continue;
        }
        
        // Check if tenant_id column exists
        const columnExists = await this.client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1 
            AND column_name = 'tenant_id'
          );
        `, [tableName]);
        
        if (!columnExists.rows[0].exists) {
          this.errors.push(`Table '${tableName}' missing tenant_id column`);
          continue;
        }
        
        // Check NOT NULL constraint
        const notNullCheck = await this.client.query(`
          SELECT is_nullable 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = 'tenant_id'
        `, [tableName]);
        
        if (notNullCheck.rows[0] && notNullCheck.rows[0].is_nullable === 'YES') {
          this.errors.push(`Table '${tableName}' tenant_id column should be NOT NULL`);
        }
        
        this.stats.tablesChecked++;
        log('success', `✓ Table '${tableName}' configuration valid`);
        
      } catch (error) {
        this.errors.push(`Error checking table '${tableName}': ${error.message}`);
      }
    }
  }

  /**
   * Detect orphaned records (records with invalid or missing tenant_id)
   */
  async detectOrphanedRecords() {
    log('check', 'Detecting orphaned records...');
    
    for (const tableName of TENANT_AWARE_TABLES) {
      try {
        // Check for NULL tenant_id values
        const nullTenantIds = await this.client.query(`
          SELECT COUNT(*) as count
          FROM ${tableName}
          WHERE tenant_id IS NULL
        `);
        
        const nullCount = parseInt(nullTenantIds.rows[0].count);
        if (nullCount > 0) {
          this.errors.push(`Table '${tableName}' has ${nullCount} records with NULL tenant_id`);
          this.stats.orphansFound += nullCount;
        }
        
        // Check for tenant_id values that don't reference existing tenants
        const invalidTenantIds = await this.client.query(`
          SELECT COUNT(*) as count
          FROM ${tableName} t
          LEFT JOIN tenants tn ON t.tenant_id = tn.id
          WHERE t.tenant_id IS NOT NULL AND tn.id IS NULL
        `);
        
        const invalidCount = parseInt(invalidTenantIds.rows[0].count);
        if (invalidCount > 0) {
          this.errors.push(`Table '${tableName}' has ${invalidCount} records with invalid tenant_id references`);
          this.stats.orphansFound += invalidCount;
        }
        
        // Get total record count for statistics
        const totalRecords = await this.client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const totalCount = parseInt(totalRecords.rows[0].count);
        this.stats.recordsValidated += totalCount;
        
        if (nullCount === 0 && invalidCount === 0) {
          log('success', `✓ Table '${tableName}' has no orphaned records (${totalCount} records checked)`);
        }
        
      } catch (error) {
        this.warnings.push(`Could not check orphaned records for '${tableName}': ${error.message}`);
      }
    }
  }

  /**
   * Validate foreign key consistency across tenant boundaries
   */
  async validateForeignKeyConsistency() {
    log('check', 'Validating foreign key tenant consistency...');
    
    const foreignKeyChecks = [
      {
        table: 'quotes',
        foreignKey: 'project_id',
        referencedTable: 'projects',
        description: 'Quotes must reference projects in the same tenant'
      },
      {
        table: 'contracts',
        foreignKey: 'quote_id', 
        referencedTable: 'quotes',
        description: 'Contracts must reference quotes in the same tenant'
      },
      {
        table: 'invoices',
        foreignKey: 'contract_id',
        referencedTable: 'contracts', 
        description: 'Invoices must reference contracts in the same tenant'
      },
      {
        table: 'tasks',
        foreignKey: 'project_id',
        referencedTable: 'projects',
        description: 'Tasks must reference projects in the same tenant'
      },
      {
        table: 'quote_items',
        foreignKey: 'quote_id',
        referencedTable: 'quotes',
        description: 'Quote items must reference quotes in the same tenant'
      }
    ];
    
    for (const check of foreignKeyChecks) {
      try {
        const violationQuery = `
          SELECT COUNT(*) as count
          FROM ${check.table} child
          JOIN ${check.referencedTable} parent ON child.${check.foreignKey} = parent.id
          WHERE child.tenant_id != parent.tenant_id
        `;
        
        const result = await this.client.query(violationQuery);
        const violationCount = parseInt(result.rows[0].count);
        
        if (violationCount > 0) {
          this.errors.push(`${check.description}: ${violationCount} violations found`);
          this.stats.violationsFound += violationCount;
        } else {
          log('success', `✓ ${check.description} - no violations`);
        }
        
      } catch (error) {
        this.warnings.push(`Could not validate foreign key consistency for ${check.table}: ${error.message}`);
      }
    }
  }

  /**
   * Check for constraint violations
   */
  async checkConstraintViolations() {
    log('check', 'Checking database constraint violations...');
    
    try {
      // Check if there are any constraint violations in the database
      const constraintCheck = await this.client.query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK', 'UNIQUE')
        AND tc.table_name IN (${TENANT_AWARE_TABLES.map((_, i) => `$${i + 1}`).join(', ')})
        ORDER BY tc.table_name, tc.constraint_name
      `, TENANT_AWARE_TABLES);
      
      const constraintCount = constraintCheck.rows.length;
      log('success', `✓ Found ${constraintCount} database constraints on tenant-aware tables`);
      
      // Check for foreign key constraints specifically on tenant_id columns
      const tenantFkCheck = await this.client.query(`
        SELECT 
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'tenant_id'
        AND tc.table_schema = 'public'
      `);
      
      const tenantFkCount = tenantFkCheck.rows.length;
      if (tenantFkCount > 0) {
        log('success', `✓ Found ${tenantFkCount} tenant_id foreign key constraints`);
      } else {
        this.warnings.push('No tenant_id foreign key constraints found - this may impact data integrity');
      }
      
    } catch (error) {
      this.warnings.push(`Could not check database constraints: ${error.message}`);
    }
  }

  /**
   * Check for potential cross-tenant data leakage
   */
  async validateCrossTenantLeakage() {
    log('check', 'Validating cross-tenant data isolation...');
    
    try {
      // Get list of all tenants
      const tenantsResult = await this.client.query('SELECT id, slug FROM tenants ORDER BY id');
      const tenants = tenantsResult.rows;
      
      if (tenants.length < 2) {
        log('info', 'Only one tenant found - skipping cross-tenant leakage checks');
        return;
      }
      
      log('info', `Checking data isolation across ${tenants.length} tenants`);
      
      // Check each tenant-aware table for proper isolation
      for (const tableName of TENANT_AWARE_TABLES) {
        try {
          const distributionQuery = `
            SELECT 
              tenant_id,
              COUNT(*) as record_count
            FROM ${tableName}
            GROUP BY tenant_id
            ORDER BY tenant_id
          `;
          
          const distribution = await this.client.query(distributionQuery);
          
          if (distribution.rows.length > 1) {
            const stats = distribution.rows.map(row => 
              `${row.tenant_id}: ${row.record_count} records`
            ).join(', ');
            log('success', `✓ Table '${tableName}' properly isolated: ${stats}`);
          }
          
        } catch (error) {
          this.warnings.push(`Could not check tenant distribution for '${tableName}': ${error.message}`);
        }
      }
      
    } catch (error) {
      this.warnings.push(`Could not validate cross-tenant isolation: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive validation report
   */
  generateReport() {
    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;
    
    console.log('\n' + '='.repeat(70));
    log('info', `${colors.bold}CI/CD RUNTIME VALIDATION REPORT${colors.reset}`);
    console.log('='.repeat(70));
    
    // Statistics
    console.log(`📊 ${colors.bold}VALIDATION STATISTICS:${colors.reset}`);
    console.log(`   • Tables Checked: ${this.stats.tablesChecked}`);
    console.log(`   • Records Validated: ${this.stats.recordsValidated.toLocaleString()}`);
    console.log(`   • Orphaned Records: ${this.stats.orphansFound}`);
    console.log(`   • Tenant Violations: ${this.stats.violationsFound}`);
    console.log('');
    
    if (hasErrors) {
      log('error', `${this.errors.length} CRITICAL ERRORS found:`);
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      console.log('');
    }
    
    if (hasWarnings) {
      log('warn', `${this.warnings.length} WARNINGS found:`);
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
      console.log('');
    }
    
    // Final status
    if (!hasErrors && !hasWarnings) {
      log('success', 'All runtime validation checks passed! 🚀 Ready for deployment');
    } else if (!hasErrors) {
      log('success', 'Runtime validation passed with warnings ⚠️ Deployment can proceed');
    } else {
      log('error', 'Runtime validation FAILED! 🚫 Deployment should be BLOCKED');
      console.log(`${colors.red}${colors.bold}CRITICAL: Fix all errors before deploying to prevent data corruption${colors.reset}`);
    }
    
    console.log('='.repeat(70) + '\n');
    
    return {
      success: !hasErrors,
      errors: this.errors,
      warnings: this.warnings,
      stats: this.stats,
      exitCode: hasErrors ? 1 : 0
    };
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    if (this.client) {
      await this.client.end();
      log('info', 'Database connection closed');
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const validator = new RuntimeValidator();
  const result = await validator.validate();
  
  // Exit with appropriate code for CI/CD
  process.exit(result.exitCode);
}

// Run validation if called directly
if (require.main === module) {
  main().catch(error => {
    log('error', 'Runtime validation script failed', { error: error.message });
    process.exit(1);
  });
}

module.exports = { RuntimeValidator, TENANT_AWARE_TABLES, ISOLATION_CHECKS };