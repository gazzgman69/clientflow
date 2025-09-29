import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ExternalLink, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  Key, 
  Shield,
  Globe,
  Mail,
  Settings,
  HelpCircle
} from 'lucide-react';

interface EmailProviderHelpProps {
  providerCode: string;
}

const providerHelpData = {
  gmail: {
    name: 'Gmail',
    icon: Mail,
    description: 'Google Gmail with OAuth authentication',
    setupSteps: [
      'Click the "Authorize Gmail" button below',
      'Sign in with your Google account',
      'Grant permission to access your Gmail',
      'You\'ll be redirected back to complete setup'
    ],
    requirements: [
      'Valid Google account with Gmail enabled',
      'Two-factor authentication recommended for security'
    ],
    helpLinks: [
      { 
        title: 'Gmail API Documentation', 
        url: 'https://developers.google.com/gmail/api',
        description: 'Official Gmail API documentation from Google'
      },
      { 
        title: 'OAuth 2.0 for Gmail', 
        url: 'https://developers.google.com/gmail/api/auth/about-auth',
        description: 'Understanding Gmail OAuth authentication'
      }
    ],
    commonIssues: [
      {
        issue: 'OAuth permission denied',
        solution: 'Ensure you grant all requested permissions during OAuth flow'
      },
      {
        issue: 'Emails not syncing',
        solution: 'Check that Gmail API is enabled and has proper scope permissions'
      }
    ],
    notes: [
      'OAuth is the secure, recommended way to connect Gmail',
      'No need to generate app passwords with OAuth',
      'Permissions can be revoked anytime from your Google Account settings'
    ]
  },

  microsoft: {
    name: 'Microsoft 365',
    icon: Mail,
    description: 'Microsoft 365 / Outlook with OAuth authentication',
    setupSteps: [
      'Click the "Authorize Microsoft 365" button below',
      'Sign in with your Microsoft account',
      'Grant permission to access your mailbox',
      'You\'ll be redirected back to complete setup'
    ],
    requirements: [
      'Valid Microsoft 365 or Outlook.com account',
      'Administrative permissions may be required for organization accounts'
    ],
    helpLinks: [
      { 
        title: 'Microsoft Graph Mail API', 
        url: 'https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview',
        description: 'Official Microsoft Graph API documentation'
      },
      { 
        title: 'OAuth 2.0 with Microsoft', 
        url: 'https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow',
        description: 'Microsoft OAuth 2.0 authentication flow'
      }
    ],
    commonIssues: [
      {
        issue: 'Organization admin consent required',
        solution: 'Contact your IT administrator to grant consent for the application'
      },
      {
        issue: 'Conditional access blocking',
        solution: 'Check with your IT team about conditional access policies'
      }
    ],
    notes: [
      'Works with both personal and business Microsoft accounts',
      'Organization accounts may require admin approval',
      'Supports modern authentication protocols'
    ]
  },

  icloud: {
    name: 'iCloud Mail',
    icon: Shield,
    description: 'Apple iCloud Mail with app-specific password',
    setupSteps: [
      'Go to appleid.apple.com and sign in',
      'Navigate to "Sign-In and Security" → "App-Specific Passwords"',
      'Generate a new password for "Mail"',
      'Use this password (not your Apple ID password) in the form below'
    ],
    requirements: [
      'Apple ID with iCloud Mail enabled',
      'Two-factor authentication must be enabled',
      'App-specific password generated'
    ],
    helpLinks: [
      { 
        title: 'Generate App-Specific Passwords', 
        url: 'https://support.apple.com/102654',
        description: 'Official Apple guide for creating app-specific passwords'
      },
      { 
        title: 'iCloud Mail Server Settings', 
        url: 'https://support.apple.com/102619',
        description: 'Server settings for iCloud Mail'
      }
    ],
    commonIssues: [
      {
        issue: 'Authentication failed',
        solution: 'Ensure you\'re using an app-specific password, not your Apple ID password'
      },
      {
        issue: 'Two-factor authentication error',
        solution: 'Enable 2FA on your Apple ID before generating app passwords'
      }
    ],
    notes: [
      'Regular Apple ID password will NOT work - must use app-specific password',
      'Two-factor authentication is required to generate app passwords',
      'Server settings are pre-configured for convenience'
    ]
  },

  yahoo: {
    name: 'Yahoo Mail',
    icon: Mail,
    description: 'Yahoo Mail with app-specific password',
    setupSteps: [
      'Go to Yahoo Account Security settings',
      'Enable two-step verification if not already enabled',
      'Navigate to "Generate app password"',
      'Select "Mail" as the app type',
      'Use the generated password in the form below'
    ],
    requirements: [
      'Yahoo Mail account',
      'Two-step verification enabled',
      'App-specific password generated'
    ],
    helpLinks: [
      { 
        title: 'Yahoo App Passwords', 
        url: 'https://help.yahoo.com/kb/generate-manage-third-party-passwords-sln15241.html',
        description: 'How to generate app passwords for Yahoo Mail'
      },
      { 
        title: 'Yahoo Mail Server Settings', 
        url: 'https://help.yahoo.com/kb/pop-imap-smtp-settings-yahoo-mail-sln4724.html',
        description: 'IMAP and SMTP settings for Yahoo Mail'
      }
    ],
    commonIssues: [
      {
        issue: 'Login failure',
        solution: 'Use app password instead of your regular Yahoo password'
      },
      {
        issue: 'Two-step verification required',
        solution: 'Enable two-step verification in Yahoo Account Security'
      }
    ],
    notes: [
      'App passwords are required for third-party email clients',
      'Two-step verification must be enabled first',
      'Server settings are pre-configured'
    ]
  },

  aol: {
    name: 'AOL Mail',
    icon: Mail,
    description: 'AOL Mail with app-specific password',
    setupSteps: [
      'Go to AOL Account Security settings',
      'Enable two-step verification',
      'Generate an app password for "Mail"',
      'Use this password in the configuration below'
    ],
    requirements: [
      'AOL Mail account',
      'Two-step verification enabled',
      'App password generated'
    ],
    helpLinks: [
      { 
        title: 'AOL App Passwords', 
        url: 'https://help.aol.com/articles/how-do-i-use-other-email-applications-to-send-and-receive-my-aol-mail',
        description: 'Setting up third-party email clients with AOL'
      }
    ],
    commonIssues: [
      {
        issue: 'Authentication error',
        solution: 'Make sure you\'re using the app password, not your regular AOL password'
      }
    ],
    notes: [
      'App passwords are mandatory for email client access',
      'Server settings are automatically configured'
    ]
  },

  fastmail: {
    name: 'Fastmail',
    icon: Settings,
    description: 'Fastmail with app-specific password',
    setupSteps: [
      'Log into your Fastmail web interface',
      'Go to Settings → Password & Security',
      'Create a new "App Password" for email client access',
      'Give it a name like "CRM Mail Access"',
      'Use the generated password below'
    ],
    requirements: [
      'Fastmail account (paid service)',
      'App password generated from web interface'
    ],
    helpLinks: [
      { 
        title: 'Fastmail App Passwords', 
        url: 'https://www.fastmail.help/hc/en-us/articles/360058752854-App-passwords',
        description: 'How to create app passwords in Fastmail'
      },
      { 
        title: 'Fastmail IMAP Settings', 
        url: 'https://www.fastmail.help/hc/en-us/articles/360058752834-IMAP-POP-and-SMTP-settings',
        description: 'Server settings for Fastmail'
      }
    ],
    commonIssues: [
      {
        issue: 'Connection refused',
        solution: 'Verify you have an active Fastmail subscription'
      },
      {
        issue: 'App password not working',
        solution: 'Regenerate the app password and ensure it has email access permissions'
      }
    ],
    notes: [
      'Fastmail is a premium email service with excellent IMAP support',
      'App passwords provide secure access without sharing your main password',
      'Server settings are optimized for performance'
    ]
  },

  proton: {
    name: 'ProtonMail',
    icon: Shield,
    description: 'ProtonMail Bridge with IMAP/SMTP',
    setupSteps: [
      'Download and install ProtonMail Bridge on your computer',
      'Log into Bridge with your ProtonMail credentials',
      'Start the Bridge service',
      'Use the Bridge-provided credentials in the form below',
      'Default ports: IMAP 1143, SMTP 1025'
    ],
    requirements: [
      'ProtonMail paid account (Bridge requires subscription)',
      'ProtonMail Bridge installed and running',
      'Bridge credentials (different from web login)'
    ],
    helpLinks: [
      { 
        title: 'ProtonMail Bridge Setup', 
        url: 'https://proton.me/support/protonmail-bridge-install',
        description: 'How to install and configure ProtonMail Bridge'
      },
      { 
        title: 'Bridge Troubleshooting', 
        url: 'https://proton.me/support/protonmail-bridge-manual-setup',
        description: 'Troubleshooting Bridge connection issues'
      }
    ],
    commonIssues: [
      {
        issue: 'Bridge not running',
        solution: 'Start the ProtonMail Bridge application and ensure it\'s logged in'
      },
      {
        issue: 'Connection timeout',
        solution: 'Verify Bridge is running on localhost and ports are not blocked'
      },
      {
        issue: 'Wrong credentials',
        solution: 'Use Bridge credentials from the Bridge app, not your ProtonMail web password'
      }
    ],
    notes: [
      'Bridge is required for IMAP/SMTP access to ProtonMail',
      'Bridge must be running on the same machine as your CRM',
      'Uses local ports for secure communication',
      'Requires a paid ProtonMail subscription'
    ]
  },

  zoho: {
    name: 'Zoho Mail',
    icon: Mail,
    description: 'Zoho Mail with app-specific password',
    setupSteps: [
      'Log into Zoho Mail web interface',
      'Go to Security → App Passwords',
      'Generate a new app password for "Email Client"',
      'Use your Zoho email and the generated password below'
    ],
    requirements: [
      'Zoho Mail account',
      'App password generated from security settings'
    ],
    helpLinks: [
      { 
        title: 'Zoho App Passwords', 
        url: 'https://help.zoho.com/portal/en/kb/mail/user-guide/security/articles/app-passwords',
        description: 'Creating app passwords for Zoho Mail'
      },
      { 
        title: 'Zoho IMAP Settings', 
        url: 'https://help.zoho.com/portal/en/kb/mail/user-guide/email-clients/articles/imap-configuration',
        description: 'IMAP configuration for Zoho Mail'
      }
    ],
    commonIssues: [
      {
        issue: 'Authentication failed',
        solution: 'Ensure you\'re using an app password instead of your regular Zoho password'
      }
    ],
    notes: [
      'App passwords provide secure access to Zoho Mail',
      'Server settings are pre-configured for optimal performance'
    ]
  },

  custom: {
    name: 'Custom IMAP/SMTP',
    icon: Settings,
    description: 'Custom IMAP/SMTP server configuration',
    setupSteps: [
      'Contact your email provider for IMAP/SMTP server settings',
      'Gather server hostnames, ports, and security settings',
      'Obtain your email credentials or app password',
      'Fill in the server configuration below',
      'Test the connection to verify settings'
    ],
    requirements: [
      'IMAP/SMTP server details from your email provider',
      'Valid email account credentials',
      'Network access to email servers'
    ],
    helpLinks: [
      { 
        title: 'Common Email Server Settings', 
        url: 'https://www.thunderbird.net/en-US/manual/account-setup/',
        description: 'Reference for common email provider settings'
      }
    ],
    commonIssues: [
      {
        issue: 'Connection timeout',
        solution: 'Check server hostnames, ports, and firewall settings'
      },
      {
        issue: 'SSL/TLS errors',
        solution: 'Verify security settings match your provider\'s requirements'
      },
      {
        issue: 'Authentication failed',
        solution: 'Confirm credentials are correct and app passwords if required'
      }
    ],
    notes: [
      'Server settings vary by provider - check your email provider\'s documentation',
      'Some providers require app passwords instead of regular passwords',
      'Ensure firewall allows connections to email server ports'
    ]
  },

  sendgrid: {
    name: 'SendGrid',
    icon: Globe,
    description: 'SendGrid API for sending emails only',
    setupSteps: [
      'Log into your SendGrid account',
      'Go to Settings → API Keys',
      'Create a new API key with "Mail Send" permissions',
      'Copy the generated API key',
      'Paste the API key in the form below'
    ],
    requirements: [
      'SendGrid account (free tier available)',
      'API key with mail send permissions',
      'Verified sender identity or domain'
    ],
    helpLinks: [
      { 
        title: 'SendGrid API Keys', 
        url: 'https://docs.sendgrid.com/ui/account-and-settings/api-keys',
        description: 'How to create and manage SendGrid API keys'
      },
      { 
        title: 'Sender Authentication', 
        url: 'https://docs.sendgrid.com/ui/sending-email/sender-verification',
        description: 'Setting up sender verification'
      }
    ],
    commonIssues: [
      {
        issue: 'Unauthorized error',
        solution: 'Verify API key has correct permissions and is not expired'
      },
      {
        issue: 'Sender not verified',
        solution: 'Complete sender verification process in SendGrid dashboard'
      }
    ],
    notes: [
      'SendGrid is send-only - cannot receive emails',
      'Excellent delivery rates and analytics',
      'Requires sender verification for production use'
    ]
  },

  mailgun: {
    name: 'Mailgun',
    icon: Globe,
    description: 'Mailgun API for sending emails only',
    setupSteps: [
      'Log into your Mailgun account',
      'Go to Settings → API Keys',
      'Copy your Private API key',
      'Note your domain name from the Domains section',
      'Enter both API key and domain below'
    ],
    requirements: [
      'Mailgun account',
      'Private API key',
      'Verified domain'
    ],
    helpLinks: [
      { 
        title: 'Mailgun API Keys', 
        url: 'https://documentation.mailgun.com/en/latest/api-intro.html#authentication',
        description: 'Mailgun API authentication guide'
      },
      { 
        title: 'Domain Verification', 
        url: 'https://documentation.mailgun.com/en/latest/user_manual.html#verifying-your-domain',
        description: 'How to verify domains in Mailgun'
      }
    ],
    commonIssues: [
      {
        issue: 'Domain not verified',
        solution: 'Complete domain verification process in Mailgun dashboard'
      },
      {
        issue: 'API key invalid',
        solution: 'Use the Private API key, not the Public key'
      }
    ],
    notes: [
      'Mailgun is send-only - cannot receive emails',
      'Requires domain verification for production sending',
      'Powerful email validation and analytics features'
    ]
  },

  postmark: {
    name: 'Postmark',
    icon: Globe,
    description: 'Postmark API for sending emails only',
    setupSteps: [
      'Log into your Postmark account',
      'Go to your Server → API Tokens',
      'Copy the Server API token',
      'Verify your sender signature or domain',
      'Enter the API token below'
    ],
    requirements: [
      'Postmark account',
      'Server API token',
      'Verified sender signature or domain'
    ],
    helpLinks: [
      { 
        title: 'Postmark API Tokens', 
        url: 'https://postmarkapp.com/developer/api/overview#authentication',
        description: 'Postmark API authentication guide'
      },
      { 
        title: 'Sender Signatures', 
        url: 'https://postmarkapp.com/support/article/1046-how-do-i-verify-a-sender-signature',
        description: 'How to verify sender signatures'
      }
    ],
    commonIssues: [
      {
        issue: 'Sender signature not verified',
        solution: 'Complete sender signature verification in Postmark dashboard'
      },
      {
        issue: 'API token invalid',
        solution: 'Use the Server API token, not Account API token'
      }
    ],
    notes: [
      'Postmark is send-only - cannot receive emails',
      'Excellent delivery rates and detailed analytics',
      'Requires verified sender before sending emails'
    ]
  }
};

export default function EmailProviderHelp({ providerCode }: EmailProviderHelpProps) {
  const helpData = providerHelpData[providerCode as keyof typeof providerHelpData];
  
  if (!helpData) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Help information not available for this provider.
        </AlertDescription>
      </Alert>
    );
  }

  const IconComponent = helpData.icon;

  return (
    <Card className="mb-6" data-testid="card-provider-help">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <IconComponent className="h-5 w-5" />
          <span>Setup Guide: {helpData.name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Description */}
        <div>
          <p className="text-gray-600 dark:text-gray-400">
            {helpData.description}
          </p>
        </div>

        {/* Setup Steps */}
        <div>
          <h4 className="text-md font-semibold mb-3 flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Setup Steps</span>
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            {helpData.setupSteps.map((step, index) => (
              <li key={index} className="text-gray-700 dark:text-gray-300">
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Requirements */}
        <div>
          <h4 className="text-md font-semibold mb-3 flex items-center space-x-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <span>Requirements</span>
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {helpData.requirements.map((requirement, index) => (
              <li key={index} className="text-gray-700 dark:text-gray-300">
                {requirement}
              </li>
            ))}
          </ul>
        </div>

        {/* Help Links */}
        {helpData.helpLinks.length > 0 && (
          <div>
            <h4 className="text-md font-semibold mb-3 flex items-center space-x-2">
              <ExternalLink className="h-4 w-4 text-purple-500" />
              <span>Documentation & Resources</span>
            </h4>
            <div className="space-y-3">
              {helpData.helpLinks.map((link, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">{link.title}</h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {link.description}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(link.url, '_blank')}
                      data-testid={`button-help-link-${index}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common Issues */}
        {helpData.commonIssues.length > 0 && (
          <div>
            <h4 className="text-md font-semibold mb-3 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>Common Issues & Solutions</span>
            </h4>
            <div className="space-y-3">
              {helpData.commonIssues.map((item, index) => (
                <Alert key={index}>
                  <HelpCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{item.issue}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Solution: {item.solution}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Important Notes */}
        {helpData.notes.length > 0 && (
          <div>
            <h4 className="text-md font-semibold mb-3 flex items-center space-x-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span>Important Notes</span>
            </h4>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <ul className="list-disc list-inside space-y-1 text-sm">
                {helpData.notes.map((note, index) => (
                  <li key={index} className="text-blue-800 dark:text-blue-200">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}