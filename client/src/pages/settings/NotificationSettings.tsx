import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Loader2, Bell, Mail, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function NotificationSettingsTab() {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<any>(null);

  // Fetch current notification settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/notification-settings'],
    queryFn: async () => {
      const response = await fetch('/api/notification-settings', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch notification settings');
      }
      return response.json();
    },
  });

  // Initialize local settings when data loads
  if (settings && !localSettings) {
    setLocalSettings(settings);
  }

  // Update notification settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: any) => {
      // Use POST to create or update (the backend handles both)
      const response = await apiRequest('POST', '/api/notification-settings', updatedSettings);
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: 'Settings updated',
        description: 'Your notification preferences have been saved successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notification-settings'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const handleSave = () => {
    if (!localSettings) return;
    updateSettingsMutation.mutate(localSettings);
  };

  const updateLocalSetting = (key: string, value: any) => {
    setLocalSettings((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  if (settingsLoading) {
    return (
      <Card data-testid="notification-settings-card">
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!localSettings) {
    return (
      <Card data-testid="notification-settings-card">
        <CardContent className="p-12">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load notification settings. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Lead Follow-Up Notifications */}
      <Card data-testid="lead-followup-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Lead Follow-Up Notifications
          </CardTitle>
          <CardDescription>
            Get AI-powered alerts when leads need attention based on inactivity and urgency
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable In-App Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inapp-enabled">In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notification bell alerts for urgent leads
              </p>
            </div>
            <Switch
              id="inapp-enabled"
              checked={localSettings.in_app_notifications_enabled}
              onCheckedChange={(checked) => updateLocalSetting('in_app_notifications_enabled', checked)}
              data-testid="switch-inapp-enabled"
            />
          </div>

          <Separator />

          {/* Urgency Thresholds */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="days-without-reply">Days Without Reply Threshold</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Alert when a lead hasn't received a reply in this many days
              </p>
              <Input
                id="days-without-reply"
                type="number"
                min="1"
                max="30"
                value={localSettings.days_without_reply || 3}
                onChange={(e) => updateLocalSetting('days_without_reply', parseInt(e.target.value))}
                data-testid="input-days-without-reply"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="days-since-inquiry">Days Since Inquiry Threshold</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Alert when a lead was created this many days ago without follow-up
              </p>
              <Input
                id="days-since-inquiry"
                type="number"
                min="1"
                max="30"
                value={localSettings.days_since_inquiry || 7}
                onChange={(e) => updateLocalSetting('days_since_inquiry', parseInt(e.target.value))}
                data-testid="input-days-since-inquiry"
              />
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              AI analyzes lead emails and conversation context to determine urgency. 
              Leads meeting either threshold will trigger notifications.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Email Digest Settings */}
      <Card data-testid="email-digest-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Digest Settings
          </CardTitle>
          <CardDescription>
            Receive email summaries of urgent leads that need your attention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Email Digest */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-enabled">Email Digest</Label>
              <p className="text-sm text-muted-foreground">
                Send email notifications for urgent leads
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={localSettings.email_notifications_enabled}
              onCheckedChange={(checked) => updateLocalSetting('email_notifications_enabled', checked)}
              data-testid="switch-email-enabled"
            />
          </div>

          {localSettings.email_notifications_enabled && (
            <>
              <Separator />

              {/* Email Frequency */}
              <div className="space-y-2">
                <Label htmlFor="email-frequency">Email Frequency</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  How often should we send you email digests?
                </p>
                <Select
                  value={localSettings.email_frequency || 'daily'}
                  onValueChange={(value) => updateLocalSetting('email_frequency', value)}
                >
                  <SelectTrigger id="email-frequency" data-testid="select-email-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time (immediate alerts)</SelectItem>
                    <SelectItem value="daily">Daily digest</SelectItem>
                    <SelectItem value="weekly">Weekly digest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {localSettings.email_frequency === 'realtime' && 
                    'You\'ll receive an email immediately when a lead becomes urgent.'
                  }
                  {localSettings.email_frequency === 'daily' && 
                    'You\'ll receive one email per day summarizing all urgent leads.'
                  }
                  {localSettings.email_frequency === 'weekly' && 
                    'You\'ll receive one email per week summarizing all urgent leads.'
                  }
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Auto-Reply Settings */}
      <Card data-testid="auto-reply-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Auto-Reply Settings
          </CardTitle>
          <CardDescription>
            Automatically send acknowledgment emails to new leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Auto-Reply */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoreply-enabled">Enable Auto-Reply</Label>
              <p className="text-sm text-muted-foreground">
                Automatically respond to new lead inquiries
              </p>
            </div>
            <Switch
              id="autoreply-enabled"
              checked={localSettings.auto_reply_enabled}
              onCheckedChange={(checked) => updateLocalSetting('auto_reply_enabled', checked)}
              data-testid="switch-autoreply-enabled"
            />
          </div>

          {localSettings.auto_reply_enabled && (
            <>
              <Separator />

              {/* Auto-Reply Message Template */}
              <div className="space-y-2">
                <Label htmlFor="autoreply-message">Auto-Reply Message</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  This message will be sent automatically to new leads
                </p>
                <Textarea
                  id="autoreply-message"
                  rows={6}
                  placeholder="Thank you for your inquiry! We've received your message and will get back to you within 24 hours..."
                  value={localSettings.auto_reply_message || ''}
                  onChange={(e) => updateLocalSetting('auto_reply_message', e.target.value)}
                  data-testid="textarea-autoreply-message"
                />
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Auto-replies are sent once per lead to acknowledge their initial inquiry. 
                  The system tracks sent auto-replies to avoid duplicate messages.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
          data-testid="button-save-notification-settings"
          size="lg"
        >
          {updateSettingsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save All Settings
            </>
          )}
        </Button>
      </div>
    </>
  );
}
