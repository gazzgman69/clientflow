import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Send, Eye, Printer, Edit, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { RichTextEditor, RichTextEditorRef } from "@/components/ui/rich-text-editor";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  createdAt: string;
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
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const messageEditorRef = useRef<RichTextEditorRef>(null);

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

  // Fetch tenant config
  const { data: tenantConfig } = useQuery<{ name: string; id: string }>({
    queryKey: ['/api/tenant/config'],
  });

  // Fetch contract-specific email templates
  const { data: contractTemplates } = useQuery({
    queryKey: ['/api/templates', 'contract'],
    queryFn: async () => {
      const response = await fetch('/api/templates?type=contract');
      if (!response.ok) throw new Error('Failed to fetch contract templates');
      return response.json();
    },
    enabled: showEmailDialog,
  });

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
      setSelectedTemplateId("");
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

  // Token replacement function
  const replaceTokens = (html: string | null): string => {
    if (!html) return "";
    
    let replaced = html;
    
    if (contact) {
      // Contact tokens
      replaced = replaced.replace(/\[ContactFirstName\]/gi, contact.firstName || "");
      replaced = replaced.replace(/\[ContactLastName\]/gi, contact.lastName || "");
      replaced = replaced.replace(/\[ContactFullName\]/gi, `${contact.firstName} ${contact.lastName}`);
      replaced = replaced.replace(/\[ContactEmail\]/gi, contact.email || "");
      replaced = replaced.replace(/\[ContactPhone\]/gi, contact.phone || "");
      replaced = replaced.replace(/\[ContactCompany\]/gi, contact.company || "");
      
      // Contact address tokens
      replaced = replaced.replace(/\[ContactAddress\]/gi, contact.address || "");
      replaced = replaced.replace(/\[ContactCity\]/gi, contact.city || "");
      replaced = replaced.replace(/\[ContactState\]/gi, contact.state || "");
      replaced = replaced.replace(/\[ContactZipCode\]/gi, contact.zipCode || "");
      
      // Venue tokens
      replaced = replaced.replace(/\[VenueAddress\]/gi, contact.venueAddress || "");
      replaced = replaced.replace(/\[VenueCity\]/gi, contact.venueCity || "");
      replaced = replaced.replace(/\[VenueState\]/gi, contact.venueState || "");
      replaced = replaced.replace(/\[VenueZipCode\]/gi, contact.venueZipCode || "");
    }
    
    if (project) {
      // Project tokens
      replaced = replaced.replace(/\[ProjectName\]/gi, project.name || "");
      replaced = replaced.replace(/\[ProjectDescription\]/gi, project.description || "");
      replaced = replaced.replace(/\[EventName\]/gi, project.name || "");
      
      // Project dates
      if (project.startDate) {
        const startDate = new Date(project.startDate);
        replaced = replaced.replace(/\[ProjectStartDate\]/gi, format(startDate, "MMMM d, yyyy"));
        replaced = replaced.replace(/\[EventDate\]/gi, format(startDate, "MMMM d, yyyy"));
      }
      
      if (project.endDate) {
        const endDate = new Date(project.endDate);
        replaced = replaced.replace(/\[ProjectEndDate\]/gi, format(endDate, "MMMM d, yyyy"));
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
    
    // Business/User tokens - these would need to come from user context
    // For now, placeholder values
    replaced = replaced.replace(/\[BusinessName\]/gi, "[Your Business Name]");
    replaced = replaced.replace(/\[BusinessEmail\]/gi, "[Your Email]");
    replaced = replaced.replace(/\[BusinessPhone\]/gi, "[Your Phone]");
    
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

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = contractTemplates?.find((t: any) => t.id === templateId);
    if (template) {
      setEmailSubject(template.subject || '');
      setEmailMessage(template.body || '');
      if (messageEditorRef.current) {
        messageEditorRef.current.setContent(template.body || '');
      }
    }
  };

  const handleLiveView = () => {
    // Open the contract in a new window (client view)
    const url = `${window.location.origin}/contracts/${id}/preview`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="print:shadow-none print:border-0">
          <CardHeader className="text-center border-b">
            <h2 className="text-2xl font-bold" data-testid="text-display-title">
              {contract.displayTitle || contract.title}
            </h2>
            {contract.dueDate && (
              <p className="text-sm text-muted-foreground mt-2">
                Due Date: {format(new Date(contract.dueDate), "MMMM d, yyyy")}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-8">
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
                            <p className="font-signature text-xl">{contract.clientSignature}</p>
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
                              <p className="font-signature text-xl">{contract.businessSignature}</p>
                              {contract.businessSignedAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Signed on {format(new Date(contract.businessSignedAt), "MMMM d, yyyy 'at' h:mm a")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="border-b-2 border-gray-300 pb-2 h-12" />
                          )}
                        </div>
                        {!contract.businessSignature && (
                          <Button 
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            data-testid="button-sign-business"
                          >
                            Sign Contract
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Contract</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Template Selection */}
            {contractTemplates && contractTemplates.length > 0 && (
              <div>
                <Label>Email Template (Contract Templates)</Label>
                <select
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  data-testid="select-template"
                >
                  <option value="">Select a template...</option>
                  {contractTemplates.map((template: any) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* To Field */}
            <div>
              <Label htmlFor="email-to">To</Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="recipient@example.com"
                data-testid="input-email-to"
              />
            </div>

            {/* Subject Field */}
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Contract subject"
                data-testid="input-email-subject"
              />
            </div>

            {/* Message Field */}
            <div>
              <Label htmlFor="email-message">Message</Label>
              <RichTextEditor
                ref={messageEditorRef}
                initialContent={emailMessage}
                onChange={setEmailMessage}
                placeholder="Write your message here..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEmailDialog(false)}
                data-testid="button-cancel-email"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sendEmailMutation.isPending}
                data-testid="button-send-email"
              >
                {sendEmailMutation.isPending ? "Sending..." : "Send Now"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
