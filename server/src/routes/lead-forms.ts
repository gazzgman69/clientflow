import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { storage } from '../../storage';
import { insertLeadCaptureFormSchema } from '@shared/schema';
import { z } from 'zod';
import { splitFullName } from '@shared/utils/name-splitter';
import { applyMapping, FORM_FIELD_REGISTRY } from '@shared/formMappingRegistry';
import { venuesService } from '../services/venues';
import crypto from 'crypto';
import { TenantRequest } from '../../middleware/tenantResolver';

// Honeypot spam protection helper
function validateHoneypot(formData: Record<string, any>): boolean {
  // Check if honeypot field is filled (indicates spam)
  const honeypotValue = formData.website_url;
  if (honeypotValue && honeypotValue.trim() !== '') {
    console.log('🛡️ HONEYPOT: Spam detected - honeypot field filled', {
      honeypotValue: typeof honeypotValue,
      timestamp: new Date().toISOString()
    });
    return false; // Honeypot caught spam
  }
  return true; // Looks legitimate
}

const router = Router();

// Rate limiting for public form submissions
const formSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // Allow more submissions in development for testing
  message: { error: 'Too many form submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't skip any requests - applies to all IPs
  skip: () => false,
});

// Helper function for default questions - use canonical field mappings
function getDefaultQuestionsForForm() {
  return [
    { id: '1', type: 'text', label: 'Name', required: true, mapTo: 'leadName', orderIndex: 0 },
    { id: '2', type: 'email', label: 'Email Address', required: true, mapTo: 'leadEmail', orderIndex: 1 },
    { id: '3', type: 'tel', label: 'Phone Number', required: true, mapTo: 'leadPhoneNumber', orderIndex: 2 },
    { id: '4', type: 'select', label: 'Event Type', required: true, mapTo: 'eventType', orderIndex: 3, options: 'Wedding,Private,Corporate,Other' },
    { id: '5', type: 'venue', label: 'Event Location (Full address if possible please)', required: true, mapTo: 'eventLocation', orderIndex: 4 },
    { id: '6', type: 'date', label: 'Event Date', required: true, mapTo: 'projectDate', orderIndex: 5 },
    { id: '7', type: 'textarea', label: 'Message', required: false, mapTo: 'nothing', orderIndex: 6 }
  ];
}

// GET /api/lead-forms (mounted at /api/lead-forms)
router.get('/', async (req, res) => {
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

// POST /api/lead-forms (mounted at /api/lead-forms)
router.post('/', async (req, res) => {
  try {
    const userId = req.authenticatedUserId;
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
      createdBy: userId || 'system'
    };

    const form = await storage.createLeadCaptureForm({ ...formData, tenantId: (req as TenantRequest).tenantId });
    
    // Create default questions to match the provided template - use canonical field mappings
    const defaultQuestions = [
      { type: 'text', label: 'Name', required: true, mapTo: 'leadName', orderIndex: 0 },
      { type: 'email', label: 'Email Address', required: true, mapTo: 'leadEmail', orderIndex: 1 },
      { type: 'tel', label: 'Phone Number', required: true, mapTo: 'leadPhoneNumber', orderIndex: 2 },
      { type: 'select', label: 'Event Type', required: true, mapTo: 'eventType', orderIndex: 3, options: 'Wedding,Private,Corporate,Other' },
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

// GET /api/lead-forms/:id (mounted at /api/lead-forms)
router.get('/:id', async (req, res) => {
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

// PATCH /api/lead-forms/:id (mounted at /api/lead-forms)
router.patch('/:id', async (req, res) => {
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

    // Handle questions update
    if (questions) {
      updateData.questions = JSON.stringify(questions);
    }
    
    const updatedForm = await storage.updateLeadCaptureForm(id, updateData);
    
    res.json({ ok: true, slug: updatedForm?.slug });
  } catch (error) {
    console.error('Error updating lead form:', error);
    res.status(500).json({ error: 'Failed to update lead form' });
  }
});

// DELETE /api/lead-forms/:id (mounted at /api/lead-forms)
router.delete('/:id', async (req, res) => {
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

// GET /:slug (mounted under /api/leads/public)
router.get('/:slug', async (req, res) => {
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
        transparency: 'We will use this information to contact you about our services.',
        consentRequired: form.consentRequired,
        consentText: form.consentText,
        privacyPolicyUrl: form.privacyPolicyUrl,
        dataRetentionDays: form.dataRetentionDays
      },
      questions: questions
    });
  } catch (error) {
    console.error('Error fetching public form:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

// POST /:slug/submit (mounted under /api/leads/public)
router.post('/:slug/submit', formSubmissionLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const formData = req.body;
    
    console.log('🔍 FORM SUBMISSION DEBUG:', { 
      slug, 
      hasFormData: !!formData,
      formDataKeys: Object.keys(formData || {}),
      ip: req.ip?.slice(0, 8) + '***',
      timestamp: new Date().toISOString()
    });
    
    const form = await storage.getLeadCaptureFormBySlug(slug);
    if (!form || !form.isActive) {
      return res.status(404).json({ error: 'Form not found' });
    }

    // SECURITY: Validate form has proper tenant isolation
    if (!form.tenantId) {
      console.error('🚨 SECURITY: Form missing tenantId', {
        slug,
        formId: form.id,
        formName: form.name,
        timestamp: new Date().toISOString()
      });
      return res.status(500).json({ error: 'Form configuration error' });
    }

    // Create tenant-scoped storage for secure data operations
    const tenantStorage = new (await import('../../utils/tenantScopedStorage')).TenantScopedStorage(storage, form.tenantId);
    
    console.log('🏢 TENANT ISOLATION ACTIVE:', {
      slug,
      tenantId: form.tenantId,
      formId: form.id,
      formName: form.name,
      timestamp: new Date().toISOString()
    });

    // Check honeypot for spam protection
    if (!validateHoneypot(formData)) {
      // Log spam attempt but return success to prevent detection
      console.log('🛡️ SPAM REJECTED: Honeypot validation failed', {
        slug,
        ip: req.ip?.slice(0, 8) + '***',
        tenantId: form.tenantId,
        timestamp: new Date().toISOString()
      });
      // Return success to prevent spammers from detecting the protection
      return res.status(200).json({ 
        success: true,
        message: 'Thank you for your submission!' 
      });
    }

    // Parse the form questions to get field mappings
    let questions = getDefaultQuestionsForForm();
    try {
      if (form.questions) {
        questions = JSON.parse(form.questions);
        console.log('🔄 PARSED QUESTIONS DEBUG:', {
          questionsCount: questions.length,
          questionMappings: questions.map(q => ({ id: q.id, mapTo: q.mapTo }))
        });
      }
    } catch (e) {
      console.error('Error parsing questions:', e);
      // Fall back to default questions
    }

    // Check if consent is required and validate
    const consentGiven = formData.consent === true || formData.consent === 'true';
    if (form.consentRequired && !consentGiven) {
      return res.status(400).json({ 
        error: 'Consent is required',
        message: 'You must provide consent to process your personal data.' 
      });
    }
    
    // Public submissions have no authenticated user - use null for proper tenant isolation
    const userId = null;
    
    // Transform question IDs to canonical field names using form questions
    const transformedData: Record<string, any> = {};
    const questionIdToMapTo: Record<string, string> = {};
    
    // Build mapping from question ID to canonical field name
    for (const question of questions) {
      if (question.id && question.mapTo && question.mapTo !== 'nothing') {
        questionIdToMapTo[question.id] = question.mapTo;
      }
    }
    
    // Handle both flat and nested form data structures
    
    // If form data has a nested 'data' structure, extract it
    if (formData.data && typeof formData.data === 'object') {
      // Check if nested data contains question IDs or canonical field names
      const nestedKeys = Object.keys(formData.data);
      const hasQuestionIds = nestedKeys.some(key => questionIdToMapTo[key]);
      
      if (hasQuestionIds) {
        // Apply transformations to the nested data object (question IDs to canonical names)
        for (const [key, value] of Object.entries(formData.data)) {
          if (questionIdToMapTo[key]) {
            transformedData[questionIdToMapTo[key]] = value;
          } else {
            transformedData[key] = value;
          }
        }
      } else {
        // Data already contains canonical field names, flatten them directly
        for (const [key, value] of Object.entries(formData.data)) {
          transformedData[key] = value;
        }
      }
      
      // Keep other top-level fields (like consent, honeypot)
      for (const [key, value] of Object.entries(formData)) {
        if (key !== 'data') {
          transformedData[key] = value;
        }
      }
    } else {
      // Handle flat structure (legacy format)
      for (const [key, value] of Object.entries(formData)) {
        if (questionIdToMapTo[key]) {
          // Map question ID to canonical field name
          transformedData[questionIdToMapTo[key]] = value;
        } else {
          // Keep non-question fields as-is (consent, honeypot, etc.)
          transformedData[key] = value;
        }
      }
    }
    
    console.log('🔄 FIELD TRANSFORMATION DEBUG:', {
      originalKeys: Object.keys(formData),
      questionMappings: questionIdToMapTo,
      transformedKeys: Object.keys(transformedData),
      transformedData: JSON.stringify(transformedData, null, 2)
    });
    
    // Apply mapping registry to transform form data to database models
    const mappingResult = applyMapping(transformedData, {
      tenantId: form.tenantId,
      allowUnknownKeys: true, // Allow custom fields for now
      enableDeprecationWarnings: true
    });

    // SECURITY: Create submission fingerprint AFTER mapping to use normalized data
    const submissionFingerprint = {
      slug,
      formId: form.id,
      email: mappingResult.leadData.email || mappingResult.contactData.email || 'no-email',
      phone: mappingResult.leadData.phone || mappingResult.contactData.phone || 'no-phone',
      timestamp: new Date().toDateString(), // Same day submissions considered duplicates
    };
    
    console.log('🔍 SUBMISSION FINGERPRINT DEBUG:', {
      slug,
      formId: form.id,
      extractedEmail: submissionFingerprint.email,
      extractedPhone: submissionFingerprint.phone,
      mappingResult: JSON.stringify(mappingResult, null, 2),
      fingerprintData: submissionFingerprint
    });
    
    const submissionKey = crypto
      .createHash('sha256')
      .update(JSON.stringify(submissionFingerprint))
      .digest('hex');

    // Check for duplicate submission using idempotency key - SECURITY: Use tenant-scoped storage
    try {
      const existingSubmission = await tenantStorage.getFormSubmissionByKey(submissionKey);
      if (existingSubmission) {
        console.log('🔍 DUPLICATE SUBMISSION DETECTED:', {
          submissionKey: submissionKey.slice(0, 8) + '***',
          existingSubmissionId: existingSubmission.id,
          slug,
          tenantId: form.tenantId,
          timestamp: new Date().toISOString()
        });
        
        // Parse metadata to get contact and project IDs
        let metadata: any = {};
        try {
          if (typeof existingSubmission.metadata === 'string') {
            metadata = JSON.parse(existingSubmission.metadata);
          } else {
            metadata = existingSubmission.metadata || {};
          }
        } catch (metadataError) {
          console.warn('⚠️ Failed to parse submission metadata:', metadataError);
        }
        
        // Check if the referenced contact still exists
        if (metadata.contactId) {
          try {
            const existingContact = await tenantStorage.getContactById(metadata.contactId);
            if (existingContact) {
              console.log('♻️ REUSING EXISTING CONTACT:', {
                contactId: existingContact.id,
                contactEmail: existingContact.email,
                contactName: `${existingContact.firstName} ${existingContact.lastName}`,
                slug,
                tenantId: form.tenantId
              });
              
              // Reuse contact, create new lead and project
              // Continue with modified submission flow using existingContact
              const nameParts = splitFullName(mappingResult.leadData.full_name || '');
              const leadData = {
                ...mappingResult.leadData,
                email: mappingResult.leadData.email || mappingResult.contactData.email,
                fullName: nameParts.fullName,
                firstName: nameParts.firstName,
                middleName: nameParts.middleName,
                lastName: nameParts.lastName,
                status: 'new' as const,
                userId
              };
              
              const lead = await tenantStorage.createLead(leadData);
              
              console.log('✅ NEW LEAD CREATED FOR EXISTING CONTACT:', {
                leadId: lead.id,
                contactId: existingContact.id,
                leadEmail: lead.email,
                leadName: lead.fullName,
                tenantId: form.tenantId,
                slug
              });
              
              // Continue with the rest of the submission flow...
              // Store consent if required
              if (form.consentRequired && consentGiven) {
                try {
                  await tenantStorage.createLeadConsent({
                    leadId: lead.id,
                    formId: form.id,
                    consentType: 'processing',
                    consentGiven: true,
                    consentText: form.consentText || 'I consent to processing my personal data for contact purposes.',
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')?.slice(0, 500),
                  });
                  console.log('✅ CONSENT RECORDED:', { leadId: lead.id, consentType: 'processing', tenantId: form.tenantId });
                } catch (consentError) {
                  console.error('❌ Failed to record consent:', { leadId: lead.id, error: consentError });
                }
              }
              
              // Skip contact creation, use existing contact for project creation
              const projectData = {
                ...mappingResult.projectData,
                name: `${mappingResult.leadData.event_type || 'Project'} - ${existingContact.firstName} ${existingContact.lastName}`,
                contactId: existingContact.id,
                status: 'active' as const,
                userId
              };
              
              const project = await tenantStorage.createProject(projectData);
              
              console.log('✅ NEW PROJECT CREATED FOR EXISTING CONTACT:', {
                projectId: project.id,
                projectName: project.name,
                contactId: existingContact.id,
                tenantId: form.tenantId,
                slug
              });
              
              // Update lead with project reference
              await tenantStorage.updateLead(lead.id, { 
                projectId: project.id,
                notes: `Auto-linked to Contact: ${existingContact.id} and Project: ${project.id} on ${new Date().toLocaleDateString()}`
              });
              
              // Record new form submission
              await tenantStorage.createFormSubmission({
                formId: form.id,
                submissionKey: submissionKey, 
                ipAddress: req.ip?.slice(0, 15) || 'unknown',
                userAgent: req.get('User-Agent')?.slice(0, 200) || 'unknown',
                leadId: lead.id,
                status: 'processed',
                metadata: JSON.stringify({
                  contactId: existingContact.id,
                  projectId: project.id,
                  venueId: null
                }),
                submittedAt: new Date(),
                expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days
              });
              
              console.log('✅ DUPLICATE SUBMISSION HANDLED - REUSED CONTACT, CREATED NEW PROJECT:', {
                leadId: lead.id,
                contactId: existingContact.id,
                projectId: project.id,
                submissionKey: submissionKey.slice(0, 8) + '***',
                tenantId: form.tenantId
              });
              
              return res.json({
                ok: true,
                leadId: lead.id,
                afterSubmit: {
                  type: 'message',
                  message: 'Thank you! We have logged another project for you.'
                }
              });
            } else {
              // Contact was deleted - clean up stale submission and continue as new
              console.log('🧹 CLEANING UP STALE SUBMISSION - CONTACT DELETED:', {
                submissionId: existingSubmission.id,
                staleContactId: metadata.contactId,
                slug,
                tenantId: form.tenantId
              });
              
              // Delete the stale form submission entry
              try {
                await storage.deleteFormSubmission(existingSubmission.id);
                console.log('✅ STALE FORM SUBMISSION CLEANED UP:', { submissionId: existingSubmission.id });
              } catch (cleanupError) {
                console.warn('⚠️ Failed to clean up stale submission:', cleanupError);
              }
              
              // Continue as new submission (fall through to normal creation logic)
            }
          } catch (contactCheckError) {
            console.warn('⚠️ Failed to check existing contact, continuing as new submission:', contactCheckError);
            // Continue as new submission if contact check fails
          }
        } else {
          // No contactId in metadata - treat as new submission
          console.log('🔄 NO CONTACT ID IN METADATA - CONTINUING AS NEW SUBMISSION:', {
            submissionId: existingSubmission.id,
            slug,
            tenantId: form.tenantId
          });
        }
      }
    } catch (idempotencyError) {
      console.warn('⚠️ Idempotency check failed, continuing:', idempotencyError);
      // Continue with submission if idempotency check fails
    }

    // Create lead from mapped data using TENANT-SCOPED storage
    const nameParts = splitFullName(mappingResult.leadData.fullName || '');
    const leadData = {
      ...mappingResult.leadData,
      email: mappingResult.leadData.email || mappingResult.contactData.email,
      fullName: nameParts.fullName,
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
      status: 'new' as const,
      userId
    };

    const lead = await tenantStorage.createLead(leadData);
    
    console.log('✅ LEAD CREATED:', {
      leadId: lead.id,
      leadEmail: lead.email,
      leadName: lead.fullName,
      tenantId: form.tenantId,
      slug,
      timestamp: new Date().toISOString()
    });

    // SECURITY: Store consent information for GDPR compliance - Use tenant-scoped storage
    if (form.consentRequired && consentGiven) {
      try {
        await tenantStorage.createLeadConsent({
          leadId: lead.id,
          formId: form.id,
          consentType: 'processing',
          consentGiven: true,
          consentText: form.consentText || 'I consent to processing my personal data for contact purposes.',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')?.slice(0, 500), // Limit length
        });
        console.log('✅ CONSENT RECORDED:', { leadId: lead.id, consentType: 'processing', tenantId: form.tenantId });
      } catch (consentError) {
        console.error('❌ Failed to record consent:', { leadId: lead.id, error: consentError });
        // Continue with form processing even if consent logging fails
      }
    }

    // Store custom field responses using tenant-scoped storage
    if (mappingResult.customFieldData && mappingResult.customFieldData.length > 0) {
      console.log('🎯 STORING CUSTOM FIELDS:', { 
        leadId: lead.id, 
        customFieldCount: mappingResult.customFieldData.length,
        customFields: mappingResult.customFieldData 
      });
      
      for (const customField of mappingResult.customFieldData) {
        try {
          const customFieldResponse = {
            leadId: lead.id,
            fieldKey: customField.key,
            value: customField.value ? String(customField.value) : null,
            submittedAt: new Date(),
            updatedAt: new Date()
          };
          
          await tenantStorage.upsertLeadCustomFieldResponse(customFieldResponse);
          console.log('✅ Stored custom field response:', { fieldKey: customField.key, leadId: lead.id });
        } catch (error) {
          console.error('❌ Failed to store custom field response:', { 
            fieldKey: customField.key, 
            leadId: lead.id, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    }

    // Create contact from mapped data using TENANT-SCOPED storage
    const contactData = {
      ...mappingResult.contactData,
      email: mappingResult.contactData.email || mappingResult.leadData.email,
      phone: mappingResult.leadData.phone, // Transfer phone from lead data
      // Use the correct field names that match Zod schema
      fullName: nameParts.fullName,
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
      notes: `Auto-created from lead form on ${new Date().toLocaleDateString('en-GB')}`, // Use dd/mm/yyyy format
      userId
    };

    const contact = await tenantStorage.createContact(contactData);
    
    console.log('✅ CONTACT CREATED:', {
      contactId: contact.id,
      contactEmail: contact.email,
      contactName: contact.fullName,
      tenantId: form.tenantId,
      slug,
      timestamp: new Date().toISOString()
    });

    // Create/update venue if venue information exists with deduplication logic
    let createdVenue = null;
    if (mappingResult.contactData.venueAddress) {
      try {
        // Build venue details in the format expected by venuesService
        const venueDetails = {
          placeId: formData.eventLocationPlaceId || null,
          name: mappingResult.contactData.venueAddress?.split(',')[0]?.trim() || 'Venue',
          address1: mappingResult.contactData.venueAddress,
          address2: undefined, // Use undefined instead of null for PlaceDetails interface
          city: mappingResult.contactData.venue_city || '',
          state: mappingResult.contactData.venue_state || '',
          postalCode: mappingResult.contactData.venue_zip_code || '',
          countryCode: mappingResult.contactData.venue_country || 'GB',
          latitude: formData.eventLocationLat ? parseFloat(formData.eventLocationLat) : 0,
          longitude: formData.eventLocationLng ? parseFloat(formData.eventLocationLng) : 0,
        };

        // Only create venue if we have meaningful address information
        if (venueDetails.address1 || venueDetails.city) {
          if (venueDetails.placeId) {
            // For Google Places venues, use upsert which handles deduplication automatically
            createdVenue = await venuesService.upsertFromPlace(venueDetails, form.tenantId);
            console.log('✅ VENUE UPSERTED (Google Places):', {
              venueId: createdVenue.id,
              venueName: createdVenue.name,
              placeId: venueDetails.placeId,
              tenantId: form.tenantId
            });
          } else {
            // For manually entered venues, implement deduplication logic
            const searchQuery = `${venueDetails.name} ${venueDetails.address1}`.trim();
            const existingVenues = await venuesService.findByAddress(searchQuery);
            
            // Filter by tenant to ensure proper isolation
            const tenantVenues = existingVenues.filter(v => v.tenantId === form.tenantId);
            
            if (tenantVenues.length > 0) {
              // Use the most relevant existing venue (findByAddress already sorts by useCount and lastUsedAt)
              createdVenue = tenantVenues[0];
              
              // Update venue usage tracking
              await tenantStorage.updateVenue(createdVenue.id, {
                useCount: (createdVenue.useCount || 0) + 1,
                lastUsedAt: new Date()
              });
              
              console.log('✅ VENUE REUSED (Deduplication):', {
                venueId: createdVenue.id,
                venueName: createdVenue.name,
                venueAddress: createdVenue.address,
                newUseCount: (createdVenue.useCount || 0) + 1,
                tenantId: form.tenantId,
                searchQuery
              });
            } else {
              // Create new venue since no duplicates found
              createdVenue = await venuesService.createVenue({
                name: venueDetails.name,
                tenantId: form.tenantId,
                address: venueDetails.address1,
                city: venueDetails.city,
                state: venueDetails.state,
                zipCode: venueDetails.postalCode,
                country: venueDetails.countryCode,
                latitude: venueDetails.latitude ? venueDetails.latitude.toString() : null,
                longitude: venueDetails.longitude ? venueDetails.longitude.toString() : null,
                useCount: 1, // Start with count of 1 since it's being used immediately
                lastUsedAt: new Date()
              });
              
              console.log('✅ VENUE CREATED (New):', {
                venueId: createdVenue.id,
                venueName: createdVenue.name,
                venueAddress: createdVenue.address,
                tenantId: form.tenantId
              });
            }
          }

          // Update contact with venue reference using TENANT-SCOPED storage
          if (createdVenue) {
            await tenantStorage.updateContact(contact.id, { 
              venueId: createdVenue.id 
            });
          }
        }
      } catch (error) {
        console.error('❌ Failed to create/update venue:', {
          error: error instanceof Error ? error.message : String(error),
          venueData: mappingResult.contactData,
          tenantId: form.tenantId,
          slug,
          timestamp: new Date().toISOString()
        });
        // Continue with form submission even if venue creation fails
      }
    }

    // Create project from mapped data using TENANT-SCOPED storage
    const projectData = {
      ...mappingResult.projectData,
      name: `${mappingResult.leadData.eventType || 'Event'} - ${nameParts.fullName || 'Unknown'}`,
      description: `${mappingResult.leadData.eventType || 'Event'} at ${mappingResult.contactData.venueAddress || 'TBD'}`,
      contactId: contact.id,
      venueId: createdVenue?.id || null, // Link project to venue if created
      status: 'pending' as const,
      progress: 0,
      userId,
      // Copy project date from lead to project start date for proper conflict detection
      startDate: mappingResult.leadData.projectDate || null
    };

    const project = await tenantStorage.createProject(projectData);
    
    console.log('✅ PROJECT CREATED:', {
      projectId: project.id,
      projectName: project.name,
      contactId: contact.id,
      tenantId: form.tenantId,
      slug,
      timestamp: new Date().toISOString()
    });

    // Update lead to link it to the created contact and project using TENANT-SCOPED storage
    await tenantStorage.updateLead(lead.id, { 
      projectId: project.id,
      notes: `Auto-linked to Contact: ${contact.id} and Project: ${project.id} on ${new Date().toLocaleDateString('en-GB')}`
    });
    
    console.log('✅ LEAD UPDATED:', {
      leadId: lead.id,
      contactId: contact.id,
      projectId: project.id,
      tenantId: form.tenantId,
      slug,
      timestamp: new Date().toISOString()
    });

    // SECURITY: Record successful submission for idempotency tracking - Use tenant-scoped storage
    try {
      const submissionRecord = {
        formId: form.id,
        submissionKey,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')?.slice(0, 500), // Limit length
        leadId: lead.id,
        status: 'processed' as const,
        metadata: JSON.stringify({
          contactId: contact.id,
          projectId: project.id,
          venueId: createdVenue?.id || null
        }),
        expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days TTL
      };
      
      await tenantStorage.createFormSubmission(submissionRecord);
      console.log('✅ IDEMPOTENCY RECORDED:', { 
        submissionKey: submissionKey.slice(0, 8) + '***', 
        leadId: lead.id,
        tenantId: form.tenantId
      });
    } catch (idempotencyRecordError) {
      console.error('❌ Failed to record idempotency:', { 
        leadId: lead.id, 
        tenantId: form.tenantId,
        error: idempotencyRecordError 
      });
      // Continue even if idempotency recording fails
    }

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
    console.error('🚨 FORM SUBMISSION ERROR:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      slug: req.params.slug,
      hasFormData: !!req.body,
      formDataKeys: req.body ? Object.keys(req.body) : [],
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Failed to submit form' });
  }
});

// reCAPTCHA config endpoint moved to server/routes.ts as a direct route to avoid middleware conflicts

export default router;