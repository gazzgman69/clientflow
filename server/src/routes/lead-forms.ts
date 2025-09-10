import { Router } from 'express';
import { storage } from '../../storage';
import { insertLeadCaptureFormSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Helper function for default questions
function getDefaultQuestionsForForm() {
  return [
    { id: '1', type: 'text', label: 'Name', required: true, mapTo: 'leadName', orderIndex: 0 },
    { id: '2', type: 'email', label: 'Email Address', required: true, mapTo: 'leadEmail', orderIndex: 1 },
    { id: '3', type: 'tel', label: 'Phone Number', required: true, mapTo: 'leadPhoneNumber', orderIndex: 2 },
    { id: '4', type: 'select', label: 'Event Type', required: true, mapTo: 'whatKindOfEventIsIt', orderIndex: 3, options: 'Wedding,Private,Corporate,Other' },
    { id: '5', type: 'venue', label: 'Event Location (Full address if possible please)', required: true, mapTo: 'eventLocation', orderIndex: 4 },
    { id: '6', type: 'date', label: 'Event Date', required: true, mapTo: 'projectDate', orderIndex: 5 },
    { id: '7', type: 'textarea', label: 'Message', required: false, mapTo: 'nothing', orderIndex: 6 }
  ];
}

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.headers['user-id']) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// GET /api/admin/lead-forms
router.get('/admin/lead-forms', requireAuth, async (req, res) => {
  try {
    const forms = await storage.getLeadCaptureForms();
    // Return simplified list format
    const formsList = forms.map(form => ({
      id: form.id,
      title: form.name,
      slug: form.slug,
      updatedAt: form.updatedAt
    }));
    res.json(formsList);
  } catch (error) {
    console.error('Error fetching lead forms:', error);
    res.status(500).json({ error: 'Failed to fetch lead forms' });
  }
});

// POST /api/admin/lead-forms
router.post('/admin/lead-forms', requireAuth, async (req, res) => {
  try {
    const userId = req.headers['user-id'] as string;
    const { title = 'New Capture Form' } = req.body;
    
    // Generate unique slug
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      + '-' + Date.now();

    const formData = {
      name: title,
      slug: slug,
      autoResponseTemplateId: null,
      notification: 'email',
      calendarId: null,
      lifecycleId: null,
      workflowId: null,
      contactTags: null,
      projectTags: null,
      recaptchaEnabled: false,
      isActive: true,
      createdBy: userId
    };

    const form = await storage.createLeadCaptureForm(formData);
    
    // Create default questions to match the provided template
    const defaultQuestions = [
      { type: 'text', label: 'Name', required: true, mapTo: 'leadName', orderIndex: 0 },
      { type: 'email', label: 'Email Address', required: true, mapTo: 'leadEmail', orderIndex: 1 },
      { type: 'tel', label: 'Phone Number', required: true, mapTo: 'leadPhoneNumber', orderIndex: 2 },
      { type: 'select', label: 'Event Type', required: true, mapTo: 'whatKindOfEventIsIt', orderIndex: 3, options: 'Wedding,Private,Corporate,Other' },
      { type: 'text', label: 'Event Location (Full address if possible please)', required: true, mapTo: 'eventLocation', orderIndex: 4 },
      { type: 'date', label: 'Event Date', required: true, mapTo: 'projectDate', orderIndex: 5 },
      { type: 'textarea', label: 'Message', required: false, mapTo: 'nothing', orderIndex: 6 }
    ];

    // For now, we'll store questions in the form's metadata or create a separate questions system
    // This is a simplified implementation
    
    res.status(201).json({ 
      id: form.id, 
      slug: form.slug,
      title: form.name 
    });
  } catch (error) {
    console.error('Error creating lead form:', error);
    res.status(500).json({ error: 'Failed to create lead form' });
  }
});

// GET /api/admin/lead-forms/:id
router.get('/admin/lead-forms/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const form = await storage.getLeadCaptureForm(id);
    
    if (!form) {
      return res.status(404).json({ error: 'Lead form not found' });
    }

    // Parse questions from form or use default questions
    let questions = getDefaultQuestionsForForm();
    try {
      if (form.questions) {
        questions = JSON.parse(form.questions);
      }
    } catch (e) {
      console.error('Error parsing questions:', e);
      // Fall back to default questions
    }



    res.json({
      form: {
        id: form.id,
        title: form.name,
        slug: form.slug,
        projectName: 'General Inquiry', // Could be stored in form
        notification: form.notification,
        autoResponseTemplateId: form.autoResponseTemplateId,
        calendarId: form.calendarId,
        lifecycleId: form.lifecycleId,
        workflowId: form.workflowId,
        contactTags: form.contactTags,
        projectTags: form.projectTags,
        recaptchaEnabled: form.recaptchaEnabled,
        isActive: form.isActive,
        transparency: 'We will use this information to contact you about our services.',
        updatedAt: form.updatedAt
      },
      questions: questions
    });
  } catch (error) {
    console.error('Error fetching lead form:', error);
    res.status(500).json({ error: 'Failed to fetch lead form' });
  }
});

// PATCH /api/admin/lead-forms/:id
router.patch('/admin/lead-forms/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { form, questions } = req.body;
    
    const existingForm = await storage.getLeadCaptureForm(id);
    if (!existingForm) {
      return res.status(404).json({ error: 'Lead form not found' });
    }

    // Generate slug if title changed and no slug provided
    let slug = existingForm.slug;
    if (form.title && form.title !== existingForm.name && !form.slug) {
      slug = form.title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
        + '-' + Date.now();
    } else if (form.slug) {
      slug = form.slug;
    }

    const updateData: any = {};
    if (form.title) updateData.name = form.title;
    if (slug !== existingForm.slug) updateData.slug = slug;
    if (form.notification) updateData.notification = form.notification;
    if (form.autoResponseTemplateId !== undefined) updateData.autoResponseTemplateId = form.autoResponseTemplateId;
    if (form.calendarId !== undefined) updateData.calendarId = form.calendarId;
    if (form.lifecycleId !== undefined) updateData.lifecycleId = form.lifecycleId;
    if (form.workflowId !== undefined) updateData.workflowId = form.workflowId;
    if (form.contactTags !== undefined) updateData.contactTags = form.contactTags;
    if (form.projectTags !== undefined) updateData.projectTags = form.projectTags;
    if (form.recaptchaEnabled !== undefined) updateData.recaptchaEnabled = form.recaptchaEnabled;
    if (form.isActive !== undefined) updateData.isActive = form.isActive;

    const updatedForm = await storage.updateLeadCaptureForm(id, updateData);
    
    // Handle questions update
    if (questions) {
      updateData.questions = JSON.stringify(questions);
    }
    
    res.json({ ok: true, slug: updatedForm?.slug });
  } catch (error) {
    console.error('Error updating lead form:', error);
    res.status(500).json({ error: 'Failed to update lead form' });
  }
});

// DELETE /api/admin/lead-forms/:id
router.delete('/admin/lead-forms/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteLeadCaptureForm(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Lead form not found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting lead form:', error);
    res.status(500).json({ error: 'Failed to delete lead form' });
  }
});

// Public routes for form submission

// GET /api/leads/public/:slug
router.get('/leads/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const form = await storage.getLeadCaptureFormBySlug(slug);
    
    if (!form || !form.isActive) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Parse questions from form or use default questions
    let questions = getDefaultQuestionsForForm();
    try {
      if (form.questions) {
        questions = JSON.parse(form.questions);
      }
    } catch (e) {
      console.error('Error parsing questions:', e);
      // Fall back to default questions
    }



    res.json({
      form: {
        id: form.id,
        title: form.name,
        slug: form.slug,
        recaptchaEnabled: form.recaptchaEnabled,
        transparency: 'We will use this information to contact you about our services.'
      },
      questions: questions
    });
  } catch (error) {
    console.error('Error fetching public form:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// POST /api/leads/public/:slug/submit
router.post('/leads/public/:slug/submit', async (req, res) => {
  try {
    const { slug } = req.params;
    const formData = req.body;
    
    
    const form = await storage.getLeadCaptureFormBySlug(slug);
    if (!form || !form.isActive) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Create lead from form submission - map new form fields to lead fields
    const leadData = {
      firstName: formData.leadName || '',  // Full name in firstName field
      lastName: '',  // We only collect full name now
      email: formData.leadEmail || '',
      phone: formData.leadPhoneNumber || '',
      company: formData.eventLocation || '',  // Use event location as company for now
      leadSource: formData.whatKindOfEventIsIt ? `${formData.whatKindOfEventIsIt} Event` : 'Website Form',
      notes: formData.nothing || '',  // Message field maps to notes
      projectDate: formData.projectDate ? new Date(formData.projectDate) : null,  // Convert string to Date object
      status: 'new' as const,
      estimatedValue: null
    };

    const lead = await storage.createLead(leadData);

    // Automatically create contact (client) from lead data
    const contactData = {
      firstName: formData.leadName || '',
      lastName: '',
      email: formData.leadEmail || '',
      phone: formData.leadPhoneNumber || '',
      address: '', // Leave personal address blank 
      company: '',
      // Map venue location to venue address fields - now includes all address components
      venueAddress: formData.eventLocation || '',
      venueCity: formData.eventLocationCity || null,
      venueState: formData.eventLocationState || null,
      venueZipCode: formData.eventLocationZipCode || null,
      venueCountry: formData.eventLocationCountry || null,
      notes: `Auto-created from lead form: ${formData.nothing || ''}`
    };

    const contact = await storage.createContact(contactData);

    // Automatically create project from lead data
    const projectData = {
      name: `${formData.whatKindOfEventIsIt || 'Event'} - ${formData.leadName || 'Unknown'}`,
      description: `${formData.whatKindOfEventIsIt || 'Event'} at ${formData.eventLocation || 'TBD'}`,
      contactId: contact.id,
      status: 'pending' as const,
      startDate: formData.projectDate ? new Date(formData.projectDate) : null,
      endDate: null,
      estimatedValue: null,
      progress: 0
    };

    const project = await storage.createProject(projectData);

    // Update lead notes to reference the created contact and project
    await storage.updateLead(lead.id, { 
      notes: `${leadData.notes}. Auto-linked to Contact: ${contact.id} and Project: ${project.id}`
    });

    // TODO: Send auto-response if template configured
    // TODO: Trigger workflows if configured

    res.json({
      ok: true,
      leadId: lead.id,
      afterSubmit: {
        type: 'message',
        message: 'Thank you! We will be in touch soon.'
      }
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: 'Failed to submit form' });
  }
});

export default router;