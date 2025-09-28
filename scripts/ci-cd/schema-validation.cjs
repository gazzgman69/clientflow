#!/usr/bin/env node

/**
 * CI/CD Schema Validation Script
 * Validates that database schema changes maintain tenant isolation requirements
 * Run this before any database migrations in CI/CD pipeline
 */

const fs = require('fs');
const path = require('path');

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
 * List of tables that MUST have tenant_id for security
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
  'project_files',
  // Add new tenant-aware tables here
];

/**
 * Tables that should NOT have tenant_id (system tables)
 */
const SYSTEM_TABLES = [
  'tenants',
  'sessions',
  'users', // Users belong to tenants but have their own tenant relationship
  'message_templates', // Shared across tenants
  'quote_packages', // Shared package definitions
  'quote_addons', // Shared addon definitions
  'calendar_integrations', // Per-user, not per-tenant
  'events', // Per-user calendar events
  'calendar_sync_log', // System logs
  'sms_messages', // System-level messages (could be tenant-aware in future)
  'activities', // System activity logs (could be tenant-aware in future)
  'automations', // System automation configs (could be tenant-aware in future)
  'members' // Team membership (could be tenant-aware in future)
];

/**
 * Required database constraints for tenant isolation
 */
const REQUIRED_CONSTRAINTS = {
  tenantId: {
    notNull: true,
    foreignKey: 'tenants.id',
    index: true
  }
};

class SchemaValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.schema = null;
  }

  /**
   * Main validation entry point
   */
  async validate() {
    log('info', '🔍 Starting CI/CD schema validation...');
    
    try {
      await this.loadSchema();
      await this.validateTenantAwareTables();
      await this.validateSystemTables();
      await this.validateConstraints();
      await this.validateIndexes();
      await this.validateMigrationSafety();
      
      return this.generateReport();
    } catch (error) {
      log('error', 'Schema validation failed with exception', { error: error.message });
      this.errors.push(`Fatal error: ${error.message}`);
      return this.generateReport();
    }
  }

  /**
   * Load and parse the schema file
   */
  async loadSchema() {
    const schemaPath = path.join(__dirname, '../../shared/schema.ts');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    this.schema = schemaContent;
    
    log('success', 'Schema file loaded successfully');
  }

  /**
   * Validate that all tenant-aware tables have proper tenant_id configuration
   */
  async validateTenantAwareTables() {
    log('check', 'Validating tenant-aware tables...');
    
    for (const tableName of TENANT_AWARE_TABLES) {
      const tableMatch = this.schema.match(new RegExp(`export const ${tableName} = pgTable\\("${tableName}"[\\s\\S]*?\\}[\\s\\S]*?\\);`, 'g'));
      
      if (!tableMatch) {
        this.errors.push(`Table '${tableName}' not found in schema`);
        continue;
      }
      
      const tableDefinition = tableMatch[0];
      
      // Check for tenantId field
      if (!tableDefinition.includes('tenantId:')) {
        this.errors.push(`Table '${tableName}' missing tenantId field`);
        continue;
      }
      
      // Check for NOT NULL constraint
      if (!tableDefinition.includes('.notNull()')) {
        const tenantIdLine = tableDefinition.split('\n').find(line => line.includes('tenantId:'));
        if (!tenantIdLine || !tenantIdLine.includes('.notNull()')) {
          this.errors.push(`Table '${tableName}' tenantId field must be NOT NULL`);
        }
      }
      
      // Check for foreign key to tenants table
      if (!tableDefinition.includes('.references(() => tenants.id)')) {
        this.errors.push(`Table '${tableName}' tenantId must reference tenants.id`);
      }
      
      log('success', `✓ Table '${tableName}' tenant configuration valid`);
    }
  }

  /**
   * Validate that system tables don't have unexpected tenant_id fields
   */
  async validateSystemTables() {
    log('check', 'Validating system tables...');
    
    for (const tableName of SYSTEM_TABLES) {
      const tableMatch = this.schema.match(new RegExp(`export const ${tableName} = pgTable\\("${tableName}"[\\s\\S]*?\\}[\\s\\S]*?\\);`, 'g'));
      
      if (!tableMatch) {
        this.warnings.push(`System table '${tableName}' not found in schema (may be intentional)`);
        continue;
      }
      
      const tableDefinition = tableMatch[0];
      
      // Check if system table accidentally has tenantId
      if (tableDefinition.includes('tenantId:') && tableName !== 'users') {
        this.warnings.push(`System table '${tableName}' has tenantId field - verify this is intentional`);
      }
      
      log('success', `✓ System table '${tableName}' configuration reviewed`);
    }
  }

  /**
   * Validate database constraints and indexes
   */
  async validateConstraints() {
    log('check', 'Validating database constraints...');
    
    // Check for index definitions on tenant_id columns
    const indexMatches = this.schema.match(/},\s*\(table\)\s*=>\s*\({[\s\S]*?\}\)/g);
    
    if (!indexMatches) {
      this.warnings.push('No index definitions found in schema');
      return;
    }
    
    for (const indexBlock of indexMatches) {
      // Look for tenant_id indexes
      if (indexBlock.includes('tenantId')) {
        log('success', '✓ Found tenant_id indexes in schema');
      }
    }
  }

  /**
   * Validate indexes for performance
   */
  async validateIndexes() {
    log('check', 'Validating performance indexes...');
    
    // Check that tenant-aware tables have proper indexes
    for (const tableName of TENANT_AWARE_TABLES) {
      const tableMatch = this.schema.match(new RegExp(`export const ${tableName} = pgTable\\("${tableName}"[\\s\\S]*?\\}[\\s\\S]*?\\);`, 'g'));
      
      if (tableMatch) {
        const tableDefinition = tableMatch[0];
        
        // Look for index definition that includes tenantId
        if (tableDefinition.includes('tenantIdIdx:') || tableDefinition.includes('tenant_id_idx:')) {
          log('success', `✓ Table '${tableName}' has tenant performance index`);
        } else {
          this.warnings.push(`Table '${tableName}' should have tenant_id index for performance`);
        }
      }
    }
  }

  /**
   * Validate migration safety
   */
  async validateMigrationSafety() {
    log('check', 'Validating migration safety...');
    
    // Check for potentially dangerous schema changes
    const dangerousPatterns = [
      { pattern: /\.dropNotNull\(\)/, message: 'Dropping NOT NULL constraints can compromise tenant isolation' },
      { pattern: /\.alterColumn\(.*tenantId/, message: 'Altering tenantId columns requires careful review' },
      { pattern: /\.dropForeignKey\(.*tenantId/, message: 'Dropping tenant foreign keys compromises referential integrity' },
      { pattern: /\.dropIndex\(.*tenantId/, message: 'Dropping tenant indexes can impact performance' }
    ];
    
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(this.schema)) {
        this.warnings.push(`Potentially dangerous schema change detected: ${message}`);
      }
    }
    
    log('success', '✓ Migration safety checks completed');
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;
    
    console.log('\n' + '='.repeat(60));
    log('info', `${colors.bold}CI/CD SCHEMA VALIDATION REPORT${colors.reset}`);
    console.log('='.repeat(60));
    
    if (hasErrors) {
      log('error', `${this.errors.length} ERRORS found:`);
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
    
    if (!hasErrors && !hasWarnings) {
      log('success', 'All schema validation checks passed! ✨');
    } else if (!hasErrors) {
      log('success', 'Schema validation passed with warnings ⚠️');
    } else {
      log('error', 'Schema validation FAILED - deployment should be blocked! 🚫');
    }
    
    console.log('='.repeat(60) + '\n');
    
    return {
      success: !hasErrors,
      errors: this.errors,
      warnings: this.warnings,
      exitCode: hasErrors ? 1 : 0
    };
  }
}

/**
 * Main execution
 */
async function main() {
  const validator = new SchemaValidator();
  const result = await validator.validate();
  
  // Exit with appropriate code for CI/CD
  process.exit(result.exitCode);
}

// Run validation if called directly
if (require.main === module) {
  main().catch(error => {
    log('error', 'Validation script failed', { error: error.message });
    process.exit(1);
  });
}

module.exports = { SchemaValidator, TENANT_AWARE_TABLES, SYSTEM_TABLES };