import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  User, Bell, Shield, Palette, Database, Mail, 
  Calendar, Key, Globe, Save, Upload, AlertTriangle, 
  CheckCircle, XCircle, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Google auth status query
  const { data: googleStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/auth/google/status'],
    queryFn: async () => {
      const response = await fetch('/api/auth/google/status', {
        headers: {
          'user-id': 'test-user' // TODO: Get from actual auth context
        }
      });
      return response.json();
    },
  });

  // Disconnect Google mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/google/disconnect', {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Google account disconnected successfully' });
      refetchStatus();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to disconnect Google account',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

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
          <TabsList className="grid w-full grid-cols-6" data-testid="settings-tabs">
            <TabsTrigger value="profile" data-testid="tab-profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              <Globe className="h-4 w-4 mr-2" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="appearance" data-testid="tab-appearance">
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="data" data-testid="tab-data">
              <Database className="h-4 w-4 mr-2" />
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

          {/* Integrations */}
          <TabsContent value="integrations" className="space-y-6">
            <Card data-testid="integrations-settings-card">
              <CardHeader>
                <CardTitle>Third-party Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  {/* Gmail Email Login Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-blue-600" />
                        Gmail Email Login
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {statusLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Checking connection status...
                        </div>
                      ) : (
                        <>
                          {/* Status Display */}
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {googleStatus?.connected ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              <div>
                                <p className="font-medium">
                                  {googleStatus?.connected ? 'Connected' : 'Disconnected'}
                                </p>
                                {googleStatus?.connected && googleStatus?.email && (
                                  <p className="text-sm text-muted-foreground">{googleStatus.email}</p>
                                )}
                              </div>
                            </div>
                            <Badge variant={googleStatus?.connected ? "default" : "secondary"}>
                              {googleStatus?.connected ? 'Connected' : 'Disconnected'}
                            </Badge>
                          </div>

                          {/* Gmail Scopes Check */}
                          {googleStatus?.connected && (!googleStatus?.scopes?.some?.(scope => scope.includes('gmail.send')) || !googleStatus?.scopes?.some?.(scope => scope.includes('gmail.readonly'))) && (
                            <Alert>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Google email access required — please reconnect to grant Gmail permissions.
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
                                  `/auth/google?popup=1&returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`,
                                  'oauth',
                                  features
                                );
                                
                                if (!popup) {
                                  // Fallback if popup blocked
                                  window.location.href = `/auth/google?returnTo=${encodeURIComponent(returnTo)}&origin=${encodeURIComponent(origin)}`;
                                  return;
                                }
                                
                                // Listen for OAuth success/error messages
                                const handleMessage = (event: MessageEvent) => {
                                  if (event.origin !== window.location.origin) return;
                                  
                                  if (event.data.type === 'oauth:success') {
                                    window.removeEventListener('message', handleMessage);
                                    if (popup && !popup.closed) popup.close();
                                    // Refresh Google status
                                    refetchStatus();
                                    toast({ title: 'Google account connected successfully' });
                                  } else if (event.data.type === 'oauth:error') {
                                    window.removeEventListener('message', handleMessage);
                                    if (popup && !popup.closed) popup.close();
                                    toast({
                                      title: 'Failed to connect Google account',
                                      description: event.data.error || 'An error occurred',
                                      variant: 'destructive'
                                    });
                                  }
                                };
                                
                                window.addEventListener('message', handleMessage);
                              }}
                              disabled={statusLoading}
                              data-testid="button-connect-google"
                            >
                              {googleStatus?.connected ? 'Reconnect Google' : 'Connect Google'}
                            </Button>
                            {googleStatus?.connected && (
                              <Button
                                variant="outline"
                                onClick={() => disconnectMutation.mutate()}
                                disabled={disconnectMutation.isPending}
                                data-testid="button-disconnect-google"
                              >
                                {disconnectMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : null}
                                Disconnect Google
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

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium">Calendar Integration</p>
                        <p className="text-sm text-muted-foreground">Sync with Google Calendar</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Connected</Badge>
                  </div>

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

          {/* Appearance */}
          <TabsContent value="appearance" className="space-y-6">
            <Card data-testid="appearance-settings-card">
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select defaultValue="light">
                      <SelectTrigger data-testid="select-theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
    </>
  );
}
