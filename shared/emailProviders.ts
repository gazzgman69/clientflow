export type EmailProvider =
  | 'gmail'
  | 'microsoft'
  | 'icloud'
  | 'yahoo'
  | 'godaddy_o365'
  | 'godaddy_workspace'
  | 'bluehost'
  | 'siteground'
  | 'ionos'
  | 'aol'
  | 'att'
  | 'bellsouth'
  | 'cox'
  | 'sbcglobal'
  | 'sky'
  | 'other';

export type ProviderType = 'oauth' | 'imap_smtp';

export interface ProviderPreset {
  id: EmailProvider;
  label: string;
  type: ProviderType;
  notes?: string;                // help text shown in UI
  imap?: { host?: string; port?: number; secure?: boolean; };
  smtp?: { host?: string; port?: number; secure?: boolean; };
  requiresAppPassword?: boolean; // e.g., iCloud
  supportsOAuthRead?: boolean;
  supportsOAuthSend?: boolean;
}

export const EMAIL_PROVIDERS: ProviderPreset[] = [
  { 
    id: 'gmail', 
    label: 'Google (Gmail / Workspace)', 
    type: 'oauth',
    supportsOAuthRead: true, 
    supportsOAuthSend: true,
    notes: 'Use Google OAuth. No app password needed.'
  },
  { 
    id: 'microsoft', 
    label: 'Microsoft (Office 365 / Outlook / Hotmail / Live / MSN)', 
    type: 'oauth',
    supportsOAuthRead: true, 
    supportsOAuthSend: true,
    notes: 'Use Microsoft OAuth (Graph).'
  },
  { 
    id: 'icloud', 
    label: 'iCloud (mac.com / me.com)', 
    type: 'imap_smtp',
    requiresAppPassword: true,
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    notes: 'Requires an app-specific password. SMTP uses STARTTLS on 587.'
  },
  { 
    id: 'yahoo', 
    label: 'Yahoo', 
    type: 'imap_smtp',
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true }
  },
  { 
    id: 'godaddy_o365', 
    label: 'GoDaddy: Office 365', 
    type: 'imap_smtp',
    notes: 'Some GoDaddy O365 tenants use Microsoft OAuth; otherwise IMAP/SMTP here.'
  },
  { 
    id: 'godaddy_workspace', 
    label: 'GoDaddy: Workspace', 
    type: 'imap_smtp',
    notes: 'Legacy GoDaddy Workspace email.'
  },
  { 
    id: 'bluehost', 
    label: 'Bluehost', 
    type: 'imap_smtp' 
  },
  { 
    id: 'siteground', 
    label: 'SiteGround', 
    type: 'imap_smtp' 
  },
  { 
    id: 'ionos', 
    label: '1&1 (IONOS)', 
    type: 'imap_smtp',
    imap: { host: 'imap.ionos.com', port: 993, secure: true },
    smtp: { host: 'smtp.ionos.com', port: 465, secure: true }
  },
  { 
    id: 'aol', 
    label: 'AOL', 
    type: 'imap_smtp',
    imap: { host: 'imap.aol.com', port: 993, secure: true },
    smtp: { host: 'smtp.aol.com', port: 465, secure: true }
  },
  { 
    id: 'att', 
    label: 'AT&T', 
    type: 'imap_smtp' 
  },
  { 
    id: 'bellsouth', 
    label: 'BellSouth', 
    type: 'imap_smtp' 
  },
  { 
    id: 'cox', 
    label: 'Cox Business', 
    type: 'imap_smtp' 
  },
  { 
    id: 'sbcglobal', 
    label: 'SBC Global', 
    type: 'imap_smtp' 
  },
  { 
    id: 'sky', 
    label: 'Sky', 
    type: 'imap_smtp' 
  },
  { 
    id: 'other', 
    label: 'Other (IMAP/SMTP)', 
    type: 'imap_smtp',
    notes: 'Enter your own IMAP/SMTP server details.'
  }
];

// Helper functions
export function getProviderById(id: EmailProvider): ProviderPreset | undefined {
  return EMAIL_PROVIDERS.find(provider => provider.id === id);
}

export function getOAuthProviders(): ProviderPreset[] {
  return EMAIL_PROVIDERS.filter(provider => provider.type === 'oauth');
}

export function getIMAPSMTPProviders(): ProviderPreset[] {
  return EMAIL_PROVIDERS.filter(provider => provider.type === 'imap_smtp');
}