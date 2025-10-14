import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, Mail, Phone, Calendar, Briefcase, MessageSquare, ExternalLink, Shield, Info,
  Users, FileText, Upload, Download, Trash, Clock, DollarSign, MapPin,
  Receipt, File, Send, Check, Edit, Trash2, Plus, MoreVertical, User, Home
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useUserPrefs } from "@/hooks/useUserPrefs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDistanceToNow } from "date-fns";
import type { 
  Project, Member, Venue, ProjectFile, 
  ProjectNote, ProjectMember, Quote, Contract, Invoice, Contact
} from "@shared/schema";
import { insertContactSchema } from "@shared/schema";
import ProjectEmailPanel from "@/components/email/ProjectEmailPanel";
import ContactPicker from "@/components/quote/ContactPicker";
import QuoteEditor from "@/components/quote/QuoteEditor";
import CreateContractDialog from "@/components/contracts/create-contract-dialog";
import { AddressFields } from "@/components/shared/AddressFields";

const noteSchema = z.object({
  note: z.string().min(1, "Note is required"),
});

const memberAssignmentSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  role: z.string().optional(),
  fee: z.string().optional(),
});

// Contract edit schema
const contractEditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  terms: z.string().optional(),
});

// Invoice edit schema  
const invoiceEditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  subtotal: z.string().min(1, "Subtotal is required"),
  taxAmount: z.string().optional(),
  total: z.string().min(1, "Total is required"),
});

type NoteFormData = z.infer<typeof noteSchema>;
type MemberAssignmentData = z.infer<typeof memberAssignmentSchema>;
type ContractEditData = z.infer<typeof contractEditSchema>;
type InvoiceEditData = z.infer<typeof invoiceEditSchema>;

export default function ProjectDetail() {
  const [match, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id;
  const { toast } = useToast();
  
  // State variables
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
  
  // Contract creation flow state
  const [showContractEditor, setShowContractEditor] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  
  // State for editing quotes
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  
  // Contact editing state
  const [showContactEditModal, setShowContactEditModal] = useState(false);
  
  // Get portal status for this project (tenant setting + project override)
  const { data: portalStatus } = useQuery({
    queryKey: ['/api/projects', projectId, 'portal-status'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/portal-status`);
      return response.json();
    },
    enabled: !!projectId,
  });
  
  const tenantPortalEnabled = portalStatus?.tenantDefault ?? true;
  const effectivePortalStatus = portalStatus?.effectiveStatus ?? true;
  
  // Mutation for updating project portal override
  const updatePortalMutation = useMutation({
    mutationFn: async ({ portalEnabledOverride }: { portalEnabledOverride: boolean | null }) => {
      const response = await apiRequest('PATCH', `/api/projects/${projectId}`, {
        portalEnabledOverride
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Portal Settings Updated",
        description: "Project portal settings have been saved successfully.",
      });
      // Invalidate project data and portal status to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'portal-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update portal settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle "new" project creation case - redirect to projects page
  useEffect(() => {
    if (projectId === "new") {
      setLocation("/projects");
    }
  }, [projectId, setLocation]);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${projectId}`);
      return response.json();
    },
    enabled: !!projectId,
  });

  // Additional queries from modal
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["/api/members"],
    enabled: !!project,
  });

  const { data: venues = [] } = useQuery<Venue[]>({
    queryKey: ["/api/venues"],
    enabled: !!project,
  });

  const { data: projectFiles = [] } = useQuery<ProjectFile[]>({
    queryKey: ["/api/projects", project?.id, "files"],
    enabled: !!project,
  });

  const { data: projectNotes = [] } = useQuery<ProjectNote[]>({
    queryKey: ["/api/projects", project?.id, "notes"],
    enabled: !!project,
  });

  const { data: projectMembers = [] } = useQuery<ProjectMember[]>({
    queryKey: ["/api/projects", project?.id, "members"],
    enabled: !!project,
  });

  // Fetch documents for this project's client
  const { data: projectQuotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/contacts", project?.contactId, "quotes"],
    enabled: !!project && !!project.contactId,
  });

  const { data: projectContracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contacts", project?.contactId, "contracts"],
    enabled: !!project && !!project.contactId,
  });

  const { data: projectInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/contacts", project?.contactId, "invoices"],
    enabled: !!project && !!project.contactId,
  });

  // Fetch venue information if project has a venue
  const { data: projectVenue } = useQuery<Venue>({
    queryKey: ["/api/venues", project?.venueId],
    enabled: !!project && !!project.venueId,
  });

  // Fetch contact information for the project
  const { data: projectContact } = useQuery<Contact>({
    queryKey: ["/api/contacts", project?.contactId],
    enabled: !!project && !!project.contactId,
  });

  // Forms
  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  });

  const memberForm = useForm<MemberAssignmentData>({
    resolver: zodResolver(memberAssignmentSchema),
    defaultValues: { memberId: "", role: "", fee: "" },
  });

  const contractEditForm = useForm<ContractEditData>({
    resolver: zodResolver(contractEditSchema),
  });
  
  const invoiceEditForm = useForm<InvoiceEditData>({
    resolver: zodResolver(invoiceEditSchema),
  });
  
  const contactEditForm = useForm<z.infer<typeof insertContactSchema>>({
    resolver: zodResolver(insertContactSchema),
  });

  // Handle editContract query parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const editContractId = searchParams.get('editContract');
    
    if (editContractId && projectContracts.length > 0) {
      const contractToEdit = projectContracts.find(c => c.id === editContractId);
      if (contractToEdit) {
        setEditingContract(contractToEdit);
        setShowContractEditor(true);
        // Clear the query parameter from URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [projectContracts]);

  // Mutations
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
  
  // Contact update mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertContactSchema>) => {
      if (!projectContact?.id) throw new Error("No contact to update");
      const response = await apiRequest("PUT", `/api/contacts/${projectContact.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Success",
        description: "Contact updated successfully!",
      });
      contactEditForm.reset();
      setShowContactEditModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contact. Please try again.",
        variant: "destructive",
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
  const createContractMutation = useMutation({
    mutationFn: async () => {
      const contractData = {
        contactId: project?.contactId,
        projectId: project?.id,
        title: `Contract for ${project?.name}`,
        description: `Contract for project: ${project?.name}`,
        amount: "0.00",
        contractNumber: `C-${Date.now()}`
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
        invoiceNumber: `I-${Date.now()}`
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
  
  // Update mutations
  const updateContractMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContractEditData }) => 
      apiRequest("PATCH", `/api/contracts/${id}`, {
        ...data,
        amount: parseFloat(data.amount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
      setSelectedDocument(null);
      toast({
        title: "Success",
        description: "Contract updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contract. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvoiceEditData }) => 
      apiRequest("PATCH", `/api/invoices/${id}`, {
        ...data,
        subtotal: parseFloat(data.subtotal),
        taxAmount: data.taxAmount ? parseFloat(data.taxAmount) : 0,
        total: parseFloat(data.total),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
      setSelectedDocument(null);
      toast({
        title: "Success",
        description: "Invoice updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handler functions for new quote creation flow
  const handleCreateQuote = () => {
    if (project?.contactId) {
      setSelectedContactId(project.contactId);
      const contactName = projectContact 
        ? `${projectContact.firstName} ${projectContact.lastName}`
        : "Loading contact...";
      setSelectedContactName(contactName);
      setShowQuoteEditor(true);
    } else {
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

  // Handler functions for new contract creation flow
  const handleCreateContract = () => {
    if (project?.contactId) {
      setSelectedContactId(project.contactId);
      const contactName = projectContact 
        ? `${projectContact.firstName} ${projectContact.lastName}`
        : "Loading contact...";
      setSelectedContactName(contactName);
      setEditingContract(null);
      setShowContractEditor(true);
    } else {
      toast({
        title: "Contact Required",
        description: "Please assign a contact to this project before creating a contract.",
        variant: "destructive",
      });
    }
  };

  const handleContractEditorClose = () => {
    setEditingContract(null);
    setShowContractEditor(false);
    setSelectedContactId("");
    setSelectedContactName("");
  };
  
  // Handler for contact editing
  const handleEditContact = () => {
    if (!projectContact) return;
    
    // Populate the form with current contact data
    const displayName = projectContact.firstName && projectContact.lastName 
      ? `${projectContact.firstName} ${projectContact.lastName}` 
      : projectContact.firstName || projectContact.lastName || projectContact.email;
    
    contactEditForm.reset({
      ...projectContact,
      fullName: displayName,
      tags: projectContact.tags || [],
      jobTitle: projectContact.jobTitle || "",
      website: projectContact.website || "",
      leadSource: projectContact.leadSource || "",
      notes: projectContact.notes || "",
      venueAddress: projectContact.venueAddress || "",
      venueCity: projectContact.venueCity || "",
      venueState: projectContact.venueState || "",
      venueZipCode: projectContact.venueZipCode || "",
    });
    
    setShowContactEditModal(true);
  };

  // Handle edit operations
  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
    setShowQuoteEditor(true);
  };

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setSelectedContactId(contract.contactId);
    const contactName = projectContact 
      ? `${projectContact.firstName} ${projectContact.lastName}`
      : "Loading contact...";
    setSelectedContactName(contactName);
    setShowContractEditor(true);
  };

  const handleEditInvoice = (invoice: any) => {
    invoiceEditForm.reset({
      title: invoice.title,
      description: invoice.description || '',
      subtotal: invoice.subtotal.toString(),
      taxAmount: invoice.taxAmount ? invoice.taxAmount.toString() : '0',
      total: invoice.total.toString(),
    });
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <>
        <Header title="Project Details" subtitle="Loading..." />
        <main className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-24 bg-muted rounded"></div>
          </div>
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="Project Not Found" subtitle="The requested project could not be found" />
        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">Project with ID "{projectId}" not found.</p>
              <Button asChild>
                <Link href="/projects">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header 
        title={project.name} 
        subtitle={`Project #${project.id}`}
      />
      
      <main className="flex-1 overflow-auto p-6" data-testid="project-detail">
        <div className="space-y-6">
          {/* Back Button */}
          <div>
            <Button variant="outline" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Link>
            </Button>
          </div>

          {/* Project Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Project Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Project Overview
                    </CardTitle>
                    <Badge className={getStatusColor(project.status)}>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium mb-2">Project Details</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span> {project.name}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Description:</span> {project.description || 'No description'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Estimated Value:</span> 
                          {project.estimatedValue ? `£${project.estimatedValue.toLocaleString()}` : 'Not specified'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Progress:</span> {project.progress || 0}%
                        </div>
                      </div>
                      {project.progress !== null && (
                        <div className="mt-3">
                          <Progress value={project.progress || 0} className="w-full" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Timeline</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Project Date:</span> {formatDate(project.startDate?.toString() || null)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Created:</span> {formatDate(project.createdAt?.toString() || null)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Updated:</span> {formatDate(project.updatedAt?.toString() || null)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client Information */}
              {projectContact && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Client Information</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" data-testid="button-contact-menu">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleEditContact} data-testid="menu-edit-contact">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Contact
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="font-medium">{projectContact.firstName} {projectContact.lastName}</span>
                      </div>
                      {projectContact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a 
                            href={`mailto:${projectContact.email}`} 
                            className="text-primary hover:underline"
                          >
                            {projectContact.email}
                          </a>
                        </div>
                      )}
                      {projectContact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a 
                            href={`tel:${projectContact.phone}`} 
                            className="text-primary hover:underline"
                          >
                            {projectContact.phone}
                          </a>
                        </div>
                      )}
                      {projectContact.address && (
                        <div>
                          <span className="text-muted-foreground">Address:</span> {projectContact.address}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Client Portal Settings */}
              <Card data-testid="project-portal-settings-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Client Portal Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Portal Status Overview */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Portal Access Status</Label>
                        <p className="text-sm text-muted-foreground">
                          Current portal access status for this project
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          effectivePortalStatus
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }
                        data-testid="portal-status-badge"
                      >
                        {effectivePortalStatus ? "Portal Enabled" : "Portal Disabled"}
                      </Badge>
                    </div>

                    <Alert data-testid="portal-status-alert">
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        {tenantPortalEnabled ? (
                          portalStatus?.projectOverride === false ? (
                            <>
                              <strong>Portal disabled for this project.</strong> While your organization has the client portal enabled, 
                              this specific project has been set to disable portal access.
                            </>
                          ) : portalStatus?.projectOverride === true ? (
                            <>
                              <strong>Portal explicitly enabled for this project.</strong> This project overrides your organization settings 
                              to ensure portal access is available.
                            </>
                          ) : (
                            <>
                              <strong>Portal enabled via organization settings.</strong> This project inherits your organization's portal settings. 
                              Clients can access their portal for this project.
                            </>
                          )
                        ) : (
                          portalStatus?.projectOverride === true ? (
                            <>
                              <strong>Portal enabled for this project only.</strong> While your organization has the client portal disabled, 
                              this specific project allows portal access.
                            </>
                          ) : (
                            <>
                              <strong>Portal disabled via organization settings.</strong> Your organization has disabled the client portal, 
                              so clients cannot access portals for any projects.
                            </>
                          )
                        )}
                      </AlertDescription>
                    </Alert>
                  </div>

                  <Separator />

                  {/* Project-specific Override Controls */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Project Override Settings</Label>
                    
                    <div className="space-y-3">
                      {/* Use Organization Default */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Use Organization Default</p>
                          <p className="text-sm text-muted-foreground">
                            Follow the organization-wide portal setting ({tenantPortalEnabled ? 'enabled' : 'disabled'})
                          </p>
                        </div>
                        <Switch 
                          checked={portalStatus?.projectOverride === null}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updatePortalMutation.mutate({ portalEnabledOverride: null });
                            }
                          }}
                          disabled={updatePortalMutation.isPending}
                          data-testid="switch-use-default"
                        />
                      </div>

                      {/* Enable for This Project */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Enable for This Project</p>
                          <p className="text-sm text-muted-foreground">
                            Force enable portal access for this specific project
                          </p>
                        </div>
                        <Switch 
                          checked={portalStatus?.projectOverride === true}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updatePortalMutation.mutate({ portalEnabledOverride: true });
                            }
                          }}
                          disabled={updatePortalMutation.isPending}
                          data-testid="switch-enable-override"
                        />
                      </div>

                      {/* Disable for This Project */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Disable for This Project</p>
                          <p className="text-sm text-muted-foreground">
                            Force disable portal access for this specific project
                          </p>
                        </div>
                        <Switch 
                          checked={portalStatus?.projectOverride === false}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updatePortalMutation.mutate({ portalEnabledOverride: false });
                            }
                          }}
                          disabled={updatePortalMutation.isPending}
                          data-testid="switch-disable-override"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Portal Link Preview */}
                  {effectivePortalStatus && (
                    <div className="space-y-3">
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Portal Link</Label>
                          <p className="text-sm text-muted-foreground">
                            Share this link with your client to access their portal
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          asChild
                          data-testid="button-open-portal"
                        >
                          <Link href={`/portal/${projectId}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Portal
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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
                      onClick={handleCreateContract}
                      data-testid="button-create-contract"
                    >
                      <File className="h-4 w-4 mr-2" />
                      Create Contract
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
                            className="flex items-center justify-between p-3 border rounded-lg cursor-pointer bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 transition-colors"
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
                            className="flex items-center justify-between p-3 border rounded-lg cursor-pointer bg-green-100 hover:bg-green-200 dark:bg-green-950/60 dark:hover:bg-green-900/60 transition-colors"
                            onClick={() => setLocation(`/contracts/${contract.id}/preview`)}
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
                            className="flex items-center justify-between p-3 border rounded-lg cursor-pointer bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 transition-colors"
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

            <TabsContent value="email" className="space-y-6">
              <ProjectEmailPanel projectId={projectId!} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <ContactPicker
          isOpen={showContactPicker}
          onClose={() => setShowContactPicker(false)}
          onSelect={handleContactSelected}
        />
      )}

      {/* Quote Editor Modal */}
      {showQuoteEditor && (
        <QuoteEditor
          isOpen={showQuoteEditor}
          onClose={handleQuoteEditorClose}
          contactId={selectedContactId}
          contactName={selectedContactName}
          projectId={project?.id}
          quote={editingQuote}
        />
      )}

      {/* Contract Editor Modal */}
      {showContractEditor && (
        <CreateContractDialog
          open={showContractEditor}
          onOpenChange={(open) => {
            if (!open) handleContractEditorClose();
          }}
          initialContactId={selectedContactId}
          initialProjectId={project?.id}
          contract={editingContract}
        />
      )}
      
      {/* Contact Edit Modal */}
      <Dialog open={showContactEditModal} onOpenChange={setShowContactEditModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
            <DialogDescription>
              Update contact information. Required fields are marked with an asterisk (*).
            </DialogDescription>
          </DialogHeader>
          
          <Form {...contactEditForm}>
            <form onSubmit={contactEditForm.handleSubmit((data) => updateContactMutation.mutate(data))} className="space-y-6">
              
              {/* Basic Info Section */}
              <div className="space-y-4">
                <FormField
                  control={contactEditForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-edit-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={contactEditForm.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-edit-contact-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactEditForm.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={Array.isArray(field.value) ? field.value.join(', ') : ''} 
                          onChange={(e) => field.onChange(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                          placeholder="Enter tags separated by commas"
                          data-testid="input-edit-contact-tags" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={contactEditForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-edit-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={contactEditForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} value={field.value || ""} data-testid="input-edit-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={contactEditForm.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-edit-contact-company" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={contactEditForm.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input type="url" {...field} value={field.value || ""} placeholder="https://" data-testid="input-edit-contact-website" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Address Section */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold">Address</h3>
                
                <AddressFields
                  control={contactEditForm.control}
                  countryCode={contactEditForm.watch('country') || undefined}
                  onCountryChange={(countryCode) =>
                    contactEditForm.setValue('country', countryCode, { shouldDirty: true, shouldValidate: true })
                  }
                  fieldNames={{
                    address1: 'address',
                    city: 'city',
                    state: 'state',
                    postalCode: 'zipCode',
                    country: 'country'
                  }}
                />
              </div>

              <Separator />

              {/* Notes Section */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold">Notes</h3>
                <FormField
                  control={contactEditForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ""} 
                          rows={4}
                          placeholder="Add any notes about this contact..."
                          data-testid="input-edit-contact-notes" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Custom Fields Section - Placeholder for now */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold">Contact Custom Fields</h3>
                <p className="text-sm text-muted-foreground">
                  Custom fields can be configured in your tenant settings.
                </p>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowContactEditModal(false)}
                  data-testid="button-cancel-contact-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateContactMutation.isPending}
                  data-testid="button-save-contact"
                >
                  {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
