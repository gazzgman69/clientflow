import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiRequest } from '@/lib/queryClient';
import { 
  Mail, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  Clock,
  Activity,
  Info,
  HelpCircle,
  RefreshCw,
  Server,
  Eye,
  Copy,
  Link as LinkIcon,
  Unlink
} from 'lucide-react';

interface EmailProvider {
  id: string;
  code: string;
  displayName: string;
  category: string;
  authType: string;
  supportsReceive: boolean;
  supportsSend: boolean;
  helpUrl?: string;
  setupComplexity: string;
  isActive: boolean;
}

interface TenantEmailPrefs {
  tenantId: string;
  bccSelf: boolean;
  readReceipts: boolean;
  showOnDashboard: boolean;
  contactsOnly: boolean;
  updatedAt: Date;
}

interface MailSettings {
  id: string;
  name: string;
  provider?: string;
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
  isActive: boolean;
  isDefault: boolean;
  syncIntervalMinutes: number;
  lastTestedAt?: string;
  lastTestResult?: 'ok' | 'fail';
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export default function EmailSettings() {
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedProviderToConnect, setSelectedProviderToConnect] = useState<EmailProvider | null>(null);
  const [testEmailData, setTestEmailData] = useState({
    to: '',
    subject: 'Test Email from BusinessCRM',
    body: 'This is a test email to verify your email configuration is working correctly.',
    provider: 'gmail' as 'gmail' | 'microsoft' | 'smtp'
  });
  const [testEmailResult, setTestEmailResult] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch email providers catalog
  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['/api/email/provider-catalog/active']
  });

  // Fetch tenant email preferences
  const { data: prefsData } = useQuery({
    queryKey: ['/api/email/tenant-prefs']
  });

  // Fetch current mail settings
  const { data: settingsData } = useQuery({
    queryKey: ['/api/settings/mail/current']
  });

  // Fetch Gmail connection status
  const { data: gmailStatusData, isLoading: gmailStatusLoading } = useQuery({
    queryKey: ['/api/auth/google/gmail/status']
  });

  // Fetch Microsoft connection status
  const { data: microsoftStatusData, isLoading: microsoftStatusLoading } = useQuery({
    queryKey: ['/api/auth/microsoft/status']
  });

  const providers = (providersData as any)?.providers || [];
  const prefs = (prefsData as any)?.prefs as TenantEmailPrefs;
  const settings = (settingsData as any)?.settings as MailSettings | null;
  const gmailStatus = (gmailStatusData as any) || { ok: false, connected: false };
  const microsoftStatus = (microsoftStatusData as any) || { ok: false, connected: false };
  
  // Determine which provider is connected (including needs reconnect state)
  const connectedProvider = (gmailStatus.connected || gmailStatus.needsReconnect) ? 'gmail' : (microsoftStatus.connected || microsoftStatus.needsReconnect) ? 'microsoft' : null;
  const providerStatus = connectedProvider === 'gmail' ? gmailStatus : connectedProvider === 'microsoft' ? microsoftStatus : { ok: false, connected: false };
  const providerLoading = gmailStatusLoading || microsoftStatusLoading;

  // Update preferences mutation
  const updatePrefsMutation = useMutation({
    mutationFn: async (updates: Partial<TenantEmailPrefs>) => {
      const response = await apiRequest('PUT', '/api/email/tenant-prefs', updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/tenant-prefs'] });
      setAlertMessage({ type: 'success', message: 'Preferences updated successfully' });
    },
    onError: () => {
      setAlertMessage({ type: 'error', message: 'Failed to update preferences' });
    }
  });

  // Send test email mutation
  const sendTestMutation = useMutation({
    mutationFn: async (data: { to: string; provider: string; fromEmail?: string }) => {
      const response = await apiRequest('POST', '/api/email/debug/send-test-email', data);
      return response.json();
    },
    onSuccess: (data) => {
      setTestEmailResult(data);
      if (data.success) {
        setAlertMessage({ type: 'success', message: 'Test email sent successfully' });
      }
    },
    onError: (error: any) => {
      setAlertMessage({ type: 'error', message: 'Failed to send test email' });
    }
  });

  // Disconnect provider mutation
  const disconnectProviderMutation = useMutation({
    mutationFn: async () => {
      if (connectedProvider === 'gmail') {
        const response = await apiRequest('POST', '/api/auth/google/disconnect', {});
        return response.json();
      } else if (connectedProvider === 'microsoft') {
        const response = await apiRequest('POST', '/api/auth/microsoft/disconnect', {});
        return response.json();
      }
      throw new Error('No provider connected');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/google/gmail/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/microsoft/status'] });
      setAlertMessage({ type: 'success', message: `${connectedProvider === 'gmail' ? 'Gmail' : 'Microsoft'} disconnected successfully` });
    },
    onError: () => {
      setAlertMessage({ type: 'error', message: 'Failed to disconnect provider' });
    }
  });

  // Get selected provider details
  const selectedProviderDetails = providers.find((p: EmailProvider) => p.code === selectedProvider);

  // Format date
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

  // Clear alert after 5 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setAlertMessage({ type: 'success', message: 'Copied to clipboard' });
  };

  return (
    <div className="p-6 overflow-y-auto" data-testid="email-settings-page">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Email Settings</h1>
              <p className="text-muted-foreground">Manage your email integration and preferences</p>
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        {alertMessage && (
          <Alert className={`${alertMessage.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className={alertMessage.type === 'error' ? 'text-red-800' : 'text-green-800'}>
              {alertMessage.message}
            </AlertDescription>
          </Alert>
        )}

        {/* About Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Info className="h-5 w-5 mr-2" />
              About Email Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Connect your email account to sync conversations, send emails directly from BusinessCRM, and enable automated workflows.
            </p>
            <p className="text-sm text-muted-foreground">
              We support Google Workspace, Microsoft 365, iCloud, Yahoo, and many other providers with secure OAuth or IMAP/SMTP connections.
            </p>
          </CardContent>
        </Card>

        {/* Incoming Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Incoming Email
            </CardTitle>
            <CardDescription>
              Connect your email to sync messages from contacts and projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email Provider Connection Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Email Provider</p>
                    <div className="flex items-center gap-2 mt-1">
                      {providerLoading ? (
                        <Badge variant="outline">Checking...</Badge>
                      ) : providerStatus.connected ? (
                        <>
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {connectedProvider === 'gmail' ? 'Gmail' : 'Microsoft'} Connected
                          </Badge>
                          {providerStatus.email && (
                            <span className="text-sm text-muted-foreground">{providerStatus.email}</span>
                          )}
                        </>
                      ) : providerStatus.needsReconnect ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {connectedProvider === 'gmail' ? 'Gmail' : 'Microsoft'} - Needs Reconnect
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not connected</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(providerStatus.connected || providerStatus.needsReconnect) ? (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (connectedProvider === 'gmail') {
                                  window.location.href = '/api/auth/google/gmail';
                                } else if (connectedProvider === 'microsoft') {
                                  window.location.href = '/api/auth/microsoft/mail';
                                }
                              }}
                              data-testid="button-reconnect-provider"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reconnect
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Re-authenticate with {connectedProvider === 'gmail' ? 'Gmail' : 'Microsoft'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => disconnectProviderMutation.mutate()}
                        disabled={disconnectProviderMutation.isPending}
                        data-testid="button-disconnect-provider"
                      >
                        <Unlink className="h-4 w-4 mr-2" />
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-connect-provider">
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Connect Provider
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Connect Email Provider</DialogTitle>
                          <DialogDescription>
                            Select your email provider to configure incoming email
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {providersLoading ? (
                            <p className="text-center py-4">Loading providers...</p>
                          ) : selectedProviderToConnect ? (
                            <div className="space-y-4">
                              <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                                <Mail className="h-5 w-5" />
                                <div>
                                  <p className="font-medium">{selectedProviderToConnect.displayName}</p>
                                  <p className="text-sm text-muted-foreground capitalize">{selectedProviderToConnect.authType.replace('_', ' ')}</p>
                                </div>
                              </div>
                              {selectedProviderToConnect.authType === 'oauth' ? (
                                <div className="space-y-4">
                                  <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertDescription>
                                      You'll be redirected to {selectedProviderToConnect.displayName} to authorize access to your email account.
                                    </AlertDescription>
                                  </Alert>
                                  <Button className="w-full" onClick={() => {
                                    if (selectedProviderToConnect.code === 'gmail' || selectedProviderToConnect.code === 'google') {
                                      window.location.href = '/api/auth/google/gmail';
                                    } else if (selectedProviderToConnect.code === 'microsoft' || selectedProviderToConnect.code === 'office365') {
                                      window.location.href = '/api/auth/microsoft/mail';
                                    }
                                  }}>
                                    Connect with {selectedProviderToConnect.displayName}
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertDescription>
                                      Enter your IMAP/SMTP credentials to connect your email account.
                                    </AlertDescription>
                                  </Alert>
                                  <div className="grid gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="email-address">Email Address</Label>
                                      <Input id="email-address" type="email" placeholder="your@email.com" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="email-password">Password or App Password</Label>
                                      <Input id="email-password" type="password" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="imap-server">IMAP Server</Label>
                                        <Input id="imap-server" placeholder="imap.example.com" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="imap-port">IMAP Port</Label>
                                        <Input id="imap-port" placeholder="993" />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="smtp-server">SMTP Server</Label>
                                        <Input id="smtp-server" placeholder="smtp.example.com" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="smtp-port">SMTP Port</Label>
                                        <Input id="smtp-port" placeholder="465" />
                                      </div>
                                    </div>
                                    <Button className="w-full">
                                      Connect Email Account
                                    </Button>
                                  </div>
                                </div>
                              )}
                              <Button variant="outline" onClick={() => setSelectedProviderToConnect(null)}>
                                Back to Providers
                              </Button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {providers.map((provider: EmailProvider) => (
                                <button
                                  key={provider.id}
                                  onClick={() => setSelectedProviderToConnect(provider)}
                                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors text-left"
                                  data-testid={`provider-option-${provider.code}`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                      <p className="font-medium">{provider.displayName}</p>
                                      <p className="text-sm text-muted-foreground capitalize">{provider.authType.replace('_', ' ')}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {provider.supportsReceive && (
                                      <Badge variant="secondary" className="text-xs">Incoming</Badge>
                                    )}
                                    {provider.supportsSend && (
                                      <Badge variant="secondary" className="text-xs">Outgoing</Badge>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
              
              {(providerStatus.connected || providerStatus.needsReconnect) && (
                <>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Last synced: {providerStatus.lastSyncAt ? formatDate(providerStatus.lastSyncAt) : 'Never'}</span>
                    </div>
                    {providerStatus.scopes && providerStatus.scopes.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                              <Info className="h-3 w-3" />
                              <span>{providerStatus.scopes.length} permissions</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">{connectedProvider === 'gmail' ? 'Gmail' : 'Microsoft'} Permissions:</p>
                              {providerStatus.scopes.map((scope: string, idx: number) => (
                                <p key={idx} className="text-xs">{scope.split('/').pop()}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                          Use a different provider instead
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Switch Email Provider</DialogTitle>
                          <DialogDescription>
                            Disconnect {connectedProvider === 'gmail' ? 'Gmail' : 'Microsoft'} and connect a different email provider
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Switching providers will disconnect your current {connectedProvider === 'gmail' ? 'Gmail' : 'Microsoft'} account. Make sure to save any important settings.
                            </AlertDescription>
                          </Alert>
                          {providersLoading ? (
                            <p className="text-center py-4">Loading providers...</p>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {providers.filter((p: EmailProvider) => {
                                const currentProviderCodes = connectedProvider === 'gmail' ? ['gmail', 'google'] : ['microsoft', 'office365'];
                                return !currentProviderCodes.includes(p.code);
                              }).map((provider: EmailProvider) => (
                                <button
                                  key={provider.id}
                                  onClick={() => {
                                    disconnectProviderMutation.mutate();
                                    setSelectedProviderToConnect(provider);
                                    setShowConnectDialog(true);
                                  }}
                                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors text-left"
                                  data-testid={`switch-provider-${provider.code}`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                      <p className="font-medium">{provider.displayName}</p>
                                      <p className="text-sm text-muted-foreground capitalize">{provider.authType.replace('_', ' ')}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {provider.supportsReceive && (
                                      <Badge variant="secondary" className="text-xs">Incoming</Badge>
                                    )}
                                    {provider.supportsSend && (
                                      <Badge variant="secondary" className="text-xs">Outgoing</Badge>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </>
              )}
              
              {!providerStatus.connected && (
                <p className="text-xs text-muted-foreground">
                  Connect your email provider to sync messages from contacts and projects. Supports Gmail, Microsoft, iCloud, Yahoo, and {providers.length > 4 ? `${providers.length - 4} more providers` : 'more'}.
                </p>
              )}
            </div>

            {(providerStatus.connected || providerStatus.needsReconnect || settings) && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="show-dashboard">Show emails on dashboard</Label>
                  </div>
                  <Switch
                    id="show-dashboard"
                    checked={prefs?.showOnDashboard ?? true}
                    onCheckedChange={(checked) => updatePrefsMutation.mutate({ showOnDashboard: checked })}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Outgoing Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Send className="h-5 w-5 mr-2" />
              Outgoing Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings ? (
              <>
                <div className="grid gap-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Email Sent As:</span>
                    <span className="text-sm text-muted-foreground">{settings.fromEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Outgoing Server:</span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {settings.provider || 'Not configured'}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="bcc-self">BCC you on all outgoing mail</Label>
                      <p className="text-xs text-muted-foreground">Receive a copy of every email you send</p>
                    </div>
                    <Switch
                      id="bcc-self"
                      checked={prefs?.bccSelf ?? false}
                      onCheckedChange={(checked) => updatePrefsMutation.mutate({ bccSelf: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="read-receipts">Enable Read Receipts</Label>
                      <p className="text-xs text-muted-foreground">May increase spam score</p>
                    </div>
                    <Switch
                      id="read-receipts"
                      checked={prefs?.readReceipts ?? false}
                      onCheckedChange={(checked) => updatePrefsMutation.mutate({ readReceipts: checked })}
                    />
                  </div>
                </div>

                <Button variant="outline" data-testid="button-change-server">
                  <Server className="h-4 w-4 mr-2" />
                  Change Outgoing Server
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Connect an email account to configure outgoing settings
              </p>
            )}
          </CardContent>
        </Card>

        {/* Email Help */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HelpCircle className="h-5 w-5 mr-2" />
              Email Help
            </CardTitle>
            <CardDescription>Select your email provider to view setup instructions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Your Email Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger data-testid="select-email-provider">
                  <SelectValue placeholder="Choose a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providersLoading ? (
                    <SelectItem value="loading" disabled>Loading providers...</SelectItem>
                  ) : providers.length > 0 ? (
                    providers.map((provider: EmailProvider) => (
                      <SelectItem key={provider.id} value={provider.code}>
                        {provider.displayName}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No providers available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedProviderDetails && (
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <h4 className="font-medium">{selectedProviderDetails.displayName}</h4>
                
                {selectedProviderDetails.helpUrl && (
                  <p className="text-sm text-muted-foreground">
                    {selectedProviderDetails.helpUrl}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between items-center p-2 bg-background rounded">
                    <span className="font-medium">Auth Type:</span>
                    <Badge variant="outline" className="capitalize">
                      {selectedProviderDetails.authType}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-background rounded">
                    <span className="font-medium">Complexity:</span>
                    <Badge variant="outline" className="capitalize">
                      {selectedProviderDetails.setupComplexity}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2 text-xs text-muted-foreground">
                  {selectedProviderDetails.supportsReceive && (
                    <Badge variant="secondary">Incoming ✓</Badge>
                  )}
                  {selectedProviderDetails.supportsSend && (
                    <Badge variant="secondary">Outgoing ✓</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send Test Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Send className="h-5 w-5 mr-2" />
              Send Test Email
            </CardTitle>
            <CardDescription>Test your email configuration by sending a test message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-email-to">Recipient Email</Label>
                <Input
                  id="test-email-to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={testEmailData.to}
                  onChange={(e) => setTestEmailData({ ...testEmailData, to: e.target.value })}
                  data-testid="input-test-email-to"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-email-subject">Subject</Label>
                <Input
                  id="test-email-subject"
                  value={testEmailData.subject}
                  onChange={(e) => setTestEmailData({ ...testEmailData, subject: e.target.value })}
                  data-testid="input-test-email-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-email-body">Message</Label>
                <Textarea
                  id="test-email-body"
                  value={testEmailData.body}
                  onChange={(e) => setTestEmailData({ ...testEmailData, body: e.target.value })}
                  rows={4}
                  data-testid="textarea-test-email-body"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-email-provider">Provider</Label>
                <Select 
                  value={testEmailData.provider} 
                  onValueChange={(value: any) => setTestEmailData({ ...testEmailData, provider: value })}
                >
                  <SelectTrigger id="test-email-provider" data-testid="select-test-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="microsoft">Microsoft</SelectItem>
                    <SelectItem value="smtp">SMTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => sendTestMutation.mutate({
                to: testEmailData.to,
                provider: testEmailData.provider,
                fromEmail: settings?.fromEmail
              })}
              disabled={!testEmailData.to || sendTestMutation.isPending}
              data-testid="button-send-test-email"
            >
              {sendTestMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>

            {testEmailResult && (
              <div className={`p-4 rounded-lg ${testEmailResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-start space-x-3">
                  {testEmailResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-2">
                    <p className={`font-medium ${testEmailResult.success ? 'text-green-900' : 'text-red-900'}`}>
                      {testEmailResult.message}
                    </p>
                    {testEmailResult.testDetails && (
                      <div className="text-sm space-y-1">
                        <p><span className="font-medium">Provider:</span> {testEmailResult.testDetails.provider}</p>
                        <p><span className="font-medium">Timestamp:</span> {formatDate(testEmailResult.testDetails.timestamp)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Logs (Optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Recent Activity
            </CardTitle>
            <CardDescription>Email sync and delivery logs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              Activity logs will appear here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
