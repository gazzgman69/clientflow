import { Router } from 'express';
import { storage } from '../../storage';
import { z } from 'zod';
import OpenAI from 'openai';

const router = Router();

// Using Replit AI Integrations
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Helper to resolve tenant from slug
async function resolveTenantFromSlug(slug: string) {
  // Try to find tenant by slug
  const tenant = await storage.getTenantBySlug(slug);
  if (!tenant) {
    throw new Error('Tenant not found');
  }
  return tenant;
}

// GET /api/public/widget-settings/:slug - Get widget settings for public chat
router.get('/widget-settings/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const tenant = await resolveTenantFromSlug(slug);
    const settings = await storage.getWidgetSettings(tenant.id);
    
    if (!settings || !settings.isActive) {
      res.status(404).json({ error: 'Chat widget not found or is disabled' });
      return;
    }
    
    // Return only public-facing settings (no sensitive data)
    res.json({
      welcomeMessage: settings.welcomeMessage,
      brandColor: settings.brandColor,
      chatbotName: settings.chatbotName,
      avatarUrl: settings.avatarUrl,
      businessName: tenant.name || 'BusinessCRM',
      isActive: settings.isActive
    });
  } catch (error) {
    console.error('Error fetching public widget settings:', error);
    res.status(500).json({ error: 'Failed to fetch widget settings' });
  }
});

// GET /api/public/conversations/session/:sessionId - Get conversation by session ID
router.get('/conversations/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { slug } = req.query;
    
    if (!slug || typeof slug !== 'string') {
      res.status(400).json({ error: 'Tenant slug is required' });
      return;
    }
    
    const tenant = await resolveTenantFromSlug(slug);
    const conversation = await storage.getChatConversationBySession(sessionId, tenant.id);
    
    if (!conversation) {
      res.json(null);
      return;
    }
    
    // Load messages for the conversation
    const messages = await storage.getChatMessages(conversation.id, tenant.id);
    
    res.json({
      ...conversation,
      messages
    });
  } catch (error) {
    console.error('Error fetching public conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/public/chat/:slug - Send message to public chat
router.post('/chat/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { message, sessionId, conversationId } = req.body;
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }
    
    const tenant = await resolveTenantFromSlug(slug);
    const settings = await storage.getWidgetSettings(tenant.id);
    
    if (!settings || !settings.isActive) {
      res.status(404).json({ error: 'Chat widget is not active' });
      return;
    }
    
    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await storage.getChatConversation(conversationId, tenant.id);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
    } else {
      // Check if conversation exists for this session
      conversation = await storage.getChatConversationBySession(sessionId, tenant.id);
      
      if (!conversation) {
        // Create new conversation
        conversation = await storage.createChatConversation({
          tenantId: tenant.id,
          sessionId,
          channel: 'public_widget',
          status: 'active',
          metadata: {
            source: 'public_widget',
            slug,
            startedAt: new Date().toISOString()
          }
        }, tenant.id);
      }
    }
    
    // Save user message
    await storage.createChatMessage({
      conversationId: conversation.id,
      role: 'user',
      content: message,
      metadata: {
        source: 'public_widget'
      }
    }, tenant.id);
    
    // Get conversation history
    const messages = await storage.getChatMessages(conversation.id, tenant.id);
    
    // Build messages for AI
    const aiMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));
    
    // Add system message with context
    const systemMessage = `You are a helpful AI assistant for ${tenant.name || 'this business'}. 
${settings.aiTone ? `Use a ${settings.aiTone} tone.` : ''}
${settings.welcomeMessage ? `Welcome message: ${settings.welcomeMessage}` : ''}

Help answer questions, provide information, and assist visitors. If they're interested in booking or scheduling, 
${settings.enableBookingPrompt ? `gently guide them towards booking with a ${settings.bookingPromptAggression || 'gentle'} approach.` : 'be helpful and informative.'}`;
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        ...aiMessages
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    
    const assistantMessage = response.choices[0].message.content || "I'm here to help! How can I assist you?";
    
    // Save assistant message
    await storage.createChatMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantMessage,
      metadata: {
        source: 'ai_assistant',
        model: 'gpt-4o-mini'
      }
    }, tenant.id);
    
    res.json({
      message: assistantMessage,
      conversationId: conversation.id
    });
  } catch (error) {
    console.error('Error in public chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// GET /api/public/schedules/:slug - Get schedule by public link
router.get('/schedules/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Find schedule by public link
    const schedule = await storage.getAvailabilityScheduleByPublicLink(slug);

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error fetching public schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// ─── Slot Generation Helpers ──────────────────────────────────────────────────

/** Map day-code strings to JS getDay() values (0=Sun) */
const DAY_CODE_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

/** Parse 'HH:MM' → total minutes since midnight */
function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Format total minutes → 'HH:MM' */
function formatTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Generate available time slots for a given date based on availability rules,
 * existing bookings, and (optionally) Google Calendar busy blocks.
 */
async function generateAvailableSlots(
  scheduleId: string,
  tenantId: string,
  date: string,          // 'YYYY-MM-DD'
  durationMins: number,
  bufferAfter: number,
  minAdvanceNoticeHours: number,
): Promise<string[]> {
  const requestedDate = new Date(`${date}T00:00:00`);
  const dayCode = (['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])[requestedDate.getDay()];

  // Load rules for this schedule
  const rules = await storage.getAvailabilityRules(scheduleId);

  // Separate availability windows from exception (block-out) windows
  const windows: Array<{ start: number; end: number }> = [];
  const exceptions: Array<{ start: number; end: number }> = [];

  for (const rule of rules) {
    // Check date bounds if set
    if (rule.dateStart && new Date(rule.dateStart) > requestedDate) continue;
    if (rule.dateEnd && new Date(rule.dateEnd) < requestedDate) continue;

    // Check if this rule covers the requested day
    let coversDay = false;
    if (rule.frequency === 'daily') {
      coversDay = true;
    } else if (rule.frequency === 'weekly' && rule.selectedDays) {
      coversDay = rule.selectedDays.includes(dayCode);
    } else if (rule.frequency === 'monthly') {
      // Monthly: selectedDays treated as day-of-month numbers e.g. ['1','15']
      const dayOfMonth = requestedDate.getDate().toString();
      coversDay = !!rule.selectedDays?.includes(dayOfMonth);
    }

    if (!coversDay) continue;

    const entry = { start: parseTime(rule.timeStart), end: parseTime(rule.timeEnd) };
    if (rule.isException) {
      exceptions.push(entry);
    } else {
      windows.push(entry);
    }
  }

  if (windows.length === 0) return []; // No availability on this day

  // Generate raw slots across all windows
  const interval = durationMins + bufferAfter;
  const rawSlots: number[] = [];
  for (const window of windows) {
    for (let mins = window.start; mins + durationMins <= window.end; mins += interval) {
      rawSlots.push(mins);
    }
  }

  // Remove duplicates and sort
  const uniqueSlots = [...new Set(rawSlots)].sort((a, b) => a - b);

  // Filter out exception (blocked) times
  const nonBlockedSlots = uniqueSlots.filter(slotStart => {
    const slotEnd = slotStart + durationMins;
    return !exceptions.some(ex => slotStart < ex.end && slotEnd > ex.start);
  });

  // Filter out slots that are in the past (if booking for today)
  const now = new Date();
  const isToday = requestedDate.toDateString() === now.toDateString();
  const minAdvanceMins = minAdvanceNoticeHours * 60;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const cutoffMins = nowMins + minAdvanceMins;

  const futureSlots = isToday
    ? nonBlockedSlots.filter(s => s >= cutoffMins)
    : nonBlockedSlots;

  // Filter out slots that overlap with existing confirmed/pending bookings
  const existingBookings = await storage.getBookings(tenantId);
  const sameDayBookings = existingBookings.filter(b => {
    if (b.scheduleId !== scheduleId) return false;
    if (b.status === 'cancelled') return false;
    const bDate = new Date(b.bookingDate);
    return bDate.toDateString() === requestedDate.toDateString();
  });

  const availableSlots = futureSlots.filter(slotStart => {
    const slotEnd = slotStart + durationMins;
    return !sameDayBookings.some(b => {
      const bStart = parseTime(b.bookingTime || '00:00');
      // Use the booking's service duration if we can, otherwise assume 60 mins
      const bEnd = bStart + 60;
      return slotStart < bEnd && slotEnd > bStart;
    });
  });

  // Filter out slots blocked by linked Google Calendar events
  try {
    const { db } = await import('../../db');
    const { scheduleCalendarChecks, calendarIntegrations } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const calChecks = await db
      .select({ integration: calendarIntegrations })
      .from(scheduleCalendarChecks)
      .innerJoin(calendarIntegrations, eq(scheduleCalendarChecks.calendarIntegrationId, calendarIntegrations.id))
      .where(eq(scheduleCalendarChecks.scheduleId, scheduleId));

    if (calChecks.length > 0) {
      const { googleCalendarService } = await import('../services/google-calendar');
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);

      for (const { integration } of calChecks) {
        if (integration.provider !== 'google' || !integration.accessToken) continue;
        try {
          googleCalendarService.setCredentials({
            access_token: integration.accessToken,
            refresh_token: integration.refreshToken || undefined,
            expiry_date: undefined,
          });
          const { events } = await googleCalendarService.getEvents(
            integration.calendarId || 'primary',
            { timeMin: dayStart, timeMax: dayEnd, maxResults: 50 }
          );
          for (const event of events) {
            if (event.transparency === 'transparent') continue; // "free" events don't block
            const evStart = event.start?.dateTime ? new Date(event.start.dateTime) : null;
            const evEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null;
            if (!evStart || !evEnd) continue;
            const evStartMins = evStart.getHours() * 60 + evStart.getMinutes();
            const evEndMins = evEnd.getHours() * 60 + evEnd.getMinutes();
            availableSlots.splice(0, availableSlots.length,
              ...availableSlots.filter(s => !(s < evEndMins && s + durationMins > evStartMins))
            );
          }
        } catch (calErr) {
          console.warn(`⚠️ Could not check calendar ${integration.id} for conflicts:`, calErr);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Calendar conflict check skipped:', err);
  }

  return availableSlots.map(formatTime);
}

// ──────────────────────────────────────────────────────────────────────────────

// GET /api/public/schedules/:slug/slots?date=YYYY-MM-DD&serviceId=xxx
router.get('/schedules/:slug/slots', async (req, res) => {
  try {
    const { slug } = req.params;
    const { date, serviceId } = req.query as { date?: string; serviceId?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
      return;
    }

    const schedule = await storage.getAvailabilityScheduleByPublicLink(slug);
    if (!schedule) { res.status(404).json({ error: 'Schedule not found' }); return; }

    // Resolve service for duration/buffer (use first linked service as fallback)
    let durationMins = 60;
    let bufferAfter = 0;
    if (serviceId) {
      const service = await storage.getBookableService(serviceId, schedule.tenantId);
      if (service) {
        durationMins = service.duration || 60;
        bufferAfter = service.bufferAfter || 0;
      }
    }

    const slots = await generateAvailableSlots(
      schedule.id,
      schedule.tenantId,
      date,
      durationMins,
      bufferAfter,
      schedule.minAdvanceNoticeHours || 0,
    );

    res.json({ date, slots });
  } catch (error) {
    console.error('Error generating slots:', error);
    res.status(500).json({ error: 'Failed to generate available slots' });
  }
});

// GET /api/public/schedules/:slug/services - Get services for a schedule
router.get('/schedules/:slug/services', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Find schedule by public link
    const schedule = await storage.getAvailabilityScheduleByPublicLink(slug);

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Get services linked to this schedule
    const scheduleServices = await storage.getScheduleServices(schedule.id);
    
    // Fetch full service details for each linked service
    const servicePromises = scheduleServices.map(ss => 
      storage.getBookableService(ss.serviceId, schedule.tenantId)
    );
    const services = await Promise.all(servicePromises);
    
    // Filter out null values and return public-safe fields (including questions for the wizard)
    const publicServices = services.filter(s => s !== null && s !== undefined).map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      duration: service.duration,
      bufferBefore: service.bufferBefore,
      bufferAfter: service.bufferAfter,
      price: service.price,
      location: service.location,
      locationDetails: service.locationDetails,
      requireApproval: service.requireApproval,
      serviceQuestions: service.serviceQuestions,   // JSON string — parsed by client
      projectQuestions: service.projectQuestions,   // JSON string — parsed by client
    }));
    
    res.json(publicServices);
  } catch (error) {
    console.error('Error fetching public services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// POST /api/public/contact-check - Check if contact exists by email
router.post('/contact-check', async (req, res) => {
  try {
    const { email, slug } = req.body;
    
    if (!email || !slug) {
      res.status(400).json({ error: 'Email and slug are required' });
      return;
    }
    
    const tenant = await resolveTenantFromSlug(slug);
    
    // Find contact by email in this tenant
    const contacts = await storage.getContacts(tenant.id);
    const contact = contacts.find(c => c.email?.toLowerCase() === email.toLowerCase());
    
    if (contact) {
      // Get most recent project for this contact
      const projects = await storage.getProjects(tenant.id);
      const contactProjects = projects
        .filter(p => p.contactId === contact.id)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      res.json({
        exists: true,
        contactId: contact.id,
        name: contact.name,
        phone: contact.phone,
        mostRecentProjectId: contactProjects[0]?.id || null,
      });
    } else {
      res.json({
        exists: false,
      });
    }
  } catch (error) {
    console.error('Error checking contact:', error);
    res.status(500).json({ error: 'Failed to check contact' });
  }
});

// POST /api/public/bookings/:slug - Create a public booking
router.post('/bookings/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const bookingData = req.body;
    
    // Validate required fields
    const requiredFields = ['serviceId', 'clientName', 'clientEmail', 'bookingDate', 'bookingTime'];
    for (const field of requiredFields) {
      if (!bookingData[field]) {
        res.status(400).json({ error: `${field} is required` });
        return;
      }
    }
    
    // Find schedule by public link
    const schedule = await storage.getAvailabilityScheduleByPublicLink(slug);

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Verify service exists and belongs to this tenant
    const service = await storage.getBookableService(bookingData.serviceId, schedule.tenantId);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    
    // Verify service is actually linked to this schedule
    const scheduleServices = await storage.getScheduleServices(schedule.id);
    const isServiceLinked = scheduleServices.some(ss => ss.serviceId === bookingData.serviceId);
    
    if (!isServiceLinked) {
      res.status(400).json({ error: 'Service is not available for this schedule' });
      return;
    }
    
    // Validate booking limitations
    const bookingDateTime = new Date(`${bookingData.bookingDate}T${bookingData.bookingTime}`);
    const now = new Date();
    
    // Check minimum advance notice
    if (schedule.minAdvanceNoticeHours) {
      const minAdvanceMs = schedule.minAdvanceNoticeHours * 60 * 60 * 1000;
      const timeDiff = bookingDateTime.getTime() - now.getTime();
      if (timeDiff < minAdvanceMs) {
        res.status(400).json({ 
          error: `Bookings must be made at least ${schedule.minAdvanceNoticeHours} hours in advance` 
        });
        return;
      }
    }
    
    // Check maximum future booking window
    if (schedule.maxFutureDays) {
      const maxFutureMs = schedule.maxFutureDays * 24 * 60 * 60 * 1000;
      const timeDiff = bookingDateTime.getTime() - now.getTime();
      if (timeDiff > maxFutureMs) {
        res.status(400).json({ 
          error: `Bookings cannot be made more than ${schedule.maxFutureDays} days in advance` 
        });
        return;
      }
    }
    
    // Check daily booking limit
    if (schedule.dailyBookingLimit) {
      const bookings = await storage.getBookings(schedule.tenantId);
      const bookingDate = new Date(bookingData.bookingDate);
      const dailyBookings = bookings.filter(b => {
        const bDate = new Date(b.bookingDate);
        return b.scheduleId === schedule.id &&
               b.status !== 'cancelled' &&
               bDate.toDateString() === bookingDate.toDateString();
      });
      
      if (dailyBookings.length >= schedule.dailyBookingLimit) {
        res.status(400).json({ 
          error: `Daily booking limit of ${schedule.dailyBookingLimit} has been reached for this date` 
        });
        return;
      }
    }
    
    // Check weekly booking limit
    if (schedule.weeklyBookingLimit) {
      const bookings = await storage.getBookings(schedule.tenantId);
      const bookingDate = new Date(bookingData.bookingDate);
      
      // Get start of week (Sunday)
      const weekStart = new Date(bookingDate);
      weekStart.setDate(bookingDate.getDate() - bookingDate.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      // Get end of week (Saturday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weeklyBookings = bookings.filter(b => {
        const bDate = new Date(b.bookingDate);
        return b.scheduleId === schedule.id &&
               b.status !== 'cancelled' &&
               bDate >= weekStart &&
               bDate <= weekEnd;
      });
      
      if (weeklyBookings.length >= schedule.weeklyBookingLimit) {
        res.status(400).json({ 
          error: `Weekly booking limit of ${schedule.weeklyBookingLimit} has been reached for this week` 
        });
        return;
      }
    }
    
    // Get or create contact
    let contactId = bookingData.contactId;
    let projectId = bookingData.projectId;
    let wasContactCreated = false;
    let wasProjectCreated = false;
    
    if (!contactId) {
      // Check if contact exists by email
      const contacts = await storage.getContacts(schedule.tenantId);
      const existingContact = contacts.find(c => c.email?.toLowerCase() === bookingData.clientEmail.toLowerCase());
      
      if (existingContact) {
        contactId = existingContact.id;
        wasContactCreated = false;
        
        // Get most recent project
        const projects = await storage.getProjects(schedule.tenantId);
        const contactProjects = projects
          .filter(p => p.contactId === contactId)
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        
        projectId = contactProjects[0]?.id || null;
      } else {
        // Create new contact
        const newContact = await storage.createContact({
          tenantId: schedule.tenantId,
          name: bookingData.clientName,
          email: bookingData.clientEmail,
          phone: bookingData.clientPhone || null,
          source: 'public_booking',
        }, schedule.tenantId);
        contactId = newContact.id;
        wasContactCreated = true;
      }
    }
    
    // Create project if needed (for new contacts or if no recent project exists)
    if (!projectId) {
      const newProject = await storage.createProject({
        tenantId: schedule.tenantId,
        contactId,
        name: `${service.name} - ${bookingData.clientName}`,
        status: 'lead',
        eventDate: new Date(bookingData.bookingDate),
        notes: bookingData.notes || null,
      }, schedule.tenantId);
      projectId = newProject.id;
      wasProjectCreated = true;
    }
    
    // ── Apply contact tag automation ───────────────────────────────────────
    if (contactId && service.addContactTags && service.addContactTags.length > 0) {
      try {
        const contact = await storage.getContact(contactId, schedule.tenantId);
        if (contact) {
          const existing = contact.tags || [];
          const merged = [...new Set([...existing, ...service.addContactTags])];
          await storage.updateContact(contactId, { tags: merged }, schedule.tenantId);
        }
      } catch (tagErr) {
        console.warn('⚠️ Could not apply contact tags:', tagErr);
      }
    }

    // ── Determine booking status (approval required vs auto-confirmed) ─────
    const needsApproval = !!service.requireApproval;
    const bookingStatus = needsApproval ? 'pending' : 'confirmed';
    const approvalStatus = needsApproval ? 'pending_approval' : null;

    // ── Create the booking ─────────────────────────────────────────────────
    const booking = await storage.createBooking({
      tenantId: schedule.tenantId,
      serviceId: bookingData.serviceId,
      scheduleId: schedule.id,
      clientName: bookingData.clientName,
      clientEmail: bookingData.clientEmail,
      clientPhone: bookingData.clientPhone || null,
      bookingDate: new Date(bookingData.bookingDate),
      bookingTime: bookingData.bookingTime,
      status: bookingStatus,
      approvalStatus,
      notes: bookingData.notes || null,
      serviceResponses: bookingData.serviceResponses || null,
      projectResponses: bookingData.projectResponses || null,
      contactId,
      projectId: projectId || null,
      leadId: null,
      metadata: {
        source: 'public_booking',
        publicLink: slug,
        contactCreated: wasContactCreated,
        projectCreated: wasProjectCreated
      }
    }, schedule.tenantId);

    // ── Save intake answers as a project note ──────────────────────────────
    if (projectId && (bookingData.serviceResponses || bookingData.projectResponses)) {
      try {
        const responses: Record<string, string> = {
          ...JSON.parse(bookingData.serviceResponses || '{}'),
          ...JSON.parse(bookingData.projectResponses || '{}'),
        };
        const keys = Object.keys(responses);
        if (keys.length > 0) {
          const noteLines = keys.map(q => `• ${q}: ${responses[q]}`).join('\n');
          const noteContent = `Booking intake answers (${service.name}):\n${noteLines}`;
          // Get first tenant user for createdBy
          const tenantUsers = await storage.getUsers(schedule.tenantId);
          const systemUser = tenantUsers[0];
          if (systemUser) {
            await storage.addProjectNote({
              tenantId: schedule.tenantId,
              projectId,
              note: noteContent,
              title: 'Booking Intake Answers',
              noteType: 'note',
              visibility: 'private',
              createdBy: systemUser.id,
            }, schedule.tenantId);
          }
        }
      } catch (noteErr) {
        console.warn('⚠️ Could not save intake answers as project note:', noteErr);
      }
    }
    
    // ── Emails: confirmation (auto-confirmed) OR admin notification (needs approval) ──
    try {
      const { emailDispatcher } = await import('../services/email-dispatcher');
      const dateStr = new Date(bookingData.bookingDate).toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const detailsTable = `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Service</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${service.name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Date</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${dateStr}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Time</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${bookingData.bookingTime}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Duration</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${service.duration} minutes</td></tr>
          ${service.location ? `<tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Location</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${service.location}${service.locationDetails ? ` — ${service.locationDetails}` : ''}</td></tr>` : ''}
        </table>`;

      if (needsApproval) {
        // Send "pending review" email to client
        await emailDispatcher.sendEmail({
          tenantId: schedule.tenantId,
          to: bookingData.clientEmail,
          subject: `Booking Request Received: ${service.name}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>Request Received</h2>
            <p>Hi ${bookingData.clientName},</p>
            <p>Thank you for your booking request. We'll review it and get back to you shortly with a confirmation.</p>
            ${detailsTable}
            <p style="color:#6b7280;font-size:14px;">You'll receive another email once your booking is confirmed.</p>
          </div>`,
        });

        // Send admin notification email (to all tenant users)
        const tenantUsers = await storage.getUsers(schedule.tenantId);
        for (const adminUser of tenantUsers) {
          if (!adminUser.email) continue;
          await emailDispatcher.sendEmail({
            tenantId: schedule.tenantId,
            to: adminUser.email,
            subject: `New Booking Request: ${bookingData.clientName} — ${service.name}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2>New Booking Request</h2>
              <p>A new booking request needs your approval.</p>
              <p><strong>Client:</strong> ${bookingData.clientName} (${bookingData.clientEmail})</p>
              ${detailsTable}
              ${bookingData.notes ? `<p><strong>Notes:</strong> ${bookingData.notes}</p>` : ''}
              <p><a href="/scheduler" style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:8px;">Review in Scheduler →</a></p>
            </div>`,
          });
        }
      } else {
        // Auto-confirmed — send full confirmation to client
        let subject = `Booking Confirmed: ${service.name}`;
        let html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2>Booking Confirmed</h2>
          <p>Hi ${bookingData.clientName},</p>
          <p>Your booking is confirmed. Here are your details:</p>
          ${detailsTable}
          ${bookingData.notes ? `<p><strong>Notes:</strong> ${bookingData.notes}</p>` : ''}
          <p style="color:#6b7280;font-size:14px;">If you need to make any changes, please reply to this email.</p>
        </div>`;

        if ((service as any).confirmationMessageTemplateId) {
          const template = await storage.getMessageTemplate(
            (service as any).confirmationMessageTemplateId, schedule.tenantId
          );
          if (template) {
            subject = (template as any).subject || subject;
            const vars: Record<string, string> = {
              '{{clientName}}': bookingData.clientName,
              '{{serviceName}}': service.name,
              '{{bookingDate}}': new Date(bookingData.bookingDate).toLocaleDateString('en-GB'),
              '{{bookingTime}}': bookingData.bookingTime,
              '{{duration}}': String(service.duration),
              '{{location}}': service.location || '',
            };
            let body = (template as any).bodyHtml || html;
            for (const [k, v] of Object.entries(vars)) {
              body = body.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v);
            }
            html = body;
          }
        }

        await emailDispatcher.sendEmail({ tenantId: schedule.tenantId, to: bookingData.clientEmail, subject, html });
        await storage.updateBooking(booking.id, { confirmationSentAt: new Date() }, schedule.tenantId);
      }
    } catch (emailErr) {
      console.warn('⚠️ Could not send booking email:', emailErr);
    }

    // ── Google Calendar event (auto-confirmed bookings only) ──────────────
    if (!needsApproval) {
      try {
        const { createBookingCalendarEvent } = await import('../services/booking-calendar');
        const googleEventId = await createBookingCalendarEvent(booking, schedule.tenantId);
        if (googleEventId) {
          await storage.updateBooking(booking.id, { googleEventId } as any, schedule.tenantId);
        }
      } catch (calErr) {
        console.warn('⚠️ Could not create Google Calendar event:', calErr);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.json({
      ...booking,
      contactId,
      projectId,
    });
  } catch (error) {
    console.error('Error creating public booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

export default router;
