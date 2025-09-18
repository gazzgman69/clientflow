/**
 * Multi-tenant data migration system for BusinessCRM
 * Production-ready migration and tenant onboarding infrastructure
 */

export { 
  TenantAwareMigrationRunner,
  createMigrationRunner,
  type MigrationConfig,
  type Migration,
  type TenantMigrationStatus
} from './migrationRunner';

export {
  TenantOnboardingService,
  createTenantOnboardingService,
  type TenantOnboardingConfig,
  type TenantSetupResult
} from './tenantOnboarding';

// Migration utilities and CLI commands
import { createMigrationRunner } from './migrationRunner';
import { createTenantOnboardingService } from './tenantOnboarding';

/**
 * Initialize complete migration system
 */
export async function initializeMigrationSystem(): Promise<{
  migrationRunner: any;
  onboardingService: any;
}> {
  console.log('🚀 Initializing BusinessCRM Migration System...');
  
  const migrationRunner = createMigrationRunner({
    databaseUrl: process.env.DATABASE_URL,
    tenantMode: process.env.TENANT_MODE as 'single' | 'multi' || 'single',
    enableRollback: process.env.NODE_ENV !== 'production',
    backupBeforeMigration: true
  });

  await migrationRunner.initialize();

  const onboardingService = createTenantOnboardingService({
    databaseUrl: process.env.DATABASE_URL,
    enableWelcomeData: process.env.NODE_ENV === 'development',
    defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@businesscrm.com'
  }, migrationRunner);

  console.log('✅ Migration system initialized successfully');
  
  return {
    migrationRunner,
    onboardingService
  };
}

/**
 * CLI command: Run pending migrations
 */
export async function runMigrations(): Promise<void> {
  const { migrationRunner } = await initializeMigrationSystem();
  
  try {
    await migrationRunner.runPendingMigrations();
    console.log('🎉 All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationRunner.destroy();
  }
}

/**
 * CLI command: Onboard new tenant
 */
export async function onboardTenant(
  tenantId: string,
  adminEmail: string,
  tenantName: string
): Promise<void> {
  const { onboardingService } = await initializeMigrationSystem();
  
  try {
    const result = await onboardingService.onboardTenant(tenantId, adminEmail, tenantName);
    
    if (result.setupStatus === 'success') {
      console.log(`🎉 Tenant ${tenantName} onboarded successfully!`);
      console.log(`👤 Admin User ID: ${result.adminUserId}`);
      console.log(`⏱️  Setup Duration: ${result.setupDurationMs}ms`);
    } else {
      console.error(`❌ Tenant onboarding failed for ${tenantName}`);
      console.error('Failed steps:', result.failedSteps);
      console.error('Errors:', result.errors);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Onboarding failed:', error);
    process.exit(1);
  } finally {
    await onboardingService.destroy();
  }
}

/**
 * CLI command: Convert to multi-tenant
 */
export async function convertToMultiTenant(): Promise<void> {
  const { onboardingService } = await initializeMigrationSystem();
  
  try {
    await onboardingService.migrateToMultiTenant();
    console.log('🎉 Successfully converted to multi-tenant architecture');
  } catch (error) {
    console.error('❌ Multi-tenant conversion failed:', error);
    process.exit(1);
  } finally {
    await onboardingService.destroy();
  }
}

/**
 * CLI command: Export tenant data
 */
export async function exportTenant(tenantId: string, outputPath?: string): Promise<void> {
  const { onboardingService } = await initializeMigrationSystem();
  
  try {
    const exportData = await onboardingService.exportTenantData(tenantId);
    
    const outputFile = outputPath || `./tenant_export_${tenantId}_${Date.now()}.json`;
    
    // In production, this would write to file
    console.log(`📦 Export data prepared for tenant: ${tenantId}`);
    console.log(`📁 Would save to: ${outputFile}`);
    console.log(`📊 Export contains: ${Object.keys(exportData).length} data categories`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    await onboardingService.destroy();
  }
}

/**
 * CLI command: Get migration status
 */
export async function getMigrationStatus(): Promise<void> {
  const { migrationRunner } = await initializeMigrationSystem();
  
  try {
    const status = await migrationRunner.getMigrationStatus();
    
    console.log('📊 Migration Status Report:');
    console.log(`🌍 Global Migrations: ${status.global.length}`);
    console.log(`🏢 Tenants: ${Object.keys(status.tenants).length}`);
    
    for (const [tenantId, migrations] of Object.entries(status.tenants)) {
      const completed = migrations.filter(m => m.status === 'completed').length;
      const failed = migrations.filter(m => m.status === 'failed').length;
      console.log(`  📍 ${tenantId}: ${completed} completed, ${failed} failed`);
    }
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
    process.exit(1);
  } finally {
    await migrationRunner.destroy();
  }
}

// Example migration file template
export const migrationTemplate = `
-- Migration: {{version}}_{{description}}
-- Created: {{timestamp}}
-- Type: {{type}} (global|tenant-specific)

-- Up Migration
{{up_sql}}

-- Down Migration (for rollback)
{{down_sql}}
`;

// Production deployment checklist
export const deploymentChecklist = [
  '✅ Database backup created',
  '✅ Migration files validated',
  '✅ Rollback plan prepared', 
  '✅ Monitoring alerts configured',
  '✅ Performance impact assessed',
  '✅ Security review completed',
  '✅ Tenant isolation verified',
  '✅ Data integrity checks passed'
];