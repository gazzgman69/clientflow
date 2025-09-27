#!/usr/bin/env tsx

/**
 * Repair Orphan Calendar Events Script
 * 
 * Handles historical events with tenant_id=NULL by either quarantining or deleting them.
 * This script is idempotent and safe to rerun multiple times.
 * 
 * Environment Variables:
 * - CAL_REPAIR_DELETE_ORPHANS=true: Hard-delete orphan events (default: false, quarantine)
 * - CAL_ENFORCE_NOT_NULL_TENANT=true: Add NOT NULL constraint after repair (default: false)
 * 
 * Usage:
 *   tsx scripts/repairOrphanCalendarEvents.ts
 * 
 * Or via npm:
 *   npm run repair:orphan-events
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

interface RepairStats {
  totalOrphanEvents: number;
  processedEvents: number;
  errors: number;
  action: 'quarantine' | 'delete';
}

async function addOrphanedColumnIfNotExists(): Promise<void> {
  console.log('🔧 Checking if is_orphaned column exists...');
  
  try {
    // Check if column exists
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name = 'is_orphaned'
    `);
    
    if (columnCheck.length === 0) {
      console.log('➕ Adding is_orphaned column to events table...');
      await db.execute(sql`
        ALTER TABLE events 
        ADD COLUMN is_orphaned BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Successfully added is_orphaned column');
    } else {
      console.log('✅ is_orphaned column already exists');
    }
  } catch (error) {
    console.error('❌ Error adding is_orphaned column:', error);
    throw error;
  }
}

async function getOrphanEventStats(): Promise<{ count: number; tenantBreakdown: Record<string, number> }> {
  console.log('📊 Analyzing orphan events...');
  
  // Get total count of orphan events
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM events 
    WHERE tenant_id IS NULL 
    AND (is_orphaned IS NULL OR is_orphaned = FALSE)
  `);
  
  const count = Number(totalResult[0]?.count || 0);
  
  // For security, we don't show actual tenant IDs, just counts
  const tenantBreakdown: Record<string, number> = {
    'orphaned_events': count
  };
  
  return { count, tenantBreakdown };
}

async function quarantineOrphanEvents(): Promise<RepairStats> {
  console.log('🔒 Quarantining orphan events (setting is_orphaned=true)...');
  
  const stats: RepairStats = {
    totalOrphanEvents: 0,
    processedEvents: 0,
    errors: 0,
    action: 'quarantine'
  };
  
  try {
    // Get initial count
    const initialStats = await getOrphanEventStats();
    stats.totalOrphanEvents = initialStats.count;
    
    if (stats.totalOrphanEvents === 0) {
      console.log('✅ No orphan events found to quarantine');
      return stats;
    }
    
    console.log(`🔍 Found ${stats.totalOrphanEvents} orphan events to quarantine`);
    
    // Quarantine orphan events by setting is_orphaned=true
    const updateResult = await db.execute(sql`
      UPDATE events 
      SET is_orphaned = TRUE 
      WHERE tenant_id IS NULL 
      AND (is_orphaned IS NULL OR is_orphaned = FALSE)
    `);
    
    stats.processedEvents = Number(updateResult.rowCount || 0);
    
    console.log(`✅ Successfully quarantined ${stats.processedEvents} orphan events`);
    
  } catch (error) {
    console.error('❌ Error quarantining orphan events:', error);
    stats.errors++;
    throw error;
  }
  
  return stats;
}

async function deleteOrphanEvents(): Promise<RepairStats> {
  console.log('🗑️ Hard-deleting orphan events...');
  
  const stats: RepairStats = {
    totalOrphanEvents: 0,
    processedEvents: 0,
    errors: 0,
    action: 'delete'
  };
  
  try {
    // Get initial count
    const initialStats = await getOrphanEventStats();
    stats.totalOrphanEvents = initialStats.count;
    
    if (stats.totalOrphanEvents === 0) {
      console.log('✅ No orphan events found to delete');
      return stats;
    }
    
    console.log(`🔍 Found ${stats.totalOrphanEvents} orphan events to delete`);
    
    // Delete orphan events
    const deleteResult = await db.execute(sql`
      DELETE FROM events 
      WHERE tenant_id IS NULL
    `);
    
    stats.processedEvents = Number(deleteResult.rowCount || 0);
    
    console.log(`✅ Successfully deleted ${stats.processedEvents} orphan events`);
    
  } catch (error) {
    console.error('❌ Error deleting orphan events:', error);
    stats.errors++;
    throw error;
  }
  
  return stats;
}

async function enforceNotNullConstraint(): Promise<void> {
  console.log('🔒 Adding NOT NULL constraint to tenant_id column...');
  
  try {
    // Check if constraint already exists
    const constraintCheck = await db.execute(sql`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name = 'tenant_id'
    `);
    
    const isNullable = constraintCheck[0]?.is_nullable === 'YES';
    
    if (isNullable) {
      // First verify no orphan events remain
      const orphanCheck = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE tenant_id IS NULL
      `);
      
      const orphanCount = Number(orphanCheck[0]?.count || 0);
      
      if (orphanCount > 0) {
        throw new Error(`Cannot add NOT NULL constraint: ${orphanCount} events still have tenant_id=NULL`);
      }
      
      // Add NOT NULL constraint
      await db.execute(sql`
        ALTER TABLE events 
        ALTER COLUMN tenant_id SET NOT NULL
      `);
      
      console.log('✅ Successfully added NOT NULL constraint to tenant_id');
    } else {
      console.log('✅ tenant_id column already has NOT NULL constraint');
    }
  } catch (error) {
    console.error('❌ Error adding NOT NULL constraint:', error);
    throw error;
  }
}

async function updateQueriesExcludeOrphaned(): Promise<void> {
  console.log('📝 Note: Update application queries to exclude is_orphaned=true events');
  console.log('   This should be done in the storage layer by filtering out is_orphaned=true');
  console.log('   Example: WHERE tenant_id = ? AND (is_orphaned IS NULL OR is_orphaned = FALSE)');
}

async function main(): Promise<void> {
  console.log('🔧 Starting Orphan Calendar Events Repair...');
  console.log('=====================================');
  
  const deleteMode = process.env.CAL_REPAIR_DELETE_ORPHANS === 'true';
  const enforceNotNull = process.env.CAL_ENFORCE_NOT_NULL_TENANT === 'true';
  
  console.log('Configuration:');
  console.log(`  - Delete mode: ${deleteMode ? 'DELETE' : 'QUARANTINE'}`);
  console.log(`  - Enforce NOT NULL: ${enforceNotNull}`);
  console.log('');
  
  try {
    // Step 1: Add is_orphaned column if it doesn't exist
    await addOrphanedColumnIfNotExists();
    
    // Step 2: Get initial statistics
    const initialStats = await getOrphanEventStats();
    console.log(`📊 Initial Analysis:`);
    console.log(`   - Total orphan events: ${initialStats.count}`);
    console.log('');
    
    if (initialStats.count === 0) {
      console.log('✅ No orphan events found. Database is clean!');
      return;
    }
    
    // Step 3: Process orphan events (quarantine or delete)
    let repairStats: RepairStats;
    if (deleteMode) {
      repairStats = await deleteOrphanEvents();
    } else {
      repairStats = await quarantineOrphanEvents();
    }
    
    // Step 4: Optionally enforce NOT NULL constraint
    if (enforceNotNull && deleteMode) {
      await enforceNotNullConstraint();
    } else if (enforceNotNull && !deleteMode) {
      console.log('⚠️ Cannot enforce NOT NULL constraint in quarantine mode');
      console.log('   Orphaned events still exist with tenant_id=NULL');
    }
    
    // Step 5: Remind about query updates
    if (!deleteMode) {
      await updateQueriesExcludeOrphaned();
    }
    
    // Final report
    console.log('');
    console.log('📋 Repair Summary:');
    console.log('==================');
    console.log(`  - Action taken: ${repairStats.action.toUpperCase()}`);
    console.log(`  - Total orphan events found: ${repairStats.totalOrphanEvents}`);
    console.log(`  - Events processed: ${repairStats.processedEvents}`);
    console.log(`  - Errors: ${repairStats.errors}`);
    console.log(`  - Status: ${repairStats.errors === 0 ? '✅ SUCCESS' : '❌ ERRORS OCCURRED'}`);
    
    if (!deleteMode) {
      console.log('');
      console.log('🔒 Quarantined events will be excluded from application queries');
      console.log('   but remain in the database for potential recovery.');
    }
    
    console.log('');
    console.log('✅ Orphan Calendar Events Repair Complete!');
    
  } catch (error) {
    console.error('❌ Repair failed:', error);
    process.exit(1);
  }
}

// Run the repair if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main as repairOrphanCalendarEvents };