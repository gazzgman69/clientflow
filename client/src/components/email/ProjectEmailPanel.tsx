import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Mail, Loader2, AlertCircle, X, Reply } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
  const { toast } = useToast();
  const queryClient = useQueryClient();


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

  // Fetch project email threads
  const { data: threadsResponse, isLoading: threadsLoading, error: threadsError } = useQuery({
    queryKey: [`/api/projects/${projectId}/email-threads`, contact?.email, emails],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/email-threads`, {
        headers: {
          'user-id': 'test-user' // TODO: Get from actual auth context
        }
      });
      return response.json();
    },
    enabled: !!projectId,
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
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/email-threads`] });
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
    return new Date(dateISO).toLocaleDateString('en-GB');
  };

  const threads = threadsResponse?.threads || [];

  // Fetch thread details for selected thread only
  const { data: selectedThreadDetails, isLoading: threadLoading } = useQuery({
    queryKey: [`/api/email-threads/${selectedThreadId}/messages`],
    queryFn: async () => {
      if (!selectedThreadId) return null;
      const response = await fetch(`/api/email-threads/${selectedThreadId}/messages`, {
        headers: {
          'user-id': 'test-user'
        }
      });
      return response.json();
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
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/email-threads`] });
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

  // Check if Gmail reconnection is needed
  const needsReconnect = threadsResponse?.needsReconnect || threadsError;

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
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Project Email Threads
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
                        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/email-threads`] });
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
                        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/email-threads`] });
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

          {threadsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading email threads...
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No email threads found for this project</p>
              {emails?.length === 0 && (
                <p className="text-sm mt-2">
                  Add contact emails to the project to see related email threads
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Snippet</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {threads.map((thread: any) => (
                  <TableRow 
                    key={thread.threadId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedThreadId(thread.threadId)}
                    data-testid={`row-thread-${thread.threadId}`}
                  >
                    <TableCell className="font-medium">
                      {formatDate(thread.latest?.dateISO || new Date().toISOString())}
                    </TableCell>
                    <TableCell>{thread.latest?.from || 'Unknown'}</TableCell>
                    <TableCell>{thread.latest?.subject || 'No subject'}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {thread.latest?.snippet || 'No preview'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {thread.count || 1} message{(thread.count || 1) > 1 ? 's' : ''}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {selectedThreadDetails?.messages?.[0]?.subject || 'Email Thread'}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSelectedThreadId(null);
                  setShowReplyForm(false);
                  setReplyMessage('');
                }}
                data-testid="button-close-thread"
              >
                <X className="h-4 w-4" />
              </Button>
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
                {selectedThreadDetails.messages.map((message: any, index: number) => (
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
                        {message.bodyText || message.bodyHtml || 'No content'}
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
    </div>
  );
}