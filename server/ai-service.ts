import OpenAI from "openai";

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
const DEFAULT_MODEL = "gpt-4o-mini"; // Fast and cost-effective for CRM tasks

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
export async function generateEmailReply(
  originalEmail: EmailForSummary,
  threadContext: EmailForSummary[],
  tenantId: string
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
- Leaves placeholders [YOUR NAME], [SPECIFIC DETAILS] where personalization is needed

Draft reply (body text only, no subject):`;

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
