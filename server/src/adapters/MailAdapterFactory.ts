import type {
  MailAdapter,
  MailAdapterFactory,
  AuthConfig,
  ProviderConfigRequirements
} from '@shared/mailAdapter';
import {
  validateOAuthConfig,
  validateAppPasswordConfig,
  validateApiKeyConfig,
  MailAdapterError
} from '@shared/mailAdapter';
import type { EmailProviderCode } from '@shared/emailProviders';
import { getProviderByCode } from '@shared/emailProviders';

// Import all adapter implementations
import { GmailAdapter } from './GmailAdapter';
import { MicrosoftAdapter } from './MicrosoftAdapter';
import { ImapSmtpAdapter } from './ImapSmtpAdapter';
import { SendGridAdapter } from './SendGridAdapter';
import { MailgunAdapter } from './MailgunAdapter';
import { PostmarkAdapter } from './PostmarkAdapter';

export class MailAdapterFactoryImpl implements MailAdapterFactory {
  private static instance: MailAdapterFactoryImpl;
  
  // Mapping of provider codes to adapter classes
  private readonly adapterMap: Map<EmailProviderCode, new () => MailAdapter> = new Map([
    ['gmail', GmailAdapter],
    ['microsoft', MicrosoftAdapter],
    ['icloud', ImapSmtpAdapter],
    ['yahoo', ImapSmtpAdapter],
    ['aol', ImapSmtpAdapter],
    ['fastmail', ImapSmtpAdapter],
    ['proton', ImapSmtpAdapter],
    ['zoho', ImapSmtpAdapter],
    ['custom', ImapSmtpAdapter],
    ['sendgrid', SendGridAdapter],
    ['mailgun', MailgunAdapter],
    ['postmark', PostmarkAdapter]
  ]);

  private constructor() {}

  static getInstance(): MailAdapterFactoryImpl {
    if (!MailAdapterFactoryImpl.instance) {
      MailAdapterFactoryImpl.instance = new MailAdapterFactoryImpl();
    }
    return MailAdapterFactoryImpl.instance;
  }

  createAdapter(providerCode: string): MailAdapter | null {
    const AdapterClass = this.adapterMap.get(providerCode as EmailProviderCode);
    
    if (!AdapterClass) {
      return null;
    }

    try {
      return new AdapterClass();
    } catch (error) {
      console.error(`Failed to create adapter for provider ${providerCode}:`, error);
      return null;
    }
  }

  getSupportedProviders(): string[] {
    return Array.from(this.adapterMap.keys());
  }

  isProviderSupported(providerCode: string): boolean {
    return this.adapterMap.has(providerCode as EmailProviderCode);
  }

  getProviderRequirements(providerCode: string): ProviderConfigRequirements | null {
    const provider = getProviderByCode(providerCode as EmailProviderCode);
    
    if (!provider) {
      return null;
    }

    // Define requirements based on auth modes
    if (provider.authModes.includes('oauth')) {
      return {
        requiredFields: ['accessToken'],
        optionalFields: ['refreshToken', 'expiresAt', 'fromEmail', 'fromName', 'replyToEmail'],
        validateConfig: validateOAuthConfig
      };
    } else if (provider.authModes.includes('appPassword')) {
      const isCustomImap = providerCode === 'custom';
      
      return {
        requiredFields: isCustomImap 
          ? ['username', 'password', 'imapHost', 'smtpHost']
          : ['username', 'password'],
        optionalFields: isCustomImap
          ? ['imapPort', 'imapSecure', 'smtpPort', 'smtpSecure', 'fromEmail', 'fromName', 'replyToEmail']
          : ['fromEmail', 'fromName', 'replyToEmail'],
        validateConfig: validateAppPasswordConfig
      };
    } else if (provider.authModes.includes('apiKey')) {
      const isMailgun = providerCode === 'mailgun';
      
      return {
        requiredFields: isMailgun 
          ? ['apiKey', 'domain']
          : ['apiKey'],
        optionalFields: ['fromEmail', 'fromName', 'replyToEmail'],
        validateConfig: validateApiKeyConfig
      };
    }

    return null;
  }

  validateConfig(providerCode: string, config: AuthConfig): { valid: boolean; errors: string[] } {
    const requirements = this.getProviderRequirements(providerCode);
    
    if (!requirements) {
      return {
        valid: false,
        errors: [`Unsupported provider: ${providerCode}`]
      };
    }

    // Check required fields
    const errors: string[] = [];
    
    for (const field of requirements.requiredFields) {
      if (!config[field as keyof AuthConfig]) {
        errors.push(`${field} is required`);
      }
    }

    // Use provider-specific validation if no field-level errors
    if (errors.length === 0) {
      const validationResult = requirements.validateConfig(config);
      errors.push(...validationResult.errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create and connect an adapter for a provider
   */
  async createConnectedAdapter(
    providerCode: string, 
    authConfig: AuthConfig, 
    tenantContext: { tenantId: string; userId: string }
  ): Promise<MailAdapter> {
    // Validate configuration
    const validation = this.validateConfig(providerCode, authConfig);
    if (!validation.valid) {
      throw new MailAdapterError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        'INVALID_CONFIG',
        providerCode
      );
    }

    // Create adapter
    const adapter = this.createAdapter(providerCode);
    if (!adapter) {
      throw new MailAdapterError(
        `Unsupported provider: ${providerCode}`,
        'UNSUPPORTED_PROVIDER',
        providerCode
      );
    }

    // Apply provider defaults for IMAP/SMTP providers
    const provider = getProviderByCode(providerCode as EmailProviderCode);
    if (provider?.defaults && !authConfig.imapHost) {
      Object.assign(authConfig, provider.defaults);
    }

    // Connect adapter
    await adapter.connect(authConfig, tenantContext);
    
    return adapter;
  }

  /**
   * Get adapter capabilities for a provider
   */
  getProviderCapabilities(providerCode: string) {
    const adapter = this.createAdapter(providerCode);
    if (!adapter) {
      return null;
    }

    return adapter.getCapabilities();
  }

  /**
   * Get all providers with their capabilities
   */
  getAllProvidersWithCapabilities() {
    return this.getSupportedProviders().map(providerCode => ({
      providerCode,
      capabilities: this.getProviderCapabilities(providerCode),
      requirements: this.getProviderRequirements(providerCode)
    })).filter(item => item.capabilities !== null);
  }
}

// Export singleton instance and factory interface
export const mailAdapterFactory = MailAdapterFactoryImpl.getInstance();

// Helper functions for common operations
export async function createMailAdapter(
  providerCode: string,
  authConfig: AuthConfig,
  tenantContext: { tenantId: string; userId: string }
): Promise<MailAdapter> {
  return await mailAdapterFactory.createConnectedAdapter(providerCode, authConfig, tenantContext);
}

export function validateProviderConfig(providerCode: string, config: AuthConfig) {
  return mailAdapterFactory.validateConfig(providerCode, config);
}

export function getSupportedProviders() {
  return mailAdapterFactory.getSupportedProviders();
}

export function getProviderCapabilities(providerCode: string) {
  return mailAdapterFactory.getProviderCapabilities(providerCode);
}