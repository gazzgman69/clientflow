import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Mail, Loader2, AlertCircle, X, Reply, RefreshCw, FileText, Edit3, ChevronDown, Paperclip } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { TokenDropdown } from '@/components/ui/token-dropdown';
import { insertTokenIntoValue } from '@/utils/cursor-utils';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor';

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
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [replyTo, setReplyTo] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [updateTemplate, setUpdateTemplate] = useState(false);
  const messageEditorRef = useRef<RichTextEditorRef>(null);
  const replyEditorRef = useRef<RichTextEditorRef>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current authenticated user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });
  
  // Always use unified view (individual emails, not threaded)
  const emailViewMode = 'unified';

  // Decode HTML entities in email content
  const decodeHtmlEntities = (text: string) => {
    if (!text) return text;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return doc.documentElement.textContent || text;
    } catch (error) {
      // Fallback to original text if parsing fails
      return text;
    }
  };

  // Helper function to extract content from full email HTML template
  const extractEmailContent = (html: string): string => {
    if (!html) return '';
    
    // Try to extract content from the email-content class
    const emailContentMatch = html.match(/<td[^>]*class[^>]*email-content[^>]*>([\s\S]*?)<\/td>/);
    if (emailContentMatch) {
      return emailContentMatch[1].trim();
    }
    
    // Fallback: extract content from body, removing style and script tags
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    if (bodyMatch) {
      return bodyMatch[1]
        .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
        .replace(/^\s*<table[^>]*>[\s\S]*?<tr>\s*<td[^>]*>/, '') // Remove opening table/tr/td
        .replace(/<\/td>\s*<\/tr>[\s\S]*?<\/table>\s*$/, '') // Remove closing td/tr/table
        .trim();
    }
    
    // Final fallback: return as-is (probably plain text)
    return html;
  };

  // Token resolver function for displaying emails
  const resolveDisplayTokens = (text: string, project: any, contact: any) => {
    if (!text) return text;
    
    const tokens = {
      '[FirstName]': contact?.name?.split(' ')[0] || '[FirstName]',
      '[LastName]': contact?.name?.split(' ').slice(1).join(' ') || '[LastName]',
      '[Email]': contact?.email || '[Email]',
      '[Phone]': contact?.phone || '[Phone]',
      '[Company]': contact?.company || '[Company]',
      '[ProjectName]': project?.name || '[ProjectName]',
      '[ProjectDate]': project?.date ? new Date(project.date).toLocaleDateString() : '[ProjectDate]',
      '{{contact.firstName}}': contact?.name?.split(' ')[0] || 'there',
      '{{contact.lastName}}': contact?.name?.split(' ').slice(1).join(' ') || '',
      '{{contact.email}}': contact?.email || '',
      '{{contact.phone}}': contact?.phone || '',
      '{{contact.company}}': contact?.company || '',
      '{{project.name}}': project?.name || '',
      '{{project.date}}': project?.date ? new Date(project.date).toLocaleDateString() : '',
    };
    
    let resolved = text;
    Object.entries(tokens).forEach(([token, value]) => {
      resolved = resolved.replace(new RegExp(escapeRegex(token), 'g'), value || '');
    });
    
    return resolved;
  };

  // Helper function to escape regex special characters
  const escapeRegex = (text: string) => {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      // Also update the Rich Text Editor content directly
      if (messageEditorRef.current) {
        messageEditorRef.current.setContent(template.body);
      }
    }
    setSelectedTemplate(template);
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
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch signatures');
      return response.json();
    },
    enabled: !!currentUser,
  });

  // Apply signature to compose form
  const applySignature = (signature: any) => {
    if (messageEditorRef.current) {
      const added = messageEditorRef.current.appendSignature(signature.content);
      if (!added) {
        toast({ 
          title: 'Signature already added', 
          description: 'This signature is already present in the email body.',
          variant: 'destructive'
        });
      } else {
        toast({ 
          title: 'Signature applied', 
          description: `Applied "${signature.name}" signature` 
        });
      }
    }
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
  const { data: contactsResponse } = useQuery({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const response = await fetch('/api/contacts');
      return response.json();
    },
  });

  // Extract contacts array from response object
  const contacts = contactsResponse?.contacts || [];

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
      console.log(`🔍 Fetching emails for project: ${projectId}`);
      const response = await fetch(`/api/email/projects/${projectId}/email-messages`, {
        credentials: 'include'
      });
      const data = await response.json();
      console.log(`📧 Email response:`, data);
      if (!response.ok) {
        console.error(`❌ Email fetch failed:`, response.status, data);
      }
      return data;
    },
    enabled: !!projectId && !!currentUser,
    staleTime: 30000,
    refetchInterval: forceRefresh ? 5000 : 60000,
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (templateData: { id: string; subject: string; body: string }) => {
      const response = await apiRequest('PATCH', `/api/admin/templates/${templateData.id}`, {
        subject: templateData.subject,
        body: templateData.body
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: 'Template updated!', 
        description: 'Template has been updated with current email content' 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/templates'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update template', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: { to: string; subject: string; html: string }) => {
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
      setSelectedTemplate(null);
      setUpdateTemplate(false);
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

    // Get HTML content from the Rich Text Editor
    const emailBody = messageEditorRef.current?.getHTML() || message;
    
    // Debug: Log what we're sending
    console.log('🔍 EMAIL SEND DEBUG:');
    console.log('  message state:', message.substring(0, 100));
    console.log('  getHTML():', messageEditorRef.current?.getHTML()?.substring(0, 100));
    console.log('  emailBody (final):', emailBody.substring(0, 100));
    
    // Update template if checkbox is checked and a template is selected
    if (updateTemplate && selectedTemplate) {
      updateTemplateMutation.mutate({
        id: selectedTemplate.id,
        subject: subject,
        body: emailBody
      });
    }

    sendEmailMutation.mutate({ to, subject, html: emailBody });
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
        credentials: 'include'
      });
      const data = await response.json();
      console.log(`📧 Thread details response:`, data);
      console.log(`📧 Messages count:`, data?.messages?.length || 0);
      return data;
    },
    enabled: !!selectedThreadId && !!currentUser,
  });

  // Reply email mutation
  const replyEmailMutation = useMutation({
    mutationFn: async (emailData: { to: string; subject: string; html: string }) => {
      const response = await apiRequest('POST', '/api/email/send', {
        ...emailData,
        projectId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Reply sent successfully!' });
      setShowReplyDialog(false);
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
    const subject = originalMessage.subject || '';
    setReplySubject(subject.startsWith('Re:') 
      ? subject 
      : `Re: ${subject}`);
    setReplyMessage(''); // Clear previous message
    setShowReplyDialog(true);
    setSelectedEmail(null); // Close the email detail dialog
  };

  const handleSendReply = () => {
    // Get HTML content from the Reply Rich Text Editor
    const replyBody = replyEditorRef.current?.getHTML() || replyMessage;
    
    if (!replyTo || !replySubject || !replyBody) {
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
      html: replyBody 
    });
    
    // Close dialog and clear form
    setShowReplyDialog(false);
    setReplyTo('');
    setReplySubject('');
    setReplyMessage('');
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

    // Sort function to order by date (newest first)
    const sortByDate = (a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();

    // Recursively sort children within each thread
    const sortChildren = (thread: any) => {
      if (thread.children && thread.children.length > 0) {
        thread.children.sort(sortByDate);
        thread.children.forEach(sortChildren);
      }
    };

    // Sort root messages and their children
    rootMessages.sort(sortByDate);
    rootMessages.forEach(sortChildren);

    return rootMessages;
  };

  // Always show emails as individual messages sorted by date (newest first)
  const displayData = messages.sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

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
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="email-subject">Subject</Label>
                  <TokenDropdown
                    onTokenSelect={(token) => {
                      // Insert token at the end of the subject
                      setSubject(prev => prev + (prev ? ' ' : '') + token);
                    }}
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary hover:text-primary/80"
                    data-testid="link-insert-subject-token"
                  />
                </div>
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
                <RichTextEditor
                  ref={messageEditorRef}
                  content={message}
                  onChange={setMessage}
                  placeholder="Enter your message..."
                  minHeight="300px"
                  data-testid="editor-email-message"
                  onTokenInsert={(insertToken) => (
                    <TokenDropdown
                      onTokenSelect={insertToken}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    />
                  )}
                  onSignatureSelect={() => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          data-testid="button-select-signature"
                        >
                          <Edit3 className="h-2.5 w-2.5 mr-1" />
                          Signature
                          <ChevronDown className="h-2.5 w-2.5 ml-1" />
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
                  )}
                  onTemplateSelect={() => (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowTemplateModal(true)}
                      data-testid="button-select-template"
                    >
                      <FileText className="h-2.5 w-2.5 mr-1" />
                      Template
                    </Button>
                  )}
                />
              </div>
              
              <div className="flex gap-2 items-center">
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
                  onClick={() => setIsComposing(false)}
                  data-testid="button-cancel-compose"
                >
                  Cancel
                </Button>

                {/* Update Template Checkbox */}
                {selectedTemplate && (
                  <div className="flex items-center space-x-2 ml-auto">
                    <Checkbox 
                      id="update-template"
                      checked={updateTemplate}
                      onCheckedChange={(checked) => setUpdateTemplate(checked === true)}
                      data-testid="checkbox-update-template"
                    />
                    <Label 
                      htmlFor="update-template" 
                      className="text-sm font-medium cursor-pointer"
                    >
                      Update template
                    </Label>
                  </div>
                )}
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
              Project Emails
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
                  
                  // Start background sync using apiRequest to handle CSRF tokens
                  apiRequest('POST', '/api/email/sync', {})
                    .then(response => response.json())
                    .then(result => {
                      console.log('Email sync result:', result);
                      if (result.success !== false && result.ok !== false) {
                        // Refresh again after sync completes
                        queryClient.invalidateQueries({ queryKey: [`/api/email/projects/${projectId}/email-messages`] });
                        toast({ title: 'Email sync complete', description: 'All latest emails synced' });
                      } else {
                        const errorMessage = result.error || result.message || 'Recent emails shown, but sync may need retry';
                        toast({ 
                          title: 'Background sync had issues', 
                          description: errorMessage,
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
              <p>No emails found for this project</p>
              {emails?.length === 0 && (
                <p className="text-sm mt-2">
                  Add contact emails to the project to see related emails
                </p>
              )}
            </div>
          ) : (
            // 17hats-style email list
            <div className="space-y-1">
              {displayData.map((message: any) => {
                const messageDate = new Date(message.sentAt || new Date());
                const month = messageDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                const day = messageDate.getDate().toString().padStart(2, '0');
                
                return (
                  <div 
                    key={message.id}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                    onClick={() => setSelectedEmail(message)}
                    data-testid={`row-message-${message.id}`}
                  >
                    {/* Date Badge */}
                    <div 
                      className="w-14 shrink-0 flex flex-col items-center justify-center rounded-md bg-muted py-2 text-center"
                      data-testid={`badge-date-${messageDate.getFullYear()}${(messageDate.getMonth() + 1).toString().padStart(2, '0')}${day}`}
                    >
                      <span className="text-xs font-medium text-muted-foreground">{month}</span>
                      <span className="text-lg font-bold">{day}</span>
                    </div>

                    {/* Email Content */}
                    <div className="flex-1 min-w-0">
                      <button
                        className="text-left w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmail(message);
                        }}
                        data-testid={`button-open-email-${message.id}`}
                      >
                        <h3 
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-sm mb-1"
                          data-testid={`text-email-subject-${message.id}`}
                        >
                          {message.subject || 'No subject'}
                        </h3>
                      </button>
                      <p className="text-sm text-muted-foreground">
                        From: {message.fromEmail} | To: {Array.isArray(message.toEmails) ? message.toEmails.join(', ') : message.toEmails}
                      </p>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {message.hasAttachments && (
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      )}
                      {message.direction && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs uppercase ${
                            message.direction === 'inbound'
                              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                          }`}
                          data-testid={`badge-status-${message.id}`}
                        >
                          {message.direction === 'inbound' ? 'RECEIVED' : 'SENT'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thread Details Modal */}
      <Dialog open={!!selectedThreadId} onOpenChange={() => {
        setSelectedThreadId(null);
        setShowReplyDialog(false);
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
                      <div className="text-sm bg-muted/30 dark:bg-muted/10 p-3 rounded max-h-64 overflow-y-auto mb-3 border border-border/20 dark:border-border/10">
                        {message.bodyHtml ? (
                          <div 
                            className="email-body text-foreground max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                            dangerouslySetInnerHTML={{
                              __html: resolveDisplayTokens(
                                extractEmailContent(message.bodyHtml) || 'No content',
                                project,
                                contact
                              )
                            }}
                          />
                        ) : (
                          <div className="email-body plain text-foreground">
                            {resolveDisplayTokens(
                              decodeHtmlEntities(message.bodyText) || 'No content',
                              project,
                              contact
                            )}
                          </div>
                        )}
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

      {/* Email Detail Modal - 17hats Style */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5" />
              View email
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto space-y-4">
            {selectedEmail && (
              <>
                {/* Email Header */}
                <div className="flex items-start gap-4 pb-4 border-b">
                  {/* Sender Avatar/Initial */}
                  <div className="w-12 h-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {selectedEmail.fromEmail?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>

                  {/* Email Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-600 dark:text-blue-400 text-base mb-1">
                          To: {Array.isArray(selectedEmail.toEmails) ? selectedEmail.toEmails.join(', ') : selectedEmail.toEmails}
                        </h3>
                        {project && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Project:</span> {project.name}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`shrink-0 uppercase ${
                          selectedEmail.direction === 'inbound'
                            ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300'
                            : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {selectedEmail.direction === 'inbound' ? 'UNREAD' : 'SENT'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Email Subject & Date */}
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">{selectedEmail.subject || 'No subject'}</h2>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedEmail.sentAt).toLocaleDateString('en-US', { 
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })} at {new Date(selectedEmail.sentAt).toLocaleTimeString('en-US', { 
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Email Body */}
                <div className="bg-white dark:bg-gray-900 rounded-lg border p-6">
                  {selectedEmail.bodyHtml ? (
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      dangerouslySetInnerHTML={{
                        __html: resolveDisplayTokens(
                          extractEmailContent(selectedEmail.bodyHtml) || 'No content',
                          project,
                          contact
                        )
                      }}
                      data-testid="email-body-html"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm" data-testid="email-body-text">
                      {resolveDisplayTokens(
                        decodeHtmlEntities(selectedEmail.bodyText) || 'No content',
                        project,
                        contact
                      )}
                    </pre>
                  )}
                </div>

                {/* Attachments */}
                {selectedEmail.hasAttachments && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span>This email has attachments</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons - Only show Reply for inbound emails */}
                {selectedEmail.direction === 'inbound' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => handleReply(selectedEmail)}
                      data-testid="button-reply-email"
                    >
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                  </div>
                )}
              </>
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
                      <div className="bg-muted/30 dark:bg-muted/10 p-3 rounded text-sm border border-border/20 dark:border-border/10">
                        <p className="text-muted-foreground dark:text-muted-foreground line-clamp-3 leading-relaxed">
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

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="h-5 w-5" />
              Reply to Email
            </DialogTitle>
            <DialogDescription>
              Compose your reply below
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto space-y-4">
            <div>
              <Label htmlFor="reply-to">To</Label>
              <Input
                id="reply-to"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="focus-visible:outline-none focus-visible:ring-0 focus:border-primary"
                data-testid="input-reply-to"
              />
            </div>
            <div>
              <Label htmlFor="reply-subject">Subject</Label>
              <Input
                id="reply-subject"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                className="focus-visible:outline-none focus-visible:ring-0 focus:border-primary"
                data-testid="input-reply-subject"
              />
            </div>
            <div>
              <Label htmlFor="reply-message">Message</Label>
              <RichTextEditor
                ref={replyEditorRef}
                content={replyMessage}
                onChange={setReplyMessage}
                placeholder="Enter your reply..."
                minHeight="300px"
                data-testid="editor-reply-message"
                onTokenInsert={(insertToken) => (
                  <TokenDropdown
                    onTokenSelect={insertToken}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                  />
                )}
                onSignatureSelect={() => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        data-testid="button-signature-toolbar"
                      >
                        <Edit3 className="h-2.5 w-2.5 mr-1" />
                        Signature
                        <ChevronDown className="h-2.5 w-2.5 ml-1" />
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
                            onClick={() => {
                              if (replyEditorRef.current) {
                                const added = replyEditorRef.current.appendSignature(signature.content);
                                if (!added) {
                                  toast({ 
                                    title: 'Signature already added', 
                                    description: 'This signature is already present in the email body.',
                                    variant: 'destructive'
                                  });
                                }
                              }
                            }}
                            data-testid={`dropdown-signature-toolbar-${signature.id}`}
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
                )}
                onTemplateSelect={() => (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowTemplateModal(true)}
                    data-testid="button-template-toolbar"
                  >
                    <FileText className="h-2.5 w-2.5 mr-1" />
                    Template
                  </Button>
                )}
              />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowReplyDialog(false)}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}