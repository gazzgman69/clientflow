import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, Save, Copy, Check, ExternalLink, 
  Loader2, Palette, Settings2, Code, Eye, Bot
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function WidgetSettings() {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Fetch widget settings
  const { data: widgetSettings, isLoading } = useQuery({
    queryKey: ['/api/ai-features/widget-settings'],
  });

  // Form state
  const [formData, setFormData] = useState({
    isEnabled: true,
    welcomeMessage: 'Hi! How can I help you today?',
    brandColor: '#3b82f6',
    position: 'bottom-right',
    chatbotName: 'Assistant',
    avatarUrl: '',
    tone: 'professional',
    bookingPromptAggressiveness: 'gentle',
    collectEmailBefore: false,
    enableSoundNotifications: true,
    enableTypingIndicator: true,
  });

  // Update form when data loads
  useEffect(() => {
    if (widgetSettings) {
      setFormData({
        isEnabled: widgetSettings.isEnabled ?? true,
        welcomeMessage: widgetSettings.welcomeMessage ?? 'Hi! How can I help you today?',
        brandColor: widgetSettings.brandColor ?? '#3b82f6',
        position: widgetSettings.position ?? 'bottom-right',
        chatbotName: widgetSettings.chatbotName ?? 'Assistant',
        avatarUrl: widgetSettings.avatarUrl ?? '',
        tone: widgetSettings.tone ?? 'professional',
        bookingPromptAggressiveness: widgetSettings.bookingPromptAggressiveness ?? 'gentle',
        collectEmailBefore: widgetSettings.collectEmailBefore ?? false,
        enableSoundNotifications: widgetSettings.enableSoundNotifications ?? true,
        enableTypingIndicator: widgetSettings.enableTypingIndicator ?? true,
      });
    }
  }, [widgetSettings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (settings: typeof formData) => {
      const response = await apiRequest('POST', '/api/ai-features/widget-settings', settings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Widget settings saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/widget-settings'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save widget settings',
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const embedCode = `<script src="${window.location.origin}/widget.js" data-tenant-id="YOUR_TENANT_ID"></script>`;

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setIsCopied(true);
    toast({ title: 'Embed code copied to clipboard' });
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-widget-settings" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-widget-settings">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="title-widget-settings">AI Chat Widget</h2>
        <p className="text-muted-foreground" data-testid="description-widget-settings">
          Configure your AI-powered chat widget for your website
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-widget-settings">
        <TabsList data-testid="tabs-list-widget">
          <TabsTrigger value="general" data-testid="tab-general">
            <Settings2 className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="appearance" data-testid="tab-appearance">
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="behavior" data-testid="tab-behavior">
            <Bot className="mr-2 h-4 w-4" />
            Behavior
          </TabsTrigger>
          <TabsTrigger value="embed" data-testid="tab-embed">
            <Code className="mr-2 h-4 w-4" />
            Embed Code
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6" data-testid="content-general">
          <Card data-testid="card-general-settings">
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure basic widget settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isEnabled" data-testid="label-enabled">Enable Widget</Label>
                  <p className="text-sm text-muted-foreground">
                    Make the widget visible on your website
                  </p>
                </div>
                <Switch
                  id="isEnabled"
                  data-testid="switch-enabled"
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chatbotName" data-testid="label-chatbot-name">Chatbot Name</Label>
                <Input
                  id="chatbotName"
                  data-testid="input-chatbot-name"
                  value={formData.chatbotName}
                  onChange={(e) => setFormData({ ...formData, chatbotName: e.target.value })}
                  placeholder="Assistant"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcomeMessage" data-testid="label-welcome-message">Welcome Message</Label>
                <Textarea
                  id="welcomeMessage"
                  data-testid="textarea-welcome-message"
                  value={formData.welcomeMessage}
                  onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                  placeholder="Hi! How can I help you today?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl" data-testid="label-avatar-url">Avatar URL (Optional)</Label>
                <Input
                  id="avatarUrl"
                  data-testid="input-avatar-url"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  placeholder="https://example.com/avatar.png"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6" data-testid="content-appearance">
          <Card data-testid="card-appearance-settings">
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>Customize the look and feel of your widget</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="brandColor" data-testid="label-brand-color">Brand Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="brandColor"
                    data-testid="input-brand-color"
                    type="color"
                    value={formData.brandColor}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    data-testid="input-brand-color-text"
                    value={formData.brandColor}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position" data-testid="label-position">Widget Position</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                >
                  <SelectTrigger id="position" data-testid="select-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right" data-testid="option-bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="bottom-left" data-testid="option-bottom-left">Bottom Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Preview</p>
                <div className="relative h-40 bg-background border rounded-lg overflow-hidden">
                  <div 
                    className={`absolute ${formData.position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'}`}
                  >
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                      style={{ backgroundColor: formData.brandColor }}
                    >
                      <MessageCircle className="h-7 w-7 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Behavior Settings */}
        <TabsContent value="behavior" className="space-y-6" data-testid="content-behavior">
          <Card data-testid="card-behavior-settings">
            <CardHeader>
              <CardTitle>Behavior Settings</CardTitle>
              <CardDescription>Configure how the AI assistant behaves</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tone" data-testid="label-tone">Conversation Tone</Label>
                <Select
                  value={formData.tone}
                  onValueChange={(value) => setFormData({ ...formData, tone: value })}
                >
                  <SelectTrigger id="tone" data-testid="select-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional" data-testid="option-professional">Professional</SelectItem>
                    <SelectItem value="friendly" data-testid="option-friendly">Friendly</SelectItem>
                    <SelectItem value="casual" data-testid="option-casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bookingPrompt" data-testid="label-booking-prompt">Booking Prompt Aggressiveness</Label>
                <Select
                  value={formData.bookingPromptAggressiveness}
                  onValueChange={(value) => setFormData({ ...formData, bookingPromptAggressiveness: value })}
                >
                  <SelectTrigger id="bookingPrompt" data-testid="select-booking-prompt">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" data-testid="option-none">None - Never suggest booking</SelectItem>
                    <SelectItem value="gentle" data-testid="option-gentle">Gentle - Subtle suggestions</SelectItem>
                    <SelectItem value="moderate" data-testid="option-moderate">Moderate - Regular prompts</SelectItem>
                    <SelectItem value="aggressive" data-testid="option-aggressive">Aggressive - Frequent prompts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="collectEmail" data-testid="label-collect-email">Collect Email Before Chat</Label>
                  <p className="text-sm text-muted-foreground">
                    Require visitors to provide their email before chatting
                  </p>
                </div>
                <Switch
                  id="collectEmail"
                  data-testid="switch-collect-email"
                  checked={formData.collectEmailBefore}
                  onCheckedChange={(checked) => setFormData({ ...formData, collectEmailBefore: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="soundNotifications" data-testid="label-sound-notifications">Sound Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Play sound when new messages arrive
                  </p>
                </div>
                <Switch
                  id="soundNotifications"
                  data-testid="switch-sound-notifications"
                  checked={formData.enableSoundNotifications}
                  onCheckedChange={(checked) => setFormData({ ...formData, enableSoundNotifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="typingIndicator" data-testid="label-typing-indicator">Typing Indicator</Label>
                  <p className="text-sm text-muted-foreground">
                    Show typing indicator when AI is responding
                  </p>
                </div>
                <Switch
                  id="typingIndicator"
                  data-testid="switch-typing-indicator"
                  checked={formData.enableTypingIndicator}
                  onCheckedChange={(checked) => setFormData({ ...formData, enableTypingIndicator: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Embed Code */}
        <TabsContent value="embed" className="space-y-6" data-testid="content-embed">
          <Card data-testid="card-embed-code">
            <CardHeader>
              <CardTitle>Embed Code</CardTitle>
              <CardDescription>Add this code to your website to enable the chat widget</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert data-testid="alert-embed-info">
                <AlertDescription>
                  Copy the code below and paste it before the closing <code>&lt;/body&gt;</code> tag in your website's HTML.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label data-testid="label-embed-code">Widget Embed Code</Label>
                <div className="relative">
                  <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                    <code data-testid="code-embed">{embedCode}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleCopyEmbed}
                    data-testid="button-copy-embed"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label data-testid="label-standalone-link">Standalone Chat Page</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/chat`}
                    data-testid="input-standalone-link"
                  />
                  <Button variant="outline" asChild data-testid="button-open-chat">
                    <a href="/chat" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </a>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share this link to give visitors direct access to your AI assistant
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          data-testid="button-save-widget-settings"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
