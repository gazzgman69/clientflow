import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MailForm } from '@/components/settings/MailForm';
import SignatureManagement from '@/components/settings/SignatureManagement';
import EmailProviderList from '@/components/settings/EmailProviderList';
import { apiRequest } from '@/lib/queryClient';
import { 
  Mail, 
  RefreshCw, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';

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
  lastTestError?: string;
  quotaUsed: number;
  quotaLimit: number;
  quotaResetAt?: string;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

interface AuditLog {
  id: string;
  kind: string;
  ok: boolean;
  error?: string;
  durationMs: number;
  createdAt: string;
  meta?: string;
}

export default function EmailSettings() {
  const [showForm, setShowForm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testEmailData, setTestEmailData] = useState({
    to: '',
    subject: 'Test Email from CRM',
    body: 'This is a test email to verify your email provider configuration is working correctly.',
    provider: 'gmail' as 'gmail' | 'microsoft' | 'smtp'
  });
  const [testEmailError, setTestEmailError] = useState('');
  const [testEmailResult, setTestEmailResult] = useState<any>(null);
  const [showRawError, setShowRawError] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current mail settings
  const { data: settingsData, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['/api/settings/mail/current']
  });

  // Fetch audit logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['/api/settings/mail/logs?limit=20']
  });

  // Fetch Gmail authentication status
  const { data: gmailAuthData, isLoading: gmailAuthLoading } = useQuery({
    queryKey: ['/api/auth/google/gmail/status'],
    enabled: (settingsData as any)?.settings?.provider === 'gmail'
  });

  // Fetch Microsoft authentication status  
  const { data: microsoftAuthData, isLoading: microsoftAuthLoading } = useQuery({
    queryKey: ['/api/auth/microsoft/mail/status'],
    enabled: (settingsData as any)?.settings?.provider === 'microsoft'
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/settings/mail/test');
      return response.json();
    },
    onSuccess: (data) => {
      setAlertMessage({
        type: data.success ? 'success' : 'error',
        message: data.message || (data.success ? 'Connection test successful' : 'Connection test failed')
      });
      queryClient.invalidateQueries({ queryKey: ['mail-settings'] });
    },
    onError: (error) => {
      setAlertMessage({
        type: 'error',
        message: 'Failed to test connection'
      });
    }
  });

  // Send test email mutation
  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/settings/mail/send-test');
      return response.json();
    },
    onSuccess: (data) => {
      setAlertMessage({
        type: data.success ? 'success' : 'error',
        message: data.message || (data.success ? 'Test email sent successfully' : 'Failed to send test email')
      });
      queryClient.invalidateQueries({ queryKey: ['mail-settings'] });
    },
    onError: (error) => {
      setAlertMessage({
        type: 'error',
        message: 'Failed to send test email'
      });
    }
  });

  // Debug test email mutation (calls the new debug endpoint)
  const debugTestEmailMutation = useMutation({
    mutationFn: async (data: { to: string; provider: string; fromEmail?: string }) => {
      const response = await apiRequest('POST', '/api/email/debug/send-test-email', data);
      return response.json();
    },
    onSuccess: (data) => {
      setTestEmailResult(data);
      setTestEmailError('');
    },
    onError: (error: any) => {
      setTestEmailError(error.message || 'Failed to send test email');
      setTestEmailResult(null);
    }
  });

  const settings = (settingsData as any)?.settings as MailSettings | null;
  const logs = (logsData as any)?.logs as AuditLog[] || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getQuotaColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 80) return 'text-orange-600';
    return 'text-green-600';
  };

  const getStatusIcon = (result?: string) => {
    if (result === 'ok') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (result === 'fail') return <XCircle className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const handleSendTestEmail = () => {
    // Validate required fields
    if (!testEmailData.to.trim()) {
      setTestEmailError('Email address is required');
      return;
    }
    
    setTestEmailError('');
    setTestEmailResult(null);
    
    debugTestEmailMutation.mutate({
      to: testEmailData.to,
      provider: testEmailData.provider,
      fromEmail: (settingsData as any)?.settings?.fromEmail
    });
  };

  // Re-authenticate with OAuth providers
  const handleReAuthenticate = () => {
    if (!(settingsData as any)?.settings?.provider) return;
    
    const returnTo = encodeURIComponent('/settings');
    
    switch ((settingsData as any)?.settings?.provider) {
      case 'gmail':
        // Redirect to Gmail OAuth with required scopes
        window.location.href = `/auth/google/gmail?returnTo=${returnTo}&popup=false`;
        break;
      case 'microsoft':
        // Redirect to Microsoft OAuth with mail scopes  
        window.location.href = `/auth/microsoft/mail?returnTo=${returnTo}&popup=false`;
        break;
      default:
        setAlertMessage({
          type: 'error',
          message: 'Re-authentication not available for this provider'
        });
    }
  };

  // Get authentication status for current provider
  const getAuthStatus = () => {
    if (!(settingsData as any)?.settings?.provider) return null;
    
    switch ((settingsData as any)?.settings?.provider) {
      case 'gmail':
        return gmailAuthData;
      case 'microsoft':  
        return microsoftAuthData;
      default:
        return null;
    }
  };

  // Check if scopes are missing
  const hasMissingScopes = () => {
    const authStatus = getAuthStatus();
    if (!authStatus || !authStatus.connected) return false;
    
    const scopes = authStatus.scopes || [];
    
    if ((settingsData as any)?.settings?.provider === 'gmail') {
      const requiredScopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send'
      ];
      return !requiredScopes.every(scope => scopes.includes(scope));
    }
    
    if ((settingsData as any)?.settings?.provider === 'microsoft') {
      const requiredScopes = ['Mail.Read', 'Mail.Send'];
      return !requiredScopes.every(scope => scopes.includes(scope));
    }
    
    return false;
  };

  // Clear alert after 5 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  if (settingsLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-2 mb-6">
            <Mail className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Email Settings</h1>
          </div>
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded mb-4"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto" data-testid="email-settings-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Mail className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Email Settings</h1>
          </div>
          {!settings && (
            <Button 
              onClick={() => setShowForm(true)} 
              data-testid="button-add-email-account"
            >
              <Settings className="h-4 w-4 mr-2" />
              Add Email Account
            </Button>
          )}
        </div>

        {/* Alert Messages */}
        {alertMessage && (
          <Alert className={`mb-6 ${alertMessage.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className={alertMessage.type === 'error' ? 'text-red-800' : 'text-green-800'}>
              {alertMessage.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Display */}
        <Tabs defaultValue="providers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="providers">
              <Layers className="h-4 w-4 mr-2" />
              Email Providers
            </TabsTrigger>
            {settings && <TabsTrigger value="overview">Overview</TabsTrigger>}
            {settings && <TabsTrigger value="logs">Activity Logs</TabsTrigger>}
            <TabsTrigger value="signatures">Signatures</TabsTrigger>
            {settings && <TabsTrigger value="edit">Edit Settings</TabsTrigger>}
            {!settings && <TabsTrigger value="setup">Setup Email</TabsTrigger>}
          </TabsList>

          {/* Email Providers Tab */}
          <TabsContent value="providers" className="space-y-6">
            <EmailProviderList />
          </TabsContent>

          {settings && (
            <>
              <TabsContent value="overview" className="space-y-6">
                {/* Status Overview */}
                <Card data-testid="card-email-status">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Email Account Status</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={settings.isActive ? 'default' : 'secondary'}>
                          {settings.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {settings.isDefault && (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Account Name</label>
                        <p className="text-sm font-mono" data-testid="text-account-name">{settings.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Provider</label>
                        <p className="text-sm" data-testid="text-provider">{settings.provider || 'Custom'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">From Email</label>
                        <p className="text-sm font-mono" data-testid="text-from-email">{settings.fromEmail || 'Not set'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Sync Interval</label>
                        <p className="text-sm" data-testid="text-sync-interval">{settings.syncIntervalMinutes} minutes</p>
                      </div>
                    </div>

                    <Separator />

                    {/* OAuth Status Warning for Missing Scopes */}
                    {(settings.provider === 'gmail' || settings.provider === 'microsoft') && hasMissingScopes() && (
                      <Alert className="border-yellow-200 bg-yellow-50">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-800">
                          <strong>Missing permissions:</strong> Some email features may not work correctly. 
                          Please re-authenticate to grant all required permissions.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* OAuth Authentication Status */}
                    {(settings.provider === 'gmail' || settings.provider === 'microsoft') && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getAuthStatus()?.connected ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : getAuthStatus()?.needsReconnect ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-sm font-medium">OAuth Authentication</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            {getAuthStatus()?.connected ? (
                              <p className="text-sm text-green-600" data-testid="text-oauth-status">
                                Connected
                              </p>
                            ) : getAuthStatus()?.needsReconnect ? (
                              <p className="text-sm text-yellow-600" data-testid="text-oauth-status">
                                Needs Re-authentication
                              </p>
                            ) : (
                              <p className="text-sm text-red-600" data-testid="text-oauth-status">
                                Not Connected
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={handleReAuthenticate}
                            variant="outline"
                            size="sm"
                            data-testid="button-re-authenticate"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Re-Authenticate
                          </Button>
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Connection Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(settings.lastTestResult)}
                        <span className="text-sm font-medium">Connection Status</span>
                      </div>
                      <div className="text-right">
                        {settings.lastTestedAt ? (
                          <div>
                            <p className="text-sm" data-testid="text-last-tested">
                              Last tested: {formatDate(settings.lastTestedAt)}
                            </p>
                            {settings.lastTestResult === 'fail' && settings.lastTestError && (
                              <p className="text-xs text-red-600 mt-1" data-testid="text-test-error">
                                {settings.lastTestError}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500" data-testid="text-not-tested">Not tested yet</p>
                        )}
                      </div>
                    </div>

                    {/* Quota Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Daily Quota Usage</span>
                      <div className="text-right">
                        <p className={`text-sm font-mono ${getQuotaColor(settings.quotaUsed, settings.quotaLimit)}`} data-testid="text-quota-usage">
                          {settings.quotaUsed} / {settings.quotaLimit}
                        </p>
                        <p className="text-xs text-gray-500">
                          Resets: {settings.quotaResetAt ? formatDate(settings.quotaResetAt) : 'Not set'}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-3 pt-4">
                      <Button
                        onClick={() => testConnectionMutation.mutate()}
                        disabled={testConnectionMutation.isPending}
                        variant="outline"
                        data-testid="button-test-connection"
                      >
                        {testConnectionMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Test Connection
                      </Button>

                      <Button
                        onClick={() => sendTestMutation.mutate()}
                        disabled={sendTestMutation.isPending || !settings.fromEmail}
                        variant="outline"
                        data-testid="button-send-test-email"
                      >
                        {sendTestMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Send Test Email
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Test Email Card */}
                <Card data-testid="card-test-email">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Send className="h-5 w-5" />
                      <span>Send Test Email</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Send a test email to verify real provider delivery and see detailed provider responses.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="test-email-to">To Email Address *</Label>
                        <Input
                          id="test-email-to"
                          type="email"
                          placeholder="recipient@example.com"
                          value={testEmailData.to}
                          onChange={(e) => setTestEmailData(prev => ({ ...prev, to: e.target.value }))}
                          data-testid="input-test-email-to"
                        />
                        {testEmailError && (
                          <p className="text-sm text-red-600" data-testid="text-test-email-error">
                            {testEmailError}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="test-email-provider">Provider</Label>
                        <Select 
                          value={testEmailData.provider} 
                          onValueChange={(value: 'gmail' | 'microsoft' | 'smtp') => 
                            setTestEmailData(prev => ({ ...prev, provider: value }))
                          }
                        >
                          <SelectTrigger data-testid="select-test-email-provider">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gmail">Gmail (OAuth)</SelectItem>
                            <SelectItem value="microsoft">Microsoft (Graph)</SelectItem>
                            <SelectItem value="smtp">SMTP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="test-email-subject">Subject</Label>
                      <Input
                        id="test-email-subject"
                        value={testEmailData.subject}
                        onChange={(e) => setTestEmailData(prev => ({ ...prev, subject: e.target.value }))}
                        data-testid="input-test-email-subject"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="test-email-body">Message</Label>
                      <Textarea
                        id="test-email-body"
                        rows={3}
                        value={testEmailData.body}
                        onChange={(e) => setTestEmailData(prev => ({ ...prev, body: e.target.value }))}
                        data-testid="textarea-test-email-body"
                      />
                    </div>

                    <Button
                      onClick={handleSendTestEmail}
                      disabled={debugTestEmailMutation.isPending}
                      data-testid="button-send-test-email-debug"
                    >
                      {debugTestEmailMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Test Email
                    </Button>

                    {/* Result Panel */}
                    {testEmailResult && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg" data-testid="panel-test-email-result">
                        <h4 className="font-medium mb-2">Test Result</h4>
                        
                        {/* From Mismatch Warning */}
                        {testEmailResult.appResult?.fromMismatch && (
                          <Alert className="mb-3 border-yellow-200 bg-yellow-50">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-800">
                              <strong>From header mismatch:</strong> Using authenticated account with replyTo fallback ({testEmailResult.testDetails?.fromEmailRequested})
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Success Display */}
                        {testEmailResult.providerResponse?.ok ? (
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <div className="flex-1">
                                <p className="font-medium text-green-800">Email sent successfully!</p>
                                <p className="text-sm text-green-700">
                                  Provider: {testEmailResult.providerResponse.provider} • 
                                  Status: {testEmailResult.providerResponse.status}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              {testEmailResult.providerResponse.messageId && (
                                <div className="flex justify-between">
                                  <span className="font-medium">Message ID:</span>
                                  <span className="font-mono text-xs" data-testid="text-result-message-id">
                                    {testEmailResult.providerResponse.messageId}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="font-medium">Sent:</span>
                                <span data-testid="text-result-timestamp">
                                  {formatDate(testEmailResult.testDetails?.timestamp || new Date().toISOString())}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Error Display */
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <XCircle className="h-5 w-5 text-red-600" />
                              <div className="flex-1">
                                <p className="font-medium text-red-800">Email delivery failed</p>
                                <p className="text-sm text-red-700">
                                  Provider: {testEmailResult.providerResponse?.provider} • 
                                  Error Type: {testEmailResult.providerResponse?.errorType}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="font-medium">Error Message:</span>
                                <span className="text-red-600 text-right max-w-xs" data-testid="text-result-error-message">
                                  {testEmailResult.providerResponse?.errorMessage}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">Failed:</span>
                                <span data-testid="text-result-timestamp">
                                  {formatDate(testEmailResult.testDetails?.timestamp || new Date().toISOString())}
                                </span>
                              </div>
                            </div>

                            {/* Expandable Raw Error Details */}
                            {testEmailResult.providerResponse?.raw && (
                              <div className="border-t pt-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowRawError(!showRawError)}
                                  className="text-xs p-1 h-auto"
                                  data-testid="button-toggle-raw-error"
                                >
                                  {showRawError ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Hide raw error details
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Show raw error details
                                    </>
                                  )}
                                </Button>
                                
                                {showRawError && (
                                  <div className="mt-2 p-2 bg-gray-100 rounded text-xs" data-testid="panel-raw-error-details">
                                    <pre className="whitespace-pre-wrap break-words font-mono">
                                      {JSON.stringify(testEmailResult.providerResponse.raw, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="space-y-6">
                {/* Activity Logs */}
                <Card data-testid="card-activity-logs">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="h-5 w-5" />
                      <span>Recent Activity</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {logsLoading ? (
                      <div className="animate-pulse space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-12 bg-gray-200 rounded"></div>
                        ))}
                      </div>
                    ) : logs.length > 0 ? (
                      <div className="space-y-2">
                        {logs.map((log) => (
                          <div 
                            key={log.id} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                            data-testid={`log-entry-${log.kind}`}
                          >
                            <div className="flex items-center space-x-3">
                              {log.ok ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <div>
                                <p className="text-sm font-medium capitalize">
                                  {log.kind.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                </p>
                                {log.error && (
                                  <p className="text-xs text-red-600">{log.error}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500" data-testid="text-log-time">
                                {formatDate(log.createdAt)}
                              </p>
                              {log.durationMs > 0 && (
                                <p className="text-xs text-gray-400">{log.durationMs}ms</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8" data-testid="text-no-logs">
                        No activity logs found
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="edit">
                <MailForm 
                  initialData={settings} 
                  onSuccess={() => {
                    setAlertMessage({ type: 'success', message: 'Email settings updated successfully' });
                    queryClient.invalidateQueries({ queryKey: ['mail-settings'] });
                  }} 
                  onCancel={() => {}}
                />
              </TabsContent>
            </>
          )}

          <TabsContent value="signatures">
            <SignatureManagement />
          </TabsContent>

          {!settings && (
            <TabsContent value="setup">
              <Card data-testid="card-no-settings">
                <CardContent className="text-center py-12">
                  <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Email Account Configured</h3>
                  <p className="text-gray-600 mb-6">
                    Set up your email account to enable email sync, sending, and automated workflows.
                  </p>
                  <Button 
                    onClick={() => setShowForm(true)}
                    size="lg"
                    data-testid="button-setup-email"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Setup Email Account
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Mail Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <MailForm
                  onSuccess={() => {
                    setShowForm(false);
                    setAlertMessage({ type: 'success', message: 'Email settings saved successfully' });
                    queryClient.invalidateQueries({ queryKey: ['mail-settings'] });
                  }}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}