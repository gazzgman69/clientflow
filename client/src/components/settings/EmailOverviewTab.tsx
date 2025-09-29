import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  Download,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  HelpCircle,
  Settings,
  ChevronDown
} from 'lucide-react';

interface EmailProviderCatalog {
  id: string;
  code: string;
  displayName: string;
  authType: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  helpBlurb?: string;
  isActive: boolean;
}

export default function EmailOverviewTab() {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [showContactsOnly, setShowContactsOnly] = useState(true);
  const [bccMe, setBccMe] = useState(false);
  const [enableReadReceipts, setEnableReadReceipts] = useState(false);
  const [incomingPopoverOpen, setIncomingPopoverOpen] = useState(false);
  const [outgoingPopoverOpen, setOutgoingPopoverOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch provider catalog for help dropdown
  const { data: providersData } = useQuery({
    queryKey: ['/api/email/providers'],
    select: (data: any) => data.providers as EmailProviderCatalog[]
  });

  // Fetch current mail settings
  const { data: settingsData } = useQuery({
    queryKey: ['/api/settings/mail/current']
  });

  // Fetch Gmail/Microsoft auth status
  const { data: gmailAuthData } = useQuery({
    queryKey: ['/api/auth/google/gmail/status'],
    enabled: (settingsData as any)?.settings?.provider === 'gmail'
  });

  const { data: microsoftAuthData } = useQuery({
    queryKey: ['/api/auth/microsoft/mail/status'],
    enabled: (settingsData as any)?.settings?.provider === 'microsoft'
  });

  const settings = (settingsData as any)?.settings;
  const providers = providersData || [];
  const selectedProviderData = providers.find(p => p.code === selectedProvider);

  const handleProviderSelect = (providerCode: string, isOutgoing: boolean = false) => {
    const provider = providers.find(p => p.code === providerCode);
    if (!provider) return;

    setIncomingPopoverOpen(false);
    setOutgoingPopoverOpen(false);

    // Handle OAuth providers
    if (provider.authType === 'oauth') {
      if (providerCode === 'gmail') {
        window.location.href = '/api/auth/google/gmail';
      } else if (providerCode === 'microsoft') {
        window.location.href = '/api/auth/microsoft/mail';
      }
    } else {
      // For IMAP/SMTP or API providers, navigate to setup form
      window.location.href = `/settings/email?tab=setup&provider=${providerCode}`;
    }
  };

  // Separate incoming and outgoing providers
  const incomingProviders = providers.filter(p => 
    p.authType === 'oauth' || p.authType === 'imap_smtp'
  );
  
  const outgoingProviders = providers.filter(p => 
    p.authType === 'api' || p.authType === 'smtp_only'
  );

  const getAuthStatus = () => {
    if (!settings?.provider) return null;
    
    switch (settings.provider) {
      case 'gmail':
        return gmailAuthData;
      case 'microsoft':
        return microsoftAuthData;
      default:
        return null;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="space-y-6">
      {/* About Email Settings */}
      <Card data-testid="card-about-email">
        <CardHeader>
          <CardTitle>About Email Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your email provider to send and receive emails directly from your CRM. 
            Choose from popular providers like Gmail and Microsoft 365, or configure custom IMAP/SMTP settings.
            All emails are synced securely and linked to your contacts and projects.
          </p>
        </CardContent>
      </Card>

      {/* Incoming Email */}
      <Card data-testid="card-incoming-email">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Incoming Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Email Account</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {settings ? `${settings.fromEmail || 'Not configured'}` : 'No account connected'}
              </p>
            </div>
            <Popover open={incomingPopoverOpen} onOpenChange={setIncomingPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={settings ? 'outline' : 'default'}
                  data-testid="button-connect-account"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {settings ? 'Change Account' : 'Connect Account'}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Select Email Provider</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Choose your email provider to connect for incoming emails
                  </p>
                  <div className="space-y-1">
                    {incomingProviders.map((provider) => (
                      <Button
                        key={provider.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleProviderSelect(provider.code, false)}
                        data-testid={`provider-option-${provider.code}`}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {provider.displayName}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {settings && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Synced</Label>
                  <p className="text-sm">{formatDate(settings.updatedAt)}</p>
                </div>
                {getAuthStatus()?.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="contacts-only" className="text-base font-medium">
                    Show emails from contacts on dashboard
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Only display emails from known contacts and project participants
                  </p>
                </div>
                <Switch
                  id="contacts-only"
                  checked={showContactsOnly}
                  onCheckedChange={setShowContactsOnly}
                  data-testid="switch-contacts-only"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Outgoing Email */}
      <Card data-testid="card-outgoing-email">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="h-5 w-5 mr-2" />
            Outgoing Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Outgoing Email Provider</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {settings ? `${settings.provider || 'Custom SMTP'}` : 'No provider configured'}
              </p>
            </div>
            <Popover open={outgoingPopoverOpen} onOpenChange={setOutgoingPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={settings ? 'outline' : 'default'}
                  data-testid="button-configure-outgoing"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {settings ? 'Change Provider' : 'Configure Provider'}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Select Outgoing Provider</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Choose a service for sending emails (SMTP or API-based)
                  </p>
                  <div className="space-y-1">
                    {/* Current provider (IMAP/SMTP) */}
                    {incomingProviders.map((provider) => (
                      <Button
                        key={provider.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleProviderSelect(provider.code, true)}
                        data-testid={`outgoing-provider-${provider.code}`}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {provider.displayName}
                      </Button>
                    ))}
                    {/* API-only providers */}
                    {outgoingProviders.length > 0 && (
                      <>
                        <Separator className="my-2" />
                        <p className="text-xs font-semibold text-gray-500 px-2">API Services</p>
                        {outgoingProviders.map((provider) => (
                          <Button
                            key={provider.id}
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => handleProviderSelect(provider.code, true)}
                            data-testid={`outgoing-provider-${provider.code}`}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {provider.displayName}
                          </Button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {settings ? (
            <>
              <Separator />

              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email Sent As</Label>
                <p className="text-sm font-medium">
                  {settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail}
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="bcc-me" className="text-base font-medium">
                    BCC me on all outgoing mail
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically include yourself as BCC on all sent emails
                  </p>
                </div>
                <Switch
                  id="bcc-me"
                  checked={bccMe}
                  onCheckedChange={setBccMe}
                  data-testid="switch-bcc-me"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="read-receipts" className="text-base font-medium">
                    Enable read receipts
                  </Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Request read receipts for sent emails (not supported by all providers)
                  </p>
                </div>
                <Switch
                  id="read-receipts"
                  checked={enableReadReceipts}
                  onCheckedChange={setEnableReadReceipts}
                  data-testid="switch-read-receipts"
                />
              </div>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Connect an email account to configure outgoing email settings
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Email Help */}
      <Card data-testid="card-email-help">
        <CardHeader>
          <CardTitle className="flex items-center">
            <HelpCircle className="h-5 w-5 mr-2" />
            Email Help
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="provider-help" className="text-base font-medium mb-2 block">
              Select Provider for Help
            </Label>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger id="provider-help" data-testid="select-provider-help">
                <SelectValue placeholder="Choose a provider..." />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.code}>
                    {provider.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProviderData && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {selectedProviderData.displayName}
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                {selectedProviderData.helpBlurb}
              </p>

              {selectedProviderData.authType === 'imap_smtp' && (
                <div className="space-y-2 text-sm">
                  {selectedProviderData.imapHost && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-blue-700 dark:text-blue-300 font-medium">IMAP Host:</span>
                      <span className="col-span-2 text-blue-900 dark:text-blue-100 font-mono">
                        {selectedProviderData.imapHost}:{selectedProviderData.imapPort}
                        {selectedProviderData.imapSecure && ' (TLS)'}
                      </span>
                    </div>
                  )}
                  {selectedProviderData.smtpHost && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-blue-700 dark:text-blue-300 font-medium">SMTP Host:</span>
                      <span className="col-span-2 text-blue-900 dark:text-blue-100 font-mono">
                        {selectedProviderData.smtpHost}:{selectedProviderData.smtpPort}
                        {selectedProviderData.smtpSecure && ' (TLS)'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
