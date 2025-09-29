import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import EmailProviderHelp from './EmailProviderHelp';
import {
  Save,
  TestTube,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Shield,
  Key,
  Globe,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';

// Provider definitions with defaults and validation schemas
const providerDefaults = {
  gmail: {},
  microsoft: {},
  icloud: {
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecure: false
  },
  yahoo: {
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpSecure: false
  },
  aol: {
    imapHost: 'imap.aol.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.aol.com',
    smtpPort: 587,
    smtpSecure: false
  },
  fastmail: {
    imapHost: 'imap.fastmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.fastmail.com',
    smtpPort: 587,
    smtpSecure: false
  },
  proton: {
    imapHost: '127.0.0.1',
    imapPort: 1143,
    imapSecure: false,
    smtpHost: '127.0.0.1',
    smtpPort: 1025,
    smtpSecure: false
  },
  zoho: {
    imapHost: 'imap.zoho.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.zoho.com',
    smtpPort: 587,
    smtpSecure: false
  },
  custom: {},
  sendgrid: {},
  mailgun: {},
  postmark: {}
};

// Validation schemas based on provider auth mode
const createValidationSchema = (providerCode: string) => {
  const baseSchema = z.object({
    name: z.string().min(1, 'Configuration name is required'),
    fromEmail: z.string().email('Valid email address required').optional().or(z.literal('')),
    fromName: z.string().optional(),
    replyToEmail: z.string().email('Valid email address required').optional().or(z.literal('')),
    isPrimary: z.boolean().default(false),
    isActive: z.boolean().default(true)
  });

  switch (providerCode) {
    case 'gmail':
    case 'microsoft':
      // OAuth providers - auth handled via redirect
      return baseSchema;
      
    case 'icloud':
    case 'yahoo':
    case 'aol':
    case 'fastmail':
    case 'zoho':
      // IMAP/SMTP providers with defaults
      return baseSchema.extend({
        username: z.string().min(1, 'Email address is required'),
        password: z.string().min(1, 'App password is required'),
        imapHost: z.string().optional(),
        imapPort: z.number().optional(),
        imapSecure: z.boolean().optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.number().optional(),
        smtpSecure: z.boolean().optional()
      });
      
    case 'proton':
      // ProtonMail Bridge
      return baseSchema.extend({
        username: z.string().min(1, 'Email address is required'),
        password: z.string().min(1, 'Bridge password is required'),
        imapHost: z.string().default('127.0.0.1'),
        imapPort: z.number().default(1143),
        imapSecure: z.boolean().default(false),
        smtpHost: z.string().default('127.0.0.1'),
        smtpPort: z.number().default(1025),
        smtpSecure: z.boolean().default(false)
      });
      
    case 'custom':
      // Custom IMAP/SMTP
      return baseSchema.extend({
        username: z.string().min(1, 'Username is required'),
        password: z.string().min(1, 'Password is required'),
        imapHost: z.string().min(1, 'IMAP host is required'),
        imapPort: z.number().min(1, 'IMAP port is required'),
        imapSecure: z.boolean(),
        smtpHost: z.string().min(1, 'SMTP host is required'),
        smtpPort: z.number().min(1, 'SMTP port is required'),
        smtpSecure: z.boolean()
      });
      
    case 'sendgrid':
    case 'postmark':
      // API key providers
      return baseSchema.extend({
        apiKey: z.string().min(1, 'API key is required')
      });
      
    case 'mailgun':
      // Mailgun needs domain too
      return baseSchema.extend({
        apiKey: z.string().min(1, 'API key is required'),
        domain: z.string().min(1, 'Domain is required')
      });
      
    default:
      return baseSchema;
  }
};

interface EmailProviderConfigFormProps {
  providerCode: string;
  existingConfig?: any;
  onSave: () => void;
  onCancel: () => void;
}

export default function EmailProviderConfigForm({ 
  providerCode, 
  existingConfig, 
  onSave, 
  onCancel 
}: EmailProviderConfigFormProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get provider info
  const providerInfo = {
    gmail: { name: 'Gmail', authMode: 'oauth', icon: Globe },
    microsoft: { name: 'Microsoft 365', authMode: 'oauth', icon: Globe },
    icloud: { name: 'iCloud Mail', authMode: 'appPassword', icon: Shield },
    yahoo: { name: 'Yahoo Mail', authMode: 'appPassword', icon: Shield },
    aol: { name: 'AOL Mail', authMode: 'appPassword', icon: Shield },
    fastmail: { name: 'Fastmail', authMode: 'appPassword', icon: Shield },
    proton: { name: 'ProtonMail', authMode: 'appPassword', icon: Shield },
    zoho: { name: 'Zoho Mail', authMode: 'appPassword', icon: Shield },
    custom: { name: 'Custom IMAP/SMTP', authMode: 'appPassword', icon: Shield },
    sendgrid: { name: 'SendGrid', authMode: 'apiKey', icon: Key },
    mailgun: { name: 'Mailgun', authMode: 'apiKey', icon: Key },
    postmark: { name: 'Postmark', authMode: 'apiKey', icon: Key }
  }[providerCode] || { name: 'Unknown Provider', authMode: 'appPassword', icon: Shield };

  const schema = createValidationSchema(providerCode);
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existingConfig?.name || `${providerInfo.name} Configuration`,
      fromEmail: existingConfig?.fromEmail || '',
      fromName: existingConfig?.fromName || '',
      replyToEmail: existingConfig?.replyToEmail || '',
      isPrimary: existingConfig?.isPrimary || false,
      isActive: existingConfig?.isActive ?? true,
      // Apply provider defaults
      ...providerDefaults[providerCode as keyof typeof providerDefaults],
      // Override with existing config
      ...existingConfig
    }
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = existingConfig 
        ? `/api/email-provider-configs/${existingConfig.id}`
        : '/api/email-provider-configs';
      const method = existingConfig ? 'PATCH' : 'POST';
      
      const payload = {
        ...data,
        providerCode
      };
      
      const response = await apiRequest(method, url, payload);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: existingConfig 
          ? 'Email provider configuration updated successfully'
          : 'Email provider configuration created successfully'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-provider-configs'] });
      onSave();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive'
      });
    }
  });

  // Verify credentials mutation
  const verifyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/email-provider-configs/verify', {
        providerCode,
        ...data
      });
      return response.json();
    },
    onSuccess: (data) => {
      setVerificationResult(data);
      if (data.success) {
        toast({
          title: 'Verification Successful',
          description: 'Email provider credentials are valid'
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: data.error || 'Invalid credentials',
          variant: 'destructive'
        });
      }
    },
    onError: (error: any) => {
      setVerificationResult({ success: false, error: error.message });
      toast({
        title: 'Verification Error',
        description: error.message || 'Failed to verify credentials',
        variant: 'destructive'
      });
    }
  });

  const handleOAuthSetup = () => {
    // Redirect to OAuth flow
    const returnTo = encodeURIComponent('/settings/email');
    const url = providerCode === 'gmail' 
      ? `/auth/google/gmail?returnTo=${returnTo}`
      : `/auth/microsoft/mail?returnTo=${returnTo}`;
    window.location.href = url;
  };

  const handleVerify = () => {
    const formData = form.getValues();
    verifyMutation.mutate(formData);
  };

  const onSubmit = (data: any) => {
    saveConfigMutation.mutate(data);
  };

  const IconComponent = providerInfo.icon;

  return (
    <Card data-testid="card-provider-config-form">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <IconComponent className="h-5 w-5" />
            <span>{existingConfig ? 'Edit' : 'Add'} {providerInfo.name}</span>
          </div>
          <Badge variant="outline">
            {providerInfo.authMode === 'oauth' ? 'OAuth' : 
             providerInfo.authMode === 'apiKey' ? 'API Key' : 'IMAP/SMTP'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Provider Help Guide */}
        <EmailProviderHelp providerCode={providerCode} />
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Configuration</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Configuration Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="My Email Configuration" 
                        data-testid="input-config-name"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      A friendly name to identify this email configuration
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fromEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="your-email@example.com" 
                          data-testid="input-from-email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fromName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Your Name" 
                          data-testid="input-from-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="replyToEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reply-To Email (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="email"
                        placeholder="reply-to@example.com" 
                        data-testid="input-reply-to-email"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Email address for replies (defaults to From Email if empty)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center space-x-6">
                <FormField
                  control={form.control}
                  name="isPrimary"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-primary"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Set as primary email provider
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-active"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Active
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Authentication Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Authentication</h3>

              {providerInfo.authMode === 'oauth' && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This provider uses OAuth authentication. Click the button below to authorize access to your email account.
                    <div className="mt-3">
                      <Button 
                        type="button"
                        onClick={handleOAuthSetup}
                        variant="outline"
                        data-testid="button-oauth-setup"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Authorize {providerInfo.name}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {(providerInfo.authMode === 'appPassword' || providerInfo.authMode === 'apiKey') && (
                <div className="space-y-4">
                  {providerInfo.authMode === 'appPassword' && (
                    <>
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address / Username</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="your-email@example.com"
                                data-testid="input-username"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {providerCode === 'proton' ? 'Bridge Password' : 'App Password'}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="password"
                                placeholder={providerCode === 'proton' ? 'ProtonMail Bridge password' : 'App-specific password'}
                                data-testid="input-password"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              {providerCode === 'proton' 
                                ? 'Password from ProtonMail Bridge application'
                                : 'Use an app-specific password, not your regular login password'
                              }
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {providerInfo.authMode === 'apiKey' && (
                    <>
                      <FormField
                        control={form.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key</FormLabel>
                            <FormControl>
                              <Input 
                                type="password"
                                placeholder="Your API key"
                                data-testid="input-api-key"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              API key from your {providerInfo.name} account
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {providerCode === 'mailgun' && (
                        <FormField
                          control={form.control}
                          name="domain"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Domain</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="yourdomain.com"
                                  data-testid="input-domain"
                                  {...field} 
                                />
                              </FormControl>
                              <FormDescription>
                                Your verified Mailgun domain
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}

                  {/* IMAP/SMTP Advanced Settings */}
                  {(providerInfo.authMode === 'appPassword' && (providerCode === 'custom' || showAdvanced)) && (
                    <>
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-medium">Server Settings</h4>
                        {providerCode !== 'custom' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            data-testid="button-toggle-advanced"
                          >
                            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">IMAP (Incoming)</h5>
                          
                          <FormField
                            control={form.control}
                            name="imapHost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>IMAP Host</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="imap.example.com"
                                    data-testid="input-imap-host"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex space-x-2">
                            <FormField
                              control={form.control}
                              name="imapPort"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel>Port</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      placeholder="993"
                                      data-testid="input-imap-port"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 993)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="imapSecure"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-8">
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-imap-secure"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    TLS/SSL
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">SMTP (Outgoing)</h5>
                          
                          <FormField
                            control={form.control}
                            name="smtpHost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Host</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="smtp.example.com"
                                    data-testid="input-smtp-host"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex space-x-2">
                            <FormField
                              control={form.control}
                              name="smtpPort"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel>Port</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number"
                                      placeholder="587"
                                      data-testid="input-smtp-port"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 587)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="smtpSecure"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-8">
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-smtp-secure"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    SSL
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Verification */}
                  {providerInfo.authMode !== 'oauth' && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleVerify}
                          disabled={verifyMutation.isPending}
                          data-testid="button-verify-credentials"
                        >
                          {verifyMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <TestTube className="h-4 w-4 mr-2" />
                          )}
                          Verify Credentials
                        </Button>

                        {verificationResult && (
                          <div className="flex items-center space-x-2">
                            {verificationResult.success ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className={`text-sm ${verificationResult.success ? 'text-green-600' : 'text-red-600'}`}>
                              {verificationResult.success ? 'Credentials verified' : 'Verification failed'}
                            </span>
                          </div>
                        )}
                      </div>

                      {verificationResult && !verificationResult.success && verificationResult.error && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription data-testid="text-verification-error">
                            {verificationResult.error}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={saveConfigMutation.isPending}
                data-testid="button-save"
              >
                {saveConfigMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {existingConfig ? 'Update Configuration' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}