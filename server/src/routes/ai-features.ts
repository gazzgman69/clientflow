import { Router } from 'express';
import { storage } from '../../storage';
import {
  insertTenantOnboardingProgressSchema,
  insertMediaLibrarySchema,
  insertWidgetSettingsSchema,
  insertChatConversationSchema,
  insertChatMessageSchema,
  insertBookableServiceSchema,
  insertAvailabilityScheduleSchema,
  insertScheduleServiceSchema,
  insertAvailabilityRuleSchema,
  insertBookingSchema,
} from '@shared/schema';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { mkdir } from 'fs/promises';

const router = Router();

// Configure multer for media uploads with tenant isolation
const mediaUpload = multer({ 
  storage: multer.diskStorage({
    destination: async (req: any, file, cb) => {
      try {
        const tenantId = req.tenantId || 'default-tenant';
        const uploadDir = path.join(process.cwd(), 'media-uploads', tenantId);
        await mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error: any) {
        cb(error, '');
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'media-' + uniqueSuffix + ext);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Define SAFE partial schemas for updates - exclude tenantId and other protected fields
const updateOnboardingProgressSchema = insertTenantOnboardingProgressSchema.partial().omit({ tenantId: true });
const updateMediaLibrarySchema = insertMediaLibrarySchema.partial().omit({ tenantId: true, uploadedBy: true });
const updateChatConversationSchema = insertChatConversationSchema.partial().omit({ tenantId: true });
const updateChatMessageSchema = insertChatMessageSchema.partial().omit({ conversationId: true });
const updateBookableServiceSchema = insertBookableServiceSchema.partial().omit({ tenantId: true, createdBy: true });
const updateAvailabilityScheduleSchema = insertAvailabilityScheduleSchema.partial().omit({ tenantId: true });
const updateAvailabilityRuleSchema = insertAvailabilityRuleSchema.partial().omit({ scheduleId: true });
const updateBookingSchema = insertBookingSchema.partial().omit({ tenantId: true });

// ============================================================================
// TENANT ONBOARDING PROGRESS
// ============================================================================

// GET /api/ai-features/onboarding - Get tenant onboarding progress
router.get('/onboarding', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const progress = await storage.getTenantOnboardingProgress(tenantId);
    res.json(progress || null);
  } catch (error) {
    console.error('Error fetching onboarding progress:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding progress' });
  }
});

// POST /api/ai-features/onboarding - Create onboarding progress
router.post('/onboarding', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const data = insertTenantOnboardingProgressSchema.parse(req.body);
    const progress = await storage.createTenantOnboardingProgress(data, tenantId);
    res.json(progress);
  } catch (error) {
    console.error('Error creating onboarding progress:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create onboarding progress' });
    }
  }
});

// PATCH /api/ai-features/onboarding/:id - Update onboarding progress
router.patch('/onboarding/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const validatedData = updateOnboardingProgressSchema.parse(req.body);
    const progress = await storage.updateTenantOnboardingProgress(id, validatedData, tenantId);
    if (!progress) {
      res.status(404).json({ error: 'Onboarding progress not found' });
      return;
    }
    res.json(progress);
  } catch (error) {
    console.error('Error updating onboarding progress:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update onboarding progress' });
    }
  }
});

// ============================================================================
// MEDIA LIBRARY
// ============================================================================

// GET /api/ai-features/media - Get all media items
router.get('/media', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { category, isActive } = req.query;
    const media = await storage.getMediaLibrary(
      tenantId,
      category as string | undefined,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    res.json(media);
  } catch (error) {
    console.error('Error fetching media library:', error);
    res.status(500).json({ error: 'Failed to fetch media library' });
  }
});

// GET /api/ai-features/media/:id - Get single media item
router.get('/media/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const item = await storage.getMediaLibraryItem(id, tenantId);
    if (!item) {
      res.status(404).json({ error: 'Media item not found' });
      return;
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching media item:', error);
    res.status(500).json({ error: 'Failed to fetch media item' });
  }
});

// POST /api/ai-features/media - Upload media file
router.post('/media', mediaUpload.single('file'), async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.authenticatedUserId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Determine media type from MIME type
    let mediaType: 'photo' | 'video' | 'audio';
    if (file.mimetype.startsWith('image/')) {
      mediaType = 'photo';
    } else if (file.mimetype.startsWith('video/')) {
      mediaType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      mediaType = 'audio';
    } else {
      res.status(400).json({ error: 'Unsupported file type' });
      return;
    }

    // Create media library item
    const data = insertMediaLibrarySchema.parse({
      tenantId,
      fileName: file.originalname,
      fileType: mediaType,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: file.path,
      fileUrl: `/media-uploads/${tenantId}/${file.filename}`,
      uploadedBy: userId,
      isActive: true
    });

    const item = await storage.createMediaLibraryItem(data, tenantId);
    res.json(item);
  } catch (error) {
    console.error('Error creating media item:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create media item' });
    }
  }
});

// PATCH /api/ai-features/media/:id - Update media item
router.patch('/media/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const validatedData = updateMediaLibrarySchema.parse(req.body);
    const item = await storage.updateMediaLibraryItem(id, validatedData, tenantId);
    if (!item) {
      res.status(404).json({ error: 'Media item not found' });
      return;
    }
    res.json(item);
  } catch (error) {
    console.error('Error updating media item:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update media item' });
    }
  }
});

// DELETE /api/ai-features/media/:id - Delete media item
router.delete('/media/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const success = await storage.deleteMediaLibraryItem(id, tenantId);
    if (!success) {
      res.status(404).json({ error: 'Media item not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting media item:', error);
    res.status(500).json({ error: 'Failed to delete media item' });
  }
});

// ============================================================================
// WIDGET SETTINGS
// ============================================================================

// GET /api/ai-features/widget-settings - Get widget settings
router.get('/widget-settings', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const settings = await storage.getWidgetSettings(tenantId);
    res.json(settings || null);
  } catch (error) {
    console.error('Error fetching widget settings:', error);
    res.status(500).json({ error: 'Failed to fetch widget settings' });
  }
});

// POST /api/ai-features/widget-settings - Upsert widget settings
router.post('/widget-settings', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const data = insertWidgetSettingsSchema.parse(req.body);
    const settings = await storage.upsertWidgetSettings(data, tenantId);
    res.json(settings);
  } catch (error) {
    console.error('Error upserting widget settings:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to upsert widget settings' });
    }
  }
});

// ============================================================================
// CHAT CONVERSATIONS & MESSAGES
// ============================================================================

// GET /api/ai-features/conversations - Get all conversations
router.get('/conversations', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const conversations = await storage.getChatConversations(tenantId, limit);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/ai-features/conversations/:id - Get single conversation
router.get('/conversations/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const conversation = await storage.getChatConversation(id, tenantId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// GET /api/ai-features/conversations/session/:sessionId - Get conversation by session ID
router.get('/conversations/session/:sessionId', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { sessionId } = req.params;
    const conversation = await storage.getChatConversationBySession(sessionId, tenantId);
    res.json(conversation || null);
  } catch (error) {
    console.error('Error fetching conversation by session:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/ai-features/conversations - Create conversation
router.post('/conversations', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const data = insertChatConversationSchema.parse(req.body);
    const conversation = await storage.createChatConversation(data, tenantId);
    res.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }
});

// PATCH /api/ai-features/conversations/:id - Update conversation
router.patch('/conversations/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const validatedData = updateChatConversationSchema.parse(req.body);
    const conversation = await storage.updateChatConversation(id, validatedData, tenantId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update conversation' });
    }
  }
});

// GET /api/ai-features/conversations/:conversationId/messages - Get messages for conversation
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { conversationId } = req.params;
    const messages = await storage.getChatMessages(conversationId, tenantId);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/ai-features/conversations/:conversationId/messages - Create message
router.post('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { conversationId } = req.params;
    const data = insertChatMessageSchema.parse({
      ...req.body,
      conversationId
    });
    const message = await storage.createChatMessage(data, tenantId);
    res.json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create message' });
    }
  }
});

// ============================================================================
// BOOKABLE SERVICES
// ============================================================================

// GET /api/ai-features/services - Get all bookable services
router.get('/services', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { isActive } = req.query;
    const services = await storage.getBookableServices(
      tenantId,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /api/ai-features/services/:id - Get single service
router.get('/services/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const service = await storage.getBookableService(id, tenantId);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// POST /api/ai-features/services - Create service
router.post('/services', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.authenticatedUserId;
    const data = insertBookableServiceSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId
    });
    const service = await storage.createBookableService(data, tenantId);
    res.json(service);
  } catch (error) {
    console.error('Error creating service:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create service' });
    }
  }
});

// PATCH /api/ai-features/services/:id - Update service
router.patch('/services/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const validatedData = updateBookableServiceSchema.parse(req.body);
    const service = await storage.updateBookableService(id, validatedData, tenantId);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json(service);
  } catch (error) {
    console.error('Error updating service:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update service' });
    }
  }
});

// DELETE /api/ai-features/services/:id - Delete service
router.delete('/services/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const success = await storage.deleteBookableService(id, tenantId);
    if (!success) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ============================================================================
// AVAILABILITY SCHEDULES
// ============================================================================

// GET /api/ai-features/schedules - Get all availability schedules
router.get('/schedules', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { isActive } = req.query;
    const schedules = await storage.getAvailabilitySchedules(
      tenantId,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// GET /api/ai-features/schedules/:id - Get single schedule
router.get('/schedules/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const schedule = await storage.getAvailabilitySchedule(id, tenantId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// GET /api/ai-features/schedules/by-link/:publicLink - Get schedule by public link
router.get('/schedules/by-link/:publicLink', async (req, res) => {
  try {
    const { publicLink } = req.params;
    const schedule = await storage.getAvailabilityScheduleByPublicLink(publicLink);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule by link:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// POST /api/ai-features/schedules - Create schedule
router.post('/schedules', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const data = insertAvailabilityScheduleSchema.parse({
      ...req.body,
      tenantId
    });
    const schedule = await storage.createAvailabilitySchedule(data, tenantId);
    res.json(schedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  }
});

// PATCH /api/ai-features/schedules/:id - Update schedule
router.patch('/schedules/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const validatedData = updateAvailabilityScheduleSchema.parse(req.body);
    const schedule = await storage.updateAvailabilitySchedule(id, validatedData, tenantId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  }
});

// DELETE /api/ai-features/schedules/:id - Delete schedule
router.delete('/schedules/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const success = await storage.deleteAvailabilitySchedule(id, tenantId);
    if (!success) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// GET /api/ai-features/schedules/:scheduleId/services - Get linked services
router.get('/schedules/:scheduleId/services', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const services = await storage.getScheduleServices(scheduleId);
    res.json(services);
  } catch (error) {
    console.error('Error fetching schedule services:', error);
    res.status(500).json({ error: 'Failed to fetch schedule services' });
  }
});

// POST /api/ai-features/schedules/:scheduleId/services - Link service to schedule
router.post('/schedules/:scheduleId/services', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { serviceId } = req.body;
    const data = insertScheduleServiceSchema.parse({ scheduleId, serviceId });
    const link = await storage.addServiceToSchedule(data);
    res.json(link);
  } catch (error) {
    console.error('Error linking service to schedule:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to link service to schedule' });
    }
  }
});

// DELETE /api/ai-features/schedules/:scheduleId/services/:serviceId - Unlink service
router.delete('/schedules/:scheduleId/services/:serviceId', async (req, res) => {
  try {
    const { scheduleId, serviceId } = req.params;
    const success = await storage.removeServiceFromSchedule(scheduleId, serviceId);
    if (!success) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error unlinking service from schedule:', error);
    res.status(500).json({ error: 'Failed to unlink service from schedule' });
  }
});

// GET /api/ai-features/schedules/:scheduleId/rules - Get availability rules
router.get('/schedules/:scheduleId/rules', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const rules = await storage.getAvailabilityRules(scheduleId);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching availability rules:', error);
    res.status(500).json({ error: 'Failed to fetch availability rules' });
  }
});

// POST /api/ai-features/schedules/:scheduleId/rules - Create availability rule
router.post('/schedules/:scheduleId/rules', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const data = insertAvailabilityRuleSchema.parse({
      ...req.body,
      scheduleId
    });
    const rule = await storage.createAvailabilityRule(data);
    res.json(rule);
  } catch (error) {
    console.error('Error creating availability rule:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create availability rule' });
    }
  }
});

// PATCH /api/ai-features/rules/:id - Update availability rule
router.patch('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateAvailabilityRuleSchema.parse(req.body);
    const rule = await storage.updateAvailabilityRule(id, validatedData);
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    res.json(rule);
  } catch (error) {
    console.error('Error updating availability rule:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update availability rule' });
    }
  }
});

// DELETE /api/ai-features/rules/:id - Delete availability rule
router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteAvailabilityRule(id);
    if (!success) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting availability rule:', error);
    res.status(500).json({ error: 'Failed to delete availability rule' });
  }
});

// ============================================================================
// SCHEDULE CALENDAR CHECKS
// ============================================================================

// GET /api/ai-features/schedules/:scheduleId/calendar-checks - Get calendar checks for schedule
router.get('/schedules/:scheduleId/calendar-checks', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { scheduleId } = req.params;
    
    // Verify schedule belongs to tenant
    const schedule = await storage.getAvailabilitySchedule(scheduleId, tenantId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    
    const checks = await storage.getScheduleCalendarChecks(scheduleId);
    res.json(checks);
  } catch (error) {
    console.error('Error fetching calendar checks:', error);
    res.status(500).json({ error: 'Failed to fetch calendar checks' });
  }
});

// POST /api/ai-features/schedules/:scheduleId/calendar-checks - Add calendar check
router.post('/schedules/:scheduleId/calendar-checks', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { scheduleId } = req.params;
    const { calendarIntegrationId } = req.body;
    
    // Verify schedule belongs to tenant
    const schedule = await storage.getAvailabilitySchedule(scheduleId, tenantId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    
    // Verify calendar belongs to tenant
    const calendar = await storage.getCalendarIntegration(calendarIntegrationId);
    if (!calendar || calendar.tenantId !== tenantId) {
      res.status(403).json({ error: 'Calendar not found or access denied' });
      return;
    }
    
    const check = await storage.addCalendarCheck({ scheduleId, calendarIntegrationId });
    res.json(check);
  } catch (error) {
    console.error('Error adding calendar check:', error);
    res.status(500).json({ error: 'Failed to add calendar check' });
  }
});

// DELETE /api/ai-features/schedules/:scheduleId/calendar-checks/:calendarIntegrationId - Remove calendar check
router.delete('/schedules/:scheduleId/calendar-checks/:calendarIntegrationId', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { scheduleId, calendarIntegrationId } = req.params;
    
    // Verify schedule belongs to tenant
    const schedule = await storage.getAvailabilitySchedule(scheduleId, tenantId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    
    const success = await storage.removeCalendarCheck(scheduleId, calendarIntegrationId);
    if (!success) {
      res.status(404).json({ error: 'Calendar check not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing calendar check:', error);
    res.status(500).json({ error: 'Failed to remove calendar check' });
  }
});

// ============================================================================
// SCHEDULE TEAM MEMBERS
// ============================================================================

// GET /api/ai-features/schedules/:scheduleId/team-members - Get team members for schedule
router.get('/schedules/:scheduleId/team-members', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { scheduleId } = req.params;
    
    // Verify schedule belongs to tenant
    const schedule = await storage.getAvailabilitySchedule(scheduleId, tenantId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    
    const members = await storage.getScheduleTeamMembers(scheduleId);
    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// POST /api/ai-features/schedules/:scheduleId/team-members - Add team member
router.post('/schedules/:scheduleId/team-members', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { scheduleId } = req.params;
    const { memberId } = req.body;
    
    // Verify schedule belongs to tenant
    const schedule = await storage.getAvailabilitySchedule(scheduleId, tenantId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    
    // Verify member belongs to tenant
    const member = await storage.getMember(memberId, tenantId);
    if (!member) {
      res.status(403).json({ error: 'Team member not found or access denied' });
      return;
    }
    
    const teamMember = await storage.addTeamMember({ scheduleId, memberId });
    res.json(teamMember);
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// DELETE /api/ai-features/schedules/:scheduleId/team-members/:memberId - Remove team member
router.delete('/schedules/:scheduleId/team-members/:memberId', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { scheduleId, memberId } = req.params;
    
    // Verify schedule belongs to tenant
    const schedule = await storage.getAvailabilitySchedule(scheduleId, tenantId);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    
    const success = await storage.removeTeamMember(scheduleId, memberId);
    if (!success) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// ============================================================================
// BOOKINGS
// ============================================================================

// GET /api/ai-features/bookings - Get all bookings with filters
router.get('/bookings', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { contactId, status, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (contactId) filters.contactId = contactId as string;
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    
    const bookings = await storage.getBookings(tenantId, filters);
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/ai-features/bookings/:id - Get single booking
router.get('/bookings/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const booking = await storage.getBooking(id, tenantId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST /api/ai-features/bookings - Create booking
router.post('/bookings', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const data = insertBookingSchema.parse(req.body);
    const booking = await storage.createBooking(data, tenantId);
    res.json(booking);
  } catch (error) {
    console.error('Error creating booking:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
});

// PATCH /api/ai-features/bookings/:id - Update booking
router.patch('/bookings/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const validatedData = updateBookingSchema.parse(req.body);

    // Snapshot the booking BEFORE the update so we can compare status changes
    const existingBooking = await storage.getBooking(id, tenantId);

    const booking = await storage.updateBooking(id, validatedData, tenantId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // ── Google Calendar side-effects ──────────────────────────────────────
    try {
      const { createBookingCalendarEvent, deleteBookingCalendarEvent } = await import('../services/booking-calendar');

      const prevStatus = existingBooking?.status;
      const newStatus = booking.status;
      const existingGoogleId = (existingBooking as any)?.googleEventId as string | null | undefined;

      if (newStatus === 'confirmed' && !existingGoogleId) {
        // Booking just confirmed (approval workflow) — create calendar event
        const googleEventId = await createBookingCalendarEvent(booking, tenantId);
        if (googleEventId) {
          await storage.updateBooking(id, { googleEventId } as any, tenantId);
        }
      } else if (newStatus === 'cancelled' && existingGoogleId) {
        // Booking cancelled — remove calendar event
        await deleteBookingCalendarEvent(existingBooking!, tenantId);
      }
    } catch (calErr) {
      console.warn('⚠️ Google Calendar side-effect failed (non-fatal):', calErr);
    }
    // ─────────────────────────────────────────────────────────────────────

    res.json(booking);
  } catch (error) {
    console.error('Error updating booking:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update booking' });
    }
  }
});

// POST /api/ai-features/bookings/:id/cancel - Cancel booking
router.post('/bookings/:id/cancel', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { cancelledBy, cancellationReason } = req.body;
    
    if (!cancelledBy || !cancellationReason) {
      res.status(400).json({ error: 'cancelledBy and cancellationReason are required' });
      return;
    }
    
    // Get the booking to check cancellation policy
    const existingBooking = await storage.getBooking(id, tenantId);
    if (!existingBooking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    
    // Check cancellation policy if schedule has one
    if (existingBooking.scheduleId) {
      const schedule = await storage.getAvailabilitySchedule(existingBooking.scheduleId, tenantId);
      if (schedule?.cancellationPolicyHours) {
        const bookingDateTime = new Date(`${existingBooking.bookingDate.toISOString().split('T')[0]}T${existingBooking.bookingTime}`);
        const now = new Date();
        const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (hoursUntilBooking < schedule.cancellationPolicyHours) {
          res.status(400).json({ 
            error: `Cancellations must be made at least ${schedule.cancellationPolicyHours} hours before the booking time` 
          });
          return;
        }
      }
    }
    
    const booking = await storage.cancelBooking(id, cancelledBy, cancellationReason, tenantId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    res.json(booking);
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// DELETE /api/ai-features/bookings/:id - Permanently delete a booking
router.delete('/bookings/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    // Get the booking first so we can delete the calendar event
    const existingBooking = await storage.getBooking(id, tenantId);
    if (!existingBooking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // Delete Google Calendar event if one was created
    const googleEventId = (existingBooking as any).googleEventId as string | null | undefined;
    if (googleEventId) {
      const { deleteBookingCalendarEvent } = await import('../services/booking-calendar');
      await deleteBookingCalendarEvent(existingBooking, tenantId);
    }

    const deleted = await storage.deleteBooking(id, tenantId);
    if (!deleted) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

/* ─── Scheduler Settings (global per tenant) ────────────────────────────────── */

// GET /api/ai-features/scheduler-settings
router.get('/scheduler-settings', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { db } = await import('../../db');
    const { schedulerSettings } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const [settings] = await db
      .select()
      .from(schedulerSettings)
      .where(eq(schedulerSettings.tenantId, tenantId));

    // Return defaults if no row exists yet
    res.json(settings || { requirePhone: false, disableTimezonePreview: false });
  } catch (error) {
    console.error('Error fetching scheduler settings:', error);
    res.status(500).json({ error: 'Failed to fetch scheduler settings' });
  }
});

// PATCH /api/ai-features/scheduler-settings
router.patch('/scheduler-settings', async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { requirePhone, disableTimezonePreview } = req.body;
    const { db } = await import('../../db');
    const { schedulerSettings } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // Upsert
    const [existing] = await db
      .select()
      .from(schedulerSettings)
      .where(eq(schedulerSettings.tenantId, tenantId));

    let result;
    if (existing) {
      [result] = await db
        .update(schedulerSettings)
        .set({
          requirePhone: requirePhone ?? existing.requirePhone,
          disableTimezonePreview: disableTimezonePreview ?? existing.disableTimezonePreview,
          updatedAt: new Date(),
        })
        .where(eq(schedulerSettings.tenantId, tenantId))
        .returning();
    } else {
      [result] = await db
        .insert(schedulerSettings)
        .values({ tenantId, requirePhone: requirePhone ?? false, disableTimezonePreview: disableTimezonePreview ?? false })
        .returning();
    }

    res.json(result);
  } catch (error) {
    console.error('Error updating scheduler settings:', error);
    res.status(500).json({ error: 'Failed to update scheduler settings' });
  }
});

export default router;
