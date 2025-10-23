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

export default router;
