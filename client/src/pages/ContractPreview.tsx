import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Eye, Printer, Edit, X, FileText, ChevronDown, Edit3, Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { RichTextEditor, RichTextEditorRef } from "@/components/ui/rich-text-editor";
import { TokenDropdown } from "@/components/ui/token-dropdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TEMPLATE_CATEGORIES } from "@shared/schema";

type Contract = {
  id: string;
  contractNumber: string;
  contactId: string;
  projectId: string | null;
  title: string;
  displayTitle: string | null;
  bodyHtml: string | null;
  dueDate: string | null;
  status: string;
  signatureWorkflow: string;
  clientSignature: string | null;
  clientSignedAt: string | null;
  businessSignature: string | null;
  businessSignedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  venueState: string | null;
  venueZipCode: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  venueId: string | null;
};

type Venue = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

export default function ContractPreview() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Email dialog state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const messageEditorRef = useRef<RichTextEditorRef>(null);
  
  // Save template state
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("contract_send");
  
  // Signature state
  const [showBusinessSignDialog, setShowBusinessSignDialog] = useState(false);
  const [businessSignatureName, setBusinessSignatureName] = useState("");

  // Fetch contract
  const { data: contract, isLoading: contractLoading } = useQuery<Contract>({
    queryKey: ["/api/contracts", id],
  });

  // Fetch contact
  const { data: contact } = useQuery<Contact>({
    queryKey: contract?.contactId ? ["/api/contacts", contract.contactId] : null,
    enabled: !!contract?.contactId,
  });

  // Fetch project if exists
  const { data: project } = useQuery<Project>({
    queryKey: contract?.projectId ? ["/api/projects", contract.projectId] : null,
    enabled: !!contract?.projectId,
  });

  // Fetch venue if project has one
  const { data: venue } = useQuery<Venue>({
    queryKey: project?.venueId ? ["/api/venues", project.venueId] : null,
    enabled: !!project?.venueId,
  });

  // Fetch tenant config
  const { data: tenantConfig } = useQuery<{ name: string; id: string }>({
    queryKey: ['/api/tenant/config'],
  });

  // Fetch email templates - get all contract-related categories
  const { data: emailTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/message-templates', 'email', 'contract'],
    queryFn: async () => {
      // Fetch templates with contract-related categories
      const categories = ['contract_send', 'contract_confirmation', 'contract_upcoming_send', 'contract_due_send'];
      const categoryParams = categories.map(c => `category=${c}`).join('&');
      const response = await fetch(`/api/message-templates?type=email&${categoryParams}`);
      if (!response.ok) throw new Error('Failed to fetch email templates');
      return response.json();
    },
    enabled: showEmailDialog,
  });

  // Fetch document views
  const { data: documentViews, refetch: refetchViews } = useQuery<any[]>({
    queryKey: ['/api/documents/contract', id, 'views'],
    enabled: !!id,
  });

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
    enabled: showEmailDialog,
  });

  // Apply email template function
  const applyTemplate = (template: any) => {
    if (template.subject) {
      setEmailSubject(template.subject);
    }
    if (template.body) {
      setEmailMessage(template.body);
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

  // Apply signature function
  const applySignature = (signature: any) => {
    if (messageEditorRef.current) {
      const success = messageEditorRef.current.appendSignature(signature.html);
      if (success) {
        toast({ 
          title: 'Signature added', 
          description: `Added "${signature.name}" to your email` 
        });
      }
    }
  };

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: { to: string; subject: string; html: string }) => {
      const response = await apiRequest('POST', '/api/email/send', {
        ...emailData,
        projectId: contract?.projectId,
        contactId: contract?.contactId,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Contract sent successfully!' });
      setShowEmailDialog(false);
      setEmailMessage("");
      setEmailSubject("");
      setSelectedTemplate(null);
      // Update contract status to 'sent'
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send contract', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Business signature mutation
  const businessSignMutation = useMutation({
    mutationFn: async (signature: string) => {
      const response = await apiRequest('POST', `/api/contracts/${id}/sign`, {
        signature,
        signatureType: 'business'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts', id] });
      setShowBusinessSignDialog(false);
      setBusinessSignatureName("");
      toast({
        title: "Success",
        description: "Contract counter-signed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: { name: string; subject: string; body: string; category: string }) => {
      const response = await apiRequest('POST', '/api/message-templates', {
        name: templateData.name,
        type: 'email',
        subject: templateData.subject,
        body: templateData.body,
        category: templateData.category
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/message-templates', 'email', 'contract'] });
      setShowSaveTemplateDialog(false);
      setTemplateName("");
      setTemplateCategory("contract_send"); // Reset to default
      toast({
        title: "Template saved",
        description: "Email template saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Token replacement function
  const replaceTokens = (html: string | null): string => {
    if (!html) return "";
    
    let replaced = html;
    
    if (contact) {
      // Contact tokens (matching actual token names from token-resolver service)
      replaced = replaced.replace(/\[FirstName\]/gi, contact.firstName || "");
      replaced = replaced.replace(/\[LastName\]/gi, contact.lastName || "");
      replaced = replaced.replace(/\[FullName\]/gi, contact.fullName || `${contact.firstName} ${contact.lastName}`.trim());
      replaced = replaced.replace(/\[Email\]/gi, contact.email || "");
      replaced = replaced.replace(/\[Phone\]/gi, contact.phone || "");
      replaced = replaced.replace(/\[Company\]/gi, contact.company || "");
      
      // Contact address tokens
      replaced = replaced.replace(/\[Address1\]/gi, contact.address || "");
      replaced = replaced.replace(/\[City\]/gi, contact.city || "");
      replaced = replaced.replace(/\[State\]/gi, contact.state || "");
      replaced = replaced.replace(/\[Province\]/gi, contact.state || "");
      replaced = replaced.replace(/\[Zip\]/gi, contact.zipCode || "");
      replaced = replaced.replace(/\[PostalCode\]/gi, contact.zipCode || "");
      replaced = replaced.replace(/\[Country\]/gi, contact.country || "");
    }
    
    if (project) {
      // Project tokens (matching actual token names from token-resolver service)
      replaced = replaced.replace(/\[ProjectName\]/gi, project.name || "");
      replaced = replaced.replace(/\[ProjectNotes\]/gi, project.description || "");
      
      // Project dates
      if (project.startDate) {
        const startDate = new Date(project.startDate);
        replaced = replaced.replace(/\[ProjectDate\]/gi, format(startDate, "MMMM d, yyyy"));
      }
      
      // Project location - use venue data if available
      if (venue) {
        const venueLocation = `${venue.name || ''} ${venue.address || ''}`.trim();
        replaced = replaced.replace(/\[ProjectLocation\]/gi, venueLocation);
        replaced = replaced.replace(/\[ProjectAddress\]/gi, venue.address || "");
      } else {
        replaced = replaced.replace(/\[ProjectLocation\]/gi, "");
        replaced = replaced.replace(/\[ProjectAddress\]/gi, "");
      }
    }
    
    if (contract) {
      // Contract tokens
      replaced = replaced.replace(/\[ContractNumber\]/gi, contract.contractNumber || "");
      replaced = replaced.replace(/\[ContractTitle\]/gi, contract.displayTitle || contract.title || "");
      
      if (contract.dueDate) {
        const dueDate = new Date(contract.dueDate);
        replaced = replaced.replace(/\[ContractDueDate\]/gi, format(dueDate, "MMMM d, yyyy"));
      }
    }
    
    // Business/User tokens - use tenant config when available
    replaced = replaced.replace(/\[BusinessName\]/gi, tenantConfig?.name || "");
    
    return replaced;
  };

  const handleEdit = () => {
    // Navigate back to project detail which will open the edit dialog
    if (contract?.projectId) {
      setLocation(`/projects/${contract.projectId}?editContract=${contract.id}`);
    }
  };

  const handleSend = () => {
    // Pre-populate email with contact details
    if (contact) {
      setEmailTo(contact.email);
      setEmailSubject(`Contract: ${contract?.displayTitle || contract?.title}`);
    }
    setShowEmailDialog(true);
  };

  const handleSendEmail = () => {
    const emailBody = messageEditorRef.current?.getHTML() || emailMessage;
    
    if (!emailTo || !emailSubject || !emailBody) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    sendEmailMutation.mutate({
      to: emailTo,
      subject: emailSubject,
      html: emailBody,
    });
  };

  const handleLiveView = () => {
    // Open the contract in a new window (client view) - public URL without auth
    const url = `${window.location.origin}/c/${id}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBusinessSign = () => {
    if (!contract?.clientSignature) {
      toast({
        title: "Cannot counter-sign",
        description: "Client must sign first",
        variant: "destructive",
      });
      return;
    }
    setBusinessSignatureName(tenantConfig?.name || "");
    setShowBusinessSignDialog(true);
  };

  const handleBusinessSignSubmit = () => {
    if (!businessSignatureName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }
    businessSignMutation.mutate(businessSignatureName);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a template name",
        variant: "destructive",
      });
      return;
    }
    saveTemplateMutation.mutate({
      name: templateName,
      subject: emailSubject,
      body: emailMessage,
      category: templateCategory
    });
  };

  if (contractLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading contract...</div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Contract not found</div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500",
    sent: "bg-blue-500",
    awaiting_counter_signature: "bg-yellow-500",
    signed: "bg-green-500",
    cancelled: "bg-red-500",
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden print:h-auto print:overflow-visible print:block">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b z-10 print:hidden flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/projects/${contract.projectId}`)}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
              <div>
                <h1 className="text-xl font-semibold" data-testid="text-contract-title">
                  {contract.displayTitle || contract.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {contact && `${contact.firstName} ${contact.lastName}`}
                  {project && ` • ${project.name}`}
                  {contract.dueDate && ` • Due ${format(new Date(contract.dueDate), "MMM d, yyyy")}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[contract.status]} data-testid="badge-status">
                {contract.status}
              </Badge>
              {contract.status === 'awaiting_counter_signature' && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" data-testid="badge-counter-signature-required">
                  Requires Counter-Signature
                </Badge>
              )}
              
              {/* Timeline Dropdown */}
              <DropdownMenu onOpenChange={(open) => { if (open) refetchViews(); }}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="gap-1 text-muted-foreground hover:text-foreground"
                    data-testid="button-timeline"
                  >
                    <Clock className="h-4 w-4" />
                    Timeline
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
                    Document Timeline
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {/* Views */}
                    {documentViews && documentViews.map((view) => (
                      <div key={view.id} className="px-2 py-2 text-sm text-muted-foreground border-b last:border-b-0">
                        Viewed on {format(new Date(view.viewedAt), "MMM do, yyyy 'at' h:mm a")}
                      </div>
                    ))}
                    
                    {/* Business Signed */}
                    {contract.businessSignedAt && (
                      <div className="px-2 py-2 text-sm text-muted-foreground border-b">
                        Counter-signed on {format(new Date(contract.businessSignedAt), "MMM do, yyyy 'at' h:mm a")}
                      </div>
                    )}
                    
                    {/* Client Signed */}
                    {contract.clientSignedAt && (
                      <div className="px-2 py-2 text-sm text-muted-foreground border-b">
                        Signed on {format(new Date(contract.clientSignedAt), "MMM do, yyyy 'at' h:mm a")}
                      </div>
                    )}
                    
                    {/* Sent */}
                    {contract.sentAt && (
                      <div className="px-2 py-2 text-sm text-muted-foreground border-b">
                        Sent on {format(new Date(contract.sentAt), "MMM do, yyyy 'at' h:mm a")}
                      </div>
                    )}
                    
                    {/* Edited */}
                    {contract.updatedAt && contract.createdAt !== contract.updatedAt && (
                      <div className="px-2 py-2 text-sm text-muted-foreground border-b">
                        Edited on {format(new Date(contract.updatedAt), "MMM do, yyyy 'at' h:mm a")}
                      </div>
                    )}
                    
                    {/* Created */}
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                      Created on {format(new Date(contract.createdAt), "MMM do, yyyy 'at' h:mm a")}
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-800 border-b print:hidden flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="default"
              onClick={handleSend}
              data-testid="button-send-contract"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Contract
            </Button>
            <Button
              variant="outline"
              onClick={handleLiveView}
              data-testid="button-live-view"
            >
              <Eye className="h-4 w-4 mr-2" />
              Live View
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              data-testid="button-print"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={handleEdit}
              data-testid="button-edit"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Contract Content - Scrollable */}
      <div className="flex-1 overflow-y-auto print:overflow-visible print:h-auto">
        <div className="max-w-4xl mx-auto px-4 py-8 print:py-0">
        <Card className="print:shadow-none print:border-0 print:bg-white">
          <CardHeader className="text-center border-b print:border-b-0">
            <h2 className="text-2xl font-bold" data-testid="text-display-title">
              {contract.displayTitle || contract.title}
            </h2>
            {contract.dueDate && (
              <p className="text-sm text-muted-foreground mt-2">
                Due Date: {format(new Date(contract.dueDate), "MMMM d, yyyy")}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-8 print:p-4">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: replaceTokens(contract.bodyHtml) }}
              data-testid="contract-body"
            />

            {/* Signature Section */}
            {contract.signatureWorkflow !== 'not_required' && (
              <div className="mt-12 pt-8 border-t">
                <h3 className="text-lg font-semibold mb-4">Agreement Confirmation</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  By signing below, you confirm that you have read, understood, and agreed to the terms of this contract.
                </p>

                <div className="space-y-6">
                  {/* Client Signature */}
                  <div className="border-b pb-4">
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-muted-foreground uppercase mb-2">
                          {contact?.fullName || contact?.firstName + ' ' + contact?.lastName}
                        </label>
                        {contract.clientSignature ? (
                          <div className="border-b-2 border-gray-300 pb-2">
                            <p className="font-signature text-3xl">{contract.clientSignature}</p>
                            {contract.clientSignedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Signed on {format(new Date(contract.clientSignedAt), "MMMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="border-b-2 border-gray-300 pb-2 h-12" />
                        )}
                      </div>
                      {!contract.clientSignature && (
                        <Button 
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                          data-testid="button-sign-client"
                        >
                          Sign Contract
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Business Signature - Only show for counter_sign_after_client */}
                  {contract.signatureWorkflow === 'counter_sign_after_client' && (
                    <div className="border-b pb-4">
                      <div className="flex items-end justify-between gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-muted-foreground uppercase mb-2">
                            {tenantConfig?.name || 'Business'}
                          </label>
                          {contract.businessSignature ? (
                            <div className="border-b-2 border-gray-300 pb-2">
                              <p className="font-signature text-3xl">{contract.businessSignature}</p>
                              {contract.businessSignedAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Signed on {format(new Date(contract.businessSignedAt), "MMMM d, yyyy 'at' h:mm a")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="border-b-2 border-gray-300 pb-2 h-12 flex items-center">
                              <p className="text-sm text-muted-foreground italic">
                                {contract.clientSignature ? 'Awaiting counter-signature' : 'Awaiting client signature'}
                              </p>
                            </div>
                          )}
                        </div>
                        {!contract.businessSignature && contract.clientSignature && (
                          <Button 
                            onClick={handleBusinessSign}
                            disabled={businessSignMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            data-testid="button-sign-business"
                          >
                            {businessSignMutation.isPending ? 'Signing...' : 'Counter-Sign'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-4xl h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Contract</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2">
            {/* To Field */}
            <div className="flex items-center gap-3">
              <Label htmlFor="email-to" className="w-20 text-right text-sm font-medium">To:</Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="Enter email address..."
                className="flex-1 h-8 text-sm"
                data-testid="input-email-to"
              />
            </div>

            {/* Subject Field */}
            <div className="flex items-center gap-3">
              <Label htmlFor="email-subject" className="w-20 text-right text-sm font-medium">Subject:</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Enter subject..."
                className="flex-1 h-8 text-sm"
                data-testid="input-email-subject"
              />
              <TokenDropdown
                onTokenSelect={(token) => {
                  setEmailSubject(prev => prev + (prev ? ' ' : '') + token);
                }}
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-primary hover:text-primary/80"
              />
            </div>

            {/* Message Field */}
            <div className="flex gap-3 pt-1">
              <Label htmlFor="email-message" className="w-20 text-right text-sm font-medium pt-2">Message:</Label>
              <div className="flex-1">
                <RichTextEditor
                  ref={messageEditorRef}
                  content={emailMessage}
                  onChange={setEmailMessage}
                  placeholder="Enter your message..."
                  minHeight="400px"
                  data-testid="editor-email-message"
                  onTokenInsert={(insertToken) => (
                    <TokenDropdown
                      onTokenSelect={insertToken}
                      onAfterInsert={() => {
                        if (messageEditorRef.current) {
                          messageEditorRef.current.focus();
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    />
                  )}
                  onSignatureSelect={() => (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowSignatureModal(true)}
                      data-testid="button-select-signature"
                    >
                      <Edit3 className="h-2.5 w-2.5 mr-1" />
                      Signature
                    </Button>
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
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <div className="w-20"></div>
              <div className="flex-1 flex gap-2 items-center">
                <Button 
                  onClick={handleSendEmail} 
                  disabled={sendEmailMutation.isPending}
                  size="sm"
                  className="h-8"
                  data-testid="button-send-email"
                >
                  {sendEmailMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Send Now
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8"
                  onClick={() => setShowSaveTemplateDialog(true)}
                  data-testid="button-save-as-template"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Save as Template
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8"
                  onClick={() => setShowEmailDialog(false)}
                  data-testid="button-cancel-email"
                >
                  Close
                </Button>
              </div>
            </div>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Signature Selection Modal */}
      <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Select Email Signature
            </DialogTitle>
            <DialogDescription>
              Choose a signature to insert into your email
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-96 overflow-auto">
            {signaturesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading signatures...
              </div>
            ) : emailSignatures?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No email signatures found</p>
                <p className="text-sm mt-2">
                  Create signatures in Settings to use them here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {emailSignatures?.map((signature: any) => (
                  <Card 
                    key={signature.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      applySignature(signature);
                      setShowSignatureModal(false);
                    }}
                    data-testid={`card-signature-${signature.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold">
                            {signature.name}
                          </CardTitle>
                          {signature.isDefault && (
                            <Badge variant="secondary" className="mt-1">Default</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="bg-muted/30 dark:bg-muted/10 p-3 rounded text-sm border border-border/20 dark:border-border/10">
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: signature.html?.substring(0, 300) || 'No preview available' }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save this email as a template for future use
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveTemplate();
                  }
                }}
                placeholder="e.g., Contract Follow-up"
                data-testid="input-template-name"
              />
            </div>

            <div>
              <Label htmlFor="template-category">Template Category</Label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger id="template-category" data-testid="select-template-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TEMPLATE_CATEGORIES.CONTRACT_SEND}>Contract Send</SelectItem>
                  <SelectItem value={TEMPLATE_CATEGORIES.CONTRACT_CONFIRMATION}>Contract Confirmation</SelectItem>
                  <SelectItem value={TEMPLATE_CATEGORIES.CONTRACT_UPCOMING_SEND}>Contract Upcoming Reminder</SelectItem>
                  <SelectItem value={TEMPLATE_CATEGORIES.CONTRACT_DUE_SEND}>Contract Overdue Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSaveTemplateDialog(false);
                  setTemplateName("");
                  setTemplateCategory("contract_send");
                }}
                data-testid="button-cancel-save-template"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={saveTemplateMutation.isPending || !templateName.trim()}
                data-testid="button-submit-save-template"
              >
                {saveTemplateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Save Template
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Business Signature Dialog */}
      <Dialog open={showBusinessSignDialog} onOpenChange={setShowBusinessSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Counter-Sign Contract</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              By counter-signing this contract, you confirm that you have reviewed and approved the terms.
            </p>

            <div>
              <Label htmlFor="business-signature">Your Name</Label>
              <Input
                id="business-signature"
                value={businessSignatureName}
                onChange={(e) => setBusinessSignatureName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleBusinessSignSubmit();
                  }
                }}
                placeholder="Enter your name"
                className="font-signature text-lg"
                data-testid="input-business-signature-name"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBusinessSignDialog(false)}
                data-testid="button-cancel-business-sign"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBusinessSignSubmit}
                disabled={businessSignMutation.isPending || !businessSignatureName.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="button-submit-business-sign"
              >
                {businessSignMutation.isPending ? "Signing..." : "Sign Contract"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
