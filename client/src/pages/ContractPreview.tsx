import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft, Send, Eye, Printer, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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
    // TODO: Open email composer with contract-filtered templates
    console.log("Send contract");
  };

  const handleLiveView = () => {
    // TODO: Open client-facing contract view
    console.log("Live view");
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10 print:hidden">
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
      <div className="bg-white dark:bg-gray-800 border-b print:hidden">
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

      {/* Contract Content */}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
