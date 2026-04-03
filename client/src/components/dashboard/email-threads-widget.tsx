import { useQuery } from '@tanstack/react-query';
import { Mail, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocation } from 'wouter';
import { useState, useRef } from 'react';
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

interface EmailThread {
  threadId: string;
  latest: {
    id: string;
    from: string;
    to: string;
    subject: string;
    dateISO: string;
    snippet: string;
  };
  count: number;
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
  
  // Get current authenticated user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });
  
  // Email composition state
  const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  
  const { data: threadsResponse, isLoading, error } = useQuery({
    queryKey: ['/api/email/threads'],
    queryFn: async () => {
      const response = await fetch('/api/email/threads?limit=20', {
        credentials: 'include'
      });
      return response.json();
    },
    enabled: !!currentUser,
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
  const findProjectByEmail = async (email: string) => {
    try {
      // Extract email from "Name <email@domain.com>" format
      const emailMatch = email.match(/<(.+)>/);
      const cleanEmail = emailMatch ? emailMatch[1] : email;
      
      const response = await fetch(`/api/contacts?email=${encodeURIComponent(cleanEmail)}`, {
        credentials: 'include'
      });
      const contacts = await response.json();
      
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        let projectId = contact.projectId;
        
        // If no direct project, look for projects with this contact
        if (!projectId) {
          const projectsResponse = await fetch(`/api/projects?contactId=${contact.id}`, {
            credentials: 'include'
          });
          const projects = await projectsResponse.json();
          if (projects && projects.length > 0) {
            projectId = projects[0].id;
          }
        }
        
        // Fetch the full project data and open modal
        if (projectId) {
          const projectResponse = await fetch(`/api/projects/${projectId}`, {
            credentials: 'include'
          });
          const project = await projectResponse.json();
          setSelectedProject(project);
          setShowDetailModal(true);
        }
      }
    } catch (error) {
      console.error('Error finding project:', error);
    }
  };

  const handleEmailClick = async (threadId: string) => {
    setLoadingThread(true);
    setShowReplyForm(false);
    setReplySubject('');
    setReplyMessage('');
    try {
      const response = await fetch(`/api/email/thread/${threadId}`, {
        credentials: 'include'
      });
      const threadDetails = await response.json();
      setSelectedThread(threadDetails);
      setShowEmailModal(true);
      
      // Set default reply subject with Re: prefix
      if (threadDetails?.thread?.subject) {
        const subject = threadDetails.thread.subject;
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        setReplySubject(replySubject);
      }
    } catch (error) {
      console.error('Error fetching thread details:', error);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleContactClick = (fromEmail: string) => {
    findProjectByEmail(fromEmail);
  };

  const formatDate = (dateISO: string) => {
    return new Date(dateISO).toLocaleDateString('en-GB');
  };

  const threads = threadsResponse?.threads || [];
  const needsReconnect = error || threadsResponse?.error?.includes?.('insufficientPermissions');

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
          <Mail className="h-5 w-5" />
          Recent Email Threads
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
            Loading email threads...
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No email threads found</p>
            <p className="text-sm">Connect Gmail to see recent email conversations</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {threads.map((thread: EmailThread) => (
              <div 
                key={thread.threadId}
                className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors space-y-2"
                data-testid={`thread-${thread.threadId}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span 
                      className="text-sm font-medium truncate hover:text-primary cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContactClick(thread.latest.from);
                      }}
                      data-testid={`contact-${thread.threadId}`}
                    >
                      {thread.latest.from}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {formatDate(thread.latest.dateISO)}
                    </span>
                  </div>
                  {thread.count > 1 && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-full flex-shrink-0">
                      {thread.count}
                    </span>
                  )}
                </div>
                <div 
                  className="group cursor-pointer hover:bg-muted/30 rounded p-2 -mx-2 transition-colors space-y-1"
                  onClick={() => handleEmailClick(thread.threadId)}
                  data-testid={`email-content-${thread.threadId}`}
                >
                  <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {decodeHtmlEntities(thread.latest.subject)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate group-hover:text-primary transition-colors">
                    {decodeHtmlEntities(thread.latest.snippet)}
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
                    <Label htmlFor="reply-subject">Subject</Label>
                    <Input
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