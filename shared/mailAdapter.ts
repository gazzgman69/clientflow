// Provider-agnostic mail adapter interface for all email providers

export interface TenantContext {
  tenantId: string;
  userId: string;
}

export interface AuthConfig {
  // OAuth providers
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  
  // App password providers (IMAP/SMTP)
  username?: string;
  password?: string;
  
  // API key providers
  apiKey?: string;
  domain?: string; // For providers like Mailgun that need domain
  
  // Server configuration for IMAP/SMTP
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  
  // Email identity
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
}

export interface SendEmailRequest {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
  cid?: string; // For inline attachments
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  providerId: string;
  error?: string;
  details?: any; // Provider-specific response details
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  date: Date;
  isRead: boolean;
  isDraft?: boolean;
  hasAttachments?: boolean;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  snippet?: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  messageCount: number;
  lastMessageDate: Date;
  isRead: boolean;
  snippet?: string;
}

export interface FetchMessagesOptions {
  limit?: number;
  since?: Date;
  folder?: string; // 'inbox', 'sent', 'drafts', etc.
  includeBody?: boolean;
  includeAttachments?: boolean;
}

export interface FetchThreadsOptions {
  limit?: number;
  since?: Date;
  folder?: string;
}

export interface VerifyCredentialsResult {
  success: boolean;
  error?: string;
  details?: {
    username?: string;
    serverReachable?: boolean;
    authValid?: boolean;
    quotaInfo?: {
      used?: number;
      limit?: number;
      percentage?: number;
    };
  };
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  events?: string[]; // 'delivered', 'bounced', 'complained', etc.
}

export interface WebhookSetupResult {
  success: boolean;
  webhookId?: string;
  error?: string;
}

// Main adapter interface that all providers must implement
export interface MailAdapter {
  /**
   * Provider identifier
   */
  readonly providerId: string;

  /**
   * Connect and authenticate with the provider
   */
  connect(auth: AuthConfig, tenantContext: TenantContext): Promise<void>;

  /**
   * Send an email message
   */
  send(request: SendEmailRequest): Promise<SendEmailResponse>;

  /**
   * Fetch email messages (for receive-capable providers)
   */
  fetchMessages?(options?: FetchMessagesOptions): Promise<EmailMessage[]>;

  /**
   * Fetch email threads (for receive-capable providers)
   */
  fetchThreads?(options?: FetchThreadsOptions): Promise<EmailThread[]>;

  /**
   * Verify credentials and connection
   */
  verifyCredentials(): Promise<VerifyCredentialsResult>;

  /**
   * Setup webhooks for delivery tracking (optional, for supported providers)
   */
  webhookSetup?(config: WebhookConfig): Promise<WebhookSetupResult>;

  /**
   * Get provider-specific capabilities
   */
  getCapabilities(): {
    canSend: boolean;
    canReceive: boolean;
    supportsWebhooks: boolean;
    supportsAttachments: boolean;
    supportsHtml: boolean;
  };

  /**
   * Clean up resources and disconnect
   */
  disconnect?(): Promise<void>;
}

// Factory interface for creating adapters
export interface MailAdapterFactory {
  createAdapter(providerCode: string): MailAdapter | null;
  getSupportedProviders(): string[];
}

// Common error types for adapters
export class MailAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'MailAdapterError';
  }
}

export class AuthenticationError extends MailAdapterError {
  constructor(provider: string, details?: any) {
    super('Authentication failed', 'AUTH_FAILED', provider, false, details);
    this.name = 'AuthenticationError';
  }
}

export class QuotaExceededError extends MailAdapterError {
  constructor(provider: string, details?: any) {
    super('Quota exceeded', 'QUOTA_EXCEEDED', provider, true, details);
    this.name = 'QuotaExceededError';
  }
}

export class RateLimitError extends MailAdapterError {
  constructor(provider: string, retryAfter?: number, details?: any) {
    super('Rate limit exceeded', 'RATE_LIMITED', provider, true, { retryAfter, ...details });
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends MailAdapterError {
  constructor(provider: string, details?: any) {
    super('Network error', 'NETWORK_ERROR', provider, true, details);
    this.name = 'NetworkError';
  }
}

// Helper types for configuration validation
export interface ProviderConfigRequirements {
  requiredFields: string[];
  optionalFields: string[];
  validateConfig: (config: AuthConfig) => { valid: boolean; errors: string[] };
}

// Configuration validation helpers
export function validateOAuthConfig(config: AuthConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.accessToken) {
    errors.push('Access token is required');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateAppPasswordConfig(config: AuthConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.username) {
    errors.push('Username is required');
  }
  
  if (!config.password) {
    errors.push('Password is required');
  }
  
  if (!config.imapHost) {
    errors.push('IMAP host is required');
  }
  
  if (!config.smtpHost) {
    errors.push('SMTP host is required');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateApiKeyConfig(config: AuthConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.apiKey) {
    errors.push('API key is required');
  }
  
  return { valid: errors.length === 0, errors };
}