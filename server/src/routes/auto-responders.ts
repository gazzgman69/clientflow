import { Router } from 'express';
import type { Request, Response } from 'express';
import { storage } from '../../storage';
import { ensureUserAuth } from '../../middleware/auth';
import type { TenantRequest } from '../../middleware/tenantResolver';

const router = Router();

// GET /api/auto-responders/logs - Get all auto-responder logs for tenant
router.get('/logs', ensureUserAuth, async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || 'default-tenant';
    const logs = await storage.getAutoResponderLogs(tenantId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching auto-responder logs:', error);
    res.status(500).json({ error: 'Failed to fetch auto-responder logs' });
  }
});

// GET /api/auto-responders/logs/:id - Get specific auto-responder log
router.get('/logs/:id', ensureUserAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || 'default-tenant';
    const log = await storage.getAutoResponderLog(id, tenantId);
    
    if (!log) {
      return res.status(404).json({ error: 'Auto-responder log not found' });
    }
    
    res.json(log);
  } catch (error) {
    console.error('Error fetching auto-responder log:', error);
    res.status(500).json({ error: 'Failed to fetch auto-responder log' });
  }
});

// GET /api/auto-responders/logs/lead/:leadId - Get auto-responder logs for a specific lead
router.get('/logs/lead/:leadId', ensureUserAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || 'default-tenant';
    const logs = await storage.getAutoResponderLogsByLead(leadId, tenantId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching auto-responder logs for lead:', error);
    res.status(500).json({ error: 'Failed to fetch auto-responder logs' });
  }
});

// POST /api/auto-responders/retry/:id - Retry a failed auto-responder
router.post('/retry/:id', ensureUserAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || 'default-tenant';
    
    // Get the log
    const log = await storage.getAutoResponderLog(id, tenantId);
    if (!log) {
      return res.status(404).json({ error: 'Auto-responder log not found' });
    }
    
    // Only allow retry for failed or pending_auth status
    if (log.status !== 'failed' && log.status !== 'pending_auth') {
      return res.status(400).json({ error: 'Can only retry failed or pending_auth auto-responders' });
    }
    
    // Update status to queued and schedule for immediate send
    const updatedLog = await storage.updateAutoResponderLog(id, {
      status: 'queued',
      scheduledFor: new Date(),
      retryCount: log.retryCount + 1,
      errorMessage: null
    }, tenantId);
    
    res.json(updatedLog);
  } catch (error) {
    console.error('Error retrying auto-responder:', error);
    res.status(500).json({ error: 'Failed to retry auto-responder' });
  }
});

export default router;
