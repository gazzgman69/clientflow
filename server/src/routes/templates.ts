import { Router } from 'express';
import { templatesService } from '../services/templates';
import { insertTemplateSchema } from '@shared/schema';

const router = Router();

// GET /api/admin/templates?type=&q=
router.get('/admin/templates', async (req, res) => {
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
router.get('/admin/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || 'default-tenant';
    const template = await templatesService.getTemplate(id, tenantId);
    
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
router.post('/admin/templates', async (req, res) => {
  try {
    const templateData = insertTemplateSchema.parse(req.body);
    const tenantId = req.tenantId || 'default-tenant';
    
    // Validate type
    if (!['auto_responder', 'email', 'invoice', 'contract'].includes(templateData.type)) {
      return res.status(400).json({ error: 'Invalid template type' });
    }
    
    const template = await templatesService.createTemplate({
      type: templateData.type as 'auto_responder' | 'email' | 'invoice' | 'contract',
      title: templateData.title,
      subject: templateData.subject,
      body: templateData.body
    }, tenantId);
    
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
router.patch('/admin/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || 'default-tenant';
    const updateData = insertTemplateSchema.partial().parse(req.body);
    
    const template = await templatesService.updateTemplate(id, updateData, tenantId);
    
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
router.delete('/admin/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || 'default-tenant';
    const success = await templatesService.softDeleteTemplate(id, tenantId);
    
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
router.get('/templates/tokens', async (req, res) => {
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

// POST /api/templates/preview - Preview template with email renderer
router.post('/templates/preview', async (req, res) => {
  try {
    const { templateId, contactId, projectId } = req.body;
    const tenantId = req.tenantId || 'default-tenant';
    
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }
    
    // Get template
    const template = await templatesService.getTemplate(templateId, tenantId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Build context for token resolution
    const context: any = {};
    if (contactId) context.contactId = contactId;
    if (projectId) context.projectId = projectId;
    
    // Render template with tokens
    const rendered = await templatesService.renderTemplate(template, context);
    
    // Use email renderer for proper preview (same as sending)
    const { emailRenderer } = await import('../services/emailRenderer');
    const emailPreview = emailRenderer.render({
      subject: rendered.subject || template.title,
      html: rendered.body,
      preheader: 'Email preview'
    });
    
    res.json({
      template: {
        id: template.id,
        title: template.title,
        subject: rendered.subject,
        body: rendered.body
      },
      preview: {
        subject: emailPreview.subject,
        htmlInlined: emailPreview.htmlInlined,
        text: emailPreview.text
      },
      unresolved: rendered.unresolved
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

export default router;