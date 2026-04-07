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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest, queryClient } from '@/lib/queryClient';
import SignatureManagement from '@/components/settings/SignatureManagement';
import { 
  Mail, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings as SettingsIcon,
  Clock,
  Activity,
  Info,
  HelpCircle,
  RefreshCw,
  Server,
  Eye,
  Copy,
  Link as LinkIcon,
  Unlink,
  Edit3,
  Bell,
  FileCheck
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

// Normalized provider type matching spec
type Provider = {
  key: string;                       // e.g. 'google', 'microsoft', 'yahoo', 'other'
  display_name: string;
  category: 'oauth' | 'imap_smtp';
  imap?: { host?: string; port?: number; secure?: boolean };
  smtp?: { host?: string; port?: number; secure?: boolean };
};

type Mode = 'oauth' | 'preconfigured' | 'generic';

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

// Normalize provider from API response to match spec
function normalizeProvider(p: EmailProvider): Provider {
  return {
    key: p.code,
    display_name: p.displayName,
    category: p.category === 'oauth' ? 'oauth' : 'imap_smtp',
    imap: p.category === 'imap_smtp' ? { 
      host: undefined, // Will be populated from catalog if available
      port: 993, 
      secure: true 
    } : undefined,
    smtp: p.category === 'imap_smtp' ? { 
      host: undefined, 
      port: 465, 
      secure: true 
    } : undefined,
  };
}

// Reliable mode detection matching spec
function getProviderMode(p?: Provider | null): Mode {
  if (!p) return 'generic';
  if (['google','microsoft','hotmail_msn_outlook_live'].includes(p.key)) return 'oauth';
  if (p.category === 'imap_smtp') {
    const preset = !!(p.imap?.host && typeof p.imap.port === 'number');
    return preset ? 'preconfigured' : 'generic';
  }
  return 'generic';
}

export default function EmailSettings() {
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  
  // Normalized providers state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const selected = providers.find(p => p.key === selectedKey) || null;
  
  // Form state for email sync modal
  const [emailSyncForm, setEmailSyncForm] = useState({
    login: '',
    password: '',
    imapServer: '',
    imapPort: '993',
    ssl: true,
    smtpServer: '',
    smtpPort: '465',
    smtpSsl: true
  });
  
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

  // Fetch Gmail connection status (refetch every 30s to catch sync updates)
  const { data: gmailStatusData, isLoading: gmailStatusLoading } = useQuery({
    queryKey: ['/api/auth/google/gmail/status'],
    refetchInterval: 30000
  });

  // Fetch Microsoft connection status
  const { data: microsoftStatusData, isLoading: microsoftStatusLoading } = useQuery({
    queryKey: ['/api/auth/microsoft/status']
  });

  const rawProviders = (providersData as any)?.providers || [];
  const prefs = (prefsData as any)?.prefs as TenantEmailPrefs;
  const settings = (settingsData as any)?.settings as MailSettings | null;
  
  // Normalize providers from API response and set default selection
  useEffect(() => {
    if (rawProviders.length > 0) {
      const normalized = rawProviders.map(normalizeProvider);
      setProviders(normalized);
      // Initialize with first provider if none selected
      if (!selectedKey && normalized.length > 0) {
        setSelectedKey(normalized[0].key);
      }
    }
  }, [rawProviders, selectedKey]);
  
  // Reset form when provider changes
  useEffect(() => {
    setEmailSyncForm({
      login: '',
      password: '',
      imapServer: '',
      imapPort: '993',
      ssl: true,
      smtpServer: '',
      smtpPort: '465',
      smtpSsl: true
    });
  }, [selectedKey]);
  
  const mode = getProviderMode(selected);
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
        const response = await apiRequest('POST', '/api/auth/google/gmail/disconnect', {});
        return response.json();
      } else if (connectedProvider === 'microsoft') {
        const response = await apiRequest('POST', '/api/auth/microsoft/mail/disconnect', {});
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
  
  // Connect email account mutation (for IMAP/SMTP)
  const connectEmailAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/email/accounts', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/google/gmail/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/microsoft/status'] });
      setShowConnectDialog(false);
      setEmailSyncForm({
        login: '',
        password: '',
        imapServer: '',
        imapPort: '993',
        ssl: true,
        smtpServer: '',
        smtpPort: '465',
        smtpSsl: true
      });
      setAlertMessage({ type: 'success', message: 'Email account connected successfully' });
    },
    onError: (error: any) => {
      setAlertMessage({ type: 'error', message: error.message || 'Failed to connect email account' });
    }
  });

  // Get selected provider details for help section
  const selectedProviderDetails = rawProviders.find((p: EmailProvider) => p.code === selectedProvider);

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
  
  // Connect Google with popup and postMessage
  const connectGoogleWithPopup = async () => {
    // Close dialog immediately
    setShowConnectDialog(false);
    
    // Email is optional for OAuth - user will authenticate through OAuth provider
    const email = emailSyncForm.login || '';
    
    const origin = window.location.origin;
    
    // Get OAuth URL from backend
    try {
      const response = await apiRequest('POST', '/auth/google/gmail/start', {
        email,
        popup: true,
        origin
      });
      
      const data = await response.json();
      if (!data.authUrl) {
        throw new Error('No auth URL received');
      }
      
      // Open popup with the OAuth URL
      const w = window.open(
        data.authUrl,
        'oauth-google',
        'width=520,height=700,menubar=0,toolbar=0,status=0'
      );

      function onMsg(ev: MessageEvent) {
        // In dev (Replit) origins can shift. Accept only our message type.
        if (!ev?.data || ev.data.type !== 'oauth:connected' || ev.data.provider !== 'google' || ev.data.serviceType !== 'gmail') return;
        window.removeEventListener('message', onMsg);
        try { w?.close(); } catch {}
        
        // Refresh connected state (or refetch accounts)
        queryClient.invalidateQueries({ queryKey: ['/api/auth/google/gmail/status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/email/provider-catalog/active'] });
        setAlertMessage({ type: 'success', message: 'Gmail connected successfully! Syncing emails...' });
        
        // Poll for timestamp updates - sync runs in background and can take 60-120 seconds
        const pollIntervals = [2000, 5000, 10000, 20000, 30000, 45000, 60000, 90000, 120000];
        pollIntervals.forEach((delay) => {
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['/api/auth/google/gmail/status'] });
            queryClient.refetchQueries({ queryKey: ['/api/auth/google/gmail/status'] });
          }, delay);
        });
      }
      window.addEventListener('message', onMsg, { once: true });
    } catch (error: any) {
      setAlertMessage({ type: 'error', message: error.message || 'Failed to start OAuth' });
    }
  };

  // Connect Microsoft with popup and postMessage
  const connectMicrosoftWithPopup = async () => {
    // Close dialog immediately
    setShowConnectDialog(false);
    
    // Email is optional for OAuth - user will authenticate through OAuth provider
    const email = emailSyncForm.login || '';
    
    const origin = window.location.origin;
    
    // Get OAuth URL from backend
    try {
      const response = await apiRequest('POST', '/auth/microsoft/start', {
        email,
        popup: true,
        origin
      });
      
      const data = await response.json();
      if (!data.authUrl) {
        throw new Error('No auth URL received');
      }
      
      // Open popup with the OAuth URL
      const w = window.open(
        data.authUrl,
        'oauth-microsoft',
        'width=520,height=700,menubar=0,toolbar=0,status=0'
      );

      function onMsg(ev: MessageEvent) {
        // In dev (Replit) origins can shift. Accept only our message type.
        if (!ev?.data || ev.data.type !== 'oauth:connected' || ev.data.provider !== 'microsoft') return;
        window.removeEventListener('message', onMsg);
        try { w?.close(); } catch {}
        
        // Refresh connected state (or refetch accounts)
        queryClient.invalidateQueries({ queryKey: ['/api/auth/microsoft/status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/email/provider-catalog/active'] });
        setAlertMessage({ type: 'success', message: 'Microsoft account connected successfully! Syncing emails...' });
        
        // Poll for timestamp updates - sync runs in background and can take 60-120 seconds
        const pollIntervals = [2000, 5000, 10000, 20000, 30000, 45000, 60000, 90000, 120000];
        pollIntervals.forEach((delay) => {
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['/api/auth/microsoft/status'] });
            queryClient.refetchQueries({ queryKey: ['/api/auth/microsoft/status'] });
          }, delay);
        });
      }
      window.addEventListener('message', onMsg, { once: true });
    } catch (error: any) {
      setAlertMessage({ type: 'error', message: error.message || 'Failed to start OAuth' });
    }
  };

  // Handle email sync connect
  const handleEmailSyncConnect = async () => {
    if (!selected) return;
    
    const currentMode = getProviderMode(selected);
    
    // Mode A - OAuth: open popup window for OAuth flow with postMessage
    if (currentMode === 'oauth') {
      if (selected.key === 'google') {
        connectGoogleWithPopup();
      } else if (selected.key === 'microsoft' || selected.key === 'hotmail_msn_outlook_live') {
        connectMicrosoftWithPopup();
      }
      return;
    }
    
    // Mode B - Preconfigured: use catalog defaults
    if (currentMode === 'preconfigured') {
      const accountData = {
        type: 'imap_smtp',
        providerKey: selected.key,
        settings: {
          imap: {
            host: selected.imap?.host,
            port: selected.imap?.port || 993,
            secure: selected.imap?.secure ?? true,
            user: emailSyncForm.login,
            pass: emailSyncForm.password
          },
          smtp: selected.smtp ? {
            host: selected.smtp.host,
            port: selected.smtp.port || 465,
            secure: selected.smtp.secure ?? true,
            user: emailSyncForm.login,
            pass: emailSyncForm.password
          } : null
        }
      };
      connectEmailAccountMutation.mutate(accountData);
      return;
    }
    
    // Mode C - Generic: use manual values
    const accountData = {
      type: 'imap_smtp',
      providerKey: selected.key,
      settings: {
        imap: {
          host: emailSyncForm.imapServer,
          port: parseInt(emailSyncForm.imapPort),
          secure: emailSyncForm.ssl,
          user: emailSyncForm.login,
          pass: emailSyncForm.password
        },
        smtp: emailSyncForm.smtpServer ? {
          host: emailSyncForm.smtpServer,
          port: parseInt(emailSyncForm.smtpPort),
          secure: emailSyncForm.smtpSsl,
          user: emailSyncForm.login,
          pass: emailSyncForm.password
        } : null
      }
    };
    
    connectEmailAccountMutation.mutate(accountData);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto" data-testid="email-settings-page">
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

        {/* Tabs */}
        <Tabs defaultValue={new URLSearchParams(window.location.search).get('tab') || 'settings'} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            <TabsTrigger value="signatures" data-testid="tab-signatures">Signatures</TabsTrigger>
            <TabsTrigger value="reminders" data-testid="tab-reminders">Reminders</TabsTrigger>
            <TabsTrigger value="confirmations" data-testid="tab-confirmations">Confirmations</TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6" data-testid="content-settings">
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
                                      connectGoogleWithPopup();
                                    } else if (connectedProvider === 'microsoft') {
                                      connectMicrosoftWithPopup();
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
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <div className="flex items-center gap-3">
                                <Mail className="h-6 w-6 text-muted-foreground" />
                                <DialogTitle className="text-2xl">Email Sync</DialogTitle>
                              </div>
                            </DialogHeader>
                            
                            {providersLoading ? (
                              <div className="py-8 text-center text-muted-foreground">Loading providers...</div>
                            ) : (
                              <div className="space-y-6">
                                {/* Email Provider Selector */}
                                <div className="space-y-2">
                                  <Label htmlFor="email-provider" className="text-base font-semibold">Email Provider</Label>
                                  <select
                                    id="email-provider"
                                    aria-label="Email Provider"
                                    value={selectedKey}
                                    onChange={(e) => setSelectedKey(e.target.value)}
                                    className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    data-testid="select-email-provider"
                                  >
                                    {providers.map(p => (
                                      <option key={p.key} value={p.key}>{p.display_name}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Login Field (shown in all modes) */}
                                <div className="space-y-2">
                                  <Label htmlFor="login" className="text-base font-semibold">Login</Label>
                                  <Input 
                                    id="login" 
                                    type="email" 
                                    placeholder={mode === 'oauth' ? 'Optional' : 'This is usually your email address'}
                                    value={emailSyncForm.login}
                                    onChange={(e) => setEmailSyncForm({ ...emailSyncForm, login: e.target.value })}
                                    data-testid="input-login"
                                  />
                                </div>

                                {/* Password Field (shown in preconfigured and generic modes) */}
                                {(mode === 'preconfigured' || mode === 'generic') && (
                                  <div className="space-y-2">
                                    <Label htmlFor="password" className="text-base font-semibold">Password</Label>
                                    <Input 
                                      id="password" 
                                      type="password"
                                      value={emailSyncForm.password}
                                      onChange={(e) => setEmailSyncForm({ ...emailSyncForm, password: e.target.value })}
                                      data-testid="input-password"
                                    />
                                  </div>
                                )}

                                {/* Manual IMAP/SMTP Fields (shown only in 'generic' mode) */}
                                {mode === 'generic' && (
                                  <>
                                    <div className="space-y-2">
                                      <Label htmlFor="imap-server" className="text-base font-semibold">IMAP Server</Label>
                                      <Input 
                                        id="imap-server" 
                                        placeholder="imap.mail.yahoo.com"
                                        value={emailSyncForm.imapServer}
                                        onChange={(e) => setEmailSyncForm({ ...emailSyncForm, imapServer: e.target.value })}
                                        data-testid="input-imap-server"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="port" className="text-base font-semibold">Port</Label>
                                      <Input 
                                        id="port" 
                                        placeholder="993"
                                        value={emailSyncForm.imapPort}
                                        onChange={(e) => setEmailSyncForm({ ...emailSyncForm, imapPort: e.target.value })}
                                        data-testid="input-port"
                                      />
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id="ssl"
                                        checked={emailSyncForm.ssl}
                                        onChange={(e) => setEmailSyncForm({ ...emailSyncForm, ssl: e.target.checked })}
                                        className="h-4 w-4 rounded border-gray-300"
                                        data-testid="input-ssl"
                                      />
                                      <Label htmlFor="ssl" className="text-base font-semibold cursor-pointer">SSL</Label>
                                    </div>
                                  </>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-4">
                                  <Button 
                                    variant="outline" 
                                    className="flex-1" 
                                    onClick={() => {
                                      setShowConnectDialog(false);
                                      setEmailSyncForm({
                                        login: '',
                                        password: '',
                                        imapServer: '',
                                        imapPort: '993',
                                        ssl: true,
                                        smtpServer: '',
                                        smtpPort: '465',
                                        smtpSsl: true
                                      });
                                    }}
                                    data-testid="button-cancel"
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    className="flex-1 bg-green-700 hover:bg-green-800" 
                                    onClick={handleEmailSyncConnect}
                                    disabled={connectEmailAccountMutation.isPending}
                                    data-testid="button-connect"
                                  >
                                    Connect
                                  </Button>
                                </div>
                              </div>
                            )}
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
                                  {providers.filter((p: Provider) => {
                                    const currentProviderCodes = connectedProvider === 'gmail' ? ['gmail', 'google'] : ['microsoft', 'office365'];
                                    return !currentProviderCodes.includes(p.key);
                                  }).map((provider: Provider) => (
                                    <button
                                      key={provider.key}
                                      onClick={() => {
                                        disconnectProviderMutation.mutate();
                                        setSelectedKey(provider.key);
                                        setShowConnectDialog(true);
                                      }}
                                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors text-left"
                                      data-testid={`switch-provider-${provider.key}`}
                                    >
                                      <div className="flex items-center space-x-3">
                                        <Mail className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                          <p className="font-medium">{provider.display_name}</p>
                                          <p className="text-sm text-muted-foreground capitalize">{provider.category?.replace('_', ' ') || 'Unknown'}</p>
                                        </div>
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

                    <Button
                      variant="outline"
                      data-testid="button-change-server"
                      onClick={() => setShowConnectDialog(true)}
                    >
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
                      ) : rawProviders.length > 0 ? (
                        rawProviders.map((provider: EmailProvider) => (
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
              </TabsContent>

          {/* Signatures Tab */}
          <TabsContent value="signatures" className="space-y-6" data-testid="content-signatures">
            <SignatureManagement />
          </TabsContent>

          {/* Reminders Tab */}
          <TabsContent value="reminders" className="space-y-6" data-testid="content-reminders">
            <Card>
              <CardHeader>
                <CardTitle>About Reminders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Send automatic email reminders for your upcoming and past due documents. Document reminders will follow your set rules and do not need to be included in the workflow.
                </p>
                <p className="text-sm text-muted-foreground">
                  Reminder emails will not send if no due date is set.
                </p>
              </CardContent>
            </Card>

            {/* Questionnaire Reminders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Questionnaire Reminders</CardTitle>
                  <Switch data-testid="switch-questionnaire-reminders" />
                </div>
                <CardDescription>Set email reminders for questionnaires that are coming and past due.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Upcoming</h4>
                      <p className="text-sm text-muted-foreground">1 day before due date</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-questionnaire-upcoming">Edit</Button>
                      <Switch defaultChecked data-testid="switch-questionnaire-upcoming" />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Past Due</h4>
                      <p className="text-sm text-muted-foreground">1 day after due date; Repeat weekly; End after 12 occurrences</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-questionnaire-pastdue">Edit</Button>
                      <Switch defaultChecked data-testid="switch-questionnaire-pastdue" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quote Reminders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Quote Reminders</CardTitle>
                  <Switch data-testid="switch-quote-reminders" />
                </div>
                <CardDescription>Set email reminders for quotes that are coming and past due.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Upcoming</h4>
                      <p className="text-sm text-muted-foreground italic">1 day before due date (recommended)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-quote-upcoming">Edit</Button>
                      <Switch data-testid="switch-quote-upcoming" />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Past Due</h4>
                      <p className="text-sm text-muted-foreground italic">1 day after due date; Repeat monthly; End after 12 occurrences(recommended)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-quote-pastdue">Edit</Button>
                      <Switch data-testid="switch-quote-pastdue" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract Reminders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Contract Reminders</CardTitle>
                  <Switch defaultChecked data-testid="switch-contract-reminders" />
                </div>
                <CardDescription>Set email reminders for contracts that are coming and past due.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Upcoming</h4>
                      <p className="text-sm text-muted-foreground">1 day before due date</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-contract-upcoming">Edit</Button>
                      <Switch defaultChecked data-testid="switch-contract-upcoming" />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Past Due</h4>
                      <p className="text-sm text-muted-foreground">1 day after due date; Repeat weekly; End after 12 occurrences</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-contract-pastdue">Edit</Button>
                      <Switch defaultChecked data-testid="switch-contract-pastdue" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Reminders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Invoice Reminders</CardTitle>
                  <Switch defaultChecked data-testid="switch-invoice-reminders" />
                </div>
                <CardDescription>Set email reminders for invoices that are coming and past due.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Upcoming</h4>
                      <p className="text-sm text-muted-foreground">1 day before due date</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-invoice-upcoming">Edit</Button>
                      <Switch defaultChecked data-testid="switch-invoice-upcoming" />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Past Due</h4>
                      <p className="text-sm text-muted-foreground">1 day after due date; Repeat daily; End after 12 occurrences</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-invoice-pastdue">Edit</Button>
                      <Switch defaultChecked data-testid="switch-invoice-pastdue" />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Set reminder - Upcoming and Past Due</h4>
                      <p className="text-sm text-muted-foreground">Applies rules from Upcoming and Past Due individual settings.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid="button-edit-invoice-both">Edit</Button>
                      <Switch defaultChecked data-testid="switch-invoice-both" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Confirmations Tab */}
          <TabsContent value="confirmations" className="space-y-6" data-testid="content-confirmations">
            <Card>
              <CardHeader>
                <CardTitle>About Email Confirmations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  17hats will automatically send an email to your Client which confirms the completion of their document: Quote, Contract, Invoice, and Questionnaire. The email will automatically contain a link to their completed document.
                </p>
                <p className="text-sm text-muted-foreground">
                  If you do not want 17hats to send these email confirmations, turn off the functionality by deselecting the document below.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Document Confirmations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input 
                    type="checkbox" 
                    id="confirm-questionnaires" 
                    defaultChecked 
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="checkbox-confirm-questionnaires"
                  />
                  <Label htmlFor="confirm-questionnaires" className="text-sm font-normal cursor-pointer">
                    Send an email to the Client after they submit a Questionnaire.
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <input 
                    type="checkbox" 
                    id="confirm-quotes" 
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="checkbox-confirm-quotes"
                  />
                  <Label htmlFor="confirm-quotes" className="text-sm font-normal cursor-pointer">
                    Send an email to the Client after they accept a Quote.
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <input 
                    type="checkbox" 
                    id="confirm-contracts" 
                    defaultChecked 
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="checkbox-confirm-contracts"
                  />
                  <Label htmlFor="confirm-contracts" className="text-sm font-normal cursor-pointer">
                    Send an email to the Client after they sign a Contract.
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <input 
                    type="checkbox" 
                    id="confirm-invoices" 
                    defaultChecked 
                    className="h-4 w-4 rounded border-gray-300"
                    data-testid="checkbox-confirm-invoices"
                  />
                  <Label htmlFor="confirm-invoices" className="text-sm font-normal cursor-pointer">
                    Send an email to the Client after they pay an Invoice.
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
