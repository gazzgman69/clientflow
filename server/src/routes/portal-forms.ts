import express from 'express';
import { storage } from '../../storage';
import { insertPortalFormSchema } from '@shared/schema';

const router = express.Router();

// Get forms for a contact and project
router.get("/forms", async (req, res) => {
  try {
    const contactId = (req as any).session.portalContactId!; // ensurePortalAuth middleware guarantees this exists
    const projectId = req.query.projectId as string;

    let forms;
    if (projectId) {
      forms = await storage.getPortalFormsByProjectAndContact(projectId, contactId);
    } else {
      forms = await storage.getPortalFormsByContact(contactId);
    }

    const formatted = forms.map(form => ({
      ...form,
      // Format dates for dd/MM/yyyy display
      createdAt: form.createdAt?.toLocaleDateString('en-GB'),
      updatedAt: form.updatedAt?.toLocaleDateString('en-GB'),
      submittedAt: form.submittedAt?.toLocaleDateString('en-GB'),
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// Get specific form definition and data
router.get("/forms/:formId", async (req, res) => {
  try {
    const { formId } = req.params;
    const contactId = (req as any).session.portalContactId!; // ensurePortalAuth middleware guarantees this exists

    const form = await storage.getPortalFormById(formId);
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // Verify contact has access to this form
    if (form.contactId !== contactId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse JSON fields
    const formWithParsedData = {
      ...form,
      formDefinition: form.formDefinition ? JSON.parse(form.formDefinition) : null,
      draftData: form.draftData ? JSON.parse(form.draftData) : null,
      submittedData: form.submittedData ? JSON.parse(form.submittedData) : null,
      createdAt: form.createdAt?.toLocaleDateString('en-GB'),
      updatedAt: form.updatedAt?.toLocaleDateString('en-GB'),
      submittedAt: form.submittedAt?.toLocaleDateString('en-GB'),
    };

    res.json(formWithParsedData);
  } catch (error: any) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// Save form draft
router.put("/forms/:formId/draft", async (req, res) => {
  try {
    const { formId } = req.params;
    const contactId = (req as any).session.portalContactId!; // ensurePortalAuth middleware guarantees this exists
    const { draftData } = req.body;

    // Verify contact has access to this form
    const form = await storage.getPortalFormById(formId);
    if (!form || form.contactId !== contactId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't allow editing submitted forms
    if (form.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot edit submitted form' });
    }

    await storage.updatePortalForm(formId, {
      draftData: JSON.stringify(draftData),
      status: 'in_progress',
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving form draft:', error);
    res.status(500).json({ error: 'Failed to save form draft' });
  }
});

// Submit form
router.post("/forms/:formId/submit", async (req, res) => {
  try {
    const { formId } = req.params;
    const contactId = (req as any).session.portalContactId!; // ensurePortalAuth middleware guarantees this exists
    const { submittedData } = req.body;

    // Verify contact has access to this form
    const form = await storage.getPortalFormById(formId);
    if (!form || form.contactId !== contactId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't allow re-submitting
    if (form.status === 'submitted') {
      return res.status(400).json({ error: 'Form already submitted' });
    }

    await storage.updatePortalForm(formId, {
      submittedData: JSON.stringify(submittedData),
      status: 'submitted',
      submittedAt: new Date(),
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: 'Failed to submit form' });
  }
});

// Create new form for project (admin function called from portal)
router.post("/forms", async (req, res) => {
  try {
    const { projectId, contactId, title, description, formDefinition, createdBy } = req.body;

    if (!projectId || !contactId || !title || !formDefinition || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const form = insertPortalFormSchema.parse({
      projectId,
      contactId,
      title,
      description,
      formDefinition: JSON.stringify(formDefinition),
      status: 'not_started',
      createdBy,
    });

    const newForm = await storage.createPortalForm(form);
    res.json(newForm);
  } catch (error: any) {
    console.error('Error creating form:', error);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

export default router;