import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, Reply, Forward, Trash2, Search, Plus, Inbox, SendHorizontal, Archive } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmailSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Email, Contact } from "@shared/schema";
import { z } from "zod";
import { SummarizeThreadButton, DraftReplyButton, ExtractActionsButton, AIComposeButton } from "@/components/AIActions";

export default function EmailPage() {
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'archive'>('inbox');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: emails, isLoading } = useQuery<Email[]>({
    queryKey: ["/api/emails"],
  });

  const { data: clients } = useQuery<Contact[]>({
    queryKey: ["/api/contacts?simple=1&limit=100"],
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const form = useForm<z.infer<typeof insertEmailSchema>>({
    resolver: zodResolver(insertEmailSchema),
    defaultValues: {
      subject: "",
      body: "",
      fromEmail: currentUser?.user?.email || "",
      toEmail: "",
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertEmailSchema>) => {
      const response = await apiRequest("POST", "/api/emails", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
      toast({
        title: "Success",
        description: "Email sent successfully!",
      });
      form.reset();
      setShowComposeModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof insertEmailSchema>) => {
    sendEmailMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-blue-100 text-blue-800';
      case 'bounced': return 'bg-red-100 text-red-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEmailPreview = (body: string) => {
    return body.length > 100 ? body.substring(0, 100) + "..." : body;
  };

  const handleCompose = () => {
    form.reset();
    setShowComposeModal(true);
  };

  const handleReply = (email: Email) => {
    form.reset({
      toEmail: email.fromEmail || "",
      subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject || ""}`,
      body: "",
      fromEmail: (currentUser as any)?.user?.email || "",
    });
    setShowComposeModal(true);
  };

  const handleForward = (email: Email) => {
    form.reset({
      toEmail: "",
      subject: email.subject?.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject || ""}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${email.fromEmail || ""}\n\n${email.body || ""}`,
      fromEmail: (currentUser as any)?.user?.email || "",
    });
    setShowComposeModal(true);
  };

  // Mock emails for demonstration
  const mockEmails: Email[] = [
    {
      id: "1",
      subject: "Re: Project Timeline",
      body: "Thanks for your email. I wanted to follow up on the project timeline we discussed. The initial mockups are ready for review.",
      fromEmail: "sarah@techsolutions.com",
      toEmail: "john@company.com",
      status: "delivered",
      threadId: "thread-1",
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      leadId: null,
      clientId: null,
      projectId: null,
      ccEmails: null,
      bccEmails: null,
      sentBy: null,
    },
    {
      id: "2",
      subject: "Contract Approval",
      body: "I've reviewed the contract and everything looks good. I'll have it signed and returned by end of day.",
      fromEmail: "emily@marketingpro.com",
      toEmail: "john@company.com",
      status: "delivered",
      threadId: "thread-2",
      sentAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      leadId: null,
      clientId: null,
      projectId: null,
      ccEmails: null,
      bccEmails: null,
      sentBy: null,
    },
    {
      id: "3",
      subject: "Quote Request",
      body: "We're interested in your services for our upcoming brand redesign project. Could you provide a quote?",
      fromEmail: "mike@creativeagency.com",
      toEmail: "john@company.com",
      status: "delivered",
      threadId: "thread-3",
      sentAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      leadId: null,
      clientId: null,
      projectId: null,
      ccEmails: null,
      bccEmails: null,
      sentBy: null,
    },
  ];

  const displayEmails = emails && emails.length > 0 ? emails : mockEmails;

  return (
    <>
      <Header 
        title="Email" 
        subtitle="Manage client communications and email threads"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
          {/* Sidebar */}
          <Card className="lg:col-span-1" data-testid="email-sidebar">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Email</CardTitle>
                <Button onClick={handleCompose} size="sm" data-testid="button-compose-email">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={activeTab === 'inbox' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveTab('inbox')}
                data-testid="tab-inbox"
              >
                <Inbox className="h-4 w-4 mr-2" />
                Inbox
                <Badge variant="secondary" className="ml-auto">{displayEmails.filter(e => e.status !== 'sent').length || 0}</Badge>
              </Button>
              <Button
                variant={activeTab === 'sent' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveTab('sent')}
                data-testid="tab-sent"
              >
                <SendHorizontal className="h-4 w-4 mr-2" />
                Sent
              </Button>
              <Button
                variant={activeTab === 'archive' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveTab('archive')}
                data-testid="tab-archive"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
            </CardContent>
          </Card>

          {/* Email List */}
          <Card className="lg:col-span-1" data-testid="email-list">
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  placeholder="Search emails..." 
                  className="pl-10"
                  data-testid="input-search-emails"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="animate-pulse p-4 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : displayEmails.length === 0 ? (
                <div className="text-center py-12" data-testid="empty-emails-state">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No emails found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {displayEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedEmail?.id === email.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedEmail(email)}
                      data-testid={`email-item-${email.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-sm truncate" data-testid={`email-from-${email.id}`}>
                          {email.fromEmail}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`email-time-${email.id}`}>
                          {formatDistanceToNow(new Date(email.sentAt!), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="font-medium text-sm mb-1 truncate" data-testid={`email-subject-${email.id}`}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" data-testid={`email-preview-${email.id}`}>
                        {getEmailPreview(email.body)}
                      </p>
                      <div className="mt-2">
                        <Badge className={getStatusColor(email.status)} data-testid={`email-status-${email.id}`}>
                          {email.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card className="lg:col-span-2" data-testid="email-content">
            <CardHeader>
              {selectedEmail ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg" data-testid="selected-email-subject">
                        {selectedEmail.subject}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground" data-testid="selected-email-from">
                        From: {selectedEmail.fromEmail}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" data-testid="button-reply" onClick={() => handleReply(selectedEmail)}>
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" data-testid="button-forward" onClick={() => handleForward(selectedEmail)}>
                        <Forward className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" data-testid="button-delete" onClick={() => toast({ title: "Delete email", description: "Email deletion is not yet available.", variant: "destructive" })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* AI Actions for Email */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedEmail.threadId && <SummarizeThreadButton threadId={selectedEmail.threadId} />}
                    <DraftReplyButton emailId={selectedEmail.id} />
                    <ExtractActionsButton emailId={selectedEmail.id} />
                  </div>
                </div>
              ) : (
                <CardTitle>Select an email to view</CardTitle>
              )}
            </CardHeader>
            <CardContent>
              {selectedEmail ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span data-testid="selected-email-date">
                      {selectedEmail.sentAt ? new Date(selectedEmail.sentAt).toLocaleString() : 'No date'}
                    </span>
                    <Badge className={getStatusColor(selectedEmail.status)}>
                      {selectedEmail.status}
                    </Badge>
                  </div>
                  <div className="prose max-w-none" data-testid="selected-email-body">
                    <p className="whitespace-pre-wrap">{selectedEmail.body}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4" />
                  <p>Select an email from the list to view its content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Compose Email Modal */}
      <Dialog open={showComposeModal} onOpenChange={setShowComposeModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="toEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To *</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="recipient@example.com"
                        {...field} 
                        data-testid="input-email-to" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-email-subject" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* AI Compose Button */}
              <div className="flex justify-center">
                <AIComposeButton 
                  onDraftGenerated={(draft, subject) => {
                    form.setValue('body', draft);
                    if (subject) {
                      form.setValue('subject', subject);
                    }
                  }} 
                />
              </div>
              
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message *</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={10} 
                        placeholder="Type your message here..."
                        {...field} 
                        data-testid="textarea-email-body"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setShowComposeModal(false)}
                  data-testid="button-cancel-email"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={sendEmailMutation.isPending}
                  data-testid="button-send-email"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendEmailMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
