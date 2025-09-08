import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Mail, Loader2, AlertCircle, X, Reply, RefreshCw, List, Layers, FileText, Edit3, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useEmailViewMode } from '@/hooks/useUserPrefs';

interface ProjectEmailPanelProps {
  projectId: string;
  emails?: string[];
}

interface EmailThread {
  id: string;
  subject: string;
  lastMessageAt: string;
  latestEmail: {
    id: string;
    fromEmail: string;
    toEmails: string[];
    subject: string;
    sentAt: string;
    bodyText: string;
    direction: string;
    hasAttachments: boolean;
  };
}

export default function ProjectEmailPanel({ projectId, emails }: ProjectEmailPanelProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyTo, setReplyTo] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Email view mode preference
  const { emailViewMode, setEmailViewMode, isSettingViewMode } = useEmailViewMode();

  // Decode HTML entities in email content
  const decodeHtmlEntities = (text: string) => {
    if (!text) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  // Fetch email templates
  const { data: emailTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/templates'],
    queryFn: async () => {
      const response = await fetch('/api/templates?type=email');
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    }
  });

  // Apply template to compose form
  const applyTemplate = (template: any) => {
    if (template.subject) {
      setSubject(template.subject);
    }
    if (template.body) {
      setMessage(template.body);
    }
    setShowTemplateModal(false);
    toast({ 
      title: 'Template applied', 
      description: `Applied "${template.title}" to your email` 
    });
  };

  // Fetch email signatures
  const { data: emailSignatures, isLoading: signaturesLoading } = useQuery({
    queryKey: ['/api/signatures'],
    queryFn: async () => {
      const response = await fetch('/api/signatures', {
        headers: {
          'user-id': 'test-user' // Using hardcoded user ID for development
        }
      });
      if (!response.ok) throw new Error('Failed to fetch signatures');
      return response.json();
    }
  });

  // Apply signature to compose form
  const applySignature = (signature: any) => {
    const currentMessage = message;
    const signatureContent = signature.content;
    
    // Add signature at the end of the message with proper formatting
    const newMessage = currentMessage ? 
      `${currentMessage}\n\n${signatureContent}` : 
      `\n\n${signatureContent}`;
    
    setMessage(newMessage);
    toast({ 
      title: 'Signature applied', 
      description: `Applied "${signature.name}" signature` 
    });
  };


  // Fetch project details to get contact information
  const { data: project } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      return response.json();
    },
    enabled: !!projectId,
  });

  // Fetch all contacts to find the one matching the project's contactId
  const { data: contacts } = useQuery({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const response = await fetch('/api/contacts');
      return response.json();
    },
  });

  // Find the contact for this project
  const contact = contacts?.find((c: any) => c.id === project?.contactId);

  // Update the 'to' field when contact email is available
  useEffect(() => {
    const emailToUse = contact?.email || emails?.[0] || '';
    if (emailToUse && emailToUse !== to) {
      setTo(emailToUse);
    }
  }, [contact?.email, emails, to]);

  // Fetch individual email messages for the project
  const { data: messagesResponse, isLoading: messagesLoading, error: messagesError } = useQuery({
    queryKey: [`/api/email/projects/${projectId}/email-messages`, contact?.email, emails],
    queryFn: async () => {
      const response = await fetch(`/api/email/projects/${projectId}/email-messages`, {
        headers: {
          'user-id': 'test-user' // TODO: Get from actual auth context
        }
      });
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
    refetchInterval: forceRefresh ? 5000 : 60000,
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: { to: string; subject: string; text: string }) => {
      const response = await apiRequest('POST', '/api/email/send', {
        ...emailData,
        projectId,
        emails
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Email sent successfully!' });
      setTo(contact?.email || emails?.[0] || '');
      setSubject('');
      setMessage('');
      setIsComposing(false);
      // Refresh threads
      queryClient.invalidateQueries({ queryKey: [`/api/email/projects/${projectId}/email-messages`] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send email', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const handleSendEmail = () => {
    if (!to || !subject || !message) {
      toast({ 
        title: 'Missing fields', 
        description: 'Please fill in all required fields',
        variant: 'destructive' 
      });
      return;
    }

    sendEmailMutation.mutate({ to, subject, text: message });
  };

  const formatDate = (dateISO: string) => {
    const date = new Date(dateISO);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/,/, '');
  };


  // Fetch thread details for selected thread only
  const { data: selectedThreadDetails, isLoading: threadLoading } = useQuery({
    queryKey: [`/api/email-threads/${selectedThreadId}/messages`],
    queryFn: async () => {
      if (!selectedThreadId) return null;
      console.log(`🔍 Fetching thread details for: ${selectedThreadId}`);
      const response = await fetch(`/api/email-threads/${selectedThreadId}/messages`, {
        headers: {
          'user-id': 'test-user'
        }
      });
      const data = await response.json();
      console.log(`📧 Thread details response:`, data);
      console.log(`📧 Messages count:`, data?.messages?.length || 0);
      return data;
    },
    enabled: !!selectedThreadId,
  });

  // Reply email mutation
  const replyEmailMutation = useMutation({
    mutationFn: async (emailData: { to: string; subject: string; text: string }) => {
      const response = await apiRequest('POST', '/api/email/send', {
        ...emailData,
        projectId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Reply sent successfully!' });
      setShowReplyForm(false);
      setReplyMessage('');
      // Refresh threads to show the new reply
      queryClient.invalidateQueries({ queryKey: [`/api/email/projects/${projectId}/email-messages`] });
      // Refresh the thread details
      if (selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: [`/api/email-threads/${selectedThreadId}/messages`] });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send reply', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const handleReply = (originalMessage: any) => {
    // Set reply details based on the original message
    const replyToEmail = originalMessage.fromEmail.includes('<') 
      ? originalMessage.fromEmail.match(/<(.+)>/)?.[1] || originalMessage.fromEmail
      : originalMessage.fromEmail;
    
    setReplyTo(replyToEmail);
    setReplySubject(originalMessage.subject.startsWith('Re:') 
      ? originalMessage.subject 
      : `Re: ${originalMessage.subject}`);
    setShowReplyForm(true);
  };

  const handleSendReply = () => {
    if (!replyTo || !replySubject || !replyMessage) {
      toast({ 
        title: 'Missing fields', 
        description: 'Please fill in all required fields',
        variant: 'destructive' 
      });
      return;
    }

    replyEmailMutation.mutate({ 
      to: replyTo, 
      subject: replySubject, 
      text: replyMessage 
    });
  };

  // Extract messages and connection status
  const messages = messagesResponse?.messages || [];
  const needsReconnect = messagesResponse?.needsReconnect || messagesError;

  // Helper function to build RFC threading from individual messages
  const buildRFCThreads = (messages: any[]) => {
    const messageMap = new Map();
    const rootMessages: any[] = [];

    // Build message map
    messages.forEach(msg => {
      messageMap.set(msg.messageId || msg.id, { ...msg, children: [] });
    });

    // Build thread hierarchy using RFC headers
    messages.forEach(msg => {
      const messageObj = messageMap.get(msg.messageId || msg.id);
      if (!messageObj) return;

      if (msg.inReplyTo) {
        const parent = messageMap.get(msg.inReplyTo);
        if (parent) {
          parent.children.push(messageObj);
          messageObj.isReply = true;
          messageObj.depth = (parent.depth || 0) + 1;
        } else {
          rootMessages.push(messageObj);
          messageObj.depth = 0;
        }
      } else {
        rootMessages.push(messageObj);
        messageObj.depth = 0;
      }
    });

    return rootMessages;
  };

  // Process messages based on view mode
  const processedData = emailViewMode === 'unified' 
    ? messages.sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    : buildRFCThreads(messages);

  // Flatten RFC threads for rendering with hierarchy info
  const flattenRFCThreads = (threads: any[]): any[] => {
    const result: any[] = [];
    
    const traverse = (thread: any) => {
      result.push(thread);
      if (thread.children && thread.children.length > 0) {
        thread.children.forEach(traverse);
      }
    };

    threads.forEach(traverse);
    return result;
  };

  const displayData = emailViewMode === 'rfc' ? flattenRFCThreads(processedData) : processedData;

  return (
    <div className="space-y-6">
      {/* Compose Email Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Compose Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isComposing ? (
            <Button 
              onClick={() => setIsComposing(true)}
              className="w-full"
              data-testid="button-start-compose"
            >
              <Send className="h-4 w-4 mr-2" />
              New Email
            </Button>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email-to">To</Label>
                <Input
                  id="email-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Enter email address..."
                  data-testid="input-email-to"
                />
              </div>
              <div>
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject..."
                  data-testid="input-email-subject"
                />
              </div>
              <div>
                <Label htmlFor="email-message">Message</Label>
                <Textarea
                  id="email-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  rows={6}
                  data-testid="textarea-email-message"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSendEmail} 
                  disabled={sendEmailMutation.isPending}
                  data-testid="button-send-email"
                >
                  {sendEmailMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowTemplateModal(true)}
                  data-testid="button-select-template"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Templates
                </Button>
                
                {/* Signature Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline"
                      data-testid="button-select-signature"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Signature
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {signaturesLoading ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </div>
                    ) : emailSignatures?.length === 0 ? (
                      <div className="text-center py-2 text-muted-foreground text-sm">
                        No signatures found
                      </div>
                    ) : (
                      emailSignatures?.map((signature: any) => (
                        <DropdownMenuItem 
                          key={signature.id}
                          onClick={() => applySignature(signature)}
                          data-testid={`dropdown-signature-${signature.id}`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{signature.name}</span>
                            {signature.isDefault && (
                              <span className="text-xs text-muted-foreground">Default</span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button 
                  variant="outline" 
                  onClick={() => setIsComposing(false)}
                  data-testid="button-cancel-compose"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Threads Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Project Email Threads
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View:</span>
                <ToggleGroup 
                  type="single" 
                  value={emailViewMode} 
                  onValueChange={(value) => {
                    if (value && (value === 'unified' || value === 'rfc')) {
                      setEmailViewMode(value);
                    }
                  }}
                  disabled={isSettingViewMode}
                  data-testid="toggle-email-view-mode"
                >
                  <ToggleGroupItem value="unified" size="sm" data-testid="toggle-unified-view">
                    <List className="h-4 w-4 mr-1" />
                    Unified
                  </ToggleGroupItem>
                  <ToggleGroupItem value="rfc" size="sm" data-testid="toggle-rfc-view">
                    <Layers className="h-4 w-4 mr-1" />
                    RFC
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <Button 
                variant="outline" 
                size="sm"
              onClick={async () => {
                try {
                  setForceRefresh(true);
                  
                  // Immediately refresh the UI with existing data
                  queryClient.invalidateQueries({ queryKey: [`/api/email/projects/${projectId}/email-messages`] });
                  toast({ title: 'Refreshing emails...', description: 'Getting latest data and syncing new emails' });
                  
                  // Start background sync without waiting for it
                  fetch('/api/email/sync', { method: 'POST' })
                    .then(response => {
                      if (response.ok) {
                        // Refresh again after sync completes
                        queryClient.invalidateQueries({ queryKey: [`/api/email/projects/${projectId}/email-messages`] });
                        toast({ title: 'Email sync complete', description: 'All latest emails synced' });
                      } else {
                        toast({ 
                          title: 'Background sync had issues', 
                          description: 'Recent emails shown, but sync may need retry',
                          variant: 'destructive' 
                        });
                      }
                    })
                    .catch(error => {
                      console.error('Background sync failed:', error);
                      toast({ 
                        title: 'Background sync failed', 
                        description: 'Showing cached emails - try reconnecting Google',
                        variant: 'destructive' 
                      });
                    });
                  
                } catch (error) {
                  console.error('Refresh failed:', error);
                  toast({ 
                    title: 'Refresh failed', 
                    description: 'Please try again or reconnect Google',
                    variant: 'destructive' 
                  });
                } finally {
                  // Show instant feedback, stop loading after 2 seconds max
                  setTimeout(() => setForceRefresh(false), 2000);
                }
              }}
              disabled={forceRefresh}
              data-testid="button-refresh-emails"
            >
              {forceRefresh ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {needsReconnect && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Gmail access is required to view email threads. 
                <Button 
                  variant="link" 
                  className="px-2" 
                  onClick={() => {
                    const popup = window.open(
                      `/auth/google?popup=true&origin=${encodeURIComponent(window.location.origin)}`,
                      'google-auth',
                      'width=500,height=600,scrollbars=yes,resizable=yes'
                    );
                    
                    const checkClosed = setInterval(() => {
                      if (popup?.closed) {
                        clearInterval(checkClosed);
                        // Refresh the page or refetch data after auth
                        queryClient.invalidateQueries({ queryKey: [`/api/email/projects/${projectId}/email-messages`] });
                      }
                    }, 1000);
                    
                    // Listen for success message from popup
                    const messageListener = (event: MessageEvent) => {
                      if (event.origin !== window.location.origin) return;
                      
                      if (event.data.type === 'oauth:success') {
                        clearInterval(checkClosed);
                        window.removeEventListener('message', messageListener);
                        popup?.close();
                        
                        // Refresh email threads after successful auth
                        queryClient.invalidateQueries({ queryKey: [`/api/email/projects/${projectId}/email-messages`] });
                        toast({ title: 'Google account connected successfully!' });
                      } else if (event.data.type === 'oauth:error') {
                        clearInterval(checkClosed);
                        window.removeEventListener('message', messageListener);
                        popup?.close();
                        
                        toast({ 
                          title: 'Failed to connect Google account', 
                          description: event.data.error,
                          variant: 'destructive' 
                        });
                      }
                    };
                    
                    window.addEventListener('message', messageListener);
                  }}
                  data-testid="button-reconnect-google"
                >
                  Reconnect Google
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading email threads...
            </div>
          ) : displayData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No email threads found for this project</p>
              {emails?.length === 0 && (
                <p className="text-sm mt-2">
                  Add contact emails to the project to see related email threads
                </p>
              )}
            </div>
          ) : emailViewMode === 'unified' ? (
            // Unified View - Flat chronological list of individual messages
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Snippet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((message: any) => (
                  <TableRow 
                    key={message.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedThreadId(message.threadId)}
                    data-testid={`row-message-${message.id}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{formatDate(message.sentAt || new Date().toISOString())}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.sentAt || new Date().toISOString()).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{message.fromEmail || 'Unknown'}</TableCell>
                    <TableCell>{message.subject || 'No subject'}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        message.direction === 'inbound' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {message.direction || 'unknown'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {decodeHtmlEntities(message.snippet || message.bodyText?.substring(0, 100)) || 'No preview'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            // RFC Threading View - Hierarchical view with indentation
            <div className="space-y-2">
              {displayData.map((message: any) => (
                <Card 
                  key={message.id}
                  className={`cursor-pointer hover:bg-muted/50 transition-colors border-l-4 ${
                    message.isReply 
                      ? 'border-l-orange-400 bg-orange-50/30 dark:bg-orange-950/20' 
                      : 'border-l-primary/40 bg-primary/5'
                  }`}
                  style={{ marginLeft: `${(message.depth || 0) * 20}px` }}
                  onClick={() => setSelectedThreadId(message.threadId)}
                  data-testid={`card-message-${message.id}`}
                >
                  <CardHeader className="pb-2 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {message.depth > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {'↳ '.repeat(message.depth)}
                            </span>
                          )}
                          <Layers className="h-3 w-3 text-primary flex-shrink-0" />
                          <CardTitle className="text-sm font-medium truncate">
                            {message.subject || 'No subject'}
                          </CardTitle>
                          {message.isReply && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              Reply
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {message.fromEmail || 'Unknown'}
                          </span>
                          <span>•</span>
                          <span>{formatDate(message.sentAt || new Date().toISOString())}</span>
                          <span>•</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            message.direction === 'inbound' 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                              : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {message.direction || 'unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 py-2">
                    <div className="bg-muted/20 p-2 rounded text-xs">
                      <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                        {decodeHtmlEntities(message.snippet || message.bodyText?.substring(0, 150)) || 'No preview available'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thread Details Modal */}
      <Dialog open={!!selectedThreadId} onOpenChange={() => {
        setSelectedThreadId(null);
        setShowReplyForm(false);
        setReplyMessage('');
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedThreadDetails?.messages?.[0]?.subject || 'Email Thread'}
            </DialogTitle>
            <DialogDescription>
              View the complete email thread conversation and reply to messages
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {threadLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading thread...
              </div>
            ) : selectedThreadDetails?.messages ? (
              <div className="space-y-4">
                {selectedThreadDetails.messages
                  .sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
                  .map((message: any, index: number) => (
                  <Card key={message.id} className="border-l-4 border-l-primary/20">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{message.fromEmail}</p>
                          <p className="text-xs text-muted-foreground">To: {Array.isArray(message.toEmails) ? message.toEmails.join(', ') : message.toEmails}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(message.sentAt)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="whitespace-pre-wrap text-sm bg-muted/30 p-3 rounded max-h-64 overflow-y-auto mb-3">
                        {decodeHtmlEntities(message.bodyText || message.bodyHtml) || 'No content'}
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleReply(message)}
                          data-testid={`button-reply-${message.id}`}
                        >
                          <Reply className="h-4 w-4 mr-2" />
                          Reply
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Reply Form */}
                {showReplyForm && (
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-lg">Reply to Thread</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="reply-to">To</Label>
                        <Input
                          id="reply-to"
                          value={replyTo}
                          onChange={(e) => setReplyTo(e.target.value)}
                          data-testid="input-reply-to"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reply-subject">Subject</Label>
                        <Input
                          id="reply-subject"
                          value={replySubject}
                          onChange={(e) => setReplySubject(e.target.value)}
                          data-testid="input-reply-subject"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reply-message">Message</Label>
                        <Textarea
                          id="reply-message"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          rows={6}
                          data-testid="textarea-reply-message"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowReplyForm(false);
                            setReplyMessage('');
                          }}
                          data-testid="button-cancel-reply"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSendReply}
                          disabled={replyEmailMutation.isPending}
                          data-testid="button-send-reply"
                        >
                          {replyEmailMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Reply
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Failed to load thread details</p>
                {selectedThreadDetails?.error && (
                  <p className="text-sm mt-2">{selectedThreadDetails.error}</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Selection Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Select Email Template
            </DialogTitle>
            <DialogDescription>
              Choose a template to apply to your email. You can modify it after applying.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {templatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading templates...
              </div>
            ) : emailTemplates?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No email templates found</p>
                <p className="text-sm mt-2">
                  Create templates in Settings to use them here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {emailTemplates?.map((template: any) => (
                  <Card 
                    key={template.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-primary/20"
                    onClick={() => applyTemplate(template)}
                    data-testid={`card-template-${template.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold">
                            {template.title}
                          </CardTitle>
                          {template.subject && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Subject: {template.subject}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="bg-muted/30 p-3 rounded text-sm">
                        <p className="text-muted-foreground line-clamp-3 leading-relaxed">
                          {template.body?.substring(0, 200) || 'No preview available'}...
                        </p>
                      </div>
                      <div className="mt-3 flex justify-between items-center text-xs text-muted-foreground">
                        <span>Click to apply template</span>
                        <span className="font-medium">
                          Email Template
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          <div className="border-t pt-4">
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowTemplateModal(false)}
                data-testid="button-close-templates"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}