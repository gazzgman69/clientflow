import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Mail,
  Shield,
  Globe,
  Settings,
  RefreshCw,
  AlertTriangle,
  Download,
  Send,
  CheckCircle
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

const getProviderIcon = (code: string) => {
  if (code.includes('gmail')) return Mail;
  if (code.includes('microsoft') || code.includes('office')) return Mail;
  if (code.includes('icloud') || code.includes('proton')) return Shield;
  if (code.includes('sendgrid') || code.includes('mailgun') || code.includes('postmark')) return Globe;
  if (code === 'custom') return Settings;
  return Mail;
};

const getProviderColor = (code: string) => {
  if (code.includes('gmail')) return 'bg-red-500';
  if (code.includes('microsoft') || code.includes('office')) return 'bg-blue-500';
  if (code.includes('icloud')) return 'bg-gray-500';
  if (code.includes('yahoo')) return 'bg-purple-500';
  if (code.includes('zoho')) return 'bg-red-600';
  if (code.includes('sendgrid')) return 'bg-blue-400';
  if (code.includes('mailgun')) return 'bg-orange-500';
  if (code.includes('postmark')) return 'bg-yellow-500';
  return 'bg-gray-600';
};

export default function EmailProvidersTab() {
  // Fetch provider catalog
  const { data: providersData, isLoading, error } = useQuery({
    queryKey: ['/api/email/providers'],
    select: (data: any) => data.providers as EmailProviderCatalog[]
  });

  const providers = providersData || [];

  // Separate providers by capability
  const incomingProviders = providers.filter(p => 
    p.authType === 'oauth' || p.authType === 'imap_smtp'
  );

  const outgoingProviders = providers.filter(p => 
    p.authType === 'oauth' || p.authType === 'imap_smtp' || p.authType === 'api_only'
  );

  if (isLoading) {
    return (
      <Card data-testid="card-providers-loading">
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
      <Alert variant="destructive" data-testid="alert-providers-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load email providers. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Email Providers</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Available email providers for sending and receiving emails. Choose OAuth providers for easy setup,
          or configure IMAP/SMTP for custom servers.
        </p>
      </div>

      {/* Incoming Providers */}
      <Card data-testid="card-incoming-providers">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Incoming Providers
            <Badge variant="outline" className="ml-3">
              {incomingProviders.length} Available
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incomingProviders.map((provider) => {
              const IconComponent = getProviderIcon(provider.code);
              const colorClass = getProviderColor(provider.code);

              return (
                <div
                  key={provider.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  data-testid={`provider-${provider.code}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${colorClass} text-white flex-shrink-0`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {provider.displayName}
                      </h4>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {provider.authType === 'oauth' ? 'OAuth' : 'IMAP'}
                        </Badge>
                        {provider.authType === 'oauth' && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      {provider.helpBlurb && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {provider.helpBlurb.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Outgoing Providers */}
      <Card data-testid="card-outgoing-providers">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="h-5 w-5 mr-2" />
            Outgoing Providers
            <Badge variant="outline" className="ml-3">
              {outgoingProviders.length} Available
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {outgoingProviders.map((provider) => {
              const IconComponent = getProviderIcon(provider.code);
              const colorClass = getProviderColor(provider.code);

              return (
                <div
                  key={provider.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  data-testid={`provider-${provider.code}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${colorClass} text-white flex-shrink-0`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {provider.displayName}
                      </h4>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {provider.authType === 'oauth' ? 'OAuth' : 
                           provider.authType === 'api_only' ? 'API' : 'SMTP'}
                        </Badge>
                        {provider.authType === 'oauth' && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      {provider.helpBlurb && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {provider.helpBlurb.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
