import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Mail, 
  Shield, 
  Globe, 
  Zap,
  CheckCircle,
  Settings
} from 'lucide-react';

// Import provider definitions
const emailProviders = [
  {
    code: 'gmail',
    name: 'Gmail',
    icon: Mail,
    authModes: ['oauth'],
    category: 'OAuth Provider',
    description: 'Google Gmail with OAuth authentication',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'microsoft',
    name: 'Microsoft 365',
    icon: Mail,
    authModes: ['oauth'],
    category: 'OAuth Provider', 
    description: 'Microsoft 365 / Outlook with OAuth authentication',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'icloud',
    name: 'iCloud Mail',
    icon: Shield,
    authModes: ['appPassword'],
    category: 'IMAP/SMTP Provider',
    description: 'Apple iCloud Mail with app-specific password',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'yahoo',
    name: 'Yahoo Mail',
    icon: Mail,
    authModes: ['appPassword'],
    category: 'IMAP/SMTP Provider',
    description: 'Yahoo Mail with app-specific password',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'aol',
    name: 'AOL Mail',
    icon: Mail,
    authModes: ['appPassword'],
    category: 'IMAP/SMTP Provider',
    description: 'AOL Mail with app-specific password',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'fastmail',
    name: 'Fastmail',
    icon: Zap,
    authModes: ['appPassword'],
    category: 'IMAP/SMTP Provider',
    description: 'Fastmail with app-specific password',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'proton',
    name: 'ProtonMail',
    icon: Shield,
    authModes: ['appPassword'],
    category: 'IMAP/SMTP Provider',
    description: 'ProtonMail Bridge with IMAP/SMTP',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'zoho',
    name: 'Zoho Mail',
    icon: Mail,
    authModes: ['appPassword'],
    category: 'IMAP/SMTP Provider',
    description: 'Zoho Mail with app-specific password',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'custom',
    name: 'Custom IMAP/SMTP',
    icon: Settings,
    authModes: ['appPassword'],
    category: 'IMAP/SMTP Provider',
    description: 'Custom IMAP/SMTP server configuration',
    capabilities: { canSend: true, canReceive: true, supportsWebhooks: false }
  },
  {
    code: 'sendgrid',
    name: 'SendGrid',
    icon: Globe,
    authModes: ['apiKey'],
    category: 'Outbound-Only Provider',
    description: 'SendGrid API for sending emails only',
    capabilities: { canSend: true, canReceive: false, supportsWebhooks: true }
  },
  {
    code: 'mailgun',
    name: 'Mailgun',
    icon: Globe,
    authModes: ['apiKey'],
    category: 'Outbound-Only Provider',
    description: 'Mailgun API for sending emails only',
    capabilities: { canSend: true, canReceive: false, supportsWebhooks: true }
  },
  {
    code: 'postmark',
    name: 'Postmark',
    icon: Globe,
    authModes: ['apiKey'],
    category: 'Outbound-Only Provider',
    description: 'Postmark API for sending emails only',
    capabilities: { canSend: true, canReceive: false, supportsWebhooks: true }
  }
];

interface EmailProviderPickerProps {
  onProviderSelect: (providerCode: string) => void;
  onCancel: () => void;
}

export default function EmailProviderPicker({ onProviderSelect, onCancel }: EmailProviderPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Get unique categories
  const categories = ['all', ...new Set(emailProviders.map(p => p.category))];

  // Filter providers based on category and search term
  const filteredProviders = emailProviders.filter(provider => {
    const matchesCategory = selectedCategory === 'all' || provider.category === selectedCategory;
    const matchesSearch = provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         provider.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group providers by category for display
  const groupedProviders = filteredProviders.reduce((acc, provider) => {
    if (!acc[provider.category]) {
      acc[provider.category] = [];
    }
    acc[provider.category].push(provider);
    return acc;
  }, {} as Record<string, typeof emailProviders>);

  const getCapabilityBadges = (capabilities: any) => {
    const badges = [];
    if (capabilities.canSend) badges.push('Send');
    if (capabilities.canReceive) badges.push('Receive');
    if (capabilities.supportsWebhooks) badges.push('Webhooks');
    return badges;
  };

  return (
    <Card data-testid="card-provider-picker">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Add Email Provider</span>
          </div>
          <Button 
            variant="ghost" 
            onClick={onCancel}
            data-testid="button-cancel-provider-picker"
          >
            Cancel
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-provider-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search providers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-provider-search"
            />
          </div>
        </div>

        {/* Provider Grid */}
        <div className="space-y-6">
          {Object.entries(groupedProviders).map(([category, providers]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map(provider => {
                  const IconComponent = provider.icon;
                  return (
                    <Card 
                      key={provider.code}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600"
                      onClick={() => onProviderSelect(provider.code)}
                      data-testid={`card-provider-${provider.code}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <IconComponent className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {provider.name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {provider.description}
                            </p>
                            
                            {/* Capabilities */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              {getCapabilityBadges(provider.capabilities).map(badge => (
                                <Badge 
                                  key={badge} 
                                  variant="secondary" 
                                  className="text-xs"
                                >
                                  {badge}
                                </Badge>
                              ))}
                            </div>
                            
                            {/* Auth Method */}
                            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                              {provider.authModes.includes('oauth') && (
                                <Badge variant="outline" className="text-xs">
                                  OAuth
                                </Badge>
                              )}
                              {provider.authModes.includes('appPassword') && (
                                <Badge variant="outline" className="text-xs">
                                  App Password
                                </Badge>
                              )}
                              {provider.authModes.includes('apiKey') && (
                                <Badge variant="outline" className="text-xs">
                                  API Key
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {filteredProviders.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No providers found matching your criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}