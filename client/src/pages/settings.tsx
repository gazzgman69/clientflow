import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  User, Bell, Shield, Palette, Database, Mail, 
  Calendar, Key, Globe, Save, Upload, AlertTriangle, 
  CheckCircle, XCircle, Loader2, FileText, ExternalLink,
  Download, Trash2, RefreshCw, Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import EmailSettings from "@/pages/settings/EmailSettings";
import TemplatesPage from "@/pages/settings/Templates";
import ProductsServicesPage from "@/pages/settings/ProductsServices";
import PortalSettingsComponent from "@/components/settings/PortalSettings";
import { GoogleOAuthModal } from '@/components/google-oauth-modal';

export default function Settings() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [showGoogleOAuth, setShowGoogleOAuth] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [selectedIntegrationToPurge, setSelectedIntegrationToPurge] = useState<any>(null);
  const { toast } = useToast();

  // Check for tab parameter in URL and set active tab
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'notifications', 'security', 'portal', 'integrations', 'email', 'calendar', 'templates', 'products-services', 'appearance', 'data'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      return response.json();
    },
  });

  // Gmail auth status query
  const { data: gmailStatus, isLoading: gmailStatusLoading, refetch: refetchGmailStatus } = useQuery({
    queryKey: ['/api/auth/google/gmail/status'],
    queryFn: async () => {
      const response = await fetch('/api/auth/google/gmail/status', {
        credentials: 'include' // Use session cookies for authentication
      });
      return response.json();
    },
  });

  // Calendar auth status query (refetch every 30s to catch sync updates)
  const { data: calendarStatus, isLoading: calendarStatusLoading, refetch: refetchCalendarStatus } = useQuery({
    queryKey: ['/api/auth/google/calendar/status'],
    queryFn: async () => {
      const response = await fetch('/api/auth/google/calendar/status', {
        credentials: 'include' // Use session cookies for authentication
      });
      return response.json();
    },
    refetchInterval: 30000 // Poll every 30 seconds to show updated sync timestamp
  });

  // Scope check query - only run if calendar is connected
  const { data: scopeCheck, isLoading: scopeCheckLoading, refetch: refetchScopeCheck } = useQuery({
    queryKey: ['/api/auth/google/scope-check'],
    queryFn: async () => {
      const response = await fetch('/api/auth/google/scope-check', {
        credentials: 'include'
      });
      return response.json();
    },
    enabled: !!calendarStatus?.connected, // Only run if calendar is connected
  });

  // Combined loading state for compatibility
  const statusLoading = gmailStatusLoading || calendarStatusLoading;

  // Disconnect Gmail mutation
  const disconnectGmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/google/gmail/disconnect', {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Gmail account disconnected successfully' });
      refetchGmailStatus();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to disconnect Gmail account',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Disconnect Calendar mutation
  const disconnectCalendarMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/google/calendar/disconnect', {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Google Calendar disconnected successfully' });
      refetchCalendarStatus();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to disconnect Google Calendar',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Request manual sync mutation
  const requestSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/google/sync', {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Calendar sync requested successfully' });
      // Refresh both Gmail and Calendar status since sync affects both
      refetchGmailStatus();
      refetchCalendarStatus();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to request calendar sync',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Get disconnected integrations query
  const { data: disconnectedIntegrations, refetch: refetchDisconnected } = useQuery({
    queryKey: ['/api/auth/google/calendar/disconnected'],
    queryFn: async () => {
      const response = await fetch('/api/auth/google/calendar/disconnected', {
        credentials: 'include'
      });
      const data = await response.json();
      return data.integrations || [];
    },
  });

  // Purge calendar events mutation
  const purgeEventsMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await apiRequest('POST', '/api/auth/google/calendar/purge', { integrationId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Events purged successfully',
        description: `${data.purgedCount || 0} events have been permanently deleted`
      });
      setShowPurgeModal(false);
      setSelectedIntegrationToPurge(null);
      refetchDisconnected();
      refetchCalendarStatus();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to purge events',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Export calendar events function
  const handleExportEvents = (integrationId: string) => {
    window.location.href = `/api/auth/google/calendar/export/${integrationId}`;
    toast({ 
      title: 'Exporting calendar events',
      description: 'Your download should begin shortly'
    });
  };

  const handleSaveSettings = async (section: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    
    toast({
      title: "Settings Saved",
      description: `${section} settings have been updated successfully.`,
    });
  };

  return (
    <>
      <Header 
        title="Settings" 
        subtitle="Manage your account and application preferences"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-11" data-testid="settings-tabs">
            <TabsTrigger value="profile" data-testid="tab-profile">
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">
              Security
            </TabsTrigger>
            <TabsTrigger value="portal" data-testid="tab-portal">
              Client Portal
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              Integrations
            </TabsTrigger>
            <TabsTrigger value="email" data-testid="tab-email">
              Email
            </TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar">
              Calendar
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              Templates
            </TabsTrigger>
            <TabsTrigger value="products-services" data-testid="tab-products-services">
              Products & Services
            </TabsTrigger>
            <TabsTrigger value="appearance" data-testid="tab-appearance">
              Appearance
            </TabsTrigger>
            <TabsTrigger value="data" data-testid="tab-data">
              Data
            </TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card data-testid="profile-settings-card">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20" data-testid="profile-avatar">
                    <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100" />
                    <AvatarFallback>JS</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" data-testid="button-upload-avatar">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photo
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG or GIF. Max size 2MB.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" defaultValue="John" data-testid="input-first-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" defaultValue="Smith" data-testid="input-last-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue="john@company.com" data-testid="input-email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" type="tel" defaultValue="+1 (555) 123-4567" data-testid="input-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input id="title" defaultValue="Business Owner" data-testid="input-job-title" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" defaultValue="Business Solutions Inc." data-testid="input-company" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea 
                    id="bio" 
                    rows={3}
                    placeholder="Tell us about yourself..."
                    data-testid="textarea-bio"
                  />
                </div>

                <Button 
                  onClick={() => handleSaveSettings("Profile")}
                  disabled={isLoading}
                  data-testid="button-save-profile"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card data-testid="notification-settings-card">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch defaultChecked data-testid="switch-email-notifications" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>New Lead Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when new leads are added
                      </p>
                    </div>
                    <Switch defaultChecked data-testid="switch-lead-alerts" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Quote Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Reminders for pending quotes
                      </p>
                    </div>
                    <Switch defaultChecked data-testid="switch-quote-reminders" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Invoice Overdue Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when invoices are overdue
                      </p>
                    </div>
                    <Switch defaultChecked data-testid="switch-invoice-alerts" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Weekly Summary</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive weekly performance summaries
                      </p>
                    </div>
                    <Switch data-testid="switch-weekly-summary" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Notification Frequency</Label>
                  <Select defaultValue="immediate">
                    <SelectTrigger data-testid="select-notification-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="hourly">Hourly digest</SelectItem>
                      <SelectItem value="daily">Daily digest</SelectItem>
                      <SelectItem value="weekly">Weekly digest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={() => handleSaveSettings("Notification")}
                  disabled={isLoading}
                  data-testid="button-save-notifications"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            <Card data-testid="security-settings-card">
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" type="password" data-testid="input-current-password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" type="password" data-testid="input-new-password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" type="password" data-testid="input-confirm-password" />
                  </div>
                  <Button variant="outline" data-testid="button-change-password">
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <Badge variant="secondary">Not enabled</Badge>
                  </div>
                  <Button variant="outline" data-testid="button-enable-2fa">
                    <Shield className="h-4 w-4 mr-2" />
                    Enable 2FA
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Active Sessions</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Current session</p>
                        <p className="text-sm text-muted-foreground">Chrome on MacOS • 192.168.1.100</p>
                      </div>
                      <Badge variant="secondary">Current</Badge>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={() => handleSaveSettings("Security")}
                  disabled={isLoading}
                  data-testid="button-save-security"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Portal Settings */}
          <TabsContent value="portal" className="space-y-6">
            <Card data-testid="portal-settings-card">
              <CardHeader>
                <CardTitle>Client Portal Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <PortalSettingsComponent />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="space-y-6">
            <Card data-testid="integrations-settings-card">
              <CardHeader>
                <CardTitle>Third-party Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Database className="h-8 w-8 text-purple-600" />
                      <div>
                        <p className="font-medium">Backup Service</p>
                        <p className="text-sm text-muted-foreground">Automated data backups</p>
                      </div>
                    </div>
                    <Button variant="outline" data-testid="button-connect-backup">Connect</Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>API Keys</Label>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">Your API Key</Label>
                      <div className="flex space-x-2">
                        <Input 
                          id="apiKey" 
                          value="crm_••••••••••••••••••••••••••••••••"
                          readOnly
                          data-testid="input-api-key"
                        />
                        <Button variant="outline" data-testid="button-regenerate-api">Regenerate</Button>
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Settings */}
          <TabsContent value="email" className="space-y-6">
            {/* Gmail Email Login */}
            {import.meta.env.VITE_FEATURE_LEGACY_EMAIL === 'true' && (
            <Card data-testid="gmail-login-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  Gmail Email Login
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                      {gmailStatusLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Checking Gmail connection status...
                        </div>
                      ) : (
                        <>
                          {/* Status Display */}
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {gmailStatus?.connected ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              <div>
                                <p className="font-medium">
                                  {gmailStatus?.connected ? 'Connected' : 'Disconnected'}
                                </p>
                                {gmailStatus?.connected && gmailStatus?.email && (
                                  <p className="text-sm text-muted-foreground">{gmailStatus.email}</p>
                                )}
                                {gmailStatus?.connected && gmailStatus?.lastSyncAt && (
                                  <p className="text-xs text-muted-foreground">
                                    Last synced: {new Date(gmailStatus.lastSyncAt).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge variant={gmailStatus?.connected ? "default" : "secondary"}>
                              {gmailStatus?.connected ? 'Connected' : 'Disconnected'}
                            </Badge>
                          </div>

                          {/* Gmail Scopes Check */}
                          {gmailStatus?.connected && (!gmailStatus?.scopes?.some?.((scope: string) => scope.includes('gmail.send')) || !gmailStatus?.scopes?.some?.((scope: string) => scope.includes('gmail.readonly'))) && (
                            <Alert>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Gmail permissions missing — please reconnect to grant Gmail access.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                const returnTo = window.location.pathname;
                                const origin = window.location.origin;
                                const w = 500, h = 650;
                                const left = Math.round((screen.width / 2) - (w / 2));
                                const top = Math.round((screen.height / 2) - (h / 2));
                                const features = `popup,width=${w},height=${h},left=${left},top=${top}`;
                                
                                const popup = window.open(
                                  `/auth/google/gmail?popup=1&returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`,
                                  'gmail-oauth',
                                  features
                                );
                                
                                if (!popup) {
                                  // Fallback if popup blocked
                                  window.location.href = `/auth/google/gmail?returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`;
                                  return;
                                }
                                
                                // Listen for OAuth success/error messages
                                const handleMessage = (event: MessageEvent) => {
                                  if (event.origin !== window.location.origin) return;
                                  
                                  if (event.data.type === 'oauth:connected' && event.data.provider === 'google') {
                                    window.removeEventListener('message', handleMessage);
                                    if (popup && !popup.closed) popup.close();
                                    // Refresh Gmail status
                                    refetchGmailStatus();
                                    toast({ title: 'Gmail account connected successfully' });
                                  } else if (event.data.type === 'oauth:error') {
                                    window.removeEventListener('message', handleMessage);
                                    if (popup && !popup.closed) popup.close();
                                    toast({
                                      title: 'Failed to connect Gmail account',
                                      description: event.data.error || 'An error occurred',
                                      variant: 'destructive'
                                    });
                                  }
                                };
                                
                                window.addEventListener('message', handleMessage);
                              }}
                              disabled={gmailStatusLoading}
                              data-testid="button-connect-gmail"
                            >
                              {gmailStatus?.connected ? 'Reconnect Gmail' : 'Connect Gmail'}
                            </Button>
                            {gmailStatus?.connected && (
                              <Button
                                variant="outline"
                                onClick={() => disconnectGmailMutation.mutate()}
                                disabled={disconnectGmailMutation.isPending}
                                data-testid="button-disconnect-gmail"
                              >
                                {disconnectGmailMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : null}
                                Disconnect Gmail
                              </Button>
                            )}
                          </div>

                          {/* Optional SMTP Section - Coming Soon */}
                          <Separator />
                          <div className="space-y-3 opacity-50">
                            <Label>SMTP Configuration (Coming Soon)</Label>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Server</Label>
                                <Input placeholder="smtp.example.com" disabled />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Port</Label>
                                <Input placeholder="587" disabled />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              SMTP support for other email providers coming in a future update.
                            </p>
                          </div>
                        </>
                      )}
              </CardContent>
            </Card>
            )}

            {/* Email Settings */}
            <EmailSettings />
          </TabsContent>

          {/* Calendar Settings */}
          <TabsContent value="calendar" className="space-y-6">
            {/* Disconnected Calendar Banner */}
            {disconnectedIntegrations && disconnectedIntegrations.length > 0 && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
                <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="space-y-3">
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100">
                      Disconnected Calendar Events
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      You have {disconnectedIntegrations.length} disconnected Google Calendar integration{disconnectedIntegrations.length > 1 ? 's' : ''} with read-only events.
                      Reconnect to resume syncing, export your data, or permanently remove these events.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {disconnectedIntegrations.map((integration: any) => (
                      <div key={integration.id} className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const returnTo = window.location.pathname;
                            const origin = window.location.origin;
                            const w = 500, h = 650;
                            const left = Math.round((screen.width / 2) - (w / 2));
                            const top = Math.round((screen.height / 2) - (h / 2));
                            const features = `popup,width=${w},height=${h},left=${left},top=${top}`;
                            
                            const popup = window.open(
                              `/auth/google/calendar?popup=1&returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`,
                              'calendar-oauth',
                              features
                            );
                            
                            if (!popup) {
                              window.location.href = `/auth/google/calendar?returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`;
                              return;
                            }
                            
                            const handleMessage = (event: MessageEvent) => {
                              if (event.origin !== window.location.origin) return;
                              
                              if (event.data.type === 'oauth:connected' && event.data.provider === 'google' && event.data.serviceType === 'calendar') {
                                window.removeEventListener('message', handleMessage);
                                if (popup && !popup.closed) popup.close();
                                refetchCalendarStatus();
                                refetchDisconnected();
                                toast({ title: 'Google Calendar reconnected successfully' });
                              } else if (event.data.type === 'oauth:error') {
                                window.removeEventListener('message', handleMessage);
                                if (popup && !popup.closed) popup.close();
                                toast({
                                  title: 'Failed to reconnect Google Calendar',
                                  description: event.data.error || 'An error occurred',
                                  variant: 'destructive'
                                });
                              }
                            };
                            
                            window.addEventListener('message', handleMessage);
                          }}
                          data-testid={`button-reconnect-${integration.id}`}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reconnect
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportEvents(integration.id)}
                          data-testid={`button-export-${integration.id}`}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Export (.ics)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => {
                            setSelectedIntegrationToPurge(integration);
                            setShowPurgeModal(true);
                          }}
                          data-testid={`button-purge-${integration.id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Purge Events
                        </Button>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <Card data-testid="calendar-settings-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-600" />
                  Google Calendar Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {calendarStatusLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Checking Calendar connection status...
                  </div>
                ) : (
                  <>
                    {/* Status Display */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {calendarStatus?.connected ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium">
                            {calendarStatus?.connected ? 'Connected' : 'Disconnected'}
                          </p>
                          {calendarStatus?.connected && calendarStatus?.email && (
                            <p className="text-sm text-muted-foreground">{calendarStatus.email}</p>
                          )}
                          {calendarStatus?.connected && calendarStatus?.lastSyncAt && (
                            <p className="text-xs text-muted-foreground">
                              Last synced: {new Date(calendarStatus.lastSyncAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={calendarStatus?.connected ? "default" : "secondary"}>
                        {calendarStatus?.connected ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>

                    {/* Calendar Scopes Check */}
                    {calendarStatus?.connected && (!calendarStatus?.scopes?.some?.((scope: string) => scope.includes('calendar.readonly')) || !calendarStatus?.scopes?.some?.((scope: string) => scope.includes('calendar.events'))) && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Calendar permissions missing — please reconnect to grant Calendar access.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Token Expiration Check */}
                    {calendarStatus?.connected && calendarStatus?.syncErrors && (() => {
                      try {
                        const errorData = typeof calendarStatus.syncErrors === 'string' 
                          ? JSON.parse(calendarStatus.syncErrors) 
                          : calendarStatus.syncErrors;
                        return errorData?.error === 'invalid_grant' || errorData?.requiresReconnection;
                      } catch {
                        return false;
                      }
                    })() && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Calendar connection expired — please reconnect to restore sync functionality.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {calendarStatus?.connected ? (
                        <>
                          <Button
                            onClick={() => requestSyncMutation.mutate()}
                            disabled={requestSyncMutation.isPending}
                            variant="outline"
                            size="sm"
                            data-testid="button-request-sync"
                          >
                            {requestSyncMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Calendar className="h-4 w-4 mr-2" />
                            )}
                            Request Sync
                          </Button>
                          <Button
                            onClick={() => {
                              const returnTo = window.location.pathname;
                              const origin = window.location.origin;
                              const w = 500, h = 650;
                              const left = Math.round((screen.width / 2) - (w / 2));
                              const top = Math.round((screen.height / 2) - (h / 2));
                              const features = `popup,width=${w},height=${h},left=${left},top=${top}`;
                              
                              const popup = window.open(
                                `/auth/google/calendar?popup=1&returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`,
                                'calendar-oauth',
                                features
                              );
                              
                              if (!popup) {
                                // Fallback if popup blocked
                                window.location.href = `/auth/google/calendar?returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`;
                                return;
                              }
                              
                              // Listen for OAuth success/error messages
                              const handleMessage = (event: MessageEvent) => {
                                if (event.origin !== window.location.origin) return;
                                
                                if (event.data.type === 'oauth:connected' && event.data.provider === 'google' && event.data.serviceType === 'calendar') {
                                  window.removeEventListener('message', handleMessage);
                                  if (popup && !popup.closed) popup.close();
                                  // Refresh Calendar status
                                  refetchCalendarStatus();
                                  toast({ title: 'Google Calendar connected successfully' });
                                } else if (event.data.type === 'oauth:error') {
                                  window.removeEventListener('message', handleMessage);
                                  if (popup && !popup.closed) popup.close();
                                  toast({
                                    title: 'Failed to connect Google Calendar',
                                    description: event.data.error || 'An error occurred',
                                    variant: 'destructive'
                                  });
                                }
                              };
                              
                              window.addEventListener('message', handleMessage);
                            }}
                            variant="outline"
                            size="sm"
                            data-testid="button-reconnect-calendar"
                          >
                            Reconnect Calendar
                          </Button>
                          <Button
                            onClick={() => disconnectCalendarMutation.mutate()}
                            disabled={disconnectCalendarMutation.isPending}
                            variant="outline"
                            size="sm"
                            data-testid="button-disconnect-calendar"
                          >
                            {disconnectCalendarMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => {
                            const returnTo = window.location.pathname;
                            const origin = window.location.origin;
                            const w = 500, h = 650;
                            const left = Math.round((screen.width / 2) - (w / 2));
                            const top = Math.round((screen.height / 2) - (h / 2));
                            const features = `popup,width=${w},height=${h},left=${left},top=${top}`;
                            
                            const popup = window.open(
                              `/auth/google/calendar?popup=1&returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`,
                              'calendar-oauth',
                              features
                            );
                            
                            if (!popup) {
                              // Fallback if popup blocked
                              window.location.href = `/auth/google/calendar?returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`;
                              return;
                            }
                            
                            // Listen for OAuth success/error messages
                            const handleMessage = (event: MessageEvent) => {
                              if (event.origin !== window.location.origin) return;
                              
                              if (event.data.type === 'oauth:connected' && event.data.provider === 'google' && event.data.serviceType === 'calendar') {
                                window.removeEventListener('message', handleMessage);
                                if (popup && !popup.closed) popup.close();
                                // Refresh Calendar status
                                refetchCalendarStatus();
                                toast({ title: 'Google Calendar connected successfully' });
                              } else if (event.data.type === 'oauth:error') {
                                window.removeEventListener('message', handleMessage);
                                if (popup && !popup.closed) popup.close();
                                toast({
                                  title: 'Failed to connect Google Calendar',
                                  description: event.data.error || 'An error occurred',
                                  variant: 'destructive'
                                });
                              }
                            };
                            
                            window.addEventListener('message', handleMessage);
                          }}
                          variant="default"
                          size="sm"
                          data-testid="button-connect-calendar"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Connect Google Calendar
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates */}
          <TabsContent value="templates">
            <TemplatesPage />
          </TabsContent>

          {/* Products & Services */}
          <TabsContent value="products-services">
            <ProductsServicesPage />
          </TabsContent>

          {/* Appearance */}
          <TabsContent value="appearance" className="space-y-6">
            <Card data-testid="appearance-settings-card">
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger data-testid="select-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select defaultValue="mm/dd/yyyy">
                      <SelectTrigger data-testid="select-date-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                        <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                        <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time Format</Label>
                    <Select defaultValue="12h">
                      <SelectTrigger data-testid="select-time-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12 hour (AM/PM)</SelectItem>
                        <SelectItem value="24h">24 hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={() => handleSaveSettings("Appearance")}
                  disabled={isLoading}
                  data-testid="button-save-appearance"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Management */}
          <TabsContent value="data" className="space-y-6">
            <Card data-testid="data-settings-card">
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label>Export Data</Label>
                      <Button variant="outline" data-testid="button-export-data">
                        <Database className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Download all your CRM data in CSV format
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Label>Import Data</Label>
                      <Button variant="outline" data-testid="button-import-data">
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Import leads, clients, or other data from CSV files
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-center space-x-3 mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <Label className="text-red-800">Danger Zone</Label>
                    </div>
                    <p className="text-sm text-red-700 mb-3">
                      These actions cannot be undone. Please proceed with caution.
                    </p>
                    <Button variant="destructive" data-testid="button-delete-account">
                      Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Google OAuth Modal */}
      {showGoogleOAuth && currentUser?.user?.id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
            <GoogleOAuthModal
              userId={currentUser.user.id}
              onSuccess={() => {
                setShowGoogleOAuth(false);
                refetchCalendarStatus();
                toast({
                  title: "Success",
                  description: "Google Calendar connected successfully!"
                });
              }}
              onCancel={() => setShowGoogleOAuth(false)}
            />
          </div>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      <Dialog open={showPurgeModal} onOpenChange={setShowPurgeModal}>
        <DialogContent data-testid="purge-confirmation-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Calendar Events?
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                This will permanently delete all Google Calendar events from the disconnected integration. 
                This action cannot be undone.
              </p>
              {selectedIntegrationToPurge && (
                <p className="text-sm font-medium">
                  Integration: {selectedIntegrationToPurge.email || 'Unknown'}
                </p>
              )}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md mt-3">
                <p className="text-sm text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Want to keep a backup? Export your events first using the "Export (.ics)" button.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPurgeModal(false);
                setSelectedIntegrationToPurge(null);
              }}
              data-testid="button-cancel-purge"
            >
              Cancel
            </Button>
            {selectedIntegrationToPurge && (
              <Button
                variant="outline"
                onClick={() => {
                  handleExportEvents(selectedIntegrationToPurge.id);
                  setShowPurgeModal(false);
                  setSelectedIntegrationToPurge(null);
                }}
                data-testid="button-export-before-purge"
              >
                <Download className="h-4 w-4 mr-2" />
                Export First
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedIntegrationToPurge) {
                  purgeEventsMutation.mutate(selectedIntegrationToPurge.id);
                }
              }}
              disabled={purgeEventsMutation.isPending}
              data-testid="button-confirm-purge"
            >
              {purgeEventsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {purgeEventsMutation.isPending ? 'Purging...' : 'Purge Events'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
