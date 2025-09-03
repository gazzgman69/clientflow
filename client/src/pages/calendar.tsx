import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Settings, RotateCcw, Plus, Trash2, ExternalLink, Download, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import CalendarView from '@/components/calendar-view';

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
}

export default function CalendarPage() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [calendarName, setCalendarName] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch calendar integrations
  const { data: integrations, isLoading: integrationsLoading } = useQuery<CalendarIntegration[]>({
    queryKey: ['/api/calendar-integrations'],
  });

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // Add iCal integration
  const addICalMutation = useMutation({
    mutationFn: async (data: { icalUrl: string; calendarName: string }) => {
      return apiRequest('/api/calendar-integrations/ical', {
        method: 'POST',
        body: JSON.stringify(data),
      });
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
      return apiRequest(`/api/calendar-integrations/${integrationId}/sync`, {
        method: 'POST',
      });
    },
    onSuccess: (data, integrationId) => {
      toast({ 
        title: 'Sync completed', 
        description: `${data.eventsCreated || 0} created, ${data.eventsUpdated || 0} updated, ${data.eventsDeleted || 0} deleted`
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
      return apiRequest(`/api/calendar-integrations/${integrationId}`, {
        method: 'DELETE',
      });
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
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            Manage your schedule and calendar integrations
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'integrations' && (
            <>
              <Button 
                variant="outline" 
                onClick={() => window.open('https://calendar.google.com/calendar/u/0/settings/export', '_blank')}
                data-testid="connect-google-calendar"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Get Google Calendar Link
              </Button>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-ical-integration">
                    <Plus className="h-4 w-4 mr-2" />
                    Add iCal Feed
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add iCal Integration</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="calendar-name">Calendar Name</Label>
                      <Input
                        id="calendar-name"
                        placeholder="My Calendar"
                        value={calendarName}
                        onChange={(e) => setCalendarName(e.target.value)}
                        data-testid="input-calendar-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ical-url">iCal URL</Label>
                      <Input
                        id="ical-url"
                        placeholder="https://calendar.google.com/calendar/ical/your-email@gmail.com/public/basic.ics"
                        value={icalUrl}
                        onChange={(e) => setIcalUrl(e.target.value)}
                        data-testid="input-ical-url"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        Tip: Click "Get Google Calendar Link" above to find your calendar's iCal URL in Google Calendar settings
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowAddDialog(false)}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleAddICal}
                        disabled={addICalMutation.isPending}
                        data-testid="button-add-ical"
                      >
                        {addICalMutation.isPending ? 'Adding...' : 'Add Integration'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <Settings className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6"
            >
          <div className="space-y-6">

      {/* Calendar Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Connected Calendars
          </CardTitle>
        </CardHeader>
        <CardContent>
          {integrationsLoading ? (
            <div className="text-center py-8">Loading integrations...</div>
          ) : !integrations || integrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No calendar integrations found</p>
              <p className="text-sm">Connect Google Calendar or add an iCal feed to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`integration-${integration.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{getProviderIcon(integration.provider)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{integration.calendarName}</h3>
                        {getStatusIcon(integration)}
                        <Badge variant="outline" className="text-xs">
                          {integration.provider.toUpperCase()}
                        </Badge>
                        <Badge 
                          variant={integration.syncDirection === 'bidirectional' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {integration.syncDirection}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last sync: {formatLastSync(integration.lastSyncAt)}
                      </p>
                      {integration.syncErrors && (
                        <p className="text-sm text-red-600">
                          {JSON.parse(integration.syncErrors).error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(integration.id)}
                      disabled={syncingId === integration.id}
                      data-testid={`sync-${integration.id}`}
                    >
                      <RotateCcw className={`h-4 w-4 mr-1 ${syncingId === integration.id ? 'animate-spin' : ''}`} />
                      {syncingId === integration.id ? 'Syncing...' : 'Sync'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/calendar/ical/${integration.id}`, '_blank')}
                      data-testid={`export-${integration.id}`}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(integration.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`delete-${integration.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Events Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Events Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="text-center py-8">Loading events...</div>
          ) : !events || events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No events found</p>
              <p className="text-sm">Events from connected calendars will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {events.length}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Total Events</div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {events.filter(e => new Date(e.startDate) >= new Date()).length}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">Upcoming Events</div>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {new Set(events.filter(e => e.clientId).map(e => e.clientId)).size}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">Clients with Events</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}