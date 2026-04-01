import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Settings, RotateCcw, Plus, Trash2, ExternalLink, Download, CheckCircle, AlertCircle, Clock, Mail } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import CalendarView from '@/components/calendar-view';
import { GoogleOAuthModal } from '@/components/google-oauth-modal';

interface CalendarIntegration {
  id: string;
  userId: string;
  provider: string;
  calendarName: string;
  isActive: boolean;
  syncDirection: string;
  lastSyncAt: string | null;
  syncErrors: string | null;
  createdAt: string;
}

interface Event {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  clientId?: string;
  projectId?: string;
  isCancelled?: boolean;
  cancelledAt?: string | null;
}

export default function CalendarPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showGoogleOAuth, setShowGoogleOAuth] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [calendarName, setCalendarName] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  

  // Get current authenticated user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  // Fetch calendar integrations
  const { data: integrations, isLoading: integrationsLoading } = useQuery<CalendarIntegration[]>({
    queryKey: ['/api/calendar-integrations'],
    queryFn: async () => {
      const response = await fetch('/api/calendar-integrations', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch integrations');
      return response.json();
    },
    enabled: !!currentUser,
  });

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const response = await fetch('/api/events', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: !!currentUser,
  });

  // Add iCal integration
  const addICalMutation = useMutation({
    mutationFn: async (data: { icalUrl: string; calendarName: string }) => {
      const response = await apiRequest('POST', '/api/calendar-integrations/ical', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'iCal integration added successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-integrations'] });
      setShowAddDialog(false);
      setIcalUrl('');
      setCalendarName('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to add iCal integration', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Sync integration
  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await apiRequest('POST', `/api/calendar-integrations/${integrationId}/sync`);
      return response.json();
    },
    onSuccess: (data, integrationId) => {
      toast({ 
        title: 'Sync completed', 
        description: `Events synced successfully`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setSyncingId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Sync failed', 
        description: error.message,
        variant: 'destructive' 
      });
      setSyncingId(null);
    },
  });

  // Delete integration
  const deleteMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await apiRequest('DELETE', `/api/calendar-integrations/${integrationId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Calendar integration removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-integrations'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to remove integration', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const handleSync = (integrationId: string) => {
    setSyncingId(integrationId);
    syncMutation.mutate(integrationId);
  };

  // Auto-sync removed — was firing on every page load, hammering the API
  // and contributing to rate-limit issues. Use the "Sync Now" button instead.

  const handleAddICal = () => {
    if (!icalUrl.trim() || !calendarName.trim()) {
      toast({ 
        title: 'Missing information', 
        description: 'Please provide both iCal URL and calendar name',
        variant: 'destructive' 
      });
      return;
    }
    addICalMutation.mutate({ icalUrl: icalUrl.trim(), calendarName: calendarName.trim() });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google': return '🔗';
      case 'ical': return '📅';
      default: return '📊';
    }
  };

  const getStatusIcon = (integration: CalendarIntegration) => {
    if (integration.syncErrors) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (integration.isActive) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const formatLastSync = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return 'Never synced';
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex-1 space-y-6 p-6 min-h-screen overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            Manage your schedule and calendar integrations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGoogleOAuth(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Connect Google Calendar
          </Button>
          {integrations && integrations.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                const active = integrations.find(i => i.isActive && i.provider === 'google');
                if (active) handleSync(active.id);
              }}
              disabled={syncMutation.isPending}
            >
              <RotateCcw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          )}
        </div>
      </div>

      <CalendarView />
      
      {/* Google OAuth Modal */}
      {showGoogleOAuth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <GoogleOAuthModal 
            onSuccess={() => {
              setShowGoogleOAuth(false);
              queryClient.invalidateQueries({ queryKey: ['/api/calendar-integrations'] });
            }}
            onCancel={() => setShowGoogleOAuth(false)}
          />
        </div>
      )}
    </div>
  );
}