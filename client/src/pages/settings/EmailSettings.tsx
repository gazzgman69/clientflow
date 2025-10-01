import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Mail, 
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  Plus,
  Edit,
  Trash2,
  Star
} from 'lucide-react';
import RichTextEditor from '@/components/ui/rich-text-editor';

interface TenantEmailPrefs {
  tenantId: string;
  bccSelf: boolean;
  readReceipts: boolean;
  showOnDashboard: boolean;
  contactsOnly: boolean;
  updatedAt: Date;
}

interface EmailSignature {
  id: string;
  userId: string;
  name: string;
  content: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function EmailSettings() {
  const [activeTab, setActiveTab] = useState('settings');
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedSignature, setSelectedSignature] = useState<EmailSignature | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureForm, setSignatureForm] = useState({ name: '', content: '' });
  const [testEmailData, setTestEmailData] = useState({
    to: '',
    subject: 'Test Email from BusinessCRM',
    body: 'This is a test email to verify your email configuration is working correctly.',
    provider: 'gmail' as 'gmail' | 'microsoft' | 'smtp'
  });
  const [testEmailResult, setTestEmailResult] = useState<any>(null);

  // Fetch tenant email preferences
  const { data: prefsData } = useQuery({
    queryKey: ['/api/email/tenant-prefs']
  });

  // Fetch Gmail connection status
  const { data: gmailStatusData, isLoading: gmailStatusLoading } = useQuery({
    queryKey: ['/auth/google/gmail/status']
  });

  // Fetch Microsoft connection status
  const { data: microsoftStatusData, isLoading: microsoftStatusLoading } = useQuery({
    queryKey: ['/api/auth/microsoft/status']
  });

  // Fetch email signatures
  const { data: signaturesData, isLoading: signaturesLoading } = useQuery({
    queryKey: ['/api/signatures']
  });

  const prefs = (prefsData as any)?.prefs as TenantEmailPrefs;
  const gmailStatus = (gmailStatusData as any) || { ok: false, connected: false };
  const microsoftStatus = (microsoftStatusData as any) || { ok: false, connected: false };
  
  const connectedProvider = (gmailStatus.connected || gmailStatus.needsReconnect) ? 'gmail' : (microsoftStatus.connected || microsoftStatus.needsReconnect) ? 'microsoft' : null;
  const providerStatus = connectedProvider === 'gmail' ? gmailStatus : connectedProvider === 'microsoft' ? microsoftStatus : { ok: false, connected: false };
  const providerLoading = gmailStatusLoading || microsoftStatusLoading;

  const signatures = (signaturesData as any) || [];

  // Update preferences mutation
  const updatePrefsMutation = useMutation({
    mutationFn: async (updates: Partial<TenantEmailPrefs>) => {
      const response = await apiRequest('PUT', '/api/email/tenant-prefs', updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/tenant-prefs'] });
      setAlertMessage({ type: 'success', message: 'Settings updated successfully' });
    },
    onError: () => {
      setAlertMessage({ type: 'error', message: 'Failed to update settings' });
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
      queryClient.invalidateQueries({ queryKey: ['/auth/google/gmail/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/microsoft/status'] });
      setAlertMessage({ type: 'success', message: `${connectedProvider === 'gmail' ? 'Gmail' : 'Microsoft'} disconnected successfully` });
    },
    onError: () => {
      setAlertMessage({ type: 'error', message: 'Failed to disconnect provider' });
    }
  });

  // Create signature mutation
  const createSignatureMutation = useMutation({
    mutationFn: async (data: { name: string; content: string }) => {
      const response = await apiRequest('POST', '/api/signatures', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/signatures'] });
      setShowSignatureDialog(false);
      setSignatureForm({ name: '', content: '' });
      setAlertMessage({ type: 'success', message: 'Signature created successfully' });
    },
    onError: () => {
      setAlertMessage({ type: 'error', message: 'Failed to create signature' });
    }
  });

  // Update signature mutation
  const updateSignatureMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmailSignature> }) => {
      const response = await apiRequest('PATCH', `/api/signatures/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/signatures'] });
      setSelectedSignature(null);
      setAlertMessage({ type: 'success', message: 'Signature updated successfully' });
    },
    onError: () => {
      setAlertMessage({ type: 'error', message: 'Failed to update signature' });
    }
  });

  // Delete signature mutation
  const deleteSignatureMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/signatures/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/signatures'] });
      setSelectedSignature(null);
      setAlertMessage({ type: 'success', message: 'Signature deleted successfully' });
    },
    onError: () => {
      setAlertMessage({ type: 'error', message: 'Failed to delete signature' });
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

  // Connect Google with popup
  const connectGoogleWithPopup = () => {
    const origin = window.location.origin;
    const w = window.open(
      `/api/auth/google/start?popup=1&origin=${encodeURIComponent(origin)}`,
      'oauth-google',
      'width=520,height=700,menubar=0,toolbar=0,status=0'
    );

    function onMsg(ev: MessageEvent) {
      if (!ev?.data || ev.data.type !== 'oauth:connected' || ev.data.provider !== 'google') return;
      window.removeEventListener('message', onMsg);
      try { w?.close(); } catch {}
      
      queryClient.invalidateQueries({ queryKey: ['/auth/google/gmail/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email/provider-catalog/active'] });
      setAlertMessage({ type: 'success', message: 'Gmail connected successfully!' });
    }
    window.addEventListener('message', onMsg, { once: true });
  };

  // Connect Microsoft with popup
  const connectMicrosoftWithPopup = () => {
    const origin = window.location.origin;
    const w = window.open(
      `/api/auth/microsoft/start?popup=1&origin=${encodeURIComponent(origin)}`,
      'oauth-microsoft',
      'width=520,height=700,menubar=0,toolbar=0,status=0'
    );

    function onMsg(ev: MessageEvent) {
      if (!ev?.data || ev.data.type !== 'oauth:connected' || ev.data.provider !== 'microsoft') return;
      window.removeEventListener('message', onMsg);
      try { w?.close(); } catch {}
      
      queryClient.invalidateQueries({ queryKey: ['/api/auth/microsoft/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email/provider-catalog/active'] });
      setAlertMessage({ type: 'success', message: 'Microsoft account connected successfully!' });
    }
    window.addEventListener('message', onMsg, { once: true });
  };

  // Format last synced date
  const formatLastSynced = () => {
    if (!providerStatus.lastSyncAt) return 'Never';
    const date = new Date(providerStatus.lastSyncAt);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    }) + ' at ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    });
  };

  // Clear alert after 5 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  return (
    <div className="p-6 overflow-y-auto" data-testid="email-settings-page">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Email Settings</h1>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            <TabsTrigger value="signatures" data-testid="tab-signatures">Signatures</TabsTrigger>
            <TabsTrigger value="reminders" data-testid="tab-reminders">Reminders</TabsTrigger>
            <TabsTrigger value="confirmations" data-testid="tab-confirmations">Confirmations</TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* About Email Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold uppercase tracking-wide">About Email Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  BusinessCRM can connect to your email account and sync with your email data that is related to Contacts with Projects within your brand.
                </p>
                <p className="text-sm text-muted-foreground">
                  Once connected, you'll be able to interact with client email within each individual Project.
                </p>
              </CardContent>
            </Card>

            {/* Incoming Email */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Incoming Email</CardTitle>
                {!providerStatus.connected && (
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={connectGoogleWithPopup}
                    data-testid="button-connect-account"
                  >
                    Connect Account
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Incoming Email Account Status */}
                <div className="space-y-3">
                  <Label className="font-semibold">Incoming Email Account(s):</Label>
                  <div className="flex items-center gap-3">
                    {providerLoading ? (
                      <span className="text-sm text-muted-foreground">Checking...</span>
                    ) : providerStatus.connected ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm">
                          Last synced {providerStatus.email || 'info@clubkudo.com'} {formatLastSynced()}
                        </span>
                        <select 
                          className="ml-auto h-9 px-3 border border-input rounded-md text-sm"
                          value={connectedProvider || ''}
                          onChange={() => {}}
                          data-testid="select-email-account"
                        >
                          <option value={connectedProvider || ''}>
                            {providerStatus.email || (connectedProvider === 'gmail' ? 'Gmail Account' : 'Microsoft Account')}
                          </option>
                        </select>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">No email account connected</span>
                    )}
                  </div>
                  
                  {(providerStatus.connected || providerStatus.needsReconnect) && (
                    <div className="flex gap-2 pt-2">
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
                    </div>
                  )}
                </div>

                <Separator />

                {/* Show emails on dashboard toggle */}
                <div className="space-y-3">
                  <Label className="font-semibold">Show emails on dashboard:</Label>
                  <div className="flex items-center space-x-3">
                    <Switch
                      checked={prefs?.showOnDashboard ?? false}
                      onCheckedChange={(checked) => updatePrefsMutation.mutate({ showOnDashboard: checked })}
                      data-testid="switch-show-on-dashboard"
                    />
                    <Label className="text-sm font-normal text-muted-foreground">
                      Show any emails from contacts that you may have to respond to on your dashboard screen
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Email Preferences</CardTitle>
                <CardDescription>Configure how emails are sent and received</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="bcc-self">BCC you on all outgoing mail</Label>
                      <p className="text-xs text-muted-foreground">Receive a copy of every email you send</p>
                    </div>
                    <Switch
                      id="bcc-self"
                      checked={prefs?.bccSelf ?? false}
                      onCheckedChange={(checked) => updatePrefsMutation.mutate({ bccSelf: checked })}
                      data-testid="switch-bcc-self"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="read-receipts">Enable Read Receipts</Label>
                      <p className="text-xs text-muted-foreground">May increase spam score</p>
                    </div>
                    <Switch
                      id="read-receipts"
                      checked={prefs?.readReceipts ?? false}
                      onCheckedChange={(checked) => updatePrefsMutation.mutate({ readReceipts: checked })}
                      data-testid="switch-read-receipts"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="contacts-only">Sync Contacts-Only Emails</Label>
                      <p className="text-xs text-muted-foreground">Only sync emails from known contacts</p>
                    </div>
                    <Switch
                      id="contacts-only"
                      checked={prefs?.contactsOnly ?? false}
                      onCheckedChange={(checked) => updatePrefsMutation.mutate({ contactsOnly: checked })}
                      data-testid="switch-contacts-only"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Send Test Email */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Send Test Email</CardTitle>
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
                    fromEmail: providerStatus.email
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
                            <p><span className="font-medium">Timestamp:</span> {new Date(testEmailResult.testDetails.timestamp).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signatures Tab */}
          <TabsContent value="signatures" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Email Signatures</CardTitle>
                <CardDescription>
                  The first signature in the list will be used as the default. To change the order, drag and drop. For more guidance please check out our article in the Help Center.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  {/* Left side - Signatures list */}
                  <div className="space-y-3">
                    {signaturesLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading signatures...</div>
                    ) : signatures.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No signatures yet</p>
                        <p className="text-sm mt-2">Click "Add New Signature" to create one</p>
                      </div>
                    ) : (
                      <>
                        {signatures.map((sig: EmailSignature, index: number) => (
                          <div
                            key={sig.id}
                            className={`flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                              selectedSignature?.id === sig.id ? 'bg-muted border-primary' : ''
                            }`}
                            onClick={() => setSelectedSignature(sig)}
                            data-testid={`signature-item-${sig.id}`}
                          >
                            <span className="text-sm font-medium flex-1">{sig.name}</span>
                            {index === 0 && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                          </div>
                        ))}
                      </>
                    )}
                    
                    <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
                      <DialogTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          data-testid="button-add-signature"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Signature
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Create Email Signature</DialogTitle>
                          <DialogDescription>Add a new email signature</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="signature-name">Signature Name</Label>
                            <Input
                              id="signature-name"
                              value={signatureForm.name}
                              onChange={(e) => setSignatureForm({ ...signatureForm, name: e.target.value })}
                              placeholder="e.g., Professional, Personal"
                              data-testid="input-signature-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="signature-content">Signature Content</Label>
                            <Textarea
                              id="signature-content"
                              value={signatureForm.content}
                              onChange={(e) => setSignatureForm({ ...signatureForm, content: e.target.value })}
                              rows={6}
                              placeholder="Enter your signature content..."
                              data-testid="textarea-signature-content"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowSignatureDialog(false);
                              setSignatureForm({ name: '', content: '' });
                            }}
                            data-testid="button-cancel-signature"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => createSignatureMutation.mutate(signatureForm)}
                            disabled={!signatureForm.name || !signatureForm.content || createSignatureMutation.isPending}
                            data-testid="button-save-signature"
                          >
                            {createSignatureMutation.isPending ? 'Saving...' : 'Save Signature'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Right side - Signature preview/edit */}
                  <div className="border-2 border-dashed rounded-lg p-6 min-h-[300px] flex items-center justify-center">
                    {selectedSignature ? (
                      <div className="w-full space-y-4">
                        <div>
                          <Label className="text-sm font-semibold">Name</Label>
                          <Input
                            value={selectedSignature.name}
                            onChange={(e) => setSelectedSignature({ ...selectedSignature, name: e.target.value })}
                            data-testid="input-edit-signature-name"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold">Content</Label>
                          <Textarea
                            value={selectedSignature.content}
                            onChange={(e) => setSelectedSignature({ ...selectedSignature, content: e.target.value })}
                            rows={8}
                            data-testid="textarea-edit-signature-content"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateSignatureMutation.mutate({ 
                              id: selectedSignature.id, 
                              data: { name: selectedSignature.name, content: selectedSignature.content } 
                            })}
                            disabled={updateSignatureMutation.isPending}
                            data-testid="button-update-signature"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {updateSignatureMutation.isPending ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this signature?')) {
                                deleteSignatureMutation.mutate(selectedSignature.id);
                              }
                            }}
                            disabled={deleteSignatureMutation.isPending}
                            data-testid="button-delete-signature"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center">Select a signature to edit.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reminders Tab */}
          <TabsContent value="reminders" className="space-y-6">
            {/* About Reminders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold uppercase tracking-wide">About Reminders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Questionnaire Reminders</CardTitle>
                <Switch defaultChecked data-testid="switch-questionnaire-reminders" />
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set email reminders for questionnaires that are coming and past due.
                </p>
                
                {/* Upcoming Reminder */}
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Upcoming</h4>
                    <Switch defaultChecked data-testid="switch-questionnaire-upcoming" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>1 day before due date</span>
                    <Button variant="ghost" size="sm" data-testid="button-edit-questionnaire-upcoming">Edit</Button>
                  </div>
                </div>

                {/* Past Due Reminder */}
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Past Due</h4>
                    <Switch defaultChecked data-testid="switch-questionnaire-past-due" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>1 day after due date; Repeat weekly; End after 12 occurrences</span>
                    <Button variant="ghost" size="sm" data-testid="button-edit-questionnaire-past-due">Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quote Reminders */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Quote Reminders</CardTitle>
                <Switch data-testid="switch-quote-reminders" />
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set email reminders for quotes that are coming and past due.
                </p>
                
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Upcoming</h4>
                    <Switch data-testid="switch-quote-upcoming" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>1 day before due date (recommended)</span>
                    <Button variant="ghost" size="sm" disabled>Edit</Button>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Past Due</h4>
                    <Switch data-testid="switch-quote-past-due" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>1 day after due date; Repeat monthly; End after 12 occurrences(recommended)</span>
                    <Button variant="ghost" size="sm" disabled>Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract Reminders */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Contract Reminders</CardTitle>
                <Switch defaultChecked data-testid="switch-contract-reminders" />
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set email reminders for contracts that are coming and past due.
                </p>
                
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Upcoming</h4>
                    <Switch defaultChecked data-testid="switch-contract-upcoming" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>1 day before due date</span>
                    <Button variant="ghost" size="sm" data-testid="button-edit-contract-upcoming">Edit</Button>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Past Due</h4>
                    <Switch defaultChecked data-testid="switch-contract-past-due" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>1 day after due date; Repeat weekly; End after 12 occurrences</span>
                    <Button variant="ghost" size="sm" data-testid="button-edit-contract-past-due">Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Reminders */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Invoice Reminders</CardTitle>
                <Switch defaultChecked data-testid="switch-invoice-reminders" />
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set email reminders for invoices that are coming and past due.
                </p>
                
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Upcoming</h4>
                    <Switch defaultChecked data-testid="switch-invoice-upcoming" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>1 day before due date</span>
                    <Button variant="ghost" size="sm" data-testid="button-edit-invoice-upcoming">Edit</Button>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Past Due</h4>
                    <Switch defaultChecked data-testid="switch-invoice-past-due" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>1 day after due date; Repeat daily; End after 12 occurrences</span>
                    <Button variant="ghost" size="sm" data-testid="button-edit-invoice-past-due">Edit</Button>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Set reminder - Upcoming and Past Due</h4>
                    <Switch defaultChecked data-testid="switch-invoice-both" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Applies rules from Upcoming and Past Due individual settings.</span>
                    <Button variant="ghost" size="sm" data-testid="button-edit-invoice-both">Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Confirmations Tab */}
          <TabsContent value="confirmations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-bold uppercase tracking-wide">Confirmations</CardTitle>
                <CardDescription>
                  Confirmation settings will be available in a future update
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">
                  Email confirmations and notifications will be configured here
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
