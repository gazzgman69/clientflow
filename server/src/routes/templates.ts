import { Router } from 'express';
import { templatesService } from '../services/templates';
import { insertTemplateSchema } from '@shared/schema';

const router = Router();

// Middleware to require authentication (simplified for now)
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.headers['user-id']) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// GET /api/admin/templates?type=&q=
router.get('/admin/templates', requireAuth, async (req, res) => {
  try {
    const { type, q } = req.query;
    
    const options: {
      type?: 'auto_responder' | 'email' | 'invoice' | 'contract';
      q?: string;
      activeOnly?: boolean;
    } = {};
    
    if (type && typeof type === 'string') {
      if (['auto_responder', 'email', 'invoice', 'contract'].includes(type)) {
        options.type = type as 'auto_responder' | 'email' | 'invoice' | 'contract';
      }
    }
    
    if (q && typeof q === 'string') {
      options.q = q;
    }
    
    const templates = await templatesService.listTemplates(options);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/admin/templates/:id
router.get('/admin/templates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await templatesService.getTemplate(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/admin/templates
router.post('/admin/templates', requireAuth, async (req, res) => {
  try {
    const templateData = insertTemplateSchema.parse(req.body);
    
    // Validate type
    if (!['auto_responder', 'email', 'invoice', 'contract'].includes(templateData.type)) {
      return res.status(400).json({ error: 'Invalid template type' });
    }
    
    const template = await templatesService.createTemplate({
      type: templateData.type as 'auto_responder' | 'email' | 'invoice' | 'contract',
      title: templateData.title,
      subject: templateData.subject,
      body: templateData.body
    });
    
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid template data', details: error.message });
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PATCH /api/admin/templates/:id
router.patch('/admin/templates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = insertTemplateSchema.partial().parse(req.body);
    
    const template = await templatesService.updateTemplate(id, updateData);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid template data', details: error.message });
    }
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/admin/templates/:id
router.delete('/admin/templates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await templatesService.softDeleteTemplate(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// GET /api/templates/tokens - Get available template tokens
router.get('/templates/tokens', requireAuth, async (req, res) => {
  try {
    const tokens = templatesService.getAvailableTokens();
    res.json(tokens);
  } catch (error) {
    console.error('Error fetching template tokens:', error);
    res.status(500).json({ error: 'Failed to fetch template tokens' });
  }
});

// GET /api/templates - Public endpoint for email templates (for compose functionality)
router.get('/templates', async (req, res) => {
  try {
    const { type } = req.query;
    
    const options: {
      type?: 'auto_responder' | 'email' | 'invoice' | 'contract';
      activeOnly?: boolean;
    } = {
      activeOnly: true // Only return active templates
    };
    
    if (type && typeof type === 'string') {
      if (['auto_responder', 'email', 'invoice', 'contract'].includes(type)) {
        options.type = type as 'auto_responder' | 'email' | 'invoice' | 'contract';
      }
    }
    
    const templates = await templatesService.listTemplates(options);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching public templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

export default router;