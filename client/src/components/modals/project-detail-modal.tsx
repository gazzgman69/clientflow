import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  FileText, Upload, Users, MessageSquare, Plus, 
  Download, Trash, Clock, DollarSign, MapPin, Briefcase,
  Receipt, File, Send, Check, Edit, Trash2 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { 
  Project, Member, Venue, ProjectFile, 
  ProjectNote, ProjectMember, Quote, Contract, Invoice, Contact
} from "@shared/schema";
import ProjectEmailPanel from "@/components/email/ProjectEmailPanel";
import ContactPicker from "@/components/quote/ContactPicker";
import QuoteEditor from "@/components/quote/QuoteEditor";

interface ProjectDetailModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

const noteSchema = z.object({
  note: z.string().min(1, "Note is required"),
});

const memberAssignmentSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  role: z.string().optional(),
  fee: z.string().optional(),
});

type NoteFormData = z.infer<typeof noteSchema>;
type MemberAssignmentData = z.infer<typeof memberAssignmentSchema>;

export default function ProjectDetailModal({ project, isOpen, onClose }: ProjectDetailModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{
    type: 'quote' | 'contract' | 'invoice';
    data: Quote | Contract | Invoice;
    mode?: 'view' | 'edit';
  } | null>(null);
  
  // Quote creation flow state
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showQuoteEditor, setShowQuoteEditor] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedContactName, setSelectedContactName] = useState<string>("");
  
  const { toast } = useToast();

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/members"],
    enabled: isOpen && !!project,
  });

  const { data: venues = [] } = useQuery<Venue[]>({
    queryKey: ["/api/venues"],
    enabled: isOpen && !!project,
  });

  const { data: projectFiles = [] } = useQuery<ProjectFile[]>({
    queryKey: ["/api/projects", project?.id, "files"],
    enabled: isOpen && !!project,
  });

  const { data: projectNotes = [] } = useQuery<ProjectNote[]>({
    queryKey: ["/api/projects", project?.id, "notes"],
    enabled: isOpen && !!project,
  });

  const { data: projectMembers = [] } = useQuery<ProjectMember[]>({
    queryKey: ["/api/projects", project?.id, "members"],
    enabled: isOpen && !!project,
  });

  // Fetch documents for this project's client
  const { data: projectQuotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/contacts", project?.contactId, "quotes"],
    enabled: isOpen && !!project && !!project.contactId,
  });

  const { data: projectContracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contacts", project?.contactId, "contracts"],
    enabled: isOpen && !!project && !!project.contactId,
  });

  const { data: projectInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/contacts", project?.contactId, "invoices"],
    enabled: isOpen && !!project && !!project.contactId,
  });

  // Fetch venue information if project has a venue
  const { data: projectVenue } = useQuery<Venue>({
    queryKey: ["/api/venues", project?.venueId],
    enabled: isOpen && !!project && !!project.venueId,
  });

  // Fetch contact information for the project
  const { data: projectContact } = useQuery<Contact>({
    queryKey: ["/api/contacts", project?.contactId],
    enabled: isOpen && !!project && !!project.contactId,
  });

  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  });

  const memberForm = useForm<MemberAssignmentData>({
    resolver: zodResolver(memberAssignmentSchema),
    defaultValues: { memberId: "", role: "", fee: "" },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileData = {
        fileName: `${Date.now()}-${file.name}`,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: "current-user-id", // Would come from auth context
      };
      return apiRequest(`/api/projects/${project?.id}/files`, "POST", fileData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "files"] });
      setSelectedFile(null);
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (data: NoteFormData) =>
      apiRequest(`/api/projects/${project?.id}/notes`, "POST", {
        ...data,
        createdBy: "current-user-id", // Would come from auth context
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "notes"] });
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

  const assignMemberMutation = useMutation({
    mutationFn: (data: MemberAssignmentData) =>
      apiRequest(`/api/projects/${project?.id}/members`, "POST", {
        ...data,
        fee: data.fee ? parseFloat(data.fee) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "members"] });
      memberForm.reset();
      toast({
        title: "Success",
        description: "Member assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign member",
        variant: "destructive",
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => apiRequest(`/api/files/${fileId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "files"] });
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiRequest(`/api/projects/${project?.id}/members/${memberId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "members"] });
      toast({
        title: "Success",
        description: "Member removed successfully",
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
      // Invalidate all document queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
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
      // Invalidate all document queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
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

  // Document creation mutations
  // Handler functions for new quote creation flow
  const handleCreateQuote = () => {
    // If project has a contact ID, use it automatically and skip the ContactPicker
    if (project?.contactId) {
      setSelectedContactId(project.contactId);
      // Use a placeholder name if contact isn't loaded yet, QuoteEditor will display the proper name
      const contactName = projectContact 
        ? `${projectContact.firstName} ${projectContact.lastName}`
        : "Loading contact...";
      setSelectedContactName(contactName);
      setShowQuoteEditor(true);
    } else {
      // Fallback to ContactPicker if project has no contact assigned
      setShowContactPicker(true);
    }
  };

  const handleContactSelected = (contactId: string, contactName: string, contactType?: 'contact' | 'client') => {
    setSelectedContactId(contactId);
    setSelectedContactName(contactName);
    setShowContactPicker(false);
    setShowQuoteEditor(true);
  };

  const handleQuoteEditorClose = () => {
    setEditingQuote(null);
    setShowQuoteEditor(false);
    setSelectedContactId("");
    setSelectedContactName("");
  };

  const createContractMutation = useMutation({
    mutationFn: async () => {
      const contractData = {
        contactId: project?.contactId,
        projectId: project?.id,
        title: `Contract for ${project?.name}`,
        description: `Contract for project: ${project?.name}`,
        amount: "0.00",
        contractNumber: `C-${Date.now()}`,
        createdBy: "test-user" // TODO: Get from auth context
      };
      const response = await apiRequest("POST", "/api/contracts", contractData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
      toast({
        title: "Success",
        description: "Contract created successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const invoiceData = {
        contactId: project?.contactId,
        projectId: project?.id,
        title: `Invoice for ${project?.name}`,
        description: `Invoice for project: ${project?.name}`,
        subtotal: "0.00",
        total: "0.00",
        invoiceNumber: `I-${Date.now()}`,
        createdBy: "test-user" // TODO: Get from auth context
      };
      const response = await apiRequest("POST", "/api/invoices", invoiceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
      toast({
        title: "Success",
        description: "Invoice created successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete mutations for documents
  const deleteQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => apiRequest("DELETE", `/api/quotes/${quoteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "quotes"] });
      toast({
        title: "Success",
        description: "Quote deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to delete quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: (contractId: string) => apiRequest("DELETE", `/api/contracts/${contractId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
      toast({
        title: "Success",
        description: "Contract deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => apiRequest("DELETE", `/api/invoices/${invoiceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
      toast({
        title: "Success", 
        description: "Invoice deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.", 
        variant: "destructive",
      });
    },
  });

  // State for editing quotes
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  // Handle edit operations
  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
    setShowQuoteEditor(true);
  };

  const handleEditContract = (contract: any) => {
    setSelectedDocument({ type: 'contract', data: contract, mode: 'edit' });
  };

  const handleEditInvoice = (invoice: any) => {
    setSelectedDocument({ type: 'invoice', data: invoice, mode: 'edit' });
  };

  // Handle delete operations with confirmation
  const handleDeleteDocument = async (id: string, type: 'quote' | 'contract' | 'invoice', title: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete ${type} "${title}"?`);
    if (confirmDelete) {
      switch (type) {
        case 'quote':
          deleteQuoteMutation.mutate(id);
          break;
        case 'contract':
          deleteContractMutation.mutate(id);
          break;
        case 'invoice':
          deleteInvoiceMutation.mutate(id);
          break;
      }
    }
  };

  const handleFileUpload = () => {
    if (selectedFile) {
      uploadFileMutation.mutate(selectedFile);
    }
  };

  const getMemberName = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    return member ? `${member.firstName} ${member.lastName}` : "Unknown Member";
  };

  const getVenueName = (venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    return venue ? venue.name : "No venue selected";
  };

  if (!project) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Project Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div>
                    <Badge 
                      variant={project.status === 'active' ? 'default' : 'secondary'}
                      data-testid={`badge-status-${project.id}`}
                    >
                      {project.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Progress</Label>
                  <div className="text-lg font-semibold">{project.progress}%</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Estimated Value</Label>
                  <div className="text-lg font-semibold">
                    ${project.estimatedValue || "0.00"}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Start Date</Label>
                  <div>
                    {project.startDate 
                      ? new Date(project.startDate).toLocaleDateString()
                      : "Not set"
                    }
                  </div>
                </div>
              </div>
              {project.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                </div>
              )}
              
              {/* Venue Information */}
              {project.venueId && projectVenue && (
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Venue
                  </Label>
                  <div className="mt-2">
                    <div className="text-sm font-medium">{projectVenue.name}</div>
                    {projectVenue.formattedAddress && (
                      <div className="text-sm text-muted-foreground">
                        {projectVenue.formattedAddress}
                      </div>
                    )}
                    {projectVenue.latitude && projectVenue.longitude && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          const url = `https://www.google.com/maps/search/?api=1&query=${projectVenue.latitude},${projectVenue.longitude}`;
                          window.open(url, '_blank');
                        }}
                        data-testid={`button-venue-maps-${project.id}`}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Open in Maps
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            {/* Members Tab */}
            <TabsContent value="members" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Assigned Members
                  </CardTitle>
                  <CardDescription>
                    Manage musicians and band members for this gig
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Member Form */}
                  <form
                    onSubmit={memberForm.handleSubmit((data) => assignMemberMutation.mutate(data))}
                    className="flex gap-2"
                  >
                    <Select onValueChange={(value) => memberForm.setValue("memberId", value)}>
                      <SelectTrigger data-testid="select-member">
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.firstName} {member.lastName}
                            {member.instruments && member.instruments.length > 0 && 
                              ` (${member.instruments.join(", ")})`
                            }
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Role (optional)"
                      {...memberForm.register("role")}
                      data-testid="input-member-role"
                    />
                    <Input
                      placeholder="Fee (optional)"
                      type="number"
                      step="0.01"
                      {...memberForm.register("fee")}
                      data-testid="input-member-fee"
                    />
                    <Button 
                      type="submit" 
                      disabled={assignMemberMutation.isPending}
                      data-testid="button-assign-member"
                    >
                      {assignMemberMutation.isPending ? "Adding..." : "Add"}
                    </Button>
                  </form>

                  {/* Members List */}
                  {projectMembers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Fee</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectMembers.map((pm) => (
                          <TableRow key={pm.memberId}>
                            <TableCell data-testid={`text-member-${pm.memberId}`}>
                              {getMemberName(pm.memberId)}
                            </TableCell>
                            <TableCell>{pm.role || "-"}</TableCell>
                            <TableCell>
                              {pm.fee ? `$${pm.fee}` : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{pm.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMemberMutation.mutate(pm.memberId)}
                                data-testid={`button-remove-${pm.memberId}`}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No members assigned yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Project Files
                  </CardTitle>
                  <CardDescription>
                    Upload setlists, contracts, itineraries, and other documents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* File Upload */}
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      data-testid="input-file-upload"
                    />
                    <Button
                      onClick={handleFileUpload}
                      disabled={!selectedFile || uploadFileMutation.isPending}
                      data-testid="button-upload-file"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadFileMutation.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  </div>

                  {/* Files List */}
                  {projectFiles.length > 0 ? (
                    <div className="space-y-2">
                      {projectFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4" />
                            <div>
                              <p className="font-medium" data-testid={`text-filename-${file.id}`}>
                                {file.originalName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {file.fileSize && `${Math.round(file.fileSize / 1024)}KB`} • 
                                {formatDistanceToNow(new Date(file.createdAt!))} ago
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" data-testid={`button-download-${file.id}`}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteFileMutation.mutate(file.id)}
                              data-testid={`button-delete-file-${file.id}`}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No files uploaded yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Project Documents
                  </CardTitle>
                  <CardDescription>
                    Manage quotes, contracts, and invoices for this project
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Document Creation Buttons */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleCreateQuote}
                      data-testid="button-create-quote"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Create Quote
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => createContractMutation.mutate()}
                      disabled={createContractMutation.isPending}
                      data-testid="button-create-contract"
                    >
                      <File className="h-4 w-4 mr-2" />
                      {createContractMutation.isPending ? "Creating..." : "Create Contract"}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => createInvoiceMutation.mutate()}
                      disabled={createInvoiceMutation.isPending}
                      data-testid="button-create-invoice"
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
                    </Button>
                  </div>

                  {/* Quotes Section */}
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Quotes ({projectQuotes.length})
                    </h4>
                    {projectQuotes.length > 0 ? (
                      <div className="space-y-2">
                        {projectQuotes.map((quote) => (
                          <div
                            key={quote.id}
                            className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => setSelectedDocument({ type: 'quote', data: quote })}
                            data-testid={`document-quote-${quote.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-blue-500" />
                              <div>
                                <p className="font-medium" data-testid={`text-quote-title-${quote.id}`}>
                                  {quote.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  ${quote.total} • {quote.status}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditQuote(quote);
                                }}
                                data-testid={`button-edit-quote-${quote.id}`}
                                aria-label={`Edit quote ${quote.title}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDocument(quote.id, 'quote', quote.title);
                                }}
                                data-testid={`button-delete-quote-${quote.id}`}
                                aria-label={`Delete quote ${quote.title}`}
                                disabled={deleteQuoteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                              {quote.status === 'draft' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sendDocumentMutation.mutate({ id: quote.id, type: 'quote' });
                                  }}
                                  disabled={sendDocumentMutation.isPending}
                                  data-testid={`button-send-quote-${quote.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {quote.status === 'sent' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    approveDocumentMutation.mutate({ id: quote.id, type: 'quote' });
                                  }}
                                  disabled={approveDocumentMutation.isPending}
                                  data-testid={`button-approve-quote-${quote.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-3 text-sm">
                        No quotes created yet
                      </p>
                    )}
                  </div>

                  {/* Contracts Section */}
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <File className="h-4 w-4" />
                      Contracts ({projectContracts.length})
                    </h4>
                    {projectContracts.length > 0 ? (
                      <div className="space-y-2">
                        {projectContracts.map((contract) => (
                          <div
                            key={contract.id}
                            className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => setSelectedDocument({ type: 'contract', data: contract })}
                            data-testid={`document-contract-${contract.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <File className="h-4 w-4 text-green-500" />
                              <div>
                                <p className="font-medium" data-testid={`text-contract-title-${contract.id}`}>
                                  {contract.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  ${contract.amount} • {contract.status}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditContract(contract);
                                }}
                                data-testid={`button-edit-contract-${contract.id}`}
                                aria-label={`Edit contract ${contract.title}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDocument(contract.id, 'contract', contract.title);
                                }}
                                data-testid={`button-delete-contract-${contract.id}`}
                                aria-label={`Delete contract ${contract.title}`}
                                disabled={deleteContractMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                              {contract.status === 'draft' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sendDocumentMutation.mutate({ id: contract.id, type: 'contract' });
                                  }}
                                  disabled={sendDocumentMutation.isPending}
                                  data-testid={`button-send-contract-${contract.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {contract.status === 'sent' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    approveDocumentMutation.mutate({ id: contract.id, type: 'contract' });
                                  }}
                                  disabled={approveDocumentMutation.isPending}
                                  data-testid={`button-sign-contract-${contract.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-3 text-sm">
                        No contracts created yet
                      </p>
                    )}
                  </div>

                  {/* Invoices Section */}
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Invoices ({projectInvoices.length})
                    </h4>
                    {projectInvoices.length > 0 ? (
                      <div className="space-y-2">
                        {projectInvoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => setSelectedDocument({ type: 'invoice', data: invoice })}
                            data-testid={`document-invoice-${invoice.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Receipt className="h-4 w-4 text-orange-500" />
                              <div>
                                <p className="font-medium" data-testid={`text-invoice-title-${invoice.id}`}>
                                  {invoice.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  ${invoice.total} • {invoice.status}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditInvoice(invoice);
                                }}
                                data-testid={`button-edit-invoice-${invoice.id}`}
                                aria-label={`Edit invoice ${invoice.title}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDocument(invoice.id, 'invoice', invoice.title);
                                }}
                                data-testid={`button-delete-invoice-${invoice.id}`}
                                aria-label={`Delete invoice ${invoice.title}`}
                                disabled={deleteInvoiceMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                              {invoice.status === 'draft' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sendDocumentMutation.mutate({ id: invoice.id, type: 'invoice' });
                                  }}
                                  disabled={sendDocumentMutation.isPending}
                                  data-testid={`button-send-invoice-${invoice.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {invoice.status === 'sent' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    approveDocumentMutation.mutate({ id: invoice.id, type: 'invoice' });
                                  }}
                                  disabled={approveDocumentMutation.isPending}
                                  data-testid={`button-pay-invoice-${invoice.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-3 text-sm">
                        No invoices created yet
                      </p>
                    )}
                  </div>

                  {/* Document Summary */}
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{projectQuotes.length}</p>
                        <p className="text-sm text-muted-foreground">Quotes</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{projectContracts.length}</p>
                        <p className="text-sm text-muted-foreground">Contracts</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-600">{projectInvoices.length}</p>
                        <p className="text-sm text-muted-foreground">Invoices</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Project Notes
                  </CardTitle>
                  <CardDescription>
                    Track important information and communications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Note Form */}
                  <form
                    onSubmit={noteForm.handleSubmit((data) => addNoteMutation.mutate(data))}
                    className="space-y-2"
                  >
                    <Textarea
                      placeholder="Add a note..."
                      {...noteForm.register("note")}
                      data-testid="textarea-note"
                    />
                    <Button 
                      type="submit" 
                      disabled={addNoteMutation.isPending}
                      data-testid="button-add-note"
                    >
                      {addNoteMutation.isPending ? "Adding..." : "Add Note"}
                    </Button>
                  </form>

                  {/* Notes List */}
                  {projectNotes.length > 0 ? (
                    <div className="space-y-4">
                      {projectNotes.map((note) => (
                        <div key={note.id} className="border-l-4 border-primary pl-4">
                          <p className="text-sm" data-testid={`text-note-${note.id}`}>
                            {note.note}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatDistanceToNow(new Date(note.createdAt!))} ago
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No notes added yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Email Tab */}
            <TabsContent value="email" className="space-y-4">
              <ProjectEmailPanel 
                projectId={project.id}
              />
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Additional Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Created</Label>
                      <p className="text-sm">
                        {formatDistanceToNow(new Date(project.createdAt!))} ago
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Last Updated</Label>
                      <p className="text-sm">
                        {formatDistanceToNow(new Date(project.updatedAt!))} ago
                      </p>
                    </div>
                  </div>
                  {project.endDate && (
                    <div>
                      <Label className="text-sm font-medium">End Date</Label>
                      <p className="text-sm">
                        {new Date(project.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>

    {/* Document Detail Modal */}
    <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedDocument?.type === 'quote' && <FileText className="h-5 w-5 text-blue-500" />}
            {selectedDocument?.type === 'contract' && <File className="h-5 w-5 text-green-500" />}
            {selectedDocument?.type === 'invoice' && <Receipt className="h-5 w-5 text-orange-500" />}
            {selectedDocument?.data.title}
          </DialogTitle>
        </DialogHeader>
        
        {selectedDocument && (
          <div className="space-y-6">
            {/* Document Header */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Document Number</Label>
                <p className="font-mono text-sm">
                  {selectedDocument.type === 'quote' && (selectedDocument.data as Quote).quoteNumber}
                  {selectedDocument.type === 'contract' && (selectedDocument.data as Contract).contractNumber}
                  {selectedDocument.type === 'invoice' && (selectedDocument.data as Invoice).invoiceNumber}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Badge variant={selectedDocument.data.status === 'draft' ? 'secondary' : 'default'}>
                  {selectedDocument.data.status}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium">Total Amount</Label>
                <p className="text-lg font-semibold">
                  ${selectedDocument.type === 'quote' ? (selectedDocument.data as Quote).total : 
                    selectedDocument.type === 'contract' ? (selectedDocument.data as Contract).amount :
                    (selectedDocument.data as Invoice).total}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Created</Label>
                <p className="text-sm">
                  {formatDistanceToNow(new Date(selectedDocument.data.createdAt!))} ago
                </p>
              </div>
            </div>

            {/* Document Details */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedDocument.data.description || 'No description provided'}
                </p>
              </div>

              {/* Quote specific fields */}
              {selectedDocument.type === 'quote' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Subtotal</Label>
                    <p className="text-sm">${(selectedDocument.data as Quote).subtotal}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Tax</Label>
                    <p className="text-sm">${(selectedDocument.data as Quote).taxAmount || '0.00'}</p>
                  </div>
                  {(selectedDocument.data as Quote).validUntil && (
                    <div className="col-span-2">
                      <Label className="text-sm font-medium">Valid Until</Label>
                      <p className="text-sm">
                        {new Date((selectedDocument.data as Quote).validUntil!).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Contract specific fields */}
              {selectedDocument.type === 'contract' && (
                <div className="space-y-4">
                  {(selectedDocument.data as Contract).terms && (
                    <div>
                      <Label className="text-sm font-medium">Terms</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {(selectedDocument.data as Contract).terms}
                      </p>
                    </div>
                  )}
                  {(selectedDocument.data as Contract).expiresAt && (
                    <div>
                      <Label className="text-sm font-medium">Expires</Label>
                      <p className="text-sm">
                        {new Date((selectedDocument.data as Contract).expiresAt!).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Invoice specific fields */}
              {selectedDocument.type === 'invoice' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Subtotal</Label>
                    <p className="text-sm">${(selectedDocument.data as Invoice).subtotal}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Tax</Label>
                    <p className="text-sm">${(selectedDocument.data as Invoice).taxAmount || '0.00'}</p>
                  </div>
                  {(selectedDocument.data as Invoice).dueDate && (
                    <div>
                      <Label className="text-sm font-medium">Due Date</Label>
                      <p className="text-sm">
                        {new Date((selectedDocument.data as Invoice).dueDate!).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {(selectedDocument.data as Invoice).paidAt && (
                    <div>
                      <Label className="text-sm font-medium">Paid Date</Label>
                      <p className="text-sm">
                        {new Date((selectedDocument.data as Invoice).paidAt!).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              {selectedDocument.data.status === 'draft' && (
                <Button
                  onClick={() => {
                    sendDocumentMutation.mutate({ 
                      id: selectedDocument.data.id, 
                      type: selectedDocument.type 
                    });
                    setSelectedDocument(null);
                  }}
                  disabled={sendDocumentMutation.isPending}
                  data-testid={`button-send-${selectedDocument.type}-modal`}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send {selectedDocument.type.charAt(0).toUpperCase() + selectedDocument.type.slice(1)}
                </Button>
              )}
              {selectedDocument.data.status === 'sent' && (
                <Button
                  onClick={() => {
                    approveDocumentMutation.mutate({ 
                      id: selectedDocument.data.id, 
                      type: selectedDocument.type 
                    });
                    setSelectedDocument(null);
                  }}
                  disabled={approveDocumentMutation.isPending}
                  data-testid={`button-approve-${selectedDocument.type}-modal`}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {selectedDocument.type === 'quote' && 'Approve Quote'}
                  {selectedDocument.type === 'contract' && 'Sign Contract'}
                  {selectedDocument.type === 'invoice' && 'Mark as Paid'}
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedDocument(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    
    {/* Contact Picker Modal */}
    <ContactPicker
      isOpen={showContactPicker}
      onClose={() => setShowContactPicker(false)}
      onContactSelect={handleContactSelected}
    />
    
    {/* Quote Editor Modal */}
    <QuoteEditor
      isOpen={showQuoteEditor}
      onClose={handleQuoteEditorClose}
      contactId={selectedContactId}
      contactName={selectedContactName}
      projectId={project?.id}
      editingQuote={editingQuote}
    />
    </>
  );
}