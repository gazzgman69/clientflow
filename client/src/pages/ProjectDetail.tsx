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
  ListTodo, Timer, Music, Utensils, Car, Building, PhoneCall, Activity, TrendingUp, ChevronDown,
  Share2, Filter, Eye, EyeOff, ClipboardList, FolderOpen, Tag
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
import { formatCurrency } from "@/lib/currency";
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
import { jsPDF } from "jspdf";

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

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  category: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  date: z.string().optional(),
  notes: z.string().optional(),
});

const mealBreakSchema = z.object({
  type: z.enum(["meal", "break"]),
  label: z.string().min(1, "Label is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  provided: z.boolean().default(false),
  notes: z.string().optional(),
});

const logCallSchema = z.object({
  description: z.string().min(1, "Call notes are required"),
  type: z.string().default("call_logged"),
});

const taskTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
});

const formSchema = z.object({
  title: z.string().min(1, "Form title is required"),
  description: z.string().optional(),
});

type NoteFormData = z.infer<typeof noteSchema>;
type MemberAssignmentData = z.infer<typeof memberAssignmentSchema>;
type ContractEditData = z.infer<typeof contractEditSchema>;
type InvoiceEditData = z.infer<typeof invoiceEditSchema>;
type TaskFormData = z.infer<typeof taskSchema>;
type ScheduleItemData = z.infer<typeof scheduleItemSchema>;
type ExpenseFormData = z.infer<typeof expenseSchema>;
type MealBreakFormData = z.infer<typeof mealBreakSchema>;
type LogCallFormData = z.infer<typeof logCallSchema>;
type TaskTemplateFormData = z.infer<typeof taskTemplateSchema>;
type FormFormData = z.infer<typeof formSchema>;

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
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [venueSearchTerm, setVenueSearchTerm] = useState('');
  const [showMemberAssign, setShowMemberAssign] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showMealBreakForm, setShowMealBreakForm] = useState(false);
  const [showLogCallForm, setShowLogCallForm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formFields, setFormFields] = useState<Array<{label: string; type: string; required: boolean}>>([]);

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
    queryKey: ["/api/venues?simple=1"],
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

  // Fetch project expenses
  const { data: projectExpenses = [] } = useQuery({
    queryKey: ["/api/projects", project?.id, "expenses"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${project!.id}/expenses`);
      return response.json();
    },
    enabled: !!project,
  });

  // Fetch project meals & breaks
  const { data: projectMealsBreaks = [] } = useQuery({
    queryKey: ["/api/projects", project?.id, "meals-breaks"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${project!.id}/meals-breaks`);
      return response.json();
    },
    enabled: !!project,
  });

  // Fetch project activities for timeline
  const { data: projectActivities = [] } = useQuery({
    queryKey: ["/api/projects", project?.id, "activities"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${project!.id}/activities`);
      return response.json();
    },
    enabled: !!project,
  });

  // Fetch task templates
  const { data: taskTemplatesList = [] } = useQuery({
    queryKey: ["/api/task-templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/task-templates");
      return response.json();
    },
    enabled: !!project,
  });

  // Fetch project forms
  const { data: projectForms = [] } = useQuery({
    queryKey: ["/api/projects", project?.id, "forms"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${project!.id}/forms`);
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

  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { description: "", category: "", amount: "", date: "", notes: "" },
  });

  const mealBreakForm = useForm<MealBreakFormData>({
    resolver: zodResolver(mealBreakSchema),
    defaultValues: { type: "meal", label: "", startTime: "", endTime: "", provided: false, notes: "" },
  });

  const logCallForm = useForm<LogCallFormData>({
    resolver: zodResolver(logCallSchema),
    defaultValues: { description: "", type: "call_logged" },
  });

  const taskTemplateForm = useForm<TaskTemplateFormData>({
    resolver: zodResolver(taskTemplateSchema),
    defaultValues: { name: "", description: "" },
  });

  const formForm = useForm<FormFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "" },
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

  // Update file visibility mutation
  const updateFileMutation = useMutation({
    mutationFn: async (data: { fileId: string; clientPortalVisible?: boolean; memberPortalVisible?: boolean }) => {
      const { fileId, ...updates } = data;
      const response = await apiRequest("PATCH", `/api/files/${fileId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update file visibility.", variant: "destructive" });
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/expenses`, {
        description: data.description,
        category: data.category,
        amount: data.amount,
        date: data.date,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Expense added", description: "The expense has been recorded." });
      expenseForm.reset();
      setShowExpenseForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "expenses"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add expense.", variant: "destructive" });
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/expenses/${expenseId}`);
    },
    onSuccess: () => {
      toast({ title: "Expense deleted", description: "The expense has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "expenses"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete expense.", variant: "destructive" });
    },
  });

  // Create meal/break mutation
  const createMealBreakMutation = useMutation({
    mutationFn: async (data: MealBreakFormData) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/meals-breaks`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Added", description: "Meal/break has been added to the schedule." });
      mealBreakForm.reset();
      setShowMealBreakForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "meals-breaks"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add meal/break.", variant: "destructive" });
    },
  });

  // Delete meal/break mutation
  const deleteMealBreakMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/meals-breaks/${itemId}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Meal/break has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "meals-breaks"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete meal/break.", variant: "destructive" });
    },
  });

  // Log call / activity mutation
  const logActivityMutation = useMutation({
    mutationFn: async (data: LogCallFormData) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/activities`, {
        type: data.type,
        description: data.description,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Call logged", description: "The call has been added to the timeline." });
      logCallForm.reset();
      setShowLogCallForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "activities"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log call.", variant: "destructive" });
    },
  });

  // Clone project mutation
  const cloneProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/clone`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Project cloned", description: `"Copy of ${project?.name}" has been created.` });
      setLocation(`/projects/${data.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clone project.", variant: "destructive" });
    },
  });

  // Archive project mutation
  const archiveProjectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}/status`, {
        status: 'archived',
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Project archived", description: "The project has been archived." });
      setShowArchiveConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pending-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation("/projects");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive project.", variant: "destructive" });
    },
  });

  // Apply task template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/apply-template/${templateId}`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Template applied", description: `${data.applied} tasks added to the project.` });
      setShowTemplateList(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply template.", variant: "destructive" });
    },
  });

  // Create task template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: TaskTemplateFormData) => {
      // Save current project tasks as a template
      const tasksToSave = (projectTasks as any[]).map((t: any) => ({
        title: t.title,
        description: t.description || "",
        priority: t.priority || "MEDIUM",
      }));
      const response = await apiRequest("POST", "/api/task-templates", {
        name: data.name,
        description: data.description,
        tasks: tasksToSave,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Template saved", description: "Current tasks saved as a reusable template." });
      taskTemplateForm.reset();
      setShowCreateTemplate(false);
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
    },
  });

  // Delete task template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest("DELETE", `/api/task-templates/${templateId}`);
    },
    onSuccess: () => {
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" });
    },
  });

  // Create form mutation
  const createFormMutation = useMutation({
    mutationFn: async (data: FormFormData) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/forms`, {
        title: data.title,
        description: data.description,
        contactId: project?.contactId,
        fields: formFields,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Form created", description: "The questionnaire has been created." });
      formForm.reset();
      setFormFields([]);
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "forms"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create form.", variant: "destructive" });
    },
  });

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/forms/${formId}`);
    },
    onSuccess: () => {
      toast({ title: "Form deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "forms"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete form.", variant: "destructive" });
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
      // Invalidate project data so it refetches with new venueId
      await queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      // Invalidate all venue queries so the venue card picks up the newly assigned venue
      queryClient.invalidateQueries({ queryKey: ['/api/venues'] });
      setIsEditingOverview(false);
      toast({ title: "Project Updated", description: "Project details saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save project details.", variant: "destructive" });
    }
  };

  // Quick venue assignment without opening full edit form
  const handleQuickAssignVenue = async (venueId: string) => {
    if (!project) return;
    try {
      await apiRequest('PATCH', `/api/projects/${project.id}`, { venueId });
      await queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/venues'] });
      setShowVenuePicker(false);
      setVenueSearchTerm('');
      toast({ title: "Venue Assigned", description: "Venue has been linked to this project." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign venue.", variant: "destructive" });
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
  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-cyan-100 text-cyan-800",
      hold: "bg-amber-100 text-amber-800",
      proposal_sent: "bg-purple-100 text-purple-800",
      booked: "bg-green-100 text-green-800",
      completed: "bg-emerald-100 text-emerald-800",
      lost: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-600",
      archived: "bg-gray-100 text-gray-600",
    };
    return styles[status] || "bg-gray-100 text-gray-600";
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
                <span className={`${getStatusStyle(project.status)} text-xs font-semibold px-3 py-1 rounded-full`}>
                  {project.status === 'proposal_sent' ? 'Proposal Sent' : project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleStartEditOverview}>
                  <Edit className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => cloneProjectMutation.mutate()} disabled={cloneProjectMutation.isPending}>
                  {cloneProjectMutation.isPending ? "Cloning..." : "Clone"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm">Actions <ChevronDown className="h-4 w-4 ml-1" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setActiveTab('email')}>
                      <Mail className="h-4 w-4 mr-2" /> Send Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab('documents')}>
                      <FileText className="h-4 w-4 mr-2" /> Create Document
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveTab('tasks')}>
                      <ListTodo className="h-4 w-4 mr-2" /> Add Task
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600" onClick={() => setShowArchiveConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Archive Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
              <TabsTrigger value="email">
                <span className="hidden sm:inline">Email</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                <span className="hidden sm:inline">Schedule</span>

              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
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
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleStartEditOverview}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
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
                            <p className="text-sm text-muted-foreground">DATE</p>
                            <p className="font-medium">
                              {project.startDate ? new Date(project.startDate).toLocaleDateString() : "Not specified"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">START TIME</p>
                            <p className="font-medium">{(project as any).startTime || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">END TIME</p>
                            <p className="font-medium">{(project as any).endTime || "Not specified"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">ESTIMATED VALUE</p>
                            <p className="font-medium">{formatCurrency(parseFloat(project.estimatedValue || "0"), (project.currency as any) || 'GBP')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">LEAD SOURCE</p>
                            <p className="font-medium">{(project as any).leadSource || "Not specified"}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm text-muted-foreground">BUDGET RANGE</p>
                            <p className="font-medium">{(project as any).budgetRange || "Not specified"}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm text-muted-foreground">REFERRAL SOURCE</p>
                            <p className="font-medium">{(project as any).referralSource || "Not specified"}</p>
                          </div>
                        </div>
                        {project.description && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-sm text-muted-foreground">DESCRIPTION</p>
                              <p className="font-medium text-sm">{project.description}</p>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Venue Card */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">📍 Venue</CardTitle>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { if (projectVenue) { setShowVenuePicker(!showVenuePicker); setVenueSearchTerm(''); } }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Quick venue swap picker */}
                        {showVenuePicker && projectVenue && (
                          <div className="space-y-2 mb-4 pb-4 border-b">
                            <p className="text-xs font-medium text-muted-foreground">Change venue:</p>
                            <Input
                              placeholder="Search your venues..."
                              value={venueSearchTerm}
                              onChange={(e) => setVenueSearchTerm(e.target.value)}
                              autoFocus
                            />
                            <div className="max-h-48 overflow-y-auto border rounded-md">
                              {venues
                                .filter((v) =>
                                  v.name.toLowerCase().includes(venueSearchTerm.toLowerCase()) ||
                                  (v.address && v.address.toLowerCase().includes(venueSearchTerm.toLowerCase()))
                                )
                                .map((venue) => (
                                  <button
                                    key={venue.id}
                                    className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                                    onClick={() => handleQuickAssignVenue(venue.id)}
                                  >
                                    <p className="font-medium text-sm">{venue.name}</p>
                                    {venue.address && (
                                      <p className="text-xs text-muted-foreground">{venue.address}</p>
                                    )}
                                  </button>
                                ))}
                              {venues.filter((v) =>
                                v.name.toLowerCase().includes(venueSearchTerm.toLowerCase()) ||
                                (v.address && v.address.toLowerCase().includes(venueSearchTerm.toLowerCase()))
                              ).length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-3">No venues found</p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setShowVenuePicker(false); setVenueSearchTerm(''); }}>
                              Cancel
                            </Button>
                          </div>
                        )}
                        {projectVenue ? (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <div>
                              <p className="text-sm text-muted-foreground">VENUE NAME</p>
                              <p className="font-medium text-sm">{projectVenue.name}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">ADDRESS</p>
                              <p className="font-medium text-sm">{projectVenue.address || "Not specified"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">PARKING DETAILS</p>
                              <p className="font-medium text-sm">{(project as any).parkingDetails || "Not specified"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">LOAD-IN DETAILS</p>
                              <p className="font-medium text-sm">{(project as any).loadInDetails || "Not specified"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">VENUE CONTACT</p>
                              <p className="font-medium text-sm">
                                {(projectVenue as any).contactName
                                  ? `${(projectVenue as any).contactName}${(projectVenue as any).contactPhone ? ` — ${(projectVenue as any).contactPhone}` : ''}`
                                  : "Not specified"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">VENUE NOTES</p>
                              <p className="font-medium text-sm">{(projectVenue as any).notes || "Not specified"}</p>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {!showVenuePicker ? (
                              <div className="text-center py-4">
                                <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                                <p className="text-sm text-muted-foreground">No venue assigned yet.</p>
                                <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowVenuePicker(true)}>
                                  <Plus className="h-4 w-4 mr-1" /> Assign Venue
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Input
                                  placeholder="Search your venues..."
                                  value={venueSearchTerm}
                                  onChange={(e) => setVenueSearchTerm(e.target.value)}
                                  autoFocus
                                />
                                <div className="max-h-48 overflow-y-auto border rounded-md">
                                  {venues
                                    .filter((v) =>
                                      v.name.toLowerCase().includes(venueSearchTerm.toLowerCase()) ||
                                      (v.address && v.address.toLowerCase().includes(venueSearchTerm.toLowerCase()))
                                    )
                                    .map((venue) => (
                                      <button
                                        key={venue.id}
                                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                                        onClick={() => handleQuickAssignVenue(venue.id)}
                                      >
                                        <p className="font-medium text-sm">{venue.name}</p>
                                        {venue.address && (
                                          <p className="text-xs text-muted-foreground">{venue.address}</p>
                                        )}
                                      </button>
                                    ))}
                                  {venues.filter((v) =>
                                    v.name.toLowerCase().includes(venueSearchTerm.toLowerCase()) ||
                                    (v.address && v.address.toLowerCase().includes(venueSearchTerm.toLowerCase()))
                                  ).length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-3">No venues found</p>
                                  )}
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                  <Button variant="ghost" size="sm" onClick={() => { setShowVenuePicker(false); setVenueSearchTerm(''); }}>
                                    Cancel
                                  </Button>
                                  <Link href="/venues">
                                    <Button variant="link" size="sm" className="text-xs">
                                      <Plus className="h-3 w-3 mr-1" /> Create New Venue
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Event Day Details Card */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">🎤 Event Day Details</CardTitle>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleStartEditOverview}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">DRESS CODE</p>
                          <p className="font-medium">{(project as any).dressCode || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">MEAL PROVIDED</p>
                          <p className="font-medium">{(project as any).mealDetails || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">ACCOMMODATION</p>
                          <p className="font-medium">{(project as any).accommodation || "Not specified"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">BACKLINE / PRODUCTION</p>
                          <p className="font-medium">{(project as any).backlineProduction || "Not specified"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-6">
                    {/* Client Card (includes additional contacts) */}
                    {projectContact ? (
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">👤 Client</CardTitle>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleEditContact}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">NAME</p>
                            <p className="font-medium">{projectContact.firstName} {projectContact.lastName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">EMAIL</p>
                            <p className="font-medium text-sm break-all">{projectContact.email}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">PHONE</p>
                            <p className="font-medium">{projectContact.phone || "Not provided"}</p>
                          </div>
                          {(project as any).secondContactName && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm text-muted-foreground">SECOND CONTACT</p>
                                <p className="font-medium">{(project as any).secondContactName}</p>
                                {(project as any).secondContactPhone && (
                                  <>
                                    <p className="text-sm text-muted-foreground mt-1">PHONE</p>
                                    <p className="font-medium">{(project as any).secondContactPhone}</p>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                          {(project as any).dayOfContactName && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm text-muted-foreground">DAY-OF CONTACT</p>
                                <p className="font-medium">{(project as any).dayOfContactName}</p>
                                {(project as any).dayOfContactPhone && (
                                  <>
                                    <p className="text-sm text-muted-foreground mt-1">PHONE</p>
                                    <p className="font-medium">{(project as any).dayOfContactPhone}</p>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Financial Summary Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">💰 Financial Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">TOTAL FEE</p>
                          <p className="text-lg font-bold">{formatCurrency(parseFloat(project.estimatedValue || "0"), (project.currency as any) || 'GBP')}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">DEPOSIT PAID</p>
                            <p className="font-medium">{formatCurrency(0, (project.currency as any) || 'GBP')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">OUTSTANDING</p>
                            <p className="font-medium">{formatCurrency(parseFloat(project.estimatedValue || "0"), (project.currency as any) || 'GBP')}</p>
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

                    {/* Lifecycle Progress - Traffic Light */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">📈 Lifecycle Progress</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const status = project.status;
                          const statusOrder = ['new', 'contacted', 'proposal_sent', 'booked', 'completed'];
                          const statusIndex = statusOrder.indexOf(status);
                          const hasQuotes = projectQuotes.length > 0;
                          const hasSignedContract = projectContracts.some((c: any) => c.status === 'signed' || c.status === 'accepted');
                          const hasPaidInvoice = projectInvoices.some((i: any) => i.status === 'paid' || i.status === 'partially_paid');
                          const allInvoicesPaid = projectInvoices.length > 0 && projectInvoices.every((i: any) => i.status === 'paid');
                          const isCompleted = status === 'completed';

                          const steps = [
                            { label: 'Enquiry received', done: statusIndex >= 0 },
                            { label: 'Auto-reply sent', done: statusIndex >= 1 || status === 'new' },
                            { label: 'Proposal sent', done: statusIndex >= 2 || hasQuotes },
                            { label: 'Proposal accepted', done: statusIndex >= 3 },
                            { label: 'Contract signed', done: hasSignedContract || statusIndex >= 3 },
                            { label: 'Deposit paid', done: hasPaidInvoice },
                            { label: 'Event questionnaire', done: false },
                            { label: 'Balance paid', done: allInvoicesPaid },
                            { label: 'Gig complete', done: isCompleted },
                            { label: 'Follow-up sent', done: false },
                          ];

                          // Find the current step (first not-done step)
                          const currentStepIndex = steps.findIndex(s => !s.done);

                          return (
                            <div className="flex flex-col gap-1.5">
                              {steps.map((step, idx) => {
                                let dotColor = 'bg-gray-300'; // grey = not done
                                if (step.done) {
                                  dotColor = 'bg-green-500'; // green = complete
                                } else if (idx === currentStepIndex) {
                                  dotColor = 'bg-amber-400'; // amber = current step
                                }

                                return (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
                                    <span className={`text-[13px] ${step.done ? 'text-foreground' : idx === currentStepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                      {step.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
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
                  {/* Meals & Breaks Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">🍽️ MEALS & BREAKS</CardTitle>
                        <Button size="sm" variant="outline" onClick={() => {
                          mealBreakForm.reset();
                          setShowMealBreakForm(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(projectMealsBreaks as any[]).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No meals or breaks added yet.</p>
                        ) : (
                          (projectMealsBreaks as any[]).map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div>
                                <p className="font-medium text-sm">{item.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.startTime || "?"} - {item.endTime || "?"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.type === 'meal' ? (
                                  <span className={`text-xs px-2 py-0.5 rounded ${item.provided ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {item.provided ? "Provided" : "Not provided"}
                                  </span>
                                ) : (
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Break</span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => deleteMealBreakMutation.mutate(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📌 Quick Reference</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {projectVenue && (
                        <div>
                          <p className="text-sm text-muted-foreground">VENUE</p>
                          <p className="font-medium">{projectVenue.name}</p>
                        </div>
                      )}
                      {projectContact && (
                        <div>
                          <p className="text-sm text-muted-foreground">MAIN CONTACT</p>
                          <p className="font-medium">{projectContact.firstName} {projectContact.lastName}</p>
                          <p className="text-xs text-muted-foreground">{projectContact.phone}</p>
                        </div>
                      )}
                      {(project as any).dressCode && (
                        <div>
                          <p className="text-sm text-muted-foreground">DRESS CODE</p>
                          <p className="font-medium">{(project as any).dressCode}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">📤 Export & Share</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="outline" className="w-full" size="sm" onClick={() => {
                        // Generate PDF from schedule items
                        const doc = new jsPDF();
                        doc.setFontSize(18);
                        doc.text(project?.name || "Schedule", 20, 20);
                        doc.setFontSize(10);
                        doc.setTextColor(100);
                        if (project?.startDate) {
                          doc.text(`Date: ${new Date(project.startDate).toLocaleDateString()}`, 20, 30);
                        }
                        if (projectVenue) {
                          doc.text(`Venue: ${projectVenue.name}`, 20, 36);
                        }
                        doc.setTextColor(0);
                        doc.setFontSize(12);
                        doc.text("Schedule", 20, 48);
                        doc.setLineWidth(0.5);
                        doc.line(20, 50, 190, 50);
                        let y = 58;
                        doc.setFontSize(10);
                        if ((projectSchedule as any[]).length === 0) {
                          doc.text("No schedule items.", 20, y);
                        } else {
                          (projectSchedule as any[]).forEach((item: any) => {
                            doc.setFont("helvetica", "bold");
                            doc.text(item.time || "", 20, y);
                            doc.setFont("helvetica", "normal");
                            doc.text(item.label || "", 50, y);
                            if (item.notes) {
                              doc.setTextColor(100);
                              doc.text(item.notes, 50, y + 5);
                              doc.setTextColor(0);
                              y += 5;
                            }
                            y += 8;
                            if (y > 270) { doc.addPage(); y = 20; }
                          });
                        }
                        // Add meals & breaks
                        if ((projectMealsBreaks as any[]).length > 0) {
                          y += 5;
                          doc.setFontSize(12);
                          doc.text("Meals & Breaks", 20, y);
                          doc.line(20, y + 2, 190, y + 2);
                          y += 10;
                          doc.setFontSize(10);
                          (projectMealsBreaks as any[]).forEach((item: any) => {
                            doc.setFont("helvetica", "bold");
                            doc.text(`${item.startTime || "?"} - ${item.endTime || "?"}`, 20, y);
                            doc.setFont("helvetica", "normal");
                            doc.text(`${item.label}${item.provided ? " (Provided)" : ""}`, 70, y);
                            y += 7;
                            if (y > 270) { doc.addPage(); y = 20; }
                          });
                        }
                        doc.save(`${project?.name || "schedule"}-schedule.pdf`);
                        toast({ title: "Exported", description: "Schedule exported as PDF." });
                      }}>
                        <Download className="h-4 w-4 mr-2" /> Export PDF
                      </Button>
                      <Button variant="outline" className="w-full" size="sm" onClick={() => {
                        // Generate CSV from schedule items
                        const rows = [["Time", "Item", "Notes"]];
                        (projectSchedule as any[]).forEach((item: any) => {
                          rows.push([item.time || "", item.label || "", (item.notes || "").replace(/,/g, ";")]);
                        });
                        const csv = rows.map(r => r.join(",")).join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${project?.name || "schedule"}-schedule.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast({ title: "Exported", description: "Schedule exported as CSV." });
                      }}>
                        <Download className="h-4 w-4 mr-2" /> Export CSV
                      </Button>
                      <Button variant="outline" className="w-full" size="sm" onClick={() => {
                        // Copy schedule as text to clipboard for sharing
                        const lines = (projectSchedule as any[]).map((item: any) => `${item.time} - ${item.label}${item.notes ? ` (${item.notes})` : ""}`);
                        const text = `Schedule for ${project?.name}\n${"=".repeat(30)}\n${lines.join("\n") || "No schedule items yet."}`;
                        navigator.clipboard.writeText(text);
                        toast({ title: "Copied", description: "Schedule copied to clipboard for sharing." });
                      }}>
                        <Share2 className="h-4 w-4 mr-2" /> Share Schedule
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            Apply Template <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(taskTemplatesList as any[]).length === 0 ? (
                            <DropdownMenuItem disabled>
                              <span className="text-muted-foreground text-xs">No templates yet</span>
                            </DropdownMenuItem>
                          ) : (
                            (taskTemplatesList as any[]).map((tmpl: any) => (
                              <DropdownMenuItem key={tmpl.id} onClick={() => applyTemplateMutation.mutate(tmpl.id)}>
                                <ClipboardList className="h-4 w-4 mr-2" />
                                {tmpl.name}
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({JSON.parse(tmpl.tasks || "[]").length} tasks)
                                </span>
                              </DropdownMenuItem>
                            ))
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            taskTemplateForm.reset();
                            setShowCreateTemplate(true);
                          }}>
                            <Plus className="h-4 w-4 mr-2" /> Save Current Tasks as Template
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                    <CardTitle className="text-base">📨 COMMUNICATION TIMELINE</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        logCallForm.reset();
                        setShowLogCallForm(true);
                      }}>
                        <PhoneCall className="h-4 w-4 mr-2" /> Log Call
                      </Button>
                      <Select value={timelineFilter} onValueChange={setTimelineFilter}>
                        <SelectTrigger className="w-[130px] h-8">
                          <Filter className="h-3 w-3 mr-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="call_logged">Calls</SelectItem>
                          <SelectItem value="email_sent">Emails</SelectItem>
                          <SelectItem value="note_added">Notes</SelectItem>
                          <SelectItem value="status_change">Status Changes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(projectActivities as any[]).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No timeline events yet.</p>
                        <p className="text-xs mt-1">Log a call or send an email to start the timeline.</p>
                      </div>
                    ) : (
                      (projectActivities as any[])
                        .filter((a: any) => timelineFilter === 'all' || a.type === timelineFilter)
                        .map((activity: any) => (
                        <div key={activity.id} className="flex gap-3 py-3 border-b last:border-0">
                          <div className="flex-shrink-0 mt-1">
                            {activity.type === 'call_logged' && <PhoneCall className="h-4 w-4 text-blue-500" />}
                            {activity.type === 'email_sent' && <Mail className="h-4 w-4 text-green-500" />}
                            {activity.type === 'note_added' && <MessageSquare className="h-4 w-4 text-amber-500" />}
                            {activity.type === 'status_change' && <Activity className="h-4 w-4 text-purple-500" />}
                            {!['call_logged', 'email_sent', 'note_added', 'status_change'].includes(activity.type) && <Clock className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{activity.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {activity.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} · {activity.createdAt ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }) : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Log Call Dialog */}
              {showLogCallForm && (
                <Dialog open={showLogCallForm} onOpenChange={setShowLogCallForm}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Call</DialogTitle>
                      <DialogDescription>Record details about a phone call for this project.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={logCallForm.handleSubmit((data) => logActivityMutation.mutate(data))} className="space-y-4">
                      <div>
                        <Label>TYPE</Label>
                        <Select
                          value={logCallForm.watch("type")}
                          onValueChange={(value) => logCallForm.setValue("type", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call_logged">Phone Call</SelectItem>
                            <SelectItem value="email_sent">Email</SelectItem>
                            <SelectItem value="note_added">Note</SelectItem>
                            <SelectItem value="status_change">Status Change</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>NOTES</Label>
                        <Textarea {...logCallForm.register("description")} placeholder="Describe the call..." rows={4} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowLogCallForm(false)}>Cancel</Button>
                        <Button type="submit" disabled={logActivityMutation.isPending}>
                          {logActivityMutation.isPending ? "Saving..." : "Log Call"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            {/* MEMBERS TAB */}
            <TabsContent value="members" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">👥 Project Members</CardTitle>
                    <Button size="sm" onClick={() => {
                      memberForm.reset();
                      setShowMemberAssign(true);
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
                                <TableCell>{formatCurrency(parseFloat(pm.fee || '0'), (project?.currency as any) || 'GBP')}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    <div className={`h-2 w-2 rounded-full mr-2 ${pm.confirmationStatus === 'confirmed' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    {pm.confirmationStatus ? pm.confirmationStatus.charAt(0).toUpperCase() + pm.confirmationStatus.slice(1) : 'Pending'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{pm.availability || "Unknown"}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{pm.paymentStatus ? pm.paymentStatus.charAt(0).toUpperCase() + pm.paymentStatus.slice(1) : 'Unpaid'}</Badge>
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

              {/* Assign Member Dialog */}
              <Dialog open={showMemberAssign} onOpenChange={setShowMemberAssign}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Member to Project</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={memberForm.handleSubmit((data) => {
                    assignMemberMutation.mutate(data, {
                      onSuccess: () => setShowMemberAssign(false),
                    });
                  })} className="space-y-4">
                    <div>
                      <Label>MEMBER</Label>
                      <Select
                        value={memberForm.watch("memberId")}
                        onValueChange={(value) => memberForm.setValue("memberId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a member..." />
                        </SelectTrigger>
                        <SelectContent>
                          {members
                            .filter((m: any) => !projectMembers.some((pm: any) => pm.memberId === m.id))
                            .map((m: any) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} {m.instrument ? `(${m.instrument})` : ''}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {memberForm.formState.errors.memberId && (
                        <p className="text-xs text-red-500 mt-1">{memberForm.formState.errors.memberId.message}</p>
                      )}
                    </div>
                    <div>
                      <Label>ROLE</Label>
                      <Input
                        {...memberForm.register("role")}
                        placeholder="e.g. Lead Vocalist, Guitarist, DJ"
                      />
                    </div>
                    <div>
                      <Label>FEE</Label>
                      <Input
                        {...memberForm.register("fee")}
                        placeholder="e.g. 250.00"
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>OFFER TYPE</Label>
                      <Select
                        value={memberForm.watch("offerType") || ""}
                        onValueChange={(value) => memberForm.setValue("offerType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select offer type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat_fee">Flat Fee</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="hourly">Hourly Rate</SelectItem>
                          <SelectItem value="tbc">TBC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>NOTES</Label>
                      <Textarea
                        {...memberForm.register("notes")}
                        placeholder="Any notes about this assignment..."
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={assignMemberMutation.isPending}>
                        {assignMemberMutation.isPending ? "Assigning..." : "Assign Member"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowMemberAssign(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
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
                              <TableCell>{formatCurrency(parseFloat(quote.amount || quote.total || '0'), (project?.currency as any) || 'GBP')}</TableCell>
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
                              <TableCell>{formatCurrency(parseFloat(contract.amount || '0'), (project?.currency as any) || 'GBP')}</TableCell>
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
                              <TableCell>{formatCurrency(parseFloat(invoice.total || '0'), (project?.currency as any) || 'GBP')}</TableCell>
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

              {/* Forms & Questionnaires Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">📋 FORMS & QUESTIONNAIRES</CardTitle>
                    <Button size="sm" onClick={() => {
                      formForm.reset();
                      setFormFields([]);
                      setShowCreateForm(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" /> Create Form
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(projectForms as any[]).length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No forms or questionnaires yet.</p>
                      <p className="text-xs mt-1">Create a form to collect information from clients or team members.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(projectForms as any[]).map((form: any) => {
                        const fields = JSON.parse(form.formDefinition || "[]");
                        return (
                          <div key={form.id} className="flex items-center justify-between border rounded-lg p-3">
                            <div>
                              <p className="font-medium text-sm">{form.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {fields.length} field{fields.length !== 1 ? "s" : ""} · Status: <span className={`capitalize ${form.status === 'submitted' ? 'text-green-600' : form.status === 'in_progress' ? 'text-amber-600' : 'text-gray-500'}`}>{form.status.replace(/_/g, ' ')}</span>
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={() => deleteFormMutation.mutate(form.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
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
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5" title="Client Portal Visibility">
                              <Eye className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">Client</span>
                              <Switch
                                checked={(file as any).clientPortalVisible || false}
                                onCheckedChange={(checked) => updateFileMutation.mutate({
                                  fileId: file.id,
                                  clientPortalVisible: checked,
                                })}
                                className="scale-75"
                              />
                            </div>
                            <div className="flex items-center gap-1.5" title="Member Portal Visibility">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">Member</span>
                              <Switch
                                checked={(file as any).memberPortalVisible || false}
                                onCheckedChange={(checked) => updateFileMutation.mutate({
                                  fileId: file.id,
                                  memberPortalVisible: checked,
                                })}
                                className="scale-75"
                              />
                            </div>
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
                              {(note as any).tags && (note as any).tags.length > 0 && (
                                <div className="flex gap-1 mt-1.5">
                                  {(note as any).tags.map((tag: string, idx: number) => (
                                    <span key={idx} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                      <Tag className="h-2.5 w-2.5 inline mr-0.5" />{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs ml-2">
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
              {(() => {
                const totalFee = parseFloat(project.estimatedValue || "0");
                const totalMemberCosts = projectMembers.reduce((sum: number, pm: any) => sum + parseFloat(pm.fee || "0"), 0);
                const totalReceived = projectInvoices
                  .filter((inv: any) => inv.status === 'paid')
                  .reduce((sum: number, inv: any) => sum + parseFloat(inv.total || inv.subtotal || "0"), 0);
                const totalInvoiced = projectInvoices
                  .reduce((sum: number, inv: any) => sum + parseFloat(inv.total || inv.subtotal || "0"), 0);
                const outstanding = totalFee - totalReceived;
                const netProfit = totalFee - totalMemberCosts;
                const margin = totalFee > 0 ? Math.round((netProfit / totalFee) * 100) : 0;

                return (
                  <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">TOTAL FEE</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(totalFee, (project.currency as any) || 'GBP')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">RECEIVED</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(totalReceived, (project.currency as any) || 'GBP')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">OUTSTANDING</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(outstanding, (project.currency as any) || 'GBP')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">PROJECTED PROFIT</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netProfit, (project.currency as any) || 'GBP')}</p>
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
                              <TableCell className="font-medium">{formatCurrency(parseFloat(project.estimatedValue || "0"), (project.currency as any) || 'GBP')}</TableCell>
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
                        <CardTitle className="text-base">💸 EXPENSES</CardTitle>
                        <Button size="sm" onClick={() => {
                          expenseForm.reset();
                          setShowExpenseForm(true);
                        }}>
                          <Plus className="h-4 w-4 mr-2" /> Add Expense
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>DESCRIPTION</TableHead>
                              <TableHead>CATEGORY</TableHead>
                              <TableHead>AMOUNT</TableHead>
                              <TableHead>DATE</TableHead>
                              <TableHead className="w-20">ACTIONS</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(projectExpenses as any[]).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                  <Receipt className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No expenses recorded yet.</p>
                                  <p className="text-xs mt-1">Track travel, equipment, and other project costs here.</p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              (projectExpenses as any[]).map((exp: any) => (
                                <TableRow key={exp.id}>
                                  <TableCell className="text-sm">{exp.description}</TableCell>
                                  <TableCell className="text-sm capitalize">{exp.category || "—"}</TableCell>
                                  <TableCell className="font-medium">{formatCurrency(parseFloat(exp.amount || "0"), (project.currency as any) || 'GBP')}</TableCell>
                                  <TableCell className="text-sm">{exp.date || "—"}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                      onClick={() => deleteExpenseMutation.mutate(exp.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
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
                                    <TableCell className="font-medium">{formatCurrency(parseFloat(pm.fee || "0"), (project.currency as any) || 'GBP')}</TableCell>
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
                          <span className="text-muted-foreground">FEE</span>
                          <span className="font-medium">{formatCurrency(totalFee, (project.currency as any) || 'GBP')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">MEMBER COSTS</span>
                          <span className="font-medium">-{formatCurrency(totalMemberCosts, (project.currency as any) || 'GBP')}</span>
                        </div>
                        {(() => {
                          const totalExpenses = (projectExpenses as any[]).reduce((sum: number, exp: any) => sum + parseFloat(exp.amount || "0"), 0);
                          const adjustedNetProfit = totalFee - totalMemberCosts - totalExpenses;
                          const adjustedMargin = totalFee > 0 ? Math.round((adjustedNetProfit / totalFee) * 100) : 0;
                          return (<>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">EXPENSES</span>
                          <span className="font-medium">-{formatCurrency(totalExpenses, (project.currency as any) || 'GBP')}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span className="font-semibold">NET PROFIT</span>
                          <span className={`font-bold ${adjustedNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(adjustedNetProfit, (project.currency as any) || 'GBP')}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2">
                          <span className="text-muted-foreground">MARGIN</span>
                          <span className="font-medium">{adjustedMargin}%</span>
                        </div>
                          </>);
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
                  </>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      {/* Contact Edit Modal */}
      <Dialog open={showContactEditModal} onOpenChange={setShowContactEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update client contact information for this project.</DialogDescription>
          </DialogHeader>
          <form onSubmit={contactEditForm.handleSubmit(handleSaveContact)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name</Label>
                <Input {...contactEditForm.register("firstName")} placeholder="First name" />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input {...contactEditForm.register("lastName")} placeholder="Last name" />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input {...contactEditForm.register("email")} type="email" placeholder="email@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input {...contactEditForm.register("phone")} placeholder="Phone number" />
            </div>
            <div>
              <Label>Company</Label>
              <Input {...contactEditForm.register("company")} placeholder="Company name" />
            </div>
            <div>
              <Label>Job Title</Label>
              <Input {...contactEditForm.register("jobTitle")} placeholder="Job title" />
            </div>
            <div>
              <Label>Website</Label>
              <Input {...contactEditForm.register("website")} placeholder="https://..." />
            </div>
            <div>
              <Label>Lead Source</Label>
              <Input {...contactEditForm.register("leadSource")} placeholder="e.g. Referral, Website, Social Media" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea {...contactEditForm.register("notes")} placeholder="Any additional notes about this contact..." rows={3} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={updateContactMutation.isPending}>
                {updateContactMutation.isPending ? "Saving..." : "Save Contact"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowContactEditModal(false)}>Cancel</Button>
            </div>
          </form>
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
        isOpen={showQuoteEditor}
        contactId={selectedContactId}
        contactName={selectedContactName}
        editingQuote={editingQuote}
        projectId={projectId}
        onClose={handleQuoteEditorClose}
      />
      {/* Contract Editor Modal */}
      <CreateContractDialog
        open={showContractEditor}
        onOpenChange={(open) => {
          setShowContractEditor(open);
          if (!open) handleContractEditorClose();
        }}
        initialContactId={selectedContactId}
        initialProjectId={projectId}
        contract={editingContract}
      />
      {/* Invoice Editor Modal */}
      <InvoiceEditor
        isOpen={showInvoiceEditor}
        contactId={selectedContactId}
        contactName={selectedContactName}
        editingInvoice={editingInvoice}
        projectId={projectId}
        onClose={() => {
          setShowInvoiceEditor(false);
          setEditingInvoice(null);
        }}
      />
      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{project?.name}"? The project will be moved to the archived list and can be restored later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowArchiveConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => archiveProjectMutation.mutate()} disabled={archiveProjectMutation.isPending}>
              {archiveProjectMutation.isPending ? "Archiving..." : "Archive Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a project expense for tracking costs.</DialogDescription>
          </DialogHeader>
          <form onSubmit={expenseForm.handleSubmit((data) => createExpenseMutation.mutate(data))} className="space-y-4">
            <div>
              <Label>DESCRIPTION</Label>
              <Input {...expenseForm.register("description")} placeholder="e.g. Travel to venue" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CATEGORY</Label>
                <Select
                  value={expenseForm.watch("category") || ""}
                  onValueChange={(value) => expenseForm.setValue("category", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="accommodation">Accommodation</SelectItem>
                    <SelectItem value="catering">Catering</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>AMOUNT</Label>
                <Input {...expenseForm.register("amount")} type="number" step="0.01" placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label>DATE</Label>
              <Input {...expenseForm.register("date")} type="date" />
            </div>
            <div>
              <Label>NOTES</Label>
              <Textarea {...expenseForm.register("notes")} placeholder="Additional details..." rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createExpenseMutation.isPending}>
                {createExpenseMutation.isPending ? "Saving..." : "Add Expense"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Meal/Break Dialog */}
      <Dialog open={showMealBreakForm} onOpenChange={setShowMealBreakForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Meal or Break</DialogTitle>
            <DialogDescription>Add a meal or break to the event day schedule.</DialogDescription>
          </DialogHeader>
          <form onSubmit={mealBreakForm.handleSubmit((data) => createMealBreakMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>TYPE</Label>
                <Select
                  value={mealBreakForm.watch("type")}
                  onValueChange={(value: "meal" | "break") => mealBreakForm.setValue("type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meal">Meal</SelectItem>
                    <SelectItem value="break">Break</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>LABEL</Label>
                <Input {...mealBreakForm.register("label")} placeholder="e.g. Dinner, Lunch Break" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>START TIME</Label>
                <Input {...mealBreakForm.register("startTime")} type="time" />
              </div>
              <div>
                <Label>END TIME</Label>
                <Input {...mealBreakForm.register("endTime")} type="time" />
              </div>
            </div>
            {mealBreakForm.watch("type") === "meal" && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={mealBreakForm.watch("provided")}
                  onCheckedChange={(checked) => mealBreakForm.setValue("provided", checked)}
                />
                <Label>Meal provided</Label>
              </div>
            )}
            <div>
              <Label>NOTES</Label>
              <Textarea {...mealBreakForm.register("notes")} placeholder="Additional details..." rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowMealBreakForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMealBreakMutation.isPending}>
                {createMealBreakMutation.isPending ? "Saving..." : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Save Tasks as Template Dialog */}
      <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Tasks as Template</DialogTitle>
            <DialogDescription>
              Save the current {(projectTasks as any[]).length} task{(projectTasks as any[]).length !== 1 ? "s" : ""} as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={taskTemplateForm.handleSubmit((data) => createTemplateMutation.mutate(data))} className="space-y-4">
            <div>
              <Label>TEMPLATE NAME</Label>
              <Input {...taskTemplateForm.register("name")} placeholder="e.g. Wedding Prep Checklist" />
            </div>
            <div>
              <Label>DESCRIPTION</Label>
              <Textarea {...taskTemplateForm.register("description")} placeholder="What is this template for?" rows={2} />
            </div>
            {(projectTasks as any[]).length > 0 && (
              <div className="border rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">TASKS TO SAVE:</p>
                {(projectTasks as any[]).map((t: any) => (
                  <p key={t.id} className="text-sm">• {t.title} <span className="text-xs text-muted-foreground">({t.priority})</span></p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateTemplate(false)}>Cancel</Button>
              <Button type="submit" disabled={createTemplateMutation.isPending || (projectTasks as any[]).length === 0}>
                {createTemplateMutation.isPending ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Form Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Form / Questionnaire</DialogTitle>
            <DialogDescription>
              Create a form to collect information from clients.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={formForm.handleSubmit((data) => createFormMutation.mutate(data))} className="space-y-4">
            <div>
              <Label>FORM TITLE</Label>
              <Input {...formForm.register("title")} placeholder="e.g. Wedding Details Questionnaire" />
            </div>
            <div>
              <Label>DESCRIPTION</Label>
              <Textarea {...formForm.register("description")} placeholder="What information do you need?" rows={2} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>FORM FIELDS</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setFormFields([...formFields, { label: "", type: "text", required: false }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Field
                </Button>
              </div>
              {formFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">No fields yet. Add fields to build your form.</p>
              ) : (
                <div className="space-y-2">
                  {formFields.map((field, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={field.label}
                        onChange={(e) => {
                          const updated = [...formFields];
                          updated[idx].label = e.target.value;
                          setFormFields(updated);
                        }}
                        placeholder="Field label"
                        className="flex-1"
                      />
                      <Select
                        value={field.type}
                        onValueChange={(value) => {
                          const updated = [...formFields];
                          updated[idx].type = value;
                          setFormFields(updated);
                        }}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="textarea">Long Text</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500"
                        onClick={() => setFormFields(formFields.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createFormMutation.isPending}>
                {createFormMutation.isPending ? "Creating..." : "Create Form"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
