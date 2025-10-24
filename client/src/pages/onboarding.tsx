import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Send, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface OnboardingStatus {
  id: string;
  isCompleted: boolean;
  isSkipped: boolean;
  currentStep: string;
  completedSteps?: string[];
  collectedData: any;
}

const STEPS = [
  { key: 'business_info', label: 'Business Information' },
  { key: 'services', label: 'Services & Offerings' },
  { key: 'availability', label: 'Scheduler Setup' },
  { key: 'email_integration', label: 'Email & Calendar' },
  { key: 'widget_config', label: 'Chat Widget' },
  { key: 'complete', label: 'Complete' }
];

export default function OnboardingPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch onboarding status
  const { data: statusData } = useQuery({
    queryKey: ['/api/ai-onboarding/status'],
    refetchOnMount: true
  });

  useEffect(() => {
    if (statusData?.status) {
      setStatus(statusData.status);
      
      // If already complete, redirect to dashboard
      if (statusData.status.isCompleted) {
        navigate('/');
        return;
      }

      // Restore conversation history if exists
      const collectedData = statusData.status.collectedData || {};
      if (collectedData.conversationHistory) {
        const history = collectedData.conversationHistory;
        // Filter out system messages
        const userMessages = history.filter((msg: any) => 
          msg.role === 'assistant' || msg.role === 'user'
        );
        setMessages(userMessages);
      }
    }
  }, [statusData, navigate]);

  // Start onboarding mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai-onboarding/start', {});
      return response.json();
    },
    onSuccess: (data) => {
      setMessages([{ role: 'assistant', content: data.message }]);
    },
    onError: () => {
      toast({
        title: 'Failed to start onboarding',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/ai-onboarding/chat', { message });
      return response.json();
    },
    onSuccess: async (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      setInput('');
      
      // Refresh status after each message
      await queryClient.invalidateQueries({ queryKey: ['/api/ai-onboarding/status'] });
      
      // Check if completed
      const updatedStatus = await queryClient.fetchQuery({
        queryKey: ['/api/ai-onboarding/status']
      }) as { status: OnboardingStatus };
      
      if (updatedStatus?.status?.isCompleted) {
        toast({
          title: '✨ Setup Complete!',
          description: 'Your CRM is ready to go'
        });
        setTimeout(() => navigate('/'), 1000);
      }
    },
    onError: () => {
      toast({
        title: 'Failed to send message',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatMutation.isPending]);

  // Start onboarding on mount if no messages
  useEffect(() => {
    if (messages.length === 0 && !startMutation.isPending && statusData) {
      startMutation.mutate();
    }
  }, [statusData]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    chatMutation.mutate(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSkip = async () => {
    try {
      // Get current onboarding progress
      const statusResponse = await queryClient.fetchQuery({
        queryKey: ['/api/ai-onboarding/status']
      }) as { status: OnboardingStatus | null };
      
      if (statusResponse?.status) {
        // Update to mark as skipped
        await apiRequest('PATCH', `/api/ai-features/onboarding/${statusResponse.status.id}`, {
          isSkipped: true,
          skippedAt: new Date().toISOString()
        });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['/api/ai-onboarding/status'] });
      
      toast({
        title: 'Onboarding skipped',
        description: 'You can complete setup anytime from settings'
      });
      
      navigate('/');
    } catch (error) {
      toast({
        title: 'Failed to skip onboarding',
        variant: 'destructive'
      });
    }
  };

  // Calculate progress
  const currentStepIndex = STEPS.findIndex(s => s.key === status?.currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              Welcome to Your CRM
            </h1>
          </div>
          <p className="text-muted-foreground">
            Let's get you set up in just a few minutes with our AI assistant
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {STEPS.map((step, idx) => (
              <div
                key={step.key}
                className="flex items-center gap-2"
                data-testid={`step-${step.key}`}
              >
                {idx <= currentStepIndex ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={`text-xs ${idx <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" data-testid="progress-bar" />
        </div>

        {/* Chat Container */}
        <Card className="mb-4 shadow-lg">
          <div className="h-[500px] flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="messages-container">
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${message.role}-${idx}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-3 w-3" />
                        <span className="text-xs font-semibold">AI Assistant</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {/* Typing Indicator */}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4 bg-background">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                  className="min-h-[60px] max-h-[120px] resize-none"
                  disabled={chatMutation.isPending}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || chatMutation.isPending}
                  size="lg"
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Skip Button */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={handleSkip}
            data-testid="button-skip"
          >
            Skip setup for now
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            You can complete this setup anytime from your settings
          </p>
        </div>
      </div>
    </div>
  );
}
