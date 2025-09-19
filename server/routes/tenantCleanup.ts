/**
 * Tenant Cleanup API Routes
 * 
 * Provides secure HTTP endpoints for tenant database cleanup operations.
 * All routes require authentication and are gated by the RUN_TENANT_CLEANUP environment flag.
 */

import { Router } from 'express';
import { tenantCleanupService } from '../services/tenantCleanup';

const router = Router();

// Note: Admin authentication is handled by ensureAdminAuth middleware at route mounting level
// This ensures only users with admin/super_admin roles can access these endpoints

/**
 * GET /api/tenant-cleanup/status
 * Check if cleanup is enabled and get tenant data statistics
 */
router.get('/status', async (req: any, res) => {
  try {
    const isEnabled = tenantCleanupService.isEnabled();
    
    if (!isEnabled) {
      return res.json({
        success: true,
        enabled: false,
        message: 'Tenant cleanup is disabled. Set RUN_TENANT_CLEANUP=true to enable.',
        tenantStats: null
      });
    }

    // SECURITY: Only allow operations on admin's own tenant
    const tenantId = req.tenantId;
    
    const tenantStats = await tenantCleanupService.getCleanupStatus(tenantId);
    
    res.json({
      success: true,
      enabled: true,
      tenantStats,
      message: tenantStats.hasData 
        ? `Tenant has ${tenantStats.totalRecords} records across ${Object.keys(tenantStats.tableStats).length} tables`
        : 'Tenant has no data records'
    });

  } catch (error: any) {
    console.error('❌ Cleanup status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to check cleanup status'
    });
  }
});

/**
 * POST /api/tenant-cleanup/preview
 * Preview what would be cleaned up without actually doing it (dry run)
 */
router.post('/preview', async (req: any, res) => {
  try {
    const { skipTables, targetTables } = req.body;
    
    // SECURITY: Only allow operations on admin's own tenant - ignore body tenantId
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant not resolved',
        message: 'Unable to determine tenant for cleanup preview'
      });
    }

    console.log(`🔍 Cleanup preview requested for tenant: ${tenantId} by admin: ${req.authenticatedUserId}`);

    const result = await tenantCleanupService.cleanupTenant({
      tenantId,
      dryRun: true, // Always dry run for preview
      skipTables,
      targetTables
    });

    res.json({
      success: result.success,
      preview: true,
      result,
      message: result.success 
        ? `Preview: Would remove ${result.recordsRemoved} records from ${result.tablesProcessed.length} tables`
        : `Preview failed: ${result.errors.join(', ')}`
    });

  } catch (error: any) {
    console.error('❌ Cleanup preview failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to generate cleanup preview'
    });
  }
});

/**
 * POST /api/tenant-cleanup/execute
 * Actually perform the cleanup operation (live run)
 */
router.post('/execute', async (req: any, res) => {
  try {
    const { skipTables, targetTables, confirmCleanup } = req.body;
    
    // SECURITY: Only allow operations on admin's own tenant - ignore body tenantId
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant not resolved',
        message: 'Unable to determine tenant for cleanup execution'
      });
    }

    if (!confirmCleanup) {
      return res.status(400).json({
        error: 'Missing confirmation',
        message: 'confirmCleanup must be set to true to execute cleanup'
      });
    }

    console.log(`🧹 LIVE cleanup requested for tenant: ${tenantId} by admin: ${req.authenticatedUserId}`);
    console.log(`⚠️  SECURITY: Admin ${req.authenticatedUserId} executing tenant cleanup for ${tenantId}`);

    const result = await tenantCleanupService.cleanupTenant({
      tenantId,
      dryRun: false, // Live cleanup
      skipTables,
      targetTables
    });

    // Log the cleanup result for audit purposes
    if (result.success) {
      console.log(`✅ Tenant cleanup completed for ${tenantId}: ${result.recordsRemoved} records removed from ${result.tablesProcessed.length} tables`);
    } else {
      console.error(`❌ Tenant cleanup failed for ${tenantId}: ${result.errors.join(', ')}`);
    }

    res.json({
      success: result.success,
      preview: false,
      result,
      message: result.success 
        ? `Cleanup completed: Removed ${result.recordsRemoved} records from ${result.tablesProcessed.length} tables`
        : `Cleanup failed: ${result.errors.join(', ')}`
    });

  } catch (error: any) {
    console.error('❌ Cleanup execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to execute cleanup'
    });
  }
});

/**
 * GET /api/tenant-cleanup/config
 * Get cleanup configuration and available tables
 */
router.get('/config', async (req: any, res) => {
  try {
    const isEnabled = tenantCleanupService.isEnabled();
    
    res.json({
      success: true,
      config: {
        enabled: isEnabled,
        environmentFlag: 'RUN_TENANT_CLEANUP',
        currentValue: process.env.RUN_TENANT_CLEANUP || 'false',
        supportedTables: [
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
        ],
        protectedTables: [
          'users',
          'tenants', 
          'sessions',
          'standardQuestions',
          'messageTemplates'
        ]
      },
      message: isEnabled 
        ? 'Cleanup service is enabled'
        : 'Cleanup service is disabled. Set RUN_TENANT_CLEANUP=true to enable.'
    });

  } catch (error: any) {
    console.error('❌ Failed to get cleanup config:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get cleanup configuration'
    });
  }
});

export default router;