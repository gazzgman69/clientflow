import OpenAI from "openai";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { emails, users, userStyleSamples } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

// Initialize database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

/*
Using Replit AI Integrations:
- Provides OpenAI-compatible API access without requiring your own OpenAI API key
- Charges are billed to Replit credits
- Note: the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
*/

// Initialize OpenAI client with Replit AI Integrations
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Default model to use for AI operations
const DEFAULT_MODEL = "gpt-5"; // Latest model with enhanced capabilities

export interface EmailForSummary {
  id: string;
  fromEmail: string;
  subject: string;
  bodyText: string;
  sentAt: Date;
}

export interface ActionItem {
  actionText: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Generate an AI summary of an email thread
 * MULTI-TENANT SAFE: Only processes emails that belong to the tenant
 */
export async function summarizeEmailThread(
  emails: EmailForSummary[],
  tenantId: string
): Promise<{ summary: string; tokensUsed: number }> {
  if (!emails || emails.length === 0) {
    throw new Error('No emails provided for summarization');
  }

  // Build context from emails
  const emailContext = emails
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
    .map((email, idx) => {
      return `Email ${idx + 1} (${new Date(email.sentAt).toLocaleDateString()}):
From: ${email.fromEmail}
Subject: ${email.subject}
${email.bodyText?.substring(0, 1000) || '(No content)'}`;
    })
    .join('\n\n---\n\n');

  const prompt = `You are an AI assistant helping summarize email conversations for a CRM system.

Summarize the following email thread concisely. Focus on:
- Main topics discussed
- Key decisions or agreements
- Action items or next steps
- Important dates or deadlines

Keep the summary to 2-4 sentences.

Email Thread:
${emailContext}

Provide your summary:`;

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes email threads for business CRM systems. Be concise and focus on actionable information.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 300,
      temperature: 0.7
    });

    const summary = response.choices[0]?.message?.content?.trim() || 'Unable to generate summary';
    const tokensUsed = response.usage?.total_tokens || 0;

    return { summary, tokensUsed };
  } catch (error) {
    console.error('Error generating email summary:', error);
    throw new Error('Failed to generate email summary');
  }
}

/**
 * Generate an AI draft reply to an email
 * MULTI-TENANT SAFE: Only processes emails that belong to the tenant
 */
// Helper function to get tone-specific instructions
function getToneInstructions(tone: string): string {
  const toneMap: { [key: string]: string } = {
    professional: '- Use formal, business-appropriate language\n- Be precise and to-the-point\n- Maintain professional distance',
    friendly: '- Use warm, conversational language\n- Be approachable and personable\n- Include friendly expressions',
    casual: '- Use relaxed, informal language\n- Be conversational and laid-back\n- Keep it brief and easy-going',
    concise: '- Be brief and direct\n- Get straight to the point\n- Avoid unnecessary details',
    enthusiastic: '- Show excitement and energy\n- Use positive, upbeat language\n- Express genuine interest'
  };
  
  return toneMap[tone] || '';
}

export async function generateEmailReply(
  originalEmail: EmailForSummary,
  threadContext: EmailForSummary[],
  tenantId: string,
  tone?: string
): Promise<{ draft: string; tokensUsed: number }> {
  if (!originalEmail) {
    throw new Error('Original email required for reply generation');
  }

  // Build thread context (last 3 emails for context)
  const recentEmails = threadContext.slice(-3);
  const contextText = recentEmails
    .map((email, idx) => {
      return `Previous Email ${idx + 1}:
From: ${email.fromEmail}
Subject: ${email.subject}
${email.bodyText?.substring(0, 500) || '(No content)'}`;
    })
    .join('\n\n');

  // Tone-specific instructions
  const toneInstructions = tone ? `\nTone adjustment:\n${getToneInstructions(tone)}` : '';

  const prompt = `You are helping draft a professional email reply for a business CRM user.

Context from email thread:
${contextText}

Most recent email to reply to:
From: ${originalEmail.fromEmail}
Subject: ${originalEmail.subject}
${originalEmail.bodyText || '(No content)'}

Generate a professional, friendly reply that:
- Acknowledges their message
- Addresses their key points
- Is warm but businesslike
- IMPORTANT: Format with proper paragraphs separated by TWO newlines (\\n\\n)
- Each paragraph should be a distinct thought or topic
- DO NOT include a signature or sign-off - the user will add their own
- End with the main message content only${toneInstructions}

Draft reply (body text only, no subject, no signature):`;

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that drafts professional business email replies. Be warm, clear, and professional.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 500,
      temperature: 0.8
    });

    const draft = response.choices[0]?.message?.content?.trim() || 'Unable to generate draft';
    const tokensUsed = response.usage?.total_tokens || 0;

    return { draft, tokensUsed };
  } catch (error) {
    console.error('Error generating email draft:', error);
    throw new Error('Failed to generate email draft');
  }
}

/**
 * Extract action items from email content
 * MULTI-TENANT SAFE: Only processes emails that belong to the tenant
 */
export async function extractActionItems(
  email: EmailForSummary,
  tenantId: string
): Promise<{ actionItems: ActionItem[]; tokensUsed: number }> {
  if (!email) {
    throw new Error('Email required for action item extraction');
  }

  const prompt = `You are helping extract action items from business emails in a CRM system.

Analyze this email and extract all action items, tasks, or to-dos mentioned:

From: ${email.fromEmail}
Subject: ${email.subject}
Date: ${new Date(email.sentAt).toLocaleDateString()}

${email.bodyText || '(No content)'}

Extract action items in JSON format. For each action item, provide:
- actionText: The task or action to be done
- dueDate: ISO date string if a deadline is mentioned (null if not mentioned)
- priority: 'high', 'medium', or 'low' based on urgency cues in the email

Return ONLY a JSON object with this structure:
{
  "actionItems": [
    {
      "actionText": "string",
      "dueDate": "YYYY-MM-DD" or null,
      "priority": "high" | "medium" | "low"
    }
  ]
}

If no action items are found, return: {"actionItems": []}`;

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts action items from emails. Always return valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim() || '{"actionItems": []}';
    const tokensUsed = response.usage?.total_tokens || 0;

    try {
      const parsed = JSON.parse(content);
      const actionItems = parsed.actionItems || [];
      return { actionItems, tokensUsed };
    } catch (parseError) {
      console.error('Error parsing action items JSON:', parseError);
      return { actionItems: [], tokensUsed };
    }
  } catch (error) {
    console.error('Error extracting action items:', error);
    throw new Error('Failed to extract action items');
  }
}

/**
 * Generate a new email draft from user instructions
 * MULTI-TENANT SAFE: Only uses tenant-specific context and user's own emails for style learning
 */
export async function composeEmail(
  instructions: string,
  tenantId: string,
  userId: string,
  projectContext?: string,
  contactName?: string
): Promise<{ draft: string; subject?: string; tokensUsed: number; stylePersonalized: boolean }> {
  if (!instructions || !instructions.trim()) {
    throw new Error('Instructions required for email composition');
  }

  // Get user information for personalization
  const userData = await db
    .select({ 
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);
  
  const userInfo = userData[0];
  if (!userInfo) {
    throw new Error('User not found');
  }
  
  // Build full name
  const fullName = [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || 'Gareth Gwyn';

  // First, check for user's style samples (onboarding samples)
  // MULTI-TENANT SAFE: Only gets samples from this specific user in this tenant
  const styleSamples = await db
    .select({
      sampleText: userStyleSamples.sampleText
    })
    .from(userStyleSamples)
    .where(
      and(
        eq(userStyleSamples.userId, userId),
        eq(userStyleSamples.tenantId, tenantId)
      )
    )
    .orderBy(desc(userStyleSamples.createdAt))
    .limit(5);

  let styleExamples: { bodyText: string | null; subject: string | null }[] = [];
  let styleSource = 'none';

  if (styleSamples.length > 0) {
    // Use onboarding samples if available
    styleExamples = styleSamples.map(s => ({ bodyText: s.sampleText, subject: null }));
    styleSource = 'samples';
  } else {
    // Fall back to sent emails for style learning
    const recentSentEmails = await db
      .select({
        bodyText: emails.bodyText,
        subject: emails.subject
      })
      .from(emails)
      .where(
        and(
          eq(emails.tenantId, tenantId),
          eq(emails.direction, 'outbound'),
          eq(emails.fromEmail, userInfo.email)
        )
      )
      .orderBy(desc(emails.sentAt))
      .limit(5);

    if (recentSentEmails.length > 0) {
      styleExamples = recentSentEmails;
      styleSource = 'emails';
    }
  }

  // Build context information
  let contextInfo = '';
  if (projectContext) {
    contextInfo += `Project context: ${projectContext}\n`;
  }
  if (contactName) {
    contextInfo += `Recipient: ${contactName}\n`;
  }

  // Build style examples from samples or sent emails
  let styleGuidance = '';
  const stylePersonalized = styleExamples.length >= 3;
  
  if (stylePersonalized) {
    const emailExamples = styleExamples
      .slice(0, 3)
      .map((example, idx) => {
        const text = example.bodyText?.substring(0, 300) || '';
        const subject = example.subject ? `Subject: ${example.subject}\n` : '';
        return `Example ${idx + 1}:\n${subject}${text}${text.length >= 300 ? '...' : ''}`;
      })
      .join('\n\n');
    
    styleGuidance = `\nWriting Style Reference (${styleSource === 'samples' ? 'from your saved writing samples' : 'from your recent emails'}):
${emailExamples}

Match the user's writing style from these examples:
- Mirror their tone (formal/casual/friendly)
- Match their greeting and sign-off style
- Use similar sentence structure and length
- Reflect their level of detail`;
  } else {
    styleGuidance = `\nWriting Style: Use standard professional business email style.`;
  }

  const prompt = `You are helping compose a professional business email for a CRM user.

${contextInfo ? `Context:\n${contextInfo}\n` : ''}${styleGuidance}

User instructions:
${instructions}

Generate a naturally flowing business email that:
- Follows the user's instructions precisely
${stylePersonalized ? '- Matches the writing style from the examples above' : '- Uses professional, warm business tone'}
- Has clear paragraph structure with double line breaks (\\n\\n) between paragraphs
- Be specific and actionable - no vague [DETAILS] or [INFORMATION] placeholders
- NEVER include placeholder text in brackets like [NAME] or [COMPANY]
- DO NOT include a signature or sign-off - the user will add their own

Formatting requirements:
- Use \\n\\n (double newline) between paragraphs
- End with the main message content - NO signature, NO name, NO closing

Respond with a JSON object containing:
{
  "subject": "suggested subject line",
  "draft": "complete email body with greeting and paragraphs separated by \\n\\n (NO signature)"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that writes professional business emails. Always return valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 600,
      temperature: 0.8,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim() || '{"draft": "", "subject": ""}';
    const tokensUsed = response.usage?.total_tokens || 0;

    try {
      const parsed = JSON.parse(content);
      return { 
        draft: parsed.draft || 'Unable to generate draft', 
        subject: parsed.subject,
        tokensUsed,
        stylePersonalized
      };
    } catch (parseError) {
      console.error('Error parsing compose response JSON:', parseError);
      return { draft: 'Unable to generate draft', tokensUsed, stylePersonalized };
    }
  } catch (error) {
    console.error('Error composing email:', error);
    throw new Error('Failed to compose email');
  }
}
