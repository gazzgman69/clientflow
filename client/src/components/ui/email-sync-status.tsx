import { useQuery } from '@tanstack/react-query';
import { Mail, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

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

export function EmailSyncStatus() {
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/settings/mail/current'],
    refetchInterval: 30000
  });

  const { data: gmailStatusData, isLoading: gmailLoading } = useQuery({
    queryKey: ['/api/auth/google/status'],
    refetchInterval: 30000
  });

  const { data: microsoftStatusData, isLoading: microsoftLoading } = useQuery({
    queryKey: ['/api/auth/microsoft/status'],
    refetchInterval: 30000
  });

  const settings = (settingsData as any)?.settings as MailSettings | null;
  const gmailStatus = gmailStatusData as { ok: boolean; connected: boolean; scopes?: string[] } | undefined;
  const microsoftStatus = microsoftStatusData as { ok: boolean; connected: boolean; scopes?: string[]; provider?: string } | undefined;
  
  const isLoading = settingsLoading || gmailLoading || microsoftLoading;

  if (isLoading) {
    return (
      <div className="flex items-center space-x-1" data-testid="email-sync-loading">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show connected providers status
  const connectedProviders = [];
  if (gmailStatus?.connected) {
    connectedProviders.push({
      name: 'Gmail',
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      testId: 'email-sync-gmail-connected'
    });
  }
  if (microsoftStatus?.connected) {
    connectedProviders.push({
      name: 'Outlook',
      icon: <CheckCircle className="h-4 w-4 text-blue-500" />,
      testId: 'email-sync-microsoft-connected'
    });
  }

  if (connectedProviders.length > 0) {
    return (
      <div className="flex items-center space-x-2" data-testid="email-sync-providers-connected">
        {connectedProviders.map((provider, index) => (
          <div 
            key={provider.name}
            className="flex items-center space-x-1" 
            data-testid={provider.testId}
            title={`${provider.name} connected and syncing`}
          >
            {provider.icon}
            <span className={`text-xs ${provider.name === 'Gmail' ? 'text-green-500' : 'text-blue-500'}`}>
              {provider.name}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (!settings && !gmailStatus?.connected && !microsoftStatus?.connected) {
    return (
      <Link href="/settings?tab=email">
        <div className="flex items-center space-x-1 hover:text-blue-600 cursor-pointer transition-colors" data-testid="email-sync-not-configured">
          <Mail className="h-4 w-4 text-muted-foreground hover:text-blue-600" />
          <span className="text-xs text-muted-foreground hover:text-blue-600">No email</span>
        </div>
      </Link>
    );
  }

  // For settings-based status (fallback when Gmail is connected but settings exist)
  if (settings) {
    const getStatusIcon = () => {
      if (settings.consecutiveFailures >= 3) {
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      }
      if (settings.lastTestResult === 'ok') {
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      }
      if (settings.lastTestResult === 'fail') {
        return <XCircle className="h-4 w-4 text-red-500" />;
      }
      return <Mail className="h-4 w-4 text-muted-foreground" />;
    };

    const getStatusText = () => {
      if (settings.consecutiveFailures >= 3) return 'Issues';
      if (settings.lastTestResult === 'ok') return 'Synced';
      if (settings.lastTestResult === 'fail') return 'Failed';
      return 'Unknown';
    };

    const getStatusColor = () => {
      if (settings.consecutiveFailures >= 3) return 'text-orange-500';
      if (settings.lastTestResult === 'ok') return 'text-green-500';
      if (settings.lastTestResult === 'fail') return 'text-red-500';
      return 'text-muted-foreground';
    };

    return (
      <div 
        className="flex items-center space-x-1" 
        data-testid="email-sync-status"
        title={`Email sync: ${getStatusText()} | ${settings.quotaUsed}/${settings.quotaLimit} quota used`}
      >
        {getStatusIcon()}
        <span className={cn("text-xs", getStatusColor())}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  // Fallback - should not reach here normally
  return (
    <div className="flex items-center space-x-1" data-testid="email-sync-unknown">
      <Mail className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Unknown</span>
    </div>
  );
}