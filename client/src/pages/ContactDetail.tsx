import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, Mail, Phone, Briefcase, MessageSquare, MapPin,
  FileText, Plus, Edit, Trash2, Send, Check, Building, Tag, Globe, User, Home
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDistanceToNow } from "date-fns";
import type { 
  Contact, Project, Quote, Contract, Invoice, ProjectEmail
} from "@shared/schema";
import { getDisplayName } from "@shared/utils/name-splitter";

const noteSchema = z.object({
  note: z.string().min(1, "Note is required"),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface ContactNote {
  id: string;
  contactId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export default function ContactDetail() {
  const [match, params] = useRoute("/contacts/:id");
  const [, setLocation] = useLocation();
  const contactId = params?.id;
  const { toast } = useToast();
  
  // State for editing documents
  const [selectedDocument, setSelectedDocument] = useState<{
    type: 'quote' | 'contract' | 'invoice';
    data: Quote | Contract | Invoice;
    mode?: 'view' | 'edit';
  } | null>(null);

  // Fetch contact data
  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["/api/contacts", contactId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/contacts/${contactId}`);
      return response.json();
    },
    enabled: !!contactId,
  });

  // Fetch projects for this contact
  const { data: contactProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/contacts", contactId, "projects"],
    enabled: !!contactId,
  });

  // Fetch documents for this contact
  const { data: contactQuotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/contacts", contactId, "quotes"],
    enabled: !!contactId,
  });

  const { data: contactContracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contacts", contactId, "contracts"],
    enabled: !!contactId,
  });

  const { data: contactInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/contacts", contactId, "invoices"],
    enabled: !!contactId,
  });

  // Fetch notes for this contact
  const { data: contactNotes = [] } = useQuery<ContactNote[]>({
    queryKey: ["/api/contacts", contactId, "notes"],
    enabled: !!contactId,
  });

  // Fetch emails for this contact
  const { data: contactEmails = [] } = useQuery<ProjectEmail[]>({
    queryKey: ["/api/contacts", contactId, "emails"],
    enabled: !!contactId,
  });

  // Forms
  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  });

  // Mutations
  const addNoteMutation = useMutation({
    mutationFn: (data: NoteFormData) =>
      apiRequest("POST", `/api/contacts/${contactId}/notes`, {
        ...data,
        createdBy: "current-user-id",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "notes"] });
      noteForm.reset();
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiRequest("DELETE", `/api/contacts/${contactId}/notes/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "notes"] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    },
  });

  // Document status workflow mutations
  const sendDocumentMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const response = await apiRequest("POST", `/api/${type}s/${id}/send`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "invoices"] });
      toast({
        title: "Success",
        description: "Document sent successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveDocumentMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const endpoint = type === 'quote' ? 'approve' : type === 'contract' ? 'sign' : 'pay';
      const response = await apiRequest("POST", `/api/${type}s/${id}/${endpoint}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", contactId, "invoices"] });
      toast({
        title: "Success",
        description: "Document status updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update document status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmitNote = (data: NoteFormData) => {
    addNoteMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <>
        <Header title="Contact Details" subtitle="Loading contact information..." />
        <main className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </main>
      </>
    );
  }

  if (!contact) {
    return (
      <>
        <Header title="Contact Not Found" subtitle="The contact you're looking for doesn't exist" />
        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Contact not found</p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => setLocation("/contacts")} data-testid="button-back-to-contacts">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Contacts
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const displayName = getDisplayName(contact);

  return (
    <>
      <Header 
        title={displayName}
        subtitle={contact.company || contact.email}
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/contacts")}
            data-testid="button-back-to-contacts"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contacts
          </Button>

          {/* Contact Header Card */}
          <Card data-testid="contact-header-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span data-testid="contact-name">{displayName}</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLocation("/contacts")}
                  data-testid="button-edit-contact"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Contact
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contact.email && (
                  <div className="flex items-start gap-3" data-testid="contact-email-display">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{contact.email}</p>
                    </div>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-start gap-3" data-testid="contact-phone-display">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    </div>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-start gap-3" data-testid="contact-company-display">
                    <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Company</p>
                      <p className="text-sm text-muted-foreground">{contact.company}</p>
                    </div>
                  </div>
                )}
                {contact.jobTitle && (
                  <div className="flex items-start gap-3" data-testid="contact-job-title-display">
                    <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Job Title</p>
                      <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
                    </div>
                  </div>
                )}
                {contact.website && (
                  <div className="flex items-start gap-3" data-testid="contact-website-display">
                    <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <p className="text-sm text-muted-foreground">{contact.website}</p>
                    </div>
                  </div>
                )}
                {(contact.address || contact.city) && (
                  <div className="flex items-start gap-3" data-testid="contact-address-display">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-muted-foreground">
                        {contact.address && <span>{contact.address}<br /></span>}
                        {contact.city && <span>{contact.city}</span>}
                        {contact.state && <span>, {contact.state}</span>}
                        {contact.zipCode && <span> {contact.zipCode}</span>}
                        {contact.country && <><br />{contact.country}</>}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {contact.tags && contact.tags.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-start gap-3" data-testid="contact-tags-display">
                    <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {contact.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" data-testid={`contact-tag-${index}`}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tabs Section */}
          <Tabs defaultValue="overview" className="w-full" data-testid="contact-tabs">
            <TabsList data-testid="contact-tabs-list">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="projects" data-testid="tab-projects">
                Projects ({contactProjects.length})
              </TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">
                Documents ({contactQuotes.length + contactContracts.length + contactInvoices.length})
              </TabsTrigger>
              <TabsTrigger value="notes" data-testid="tab-notes">
                Notes ({contactNotes.length})
              </TabsTrigger>
              <TabsTrigger value="emails" data-testid="tab-emails">
                Emails ({contactEmails.length})
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" data-testid="tab-content-overview">
              <div className="space-y-6">
                {/* Basic Info Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Basic Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div data-testid="overview-name">
                        <p className="text-sm font-medium mb-1">Full Name</p>
                        <p className="text-sm text-muted-foreground">{displayName || '-'}</p>
                      </div>
                      <div data-testid="overview-email">
                        <p className="text-sm font-medium mb-1">Email</p>
                        <p className="text-sm text-muted-foreground">{contact.email || '-'}</p>
                      </div>
                      <div data-testid="overview-phone">
                        <p className="text-sm font-medium mb-1">Phone</p>
                        <p className="text-sm text-muted-foreground">{contact.phone || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Address Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div data-testid="overview-address">
                        <p className="text-sm font-medium mb-1">Street Address</p>
                        <p className="text-sm text-muted-foreground">{contact.address || '-'}</p>
                      </div>
                      <div data-testid="overview-city">
                        <p className="text-sm font-medium mb-1">City</p>
                        <p className="text-sm text-muted-foreground">{contact.city || '-'}</p>
                      </div>
                      <div data-testid="overview-state">
                        <p className="text-sm font-medium mb-1">State</p>
                        <p className="text-sm text-muted-foreground">{contact.state || '-'}</p>
                      </div>
                      <div data-testid="overview-zipcode">
                        <p className="text-sm font-medium mb-1">Zip Code</p>
                        <p className="text-sm text-muted-foreground">{contact.zipCode || '-'}</p>
                      </div>
                      <div data-testid="overview-country">
                        <p className="text-sm font-medium mb-1">Country</p>
                        <p className="text-sm text-muted-foreground">{contact.country || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Venue Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Venue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contact.venueId || contact.venueName || contact.venueAddress || contact.venueCity ? (
                      <div className="p-3 bg-muted/50 dark:bg-muted/20 rounded-md border" data-testid="overview-venue-info">
                        <div className="text-sm font-medium mb-1">Selected Venue:</div>
                        {contact.venueName && (
                          <div className="text-sm font-semibold text-foreground mb-1">
                            {contact.venueName}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {[
                            contact.venueAddress,
                            contact.venueCity,
                            contact.venueState,
                            contact.venueZipCode,
                            contact.venueCountry
                          ].filter(Boolean).join(', ') || '-'}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="overview-venue-empty">No venue selected</p>
                    )}
                  </CardContent>
                </Card>

                {/* Business Info Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Business Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div data-testid="overview-company">
                        <p className="text-sm font-medium mb-1">Company Name</p>
                        <p className="text-sm text-muted-foreground">{contact.company || '-'}</p>
                      </div>
                      <div data-testid="overview-job-title">
                        <p className="text-sm font-medium mb-1">Job Title / Role</p>
                        <p className="text-sm text-muted-foreground">{contact.jobTitle || '-'}</p>
                      </div>
                      <div data-testid="overview-website" className="md:col-span-2">
                        <p className="text-sm font-medium mb-1">Website</p>
                        {contact.website ? (
                          <a 
                            href={contact.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {contact.website}
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground">-</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Classification Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Classification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div data-testid="overview-tags">
                        <p className="text-sm font-medium mb-2">Tags</p>
                        {contact.tags && contact.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {contact.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" data-testid={`overview-tag-${index}`}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">-</p>
                        )}
                      </div>
                      <div data-testid="overview-lead-source">
                        <p className="text-sm font-medium mb-1">Lead Source</p>
                        <p className="text-sm text-muted-foreground">{contact.leadSource || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div data-testid="overview-notes">
                      {contact.notes ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No notes available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects" data-testid="tab-content-projects">
              <Card>
                <CardHeader>
                  <CardTitle>Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  {contactProjects.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8" data-testid="no-projects">
                      No projects found for this contact
                    </p>
                  ) : (
                    <Table data-testid="projects-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Event Date</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contactProjects.map((project) => (
                          <TableRow key={project.id} data-testid={`project-row-${project.id}`}>
                            <TableCell className="font-medium" data-testid={`project-name-${project.id}`}>
                              {project.name}
                            </TableCell>
                            <TableCell data-testid={`project-status-${project.id}`}>
                              <Badge variant="secondary">{project.status}</Badge>
                            </TableCell>
                            <TableCell data-testid={`project-date-${project.id}`}>
                              {project.eventDate ? new Date(project.eventDate).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell data-testid={`project-budget-${project.id}`}>
                              {project.budget ? `$${parseFloat(project.budget).toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setLocation(`/projects/${project.id}`)}
                                data-testid={`button-view-project-${project.id}`}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" data-testid="tab-content-documents">
              <div className="space-y-4">
                {/* Quotes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Quotes ({contactQuotes.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contactQuotes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4" data-testid="no-quotes">
                        No quotes found
                      </p>
                    ) : (
                      <Table data-testid="quotes-table">
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
                          {contactQuotes.map((quote) => (
                            <TableRow key={quote.id} data-testid={`quote-row-${quote.id}`}>
                              <TableCell data-testid={`quote-number-${quote.id}`}>
                                {quote.quoteNumber}
                              </TableCell>
                              <TableCell data-testid={`quote-title-${quote.id}`}>
                                {quote.title}
                              </TableCell>
                              <TableCell data-testid={`quote-amount-${quote.id}`}>
                                ${parseFloat(quote.amount).toLocaleString()}
                              </TableCell>
                              <TableCell data-testid={`quote-status-${quote.id}`}>
                                <Badge variant={quote.status === 'approved' ? 'default' : 'secondary'}>
                                  {quote.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {quote.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => sendDocumentMutation.mutate({ id: quote.id, type: 'quote' })}
                                    data-testid={`button-send-quote-${quote.id}`}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send
                                  </Button>
                                )}
                                {quote.status === 'sent' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => approveDocumentMutation.mutate({ id: quote.id, type: 'quote' })}
                                    data-testid={`button-approve-quote-${quote.id}`}
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Contracts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Contracts ({contactContracts.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contactContracts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4" data-testid="no-contracts">
                        No contracts found
                      </p>
                    ) : (
                      <Table data-testid="contracts-table">
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
                          {contactContracts.map((contract) => (
                            <TableRow key={contract.id} data-testid={`contract-row-${contract.id}`}>
                              <TableCell data-testid={`contract-number-${contract.id}`}>
                                {contract.contractNumber}
                              </TableCell>
                              <TableCell data-testid={`contract-title-${contract.id}`}>
                                {contract.title}
                              </TableCell>
                              <TableCell data-testid={`contract-amount-${contract.id}`}>
                                ${parseFloat(contract.amount).toLocaleString()}
                              </TableCell>
                              <TableCell data-testid={`contract-status-${contract.id}`}>
                                <Badge variant={contract.status === 'signed' ? 'default' : 'secondary'}>
                                  {contract.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {contract.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => sendDocumentMutation.mutate({ id: contract.id, type: 'contract' })}
                                    data-testid={`button-send-contract-${contract.id}`}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send
                                  </Button>
                                )}
                                {contract.status === 'sent' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => approveDocumentMutation.mutate({ id: contract.id, type: 'contract' })}
                                    data-testid={`button-sign-contract-${contract.id}`}
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Sign
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Invoices */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Invoices ({contactInvoices.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contactInvoices.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4" data-testid="no-invoices">
                        No invoices found
                      </p>
                    ) : (
                      <Table data-testid="invoices-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactInvoices.map((invoice) => (
                            <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                              <TableCell data-testid={`invoice-number-${invoice.id}`}>
                                {invoice.invoiceNumber}
                              </TableCell>
                              <TableCell data-testid={`invoice-title-${invoice.id}`}>
                                {invoice.title}
                              </TableCell>
                              <TableCell data-testid={`invoice-total-${invoice.id}`}>
                                ${parseFloat(invoice.total).toLocaleString()}
                              </TableCell>
                              <TableCell data-testid={`invoice-status-${invoice.id}`}>
                                <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                                  {invoice.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {invoice.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => sendDocumentMutation.mutate({ id: invoice.id, type: 'invoice' })}
                                    data-testid={`button-send-invoice-${invoice.id}`}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send
                                  </Button>
                                )}
                                {invoice.status === 'sent' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => approveDocumentMutation.mutate({ id: invoice.id, type: 'invoice' })}
                                    data-testid={`button-pay-invoice-${invoice.id}`}
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Mark Paid
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" data-testid="tab-content-notes">
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Form {...noteForm}>
                    <form onSubmit={noteForm.handleSubmit(onSubmitNote)} className="space-y-4">
                      <FormField
                        control={noteForm.control}
                        name="note"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Add Note</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter your note here..." 
                                {...field} 
                                data-testid="input-note"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        disabled={addNoteMutation.isPending}
                        data-testid="button-add-note"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Note
                      </Button>
                    </form>
                  </Form>

                  <Separator />

                  <div className="space-y-3">
                    {contactNotes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4" data-testid="no-notes">
                        No notes yet
                      </p>
                    ) : (
                      contactNotes.map((note) => (
                        <Card key={note.id} data-testid={`note-card-${note.id}`}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-sm whitespace-pre-wrap" data-testid={`note-text-${note.id}`}>
                                  {note.note}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2" data-testid={`note-date-${note.id}`}>
                                  {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                                data-testid={`button-delete-note-${note.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Emails Tab */}
            <TabsContent value="emails" data-testid="tab-content-emails">
              <Card>
                <CardHeader>
                  <CardTitle>Emails</CardTitle>
                </CardHeader>
                <CardContent>
                  {contactEmails.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8" data-testid="no-emails">
                      No emails found for this contact
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {contactEmails.map((email) => (
                        <Card key={email.id} data-testid={`email-card-${email.id}`}>
                          <CardContent className="pt-4">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium" data-testid={`email-subject-${email.id}`}>
                                    {email.subject}
                                  </p>
                                  <p className="text-sm text-muted-foreground" data-testid={`email-from-${email.id}`}>
                                    From: {email.fromEmail}
                                  </p>
                                </div>
                                <Badge variant="secondary" data-testid={`email-direction-${email.id}`}>
                                  {email.direction}
                                </Badge>
                              </div>
                              {email.snippet && (
                                <p className="text-sm text-muted-foreground" data-testid={`email-snippet-${email.id}`}>
                                  {email.snippet}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground" data-testid={`email-date-${email.id}`}>
                                {email.sentAt ? formatDistanceToNow(new Date(email.sentAt), { addSuffix: true }) : 'Date unknown'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
