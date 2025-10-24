import OpenAI from 'openai';
import { storage } from '../../storage';
import type { 
  InsertTenantOnboardingProgress,
  InsertBookableService,
  InsertAvailabilitySchedule,
  InsertWidgetSettings 
} from '@shared/schema';

// Using Replit AI Integrations which provides OpenAI-compatible API access without requiring your own API key
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

interface OnboardingContext {
  tenantId: string;
  userId: string;
  conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  extractedData: {
    businessInfo?: {
      businessName?: string;
      industry?: string;
      targetAudience?: string;
      description?: string;
    };
    services?: Array<{
      name: string;
      description?: string;
      duration?: number;
      price?: number;
      currency?: string;
    }>;
    availability?: {
      scheduleName?: string;
      timezone?: string;
      workingHours?: Array<{
        dayOfWeek: string;
        startTime: string;
        endTime: string;
      }>;
    };
    widgetConfig?: {
      welcomeMessage?: string;
      brandColor?: string;
      tone?: string;
    };
    knowledgeBase?: Array<{
      title: string;
      content: string;
      category?: string;
    }>;
  };
}

const ONBOARDING_SYSTEM_PROMPT = `You are a friendly AI assistant helping a business owner set up their new CRM system. Your goal is to guide them through a conversational onboarding process to configure:

1. **Business Information**: Company name, industry, target audience, services offered
2. **Bookable Services**: What services they offer, pricing, duration
3. **Availability**: When they're available for bookings, working hours
4. **Email & Calendar Integration**: Connect Gmail/Outlook for email management and calendar sync
5. **AI Chat Widget**: Welcome message, brand color, tone of voice
6. **Knowledge Base**: FAQs and information about their business

Be conversational and friendly. Ask one question at a time. Listen carefully to their responses and extract structured information. Don't overwhelm them - make it feel like a natural conversation, not a form.

For email/calendar integration, explain that connecting their email (Gmail or Outlook) will allow them to:
- Manage emails directly in the CRM
- Sync calendar events automatically
- Prevent double-bookings with calendar conflict detection
- Send professional emails from the platform

Ask if they'd like to connect their email account. If they say yes or show interest, guide them to connect it. If they prefer to skip it for now, that's fine - they can always set it up later.

When you've gathered enough information, use the available functions to save the configuration.`;

export class AIOnboardingWizard {
  private contexts: Map<string, OnboardingContext> = new Map();

  /**
   * Start a new onboarding conversation for a tenant
   */
  async startOnboarding(tenantId: string, userId: string): Promise<string> {
    const initialAssistantMessage = "Hi! I'm here to help you set up your new CRM system. Let's start with the basics - what's your business name?";
    
    const context: OnboardingContext = {
      tenantId,
      userId,
      conversationHistory: [
        { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
        { role: 'assistant', content: initialAssistantMessage }
      ],
      extractedData: {}
    };

    this.contexts.set(tenantId, context);

    // Create initial onboarding progress record with persisted conversation
    await storage.createTenantOnboardingProgress({
      tenantId,
      currentStep: 'business_info',
      completedSteps: [],
      collectedData: {
        userId,  // Persist userId for context restoration after restarts
        conversationHistory: context.conversationHistory,
        extractedData: context.extractedData
      },
      isCompleted: false,
      isSkipped: false
    }, tenantId);

    return initialAssistantMessage;
  }

  /**
   * Continue the onboarding conversation
   */
  async chat(tenantId: string, userMessage: string): Promise<string> {
    // Try to get context from memory, or restore from database
    let context = this.contexts.get(tenantId);
    if (!context) {
      context = await this.restoreContext(tenantId);
      if (!context) {
        throw new Error('Onboarding context not found. Please start onboarding first.');
      }
    }

    // Add user message to history
    context.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Call OpenAI with function calling to extract structured data
    // The newest OpenAI model is "gpt-5" which was released August 7, 2025. Do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: context.conversationHistory,
      functions: this.getFunctionDefinitions(),
      function_call: 'auto',
    });

    const message = response.choices[0].message;

    // Check if function was called
    if (message.function_call) {
      const functionName = message.function_call.name;
      const functionArgs = JSON.parse(message.function_call.arguments);

      await this.handleFunctionCall(context, functionName, functionArgs);

      // Generate a simple response after saving data
      let assistantReply = "Great! I've saved that information. ";
      
      // Provide contextual follow-up based on what was saved
      switch (functionName) {
        case 'save_business_info':
          assistantReply += "Now, what services do you offer? Tell me about your main offerings.";
          break;
        case 'save_services':
          assistantReply += "Excellent! When are you typically available for bookings? What are your working hours?";
          break;
        case 'save_availability':
          assistantReply += "Perfect! Now, would you like to connect your email account (Gmail or Outlook)? This will let you manage emails and sync your calendar directly in the CRM, preventing double-bookings. It's optional, but really helpful!";
          break;
        case 'skip_email_integration':
          assistantReply += "No problem! You can always connect your email later from settings. Let's move on to setting up your AI chat widget. What welcome message would you like visitors to see?";
          break;
        case 'guide_email_integration':
          assistantReply += "Great! To connect your email, you'll need to go to Settings > Integrations after this setup. For now, let's continue with your chat widget. What welcome message would you like visitors to see?";
          break;
        case 'save_widget_config':
          assistantReply += "Wonderful! Your CRM is almost ready. Is there anything else you'd like to add, like FAQs or business policies?";
          break;
        case 'complete_onboarding':
          assistantReply = "🎉 All done! Your CRM is fully set up and ready to use. You can always update these settings later.";
          break;
        default:
          assistantReply += "What would you like to configure next?";
      }
      
      context.conversationHistory.push({
        role: 'assistant',
        content: assistantReply
      });

      // Persist updated context to database
      await this.persistContext(context);

      return assistantReply;
    }

    // Regular text response
    const assistantReply = message.content || "I understand. Could you tell me more?";
    context.conversationHistory.push({
      role: 'assistant',
      content: assistantReply
    });

    // Persist updated context to database
    await this.persistContext(context);

    return assistantReply;
  }

  /**
   * Restore conversation context from database
   */
  private async restoreContext(tenantId: string): Promise<OnboardingContext | null> {
    const progress = await storage.getTenantOnboardingProgress(tenantId);
    if (!progress || !progress.collectedData) {
      return null;
    }

    const savedData = progress.collectedData as any;
    const context: OnboardingContext = {
      tenantId,
      userId: savedData.userId || '', // Restore persisted userId
      conversationHistory: savedData.conversationHistory || [
        { role: 'system', content: ONBOARDING_SYSTEM_PROMPT }
      ],
      extractedData: savedData.extractedData || {}
    };

    // Validate userId was persisted - throw early if context is invalid
    if (!context.userId) {
      throw new Error('Cannot restore onboarding context: userId was not persisted');
    }

    // Cache in memory for subsequent requests
    this.contexts.set(tenantId, context);
    return context;
  }

  /**
   * Persist conversation context to database
   */
  private async persistContext(context: OnboardingContext): Promise<void> {
    const progress = await storage.getTenantOnboardingProgress(context.tenantId);
    if (!progress) return;

    const currentData = (progress.collectedData as any) || {};
    await storage.updateTenantOnboardingProgress(progress.id, {
      collectedData: {
        ...currentData,
        userId: context.userId,  // Always persist userId for reliable restoration
        conversationHistory: context.conversationHistory,
        extractedData: context.extractedData
      }
    }, context.tenantId);
  }

  /**
   * Get function definitions for OpenAI function calling
   */
  private getFunctionDefinitions(): OpenAI.Chat.ChatCompletionCreateParams.Function[] {
    return [
      {
        name: 'save_business_info',
        description: 'Save the business information collected from the conversation',
        parameters: {
          type: 'object',
          properties: {
            businessName: { type: 'string', description: 'The name of the business' },
            industry: { type: 'string', description: 'The industry or sector the business operates in' },
            targetAudience: { type: 'string', description: 'The target audience or customer base' },
            description: { type: 'string', description: 'A brief description of the business' }
          },
          required: ['businessName']
        }
      },
      {
        name: 'save_services',
        description: 'Save the bookable services offered by the business',
        parameters: {
          type: 'object',
          properties: {
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Service name' },
                  description: { type: 'string', description: 'Service description' },
                  duration: { type: 'number', description: 'Duration in minutes' },
                  price: { type: 'number', description: 'Price amount' },
                  currency: { type: 'string', description: 'Currency code (e.g., USD, EUR)' }
                },
                required: ['name']
              }
            }
          },
          required: ['services']
        }
      },
      {
        name: 'save_availability',
        description: 'Save the availability schedule and working hours',
        parameters: {
          type: 'object',
          properties: {
            scheduleName: { type: 'string', description: 'Name for the availability schedule' },
            timezone: { type: 'string', description: 'Timezone (e.g., America/New_York)' },
            workingHours: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  dayOfWeek: { type: 'string', description: 'Day of week (Monday, Tuesday, etc.)' },
                  startTime: { type: 'string', description: 'Start time in HH:MM format' },
                  endTime: { type: 'string', description: 'End time in HH:MM format' }
                },
                required: ['dayOfWeek', 'startTime', 'endTime']
              }
            }
          },
          required: ['scheduleName', 'timezone', 'workingHours']
        }
      },
      {
        name: 'skip_email_integration',
        description: 'User chose to skip email/calendar integration for now',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Optional reason for skipping' }
          }
        }
      },
      {
        name: 'guide_email_integration',
        description: 'User wants to set up email/calendar integration',
        parameters: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'Preferred email provider (gmail or outlook)', enum: ['gmail', 'outlook', 'unknown'] }
          }
        }
      },
      {
        name: 'save_widget_config',
        description: 'Save the AI chat widget configuration',
        parameters: {
          type: 'object',
          properties: {
            welcomeMessage: { type: 'string', description: 'Welcome message for the chat widget' },
            brandColor: { type: 'string', description: 'Brand color in hex format (e.g., #3B82F6)' },
            tone: { type: 'string', description: 'Tone of voice for AI responses (friendly, professional, etc.)' }
          },
          required: ['welcomeMessage']
        }
      },
      {
        name: 'complete_onboarding',
        description: 'Mark the onboarding process as complete',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'A summary of what was configured' }
          },
          required: ['summary']
        }
      }
    ];
  }

  /**
   * Handle function calls from OpenAI
   */
  private async handleFunctionCall(
    context: OnboardingContext,
    functionName: string,
    args: any
  ): Promise<void> {
    const { tenantId, userId } = context;

    switch (functionName) {
      case 'save_business_info':
        context.extractedData.businessInfo = args;
        await this.updateProgress(tenantId, 'business_info', args);
        break;

      case 'save_services':
        context.extractedData.services = args.services;
        // Create bookable services in database
        for (const service of args.services) {
          await storage.createBookableService({
            tenantId,
            name: service.name,
            description: service.description || '',
            duration: service.duration || 60,
            price: service.price || 0,
            currency: service.currency || 'USD',
            isActive: true,
            createdBy: userId
          }, tenantId);
        }
        await this.updateProgress(tenantId, 'services', args);
        break;

      case 'save_availability':
        context.extractedData.availability = args;
        // Create availability schedule
        await storage.createAvailabilitySchedule({
          tenantId,
          name: args.scheduleName,
          timezone: args.timezone,
          publicLink: this.generatePublicLink(args.scheduleName),
          isActive: true,
          defaultDuration: 60,
          bufferBefore: 0,
          bufferAfter: 0
        }, tenantId);
        await this.updateProgress(tenantId, 'availability', args);
        break;

      case 'skip_email_integration':
        // User chose to skip email integration
        await this.updateProgress(tenantId, 'email_integration', { skipped: true, reason: args.reason });
        break;

      case 'guide_email_integration':
        // User wants email integration - just note their preference
        await this.updateProgress(tenantId, 'email_integration', { 
          interested: true, 
          provider: args.provider 
        });
        break;

      case 'save_widget_config':
        context.extractedData.widgetConfig = args;
        // Create widget settings
        await storage.upsertWidgetSettings({
          tenantId,
          welcomeMessage: args.welcomeMessage,
          brandColor: args.brandColor || '#3B82F6',
          deploymentMode: 'embedded',
          enableBookingPrompt: true,
          bookingPromptAggression: 'medium',
          aiTone: args.tone || 'friendly',
          isActive: true
        }, tenantId);
        await this.updateProgress(tenantId, 'widget_config', args);
        break;

      case 'complete_onboarding':
        // Mark onboarding as complete
        const progress = await storage.getTenantOnboardingProgress(tenantId);
        if (progress) {
          await storage.updateTenantOnboardingProgress(progress.id, {
            isCompleted: true,
            currentStep: 'complete',
            completedSteps: ['business_info', 'services', 'availability', 'email_integration', 'widget_config'],
            collectedData: {
              ...progress.collectedData,
              summary: args.summary
            },
            completedAt: new Date()
          }, tenantId);
        }
        this.contexts.delete(tenantId);
        break;
    }
  }

  /**
   * Update onboarding progress in database
   */
  private async updateProgress(
    tenantId: string,
    step: string,
    data: any
  ): Promise<void> {
    const progress = await storage.getTenantOnboardingProgress(tenantId);
    if (!progress) return;

    const completedSteps = progress.completedSteps || [];
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
    }

    const collectedData = { ...progress.collectedData, [step]: data };

    await storage.updateTenantOnboardingProgress(progress.id, {
      currentStep: this.getNextStep(step),
      completedSteps,
      collectedData
    }, tenantId);
  }

  /**
   * Determine the next step in the onboarding flow
   */
  private getNextStep(currentStep: string): string {
    const flow = ['business_info', 'services', 'availability', 'widget_config', 'complete'];
    const currentIndex = flow.indexOf(currentStep);
    return currentIndex >= 0 && currentIndex < flow.length - 1
      ? flow[currentIndex + 1]
      : 'complete';
  }

  /**
   * Generate a unique public link for the schedule
   */
  private generatePublicLink(scheduleName: string): string {
    const slug = scheduleName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const random = Math.random().toString(36).substring(2, 8);
    return `${slug}-${random}`;
  }

  /**
   * Get onboarding status for a tenant
   */
  async getStatus(tenantId: string): Promise<any> {
    return await storage.getTenantOnboardingProgress(tenantId);
  }

  /**
   * Clean up context (useful for testing or reset)
   */
  clearContext(tenantId: string): void {
    this.contexts.delete(tenantId);
  }
}

// Export singleton instance
export const aiOnboardingWizard = new AIOnboardingWizard();
