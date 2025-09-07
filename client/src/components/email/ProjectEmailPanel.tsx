import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Mail, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ProjectEmailPanelProps {
  projectId: string;
  emails?: string[];
}

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

export default function ProjectEmailPanel({ projectId, emails }: ProjectEmailPanelProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
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

  // Debug logging
  console.log('Email Pre-fill Debug:', {
    project: project ? { id: project.id, name: project.name, contactId: project.contactId } : null,
    contacts: contacts ? contacts.map(c => ({ id: c.id, email: c.email })) : null,
    contact: contact ? { id: contact.id, email: contact.email } : null,
    currentTo: to
  });

  // Update the 'to' field when contact email is available
  useEffect(() => {
    const emailToUse = contact?.email || emails?.[0] || '';
    console.log('Setting email to:', emailToUse, 'Current to:', to);
    if (emailToUse && emailToUse !== to) {
      setTo(emailToUse);
    }
  }, [contact?.email, emails, to]);

  // Fetch project email threads
  const { data: threadsResponse, isLoading: threadsLoading, error: threadsError } = useQuery({
    queryKey: [`/api/email/threads/by-project/${projectId}`, emails],
    queryFn: async () => {
      const emailsParam = emails?.length ? `?emails=${emails.join(',')}` : '';
      const response = await fetch(`/api/email/threads/by-project/${projectId}${emailsParam}`, {
        headers: {
          'user-id': 'test-user' // TODO: Get from actual auth context
        }
      });
      return response.json();
    },
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
      queryClient.invalidateQueries({ queryKey: [`/api/email/threads/by-project/${projectId}`] });
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

  // Check for insufficient permissions error
  const needsReconnect = threadsError || threadsResponse?.error?.includes?.('insufficientPermissions');

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
                  onClick={() => window.location.href = '/auth/google'}
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
                {threads.map((thread: EmailThread) => (
                  <TableRow 
                    key={thread.threadId}
                    className="cursor-pointer hover:bg-muted/50"
                    data-testid={`row-thread-${thread.threadId}`}
                  >
                    <TableCell className="font-medium">
                      {formatDate(thread.latest.dateISO)}
                    </TableCell>
                    <TableCell>{thread.latest.from}</TableCell>
                    <TableCell>{thread.latest.subject}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {thread.latest.snippet}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {thread.count} message{thread.count !== 1 ? 's' : ''}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}