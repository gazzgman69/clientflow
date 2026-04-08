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
import { 
  adaptFormDataKeys, 
  validateRequiredFields, 
  normalizeDateInput,
  formatDateForDisplay,
  formatDateTimeForDisplay
} from '../../utils/formDataAdapter';
import { autoReplyService } from '../../auto-reply-service';

// dd/mm/yyyy HH:mm formatter (for logs)
function fmtDateTime(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

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
    const tenantId = (req as TenantRequest).tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Tenant context required' });
    const forms = await storage.getLeadCaptureForms(tenantId);
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
    // Try UUID lookup first, then fall back to slug lookup (for public routes)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let form = isUUID ? await storage.getLeadCaptureForm(id) : null;
    if (!form) {
      form = await storage.getLeadCaptureFormBySlug(id) ?? null;
    }

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
        autoResponderTemplateId: form.autoResponderTemplateId,
        autoResponderDelaySeconds: form.autoResponderDelaySeconds,
        calendarId: form.calendarId,
        lifecycleId: form.lifecycleId,
        workflowId: form.workflowId,
        contactTags: form.contactTags,
        projectTags: form.projectTags,
        recaptchaEnabled: form.recaptchaEnabled,
        isActive: form.isActive,
        transparency: (form as any).transparency || 'We will use this information to contact you about our services.',
        redirectUrl: form.redirectUrl || null,
        thankYouMessage: form.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.',
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
    if (form.autoResponderTemplateId !== undefined) updateData.autoResponderTemplateId = form.autoResponderTemplateId;
    if (form.autoResponderDelaySeconds !== undefined) updateData.autoResponderDelaySeconds = form.autoResponderDelaySeconds;
    if (form.calendarId !== undefined) updateData.calendarId = form.calendarId;
    if (form.lifecycleId !== undefined) updateData.lifecycleId = form.lifecycleId;
    if (form.workflowId !== undefined) updateData.workflowId = form.workflowId;
    if (form.contactTags !== undefined) updateData.contactTags = form.contactTags;
    if (form.projectTags !== undefined) updateData.projectTags = form.projectTags;
    if (form.recaptchaEnabled !== undefined) updateData.recaptchaEnabled = form.recaptchaEnabled;
    if (form.isActive !== undefined) updateData.isActive = form.isActive;
    if (form.consentRequired !== undefined) updateData.consentRequired = form.consentRequired;
    if (form.consentText !== undefined) updateData.consentText = form.consentText;
    if (form.privacyPolicyUrl !== undefined) updateData.privacyPolicyUrl = form.privacyPolicyUrl;
    if (form.redirectUrl !== undefined) updateData.redirectUrl = form.redirectUrl;
    if (form.thankYouMessage !== undefined) updateData.thankYouMessage = form.thankYouMessage;
    if (form.transparency !== undefined) updateData.transparency = form.transparency;

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



    // Include business logo for branding
    let businessLogo: string | null = null;
    let businessName: string = '';
    if (form.tenantId) {
      try {
        const tenant = await storage.getTenant(form.tenantId);
        businessName = tenant?.name || '';
        if (tenant?.settings) {
          const settings = JSON.parse(tenant.settings);
          businessLogo = settings.logoUrl || null;
        }
      } catch { /* non-fatal */ }
    }

    res.json({
      form: {
        id: form.id,
        title: form.name,
        slug: form.slug,
        recaptchaEnabled: form.recaptchaEnabled,
        transparency: (form as any).transparency || 'We will use this information to contact you about our services.',
        consentRequired: form.consentRequired,
        consentText: form.consentText,
        privacyPolicyUrl: form.privacyPolicyUrl,
        dataRetentionDays: form.dataRetentionDays,
        redirectUrl: form.redirectUrl || null,
        thankYouMessage: form.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.',
      },
      questions: questions,
      businessLogo,
      businessName,
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

    // Resolve the correct tenantId using a 3-tier priority:
    //  1. req.tenantId — set by tenantResolver on authenticated routes (most authoritative)
    //  2. form creator's tenant — resolved from the user who created the form (handles public routes)
    //  3. form.tenantId — last resort fallback (may be stale)
    let resolvedTenantId: string = form.tenantId;

    if ((req as any).tenantId && typeof (req as any).tenantId === 'string') {
      // Authenticated route: tenantResolver already resolved the correct tenant
      resolvedTenantId = (req as any).tenantId;
    } else {
      // Public route: no req.tenantId set by middleware.
      // Use the same strategy as tenantResolver: look up the 'default' tenant by slug.
      // This is correct for single-tenant Replit deployments where form.tenantId may be stale.
      try {
        const defaultTenant = await (storage as any).getTenantBySlug('default');
        if (defaultTenant?.id && typeof defaultTenant.id === 'string') {
          resolvedTenantId = defaultTenant.id;
          console.log('🔍 TENANT RESOLVED from default slug:', {
            slug,
            formId: form.id,
            defaultTenantId: resolvedTenantId,
            formTenantId: form.tenantId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (defaultLookupError) {
        console.error('❌ Failed to resolve default tenant, falling back to form.tenantId:', defaultLookupError);
      }
    }

    if (resolvedTenantId !== form.tenantId) {
      console.warn('⚠️ TENANT MISMATCH: using resolved tenantId over form.tenantId', {
        slug,
        formId: form.id,
        resolvedTenantId,
        formTenantId: form.tenantId,
        source: (req as any).tenantId ? 'req.tenantId' : 'creator lookup',
        timestamp: new Date().toISOString()
      });
    }

    // Create tenant-scoped storage for secure data operations
    const tenantStorage = new (await import('../../utils/tenantScopedStorage')).TenantScopedStorage(storage, resolvedTenantId);

    console.log('🏢 TENANT ISOLATION ACTIVE:', {
      slug,
      tenantId: resolvedTenantId,
      formTenantId: form.tenantId,
      reqTenantId: (req as any).tenantId,
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

    // Read-layer shim: normalize numeric keys ("1","2","3") to q-style ("q1","q_123...")
    function normalizeKeys(data: any, questions: any[]) {
      const byIndex = new Map<string, string>(); // "1" -> "q1", "2" -> "q2"
      questions
        .slice()
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .forEach((q, i) => byIndex.set(String(i + 1), q.id)); // q.id can be "q1" or "q_123..."
      const out: any = {};
      for (const [k, v] of Object.entries(data || {})) {
        const qid = byIndex.get(k) || k; // translate "1"->"q1"; keep real q_* ids
        out[qid] = v;
      }
      return out;
    }

    // Check if consent is required and validate
    const consentGiven = formData.consent === true || formData.consent === 'true';
    if (form.consentRequired && !consentGiven) {
      return res.status(400).json({ 
        error: 'Consent is required',
        message: 'You must provide consent to process your personal data.' 
      });
    }
    
    // Public submissions: assign to form owner so they can access the resulting projects
    const userId = form.createdBy;

    // Unique request ID for tracing this specific request through the logs
    const reqId = crypto.randomBytes(4).toString('hex');
    console.log(`🔵 [${reqId}] === NEW FORM SUBMISSION REQUEST ===`, {
      slug,
      formId: form.id,
      tenantId: form.tenantId,
      ip: req.ip?.slice(0, 15),
      userAgent: req.get('User-Agent')?.slice(0, 80),
      timestamp: new Date().toISOString()
    });

    // ============================================================================
    // ADAPTER LAYER: Map numeric/q-style keys to canonical question IDs
    // ============================================================================
    
    // Extract raw data and normalize numeric keys to q-style
    const raw = (typeof req.body?.data === 'object') ? req.body.data : req.body;
    const dataNormalized = normalizeKeys(raw, questions);
    
    // Apply adapter to map incoming keys to question IDs
    const adapterResult = adaptFormDataKeys(dataNormalized, questions);
    
    // Extract non-data fields for later
    let nonDataFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (key !== 'data' && ['consent', 'website_url'].includes(key)) {
        nonDataFields[key] = value;
      }
    }
    
    // Log if numeric keys were translated
    if (adapterResult.translatedKeys.length > 0) {
      console.log('ℹ️ INFO: lead_form.mapping.translated', {
        slug,
        formId: form.id,
        tenantId: form.tenantId,
        translatedCount: adapterResult.translatedKeys.length,
        translations: adapterResult.translatedKeys,
        timestamp: new Date().toISOString()
      });
    }
    
    // Now transform adapted question IDs to canonical field names
    const transformedData: Record<string, any> = {};
    const questionIdToMapTo: Record<string, string> = {};
    
    // Build mapping from question ID to canonical field name
    for (const question of questions) {
      if (question.id && question.mapTo && question.mapTo !== 'nothing') {
        questionIdToMapTo[question.id] = question.mapTo;
      }
    }
    
    // Apply transformation: question ID → canonical field name
    for (const [key, value] of Object.entries(adapterResult.mappedData)) {
      if (questionIdToMapTo[key]) {
        // Normalize dates if this is the projectDate field
        if (questionIdToMapTo[key] === 'projectDate' && value) {
          const normalizedDate = normalizeDateInput(value);
          if (normalizedDate) {
            transformedData[questionIdToMapTo[key]] = normalizedDate;
          } else {
            console.warn('⚠️ WARN: Invalid date format for projectDate:', value);
            transformedData[questionIdToMapTo[key]] = value; // Keep original, will be handled later
          }
        } else {
          transformedData[questionIdToMapTo[key]] = value;
        }
      } else {
        // Keep unmapped keys as-is (for customFieldData)
        transformedData[key] = value;
      }
    }
    
    // Add back non-data fields (consent, honeypot, etc.)
    for (const [key, value] of Object.entries(nonDataFields)) {
      transformedData[key] = value;
    }
    
    // Compact transformation log (verbose debug removed)
    console.log('📋 Form data mapped:', { keys: Object.keys(transformedData), tenantId: form.tenantId });
    
    // Apply mapping registry to transform form data to database models
    const mappingResult = applyMapping(transformedData, {
      tenantId: form.tenantId,
      allowUnknownKeys: true, // Allow custom fields for now
      enableDeprecationWarnings: true
    });

    // ============================================================================
    // VALIDATION: Check required fields after mapping
    // ============================================================================
    
    // Validate that leadEmail is present (required for lead creation)
    const leadEmail = mappingResult.leadData.email || mappingResult.contactData.email;
    if (!leadEmail || (typeof leadEmail === 'string' && leadEmail.trim() === '')) {
      console.warn('⚠️ WARN: lead_form.mapping.missing_required', {
        slug,
        formId: form.id,
        tenantId: form.tenantId,
        missingField: 'leadEmail',
        submittedKeys: Object.keys(raw),
        mappingResult: {
          leadDataKeys: Object.keys(mappingResult.leadData),
          contactDataKeys: Object.keys(mappingResult.contactData)
        },
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        error: 'Missing required field',
        message: 'Email address is required. Please provide a valid email address.',
        field: 'email',
        hint: 'Make sure your form includes an email field with the correct mapping.'
      });
    }
    
    // Validate other required fields from questions
    const validation = validateRequiredFields(transformedData, questions);
    if (!validation.valid) {
      console.warn('⚠️ WARN: lead_form.mapping.missing_required', {
        slug,
        formId: form.id,
        tenantId: form.tenantId,
        missingFields: validation.missingFields,
        submittedKeys: Object.keys(raw),
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        error: 'Missing required fields',
        message: `The following required fields are missing: ${validation.missingFields.join(', ')}`,
        fields: validation.missingFields,
        hint: 'Please fill in all required fields and try again.'
      });
    }

    // SECURITY: Create submission fingerprint AFTER mapping to use normalized data
    const submissionFingerprint = {
      slug,
      formId: form.id,
      email: mappingResult.leadData.email || mappingResult.contactData.email || 'no-email',
      phone: mappingResult.leadData.phone || mappingResult.contactData.phone || 'no-phone',
      timestamp: new Date().toDateString(), // Same day submissions considered duplicates
    };
    
    const submissionKey = crypto
      .createHash('sha256')
      .update(JSON.stringify(submissionFingerprint))
      .digest('hex');

    console.log(`🔍 [${reqId}] Submission fingerprint:`, { slug, email: submissionFingerprint.email, key: submissionKey.slice(0, 8) + '***' });

    // Check for duplicate submission using idempotency key - SECURITY: Use tenant-scoped storage
    try {
      const existingSubmission = await tenantStorage.getFormSubmissionByKey(submissionKey);
      if (existingSubmission) {
        console.log(`🔍 [${reqId}] DUPLICATE SUBMISSION DETECTED:`, {
          submissionKey: submissionKey.slice(0, 8) + '***',
          existingSubmissionId: existingSubmission.id,
          existingStatus: existingSubmission.status,
          existingMetadata: existingSubmission.metadata,
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
            // Guard: if this submission was completed very recently (within 30s),
            // it's a duplicate click — return success without creating anything new.
            const submittedAt = existingSubmission.submittedAt ? new Date(existingSubmission.submittedAt).getTime() : 0;
            const submissionAge = (Date.now() - submittedAt) / 1000;

            if (submittedAt && submissionAge < 30) {
              console.log(`🛡️ [${reqId}] DUPLICATE CLICK DETECTED (` + Math.round(submissionAge) + 's since last submission), returning existing result:', {
                submissionId: existingSubmission.id,
                slug,
                tenantId: form.tenantId
              });
              return res.json({
                ok: true,
                duplicate: true,
                afterSubmit: {
                  type: form.redirectUrl ? 'redirect' : 'message',
                  redirectUrl: form.redirectUrl || null,
                  message: form.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.'
                }
              });
            }

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
              
              console.log('✅ NEW LEAD CREATED FOR EXISTING CONTACT:', {
                leadId: lead.id,
                contactId: existingContact.id,
                leadEmail: lead.email,
                leadName: lead.fullName,
                tenantId: form.tenantId,
                slug
              });
              
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
              // Still create venue record if address was provided
              let dupVenueId: string | null = null;
              if (mappingResult.contactData.venueAddress) {
                try {
                  const dupPlaceId = raw.eventLocationPlaceId || null;
                  if (dupPlaceId) {
                    // Google Places venue — use upsertFromPlace for proper deduplication by placeId
                    const dupVenueDetails = {
                      placeId: dupPlaceId,
                      name: mappingResult.contactData.venueAddress?.split(',')[0]?.trim() || 'Venue',
                      address1: mappingResult.contactData.venueAddress,
                      address2: undefined,
                      city: mappingResult.contactData.venueCity || raw.eventLocationCity || '',
                      state: mappingResult.contactData.venueState || raw.eventLocationState || '',
                      postalCode: mappingResult.contactData.venueZipCode || raw.eventLocationZipCode || '',
                      countryCode: mappingResult.contactData.venueCountry || raw.eventLocationCountry || 'GB',
                      latitude: raw.eventLocationLat ? parseFloat(raw.eventLocationLat) : 0,
                      longitude: raw.eventLocationLng ? parseFloat(raw.eventLocationLng) : 0,
                      contactPhone: raw.eventLocationPhone || null,
                    };
                    const dupVenue = await venuesService.upsertFromPlace(dupVenueDetails, form.tenantId);
                    dupVenueId = dupVenue.id;
                  } else {
                    // Manual venue — use findOrCreateVenue with normalized name+address dedup
                    const dupVenueData = {
                      name: mappingResult.contactData.venueAddress.split(',')[0].trim() || 'Venue',
                      address: mappingResult.contactData.venueAddress,
                      city: mappingResult.contactData.venueCity || raw.eventLocationCity || '',
                      state: mappingResult.contactData.venueState || raw.eventLocationState || '',
                      zipCode: mappingResult.contactData.venueZipCode || raw.eventLocationZipCode || '',
                      country: mappingResult.contactData.venueCountry || raw.eventLocationCountry || 'GB',
                      lastUsedAt: new Date(),
                      tenantId: form.tenantId,
                    };
                    const dupVenue = await venuesService.findOrCreateVenue(dupVenueData, form.tenantId);
                    dupVenueId = dupVenue.id;
                  }
                } catch (venueErr) {
                  console.error('❌ DUPLICATE PATH: venue creation failed:', venueErr);
                }
              }

              const dupProjectNotes = mappingResult.leadData.notes || mappingResult.leadData.message || '';
              const projectData = {
                ...mappingResult.projectData,
                name: `${existingContact.firstName} ${existingContact.lastName} - ${mappingResult.leadData.eventType || 'Event'}`,
                description: dupProjectNotes || null,
                eventType: mappingResult.leadData.eventType || null,
                contactId: existingContact.id,
                venueId: dupVenueId,
                venueName: mappingResult.contactData.venueAddress?.split(',')[0]?.trim() || null,
                venueAddress: mappingResult.contactData.venueAddress || null,
                status: 'new' as const,
                progress: 0,
                userId,
                startDate: mappingResult.leadData.projectDate || null
              };

              console.log(`🏢 [${reqId}] DUPLICATE PATH projectData BEFORE createProject:`, {
                venueId: projectData.venueId,
                venueName: projectData.venueName,
                venueAddress: projectData.venueAddress,
                contactVenueAddress: mappingResult.contactData.venueAddress,
                dupVenueId,
                projectDataKeys: Object.keys(projectData),
              });

              const project = await tenantStorage.createProject(projectData);

              console.log(`✅ [${reqId}] NEW PROJECT CREATED FOR EXISTING CONTACT (DUPLICATE PATH):`, {
                projectId: project.id,
                projectName: project.name,
                projectVenueId: project.venueId,
                projectVenueName: (project as any).venueName,
                projectVenueAddress: (project as any).venueAddress,
                contactId: existingContact.id,
                tenantId: form.tenantId,
                slug
              });
              
              // Update lead with project reference
              await tenantStorage.updateLead(lead.id, { 
                projectId: project.id,
                notes: `Auto-linked to Contact: ${existingContact.id} and Project: ${project.id} on ${new Date().toLocaleDateString()}`
              });

              // Auto-create calendar event if lead has a projectDate
              // Use original lead object since updateLead only returns updated fields
              if (lead && lead.projectDate) {
                try {
                  const eventStart = new Date(lead.projectDate);
                  
                  // Detect if projectDate is date-only (no time component)
                  const projectDateStr = String(lead.projectDate);
                  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(projectDateStr) || 
                                     (eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && eventStart.getSeconds() === 0);
                  
                  // For date-only: all-day + transparent (free). For timed: 1-hour + busy
                  const eventEnd = new Date(eventStart);
                  if (!isDateOnly) {
                    eventEnd.setHours(eventEnd.getHours() + 1); // Timed event: 1-hour duration
                  }
                  
                  // Create event with status-aware title: "Enquiry • [Name]"
                  const leadName = lead.fullName || lead.email || 'Unknown';
                  const eventTitle = `Enquiry • ${leadName}`;
                  
                  // Build description with form details
                  let eventDescription = lead.notes || '';
                  
                  const createdEvent = await tenantStorage.createEvent({
                    title: eventTitle,
                    description: eventDescription || undefined,
                    startDate: eventStart,
                    endDate: eventEnd,
                    location: lead.eventLocation || undefined,
                    attendees: lead.email ? [lead.email] : undefined,
                    userId,
                    leadId: lead.id,
                    projectId: project.id, // Link to project so it updates with project changes
                    contactId: null, // Explicitly set to null to avoid CASCADE delete when contact is deleted
                    type: 'lead',
                    allDay: isDateOnly,
                    status: 'tentative', // Pre-booked = tentative
                    transparency: 'free', // Pre-booked = free (don't block calendar)
                    createdBy: userId || form.createdBy
                  });
                  
                  console.log(`📅 Auto-created calendar event for duplicate submission lead ${lead.id} linked to project ${project.id}: "${eventTitle}"`);

                  // Enqueue for async Google Calendar push
                  const { googleOutbox } = await import('../../services/googleOutbox');
                  googleOutbox.enqueue({ eventId: createdEvent.id, tenantId: form.tenantId ?? undefined });
                } catch (calError) {
                  console.error('❌ CALENDAR EVENT CREATION FAILED (duplicate submission path):', {
                    leadId: lead.id,
                    projectId: project.id,
                    error: calError instanceof Error ? calError.message : String(calError),
                    stack: calError instanceof Error ? calError.stack : undefined,
                    tenantId: form.tenantId
                  });
                  // Don't fail the lead creation if calendar event fails
                }
              }
              
              // Update existing submission record with new project info (don't create — record already exists)
              try {
                await storage.updateFormSubmission(existingSubmission.id, {
                  leadId: lead.id,
                  status: 'processed' as any,
                  metadata: JSON.stringify({
                    contactId: existingContact.id,
                    projectId: project.id,
                    venueId: dupVenueId || null
                  }),
                }, form.tenantId);
              } catch (submissionUpdateErr) {
                console.warn('⚠️ Failed to update submission record (non-fatal):', submissionUpdateErr);
              }
              
              console.log('✅ DUPLICATE SUBMISSION HANDLED - REUSED CONTACT, CREATED NEW PROJECT:', {
                leadId: lead.id,
                contactId: existingContact.id,
                projectId: project.id,
                submissionKey: submissionKey.slice(0, 8) + '***',
                tenantId: form.tenantId
              });
              
              // Queue auto-responder if template configured
              if (form.autoResponderTemplateId) {
                try {
                  const delaySeconds = form.autoResponderDelaySeconds || 60;
                  const scheduledFor = new Date(Date.now() + (delaySeconds * 1000));
                  
                  const delayLabel = delaySeconds === 60 ? '1 minute'
                    : delaySeconds === 300 ? '5 minutes'
                    : delaySeconds === 600 ? '10 minutes'
                    : delaySeconds === 1800 ? '30 minutes'
                    : delaySeconds === 3600 ? '1 hour'
                    : `${delaySeconds} seconds`;
                  
                  await tenantStorage.createAutoResponderLog({
                    leadId: lead.id,
                    templateId: form.autoResponderTemplateId,
                    formId: form.id,
                    scheduledFor,
                    status: 'queued' as const,
                    retryCount: 0,
                  });
                  console.log('✅ AUTO-RESPONDER QUEUED (DUPLICATE PATH):', {
                    leadId: lead.id,
                    leadEmail: lead.email,
                    templateId: form.autoResponderTemplateId,
                    formId: form.id,
                    delay: delayLabel,
                    delaySeconds,
                    scheduledFor: scheduledFor.toISOString(),
                    tenantId: form.tenantId
                  });
                } catch (autoResponderError) {
                  console.error('❌ AUTO-RESPONDER QUEUE FAILED (DUPLICATE PATH):', {
                    leadId: lead.id,
                    templateId: form.autoResponderTemplateId,
                    error: autoResponderError instanceof Error ? autoResponderError.message : String(autoResponderError),
                    tenantId: form.tenantId
                  });
                }
              }
              
              return res.json({
                ok: true,
                leadId: lead.id,
                afterSubmit: {
                  type: form.redirectUrl ? 'redirect' : 'message',
                  redirectUrl: form.redirectUrl || null,
                  message: form.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.'
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
            console.warn('⚠️ Failed to check existing contact, cleaning up and continuing:', contactCheckError);
            try {
              await storage.deleteFormSubmission(existingSubmission.id);
            } catch { /* ignore */ }
          }
        } else {
          // No contactId in metadata — could be still processing or genuinely broken.
          // Check claimedAt: if less than 60 seconds old, still processing — return success.
          const claimedAt = metadata.claimedAt ? new Date(metadata.claimedAt).getTime() : 0;
          const ageSeconds = (Date.now() - claimedAt) / 1000;

          if (claimedAt && ageSeconds < 60) {
            console.log(`⏳ [${reqId}] SUBMISSION STILL PROCESSING (claimed ` + Math.round(ageSeconds) + 's ago), returning success:', {
              submissionId: existingSubmission.id,
              slug,
              tenantId: form.tenantId
            });
            return res.json({
              ok: true,
              duplicate: true,
              afterSubmit: {
                type: form.redirectUrl ? 'redirect' : 'message',
                redirectUrl: form.redirectUrl || null,
                message: form.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.'
              }
            });
          }

          // Genuinely stale/broken record (older than 60s with no contactId) — clean it up
          console.log(`🧹 [${reqId}] CLEANING UP BROKEN SUBMISSION RECORD (no contactId, ` + Math.round(ageSeconds) + 's old):', {
            submissionId: existingSubmission.id,
            slug,
            tenantId: form.tenantId
          });
          try {
            await storage.deleteFormSubmission(existingSubmission.id);
          } catch (cleanupError) {
            console.warn('⚠️ Failed to clean up broken submission:', cleanupError);
          }
          // Continue as new submission (fall through to normal creation logic)
        }
      }
    } catch (idempotencyError) {
      console.warn('⚠️ Idempotency check failed, continuing:', idempotencyError);
      // Continue with submission if idempotency check fails
    }

    // ============================================================================
    // RACE CONDITION GUARD: Claim the submission key BEFORE creating any records.
    // If two requests arrive simultaneously, only one will succeed inserting
    // the pending record — the other hits the unique constraint and aborts.
    // ============================================================================
    try {
      await tenantStorage.createFormSubmission({
        formId: form.id,
        submissionKey,
        ipAddress: req.ip?.slice(0, 15) || 'unknown',
        userAgent: req.get('User-Agent')?.slice(0, 200) || 'unknown',
        leadId: null,
        status: 'pending' as any,
        metadata: JSON.stringify({ claimedAt: new Date().toISOString() }),
        submittedAt: new Date(),
        expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
      });
    } catch (claimError: any) {
      // Unique constraint violation = another request already claimed this submission
      if (claimError?.code === '23505' || claimError?.message?.includes('unique') || claimError?.message?.includes('duplicate')) {
        console.log(`🛡️ [${reqId}] RACE CONDITION BLOCKED: duplicate simultaneous submission`, {
          submissionKey: submissionKey.slice(0, 8) + '***',
          slug,
          tenantId: form.tenantId,
          timestamp: new Date().toISOString()
        });
        return res.json({
          ok: true,
          afterSubmit: {
            type: form.redirectUrl ? 'redirect' : 'message',
            redirectUrl: form.redirectUrl || null,
            message: form.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.'
          }
        });
      }
      // Non-constraint error — log and continue
      console.warn('⚠️ Submission claim failed (non-constraint):', claimError);
    }

    // Create lead from mapped data using TENANT-SCOPED storage
    const startTime = Date.now();
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

    const leadStartTime = Date.now();
    const lead = await tenantStorage.createLead(leadData);
    const leadEndTime = Date.now();
    
    console.log('⏱️ PERFORMANCE: Lead creation completed in', leadEndTime - leadStartTime, 'ms');
    console.log('✅ LEAD CREATED:', {
      leadId: lead.id,
      leadEmail: lead.email,
      leadName: lead.fullName,
      projectDate: lead.projectDate,
      hasProjectDate: !!lead.projectDate,
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

    // PARALLEL PROCESSING OPTIMIZATION: Run contact creation and venue processing simultaneously
    const parallelStartTime = Date.now();
    
    // Prepare contact data
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

    // Prepare venue processing function
    const venueStartTime = Date.now();
    const venueProcessingPromise = (async () => {
      let createdVenue = null;
      
      if (mappingResult.contactData.venueAddress) {
        try {
          // Build venue details using structured address fields  
          // Use raw (req.body.data) for eventLocation sub-fields — they are NOT in req.body directly
          const venueDetails = {
            placeId: raw.eventLocationPlaceId || null,
            name: mappingResult.contactData.venueAddress?.split(',')[0]?.trim() || 'Venue',
            address1: mappingResult.contactData.venueAddress, // Keep full address for reference
            address2: undefined, // Use undefined instead of null for PlaceDetails interface
            city: mappingResult.contactData.venueCity || raw.eventLocationCity || '',
            state: mappingResult.contactData.venueState || raw.eventLocationState || '',
            postalCode: mappingResult.contactData.venueZipCode || raw.eventLocationZipCode || '',
            countryCode: mappingResult.contactData.venueCountry || raw.eventLocationCountry || 'GB',
            latitude: raw.eventLocationLat ? parseFloat(raw.eventLocationLat) : 0,
            longitude: raw.eventLocationLng ? parseFloat(raw.eventLocationLng) : 0,
            contactPhone: raw.eventLocationPhone || null,
          };

          console.log('🏢 VENUE CREATION DEBUG:', {
            hasVenueAddress: !!mappingResult.contactData.venueAddress,
            venueDetails: {
              name: venueDetails.name,
              address1: venueDetails.address1,
              city: venueDetails.city,
              state: venueDetails.state,
              postalCode: venueDetails.postalCode,
              countryCode: venueDetails.countryCode,
              placeId: venueDetails.placeId
            },
            willCreateVenue: !!(venueDetails.address1 || venueDetails.city),
            tenantId: form.tenantId
          });

          // Only create venue if we have meaningful address information
          // Enhanced condition: address1 (full address) OR city is sufficient
          if (venueDetails.address1 || venueDetails.city) {
            if (venueDetails.placeId) {
              // For Google Places venues, use upsert which handles deduplication automatically
              console.log('🔍 CREATING VENUE FROM GOOGLE PLACES:', { placeId: venueDetails.placeId, tenantId: form.tenantId });
              createdVenue = await venuesService.upsertFromPlace(venueDetails, form.tenantId);
              console.log('✅ VENUE UPSERTED (Google Places):', {
                venueId: createdVenue.id,
                venueName: createdVenue.name,
                placeId: venueDetails.placeId,
                tenantId: form.tenantId
              });
            } else {
              // For manually entered venues, use the robust deduplication logic
              const venueData = {
                name: venueDetails.name,
                address: venueDetails.address1,
                city: venueDetails.city || '', // Ensure it's a string, not undefined
                state: venueDetails.state || '',
                zipCode: venueDetails.postalCode || '',
                country: venueDetails.countryCode || 'GB',
                contactPhone: venueDetails.contactPhone || null, // Include phone number
                latitude: venueDetails.latitude ? venueDetails.latitude.toString() : null,
                longitude: venueDetails.longitude ? venueDetails.longitude.toString() : null,
                lastUsedAt: new Date(),
                tenantId: form.tenantId // Add required tenantId
              };

              console.log('🔍 CREATING VENUE FROM MANUAL ENTRY:', {
                venueData,
                tenantId: form.tenantId,
                hasNameAndAddress: !!(venueData.name && venueData.address)
              });

              // Use findOrCreateVenue which has robust normalization-based deduplication
              createdVenue = await venuesService.findOrCreateVenue(venueData, form.tenantId);

              console.log('✅ VENUE CREATED/FOUND (Manual):', {
                venueId: createdVenue.id,
                venueName: createdVenue.name,
                venueAddress: createdVenue.address,
                tenantId: form.tenantId
              });
            }

            // Auto-enrich the venue with full Google Places data (phone, website, rating,
            // opening hours etc.) — runs in the background so it never delays the response.
            if (createdVenue) {
              venuesService.tryAutoEnrichVenue(createdVenue.id, form.tenantId)
                .then(enriched => {
                  if (enriched) console.log(`✅ AUTO-ENRICHED venue "${enriched.name}" from form submission`);
                })
                .catch(err => console.warn('⚠️ Background venue enrichment failed (non-fatal):', err));
            }
          } else {
            console.log('⚠️ VENUE CREATION SKIPPED - NO ADDRESS DATA:', {
              address1: venueDetails.address1,
              city: venueDetails.city,
              venueAddress: mappingResult.contactData.venueAddress,
              tenantId: form.tenantId
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : '';
          console.error('❌ Failed to create/update venue:', {
            error: errorMsg,
            stack: errorStack,
            venueData: mappingResult.contactData,
            tenantId: form.tenantId,
            slug,
            timestamp: new Date().toISOString()
          });
          // Write to file so error is visible even with noisy console
          try {
            const fs = await import('fs');
            const logEntry = `[${new Date().toISOString()}] VENUE ERROR: ${errorMsg}\nStack: ${errorStack}\nVenueAddress: ${mappingResult.contactData.venueAddress}\nTenantId: ${form.tenantId}\n---\n`;
            fs.appendFileSync('/tmp/venue-errors.log', logEntry);
          } catch { /* ignore file logging errors */ }
          // Continue with form submission even if venue creation fails
        }
      }
      
      return createdVenue;
    })();

    // Run contact creation and venue processing in parallel
    const contactStartTime = Date.now();
    const [contact, createdVenue] = await Promise.all([
      tenantStorage.createContact(contactData),
      venueProcessingPromise
    ]);
    console.log('✅ Contact created:', { id: contact.id, email: contact.email, ms: Date.now() - parallelStartTime });

    // DISABLED: Old immediate auto-reply system (replaced by template-based auto-responder with delays)
    // if (contact.email) {
    //   autoReplyService.sendAutoReply({
    //     contactId: contact.id,
    //     contactEmail: contact.email,
    //     contactName: contact.fullName || contact.firstName || 'there',
    //     tenantId: form.tenantId,
    //     userId
    //   }).catch(error => {
    //     console.error('❌ Auto-reply failed (non-blocking):', error);
    //     // Don't block form submission if auto-reply fails
    //   });
    // }

    // Update contact with venue reference if venue was created
    if (createdVenue) {
      await tenantStorage.updateContact(contact.id, { 
        venueId: createdVenue.id 
      });
      console.log('✅ CONTACT UPDATED WITH VENUE REFERENCE:', { contactId: contact.id, venueId: createdVenue.id });
    }

    // Create project from mapped data using TENANT-SCOPED storage
    const projectStartTime = Date.now();
    // Build description: use any extra notes/message from the form, not the event type + venue
    // (event type and venue are stored in their own fields on the project)
    const projectNotes = mappingResult.leadData.notes || mappingResult.leadData.message || '';
    const projectData = {
      ...mappingResult.projectData,
      name: `${nameParts.fullName || 'Unknown'} - ${mappingResult.leadData.eventType || 'Event'}`,
      description: projectNotes || null,
      eventType: mappingResult.leadData.eventType || null,
      contactId: contact.id,
      venueId: createdVenue?.id || null, // Link project to venue if created
      // Always copy venue name/address directly — preserved even if venue is later deleted
      venueName: createdVenue?.name || mappingResult.contactData.venueAddress?.split(',')[0]?.trim() || null,
      venueAddress: mappingResult.contactData.venueAddress || null,
      status: 'new' as const,  // 'pending' is not a valid status — must be 'new' so it appears in the CRM
      progress: 0,
      userId,
      // Copy project date from lead to project start date for proper conflict detection
      startDate: mappingResult.leadData.projectDate || null
    };

    console.log(`🏢 [${reqId}] NORMAL PATH projectData BEFORE createProject:`, {
      venueId: projectData.venueId,
      venueName: projectData.venueName,
      venueAddress: projectData.venueAddress,
      contactVenueAddress: mappingResult.contactData.venueAddress,
      createdVenueName: createdVenue?.name || null,
      projectDataKeys: Object.keys(projectData),
    });

    const project = await tenantStorage.createProject(projectData);
    const projectEndTime = Date.now();

    console.log(`✅ [${reqId}] PROJECT CREATED (NORMAL PATH):`, {
      id: project.id,
      venueId: project.venueId,
      venueName: (project as any).venueName,
      venueAddress: (project as any).venueAddress,
      ms: projectEndTime - projectStartTime
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

    // Auto-create calendar event if lead has a projectDate (now that we have projectId)
    // Use original lead object since updateLead only returns updated fields
    
    // Calendar event auto-creation check
    
    if (lead && lead.projectDate) {
      console.log('✅ Starting calendar event creation for lead:', lead.id);
      try {
        const eventStart = new Date(lead.projectDate);
        
        // Detect if projectDate is date-only (no time component)
        const projectDateStr = String(lead.projectDate);
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(projectDateStr) || 
                           (eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && eventStart.getSeconds() === 0);
        
        // For date-only: all-day + transparent (free). For timed: 1-hour + busy
        const eventEnd = new Date(eventStart);
        if (!isDateOnly) {
          eventEnd.setHours(eventEnd.getHours() + 1); // Timed event: 1-hour duration
        }
        
        // Create event with status-aware title: "Enquiry • [Name]"
        const leadName = lead.fullName || lead.email || 'Unknown';
        const eventTitle = `Enquiry • ${leadName}`;
        
        // Build description with form details
        let eventDescription = lead.notes || '';
        
        console.log('🔍 Getting Leads Calendar for tenant:', form.tenantId);
        // Get Leads Calendar for this tenant (tenantId handled by wrapper)
        const leadsCalendar = await tenantStorage.getCalendarByType('leads');
        console.log('📅 Leads Calendar found:', leadsCalendar);
        
        console.log('🔍 Creating event with data:', {
          title: eventTitle,
          startDate: eventStart,
          endDate: eventEnd,
          calendarId: leadsCalendar?.id,
          projectId: project.id,
          leadId: lead.id
        });
        
        // Idempotency guard: check for duplicate events within ±5 minutes of submission
        // Match by title + projectDate (not projectId, as re-submissions create new projects)
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const fiveMinAhead = new Date(Date.now() + 5 * 60 * 1000);
        const dateStr = eventStart.toISOString().split('T')[0]; // yyyy-mm-dd
        
        // Query for existing lead events with same title, created recently
        const allEvents = await tenantStorage.getEvents();
        const existing = allEvents.filter(e => 
          e.type === 'lead' &&
          e.title === eventTitle &&
          e.startDate.toISOString().split('T')[0] === dateStr &&
          e.createdAt && e.createdAt >= fiveMinAgo && e.createdAt <= fiveMinAhead
        );
        
        if (existing.length > 0) {
          console.info('ℹ️ INFO: calendar.event.duplicate_skipped', {
            tenantId: form.tenantId,
            projectId: project.id,
            title: eventTitle,
            start: fmtDateTime(existing[0].startDate),
            window: '±5m'
          });
        } else {
          const created = await tenantStorage.createEvent({
            title: eventTitle,
            description: eventDescription || undefined,
            startDate: eventStart,
            endDate: eventEnd,
            location: lead.eventLocation || undefined,
            calendarId: leadsCalendar?.id, // Assign to Leads Calendar
            userId,
            leadId: lead.id,
            projectId: project.id, // Link to project so it updates with project changes
            contactId: null, // Explicitly set to null to avoid CASCADE delete when contact is deleted
            type: 'lead',
            allDay: isDateOnly,
            status: 'tentative', // Pre-booked = tentative
            transparency: 'free', // Pre-booked = free (don't block calendar)
            createdBy: userId || form.createdBy
          });
          
          console.info('ℹ️ INFO: calendar.event.created', {
            tenantId: form.tenantId,
            projectId: project.id,
            eventId: created.id,
            title: eventTitle,
            start: fmtDateTime(eventStart)
          });

          // Enqueue for async Google Calendar push
          const { googleOutbox } = await import('../../services/googleOutbox');
          googleOutbox.enqueue({ eventId: created.id, tenantId: form.tenantId ?? undefined });
        }
      } catch (calError) {
        console.error('❌ CALENDAR EVENT CREATION FAILED:', {
          leadId: lead.id,
          projectId: project.id,
          error: calError instanceof Error ? calError.message : String(calError),
          stack: calError instanceof Error ? calError.stack : undefined,
          tenantId: form.tenantId
        });
        // Don't fail the lead creation if calendar event fails
      }
    } else {
      console.log('⚠️ NO CALENDAR EVENT - Condition failed:', {
        hasLead: !!lead,
        leadId: lead?.id,
        hasProjectDate: !!lead?.projectDate,
        projectDate: lead?.projectDate
      });
    }

    // Update the pending submission record with final details (created in race-guard above)
    try {
      const pendingSubmission = await tenantStorage.getFormSubmissionByKey(submissionKey);
      if (pendingSubmission) {
        await storage.updateFormSubmission(pendingSubmission.id, {
          leadId: lead.id,
          status: 'processed' as any,
          metadata: JSON.stringify({
            contactId: contact.id,
            projectId: project.id,
            venueId: createdVenue?.id || null
          }),
        }, resolvedTenantId);
      }
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

    // Queue auto-responder if template configured
    if (form.autoResponderTemplateId) {
      try {
        // Calculate send time based on configured delay (default 60 seconds if not set)
        // Supported delays: 60s (1min), 300s (5min), 600s (10min), 1800s (30min), 3600s (1hr)
        const delaySeconds = form.autoResponderDelaySeconds || 60;
        const scheduledFor = new Date(Date.now() + (delaySeconds * 1000));
        
        // Human-readable delay for logging
        const delayLabel = delaySeconds === 60 ? '1 minute'
          : delaySeconds === 300 ? '5 minutes'
          : delaySeconds === 600 ? '10 minutes'
          : delaySeconds === 1800 ? '30 minutes'
          : delaySeconds === 3600 ? '1 hour'
          : `${delaySeconds} seconds`;
        
        await tenantStorage.createAutoResponderLog({
          leadId: lead.id,
          templateId: form.autoResponderTemplateId,
          formId: form.id,
          scheduledFor,
          status: 'queued' as const,
          retryCount: 0,
        });
        console.log('✅ AUTO-RESPONDER QUEUED:', {
          leadId: lead.id,
          leadEmail: lead.email,
          templateId: form.autoResponderTemplateId,
          formId: form.id,
          delay: delayLabel,
          delaySeconds,
          scheduledFor: scheduledFor.toISOString(),
          tenantId: form.tenantId
        });
      } catch (autoResponderError) {
        console.error('❌ AUTO-RESPONDER QUEUE FAILED:', {
          leadId: lead.id,
          templateId: form.autoResponderTemplateId,
          error: autoResponderError instanceof Error ? autoResponderError.message : String(autoResponderError),
          tenantId: form.tenantId
        });
        // Don't fail form submission if auto-responder queueing fails
      }
    }
    
    // TODO: Trigger workflows if configured

    console.log(`✅ [${reqId}] === FORM SUBMISSION COMPLETE (NORMAL PATH) ===`, {
      ms: Date.now() - startTime,
      leadId: lead.id,
      projectId: project.id,
      contactId: contact.id,
      slug,
      tenantId: form.tenantId
    });

    res.json({
      ok: true,
      leadId: lead.id,
      _debug: { formTenantId: form.tenantId, resolvedTenantId, leadTenantId: lead.tenantId, reqTenantId: (req as any).tenantId || null },
      afterSubmit: {
        type: form.redirectUrl ? 'redirect' : 'message',
        redirectUrl: form.redirectUrl || null,
        message: form.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.'
      }
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('🚨 FORM SUBMISSION ERROR:', {
      error: errMsg,
      stack: errStack,
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