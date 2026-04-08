import { useQuery } from '@tanstack/react-query';
import { Mail, AlertCircle, Loader2, ChevronDown, Inbox } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocation } from 'wouter';
import { useState, useRef, useCallback } from 'react';
import ProjectDetailModal from '@/components/modals/project-detail-modal';
import type { Project } from '@shared/schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Reply, Send, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor';
import { TokenDropdown } from '@/components/ui/token-dropdown';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface InboxEmail {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  projectId: string | null;
  contactId: string | null;
  threadId: string;
}

interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
}

interface EmailThreadDetails {
  ok: boolean;
  thread: {
    threadId: string;
    messages: EmailMessage[];
    count: number;
    subject: string;
  };
}

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

export default function EmailThreadsWidget() {
  const [, setLocation] = useLocation();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedThread, setSelectedThread] = useState<EmailThreadDetails | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const replyEditorRef = useRef<RichTextEditorRef>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  // Get current authenticated user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  // Email composition state
  const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  // Fetch individual inbound emails chronologically
  const { data: inboxResponse, isLoading, error } = useQuery({
    queryKey: ['/api/email/inbox'],
    queryFn: async () => {
      const response = await fetch('/api/email/inbox?limit=30', {
        credentials: 'include'
      });
      return response.json();
    },
    enabled: !!currentUser,
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  // Fetch signatures for email composition
  const { data: signatures = [] } = useQuery({
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

  // Fetch email templates
  const { data: templates = [] } = useQuery({
    queryKey: ['/api/templates'],
    queryFn: async () => {
      const response = await fetch('/api/templates?type=email', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
    enabled: !!currentUser,
  });

  // Insert a token into the subject field at cursor position
  const insertTokenIntoSubject = useCallback((token: string) => {
    const input = subjectInputRef.current;
    if (!input) {
      setReplySubject(prev => prev + token);
      return;
    }
    const start = input.selectionStart ?? replySubject.length;
    const end = input.selectionEnd ?? replySubject.length;
    const newValue = replySubject.slice(0, start) + token + replySubject.slice(end);
    setReplySubject(newValue);
    // Restore cursor after the inserted token
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + token.length;
      input.setSelectionRange(pos, pos);
    });
  }, [replySubject]);

  // Helper functions for email composition
  const applySignature = (signature: any) => {
    if (replyEditorRef.current && signature.content) {
      const currentContent = replyEditorRef.current.getHTML();
      const signatureHtml = `<br><br>${signature.content}`;
      replyEditorRef.current.setContent(currentContent + signatureHtml);
    }
    setShowSignatureDropdown(false);
  };

  const applyTemplate = (template: any) => {
    if (template.subject) {
      setReplySubject(template.subject);
    }
    if (template.body && replyEditorRef.current) {
      replyEditorRef.current.setContent(template.body);
    }
    setShowTemplateDropdown(false);
  };

  // Function to find project by contact email and open modal
  const openProjectForEmail = async (email: InboxEmail) => {
    if (email.projectId) {
      try {
        const response = await fetch(`/api/projects/${email.projectId}`, {
          credentials: 'include'
        });
        const project = await response.json();
        if (project && project.id) {
          setSelectedProject(project);
          setShowDetailModal(true);
          return;
        }
      } catch (err) {
        console.error('Error fetching project:', err);
      }
    }
    // Fallback: search by contact email
    try {
      const emailMatch = email.fromEmail.match(/<(.+)>/);
      const cleanEmail = emailMatch ? emailMatch[1] : email.fromEmail;

      const response = await fetch(`/api/contacts?email=${encodeURIComponent(cleanEmail)}`, {
        credentials: 'include'
      });
      const contactsList = await response.json();

      if (contactsList && contactsList.length > 0) {
        const contact = contactsList[0];
        let projectId = contact.projectId;

        if (!projectId) {
          const projectsResponse = await fetch(`/api/projects?contactId=${contact.id}`, {
            credentials: 'include'
          });
          const projectsList = await projectsResponse.json();
          if (projectsList && projectsList.length > 0) {
            projectId = projectsList[0].id;
          }
        }

        if (projectId) {
          const projectResponse = await fetch(`/api/projects/${projectId}`, {
            credentials: 'include'
          });
          const project = await projectResponse.json();
          setSelectedProject(project);
          setShowDetailModal(true);
        }
      }
    } catch (err) {
      console.error('Error finding project:', err);
    }
  };

  const handleEmailClick = async (email: InboxEmail) => {
    setLoadingThread(true);
    setShowReplyForm(false);
    setReplySubject('');
    setReplyMessage('');
    try {
      const response = await fetch(`/api/email/thread/${email.threadId}`, {
        credentials: 'include'
      });
      const threadDetails = await response.json();
      setSelectedThread(threadDetails);
      setShowEmailModal(true);

      // Set default reply subject with Re: prefix
      if (threadDetails?.thread?.subject) {
        const subject = threadDetails.thread.subject;
        const replySub = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        setReplySubject(replySub);
      }
    } catch (err) {
      console.error('Error fetching thread details:', err);
    } finally {
      setLoadingThread(false);
    }
  };

  const formatDate = (dateISO: string) => {
    const date = new Date(dateISO);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const inboxEmails: InboxEmail[] = inboxResponse?.emails || [];
  const needsReconnect = error || inboxResponse?.error?.includes?.('insufficientPermissions');

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedProject(null);
  };

  const handleCloseEmailModal = () => {
    setShowEmailModal(false);
    setSelectedThread(null);
    setShowReplyForm(false);
    setReplySubject('');
    setReplyMessage('');
    if (replyEditorRef.current) {
      replyEditorRef.current.setContent('');
    }
  };

  const sendReplyMutation = useMutation({
    mutationFn: async (data: { to: string; subject: string; text: string; html: string; threadId: string }) => {
      const response = await apiRequest('POST', '/api/email/send', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Reply sent successfully!',
      });
      setReplyMessage('');
      setReplySubject('');
      if (replyEditorRef.current) {
        replyEditorRef.current.setContent('');
      }
      setShowReplyForm(false);
      // Refresh inbox
      queryClient.invalidateQueries({ queryKey: ['/api/email/inbox'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send reply. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSendReply = () => {
    if (!selectedThread?.thread?.messages || !replySubject.trim()) return;

    const htmlContent = replyEditorRef.current?.getHTML() || '';
    if (!htmlContent.trim()) return;

    // Extract sender email from the latest message
    const latestMessage = selectedThread.thread.messages[selectedThread.thread.messages.length - 1];
    let replyToEmail = latestMessage.from;

    // Clean up email format (remove display name if present)
    const emailMatch = replyToEmail.match(/<(.+?)>/) || replyToEmail.match(/(\S+@\S+)/);
    if (emailMatch) {
      replyToEmail = emailMatch[1] || emailMatch[0];
    }

    // Convert HTML to plain text for text field
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    sendReplyMutation.mutate({
      to: replyToEmail,
      subject: replySubject,
      text: plainText,
      html: htmlContent,
      threadId: selectedThread.thread.threadId
    });
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          Recent Emails
        </CardTitle>
      </CardHeader>
      <CardContent>
        {needsReconnect && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Email access is required to view your inbox.
              <Button
                variant="link"
                className="px-2"
                onClick={() => window.location.href = '/auth/google'}
                data-testid="button-reconnect-google-dashboard"
              >
                Reconnect Google
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading emails...
          </div>
        ) : inboxEmails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No emails found</p>
            <p className="text-sm">Incoming client emails will appear here</p>
          </div>
        ) : (
          <div className="divide-y">
            {inboxEmails.map((email: InboxEmail) => (
              <div
                key={email.id}
                className="flex items-start gap-3 py-3 px-2 hover:bg-muted/50 cursor-pointer transition-colors rounded-md -mx-2"
                onClick={() => handleEmailClick(email)}
                data-testid={`inbox-email-${email.id}`}
              >
                {/* Sender name / avatar area */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                  {(email.from || '?')[0].toUpperCase()}
                </div>

                {/* Email content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-medium truncate hover:text-primary transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProjectForEmail(email);
                      }}
                      data-testid={`contact-${email.id}`}
                    >
                      {email.from}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {formatDate(email.date)}
                    </span>
                  </div>
                  <div className="text-sm truncate">
                    {decodeHtmlEntities(email.subject)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {decodeHtmlEntities(email.snippet)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Project Detail Modal */}
    <ProjectDetailModal
      project={selectedProject}
      isOpen={showDetailModal}
      onClose={handleCloseDetailModal}
    />

    {/* Email Thread Modal */}
    <Dialog open={showEmailModal} onOpenChange={handleCloseEmailModal}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {selectedThread?.thread?.subject || 'Email Thread'}
            </DialogTitle>
            {!showReplyForm && (
              <Button
                onClick={() => setShowReplyForm(true)}
                size="sm"
                className="mr-8"
                data-testid="button-reply"
              >
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </Button>
            )}
          </div>
        </DialogHeader>

        {loadingThread ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading email thread...
          </div>
        ) : selectedThread?.thread?.messages ? (
          <div className="space-y-4">
            {/* Show email messages only when not in reply mode */}
            {!showReplyForm && selectedThread.thread.messages.map((message, index) => (
              <div key={message.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{message.from}</span>
                      <Badge variant="outline">
                        {formatDistanceToNow(new Date(message.date))} ago
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      To: {message.to}
                    </div>
                  </div>
                </div>

                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div
                    className="email-content break-words"
                    dangerouslySetInnerHTML={{
                      __html: message.body || message.snippet
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Reply Section */}
            {showReplyForm && (
              <div className="border-t pt-4">
                <div className="space-y-4">
                  {/* Subject Line */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reply-subject">Subject</Label>
                      <TokenDropdown
                        onTokenSelect={(token) => insertTokenIntoSubject(token)}
                        onAfterInsert={() => subjectInputRef.current?.focus()}
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                      />
                    </div>
                    <Input
                      ref={subjectInputRef}
                      id="reply-subject"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="Reply subject..."
                      data-testid="input-reply-subject"
                    />
                  </div>

                  {/* Rich Text Editor with Toolbar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Message</Label>
                      <div className="flex gap-2">
                        {/* Token Insertion */}
                        <TokenDropdown
                          onTokenSelect={(token) => {
                            if (replyEditorRef.current) {
                              replyEditorRef.current.insertToken(token);
                            }
                          }}
                          onAfterInsert={() => {
                            if (replyEditorRef.current) {
                              replyEditorRef.current.focus();
                            }
                          }}
                          variant="outline"
                          size="sm"
                        />

                        {/* Template Selection */}
                        <DropdownMenu open={showTemplateDropdown} onOpenChange={setShowTemplateDropdown}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" data-testid="button-templates">
                              <Plus className="h-4 w-4 mr-1" />
                              Template
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {templates.length > 0 ? (
                              templates.map((template: any) => (
                                <DropdownMenuItem
                                  key={template.id}
                                  onClick={() => applyTemplate(template)}
                                  data-testid={`template-${template.id}`}
                                >
                                  {template.title}
                                </DropdownMenuItem>
                              ))
                            ) : (
                              <DropdownMenuItem disabled>
                                No templates available
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Signature Selection */}
                        <DropdownMenu open={showSignatureDropdown} onOpenChange={setShowSignatureDropdown}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" data-testid="button-signatures">
                              <Plus className="h-4 w-4 mr-1" />
                              Signature
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {signatures.length > 0 ? (
                              signatures.map((signature: any) => (
                                <DropdownMenuItem
                                  key={signature.id}
                                  onClick={() => applySignature(signature)}
                                  data-testid={`signature-${signature.id}`}
                                >
                                  {signature.name}
                                  {signature.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                                </DropdownMenuItem>
                              ))
                            ) : (
                              <DropdownMenuItem disabled>
                                No signatures available
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <RichTextEditor
                      ref={replyEditorRef}
                      content={replyMessage}
                      onChange={setReplyMessage}
                      placeholder="Type your reply..."
                      minHeight="200px"
                      data-testid="editor-reply"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowReplyForm(false);
                        setReplySubject('');
                        setReplyMessage('');
                        if (replyEditorRef.current) {
                          replyEditorRef.current.setContent('');
                        }
                      }}
                      data-testid="button-cancel-reply"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendReply}
                      disabled={!replySubject.trim() || sendReplyMutation.isPending}
                      data-testid="button-send-reply"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sendReplyMutation.isPending ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Failed to load email thread</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
