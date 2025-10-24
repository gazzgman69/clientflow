import { Router } from 'express';
import { z } from 'zod';
import { mailSettingsService, PROVIDER_PRESETS } from '../services/mailSettings';

const router = Router();

// Validation schemas
const saveSettingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.string().optional(),
  
  // IMAP settings
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUsername: z.string().optional(),
  imapPassword: z.string().optional(),
  imapSecurity: z.enum(['ssl', 'starttls', 'none']).optional(),
  
  // SMTP settings
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecurity: z.enum(['ssl', 'starttls', 'none']).optional(),
  
  // Email identity
  fromName: z.string().optional(),
  fromEmail: z.string().email('Invalid email address').optional(),
  replyToEmail: z.string().email('Invalid reply-to email').optional(),
  
  // Settings
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  syncIntervalMinutes: z.number().int().min(1).max(15).optional()
});

const detectSettingsSchema = z.object({
  email: z.string().email('Invalid email address')
});

// Middleware for authentication using session
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId || !req.session?.tenantId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please log in to access this endpoint'
    });
  }
  req.user = { id: req.session.userId };
  req.tenantId = req.session.tenantId; // Add tenant context
  next();
};

/**
 * GET /api/settings/mail/current
 * Get current mail settings (with redacted passwords)
 */
router.get('/current', requireAuth, async (req: any, res) => {
  try {
    const settings = await mailSettingsService.getCurrentSettings(req.tenantId);
    
    if (!settings) {
      return res.json({
        success: true,
        settings: null,
        message: 'No mail settings configured'
      });
    }

    res.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('Error fetching current mail settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mail settings'
    });
  }
});

/**
 * POST /api/settings/mail/save
 * Save mail settings with encrypted credentials and auto-test
 */
router.post('/save', requireAuth, async (req: any, res) => {
  try {
    const settingsData = saveSettingsSchema.parse(req.body);
    
    console.log('💾 Saving mail settings:', { 
      tenantId: req.tenantId,
      name: settingsData.name, 
      provider: settingsData.provider,
      fromEmail: settingsData.fromEmail 
    });

    const result = await mailSettingsService.saveSettings(req.tenantId, settingsData);
    
    if (result.success) {
      res.json({
        success: true,
        settings: result.settings,
        message: 'Mail settings saved and tested successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Error saving mail settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save mail settings'
    });
  }
});

/**
 * POST /api/settings/mail/test
 * Test IMAP and SMTP connections for current settings
 */
router.post('/test', requireAuth, async (req: any, res) => {
  try {
    const currentSettings = await mailSettingsService.getCurrentSettings(req.tenantId);
    
    if (!currentSettings) {
      return res.status(400).json({
        success: false,
        error: 'No mail settings found to test'
      });
    }

    console.log('🧪 Testing mail connections for settings:', currentSettings.id);

    const result = await mailSettingsService.testConnection(req.tenantId, currentSettings.id);
    
    res.json({
      success: result.success,
      imapResult: result.imapResult,
      smtpResult: result.smtpResult,
      error: result.error,
      message: result.success 
        ? 'All connections tested successfully' 
        : 'One or more connection tests failed'
    });

  } catch (error) {
    console.error('Error testing mail connections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test mail connections'
    });
  }
});

/**
 * POST /api/settings/mail/detect
 * Auto-detect mail settings based on email domain
 */
router.post('/detect', requireAuth, async (req, res) => {
  try {
    const { email } = detectSettingsSchema.parse(req.body);
    
    console.log('🔍 Auto-detecting mail settings for:', email);

    const result = await mailSettingsService.autoDetectSettings(email);
    
    if (result.success) {
      res.json({
        success: true,
        settings: result.settings,
        message: 'Mail settings detected successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address',
        details: error.errors
      });
    }

    console.error('Error auto-detecting mail settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-detect mail settings'
    });
  }
});

/**
 * GET /api/settings/mail/logs
 * Get recent audit logs for mail settings
 */
router.get('/logs', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const settingsId = req.query.settingsId as string;

    const logs = await mailSettingsService.getAuditLogs(req.tenantId, settingsId, Math.min(limit, 100));
    
    res.json({
      success: true,
      logs
    });

  } catch (error) {
    console.error('Error fetching mail audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

/**
 * POST /api/settings/mail/send-test
 * Send a test email to the configured from address
 */
router.post('/send-test', requireAuth, async (req: any, res) => {
  try {
    const currentSettings = await mailSettingsService.getCurrentSettings(req.tenantId);
    
    if (!currentSettings) {
      return res.status(400).json({
        success: false,
        error: 'No mail settings found'
      });
    }

    if (!currentSettings.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Mail settings are not active'
      });
    }

    console.log('📧 Sending test email for settings:', currentSettings.id);

    const result = await mailSettingsService.sendTestEmail(req.tenantId, currentSettings.id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email'
    });
  }
});

/**
 * GET /api/settings/mail/presets
 * Get provider presets for common email providers
 */
router.get('/presets', requireAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      presets: PROVIDER_PRESETS
    });
  } catch (error) {
    console.error('Error fetching provider presets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider presets'
    });
  }
});

export default router;