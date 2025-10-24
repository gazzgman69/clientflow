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
    branding?: {
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      businessTimezone?: string;
    };
    contactDetails?: {
      phone?: string;
      address?: string;
      website?: string;
      defaultTimezone?: string;
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
    emailTone?: {
      sampleEmails?: string[];
      preferredTone?: string;
    };
    widgetConfig?: {
      welcomeMessage?: string;
      brandColor?: string;
      tone?: string;
    };
    invoiceSettings?: {
      defaultTaxRate?: string;
      paymentTerms?: string;
      invoiceLogoUrl?: string;
    };
    teamMembers?: Array<{
      name: string;
      email: string;
      role?: string;
    }>;
    knowledgeBase?: Array<{
      title: string;
      content: string;
      category?: string;
    }>;
  };
}

const ONBOARDING_SYSTEM_PROMPT = `You are a friendly AI assistant helping a business owner set up their new CRM system. Your goal is to guide them through a comprehensive yet conversational onboarding process to configure:

1. **Business Information**: Company name, industry, target audience, business description
2. **Branding**: Logo URL, primary/secondary colors, business timezone
3. **Contact Details**: Phone, address, website, default timezone
4. **Bookable Services**: Services they offer with pricing and duration
5. **Availability Schedule**: Working hours and booking availability
6. **Email Tone Learning**: Sample emails to learn their writing style (helps AI compose emails in their voice)
7. **Email & Calendar Integration**: Connect Gmail/Outlook for email management and calendar sync
8. **AI Chat Widget**: Welcome message, brand color, conversational tone
9. **Invoice Settings**: Default tax rate, payment terms, invoice branding
10. **Team Members**: Add team members with names, emails, and roles
11. **Knowledge Base**: FAQs and business information for the AI to reference

**Important Guidelines:**
- Be conversational and friendly. Ask one question at a time.
- Users can skip ANY question by saying "skip this", "I'll do this later", etc. Use the skip_current_step function when they want to skip.
- Don't overwhelm them - make it feel like a natural conversation, not a form.
- For email tone learning (step 6), explain: "To help the AI write emails in your style, you can paste 2-3 sample emails you've written before. This is optional but helps the AI match your tone perfectly."
- For email/calendar integration (step 7), explain the benefits and trigger the OAuth connection if they agree. Use trigger_oauth_connection when they want to connect.
- Listen for their progress preference - some may want to complete everything, others may prefer to skip certain sections.

**Critical Instructions:**
- When you've gathered information for a step, use the appropriate save function.
- Track progress through the steps systematically. Count how many steps have been completed or skipped.
- **IMPORTANT**: There are exactly 11 steps total. Once the user has addressed ALL 11 steps (whether completed OR skipped), you MUST immediately call the complete_onboarding function.
- The 11 steps are: (1) Business Info, (2) Branding, (3) Contact Details, (4) Services, (5) Availability, (6) Email Tone, (7) Email Integration, (8) Widget Config, (9) Invoice Settings, (10) Team Members, (11) Knowledge Base.
- Keep mental count: if 11 steps are done (completed + skipped = 11), call complete_onboarding with a summary of what was configured.
- After calling complete_onboarding, congratulate them and explain their CRM is ready. The system will automatically redirect them to the dashboard.`;

export class AIOnboardingWizard {
  private contexts: Map<string, OnboardingContext> = new Map();

  /**
   * Start a new onboarding conversation for a tenant
   */
  async startOnboarding(tenantId: string, userId: string): Promise<string> {
    // Check if onboarding progress exists
    const existingProgress = await storage.getTenantOnboardingProgress(tenantId);
    
    let initialAssistantMessage: string;
    
    if (existingProgress && !existingProgress.isCompleted) {
      // Try to restore context from database
      const restoredContext = await this.restoreContext(tenantId);
      
      if (!restoredContext) {
        // Context restoration failed - user is genuinely returning to a new session
        // Build smart resume message showing their progress
        const completedSteps = existingProgress.completedSteps || [];
        const skippedSteps = existingProgress.skippedSteps || [];
        const currentStep = existingProgress.currentStep;
        
        if (completedSteps.length > 0 || skippedSteps.length > 0) {
          initialAssistantMessage = "Welcome back! I see you've already made some progress. ";
          
          if (completedSteps.length > 0) {
            initialAssistantMessage += `You've completed: ${this.formatStepList(completedSteps)}. `;
          }
          
          if (skippedSteps.length > 0) {
            initialAssistantMessage += `You skipped: ${this.formatStepList(skippedSteps)}. `;
          }
          
          initialAssistantMessage += `Let's continue from where we left off. ${this.getNextQuestionForStep(currentStep)}`;
        } else {
          initialAssistantMessage = "Hi! I'm here to help you set up your new CRM system. Let's start with the basics - what's your business name?";
        }
        
        // Create fresh context with resume message
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
        
        // Persist the fresh context to database
        await this.persistContext(context);
        
        return initialAssistantMessage;
      } else {
        // Context successfully restored from database
        console.log('✅ [startOnboarding] Context restored successfully from database');
        
        // Check if this is a fresh restore (only system message) vs active conversation
        const assistantMessages = restoredContext.conversationHistory.filter(msg => msg.role === 'assistant');
        
        if (assistantMessages.length === 0) {
          // Fresh restore with no conversation yet - generate appropriate next question
          console.log('📝 [startOnboarding] No assistant messages yet, generating next question');
          const completedSteps = existingProgress.completedSteps || [];
          const currentStep = existingProgress.currentStep;
          
          const nextQuestion = this.getNextQuestionForStep(currentStep);
          initialAssistantMessage = nextQuestion;
          
          // Add to conversation and persist
          restoredContext.conversationHistory.push({
            role: 'assistant',
            content: initialAssistantMessage
          });
          await this.persistContext(restoredContext);
        } else {
          // Active conversation with existing messages - return last message
          console.log('💬 [startOnboarding] Active conversation detected, returning last message');
          initialAssistantMessage = assistantMessages[assistantMessages.length - 1].content;
        }
        
        return initialAssistantMessage;
      }
    }
    
    // Brand new onboarding
    initialAssistantMessage = "Hi! I'm here to help you set up your new CRM system. Let's start with the basics - what's your business name?";
    
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
      skippedSteps: [],
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
        case 'skip_current_step':
          assistantReply = "No problem! We can skip that for now. Let's move on.";
          break;
        case 'save_business_info':
          assistantReply += "Perfect! Now let's talk about branding. Do you have a logo URL and brand colors you'd like to use?";
          break;
        case 'save_branding':
          assistantReply += "Great! Now, what's your main business contact information - phone, address, and website?";
          break;
        case 'save_contact_details':
          assistantReply += "Excellent! Now tell me about the services you offer. What do you provide to your clients?";
          break;
        case 'save_services':
          assistantReply += "Perfect! When are you typically available for bookings? What are your working hours?";
          break;
        case 'save_availability':
          assistantReply += "Great! To help the AI write emails in your voice, you can optionally paste 2-3 sample emails you've written before. This helps match your writing style perfectly. Would you like to do this, or shall we skip it?";
          break;
        case 'save_email_tone':
          assistantReply += "Perfect! I've saved your email samples. Now, would you like to connect your email account (Gmail or Outlook)? This will let you manage emails and sync your calendar directly in the CRM.";
          break;
        case 'trigger_oauth_connection':
          assistantReply = "Great! I'm opening the login window for " + (functionArgs.provider === 'gmail' ? 'Gmail' : 'Outlook') + ". Please complete the login there. I'll wait for you to finish...";
          break;
        case 'skip_email_integration':
          assistantReply += "No problem! You can connect your email later from settings. Let's set up your AI chat widget. What welcome message would you like visitors to see?";
          break;
        case 'save_widget_config':
          assistantReply += "Wonderful! Now let's set up some invoice defaults. What tax rate and payment terms do you typically use?";
          break;
        case 'save_invoice_settings':
          assistantReply += "Great! Would you like to add any team members to your CRM now?";
          break;
        case 'save_team_members':
          assistantReply += "Perfect! Your CRM is almost ready. Would you like to add any FAQs or business information for the AI to reference?";
          break;
        case 'complete_onboarding':
          assistantReply = "🎉 All done! Your CRM is fully set up and ready to use. You can always update these settings later from the dashboard.";
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
    
    console.log('🔍 [restoreContext] Debug:', {
      hasProgress: !!progress,
      hasCollectedData: !!progress?.collectedData,
      collectedDataType: progress?.collectedData ? typeof progress.collectedData : 'n/a',
      collectedDataKeys: progress?.collectedData ? Object.keys(progress.collectedData as any) : []
    });
    
    if (!progress || !progress.collectedData) {
      console.log('⚠️  [restoreContext] Returning null - no progress or no collectedData');
      return null;
    }

    // Parse JSON string to object (collectedData is stored as text in DB)
    const savedData = typeof progress.collectedData === 'string' 
      ? JSON.parse(progress.collectedData) 
      : progress.collectedData;
    
    let conversationHistory = savedData.conversationHistory || [
      { role: 'system', content: ONBOARDING_SYSTEM_PROMPT }
    ];

    // Trim conversation history on restore to prevent payload size issues
    // This handles cases where old records have massive history
    const MAX_MESSAGES = 30;
    if (conversationHistory.length > MAX_MESSAGES + 1) {
      const systemMessage = conversationHistory[0];
      const recentMessages = conversationHistory.slice(-MAX_MESSAGES);
      conversationHistory = [systemMessage, ...recentMessages];
    }

    const context: OnboardingContext = {
      tenantId,
      userId: savedData.userId || '', // Restore persisted userId
      conversationHistory,
      extractedData: savedData.extractedData || {}
    };

    // Validate userId was persisted - return null if context is invalid to allow fresh creation
    if (!context.userId) {
      console.warn(`⚠️  Cannot restore onboarding context for tenant ${tenantId}: userId was not persisted. Fresh context will be created.`);
      return null;
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

    // Limit conversation history to prevent database payload size issues
    // Keep system prompt + last 30 messages to stay under 64MB limit
    const MAX_MESSAGES = 30;
    let trimmedHistory = context.conversationHistory;
    
    if (context.conversationHistory.length > MAX_MESSAGES + 1) {
      // Keep system message (always first) + last N messages
      const systemMessage = context.conversationHistory[0];
      const recentMessages = context.conversationHistory.slice(-MAX_MESSAGES);
      trimmedHistory = [systemMessage, ...recentMessages];
      console.log(`📏 Trimmed conversation history from ${context.conversationHistory.length} to ${trimmedHistory.length} messages`);
    }

    // Don't spread currentData - only persist exact fields we need
    // This prevents carrying forward any bloated data from previous bugs
    const collectedDataPayload = {
      userId: context.userId,
      conversationHistory: trimmedHistory,
      extractedData: context.extractedData
    };
    
    // Log payload size before persisting
    const payloadSize = JSON.stringify(collectedDataPayload).length;
    const payloadSizeMB = (payloadSize / 1024 / 1024).toFixed(2);
    console.log(`💾 Persisting onboarding data: ${payloadSize} bytes (${payloadSizeMB} MB)`);
    
    if (payloadSize > 10000000) { // 10MB warning
      console.warn(`⚠️  Large payload detected: ${payloadSizeMB} MB - may cause database issues`);
    }

    await storage.updateTenantOnboardingProgress(progress.id, {
      collectedData: collectedDataPayload
    }, context.tenantId);
  }

  /**
   * Get function definitions for OpenAI function calling
   */
  private getFunctionDefinitions(): OpenAI.Chat.ChatCompletionCreateParams.Function[] {
    return [
      {
        name: 'skip_current_step',
        description: 'User wants to skip the current onboarding step',
        parameters: {
          type: 'object',
          properties: {
            stepName: { type: 'string', description: 'Name of the step being skipped' },
            reason: { type: 'string', description: 'Optional reason for skipping' }
          },
          required: ['stepName']
        }
      },
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
        name: 'save_branding',
        description: 'Save the branding and visual identity information',
        parameters: {
          type: 'object',
          properties: {
            logoUrl: { type: 'string', description: 'URL to business logo' },
            primaryColor: { type: 'string', description: 'Primary brand color in hex format' },
            secondaryColor: { type: 'string', description: 'Secondary brand color in hex format' },
            businessTimezone: { type: 'string', description: 'Business timezone (e.g., America/New_York)' }
          }
        }
      },
      {
        name: 'save_contact_details',
        description: 'Save business contact information',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Business phone number' },
            address: { type: 'string', description: 'Business address' },
            website: { type: 'string', description: 'Business website URL' },
            defaultTimezone: { type: 'string', description: 'Default timezone for the business' }
          }
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
        name: 'save_email_tone',
        description: 'Save email writing style samples to help AI match user tone',
        parameters: {
          type: 'object',
          properties: {
            sampleEmails: {
              type: 'array',
              items: { type: 'string', description: 'Sample email text' },
              description: 'Array of 2-3 sample emails user has written'
            },
            preferredTone: { type: 'string', description: 'Preferred email tone (professional, friendly, casual, etc.)' }
          },
          required: ['sampleEmails']
        }
      },
      {
        name: 'trigger_oauth_connection',
        description: 'Trigger email/calendar OAuth connection flow for Gmail or Outlook',
        parameters: {
          type: 'object',
          properties: {
            provider: { 
              type: 'string', 
              description: 'Email provider to connect (gmail or outlook)', 
              enum: ['gmail', 'outlook'] 
            }
          },
          required: ['provider']
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
        name: 'save_invoice_settings',
        description: 'Save default invoice and payment settings',
        parameters: {
          type: 'object',
          properties: {
            defaultTaxRate: { type: 'string', description: 'Default tax rate percentage (e.g., "20.00")' },
            paymentTerms: { type: 'string', description: 'Default payment terms (e.g., "Net 30", "Due on receipt")' },
            invoiceLogoUrl: { type: 'string', description: 'Logo URL to display on invoices' }
          }
        }
      },
      {
        name: 'save_team_members',
        description: 'Save team members to the CRM',
        parameters: {
          type: 'object',
          properties: {
            teamMembers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Team member full name' },
                  email: { type: 'string', description: 'Team member email' },
                  role: { type: 'string', description: 'Team member role or job title' }
                },
                required: ['name', 'email']
              }
            }
          },
          required: ['teamMembers']
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
      case 'skip_current_step':
        // User wants to skip a step - mark it as skipped
        const progressSkip = await storage.getTenantOnboardingProgress(tenantId);
        if (progressSkip) {
          const skippedSteps = progressSkip.skippedSteps || [];
          if (!skippedSteps.includes(args.stepName)) {
            skippedSteps.push(args.stepName);
          }
          await storage.updateTenantOnboardingProgress(progressSkip.id, {
            skippedSteps,
            currentStep: this.getNextStep(args.stepName)
          }, tenantId);
        }
        break;

      case 'save_business_info':
        context.extractedData.businessInfo = args;
        await this.updateProgress(tenantId, 'business_info', args);
        break;

      case 'save_branding':
        context.extractedData.branding = args;
        await this.updateProgress(tenantId, 'branding', args);
        break;

      case 'save_contact_details':
        context.extractedData.contactDetails = args;
        await this.updateProgress(tenantId, 'contact_details', args);
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

      case 'save_email_tone':
        context.extractedData.emailTone = args;
        // Save email style samples to user_style_samples table
        if (args.sampleEmails && args.sampleEmails.length > 0) {
          // Delete existing samples first
          await storage.deleteAllUserStyleSamples(userId, tenantId);
          // Create new samples
          for (const sampleText of args.sampleEmails) {
            await storage.createUserStyleSample({
              userId,
              tenantId,
              sampleText
            }, tenantId);
          }
        }
        await this.updateProgress(tenantId, 'email_tone', args);
        break;

      case 'trigger_oauth_connection':
        // Set pending OAuth provider to trigger frontend popup
        const progressOAuth = await storage.getTenantOnboardingProgress(tenantId);
        if (progressOAuth) {
          await storage.updateTenantOnboardingProgress(progressOAuth.id, {
            pendingOAuthProvider: args.provider
          }, tenantId);
        }
        await this.updateProgress(tenantId, 'email_integration', { 
          triggeringOAuth: true, 
          provider: args.provider 
        });
        break;

      case 'skip_email_integration':
        // User chose to skip email integration
        await this.updateProgress(tenantId, 'email_integration', { skipped: true, reason: args.reason });
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

      case 'save_invoice_settings':
        context.extractedData.invoiceSettings = args;
        // Note: Invoice settings would be saved to tenant settings or tax_settings table
        // For now, just track in progress
        await this.updateProgress(tenantId, 'invoice_settings', args);
        break;

      case 'save_team_members':
        context.extractedData.teamMembers = args.teamMembers;
        // Note: Team members would be created as users/members in the system
        // For now, just track in progress
        await this.updateProgress(tenantId, 'team_members', args);
        break;

      case 'complete_onboarding':
        // Mark onboarding as complete
        const progress = await storage.getTenantOnboardingProgress(tenantId);
        if (progress) {
          // Preserve actual completed/skipped steps from the conversation, don't overwrite with hardcoded list
          const currentCompletedSteps = progress.completedSteps || [];
          const currentSkippedSteps = progress.skippedSteps || [];
          
          console.log(`✅ Completing onboarding for tenant ${tenantId}`);
          console.log(`   Completed steps: ${currentCompletedSteps.join(', ')}`);
          console.log(`   Skipped steps: ${currentSkippedSteps.join(', ')}`);
          
          // Get current collected data to preserve userId and extractedData
          const currentData = progress.collectedData as any || {};
          
          await storage.updateTenantOnboardingProgress(progress.id, {
            isCompleted: true,
            currentStep: 'complete',
            completedSteps: currentCompletedSteps, // Preserve actual progress
            skippedSteps: currentSkippedSteps, // Preserve skipped steps
            collectedData: {
              userId: currentData.userId,
              conversationHistory: currentData.conversationHistory || [],
              extractedData: currentData.extractedData || {},
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

    // CRITICAL FIX: Don't spread collected data - preserve only the 3 essential fields
    // and update extractedData with the new step data
    const currentData = progress.collectedData as any || {};
    const extractedData = currentData.extractedData || {};
    
    const collectedData = {
      userId: currentData.userId,
      conversationHistory: currentData.conversationHistory || [],
      extractedData: {
        ...extractedData,
        [step]: data // Add/update this step's data in extractedData
      }
    };

    await storage.updateTenantOnboardingProgress(progress.id, {
      currentStep: this.getNextStep(step),
      completedSteps,
      collectedData
    }, tenantId);
  }

  /**
   * Determine the next step in the onboarding flow
   * IMPORTANT: Never auto-advance to 'complete' - only complete_onboarding function should do that
   */
  private getNextStep(currentStep: string): string {
    const flow = [
      'business_info',
      'branding',
      'contact_details',
      'services',
      'availability',
      'email_tone',
      'email_integration',
      'widget_config',
      'invoice_settings',
      'team_members',
      'knowledge_base'
      // NOTE: 'complete' is intentionally excluded - only complete_onboarding should set it
    ];
    const currentIndex = flow.indexOf(currentStep);
    // If we're at knowledge_base (last step), stay there until AI calls complete_onboarding
    if (currentIndex >= 0 && currentIndex < flow.length - 1) {
      return flow[currentIndex + 1];
    } else {
      // Stay on knowledge_base or current step instead of auto-advancing to 'complete'
      return currentIndex >= 0 ? currentStep : flow[0];
    }
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
   * Clear pending OAuth provider (after popup is opened)
   */
  async clearPendingOAuth(tenantId: string): Promise<void> {
    const progress = await storage.getTenantOnboardingProgress(tenantId);
    if (progress) {
      await storage.updateTenantOnboardingProgress(progress.id, {
        pendingOAuthProvider: null
      }, tenantId);
    }
  }

  /**
   * Clean up context (useful for testing or reset)
   */
  clearContext(tenantId: string): void {
    this.contexts.delete(tenantId);
  }

  /**
   * Format a list of step keys into human-readable names
   */
  private formatStepList(steps: string[]): string {
    const stepNames: Record<string, string> = {
      business_info: 'Business Info',
      branding: 'Branding',
      contact_details: 'Contact Details',
      services: 'Services',
      availability: 'Availability',
      email_tone: 'Email Tone',
      email_integration: 'Email/Calendar Integration',
      widget_config: 'Chat Widget',
      invoice_settings: 'Invoice Settings',
      team_members: 'Team Members',
      knowledge_base: 'Knowledge Base'
    };
    
    return steps.map(s => stepNames[s] || s).join(', ');
  }

  /**
   * Get the appropriate next question for a given step
   */
  private getNextQuestionForStep(step: string): string {
    const questions: Record<string, string> = {
      business_info: "What's your business name?",
      branding: "Do you have a logo URL and brand colors you'd like to use?",
      contact_details: "What's your main business contact information - phone, address, and website?",
      services: "Tell me about the services you offer. What do you provide to your clients?",
      availability: "When are you typically available for bookings? What are your working hours?",
      email_tone: "To help the AI write emails in your voice, you can paste 2-3 sample emails you've written before. Would you like to do this?",
      email_integration: "Would you like to connect your email account (Gmail or Outlook) for email management and calendar sync?",
      widget_config: "What welcome message would you like visitors to see on your chat widget?",
      invoice_settings: "What tax rate and payment terms do you typically use for invoices?",
      team_members: "Would you like to add any team members to your CRM now?",
      knowledge_base: "Would you like to add any FAQs or business information for the AI to reference?",
      complete: "You're all set! Let's finalize your setup."
    };
    
    return questions[step] || "Let's continue setting up your CRM.";
  }
}

// Export singleton instance
export const aiOnboardingWizard = new AIOnboardingWizard();
