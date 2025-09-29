// Provider catalog for email providers with capabilities and auth modes
export type EmailProviderCode =
  | 'gmail'
  | 'microsoft'
  | 'icloud'
  | 'yahoo'
  | 'aol'
  | 'fastmail'
  | 'proton'
  | 'zoho'
  | 'custom'
  | 'sendgrid'
  | 'mailgun'
  | 'postmark';

export type AuthMode = 'oauth' | 'appPassword' | 'apiKey';

export interface ProviderCapabilities {
  send: boolean;
  receive: boolean;
}

export interface ProviderDefaults {
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

export interface EmailProvider {
  code: EmailProviderCode;
  displayName: string;
  authModes: AuthMode[];
  capabilities: ProviderCapabilities;
  defaults?: ProviderDefaults;
  helpKey: string;
}

// Central provider catalog
export const EMAIL_PROVIDER_CATALOG: EmailProvider[] = [
  {
    code: 'gmail',
    displayName: 'Gmail / Google Workspace',
    authModes: ['oauth'],
    capabilities: { send: true, receive: true },
    helpKey: 'gmail'
  },
  {
    code: 'microsoft',
    displayName: 'Microsoft 365 / Outlook.com',
    authModes: ['oauth'],
    capabilities: { send: true, receive: true },
    helpKey: 'microsoft'
  },
  {
    code: 'icloud',
    displayName: 'iCloud Mail',
    authModes: ['appPassword'],
    capabilities: { send: true, receive: true },
    defaults: {
      imapHost: 'imap.mail.me.com',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'smtp.mail.me.com',
      smtpPort: 587,
      smtpSecure: false
    },
    helpKey: 'icloud'
  },
  {
    code: 'yahoo',
    displayName: 'Yahoo Mail',
    authModes: ['appPassword'],
    capabilities: { send: true, receive: true },
    defaults: {
      imapHost: 'imap.mail.yahoo.com',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'smtp.mail.yahoo.com',
      smtpPort: 465,
      smtpSecure: true
    },
    helpKey: 'yahoo'
  },
  {
    code: 'aol',
    displayName: 'AOL Mail',
    authModes: ['appPassword'],
    capabilities: { send: true, receive: true },
    defaults: {
      imapHost: 'imap.aol.com',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'smtp.aol.com',
      smtpPort: 465,
      smtpSecure: true
    },
    helpKey: 'aol'
  },
  {
    code: 'fastmail',
    displayName: 'Fastmail',
    authModes: ['appPassword'],
    capabilities: { send: true, receive: true },
    defaults: {
      imapHost: 'imap.fastmail.com',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'smtp.fastmail.com',
      smtpPort: 465,
      smtpSecure: true
    },
    helpKey: 'fastmail'
  },
  {
    code: 'proton',
    displayName: 'ProtonMail',
    authModes: ['appPassword'],
    capabilities: { send: true, receive: true },
    defaults: {
      imapHost: '127.0.0.1',
      imapPort: 1143,
      imapSecure: false,
      smtpHost: '127.0.0.1',
      smtpPort: 1025,
      smtpSecure: false
    },
    helpKey: 'proton'
  },
  {
    code: 'zoho',
    displayName: 'Zoho Mail',
    authModes: ['appPassword'],
    capabilities: { send: true, receive: true },
    defaults: {
      imapHost: 'imap.zoho.com',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'smtp.zoho.com',
      smtpPort: 465,
      smtpSecure: true
    },
    helpKey: 'zoho'
  },
  {
    code: 'custom',
    displayName: 'Custom IMAP/SMTP Server',
    authModes: ['appPassword'],
    capabilities: { send: true, receive: true },
    helpKey: 'custom'
  },
  {
    code: 'sendgrid',
    displayName: 'SendGrid',
    authModes: ['apiKey'],
    capabilities: { send: true, receive: false },
    helpKey: 'sendgrid'
  },
  {
    code: 'mailgun',
    displayName: 'Mailgun',
    authModes: ['apiKey'],
    capabilities: { send: true, receive: false },
    helpKey: 'mailgun'
  },
  {
    code: 'postmark',
    displayName: 'Postmark',
    authModes: ['apiKey'],
    capabilities: { send: true, receive: false },
    helpKey: 'postmark'
  }
];

// Provider help content for UI
export const PROVIDER_HELP: Record<string, string> = {
  gmail: 'Needs gmail.readonly + gmail.send scopes. "Send as" alias required for non-account From; otherwise fallback to replyTo.',
  microsoft: 'Needs Mail.Read + Mail.Send scopes. Some tenants need admin consent.',
  icloud: 'Requires app-specific password from Apple ID; IMAP+SMTP enabled.',
  yahoo: 'Requires app password (legacy "less secure apps" deprecated).',
  aol: 'Requires app password (legacy "less secure apps" deprecated).',
  fastmail: 'Use app password; strong spam filters—keep tests minimal.',
  proton: 'Use Proton Bridge or IMAP credentials for paid plans; sending via SMTP with app creds; may need custom ports.',
  zoho: 'App password recommended; OAuth may be tenant-restricted.',
  custom: 'Use your server settings; From must match authenticated account unless server allows arbitrary From; replyTo fallback is safer.',
  sendgrid: 'Outbound only; add SPF/DKIM later for deliverability.',
  mailgun: 'Outbound only; add SPF/DKIM later for deliverability.',
  postmark: 'Outbound only; add SPF/DKIM later for deliverability.'
};

// Helper functions
export function getProviderByCode(code: EmailProviderCode): EmailProvider | undefined {
  return EMAIL_PROVIDER_CATALOG.find(provider => provider.code === code);
}

export function getOAuthProviders(): EmailProvider[] {
  return EMAIL_PROVIDER_CATALOG.filter(provider => provider.authModes.includes('oauth'));
}

export function getAppPasswordProviders(): EmailProvider[] {
  return EMAIL_PROVIDER_CATALOG.filter(provider => provider.authModes.includes('appPassword'));
}

export function getApiKeyProviders(): EmailProvider[] {
  return EMAIL_PROVIDER_CATALOG.filter(provider => provider.authModes.includes('apiKey'));
}

export function getReceiveCapableProviders(): EmailProvider[] {
  return EMAIL_PROVIDER_CATALOG.filter(provider => provider.capabilities.receive);
}

export function getSendOnlyProviders(): EmailProvider[] {
  return EMAIL_PROVIDER_CATALOG.filter(provider => provider.capabilities.send && !provider.capabilities.receive);
}

export function getProviderHelp(code: EmailProviderCode): string {
  return PROVIDER_HELP[code] || '';
}

// Validation helpers
export function validateProviderAuth(provider: EmailProvider, authMode: AuthMode): boolean {
  return provider.authModes.includes(authMode);
}

export function isOutboundOnlyProvider(code: EmailProviderCode): boolean {
  const provider = getProviderByCode(code);
  return provider ? provider.capabilities.send && !provider.capabilities.receive : false;
}

// Backward compatibility exports for existing code
export type EmailProvider_Legacy = EmailProviderCode;
export type ProviderType = 'oauth' | 'imap_smtp' | 'api';

export interface ProviderPreset {
  id: EmailProviderCode;
  label: string;
  type: ProviderType;
  notes?: string;
  imap?: { host?: string; port?: number; secure?: boolean; };
  smtp?: { host?: string; port?: number; secure?: boolean; };
  requiresAppPassword?: boolean;
  supportsOAuthRead?: boolean;
  supportsOAuthSend?: boolean;
}

// Legacy compatibility mapping
export const EMAIL_PROVIDERS: ProviderPreset[] = EMAIL_PROVIDER_CATALOG.map(provider => ({
  id: provider.code,
  label: provider.displayName,
  type: provider.authModes.includes('oauth') ? 'oauth' : 
        provider.authModes.includes('apiKey') ? 'api' : 'imap_smtp',
  notes: getProviderHelp(provider.code),
  imap: provider.defaults?.imapHost ? {
    host: provider.defaults.imapHost,
    port: provider.defaults.imapPort,
    secure: provider.defaults.imapSecure
  } : undefined,
  smtp: provider.defaults?.smtpHost ? {
    host: provider.defaults.smtpHost,
    port: provider.defaults.smtpPort,
    secure: provider.defaults.smtpSecure
  } : undefined,
  requiresAppPassword: provider.authModes.includes('appPassword'),
  supportsOAuthRead: provider.authModes.includes('oauth') && provider.capabilities.receive,
  supportsOAuthSend: provider.authModes.includes('oauth') && provider.capabilities.send
}));

// Legacy helper functions for backward compatibility
export function getProviderById(id: EmailProviderCode): ProviderPreset | undefined {
  return EMAIL_PROVIDERS.find(provider => provider.id === id);
}

export function getIMAPSMTPProviders(): ProviderPreset[] {
  return EMAIL_PROVIDERS.filter(provider => provider.type === 'imap_smtp');
}