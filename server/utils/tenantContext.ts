import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Database tenant context utilities for Row Level Security (RLS)
 * Sets PostgreSQL session variables to enforce tenant isolation at the database level
 */

/**
 * Set the current tenant context for the database session
 * This must be called before any database operations to ensure RLS policies work correctly
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('Invalid tenant ID for database context');
  }

  try {
    // Set the tenant context for RLS policies
    await db.execute(sql.raw(`SET LOCAL app.current_tenant_id = '${tenantId.replace(/'/g, "''")}'`));
  } catch (error) {
    console.error('Failed to set tenant context in database:', error);
    throw new Error('Failed to set tenant context');
  }
}

/**
 * Clear the tenant context (useful for cleanup or system operations)
 */
export async function clearTenantContext(): Promise<void> {
  try {
    await db.execute(sql.raw(`SET LOCAL app.current_tenant_id = ''`));
  } catch (error) {
    console.error('Failed to clear tenant context:', error);
    // Don't throw - this is cleanup
  }
}

/**
 * Get the current tenant context from the database session
 */
export async function getCurrentTenantContext(): Promise<string | null> {
  try {
    const result = await db.execute(sql.raw(`SELECT current_setting('app.current_tenant_id', true) as tenant_id`));
    const tenantId = result.rows[0]?.tenant_id as string;
    return tenantId && tenantId !== '' ? tenantId : null;
  } catch (error) {
    console.error('Failed to get current tenant context:', error);
    return null;
  }
}

/**
 * Middleware wrapper that ensures tenant context is set for database operations
 * This is a higher-order function that wraps database operations with tenant context
 */
export function withTenantContext<T extends any[], R>(
  tenantId: string,
  operation: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    await setTenantContext(tenantId);
    try {
      return await operation(...args);
    } finally {
      // Note: LOCAL variables are automatically cleared at transaction end
      // but we can explicitly clear for good measure in long-running operations
    }
  };
}

/**
 * Execute a database operation with tenant context
 * Automatically sets and cleans up tenant context
 */
export async function executWithTenantContext<T>(
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  await setTenantContext(tenantId);
  try {
    return await operation();
  } finally {
    // LOCAL variables are automatically cleared at transaction end
    // No explicit cleanup needed for LOCAL variables
  }
}