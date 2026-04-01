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
import { TagInput } from "@/components/ui/tag-input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Mail, Phone, Calendar, Briefcase, MessageSquare, ExternalLink, Shield, Info,
  Users, FileText, Upload, Download, Trash, Clock, DollarSign, MapPin,
  Receipt, File, Send, Check, Edit, Trash2, Plus, MoreVertical, User, Home,
  ListTodo, Timer, Music, Utensils, Car, Building, PhoneCall, Activity, TrendingUp, ChevronDown
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
import InvoiceEditor from "@/components/invoice/InvoiceEditor";
import { AddressFields } from "@/components/shared/AddressFields";

const noteSchema = z.object({
  note: z.string().min(1, "Note is required"),
});

const memberAssignmentSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  role: z.string().optional(),
  fee: z.string().optional(),
  offerType: z.string().optional(),
  notes: z.string().optional(),
});

const contractEditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  terms: z.string().optional(),
});

const invoiceEditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  subtotal: z.string().min(1, "Subtotal is required"),
  taxAmount: z.string().optional(),
  total: z.string().min(1, "Total is required"),
});

const taskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
});

const scheduleItemSchema = z.object({
  time: z.string().min(1, "Time is required"),
  label: z.string().min(1, "Label is required"),
  notes: z.string().optional(),
});

type NoteFormData = z.infer<typeof noteSchema>;
type MemberAssignmentData = z.infer<typeof memberAssignmentSchema>;
type ContractEditData = z.infer<typeof contractEditSchema>;
type InvoiceEditData = z.infer<typeof invoiceEditSchema>;
type TaskFormData = z.infer<typeof taskSchema>;
type ScheduleItemData = z.infer<typeof scheduleItemSchema>;

export default function ProjectDetail() {
  const [match, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id;
  const { toast } = useToast();

  // Check URL parameters for auto-actions
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const [activeTab, setActiveTab] = useState(action === 'compose_email' ? 'email' : 'overview');
  const [autoOpenComposer, setAutoOpenComposer] = useState(action === 'compose_email');

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

  // Invoice creation flow state
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Contact editing state
  const [showContactEditModal, setShowContactEditModal] = useState(false);

  // Project overview editing state
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [overviewForm, setOverviewForm] = useState({
    name: '',
    description: '',
    venueId: '',
    startDate: '',
    startTime: '',
    endTime: '',
    eventType: '',
    estimatedValue: '',
    leadSource: '',
    budgetRange: '',
    referralSource: '',
    dressCode: '',
    parkingDetails: '',
    loadInDetails: '',
    accommodation: '',
    mealDetails: '',
    backlineProduction: '',
    secondContactName: '',
    secondContactPhone: '',
    dayOfContactName: '',
    dayOfContactPhone: '',
    lineupSummary: '',
  });

  // Task and schedule editing state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleItem, setEditingScheduleItem] = useState<any>(null);
  const [noteVisibilityFilter, setNoteVisibilityFilter] = useState<'all' | 'private' | 'shared'>('all');

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

  // New queries for tasks and schedule
  const { data: projectTasks = [] } = useQuery({
    queryKey: ["/api/projects", project?.id, "tasks"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${project!.id}/tasks`);
      return response.json();
    },
    enabled: !!project,
  });

  const { data: projectSchedule = [] } = useQuery({
    queryKey: ["/api/projects", project?.id, "schedule"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${project!.id}/schedule`);
      return response.json();
    },
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

  // Contact information is now embedded in the project response for instant loading
  const projectContact = project?.contactId ? {
    id: project.contactId,
    firstName: (project as any).contactFirstName,
    lastName: (project as any).contactLastName,
    email: (project as any).contactEmail,
    phone: (project as any).contactPhone,
    address: (project as any).contactAddress,
    jobTitle: (project as any).contactJobTitle,
    website: (project as any).contactWebsite,
  } : null;

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

  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", priority: "MEDIUM", status: "pending" },
  });

  const scheduleForm = useForm<ScheduleItemData>({
    resolver: zodResolver(scheduleItemSchema),
    defaultValues: { time: "", label: "", notes: "" },
  });

  const contactEditForm = useForm({
    resolver: zodResolver(insertContactSchema),
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiRequest("POST", `/api/projects/${projectId}/files`, formData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File uploaded successfully",
        description: "Your file has been added to the project.",
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/notes`, {
        note: noteText,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Note added",
        description: "Your note has been saved.",
      });
      noteForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "notes"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to save note. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Assign member mutation
  const assignMemberMutation = useMutation({
    mutationFn: async (data: MemberAssignmentData) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/members`, {
        memberId: data.memberId,
        role: data.role,
        fee: data.fee ? parseFloat(data.fee) : undefined,
        offerType: data.offerType,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member assigned",
        description: "Member has been added to the project.",
      });
      memberForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to assign member. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/files/${fileId}`);
    },
    onSuccess: () => {
      toast({
        title: "File deleted",
        description: "The file has been removed from the project.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete file. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (projectMemberId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/members/${projectMemberId}`);
    },
    onSuccess: () => {
      toast({
        title: "Member removed",
        description: "The member has been removed from the project.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update project member mutation
  const updateProjectMemberMutation = useMutation({
    mutationFn: async (data: { projectMemberId: string; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/members/${data.projectMemberId}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member updated",
        description: "Member details have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update member. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await apiRequest("PATCH", `/api/contacts/${projectContact?.id}`, formData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contact updated",
        description: "Contact information has been saved successfully.",
      });
      setShowContactEditModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', projectContact?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send document mutation
  const sendDocumentMutation = useMutation({
    mutationFn: async (data: { documentId: string; documentType: 'quote' | 'contract' | 'invoice'; email?: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/documents/${data.documentType}/${data.documentId}/send`, {
        email: data.email,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document sent",
        description: "The document has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to send document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Approve document mutation
  const approveDocumentMutation = useMutation({
    mutationFn: async (data: { documentId: string; documentType: 'quote' | 'contract' | 'invoice' }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/documents/${data.documentType}/${data.documentId}`, {
        status: 'approved',
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document approved",
        description: "The document has been approved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to approve document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create contract mutation
  const createContractMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        projectId,
        contactId: selectedContactId,
      };
      const response = await apiRequest("POST", "/api/contracts", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contract created",
        description: "The contract has been created successfully.",
      });
      setShowContractEditor(false);
      setEditingContract(null);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to create contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        projectId,
        contactId: selectedContactId,
      };
      const response = await apiRequest("POST", "/api/invoices", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invoice created",
        description: "The invoice has been created successfully.",
      });
      setShowInvoiceEditor(false);
      setEditingInvoice(null);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete quote mutation
  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      await apiRequest("DELETE", `/api/quotes/${quoteId}`);
    },
    onSuccess: () => {
      toast({
        title: "Quote deleted",
        description: "The quote has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "quotes"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete contract mutation
  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      await apiRequest("DELETE", `/api/contracts/${contractId}`);
    },
    onSuccess: () => {
      toast({
        title: "Contract deleted",
        description: "The contract has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await apiRequest("DELETE", `/api/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      toast({
        title: "Invoice deleted",
        description: "The invoice has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update contract mutation
  const updateContractMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/contracts/${data.id}`, {
        title: data.title,
        description: data.description,
        amount: data.amount,
        terms: data.terms,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contract updated",
        description: "The contract has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "contracts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update invoice mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/invoices/${data.id}`, {
        title: data.title,
        description: data.description,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        total: data.total,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invoice updated",
        description: "The invoice has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", project?.contactId, "invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Task mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/tasks`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Task created", description: "Task has been added successfully." });
      taskForm.reset();
      setShowTaskForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { taskId: string; updates: Partial<TaskFormData> }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/tasks/${data.taskId}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Task updated", description: "Task has been updated." });
      taskForm.reset();
      setEditingTask(null);
      setShowTaskForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      toast({ title: "Task deleted", description: "Task has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to delete task.", variant: "destructive" });
    },
  });

  // Schedule mutations
  const createScheduleItemMutation = useMutation({
    mutationFn: async (data: ScheduleItemData) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/schedule`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Schedule item added", description: "Schedule item has been created." });
      scheduleForm.reset();
      setShowScheduleForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "schedule"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to create schedule item.", variant: "destructive" });
    },
  });

  const updateScheduleItemMutation = useMutation({
    mutationFn: async (data: { itemId: string; updates: Partial<ScheduleItemData> }) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/schedule/${data.itemId}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Schedule item updated", description: "Schedule item has been updated." });
      scheduleForm.reset();
      setEditingScheduleItem(null);
      setShowScheduleForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "schedule"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to update schedule item.", variant: "destructive" });
    },
  });

  const deleteScheduleItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/schedule/${itemId}`);
    },
    onSuccess: () => {
      toast({ title: "Schedule item deleted", description: "Schedule item has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "schedule"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to delete schedule item.", variant: "destructive" });
    },
  });

  // Handler functions for quote creation flow
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

  // Handler functions for contract creation flow
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

  // Handler functions for invoice creation flow
  const handleCreateInvoice = () => {
    if (project?.contactId) {
      setSelectedContactId(project.contactId);
      const contactName = projectContact
        ? `${projectContact.firstName} ${projectContact.lastName}`
        : "Loading contact...";
      setSelectedContactName(contactName);
      setEditingInvoice(null);
      setShowInvoiceEditor(true);
    } else {
      toast({
        title: "Contact Required",
        description: "Please assign a contact to this project before creating an invoice.",
        variant: "destructive",
      });
    }
  };

  // Handler for project overview editing
  const handleStartEditOverview = () => {
    if (!project) return;
    setOverviewForm({
      name: project.name || '',
      description: project.description || '',
      venueId: project.venueId || '',
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
      startTime: (project as any).startTime || '',
      endTime: (project as any).endTime || '',
      eventType: (project as any).eventType || '',
      estimatedValue: project.estimatedValue ? String(project.estimatedValue) : '',
      leadSource: (project as any).leadSource || '',
      budgetRange: (project as any).budgetRange || '',
      referralSource: (project as any).referralSource || '',
      dressCode: (project as any).dressCode || '',
      parkingDetails: (project as any).parkingDetails || '',
      loadInDetails: (project as any).loadInDetails || '',
      accommodation: (project as any).accommodation || '',
      mealDetails: (project as any).mealDetails || '',
      backlineProduction: (project as any).backlineProduction || '',
      secondContactName: (project as any).secondContactName || '',
      secondContactPhone: (project as any).secondContactPhone || '',
      dayOfContactName: (project as any).dayOfContactName || '',
      dayOfContactPhone: (project as any).dayOfContactPhone || '',
      lineupSummary: (project as any).lineupSummary || '',
    });
    setIsEditingOverview(true);
  };

  const handleSaveOverview = async () => {
    if (!project) return;
    try {
      const payload: any = {
        name: overviewForm.name,
        description: overviewForm.description || null,
        venueId: overviewForm.venueId || null,
        startDate: overviewForm.startDate ? new Date(overviewForm.startDate).toISOString() : null,
        startTime: overviewForm.startTime || null,
        endTime: overviewForm.endTime || null,
        eventType: overviewForm.eventType || null,
        estimatedValue: overviewForm.estimatedValue ? overviewForm.estimatedValue : null,
        leadSource: overviewForm.leadSource || null,
        budgetRange: overviewForm.budgetRange || null,
        referralSource: overviewForm.referralSource || null,
        dressCode: overviewForm.dressCode || null,
        parkingDetails: overviewForm.parkingDetails || null,
        loadInDetails: overviewForm.loadInDetails || null,
        accommodation: overviewForm.accommodation || null,
        mealDetails: overviewForm.mealDetails || null,
        backlineProduction: overviewForm.backlineProduction || null,
        secondContactName: overviewForm.secondContactName || null,
        secondContactPhone: overviewForm.secondContactPhone || null,
        dayOfContactName: overviewForm.dayOfContactName || null,
        dayOfContactPhone: overviewForm.dayOfContactPhone || null,
        lineupSummary: overviewForm.lineupSummary || null,
      };
      await apiRequest('PATCH', `/api/projects/${project.id}`, payload);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/venues', overviewForm.venueId] });
      setIsEditingOverview(false);
      toast({ title: "Project Updated", description: "Project details saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save project details.", variant: "destructive" });
    }
  };

  const handleCancelEditOverview = () => {
    setIsEditingOverview(false);
  };

  // Handler for contact editing
  const handleEditContact = () => {
    if (!projectContact) return;

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

  const handleSaveContact = async (formData: any) => {
    try {
      await updateContactMutation.mutateAsync(formData);
    } catch (error) {
      console.error("Failed to save contact:", error);
    }
  };

  // Handler for task form
  const handleEditTask = (task: any) => {
    setEditingTask(task);
    taskForm.reset({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "MEDIUM",
      dueDate: task.dueDate || "",
      assigneeId: task.assigneeId || "",
      status: task.status || "pending",
    });
    setShowTaskForm(true);
  };

  const handleSaveTask = async (formData: TaskFormData) => {
    if (editingTask) {
      await updateTaskMutation.mutateAsync({ taskId: editingTask.id, updates: formData });
    } else {
      await createTaskMutation.mutateAsync(formData);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  // Handler for schedule form
  const handleEditScheduleItem = (item: any) => {
    setEditingScheduleItem(item);
    scheduleForm.reset({
      time: item.time || "",
      label: item.label || "",
      notes: item.notes || "",
    });
    setShowScheduleForm(true);
  };

  const handleSaveScheduleItem = async (formData: ScheduleItemData) => {
    if (editingScheduleItem) {
      await updateScheduleItemMutation.mutateAsync({ itemId: editingScheduleItem.id, updates: formData });
    } else {
      await createScheduleItemMutation.mutateAsync(formData);
    }
  };

  const handleDeleteScheduleItem = (itemId: string) => {
    if (confirm("Are you sure you want to delete this schedule item?")) {
      deleteScheduleItemMutation.mutate(itemId);
    }
  };

  // Helper functions
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-500",
      contacted: "bg-cyan-500",
      hold: "bg-amber-500",
      proposal_sent: "bg-purple-500",
      booked: "bg-green-500",
      completed: "bg-emerald-500",
      lost: "bg-red-500",
      cancelled: "bg-gray-500",
      archived: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getTaskPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      HIGH: "bg-red-100 text-red-800",
      MEDIUM: "bg-yellow-100 text-yellow-800",
      LOW: "bg-green-100 text-green-800",
    };
    return colors[priority] || "bg-gray-100 text-gray-800";
  };

  const filteredNotes = projectNotes.filter(note => {
    if (noteVisibilityFilter === 'all') return true;
    if (noteVisibilityFilter === 'private') return (note as any).visibility === 'private';
    if (noteVisibilityFilter === 'shared') return (note as any).visibility === 'shared';
    return true;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading project...</div>;
  }

  if (!match || !project) {
    return <div className="flex items-center justify-center h-96">Project not found</div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
              <span>/</span>
              <span>{project.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-semibold">{project.name}</h1>
                <Badge className={getStatusColor(project.status) + " text-sm px-3 py-1"}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Project Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-10">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                <span className="hidden sm:inline">Schedule</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                <span className="hidden sm:inline">Tasks</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="members" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Members</span>
              </TabsTrigger>
              <TabsTrigger value="documents">
                <span className="hidden sm:inline">Documents</span>
                <span className="inline sm:hidden">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email</span>
              </TabsTrigger>
              <TabsTrigger value="financials" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Financials</span>
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-6">
              {isEditingOverview ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Edit Project Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Project Name</Label>
                        <Input
                          value={overviewForm.name}
                          onChange={(e) => setOverviewForm({ ...overviewForm, name: e.target.value })}
                          placeholder="Project name"
                        />
                      </div>
                      <div>
                        <Label>Event Type</Label>
                        <Input
                          value={overviewForm.eventType}
                          onChange={(e) => setOverviewForm({ ...overviewForm, eventType: e.target.value })}
                          placeholder="e.g., Wedding, Corporate"
                        />
                      </div>
                      <div>
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={overviewForm.startDate}
                          onChange={(e) => setOverviewForm({ ...overviewForm, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={overviewForm.startTime}
                          onChange={(e) => setOverviewForm({ ...overviewForm, startTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={overviewForm.endTime}
                          onChange={(e) => setOverviewForm({ ...overviewForm, endTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Estimated Value</Label>
                        <Input
                          type="number"
                          value={overviewForm.estimatedValue}
                          onChange={(e) => setOverviewForm({ ...overviewForm, estimatedValue: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Lead Source</Label>
                        <Input
                          value={overviewForm.leadSource}
                          onChange={(e) => setOverviewForm({ ...overviewForm, leadSource: e.target.value })}
                          placeholder="e.g., Referral, Website"
                        />
                      </div>
                      <div>
                        <Label>Budget Range</Label>
                        <Input
                          value={overviewForm.budgetRange}
                          onChange={(e) => setOverviewForm({ ...overviewForm, budgetRange: e.target.value })}
                          placeholder="e.g., $5K-$10K"
                        />
                      </div>
                      <div>
                        <Label>Referral Source</Label>
                        <Input
                          value={overviewForm.referralSource}
                          onChange={(e) => setOverviewForm({ ...overviewForm, referralSource: e.target.value })}
                          placeholder="Referral source"
                        />
                      </div>
                      <div>
                        <Label>Venue</Label>
                        <Select value={overviewForm.venueId} onValueChange={(value) => setOverviewForm({ ...overviewForm, venueId: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select venue" />
                          </SelectTrigger>
                          <SelectContent>
                            {venues.map((venue) => (
                              <SelectItem key={venue.id} value={venue.id}>
                                {venue.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Dress Code</Label>
                        <Input
                          value={overviewForm.dressCode}
                          onChange={(e) => setOverviewForm({ ...overviewForm, dressCode: e.target.value })}
                          placeholder="e.g., Black Tie"
                        />
                      </div>
                      <div>
                        <Label>Meal</Label>
                        <Input
                          value={overviewForm.mealDetails}
                          onChange={(e) => setOverviewForm({ ...overviewForm, mealDetails: e.target.value })}
                          placeholder="Meal details"
                        />
                      </div>
                      <div>
                        <Label>Accommodation</Label>
                        <Input
                          value={overviewForm.accommodation}
                          onChange={(e) => setOverviewForm({ ...overviewForm, accommodation: e.target.value })}
                          placeholder="Accommodation details"
                        />
                      </div>
                      <div>
                        <Label>Parking</Label>
                        <Input
                          value={overviewForm.parkingDetails}
                          onChange={(e) => setOverviewForm({ ...overviewForm, parkingDetails: e.target.value })}
                          placeholder="Parking details"
                        />
                      </div>
                      <div>
                        <Label>Load-in</Label>
                        <Input
                          value={overviewForm.loadInDetails}
                          onChange={(e) => setOverviewForm({ ...overviewForm, loadInDetails: e.target.value })}
                          placeholder="Load-in details"
                        />
                      </div>
                      <div>
                        <Label>Backline/Production</Label>
                        <Input
                          value={overviewForm.backlineProduction}
                          onChange={(e) => setOverviewForm({ ...overviewForm, backlineProduction: e.target.value })}
                          placeholder="Backline/production details"
                        />
                      </div>
                      <div>
                        <Label>Second Contact Name</Label>
                        <Input
                          value={overviewForm.secondContactName}
                          onChange={(e) => setOverviewForm({ ...overviewForm, secondContactName: e.target.value })}
                          placeholder="Contact name"
                        />
                      </div>
                      <div>
                        <Label>Second Contact Phone</Label>
                        <Input
                          value={overviewForm.secondContactPhone}
                          onChange={(e) => setOverviewForm({ ...overviewForm, secondContactPhone: e.target.value })}
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <Label>Day-of Contact Name</Label>
                        <Input
                          value={overviewForm.dayOfContactName}
                          onChange={(e) => setOverviewForm({ ...overviewForm, dayOfContactName: e.target.value })}
                          placeholder="Contact name"
                        />
                      </div>
                      <div>
                        <Label>Day-of Contact Phone</Label>
                        <Input
                          value={overviewForm.dayOfContactPhone}
                          onChange={(e) => setOverviewForm({ ...overviewForm, dayOfContactPhone: e.target.value })}
                          placeholder="Phone number"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={overviewForm.description}
                        onChange={(e) => setOverviewForm({ ...overviewForm, description: e.target.value })}
                        placeholder="Project description"
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label>Lineup Summary</Label>
                      <Textarea
                        value={overviewForm.lineupSummary}
                        onChange={(e) => setOverviewForm({ ...overviewForm, lineupSummary: e.target.value })}
                        placeholder="Summary of the lineup"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveOverview}>Save Changes</Button>
                      <Button variant="outline" onClick={handleCancelEditOverview}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* LEFT COLUMN */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Event Details Card */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">📋 Event Details</CardTitle>
                          <Badge className={getStatusColor(project.status)}>
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">EVENT TYPE
</p>
                            <p className="font-medium">{(project as any).eventType || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Date</p>
                            <p className="font-medium">
                              {project.startDate ? new Date(project.startDate).toLocaleDateString() : "Not specified"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">START TIME</p>
                            <p className="font-medium">{(project as any).startTime || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">End Time</p>
                            <p className="font-medium">{(project as any).endTime || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">ESTIMATED VALUE</p>
                            <p className="font-medium">${project.estimatedValue || "0.00"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Lead Source</p>
                            <p className="font-medium">{(project as any).leadSource || "Not specified"}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm text-muted-foreground">BUDGET RANGE</p>
                            <p className="font-medium">{(project as any).budgetRange || "Not specified"}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm text-muted-foreground">Referral Source</p>
                            <p className="font-medium">{(project as any).referralSource || "Not specified"}</p>
                          </div>
                        </div>
                        {project.description && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-sm text-muted-foreground">Description</p>
                              <p className="font-medium text-sm">{project.description}</p>
                            </div>
                          </>
                        )}
                        <Button variant="outline" size="sm" onClick={handleStartEditOverview} className="w-full mt-2">
                          <Edit className="h-4 w-4 mr-2" /> Edit Details
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Venue Card */}
                    {projectVenue ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">📍 Venue</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Venue Name</p>
                            <p className="font-medium">{projectVenue.name}</p>
                          </div>
                          {projectVenue.address && (
                            <div>
                              <p className="text-sm text-muted-foreground">Address</p>
                              <p className="font-medium text-sm">{projectVenue.address}</p>
                            </div>
                          )}
                          {(project as any).parkingDetails && (
                            <div>
                              <p className="text-sm text-muted-foreground">Parking</p>
                              <p className="font-medium text-sm">{(project as any).parkingDetails}</p>
                            </div>
                          )}
                          {(project as any).loadInDetails && (
                            <div>
                              <p className="text-sm text-muted-foreground">Load-in</p>
                              <p className="font-medium text-sm">{(project as any).loadInDetails}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Event Day Details Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">🎤 Event Day Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Dress Code</p>
                          <p className="font-medium">{(project as any).dressCode || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Meal</p>
                          <p className="font-medium">{(project as any).mealDetails || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Accommodation</p>
                          <p className="font-medium">{(project as any).accommodation || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Backline/Production</p>
                          <p className="font-medium">{(project as any).backlineProduction || "Not specified"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-6">
                    {/* Client Card */}
                    {projectContact ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">👤 Client</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">{projectContact.firstName} {projectContact.lastName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium text-sm break-all">{projectContact.email}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Phone</p>
                            <p className="font-medium">{projectContact.phone || "Not provided"}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditContact}
                            className="w-full mt-2"
                          >
                            <Edit className="h-4 w-4 mr-2" /> Edit Contact
                          </Button>
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Second Contact & Day-of Contact */}
                    {((project as any).secondContactName || (project as any).dayOfContactName) && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">👥 Additional Contacts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {(project as any).secondContactName && (
                            <div>
                              <p className="text-sm text-muted-foreground">Second Contact</p>
                              <p className="font-medium">{(project as any).secondContactName}</p>
                              <p className="text-sm text-muted-foreground">Phone</p>
                              <p className="font-medium">{(project as any).secondContactPhone || "Not provided"}</p>
                            </div>
                          )}
                          {(project as any).dayOfContactName && (
                            <div>
                              <p className="text-sm text-muted-foreground">Day-of Contact</p>
                              <p className="font-medium">{(project as any).dayOfContactName}</p>
                              <p className="text-sm text-muted-foreground">Phone</p>
                              <p className="font-medium">{(project as any).dayOfContactPhone || "Not provided"}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Financial Summary Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">💰 Financial Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Fee</p>
                          <p className="text-lg font-bold">${project.estimatedValue || "0.00"}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Deposit Paid</p>
                            <p className="font-medium">$0.00</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Outstanding</p>
                            <p className="font-medium">${project.estimatedValue || "0.00"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Documents Quick View */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">📄 Documents</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                          <span className="text-sm">Contract: {projectContracts.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-sm">Invoice: {projectInvoices.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                          <span className="text-sm">Quote: {projectQuotes.length}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Lifecycle Progress */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">📊 Lifecycle Progress</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Discovery</span>
                            <Check className="h-4 w-4 text-green-500" />
                          </div>
                          <Progress value={100} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Proposal</span>
                            <span className="text-muted-foreground">75%</span>
                          </div>
                          <Progress value={75} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Booking</span>
                            <span className="text-muted-foreground">50%</span>
                          </div>
                          <Progress value={50} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Execution</span>
                            <span className="text-muted-foreground">0%</span>
                          </div>
                          <Progress value={0} className="h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* SCHEDULE TAB */}
            <TabsContent value="schedule" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN - Run of Day */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">🕐 Run of Day</CardTitle>
                        <Button size="sm" onClick={() => {
                          setEditingScheduleItem(null);
                          scheduleForm.reset();
                          setShowScheduleForm(true);
                        }}>
                          <Plus className="h-4 w-4 mr-2" /> Add Item
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {projectSchedule.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">No schedule items. Add one to get started.</p>
                        ) : (
                          projectSchedule.map((item: any) => (
                            <div key={item.id} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-sm">{item.time}</p>
                                  <p className="font-semibold">{item.label}</p>
                                  {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditScheduleItem(item)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteScheduleItem(item.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT COLUMN - Quick Reference */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📌 Quick Reference</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {projectVenue && (
                        <div>
                          <p className="text-sm text-muted-foreground">Venue</p>
                          <p className="font-medium">{projectVenue.name}</p>
                        </div>
                      )}
                      {projectContact && (
                        <div>
                          <p className="text-sm text-muted-foreground">Main Contact</p>
                          <p className="font-medium">{projectContact.firstName} {projectContact.lastName}</p>
                          <p className="text-xs text-muted-foreground">{projectContact.phone}</p>
                        </div>
                      )}
                      {(project as any).dressCode && (
                        <div>
                          <p className="text-sm text-muted-foreground">Dress Code</p>
                          <p className="font-medium">{(project as any).dressCode}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📤 Export</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="outline" className="w-full" size="sm">
                        <Download className="h-4 w-4 mr-2" /> PDF
                      </Button>
                      <Button variant="outline" className="w-full" size="sm">
                        <Download className="h-4 w-4 mr-2" /> CSV
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Schedule Form Modal */}
              {showScheduleForm && (
                <Dialog open={showScheduleForm} onOpenChange={setShowScheduleForm}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingScheduleItem ? "Edit Schedule Item" : "Add Schedule Item"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Time</Label>
                        <Input
                          type="time"
                          value={scheduleForm.watch("time") || ""}
                          onChange={(e) => scheduleForm.setValue("time", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={scheduleForm.watch("label") || ""}
                          onChange={(e) => scheduleForm.setValue("label", e.target.value)}
                          placeholder="e.g., Load-in, Soundcheck"
                        />
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          value={scheduleForm.watch("notes") || ""}
                          onChange={(e) => scheduleForm.setValue("notes", e.target.value)}
                          placeholder="Additional notes"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSaveScheduleItem(scheduleForm.getValues())}>
                          {editingScheduleItem ? "Update" : "Add"}
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowScheduleForm(false);
                          setEditingScheduleItem(null);
                          scheduleForm.reset();
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            {/* TASKS TAB */}
            <TabsContent value="tasks" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">✅ Tasks</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Apply Template
                      </Button>
                      <Button size="sm" onClick={() => {
                        setEditingTask(null);
                        taskForm.reset();
                        setShowTaskForm(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" /> Add Task
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Done</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Assignee</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectTasks.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No tasks yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          projectTasks.map((task: any) => (
                            <TableRow key={task.id}>
                              <TableCell>
                                <Checkbox
                                  checked={task.status === 'completed'}
                                  onChange={(checked) => {
                                    updateTaskMutation.mutate({
                                      taskId: task.id,
                                      updates: { status: checked ? 'completed' : 'pending' }
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{task.title}</p>
                                  {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getTaskPriorityColor(task.priority)}>
                                  {task.priority}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {task.assigneeId ? members.find(m => m.id === task.assigneeId)?.name : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditTask(task)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteTask(task.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Task Form Modal */}
              {showTaskForm && (
                <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Task Title</Label>
                        <Input
                          value={taskForm.watch("title") || ""}
                          onChange={(e) => taskForm.setValue("title", e.target.value)}
                          placeholder="Task title"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={taskForm.watch("description") || ""}
                          onChange={(e) => taskForm.setValue("description", e.target.value)}
                          placeholder="Task description"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Priority</Label>
                          <Select value={taskForm.watch("priority") || "MEDIUM"} onValueChange={(value) => taskForm.setValue("priority", value as any)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HIGH">High</SelectItem>
                              <SelectItem value="MEDIUM">Medium</SelectItem>
                              <SelectItem value="LOW">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Select value={taskForm.watch("status") || "pending"} onValueChange={(value) => taskForm.setValue("status", value as any)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Due Date</Label>
                          <Input
                            type="date"
                            value={taskForm.watch("dueDate") || ""}
                            onChange={(e) => taskForm.setValue("dueDate", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Assignee</Label>
                          <Select value={taskForm.watch("assigneeId") || ""} onValueChange={(value) => taskForm.setValue("assigneeId", value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select member" />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSaveTask(taskForm.getValues())}>
                          {editingTask ? "Update" : "Add"}
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowTaskForm(false);
                          setEditingTask(null);
                          taskForm.reset();
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            {/* TIMELINE TAB */}
            <TabsContent value="timeline" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">📨 Communication Timeline</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <PhoneCall className="h-4 w-4 mr-2" /> Log Call
                      </Button>
                      <Button size="sm" variant="outline">
                        Filter
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Timeline events will appear here as communication is logged.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MEMBERS TAB */}
            <TabsContent value="members" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">👥 Project Members</CardTitle>
                    <Button size="sm" onClick={() => {
                      memberForm.reset();
                    }}>
                      <Plus className="h-4 w-4 mr-2" /> Assign Member
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Fee</TableHead>
                          <TableHead>Availability</TableHead>
                          <TableHead>Contract</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectMembers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No members assigned
                            </TableCell>
                          </TableRow>
                        ) : (
                          projectMembers.map((pm: any) => {
                            const member = members.find(m => m.id === pm.memberId);
                            return (
                              <TableRow key={pm.id}>
                                <TableCell className="font-medium">{member?.name || "Unknown"}</TableCell>
                                <TableCell>{pm.role || "-"}</TableCell>
                                <TableCell>${pm.fee || "0.00"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                                    Confirmed
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">Pending</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">Unpaid</Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeMemberMutation.mutate(pm.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Line-up Summary */}
              {(project as any).lineupSummary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">🎵 Line-up Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{(project as any).lineupSummary}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* DOCUMENTS TAB */}
            <TabsContent value="documents" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Contracts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{projectContracts.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Invoices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{projectInvoices.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quotes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{projectQuotes.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quotes Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Quotes</CardTitle>
                    <Button size="sm" onClick={handleCreateQuote}>
                      <Plus className="h-4 w-4 mr-2" /> Create Quote
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {projectQuotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No quotes created yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Quote #</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectQuotes.map((quote) => (
                            <TableRow key={quote.id}>
                              <TableCell className="font-medium">{quote.quoteNumber || quote.id.slice(0, 8)}</TableCell>
                              <TableCell>${quote.amount || "0.00"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{quote.status || "draft"}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{new Date(quote.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditingQuote(quote)}>
                                      <Edit className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => sendDocumentMutation.mutate({ documentId: quote.id, documentType: 'quote' })}>
                                      <Send className="h-4 w-4 mr-2" /> Send
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => deleteQuoteMutation.mutate(quote.id)} className="text-red-600">
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contracts Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Contracts</CardTitle>
                    <Button size="sm" onClick={handleCreateContract}>
                      <Plus className="h-4 w-4 mr-2" /> Create Contract
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {projectContracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No contracts created yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectContracts.map((contract) => (
                            <TableRow key={contract.id}>
                              <TableCell className="font-medium">{contract.title}</TableCell>
                              <TableCell>${contract.amount || "0.00"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{contract.status || "draft"}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{new Date(contract.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditingContract(contract)}>
                                      <Edit className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => sendDocumentMutation.mutate({ documentId: contract.id, documentType: 'contract' })}>
                                      <Send className="h-4 w-4 mr-2" /> Send
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => deleteContractMutation.mutate(contract.id)} className="text-red-600">
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoices Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Invoices</CardTitle>
                    <Button size="sm" onClick={handleCreateInvoice}>
                      <Plus className="h-4 w-4 mr-2" /> Create Invoice
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {projectInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No invoices created yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectInvoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">{invoice.invoiceNumber || invoice.id.slice(0, 8)}</TableCell>
                              <TableCell>${invoice.total || "0.00"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{invoice.status || "draft"}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditingInvoice(invoice)}>
                                      <Edit className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => sendDocumentMutation.mutate({ documentId: invoice.id, documentType: 'invoice' })}>
                                      <Send className="h-4 w-4 mr-2" /> Send
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => deleteInvoiceMutation.mutate(invoice.id)} className="text-red-600">
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* FILES TAB */}
            <TabsContent value="files" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">📁 Project Files</CardTitle>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> Upload
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {projectFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No files uploaded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {projectFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <File className="h-4 w-4" />
                            <div>
                              <p className="font-medium text-sm">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{file.size} bytes</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {file.portalVisible ? "Client Portal" : "Private"}
                            </Badge>
                            <Button size="sm" variant="ghost" onClick={() => deleteFileMutation.mutate(file.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* NOTES TAB */}
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">📝 Notes</CardTitle>
                    <div className="flex items-center gap-2">
                      <Select value={noteVisibilityFilter} onValueChange={(value: any) => setNoteVisibilityFilter(value)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Notes</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="shared">Shared</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Add Note</Label>
                    <Textarea
                      placeholder="Write a note..."
                      value={noteForm.watch("note") || ""}
                      onChange={(e) => noteForm.setValue("note", e.target.value)}
                      rows={3}
                    />
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        if (noteForm.watch("note")) {
                          addNoteMutation.mutate(noteForm.watch("note"));
                        }
                      }}
                    >
                      Add Note
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {filteredNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No notes yet.</p>
                    ) : (
                      filteredNotes.map((note) => (
                        <div key={note.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{note.title || "Untitled"}</p>
                              <p className="text-sm text-muted-foreground">{note.note}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {(note as any).visibility === 'private' ? 'Private' : 'Shared'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* EMAIL TAB */}
            <TabsContent value="email" className="space-y-6">
              <ProjectEmailPanel projectId={projectId!} autoOpenComposer={autoOpenComposer} />
            </TabsContent>

            {/* FINANCIALS TAB */}
            <TabsContent value="financials" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">Total Fee</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${project.estimatedValue || "0.00"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">Received</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">$0.00</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${project.estimatedValue || "0.00"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">Projected Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">$0.00</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Income Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Income</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>Total Project Fee</TableCell>
                              <TableCell className="font-medium">${project.estimatedValue || "0.00"}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Expenses Table */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Expenses</CardTitle>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" /> Add Expense
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground py-4">No expenses recorded yet.</p>
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                  {/* Member Costs Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Member Costs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Fee</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {projectMembers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={2} className="text-sm text-muted-foreground py-4">
                                  No members assigned
                                </TableCell>
                              </TableRow>
                            ) : (
                              projectMembers.map((pm: any) => {
                                const member = members.find(m => m.id === pm.memberId);
                                return (
                                  <TableRow key={pm.id}>
                                    <TableCell className="text-sm">{member?.name}</TableCell>
                                    <TableCell className="font-medium">${pm.fee || "0.00"}</TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Profit Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Profit Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Fee</span>
                          <span className="font-medium">${project.estimatedValue || "0.00"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Member Costs</span>
                          <span className="font-medium">$0.00</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Expenses</span>
                          <span className="font-medium">$0.00</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span className="font-semibold">Net Profit</span>
                          <span className="font-bold text-green-600">${project.estimatedValue || "0.00"}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2">
                          <span className="text-muted-foreground">Margin</span>
                          <span className="font-medium">100%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      {/* Contact Edit Modal */}
      <Dialog open={showContactEditModal} onOpenChange={setShowContactEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Contact edit form goes here - simplified for space */}
            <div>
              <Label>First Name</Label>
              <Input
                value={projectContact?.firstName || ""}
                onChange={(e) => {
                  // Handle contact update
                }}
                placeholder="First name"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowContactEditModal(false)}>Save</Button>
              <Button variant="outline" onClick={() => setShowContactEditModal(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Contact Picker Modal */}
      <ContactPicker
        open={showContactPicker}
        onOpenChange={setShowContactPicker}
        onSelectContact={handleContactSelected}
      />
      {/* Quote Editor Modal */}
      <QuoteEditor
        open={showQuoteEditor}
        onOpenChange={setShowQuoteEditor}
        contactId={selectedContactId}
        contactName={selectedContactName}
        quote={editingQuote}
        projectId={projectId}
        onClose={handleQuoteEditorClose}
      />
      {/* Contract Editor Modal */}
      <CreateContractDialog
        open={showContractEditor}
        onOpenChange={setShowContractEditor}
        contactId={selectedContactId}
        contactName={selectedContactName}
        contract={editingContract}
        projectId={projectId}
        onClose={handleContractEditorClose}
      />
      {/* Invoice Editor Modal */}
      <InvoiceEditor
        open={showInvoiceEditor}
        onOpenChange={setShowInvoiceEditor}
        contactId={selectedContactId}
        contactName={selectedContactName}
        invoice={editingInvoice}
        projectId={projectId}
        onClose={() => {
          setShowInvoiceEditor(false);
          setEditingInvoice(null);
        }}
      />
    </div>
  );
}
