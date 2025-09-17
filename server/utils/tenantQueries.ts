import { eq, and, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Utility functions for building tenant-aware database queries
 * Ensures proper data isolation between tenants
 */

/**
 * Creates a WHERE condition that filters by tenant_id
 * @param tenantIdColumn - The tenant_id column from the table
 * @param tenantId - The tenant ID to filter by
 */
export function withTenant(tenantIdColumn: PgColumn, tenantId: string): SQL {
  return eq(tenantIdColumn, tenantId);
}

/**
 * Combines existing WHERE conditions with tenant filtering
 * @param tenantIdColumn - The tenant_id column from the table  
 * @param tenantId - The tenant ID to filter by
 * @param additionalConditions - Additional WHERE conditions to combine
 */
export function withTenantAnd(
  tenantIdColumn: PgColumn, 
  tenantId: string, 
  ...additionalConditions: SQL[]
): SQL {
  return and(eq(tenantIdColumn, tenantId), ...additionalConditions)!;
}

/**
 * Helper for creating tenant-scoped insert data
 * Automatically adds tenant_id to the insert object
 */
export function withTenantData<T extends Record<string, any>>(
  data: T, 
  tenantId: string
): T & { tenantId: string } {
  return {
    ...data,
    tenantId
  };
}

/**
 * Validates that all records belong to the specified tenant
 * Useful for bulk operations or security checks
 */
export function validateTenantOwnership<T extends { tenantId: string | null }>(
  records: T[], 
  expectedTenantId: string
): boolean {
  return records.every(record => record.tenantId === expectedTenantId);
}

/**
 * Filters records to only include those belonging to the tenant
 * Useful for additional security filtering after database queries
 */
export function filterByTenant<T extends { tenantId: string | null }>(
  records: T[], 
  tenantId: string
): T[] {
  return records.filter(record => record.tenantId === tenantId);
}

/**
 * Tenant-aware query builder helpers
 * These provide a consistent API for common query patterns
 */
export const TenantQueryBuilder = {
  /**
   * Build a simple tenant-scoped SELECT query
   */
  select: (tenantIdColumn: PgColumn, tenantId: string) => ({
    where: withTenant(tenantIdColumn, tenantId)
  }),

  /**
   * Build a tenant-scoped SELECT with additional conditions
   */
  selectWhere: (
    tenantIdColumn: PgColumn, 
    tenantId: string, 
    ...conditions: SQL[]
  ) => ({
    where: withTenantAnd(tenantIdColumn, tenantId, ...conditions)
  }),

  /**
   * Build tenant-scoped UPDATE query
   */
  update: (tenantIdColumn: PgColumn, tenantId: string) => ({
    where: withTenant(tenantIdColumn, tenantId)
  }),

  /**
   * Build tenant-scoped DELETE query  
   */
  delete: (tenantIdColumn: PgColumn, tenantId: string) => ({
    where: withTenant(tenantIdColumn, tenantId)
  })
};

/**
 * Constants for tenant isolation
 */
export const TENANT_ISOLATION = {
  // Special tenant ID for system-wide operations (use carefully)
  SYSTEM_TENANT: 'system',
  
  // Default tenant for development/single-tenant mode
  DEFAULT_TENANT: 'default-tenant'
} as const;