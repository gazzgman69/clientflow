import { Router } from 'express';
import { gmailService } from '../services/gmail';
import { z } from 'zod';
import { storage } from '../../storage';

const router = Router();

const sendEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  text: z.string().min(1, 'Email body is required'),
  projectId: z.string().optional(),
  emails: z.array(z.string()).optional()
});

// Middleware to check for authenticated user
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  next();
};

/**
 * Send email via Gmail
 */
router.post('/send', requireAuth, async (req: any, res) => {
  try {
    const emailData = sendEmailSchema.parse(req.body);
    const userId = req.user.id;
    
    const result = await gmailService.sendEmail(userId, {
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text
    });
    
    res.json(result);
  } catch (error: any) {
    if (error.issues) {
      res.status(400).json({ ok: false, error: error.issues[0].message });
    } else {
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
});

/**
 * Get email threads (all recent)
 */
router.get('/threads', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const q = req.query.q as string || '';
    const userId = req.user.id;
    
    const result = await gmailService.listThreads(userId, { limit, q });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * Get email threads by project
 * Filters by project contact emails or fallback to query param emails
 */
router.get('/threads/by-project/:projectId', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.user.id;
    const projectId = req.params.projectId;
    
    let addresses: string[] = [];
    
    try {
      // Try to get project and its contact emails from existing storage
      const project = await storage.getProject(projectId);
      if (project && project.contactEmails && Array.isArray(project.contactEmails)) {
        addresses = project.contactEmails;
      }
    } catch (error) {
      // If project doesn't have contactEmails or getProject fails, continue with fallback
    }
    
    // Fallback: accept ?emails=a@x.com,b@y.com query parameter
    if (addresses.length === 0 && req.query.emails) {
      const emailsParam = req.query.emails as string;
      addresses = emailsParam.split(',').map(email => email.trim()).filter(email => email);
    }
    
    if (addresses.length === 0) {
      return res.json({ 
        ok: true, 
        threads: [],
        message: 'No contact emails found for project. Use ?emails=a@x.com,b@y.com to specify addresses.'
      });
    }
    
    const result = await gmailService.listThreadsForAddresses(userId, { limit, addresses });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * List emails (existing endpoint)
 */
router.get('/list', requireAuth, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.user.id;
    
    const result = await gmailService.listEmails(userId, limit);
    
    if (result.ok) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;