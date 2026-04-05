import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { EMAIL_PROVIDERS, getProviderById, type EmailProvider, type ProviderPreset } from '@shared/emailProviders';
import { 
  Search, 
  RefreshCw, 
  Save, 
  X, 
  AlertTriangle,
  CheckCircle,
  Mail,
  Server,
  Shield
} from 'lucide-react';

const mailFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.string().optional(),
  
  // IMAP settings
  imapHost: z.string().optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUsername: z.string().optional(),
  imapPassword: z.string().optional(),
  imapSecurity: z.enum(['ssl', 'starttls', 'none']).optional(),
  
  // SMTP settings
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecurity: z.enum(['ssl', 'starttls', 'none']).optional(),
  
  // Email identity
  fromName: z.string().optional(),
  fromEmail: z.string().email('Invalid email address').optional(),
  replyToEmail: z.string().email('Invalid reply-to email').optional(),
  
  // Settings
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  syncIntervalMinutes: z.number().int().min(1).max(15).optional()
});

type MailFormData = z.infer<typeof mailFormSchema>;

interface MailFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

// Provider presets are now imported from shared/emailProviders.ts

export function MailForm({ initialData, onSuccess, onCancel }: MailFormProps) {
  const [autoDetectEmail, setAutoDetectEmail] = useState('');
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const form = useForm<MailFormData>({
    resolver: zodResolver(mailFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      provider: initialData?.provider || '',
      imapHost: initialData?.imapHost || '',
      imapPort: initialData?.imapPort || 993,
      imapUsername: initialData?.imapUsername || '',
      imapPassword: '',
      imapSecurity: initialData?.imapSecurity || 'ssl',
      smtpHost: initialData?.smtpHost || '',
      smtpPort: initialData?.smtpPort || 587,
      smtpUsername: initialData?.smtpUsername || '',
      smtpPassword: '',
      smtpSecurity: initialData?.smtpSecurity || 'starttls',
      fromName: initialData?.fromName || '',
      fromEmail: initialData?.fromEmail || '',
      replyToEmail: initialData?.replyToEmail || '',
      isActive: initialData?.isActive ?? true,
      isDefault: initialData?.isDefault ?? true,
      syncIntervalMinutes: initialData?.syncIntervalMinutes || 5
    }
  });

  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | ''>(
    (initialData?.provider as EmailProvider) || ''
  );
  const selectedPreset = selectedProvider ? getProviderById(selectedProvider) : null;

  // Auto-detect settings mutation
  const autoDetectMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('POST', '/api/settings/mail/detect', { email });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.settings) {
        const settings = data.settings;
        form.setValue('name', settings.name);
        form.setValue('provider', settings.provider);
        form.setValue('fromEmail', settings.fromEmail);
        form.setValue('imapHost', settings.imapHost);
        form.setValue('imapPort', settings.imapPort);
        form.setValue('imapSecurity', settings.imapSecurity);
        form.setValue('smtpHost', settings.smtpHost);
        form.setValue('smtpPort', settings.smtpPort);
        form.setValue('smtpSecurity', settings.smtpSecurity);
        
        setAlertMessage({
          type: 'success',
          message: 'Settings auto-detected successfully! Please verify and enter your credentials.'
        });
      } else {
        setAlertMessage({
          type: 'error',
          message: data.error || 'Could not auto-detect settings for this email'
        });
      }
    },
    onError: () => {
      setAlertMessage({
        type: 'error',
        message: 'Failed to auto-detect settings'
      });
    }
  });

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: MailFormData) => {
      const response = await apiRequest('POST', '/api/settings/mail/save', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setAlertMessage({ type: 'success', message: 'Settings saved and tested successfully!' });
        setTimeout(() => onSuccess(), 1500);
      } else {
        setAlertMessage({ type: 'error', message: data.error || 'Failed to save settings' });
      }
    },
    onError: () => {
      setAlertMessage({ type: 'error', message: 'Failed to save settings' });
    }
  });

  // OAuth status queries
  const { data: googleStatus } = useQuery({
    queryKey: ['/api/auth/google/status'],
    enabled: selectedProvider === 'gmail'
  });
  
  const { data: microsoftStatus } = useQuery({
    queryKey: ['/api/auth/microsoft/status'],
    enabled: selectedProvider === 'microsoft'
  });

  const handleProviderSelect = (providerId: EmailProvider) => {
    const preset = getProviderById(providerId);
    if (preset) {
      setSelectedProvider(providerId);
      form.setValue('provider', providerId);
      
      if (preset.type === 'imap_smtp' && preset.imap && preset.smtp) {
        // Apply IMAP/SMTP presets
        form.setValue('imapHost', preset.imap.host || '');
        form.setValue('imapPort', preset.imap.port || 993);
        form.setValue('imapSecurity', preset.imap.secure ? 'ssl' : 'starttls');
        form.setValue('smtpHost', preset.smtp.host || '');
        form.setValue('smtpPort', preset.smtp.port || 587);
        form.setValue('smtpSecurity', preset.smtp.secure ? 'ssl' : 'starttls');
        
        setAlertMessage({
          type: 'success',
          message: `${preset.label} settings applied! Please enter your credentials.`
        });
      } else if (preset.type === 'oauth') {
        setAlertMessage({
          type: 'success',
          message: `${preset.label} selected. Use the Connect button to authorize.`
        });
      }
    }
  };
  
  const handleOAuthConnect = (provider: 'gmail' | 'microsoft') => {
    if (provider === 'gmail') {
      window.open('/auth/google/gmail?popup=true', 'gmail-auth', 'width=500,height=600');
    } else if (provider === 'microsoft') {
      // Microsoft OAuth flow would go here
      setAlertMessage({
        type: 'error',
        message: 'Microsoft OAuth connection coming soon'
      });
    }
  };

  const handleAutoDetect = () => {
    if (autoDetectEmail) {
      autoDetectMutation.mutate(autoDetectEmail);
    }
  };

  const onSubmit = (data: MailFormData) => {
    saveMutation.mutate(data);
  };

  // Clear alert after 5 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  return (
    <div data-testid="mail-form">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>{initialData ? 'Edit Email Settings' : 'Add Email Account'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Alert Messages */}
          {alertMessage && (
            <Alert className={`${alertMessage.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className={alertMessage.type === 'error' ? 'text-red-800' : 'text-green-800'}>
                {alertMessage.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Auto-detect Section */}
          {!initialData && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium mb-3 flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <span>Auto-Detect Settings</span>
              </h4>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter your email address"
                  value={autoDetectEmail}
                  onChange={(e) => setAutoDetectEmail(e.target.value)}
                  data-testid="input-autodetect-email"
                />
                <Button
                  type="button"
                  onClick={handleAutoDetect}
                  disabled={!autoDetectEmail || autoDetectMutation.isPending}
                  variant="outline"
                  data-testid="button-autodetect"
                >
                  {autoDetectMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                We'll try to automatically configure your email settings based on your email provider.
              </p>
            </div>
          )}

          {/* Provider Selection */}
          {!initialData && (
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3">Select Email Provider</h4>
              <div className="grid grid-cols-2 gap-2">
                {EMAIL_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.id}
                    type="button"
                    variant={selectedProvider === provider.id ? "default" : "outline"}
                    onClick={() => handleProviderSelect(provider.id)}
                    data-testid={`button-provider-${provider.id}`}
                    className="text-left flex flex-col items-start p-3 h-auto"
                  >
                    <span className="font-medium">{provider.label}</span>
                    {provider.notes && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {provider.notes}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Account Information</h4>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., Primary Email, Support Email"
                          data-testid="input-account-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fromName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Your Name or Business"
                            data-testid="input-from-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fromEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Email</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="you@example.com"
                            type="email"
                            data-testid="input-from-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="replyToEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reply-To Email (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="reply@example.com"
                            type="email"
                            data-testid="input-reply-to-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="syncIntervalMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sync Interval (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            min={1}
                            max={15}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-sync-interval"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* OAuth Connection Section */}
              {selectedPreset?.type === 'oauth' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>OAuth Connection</span>
                  </h4>
                  
                  {selectedProvider === 'gmail' && (
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium">Google Gmail</h5>
                          <p className="text-sm text-muted-foreground">
                            {googleStatus?.connected 
                              ? `Connected as ${googleStatus.email}` 
                              : 'Connect your Google account to send and receive emails'
                            }
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleOAuthConnect('gmail')}
                          disabled={googleStatus?.connected}
                          data-testid="button-connect-gmail"
                        >
                          {googleStatus?.connected ? 'Connected' : 'Connect Gmail'}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {selectedProvider === 'microsoft' && (
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium">Microsoft Outlook</h5>
                          <p className="text-sm text-muted-foreground">
                            {microsoftStatus?.connected 
                              ? 'Connected to Microsoft' 
                              : 'Connect your Microsoft account to send and receive emails'
                            }
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleOAuthConnect('microsoft')}
                          disabled={microsoftStatus?.connected}
                          data-testid="button-connect-microsoft"
                        >
                          {microsoftStatus?.connected ? 'Connected' : 'Connect Microsoft'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* IMAP Settings */}
              {selectedPreset?.type === 'imap_smtp' && (
                <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center space-x-2">
                  <Server className="h-4 w-4" />
                  <span>IMAP Settings (Incoming Mail)</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="imapHost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IMAP Host</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="imap.example.com"
                            data-testid="input-imap-host"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imapPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IMAP Port</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-imap-port"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imapSecurity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IMAP Security</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-imap-security">
                              <SelectValue placeholder="Select security type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ssl">SSL</SelectItem>
                            <SelectItem value="starttls">STARTTLS</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="imapUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IMAP Username</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="your-email@example.com"
                            data-testid="input-imap-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imapPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IMAP Password</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="password"
                            placeholder={initialData ? "Enter new password" : "Your password"}
                            data-testid="input-imap-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* SMTP Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>SMTP Settings (Outgoing Mail)</span>
                  </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="smtpHost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Host</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="smtp.example.com"
                            data-testid="input-smtp-host"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="smtpPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Port</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number"
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-smtp-port"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="smtpSecurity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Security</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-smtp-security">
                              <SelectValue placeholder="Select security type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ssl">SSL</SelectItem>
                            <SelectItem value="starttls">STARTTLS</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="smtpUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Username</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="your-email@example.com"
                            data-testid="input-smtp-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="smtpPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Password</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="password"
                            placeholder={initialData ? "Enter new password" : "Your password"}
                            data-testid="input-smtp-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                </div>
              </div>
              )}

              {/* Account Status */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Account Status</h4>
                
                <div className="flex items-center justify-between">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Account</FormLabel>
                          <div className="text-sm text-gray-600">
                            Allow this account to send and receive emails
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-is-active"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Make Default Account</FormLabel>
                          <div className="text-sm text-gray-600">
                            Use this account as the primary email account
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-is-default"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  data-testid="button-cancel"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={saveMutation.isPending}
                  data-testid="button-save"
                >
                  {saveMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}