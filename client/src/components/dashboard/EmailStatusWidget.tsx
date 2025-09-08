import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  AlertTriangle,
  Settings
} from 'lucide-react';

interface MailSettings {
  id: string;
  name: string;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestResult?: 'ok' | 'fail';
  quotaUsed: number;
  quotaLimit: number;
  syncIntervalMinutes: number;
  consecutiveFailures: number;
}

export function EmailStatusWidget() {
  const { data: settingsData, isLoading, error } = useQuery({
    queryKey: ['mail-settings', 'current'],
    queryFn: async () => {
      const response = await apiRequest('/api/settings/mail/current');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const settings = settingsData?.settings as MailSettings | null;

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

  const getStatusIcon = (result?: string, failures?: number) => {
    if (failures && failures >= 3) {
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    }
    if (result === 'ok') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (result === 'fail') return <XCircle className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getQuotaColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const calculateNextSync = (intervalMinutes: number, lastTest?: string) => {
    if (!lastTest) return 'Not scheduled';
    
    const lastTestTime = new Date(lastTest);
    const nextSyncTime = new Date(lastTestTime.getTime() + (intervalMinutes * 60 * 1000));
    const now = new Date();
    
    if (nextSyncTime <= now) return 'Due now';
    
    const diffMs = nextSyncTime.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    
    return formatDate(nextSyncTime.toISOString());
  };

  if (isLoading) {
    return (
      <Card data-testid="email-status-widget-loading">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Email Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !settings) {
    return (
      <Card data-testid="email-status-widget-not-configured">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Email Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-3">
              No email account configured
            </p>
            <Button size="sm" variant="outline" data-testid="button-setup-email">
              <Settings className="h-4 w-4 mr-2" />
              Setup Email
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const quotaPercentage = Math.round((settings.quotaUsed / settings.quotaLimit) * 100);
  const hasRepeatedFailures = settings.consecutiveFailures >= 3;

  return (
    <Card data-testid="email-status-widget">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Email Status</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={settings.isActive ? 'default' : 'secondary'} data-testid="badge-email-status">
              {settings.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Repeated Failures Alert */}
        {hasRepeatedFailures && (
          <div className="flex items-center space-x-2 p-2 bg-orange-50 border border-orange-200 rounded" data-testid="alert-repeated-failures">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-800">
              {settings.consecutiveFailures} consecutive sync failures detected
            </span>
          </div>
        )}

        {/* Account Name & Connection Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" data-testid="text-account-name">{settings.name}</p>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusIcon(settings.lastTestResult, settings.consecutiveFailures)}
              <span className="text-xs text-gray-600">
                {settings.lastTestedAt ? (
                  <>Last checked: {formatDate(settings.lastTestedAt)}</>
                ) : (
                  'Not tested yet'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Quota Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Daily Quota</span>
            <span className="text-xs font-mono" data-testid="text-quota-usage">
              {settings.quotaUsed} / {settings.quotaLimit}
            </span>
          </div>
          <Progress 
            value={quotaPercentage} 
            className="h-2"
            data-testid="progress-quota"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{quotaPercentage}% used</span>
            {quotaPercentage >= 80 && (
              <span className="text-orange-600 font-medium">
                {quotaPercentage >= 90 ? 'Quota nearly full' : 'Approaching limit'}
              </span>
            )}
          </div>
        </div>

        {/* Next Sync */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Next sync:</span>
          <span className="font-mono" data-testid="text-next-sync">
            {calculateNextSync(settings.syncIntervalMinutes, settings.lastTestedAt)}
          </span>
        </div>

        {/* Sync Interval */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Interval:</span>
          <span data-testid="text-sync-interval">
            {settings.syncIntervalMinutes} minute{settings.syncIntervalMinutes !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Quick Action */}
        <div className="pt-2 border-t">
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full"
            data-testid="button-email-settings"
          >
            <Settings className="h-4 w-4 mr-2" />
            Email Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}