import OpenAI from 'openai';
import { storage } from '../../storage';
import type {
  InsertChatConversation,
  InsertChatMessage,
  InsertContact,
  InsertLead,
  InsertProject,
} from '@shared/schema';

// Using Replit AI Integrations which provides OpenAI-compatible API access without requiring your own API key
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

interface ChatContext {
  tenantId: string;
  conversationId: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  leadQualified: boolean;
  bookingIntent: boolean;
}

export class AIChatWidgetService {
  private contexts: Map<string, ChatContext> = new Map();

  /**
   * Start a new chat conversation
   */
  async startConversation(tenantId: string, initialMessage?: string): Promise<{
    conversationId: string;
    assistantReply: string;
  }> {
    // Get widget settings for this tenant
    const widgetSettings = await storage.getWidgetSettings(tenantId);
    if (!widgetSettings) {
      throw new Error('Widget not configured for this tenant');
    }

    // Create conversation record with persistent context
    const context: ChatContext = {
      tenantId,
      conversationId: '', // Will be set after creation
      leadQualified: false,
      bookingIntent: false,
    };

    const conversation = await storage.createChatConversation({
      tenantId,
      status: 'active',
      metadata: context, // Persist context in metadata for restoration
    }, tenantId);

    context.conversationId = conversation.id;
    this.contexts.set(conversation.id, context);

    // Get welcome message from settings
    const welcomeMessage = widgetSettings.welcomeMessage || 
      "Hi! How can I help you today?";

    // Save assistant's welcome message
    await storage.createChatMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: welcomeMessage,
      tenantId,
    }, tenantId);

    // If user provided an initial message, process it
    if (initialMessage) {
      const reply = await this.processMessage(
        conversation.id, 
        initialMessage, 
        tenantId
      );
      return {
        conversationId: conversation.id,
        assistantReply: reply,
      };
    }

    return {
      conversationId: conversation.id,
      assistantReply: welcomeMessage,
    };
  }

  /**
   * Process a user message and generate AI response
   */
  async processMessage(
    conversationId: string,
    userMessage: string,
    tenantId: string
  ): Promise<string> {
    // Get or restore context
    let context = this.contexts.get(conversationId);
    if (!context) {
      context = await this.restoreContext(conversationId, tenantId);
    }

    if (!context) {
      throw new Error('Conversation not found');
    }

    // Save user message
    await storage.createChatMessage({
      conversationId,
      role: 'user',
      content: userMessage,
      tenantId,
    }, tenantId);

    // Get conversation history
    const messages = await storage.getChatMessagesByConversation(conversationId);
    
    // Build system prompt
    const systemPrompt = await this.buildSystemPrompt(tenantId, context);

    // Prepare messages for OpenAI
    const conversationHistory: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    // Call OpenAI with function calling
    // The newest OpenAI model is "gpt-5" which was released August 7, 2025. Do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: conversationHistory,
      functions: this.getFunctionDefinitions(),
      function_call: 'auto',
    });

    const message = response.choices[0].message;

    // Check if function was called
    if (message.function_call) {
      try {
        const functionName = message.function_call.name;
        const functionArgs = JSON.parse(message.function_call.arguments);

        const functionResult = await this.handleFunctionCall(
          context, 
          functionName, 
          functionArgs
        );

      // Generate follow-up response after function execution
      // The newest OpenAI model is "gpt-5" which was released August 7, 2025. Do not change this unless explicitly requested by the user
      const followUp = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          ...conversationHistory,
          message,
          {
            role: 'function',
            name: functionName,
            content: JSON.stringify(functionResult)
          }
        ],
      });

        const assistantReply = followUp.choices[0].message.content || 
          "I've processed your request. What else can I help you with?";

        // Save assistant reply
        await storage.createChatMessage({
          conversationId,
          role: 'assistant',
          content: assistantReply,
          functionCall: functionName,
          functionArgs,
          tenantId,
        }, tenantId);

        return assistantReply;
      } catch (error) {
        // Handle malformed function call arguments or execution errors
        console.error('Function call processing error:', error);
        const errorMessage = "I encountered an issue processing your request. Could you try rephrasing that?";
        
        await storage.createChatMessage({
          conversationId,
          role: 'assistant',
          content: errorMessage,
          tenantId,
        }, tenantId);

        return errorMessage;
      }
    }

    // No function call, just save the reply
    const assistantReply = message.content || "I'm not sure how to help with that.";
    
    await storage.createChatMessage({
      conversationId,
      role: 'assistant',
      content: assistantReply,
      tenantId,
    }, tenantId);

    return assistantReply;
  }

  /**
   * Restore context from database with all persistent state
   */
  private async restoreContext(
    conversationId: string, 
    tenantId: string
  ): Promise<ChatContext | null> {
    const conversation = await storage.getChatConversation(conversationId);
    if (!conversation || conversation.tenantId !== tenantId) {
      return null;
    }

    // Restore context from metadata if available
    const savedContext = conversation.metadata as any;
    const context: ChatContext = {
      tenantId,
      conversationId,
      contactEmail: savedContext?.contactEmail,
      contactName: savedContext?.contactName,
      contactPhone: savedContext?.contactPhone,
      leadQualified: savedContext?.leadQualified || false,
      bookingIntent: savedContext?.bookingIntent || false,
    };

    this.contexts.set(conversationId, context);
    return context;
  }

  /**
   * Persist context changes to database
   */
  private async persistContext(context: ChatContext): Promise<void> {
    await storage.updateChatConversation(context.conversationId, {
      metadata: {
        contactEmail: context.contactEmail,
        contactName: context.contactName,
        contactPhone: context.contactPhone,
        leadQualified: context.leadQualified,
        bookingIntent: context.bookingIntent,
      }
    }, context.tenantId);
  }

  /**
   * Build system prompt with tenant-specific context
   */
  private async buildSystemPrompt(
    tenantId: string, 
    context: ChatContext
  ): Promise<string> {
    const widgetSettings = await storage.getWidgetSettings(tenantId);
    const knowledgeBase = await storage.getKnowledgeBaseArticlesByTenant(tenantId);
    const businessProfile = await storage.getBusinessProfile(tenantId);

    let prompt = `You are a helpful AI assistant for ${businessProfile?.businessName || 'this business'}.

Your role is to:
1. Answer customer questions using the provided knowledge base
2. Share relevant media (photos, videos) when asked
3. Capture lead information (name, email, phone) naturally in conversation
4. Help customers book appointments when they express interest

Communication Style: ${widgetSettings?.tone || 'friendly and professional'}
`;

    // Add knowledge base context
    if (knowledgeBase.length > 0) {
      prompt += `\n\nKnowledge Base:\n`;
      knowledgeBase.forEach(article => {
        prompt += `\n**${article.title}**\n${article.content}\n`;
        if (article.tags && article.tags.length > 0) {
          prompt += `Tags: ${article.tags.join(', ')}\n`;
        }
      });
    }

    // Add business profile context
    if (businessProfile) {
      prompt += `\n\nBusiness Information:\n`;
      if (businessProfile.targetAudience) {
        prompt += `Target Audience: ${businessProfile.targetAudience}\n`;
      }
      if (businessProfile.services) {
        prompt += `Services: ${businessProfile.services.join(', ')}\n`;
      }
      if (businessProfile.uniqueSellingPoints) {
        prompt += `USP: ${businessProfile.uniqueSellingPoints}\n`;
      }
    }

    // Add custom instructions if available
    const customInstructions = await storage.getCustomInstructions(tenantId);
    if (customInstructions) {
      prompt += `\n\nAdditional Instructions:\n${customInstructions.instructions}\n`;
    }

    // Add lead qualification instructions
    if (!context.leadQualified) {
      const aggressiveness = widgetSettings?.bookingPromptAggressiveness || 'medium';
      if (aggressiveness === 'high') {
        prompt += `\n\nIMPORTANT: Try to capture the customer's contact information (name, email, phone) early in the conversation.`;
      } else if (aggressiveness === 'medium') {
        prompt += `\n\nNote: If the customer seems interested, you can ask for their contact information to follow up.`;
      } else {
        prompt += `\n\nNote: Only ask for contact information if the customer explicitly wants to be contacted or book something.`;
      }
    }

    return prompt;
  }

  /**
   * Get function definitions for OpenAI
   */
  private getFunctionDefinitions() {
    return [
      {
        name: 'search_media',
        description: 'Search for and retrieve media files (photos, videos, audio) to share with the customer',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query or category name to find relevant media'
            },
            mediaType: {
              type: 'string',
              enum: ['photo', 'video', 'audio', 'all'],
              description: 'Type of media to search for'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'capture_lead_info',
        description: 'Capture customer contact information (name, email, phone) when they provide it',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Customer full name'
            },
            email: {
              type: 'string',
              description: 'Customer email address'
            },
            phone: {
              type: 'string',
              description: 'Customer phone number'
            }
          },
          required: []
        }
      },
      {
        name: 'get_available_services',
        description: 'Get list of bookable services to show to customer',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'check_availability',
        description: 'Check available time slots for a specific service',
        parameters: {
          type: 'object',
          properties: {
            serviceId: {
              type: 'string',
              description: 'ID of the service to check availability for'
            },
            date: {
              type: 'string',
              description: 'Date to check availability (YYYY-MM-DD format)'
            }
          },
          required: ['serviceId', 'date']
        }
      },
      {
        name: 'create_booking_request',
        description: 'Create a booking request after customer selects service and time',
        parameters: {
          type: 'object',
          properties: {
            serviceId: {
              type: 'string',
              description: 'ID of the service to book'
            },
            datetime: {
              type: 'string',
              description: 'Requested booking date and time (ISO 8601 format)'
            },
            notes: {
              type: 'string',
              description: 'Any additional notes or requirements from customer'
            }
          },
          required: ['serviceId', 'datetime']
        }
      }
    ];
  }

  /**
   * Handle function calls from OpenAI with error protection
   */
  private async handleFunctionCall(
    context: ChatContext,
    functionName: string,
    args: any
  ): Promise<any> {
    try {
      switch (functionName) {
        case 'search_media':
          return await this.searchMedia(context.tenantId, args.query, args.mediaType);

        case 'capture_lead_info':
          return await this.captureLeadInfo(context, args);

        case 'get_available_services':
          return await this.getAvailableServices(context.tenantId);

        case 'check_availability':
          return await this.checkAvailability(
            context.tenantId, 
            args.serviceId, 
            args.date
          );

        case 'create_booking_request':
          return await this.createBookingRequest(context, args);

        default:
          return { success: false, error: 'Unknown function' };
      }
    } catch (error) {
      console.error(`Function call error [${functionName}]:`, error);
      return {
        success: false,
        error: `Failed to execute ${functionName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search for media in the library
   */
  private async searchMedia(
    tenantId: string, 
    query: string, 
    mediaType?: string
  ): Promise<any> {
    const allMedia = await storage.getMediaLibraryByTenant(tenantId);
    
    // Filter by type if specified
    let filtered = mediaType && mediaType !== 'all' 
      ? allMedia.filter(m => m.type === mediaType)
      : allMedia;

    // Search by title, category, or tags
    const searchLower = query.toLowerCase();
    filtered = filtered.filter(m => {
      const matchTitle = m.title.toLowerCase().includes(searchLower);
      const matchCategory = m.category?.toLowerCase().includes(searchLower);
      const matchTags = m.tags?.some(t => t.toLowerCase().includes(searchLower));
      return matchTitle || matchCategory || matchTags;
    });

    // Return up to 5 results
    const results = filtered.slice(0, 5).map(m => ({
      id: m.id,
      title: m.title,
      url: m.url,
      type: m.type,
      category: m.category,
      thumbnailUrl: m.thumbnailUrl
    }));

    return {
      success: true,
      results,
      count: results.length
    };
  }

  /**
   * Capture lead information
   */
  private async captureLeadInfo(
    context: ChatContext,
    info: { name?: string; email?: string; phone?: string }
  ): Promise<any> {
    // Update context
    if (info.name) context.contactName = info.name;
    if (info.email) context.contactEmail = info.email;
    if (info.phone) context.contactPhone = info.phone;

    // Persist context changes immediately
    await this.persistContext(context);

    // Check if we have enough info to create/update contact
    if (context.contactEmail) {
      // Check if contact exists
      let contact = await storage.getContactByEmail(context.contactEmail, context.tenantId);
      
      if (contact) {
        // Update existing contact if we have new info
        const updates: any = {};
        if (info.name && info.name !== contact.name) {
          const nameParts = info.name.split(' ');
          updates.firstName = nameParts[0];
          updates.lastName = nameParts.slice(1).join(' ');
          updates.name = info.name;
        }
        if (info.phone && info.phone !== contact.phone) {
          updates.phone = info.phone;
        }
        
        if (Object.keys(updates).length > 0) {
          contact = await storage.updateContact(contact.id, updates, context.tenantId);
        }
      } else {
        // Create new contact
        const nameParts = (info.name || '').split(' ');
        contact = await storage.createContact({
          tenantId: context.tenantId,
          email: info.email,
          name: info.name || info.email,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: info.phone,
          source: 'chat_widget',
          status: 'active'
        }, context.tenantId);
      }

      // Create or update lead if not qualified yet
      if (!context.leadQualified) {
        const existingLead = await storage.getLeadsByContact(contact.id, context.tenantId);
        
        if (existingLead.length === 0) {
          await storage.createLead({
            tenantId: context.tenantId,
            contactId: contact.id,
            source: 'chat_widget',
            status: 'new',
            notes: `Initial contact via chat widget`
          }, context.tenantId);
        }

        context.leadQualified = true;
        await this.persistContext(context); // Persist lead qualification status
      }

      return {
        success: true,
        contactCreated: true,
        leadCreated: true
      };
    }

    return {
      success: true,
      contactCreated: false,
      message: 'Information captured, need email to create contact'
    };
  }

  /**
   * Get available bookable services
   */
  private async getAvailableServices(tenantId: string): Promise<any> {
    const services = await storage.getBookableServicesByTenant(tenantId);
    
    const activeServices = services
      .filter(s => s.isActive)
      .map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        duration: s.duration,
        price: s.price,
        currency: s.currency
      }));

    return {
      success: true,
      services: activeServices,
      count: activeServices.length
    };
  }

  /**
   * Check availability for a service on a specific date
   */
  private async checkAvailability(
    tenantId: string,
    serviceId: string,
    date: string
  ): Promise<any> {
    try {
      // Get service
      const service = await storage.getBookableService(serviceId);
      if (!service || service.tenantId !== tenantId) {
        return { success: false, error: 'Service not found' };
      }

      // Get available slots (simplified - would need full scheduler logic)
      // For now, return sample slots
      const slots = [
        '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'
      ];

      return {
        success: true,
        date,
        serviceName: service.name,
        availableSlots: slots
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to check availability' 
      };
    }
  }

  /**
   * Create a booking request
   */
  private async createBookingRequest(
    context: ChatContext,
    args: { serviceId: string; datetime: string; notes?: string }
  ): Promise<any> {
    try {
      // Ensure we have contact info
      if (!context.contactEmail) {
        return {
          success: false,
          error: 'Need contact information before booking',
          requiresContact: true
        };
      }

      // Get service and validate tenant ownership (security check)
      const service = await storage.getBookableService(args.serviceId);
      if (!service || service.tenantId !== context.tenantId) {
        return {
          success: false,
          error: 'Service not found or access denied'
        };
      }

      // Get or create contact
      let contact = await storage.getContactByEmail(context.contactEmail, context.tenantId);
      if (!contact) {
        const nameParts = (context.contactName || '').split(' ');
        contact = await storage.createContact({
          tenantId: context.tenantId,
          email: context.contactEmail,
          name: context.contactName || context.contactEmail,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          phone: context.contactPhone,
          source: 'chat_widget',
          status: 'active'
        }, context.tenantId);
      }

      // Create project for the booking
      const project = await storage.createProject({
        tenantId: context.tenantId,
        contactId: contact.id,
        name: `${service.name} - ${contact.name}`,
        type: 'booking',
        status: 'pending',
        startDate: new Date(args.datetime),
        createdBy: contact.id // Using contact ID as creator since no user context
      }, context.tenantId);

      // Create booking
      const booking = await storage.createBooking({
        tenantId: context.tenantId,
        serviceId: args.serviceId,
        contactId: contact.id,
        projectId: project.id,
        requestedDatetime: new Date(args.datetime),
        status: 'pending',
        notes: args.notes
      }, context.tenantId);

      context.bookingIntent = true;
      await this.persistContext(context); // Persist booking intent

      return {
        success: true,
        bookingId: booking.id,
        projectId: project.id,
        status: 'pending',
        message: 'Booking request created successfully'
      };
    } catch (error) {
      console.error('Booking creation error:', error);
      return {
        success: false,
        error: 'Failed to create booking'
      };
    }
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string, tenantId: string): Promise<void> {
    await storage.updateChatConversation(conversationId, {
      status: 'closed',
      endedAt: new Date()
    }, tenantId);

    this.contexts.delete(conversationId);
  }
}

export const aiChatWidget = new AIChatWidgetService();
