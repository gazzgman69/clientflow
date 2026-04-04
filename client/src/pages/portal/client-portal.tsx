import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Briefcase, Receipt, FileText, Mail, Calendar, 
  Download, Eye, MessageSquare, CreditCard, Clock,
  FormInput, Users, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import type { 
  Project, Invoice, Contract, Quote, Email, PortalForm, Event 
} from "@shared/schema";

const messageSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

type MessageFormData = z.infer<typeof messageSchema>;

export default function ClientPortal() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const { toast } = useToast();

  // Authentication state - using secure session-based auth
  const { data: currentUser, isLoading: isAuthLoading } = useQuery({
    queryKey: ["/api/portal/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: myProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/portal/client/projects"],
    enabled: !!currentUser, // Only fetch when authenticated
  });

  // Portal Payments - using secure session-based endpoints
  const { data: myInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/portal/payments/invoices"],
    enabled: !!currentUser, // Only fetch when authenticated
  });

  // Portal Forms
  const { data: myForms = [] } = useQuery<PortalForm[]>({
    queryKey: ["/api/portal/forms"],
    enabled: !!currentUser, // Only fetch when authenticated
  });

  // Portal Appointments  
  const { data: myAppointments = [] } = useQuery<Event[]>({
    queryKey: ["/api/portal/appointments"],
    enabled: !!currentUser, // Only fetch when authenticated
  });

  const { data: myContracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/portal/client/contracts"],
    enabled: !!currentUser, // Only fetch when authenticated
  });

  const { data: myQuotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/portal/client/quotes"],
    enabled: !!currentUser, // Only fetch when authenticated
  });

  const { data: recentMessages = [] } = useQuery({
    queryKey: ["/api/portal/client/messages"],
    queryFn: async () => {
      // Mock recent messages for portal - would be replaced with proper portal endpoint
      return [
        {
          id: "1",
          subject: "Contract Ready for Review",
          body: "Your contract for the upcoming event is ready for review and signing.",
          fromEmail: "events@company.com",
          toEmail: "client@example.com",
          status: "sent",
          sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: "2", 
          subject: "Event Details Confirmation",
          body: "Please confirm the final details for your upcoming event.",
          fromEmail: "events@company.com",
          toEmail: "client@example.com",
          status: "sent",
          sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }
      ];
    }
  });

  const { data: accountSummary = {
    activeProjects: 0,
    totalInvoiced: 0,
    pendingPayments: 0,
    upcomingEvents: 0
  } } = useQuery({
    queryKey: ["/api/portal/client/summary"],
    queryFn: async () => {
      return {
        activeProjects: myProjects.filter(p => p.status === 'active').length,
        totalInvoiced: myInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0),
        pendingPayments: myInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').length,
        upcomingEvents: myProjects.filter(p => p.startDate && new Date(p.startDate) > new Date()).length
      };
    }
  });

  const messageForm = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      subject: "",
      message: "",
    },
  });

  // Payment mutation - fixed to use correct endpoint
  const createPaymentMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", "/api/portal/payments/create-payment-intent", { invoiceId });
      if (!response.ok) throw new Error("Failed to create payment");
      return response.json();
    },
    onSuccess: (data) => {
      // Handle Stripe PaymentIntent - would need Stripe.js integration
      if (data.clientSecret) {
        toast({
          title: "Payment Ready",
          description: "Payment processing will be integrated with Stripe Elements",
        });
        // TODO: Integrate with Stripe Elements using clientSecret
        // For now, show success message
      }
      queryClient.invalidateQueries({ queryKey: ["/api/portal/payments/invoices"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process payment",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: MessageFormData) =>
      apiRequest("POST", "/api/emails", {
        ...data,
        fromEmail: currentUser?.contact?.email || "client@example.com",
        toEmail: "events@company.com",
        body: data.message,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/client/messages"] });
      setShowMessageForm(false);
      messageForm.reset();
      toast({
        title: "Success",
        description: "Message sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleViewProject = (project: Project) => {
    setSelectedProject(project);
    setShowProjectDetails(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'signed': return 'bg-green-100 text-green-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Client Portal</h1>
        <p className="text-muted-foreground mt-2">
          Welcome! Here's an overview of your projects and account.
        </p>
      </div>

      {/* Dashboard Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Active Projects</p>
                <p className="text-2xl font-bold" data-testid="text-active-projects">
                  {accountSummary.activeProjects || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Upcoming Events</p>
                <p className="text-2xl font-bold" data-testid="text-upcoming-events">
                  {accountSummary.upcomingEvents || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Total Invoiced</p>
                <p className="text-2xl font-bold" data-testid="text-total-invoiced">
                  {formatCurrency(accountSummary.totalInvoiced || 0, 'GBP')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Pending Payments</p>
                <p className="text-2xl font-bold" data-testid="text-pending-payments">
                  {accountSummary.pendingPayments || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="invoices">Payments</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                My Projects
              </CardTitle>
              <CardDescription>
                View and track your active and completed projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myProjects.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium" data-testid={`text-project-${project.id}`}>
                          {project.name}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(project.status)}>
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${project.progress || 0}%` }}
                              ></div>
                            </div>
                            <span className="text-sm">{project.progress || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          ${project.estimatedValue || '0.00'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewProject(project)}
                            data-testid={`button-view-project-${project.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No projects found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Payments & Invoices
              </CardTitle>
              <CardDescription>
                View and pay your invoices securely with Stripe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myInvoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          {invoice.createdAt ? format(new Date(invoice.createdAt), "dd/MM/yyyy") : "N/A"}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(parseFloat(invoice.total || '0'), 'GBP')}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" data-testid={`button-view-invoice-${invoice.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                              <Button 
                                size="sm" 
                                data-testid={`button-pay-invoice-${invoice.id}`}
                                onClick={() => createPaymentMutation.mutate(invoice.id)}
                                disabled={createPaymentMutation.isPending}
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                {createPaymentMutation.isPending ? "Processing..." : "Pay Now"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invoices found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FormInput className="h-5 w-5" />
                Project Forms & Questionnaires
              </CardTitle>
              <CardDescription>
                Complete required forms for your projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myForms.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Form Title</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myForms.map((form) => (
                      <TableRow key={form.id}>
                        <TableCell className="font-medium">
                          {form.title}
                        </TableCell>
                        <TableCell>
                          {myProjects.find(p => p.id === form.projectId)?.name || "Unknown Project"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(form.status)}>
                            {form.status === 'draft' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {form.status === 'submitted' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {form.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {form.updatedAt ? format(new Date(form.updatedAt), "dd/MM/yyyy HH:mm") : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {form.status === 'draft' ? (
                              <Button size="sm" data-testid={`button-complete-form-${form.id}`}>
                                <FormInput className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" data-testid={`button-view-form-${form.id}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <FormInput className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No forms available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Appointments & Meetings
              </CardTitle>
              <CardDescription>
                Schedule, view and manage your appointments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myAppointments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meeting Title</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myAppointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">
                          {appointment.title}
                        </TableCell>
                        <TableCell>
                          {format(new Date(appointment.startDate), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {appointment.endDate && appointment.startDate 
                            ? Math.round((new Date(appointment.endDate).getTime() - new Date(appointment.startDate).getTime()) / (1000 * 60))
                            : "60"} minutes
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(appointment.status || "confirmed")}>
                            {appointment.status || "confirmed"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" data-testid={`button-view-appointment-${appointment.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {new Date(appointment.startDate) > new Date() && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                data-testid={`button-reschedule-appointment-${appointment.id}`}
                              >
                                <Clock className="h-4 w-4 mr-1" />
                                Reschedule
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No appointments scheduled</p>
                  <Button data-testid="button-book-appointment">
                    <Calendar className="h-4 w-4 mr-2" />
                    Book New Appointment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Contracts
              </CardTitle>
              <CardDescription>
                Review and sign your contracts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myContracts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">
                          {contract.contractNumber}
                        </TableCell>
                        <TableCell>{contract.title}</TableCell>
                        <TableCell>{formatCurrency(parseFloat(contract.amount || '0'), 'GBP')}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(contract.status)}>
                            {contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" data-testid={`button-view-contract-${contract.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {contract.status === 'sent' && (
                              <Button size="sm" data-testid={`button-sign-contract-${contract.id}`}>
                                <FileText className="h-4 w-4 mr-1" />
                                Sign
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No contracts found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quotes Tab */}
        <TabsContent value="quotes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Quotes
              </CardTitle>
              <CardDescription>
                Review and approve your quotes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myQuotes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myQuotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">
                          {quote.quoteNumber}
                        </TableCell>
                        <TableCell>{quote.title}</TableCell>
                        <TableCell>{formatCurrency(parseFloat(quote.total || '0'), ((quote as any).currency as any) || 'GBP')}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(quote.status)}>
                            {quote.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" data-testid={`button-view-quote-${quote.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {quote.status === 'sent' && (
                              <Button size="sm" data-testid={`button-approve-quote-${quote.id}`}>
                                <FileText className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No quotes found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Messages
                  </CardTitle>
                  <CardDescription>
                    Communicate with your event coordinator
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowMessageForm(true)}
                  data-testid="button-new-message"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  New Message
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentMessages.length > 0 ? (
                <div className="space-y-4">
                  {recentMessages.map((message: any) => (
                    <div
                      key={message.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      data-testid={`message-${message.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{message.subject}</h4>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(message.sentAt))} ago
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {message.body}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No messages yet</p>
                  <Button onClick={() => setShowMessageForm(true)}>
                    Send Your First Message
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Message Modal */}
      <Dialog open={showMessageForm} onOpenChange={setShowMessageForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
          </DialogHeader>
          <form 
            onSubmit={messageForm.handleSubmit((data) => sendMessageMutation.mutate(data))}
            className="space-y-4"
          >
            <div>
              <Label>Subject</Label>
              <input
                type="text"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                {...messageForm.register("subject")}
                data-testid="input-message-subject"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Type your message..."
                {...messageForm.register("message")}
                rows={5}
                data-testid="textarea-message-body"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMessageForm(false)}
                data-testid="button-cancel-message"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Details Modal - simplified */}
      <Dialog open={showProjectDetails} onOpenChange={setShowProjectDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProject?.name}</DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <p className="text-muted-foreground">{selectedProject.description}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Status</Label>
                  <p>{selectedProject.status}</p>
                </div>
                <div>
                  <Label className="font-medium">Progress</Label>
                  <p>{selectedProject.progress}%</p>
                </div>
                <div>
                  <Label className="font-medium">Estimated Value</Label>
                  <p>{formatCurrency(parseFloat(selectedProject.estimatedValue || '0'), ((selectedProject as any).currency as any) || 'GBP')}</p>
                </div>
                <div>
                  <Label className="font-medium">Start Date</Label>
                  <p>
                    {selectedProject.startDate 
                      ? new Date(selectedProject.startDate).toLocaleDateString()
                      : "Not set"
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}