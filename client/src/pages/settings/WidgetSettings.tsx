import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  MessageCircle, Save, Copy, Check, ExternalLink, 
  Loader2, Palette, Settings2, Code, Bot
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertWidgetSettingsSchema } from "@shared/schema";
import { z } from "zod";

// Form validation schema with extended rules
const formSchema = insertWidgetSettingsSchema.extend({
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  avatarUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

export default function WidgetSettings() {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Fetch widget settings
  const { data: widgetSettings, isLoading } = useQuery({
    queryKey: ['/api/ai-features/widget-settings'],
  });

  // Initialize form with react-hook-form and zodResolver
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (widgetSettings) {
      form.reset({
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
  }, [widgetSettings, form]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (settings: FormValues) => {
      const response = await apiRequest('POST', '/api/ai-features/widget-settings', settings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Widget settings saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/widget-settings'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to save widget settings',
        description: error instanceof Error ? error.message : "An error occurred",
        variant: 'destructive'
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  // Safe access to window/navigator
  const embedCode = typeof window !== 'undefined' 
    ? `<script src="${window.location.origin}/widget.js" data-tenant-id="YOUR_TENANT_ID"></script>`
    : '';

  const standaloneUrl = typeof window !== 'undefined' ? `${window.location.origin}/chat` : '';

  const handleCopyEmbed = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(embedCode);
        setIsCopied(true);
        toast({ title: 'Embed code copied to clipboard' });
        setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
        toast({
          title: 'Failed to copy',
          description: 'Please manually copy the code',
          variant: 'destructive'
        });
      }
    } else {
      toast({
        title: 'Clipboard not supported',
        description: 'Please manually copy the code',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-widget-settings" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6" data-testid="page-widget-settings">
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
                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel data-testid="label-enabled">Enable Widget</FormLabel>
                        <FormDescription>
                          Make the widget visible on your website
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enabled"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chatbotName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-chatbot-name">Chatbot Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Assistant" data-testid="input-chatbot-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="welcomeMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-welcome-message">Welcome Message</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Hi! How can I help you today?" rows={3} data-testid="textarea-welcome-message" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-avatar-url">Avatar URL (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/avatar.png" data-testid="input-avatar-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <FormField
                  control={form.control}
                  name="brandColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-brand-color">Brand Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            type="color"
                            value={field.value}
                            onChange={field.onChange}
                            className="w-20 h-10"
                            data-testid="input-brand-color"
                          />
                        </FormControl>
                        <FormControl>
                          <Input
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="#3b82f6"
                            data-testid="input-brand-color-text"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-position">Widget Position</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-position">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bottom-right" data-testid="option-bottom-right">Bottom Right</SelectItem>
                          <SelectItem value="bottom-left" data-testid="option-bottom-left">Bottom Left</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Preview</p>
                  <div className="relative h-40 bg-background border rounded-lg overflow-hidden">
                    <div 
                      className={`absolute ${form.watch('position') === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'}`}
                    >
                      <div 
                        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                        style={{ backgroundColor: form.watch('brandColor') }}
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
                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-tone">Conversation Tone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tone">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="professional" data-testid="option-professional">Professional</SelectItem>
                          <SelectItem value="friendly" data-testid="option-friendly">Friendly</SelectItem>
                          <SelectItem value="casual" data-testid="option-casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bookingPromptAggressiveness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-booking-prompt">Booking Prompt Aggressiveness</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-booking-prompt">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" data-testid="option-none">None - Never suggest booking</SelectItem>
                          <SelectItem value="gentle" data-testid="option-gentle">Gentle - Subtle suggestions</SelectItem>
                          <SelectItem value="moderate" data-testid="option-moderate">Moderate - Regular prompts</SelectItem>
                          <SelectItem value="aggressive" data-testid="option-aggressive">Aggressive - Frequent prompts</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="collectEmailBefore"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel data-testid="label-collect-email">Collect Email Before Chat</FormLabel>
                        <FormDescription>
                          Require visitors to provide their email before chatting
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-collect-email"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableSoundNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel data-testid="label-sound-notifications">Sound Notifications</FormLabel>
                        <FormDescription>
                          Play sound when new messages arrive
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-sound-notifications"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableTypingIndicator"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel data-testid="label-typing-indicator">Typing Indicator</FormLabel>
                        <FormDescription>
                          Show typing indicator when AI is responding
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-typing-indicator"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
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
                  <FormLabel data-testid="label-embed-code">Widget Embed Code</FormLabel>
                  <div className="relative">
                    <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                      <code data-testid="code-embed">{embedCode}</code>
                    </pre>
                    <Button
                      type="button"
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
                  <FormLabel data-testid="label-standalone-link">Standalone Chat Page</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={standaloneUrl}
                      data-testid="input-standalone-link"
                    />
                    <Button type="button" variant="outline" asChild data-testid="button-open-chat">
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
            type="submit"
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
      </form>
    </Form>
  );
}
