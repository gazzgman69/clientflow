import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Send, Loader2, X, MessageCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PublicChatWidgetProps {
  slug: string;
}

export default function PublicChatWidget({ slug }: PublicChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate or retrieve session ID
  useEffect(() => {
    const storedSessionId = localStorage.getItem(`chat-session-${slug}`);
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem(`chat-session-${slug}`, newSessionId);
    }
  }, [slug]);

  // Fetch widget settings
  const { data: widgetSettings } = useQuery({
    queryKey: [`/api/public/widget-settings/${slug}`],
    enabled: !!slug,
  });

  // Fetch existing conversation if session exists
  const { data: existingConversation } = useQuery({
    queryKey: [`/api/public/conversations/session/${sessionId}`, slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/conversations/session/${sessionId}?slug=${slug}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch conversation');
      }
      return response.json();
    },
    enabled: !!sessionId && !!slug,
  });

  // Load existing messages when conversation is found
  useEffect(() => {
    if (existingConversation?.id) {
      setConversationId(existingConversation.id);
      // Load messages from conversation
      if (existingConversation.messages) {
        setMessages(existingConversation.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.createdAt)
        })));
      }
    } else if (widgetSettings?.welcomeMessage && messages.length === 0) {
      // Show welcome message if no existing conversation
      setMessages([{
        role: 'assistant',
        content: widgetSettings.welcomeMessage,
        timestamp: new Date()
      }]);
    }
  }, [existingConversation, widgetSettings]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch(`/api/public/chat/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          conversationId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      }]);
      
      // Store conversation ID if new
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }
      
      setInput('');
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;
    
    const userMessage = input.trim();
    
    // Add user message immediately
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);
    
    // Send to backend
    sendMessageMutation.mutate(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const brandColor = widgetSettings?.brandColor || '#3b82f6';
  const chatbotName = widgetSettings?.chatbotName || 'Assistant';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div 
          className="p-6 text-white flex items-center space-x-4"
          style={{ backgroundColor: brandColor }}
        >
          <Avatar className="h-12 w-12 bg-white/20">
            <div className="flex items-center justify-center h-full w-full">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold" data-testid="chatbot-name">{chatbotName}</h2>
            <p className="text-sm opacity-90">We're here to help</p>
          </div>
        </div>

        {/* Messages Container */}
        <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-white">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              data-testid={`message-${message.role}-${index}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
                style={message.role === 'user' ? { backgroundColor: brandColor } : {}}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          
          {sendMessageMutation.isPending && (
            <div className="flex justify-start" data-testid="typing-indicator">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gray-50 border-t">
          <div className="flex space-x-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 min-h-[60px] resize-none"
              disabled={sendMessageMutation.isPending}
              data-testid="input-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessageMutation.isPending}
              className="h-[60px] px-6"
              style={{ backgroundColor: brandColor }}
              data-testid="button-send"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Powered by {widgetSettings?.businessName || 'BusinessCRM'}
          </p>
        </div>
      </Card>
    </div>
  );
}
