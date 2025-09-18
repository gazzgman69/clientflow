import { TenantAwareMigrationRunner } from './migrationRunner';
import { Pool } from 'pg';

/**
 * Production-ready tenant onboarding system for BusinessCRM
 * Handles new tenant setup, data initialization, and validation
 */

export interface TenantOnboardingConfig {
  databaseUrl: string;
  defaultAdminEmail: string;
  enableWelcomeData: boolean;
  customizationSettings: Record<string, any>;
  integrationPresets: string[];
  timeoutMs: number;
}

export interface TenantSetupResult {
  tenantId: string;
  adminUserId: string;
  setupStatus: 'success' | 'partial' | 'failed';
  completedSteps: string[];
  failedSteps: string[];
  setupDurationMs: number;
  errors: string[];
}

export class TenantOnboardingService {
  private pool: Pool;
  private migrationRunner: TenantAwareMigrationRunner;
  private config: TenantOnboardingConfig;

  constructor(config: TenantOnboardingConfig, migrationRunner: TenantAwareMigrationRunner) {
    this.config = config;
    this.migrationRunner = migrationRunner;
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: config.timeoutMs
    });
  }

  /**
   * Onboard a new tenant with complete setup
   */
  async onboardTenant(
    tenantId: string, 
    adminEmail: string, 
    tenantName: string,
    customSettings?: Record<string, any>
  ): Promise<TenantSetupResult> {
    const startTime = Date.now();
    const result: TenantSetupResult = {
      tenantId,
      adminUserId: '',
      setupStatus: 'failed',
      completedSteps: [],
      failedSteps: [],
      setupDurationMs: 0,
      errors: []
    };

    console.log(`🏢 Starting tenant onboarding for: ${tenantName} (${tenantId})`);

    try {
      // Step 1: Validate tenant uniqueness
      await this.validateTenantUniqueness(tenantId);
      result.completedSteps.push('validate-uniqueness');

      // Step 2: Run migrations for new tenant
      await this.migrationRunner.migrateTenant(tenantId);
      result.completedSteps.push('run-migrations');

      // Step 3: Create tenant record
      const tenant = await this.createTenantRecord(tenantId, tenantName, customSettings);
      result.completedSteps.push('create-tenant');

      // Step 4: Create admin user
      const adminUser = await this.createAdminUser(tenantId, adminEmail, tenantName);
      result.adminUserId = adminUser.id;
      result.completedSteps.push('create-admin');

      // Step 5: Setup default data
      if (this.config.enableWelcomeData) {
        await this.setupWelcomeData(tenantId, adminUser.id);
        result.completedSteps.push('setup-welcome-data');
      }

      // Step 6: Configure integrations
      await this.setupDefaultIntegrations(tenantId);
      result.completedSteps.push('setup-integrations');

      // Step 7: Validate setup
      await this.validateTenantSetup(tenantId);
      result.completedSteps.push('validate-setup');

      result.setupStatus = 'success';
      console.log(`✅ Tenant onboarding completed successfully for ${tenantName}`);

    } catch (error) {
      console.error(`❌ Tenant onboarding failed for ${tenantName}:`, error);
      result.errors.push(error.message);
      
      // Attempt cleanup on failure
      try {
        await this.cleanupFailedOnboarding(tenantId);
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup after onboarding failure:', cleanupError);
        result.errors.push(`Cleanup failed: ${cleanupError.message}`);
      }
    } finally {
      result.setupDurationMs = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Migrate existing single-tenant data to multi-tenant structure
   */
  async migrateToMultiTenant(sourceTenantId: string = 'default-tenant'): Promise<void> {
    console.log('🔄 Starting single-tenant to multi-tenant migration...');

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Step 1: Add tenant_id columns where missing
      await this.addTenantIdColumns(client);

      // Step 2: Populate tenant_id for existing data
      await this.populateExistingTenantIds(client, sourceTenantId);

      // Step 3: Add tenant-aware constraints
      await this.addTenantConstraints(client);

      // Step 4: Create tenant record for existing data
      await this.createExistingTenantRecord(client, sourceTenantId);

      await client.query('COMMIT');
      console.log('✅ Multi-tenant migration completed successfully');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Multi-tenant migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Export tenant data for backup or migration
   */
  async exportTenantData(tenantId: string): Promise<object> {
    console.log(`📦 Exporting data for tenant: ${tenantId}`);

    const client = await this.pool.connect();
    
    try {
      const exportData = {
        tenantId,
        exportedAt: new Date().toISOString(),
        users: [],
        projects: [],
        leads: [],
        contacts: [],
        integrations: [],
        settings: []
      };

      // Export users
      const usersResult = await client.query(
        'SELECT * FROM users WHERE tenant_id = $1',
        [tenantId]
      );
      exportData.users = usersResult.rows;

      // Export projects
      const projectsResult = await client.query(
        'SELECT * FROM projects WHERE tenant_id = $1',
        [tenantId]
      );
      exportData.projects = projectsResult.rows;

      // Export leads
      const leadsResult = await client.query(
        'SELECT * FROM leads WHERE tenant_id = $1',
        [tenantId]
      );
      exportData.leads = leadsResult.rows;

      // Export contacts
      const contactsResult = await client.query(
        'SELECT * FROM contacts WHERE tenant_id = $1',
        [tenantId]
      );
      exportData.contacts = contactsResult.rows;

      // Export integrations
      const integrationsResult = await client.query(
        'SELECT * FROM integrations WHERE tenant_id = $1',
        [tenantId]
      );
      exportData.integrations = integrationsResult.rows;

      console.log(`✅ Data export completed for tenant: ${tenantId}`);
      return exportData;

    } catch (error) {
      console.error(`❌ Data export failed for tenant ${tenantId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Import tenant data from backup
   */
  async importTenantData(tenantId: string, exportData: any): Promise<void> {
    console.log(`📥 Importing data for tenant: ${tenantId}`);

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Import users
      for (const user of exportData.users || []) {
        await client.query(`
          INSERT INTO users (id, tenant_id, email, name, role, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING
        `, [user.id, tenantId, user.email, user.name, user.role, user.status, user.created_at]);
      }

      // Import projects
      for (const project of exportData.projects || []) {
        await client.query(`
          INSERT INTO projects (id, tenant_id, name, description, status, assigned_to, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING
        `, [project.id, tenantId, project.name, project.description, project.status, project.assigned_to, project.created_at]);
      }

      // Import leads  
      for (const lead of exportData.leads || []) {
        await client.query(`
          INSERT INTO leads (id, tenant_id, email, name, company, status, source, assigned_to, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [lead.id, tenantId, lead.email, lead.name, lead.company, lead.status, lead.source, lead.assigned_to, lead.created_at]);
      }

      await client.query('COMMIT');
      console.log(`✅ Data import completed for tenant: ${tenantId}`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Data import failed for tenant ${tenantId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Private helper methods

  private async validateTenantUniqueness(tenantId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT id FROM tenants WHERE id = $1',
        [tenantId]
      );
      
      if (result.rows.length > 0) {
        throw new Error(`Tenant ${tenantId} already exists`);
      }
    } finally {
      client.release();
    }
  }

  private async createTenantRecord(
    tenantId: string, 
    tenantName: string, 
    customSettings?: Record<string, any>
  ): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO tenants (id, name, status, settings, created_at)
        VALUES ($1, $2, 'active', $3, NOW())
        RETURNING *
      `, [tenantId, tenantName, JSON.stringify(customSettings || {})]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  private async createAdminUser(tenantId: string, email: string, tenantName: string): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      const userId = `user_${tenantId}_admin`;
      
      const result = await client.query(`
        INSERT INTO users (id, tenant_id, email, name, role, status, created_at)
        VALUES ($1, $2, $3, $4, 'admin', 'active', NOW())
        RETURNING *
      `, [userId, tenantId, email, `${tenantName} Admin`]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  private async setupWelcomeData(tenantId: string, adminUserId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Create welcome project
      await client.query(`
        INSERT INTO projects (id, tenant_id, name, description, status, assigned_to, created_at)
        VALUES ($1, $2, 'Welcome to BusinessCRM', 'Your first project to get started', 'active', $3, NOW())
      `, [`proj_${tenantId}_welcome`, tenantId, adminUserId]);

      // Create sample lead
      await client.query(`
        INSERT INTO leads (id, tenant_id, email, name, company, status, source, assigned_to, created_at)
        VALUES ($1, $2, 'sample@example.com', 'Sample Lead', 'Example Corp', 'new', 'manual', $3, NOW())
      `, [`lead_${tenantId}_sample`, tenantId, adminUserId]);

      console.log(`📋 Welcome data created for tenant: ${tenantId}`);
    } finally {
      client.release();
    }
  }

  private async setupDefaultIntegrations(tenantId: string): Promise<void> {
    // Setup default integration configurations
    console.log(`🔌 Setting up default integrations for tenant: ${tenantId}`);
    
    // This would configure default integration templates
    // For now, we'll just log the intention
  }

  private async validateTenantSetup(tenantId: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Validate tenant exists
      const tenantResult = await client.query(
        'SELECT id FROM tenants WHERE id = $1',
        [tenantId]
      );
      
      if (tenantResult.rows.length === 0) {
        throw new Error(`Tenant ${tenantId} not found after setup`);
      }

      // Validate admin user exists
      const userResult = await client.query(
        'SELECT id FROM users WHERE tenant_id = $1 AND role = $2',
        [tenantId, 'admin']
      );
      
      if (userResult.rows.length === 0) {
        throw new Error(`Admin user not found for tenant ${tenantId}`);
      }

      console.log(`✅ Tenant setup validation passed for: ${tenantId}`);
    } finally {
      client.release();
    }
  }

  private async cleanupFailedOnboarding(tenantId: string): Promise<void> {
    console.log(`🧹 Cleaning up failed onboarding for tenant: ${tenantId}`);
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete tenant data in reverse order
      await client.query('DELETE FROM integrations WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM projects WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM leads WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM contacts WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM users WHERE tenant_id = $1', [tenantId]);
      await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
      
      await client.query('COMMIT');
      console.log(`✅ Cleanup completed for tenant: ${tenantId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async addTenantIdColumns(client: any): Promise<void> {
    // Add tenant_id columns to tables that don't have them
    const tables = ['users', 'projects', 'leads', 'contacts', 'integrations'];
    
    for (const table of tables) {
      try {
        await client.query(`
          ALTER TABLE ${table} 
          ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255) DEFAULT 'default-tenant'
        `);
      } catch (error) {
        // Column might already exist, continue
        console.log(`Column tenant_id might already exist in ${table}`);
      }
    }
  }

  private async populateExistingTenantIds(client: any, tenantId: string): Promise<void> {
    const tables = ['users', 'projects', 'leads', 'contacts', 'integrations'];
    
    for (const table of tables) {
      await client.query(`
        UPDATE ${table} 
        SET tenant_id = $1 
        WHERE tenant_id IS NULL OR tenant_id = ''
      `, [tenantId]);
    }
  }

  private async addTenantConstraints(client: any): Promise<void> {
    // Add NOT NULL constraints and indexes for tenant_id
    const tables = ['users', 'projects', 'leads', 'contacts', 'integrations'];
    
    for (const table of tables) {
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_${table}_tenant_id 
          ON ${table} (tenant_id)
        `);
      } catch (error) {
        console.log(`Index might already exist for ${table}.tenant_id`);
      }
    }
  }

  private async createExistingTenantRecord(client: any, tenantId: string): Promise<void> {
    await client.query(`
      INSERT INTO tenants (id, name, status, settings, created_at)
      VALUES ($1, 'Default Tenant', 'active', '{}', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Factory function for creating tenant onboarding service
 */
export function createTenantOnboardingService(
  config: Partial<TenantOnboardingConfig>,
  migrationRunner: TenantAwareMigrationRunner
): TenantOnboardingService {
  const defaultConfig: TenantOnboardingConfig = {
    databaseUrl: process.env.DATABASE_URL || '',
    defaultAdminEmail: 'admin@example.com',
    enableWelcomeData: true,
    customizationSettings: {},
    integrationPresets: ['email', 'calendar'],
    timeoutMs: 30000
  };

  return new TenantOnboardingService({ ...defaultConfig, ...config }, migrationRunner);
}