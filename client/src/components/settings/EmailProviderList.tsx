import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import EmailProviderPicker from './EmailProviderPicker';
import EmailProviderConfigForm from './EmailProviderConfigForm';
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  TestTube,
  Star,
  StarOff,
  Shield,
  ShieldCheck,
  ShieldX,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Mail,
  Send,
  Globe,
  Clock,
  Settings
} from 'lucide-react';

interface EmailProviderConfig {
  id: string;
  name: string;
  providerCode: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
  isActive: boolean;
  isPrimary: boolean;
  isVerified: boolean;
  isHealthy: boolean;
  capabilities?: {
    canSend: boolean;
    canReceive: boolean;
    supportsWebhooks: boolean;
  };
  messagesSent: number;
  messagesReceived: number;
  lastUsedAt?: string;
  lastVerifiedAt?: string;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

const providerDisplayInfo = {
  gmail: { name: 'Gmail', icon: Mail, color: 'bg-red-500' },
  microsoft: { name: 'Microsoft 365', icon: Mail, color: 'bg-blue-500' },
  icloud: { name: 'iCloud Mail', icon: Shield, color: 'bg-gray-500' },
  yahoo: { name: 'Yahoo Mail', icon: Mail, color: 'bg-purple-500' },
  aol: { name: 'AOL Mail', icon: Mail, color: 'bg-blue-600' },
  fastmail: { name: 'Fastmail', icon: Activity, color: 'bg-green-500' },
  proton: { name: 'ProtonMail', icon: Shield, color: 'bg-purple-600' },
  zoho: { name: 'Zoho Mail', icon: Mail, color: 'bg-red-600' },
  custom: { name: 'Custom IMAP/SMTP', icon: Settings, color: 'bg-gray-600' },
  sendgrid: { name: 'SendGrid', icon: Globe, color: 'bg-blue-400' },
  mailgun: { name: 'Mailgun', icon: Globe, color: 'bg-orange-500' },
  postmark: { name: 'Postmark', icon: Globe, color: 'bg-yellow-500' }
};

export default function EmailProviderList() {
  const [showPicker, setShowPicker] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EmailProviderConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch email provider configurations
  const { data: configs, isLoading, error } = useQuery({
    queryKey: ['/api/email-provider-configs'],
    select: (data: any) => data.configs as EmailProviderConfig[]
  });

  // Delete configuration mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/email-provider-configs/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Email provider configuration deleted successfully'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-provider-configs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete configuration',
        variant: 'destructive'
      });
    }
  });

  // Set primary mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/email-provider-configs/${id}/primary`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Primary email provider updated successfully'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-provider-configs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set primary provider',
        variant: 'destructive'
      });
    }
  });

  // Test configuration mutation
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/email-provider-configs/${id}/test`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? 'Test Successful' : 'Test Failed',
        description: data.message || (data.success ? 'Connection test passed' : 'Connection test failed'),
        variant: data.success ? 'default' : 'destructive'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-provider-configs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Test Error',
        description: error.message || 'Failed to test connection',
        variant: 'destructive'
      });
    }
  });

  const handleProviderSelect = (providerCode: string) => {
    setSelectedProvider(providerCode);
    setShowPicker(false);
  };

  const handleConfigSave = () => {
    setSelectedProvider(null);
    setEditingConfig(null);
  };

  const handleConfigCancel = () => {
    setSelectedProvider(null);
    setEditingConfig(null);
    if (showPicker) {
      setShowPicker(false);
    }
  };

  const handleEdit = (config: EmailProviderConfig) => {
    setEditingConfig(config);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this email provider configuration?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSetPrimary = (id: string) => {
    setPrimaryMutation.mutate(id);
  };

  const handleTest = (id: string) => {
    testMutation.mutate(id);
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

  const getHealthIcon = (config: EmailProviderConfig) => {
    if (!config.isVerified) {
      return <ShieldX className="h-4 w-4 text-gray-400" />;
    }
    if (!config.isHealthy || config.consecutiveFailures > 0) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    return <ShieldCheck className="h-4 w-4 text-green-500" />;
  };

  const getStatusBadge = (config: EmailProviderConfig) => {
    if (!config.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (!config.isVerified) {
      return <Badge variant="outline">Not Verified</Badge>;
    }
    if (!config.isHealthy || config.consecutiveFailures > 0) {
      return <Badge variant="destructive">Issues</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">Healthy</Badge>;
  };

  // Show provider picker
  if (showPicker) {
    return (
      <EmailProviderPicker
        onProviderSelect={handleProviderSelect}
        onCancel={handleConfigCancel}
      />
    );
  }

  // Show provider configuration form
  if (selectedProvider || editingConfig) {
    return (
      <EmailProviderConfigForm
        providerCode={selectedProvider || editingConfig!.providerCode}
        existingConfig={editingConfig}
        onSave={handleConfigSave}
        onCancel={handleConfigCancel}
      />
    );
  }

  if (isLoading) {
    return (
      <Card data-testid="card-provider-list-loading">
        <CardContent className="py-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Loading email providers...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="alert-provider-list-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load email provider configurations. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Providers</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your email provider configurations for sending and receiving emails
          </p>
        </div>
        <Button 
          onClick={() => setShowPicker(true)}
          data-testid="button-add-provider"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Provider Configurations List */}
      {configs && configs.length > 0 ? (
        <div className="grid gap-4">
          {configs.map((config) => {
            const providerInfo = providerDisplayInfo[config.providerCode as keyof typeof providerDisplayInfo] || 
                                { name: config.providerCode, icon: Mail, color: 'bg-gray-500' };
            const IconComponent = providerInfo.icon;

            return (
              <Card key={config.id} data-testid={`card-provider-${config.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Provider Icon */}
                      <div className={`p-3 rounded-lg ${providerInfo.color} text-white`}>
                        <IconComponent className="h-6 w-6" />
                      </div>

                      {/* Provider Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {config.name}
                          </h3>
                          {config.isPrimary && (
                            <Badge variant="default" className="bg-yellow-500">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                          {getStatusBadge(config)}
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>{providerInfo.name}</span>
                          {config.fromEmail && (
                            <>
                              <span>•</span>
                              <span>{config.fromEmail}</span>
                            </>
                          )}
                          {config.capabilities && (
                            <>
                              <span>•</span>
                              <div className="flex space-x-2">
                                {config.capabilities.canSend && (
                                  <Badge variant="outline" className="text-xs">Send</Badge>
                                )}
                                {config.capabilities.canReceive && (
                                  <Badge variant="outline" className="text-xs">Receive</Badge>
                                )}
                                {config.capabilities.supportsWebhooks && (
                                  <Badge variant="outline" className="text-xs">Webhooks</Badge>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Statistics */}
                        <div className="flex items-center space-x-6 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Send className="h-3 w-3" />
                            <span>{config.messagesSent} sent</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>{config.messagesReceived} received</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Last used: {formatDate(config.lastUsedAt)}</span>
                          </div>
                          {config.consecutiveFailures > 0 && (
                            <div className="flex items-center space-x-1 text-red-500">
                              <XCircle className="h-3 w-3" />
                              <span>{config.consecutiveFailures} failures</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {/* Health Status */}
                      <div className="flex items-center space-x-1">
                        {getHealthIcon(config)}
                      </div>

                      {/* Test Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(config.id)}
                        disabled={testMutation.isPending}
                        data-testid={`button-test-${config.id}`}
                      >
                        {testMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-actions-${config.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(config)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Configuration
                          </DropdownMenuItem>
                          
                          {!config.isPrimary && (
                            <DropdownMenuItem onClick={() => handleSetPrimary(config.id)}>
                              <Star className="h-4 w-4 mr-2" />
                              Set as Primary
                            </DropdownMenuItem>
                          )}
                          
                          {config.isPrimary && (
                            <DropdownMenuItem disabled>
                              <StarOff className="h-4 w-4 mr-2" />
                              Primary Provider
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={() => handleDelete(config.id)}
                            className="text-red-600 dark:text-red-400"
                            disabled={config.isPrimary}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {config.isPrimary ? 'Cannot Delete Primary' : 'Delete Configuration'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <Card data-testid="card-empty-state">
          <CardContent className="py-12">
            <div className="text-center">
              <Mail className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No email providers configured
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Add your first email provider to start sending and receiving emails through your CRM.
                Choose from popular providers like Gmail, Microsoft 365, or configure custom IMAP/SMTP settings.
              </p>
              <Button 
                onClick={() => setShowPicker(true)}
                data-testid="button-add-first-provider"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Provider
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}