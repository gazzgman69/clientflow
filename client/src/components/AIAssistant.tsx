import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Send, Loader2, Sparkles, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any; // Structured data from AI (like query results)
  actions?: Array<{
    type: string;
    label: string;
    data?: any;
  }>;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const queryMutation = useMutation({
    mutationFn: async ({ query, history }: { query: string; history: Array<{ role: 'user' | 'assistant'; content: string }> }) => {
      const response = await apiRequest('POST', '/api/ai/assistant/query', { 
        query,
        conversationHistory: history
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      // Add assistant's response
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        data: data.data,
        actions: data.actions
      }]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process query",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      // ScrollArea wraps the viewport, need to find the actual scrollable element
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, queryMutation.isPending]);

  const handleSend = () => {
    if (!input.trim() || queryMutation.isPending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    // Build conversation history from existing messages (exclude data field, just role and content)
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    setMessages(prev => [...prev, userMessage]);
    queryMutation.mutate({ 
      query: input,
      history: conversationHistory
    });
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAction = (action: { type: string; label: string; data?: any }) => {
    switch (action.type) {
      case 'compose_email':
        // Navigate to project page and auto-open email composer
        if (action.data?.projectId) {
          const params = new URLSearchParams({ action: 'compose_email' });
          if (action.data.contactId) params.set('contactId', action.data.contactId);
          setLocation(`/projects/${action.data.projectId}?${params.toString()}`);
          onClose(); // Close the assistant
        } else if (action.data?.contactId) {
          // Navigate to contact detail page with auto-open email
          setLocation(`/contacts/${action.data.contactId}?action=compose_email`);
          onClose();
        } else {
          toast({
            title: "No project or contact",
            description: "Please specify which project or contact to email",
            variant: "destructive"
          });
        }
        break;
      
      case 'view_project':
        if (action.data?.projectId) {
          setLocation(`/projects/${action.data.projectId}`);
          onClose();
        }
        break;
      
      case 'create_quote':
        // Navigate to quotes page and auto-open create dialog
        const quoteParams = new URLSearchParams({ action: 'create' });
        if (action.data?.contactId) quoteParams.set('contactId', action.data.contactId);
        setLocation(`/quotes?${quoteParams.toString()}`);
        onClose();
        break;
      
      case 'create_invoice':
        // Navigate to invoices page and auto-open create dialog
        const invoiceParams = new URLSearchParams({ action: 'create' });
        if (action.data?.projectId) invoiceParams.set('projectId', action.data.projectId);
        if (action.data?.contactId) invoiceParams.set('contactId', action.data.contactId);
        setLocation(`/invoices?${invoiceParams.toString()}`);
        onClose();
        break;
      
      case 'create_task':
        // Navigate to project page and auto-open task creation
        if (action.data?.projectId) {
          setLocation(`/projects/${action.data.projectId}?action=create_task`);
          onClose();
        } else {
          toast({
            title: "Task creation",
            description: "Tasks are created within projects. Please open a project to add tasks.",
          });
        }
        break;
      
      default:
        toast({
          title: "Action not supported",
          description: `The action "${action.type}" is not yet implemented`,
          variant: "destructive"
        });
    }
  };

  const exampleQueries = [
    "How many projects do I have?",
    "What's my revenue this month?",
    "Show me unpaid invoices",
    "What gigs do I have next month?",
    "Who are my top clients?"
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 h-[600px] flex flex-col shadow-2xl rounded-lg border bg-background">
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">CRM Assistant</CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-assistant">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <Sparkles className="h-12 w-12 text-muted-foreground opacity-50" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Ask me anything about your CRM data
                </p>
                <div className="space-y-2 pt-4">
                  <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
                  {exampleQueries.map((query, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(query)}
                      className="block w-full text-left text-xs p-2 rounded bg-muted hover:bg-muted/80 transition-colors"
                      data-testid={`example-query-${idx}`}
                    >
                      "{query}"
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                data-testid={`message-${message.role}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                
                {/* Action buttons for assistant messages */}
                {message.role === 'assistant' && message.actions && message.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 max-w-[80%]">
                    {message.actions.map((action, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(action)}
                        className="text-xs"
                        data-testid={`button-action-${action.type}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {queryMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your CRM..."
            disabled={queryMutation.isPending}
            data-testid="input-assistant-query"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || queryMutation.isPending}
            data-testid="button-send-query"
          >
            {queryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper to render structured data
function renderData(data: any): React.ReactNode {
  if (Array.isArray(data)) {
    return (
      <div className="space-y-1">
        {data.map((item, idx) => (
          <div key={idx} className="text-xs">
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </div>
        ))}
      </div>
    );
  }
  
  if (typeof data === 'object' && data !== null) {
    return (
      <div className="space-y-1">
        {Object.entries(data).map(([key, value]) => {
          // Handle array values
          if (Array.isArray(value)) {
            return (
              <div key={key} className="text-xs">
                <span className="font-medium">{key}:</span> {value.length} items
              </div>
            );
          }
          // Handle object values
          if (typeof value === 'object' && value !== null) {
            return (
              <div key={key} className="text-xs">
                <span className="font-medium">{key}:</span> {JSON.stringify(value)}
              </div>
            );
          }
          // Handle primitive values
          return (
            <div key={key} className="text-xs">
              <span className="font-medium">{key}:</span> {String(value)}
            </div>
          );
        })}
      </div>
    );
  }
  
  return <span className="text-xs">{String(data)}</span>;
}

// Floating button to open assistant
export function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AIAssistant isOpen={isOpen} onClose={() => setIsOpen(false)} />
      
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
          size="icon"
          data-testid="button-open-assistant"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}
    </>
  );
}
