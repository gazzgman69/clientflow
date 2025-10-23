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
    const schedules = await storage.getAvailabilitySchedules();
    const schedule = schedules.find(s => s.publicLink === slug);
    
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

// GET /api/public/schedules/:slug/services - Get services for a schedule
router.get('/schedules/:slug/services', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Find schedule by public link
    const schedules = await storage.getAvailabilitySchedules();
    const schedule = schedules.find(s => s.publicLink === slug);
    
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
    
    // Filter out null values and return only public-safe fields
    const publicServices = services.filter(s => s !== null && s !== undefined).map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      duration: service.duration,
      bufferBefore: service.bufferBefore,
      bufferAfter: service.bufferAfter,
      price: service.price,
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
    const schedules = await storage.getAvailabilitySchedules();
    const schedule = schedules.find(s => s.publicLink === slug);
    
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
    
    // Get or create contact
    let contactId = bookingData.contactId;
    let projectId = bookingData.projectId;
    
    if (!contactId) {
      // Check if contact exists by email
      const contacts = await storage.getContacts(schedule.tenantId);
      const existingContact = contacts.find(c => c.email?.toLowerCase() === bookingData.clientEmail.toLowerCase());
      
      if (existingContact) {
        contactId = existingContact.id;
        
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
    }
    
    // Create the booking
    const booking = await storage.createBooking({
      tenantId: schedule.tenantId,
      serviceId: bookingData.serviceId,
      scheduleId: schedule.id,
      clientName: bookingData.clientName,
      clientEmail: bookingData.clientEmail,
      clientPhone: bookingData.clientPhone || null,
      bookingDate: new Date(bookingData.bookingDate),
      bookingTime: bookingData.bookingTime,
      status: 'pending',
      notes: bookingData.notes || null,
      contactId,
      projectId: projectId || null,
      leadId: null,
      metadata: {
        source: 'public_booking',
        publicLink: slug,
        contactCreated: !bookingData.contactId,
        projectCreated: !bookingData.projectId
      }
    }, schedule.tenantId);
    
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
