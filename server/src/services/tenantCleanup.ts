/**
 * Tenant Database Cleanup Service
 * 
 * This service provides comprehensive cleanup of tenant demo data to ensure
 * new tenants start with completely empty databases. It respects the security
 * requirements that all demo data must be explicitly controlled via environment
 * flags and provide safe cleanup operations for existing tenants.
 */

import { storage } from '../../storage';

interface CleanupResult {
  success: boolean;
  tenantId: string;
  tablesProcessed: string[];
  recordsRemoved: number;
  errors: string[];
  timestamp: string;
}

interface CleanupOptions {
  tenantId: string;
  dryRun?: boolean;
  skipTables?: string[];
  targetTables?: string[];
}

/**
 * Hard environment gate to prevent accidental cleanup operations
 * This cannot be bypassed via config overrides for security
 */
function isCleanupAllowed(): boolean {
  const isAllowed = process.env.RUN_TENANT_CLEANUP === 'true';
  
  if (!isAllowed) {
    console.log('🚫 SECURITY: Tenant cleanup blocked - RUN_TENANT_CLEANUP environment flag not set to "true"');
  } else {
    console.log('⚠️  SECURITY: Tenant cleanup operations enabled via RUN_TENANT_CLEANUP=true environment flag');
  }
  
  return isAllowed;
}

/**
 * Core tables that contain tenant-scoped demo data
 * These are the primary tables that need cleanup for fresh tenant onboarding
 */
const TENANT_DATA_TABLES = [
  'leads',
  'contacts', 
  'projects',
  'quotes',
  'contracts',
  'invoices',
  'tasks',
  'emails',
  'activities',
  'automations'
] as const;

/**
 * System tables that should never be cleaned up
 * These contain essential system data and user accounts
 */
const PROTECTED_TABLES = [
  'users',
  'tenants', 
  'sessions',
  'standardQuestions',
  'messageTemplates'
] as const;

export class TenantCleanupService {
  /**
   * Clean up all demo data for a specific tenant
   * This removes all tenant-scoped records while preserving system data
   */
  async cleanupTenant(options: CleanupOptions): Promise<CleanupResult> {
    const startTime = new Date().toISOString();
    const result: CleanupResult = {
      success: false,
      tenantId: options.tenantId,
      tablesProcessed: [],
      recordsRemoved: 0,
      errors: [],
      timestamp: startTime
    };

    try {
      // SECURITY: Check environment gate first
      if (!isCleanupAllowed()) {
        throw new Error('🚫 SECURITY: Tenant cleanup operations are disabled. Set RUN_TENANT_CLEANUP=true to enable.');
      }

      // Validate tenant exists
      const tenant = await storage.getTenantById?.(options.tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${options.tenantId} not found`);
      }

      console.log(`🧹 Starting tenant cleanup for: ${options.tenantId}`);
      console.log(`🔍 Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE CLEANUP'}`);

      // Determine which tables to process
      const tablesToClean = this.determineTargetTables(options);
      
      // Process each table
      for (const tableName of tablesToClean) {
        try {
          const recordsRemoved = await this.cleanupTable(
            tableName, 
            options.tenantId, 
            options.dryRun
          );
          
          result.tablesProcessed.push(tableName);
          result.recordsRemoved += recordsRemoved;
          
          console.log(`✅ ${tableName}: ${recordsRemoved} records ${options.dryRun ? 'would be removed' : 'removed'}`);
        } catch (tableError: any) {
          const errorMsg = `Failed to cleanup table ${tableName}: ${tableError.message}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      result.success = result.errors.length === 0;
      
      const summary = `🧹 Tenant cleanup ${result.success ? 'completed' : 'completed with errors'}: ${result.recordsRemoved} records ${options.dryRun ? 'would be removed' : 'removed'} from ${result.tablesProcessed.length} tables`;
      console.log(summary);
      
      if (result.errors.length > 0) {
        console.error(`⚠️  Cleanup errors: ${result.errors.join(', ')}`);
      }

    } catch (error: any) {
      result.errors.push(error.message);
      console.error(`❌ Tenant cleanup failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Clean up a specific table for a tenant
   */
  private async cleanupTable(tableName: string, tenantId: string, dryRun: boolean = false): Promise<number> {
    // Validate table name for security
    if (!TENANT_DATA_TABLES.includes(tableName as any)) {
      throw new Error(`🚫 SECURITY: Table '${tableName}' is not in the approved cleanup list`);
    }

    if (PROTECTED_TABLES.includes(tableName as any)) {
      throw new Error(`🚫 SECURITY: Table '${tableName}' is protected and cannot be cleaned up`);
    }

    try {
      // Get current record count for this tenant
      const countQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE tenant_id = $1`;
      const countResult = await storage.db?.execute({ sql: countQuery, args: [tenantId] });
      const recordCount = countResult?.rows?.[0]?.count as number || 0;

      if (recordCount === 0) {
        return 0; // No records to clean
      }

      if (dryRun) {
        console.log(`🔍 DRY RUN: Would remove ${recordCount} records from ${tableName} for tenant ${tenantId}`);
        return recordCount;
      }

      // Perform the actual cleanup
      const deleteQuery = `DELETE FROM ${tableName} WHERE tenant_id = $1`;
      await storage.db?.execute({ sql: deleteQuery, args: [tenantId] });
      
      console.log(`🧹 LIVE: Removed ${recordCount} records from ${tableName} for tenant ${tenantId}`);
      return recordCount;

    } catch (error: any) {
      throw new Error(`Database operation failed for table ${tableName}: ${error.message}`);
    }
  }

  /**
   * Determine which tables to target for cleanup based on options
   */
  private determineTargetTables(options: CleanupOptions): string[] {
    let targetTables = [...TENANT_DATA_TABLES];

    // Apply skipTables filter
    if (options.skipTables && options.skipTables.length > 0) {
      targetTables = targetTables.filter(table => !options.skipTables!.includes(table));
      console.log(`🔍 Skipping tables: ${options.skipTables.join(', ')}`);
    }

    // Apply targetTables filter (if specified, only clean these tables)
    if (options.targetTables && options.targetTables.length > 0) {
      targetTables = targetTables.filter(table => options.targetTables!.includes(table));
      console.log(`🎯 Targeting specific tables: ${options.targetTables.join(', ')}`);
    }

    return targetTables;
  }

  /**
   * Get cleanup status and statistics for a tenant
   */
  async getCleanupStatus(tenantId: string): Promise<{
    tenantId: string;
    hasData: boolean;
    tableStats: Record<string, number>;
    totalRecords: number;
  }> {
    if (!isCleanupAllowed()) {
      throw new Error('🚫 SECURITY: Cleanup operations are disabled');
    }

    const tableStats: Record<string, number> = {};
    let totalRecords = 0;

    for (const tableName of TENANT_DATA_TABLES) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE tenant_id = $1`;
        const result = await storage.db?.execute({ sql: countQuery, args: [tenantId] });
        const count = result?.rows?.[0]?.count as number || 0;
        
        tableStats[tableName] = count;
        totalRecords += count;
      } catch (error: any) {
        console.warn(`⚠️  Could not get count for table ${tableName}: ${error.message}`);
        tableStats[tableName] = -1; // Indicate error
      }
    }

    return {
      tenantId,
      hasData: totalRecords > 0,
      tableStats,
      totalRecords
    };
  }

  /**
   * Check if cleanup is enabled via environment variable
   */
  static isEnabled(): boolean {
    return process.env.RUN_TENANT_CLEANUP === 'true';
  }
}

// Export singleton instance
export const tenantCleanupService = new TenantCleanupService();