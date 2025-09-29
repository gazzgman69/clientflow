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
import EmailOverviewTab from '@/components/settings/EmailOverviewTab';
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
  Layers,
  FileText,
  Edit,
  Info
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
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">
              <Info className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Activity className="h-4 w-4 mr-2" />
              Activity Logs
            </TabsTrigger>
            <TabsTrigger value="signatures">
              <FileText className="h-4 w-4 mr-2" />
              Signatures
            </TabsTrigger>
            {settings && (
              <TabsTrigger value="edit">
                <Edit className="h-4 w-4 mr-2" />
                Edit Settings
              </TabsTrigger>
            )}
            {!settings && (
              <TabsTrigger value="setup">
                <Settings className="h-4 w-4 mr-2" />
                Setup Email
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab - 17hats style */}
          <TabsContent value="overview" className="space-y-6">
            <EmailOverviewTab />
          </TabsContent>

          {/* Activity Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card data-testid="card-activity-logs">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Recent Activity
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

          {/* Signatures Tab */}
          <TabsContent value="signatures">
            <SignatureManagement />
          </TabsContent>

          {/* Edit Settings Tab */}
          {settings && (
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
          )}

          {/* Setup Tab (when no settings) */}
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

        {/* Email Setup Form Modal */}
        {showForm && (
          <MailForm 
            onSuccess={() => {
              setShowForm(false);
              setAlertMessage({ type: 'success', message: 'Email account configured successfully' });
              queryClient.invalidateQueries({ queryKey: ['mail-settings'] });
            }} 
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </div>
  );
}
