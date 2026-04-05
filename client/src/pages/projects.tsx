import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Briefcase, Calendar, Eye, ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import type { Project, Contact, Venue } from "@shared/schema";
import { z } from "zod";
import ProjectDetailModal from "@/components/modals/project-detail-modal";
import { VenueSelector } from "@/components/venues";
import { DocumentStatusIndicators } from "@/components/DocumentStatusIndicators";

// Type for project deletion preview response
interface ProjectDeletionPreview {
  project: {
    id: string;
    name: string;
    status: string;
  };
  willDelete: {
    contactInfo?: {
      id: string;
      name: string;
      wasOnlyProject: boolean;
    };
    emails: number;
    tasks: number;
    quotes: number;
    contracts: number;
    invoices: number;
    leads: number;
    totalItems: number;
  };
}

const projectFormSchema = insertProjectSchema.omit({ tenantId: true }).extend({
  estimatedValue: z.string().optional(),
});

interface SelectedVenue {
  placeId?: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

// Status filter configuration
const STATUS_TABS = [
  { key: 'active', label: 'Active', color: 'bg-blue-500' },
  { key: 'new', label: 'New', color: 'bg-emerald-500' },
  { key: 'contacted', label: 'Contacted', color: 'bg-sky-500' },
  { key: 'hold', label: 'Hold', color: 'bg-amber-500' },
  { key: 'proposal_sent', label: 'Proposal Sent', color: 'bg-violet-500' },
  { key: 'booked', label: 'Booked', color: 'bg-green-600' },
  { key: 'completed', label: 'Completed', color: 'bg-gray-500' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-rose-400' },
  { key: 'archived', label: 'Archived', color: 'bg-gray-400' },
  { key: 'all', label: 'All', color: 'bg-gray-400' },
] as const;

export default function Projects() {
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);
  const [sortBy, setSortBy] = useState<string>('date-newest');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [deletionPreview, setDeletionPreview] = useState<ProjectDeletionPreview | null>(null);
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Build query URL with status filter
  const projectsQueryUrl = statusFilter === 'all'
    ? '/api/projects'
    : `/api/projects?status=${statusFilter}`;

  const { data: projectsData, isLoading } = useQuery<{
    projects: Project[],
    pagination: any,
    documentStatuses?: Record<string, {
      contracts: Array<{
        status: string;
        clientSignedAt: string | null;
        businessSignedAt: string | null;
        signatureWorkflow: string;
      }>;
      invoices: Record<string, number>;
      quotes: Record<string, number>;
    }>
  }>({
    queryKey: ["/api/projects", statusFilter],
    queryFn: () => fetch(projectsQueryUrl, { credentials: 'include' }).then(r => r.json()),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 5000,
  });

  // Fetch status counts for filter badges
  const { data: statusCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/projects/status-counts"],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const projects = projectsData?.projects || [];
  const documentStatuses = projectsData?.documentStatuses || {};

  const { data: contactsData } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/contacts"],
    refetchInterval: 10000, // Refresh every 10 seconds for better responsiveness
    refetchIntervalInBackground: false, // Don't poll when tab is inactive
    refetchOnWindowFocus: true, // Refresh when tab/window gains focus
    refetchOnMount: true, // Refresh when component mounts
    refetchOnReconnect: true, // Refresh on reconnect
    staleTime: 5000, // Data stays fresh for 5 seconds
  });

  const { data: venuesData } = useQuery<{ venues: Venue[] }>({
    queryKey: ["/api/venues"],
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 5000,
  });

  const contacts = contactsData?.contacts || [];
  const venues = venuesData?.venues || [];

  // Helper function to get venue name by ID
  const getVenueName = (venueId: string | undefined | null) => {
    if (!venueId) return "No venue";
    const venue = venues.find(v => v.id === venueId);
    return venue ? venue.name : "No venue";
  };

  // Helper function to get document status for a project
  const getDocumentStatus = (projectId: string) => {
    const status = documentStatuses?.[projectId];
    if (!status) return null;

    // Check for contracts awaiting counter-signature
    const awaitingCounterSig = status.contracts?.find(
      c => c.status === 'awaiting_counter_signature'
    );
    
    if (awaitingCounterSig) {
      return {
        type: 'contract',
        status: 'awaiting_counter_signature',
        message: 'Contract needs counter-signature',
        variant: 'warning' as const,
      };
    }

    // Check for signed contracts
    const signedContract = status.contracts?.find(c => c.status === 'signed');
    if (signedContract) {
      return {
        type: 'contract',
        status: 'signed',
        message: 'Contract signed',
        variant: 'success' as const,
      };
    }

    // Check for sent contracts
    const sentContract = status.contracts?.find(c => c.status === 'sent');
    if (sentContract) {
      return {
        type: 'contract',
        status: 'sent',
        message: 'Contract sent',
        variant: 'default' as const,
      };
    }

    return null;
  };

  const form = useForm<z.infer<typeof projectFormSchema>>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      contactId: "",
      status: "active",
      progress: 0,
      estimatedValue: "",
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: z.infer<typeof projectFormSchema>) => {
      let venueId = null;
      
      // Create venue first if one is selected
      if (selectedVenue) {
        try {
          let venueResponse;
          
          if (selectedVenue.placeId) {
            // Create from Google Place
            venueResponse = await apiRequest("POST", "/api/venues/from-google", {
              placeId: selectedVenue.placeId
            });
          } else {
            // Create minimal venue
            venueResponse = await apiRequest("POST", "/api/venues/minimal", {
              name: selectedVenue.name,
              address: selectedVenue.address,
              city: selectedVenue.city,
              state: selectedVenue.state,
              zipCode: selectedVenue.zipCode,
              country: selectedVenue.country
            });
          }
          
          const venue = await venueResponse.json();
          venueId = venue.id;
        } catch (error) {
          console.error('Error creating venue:', error);
          // Continue without venue if creation fails
        }
      }
      
      const projectData = {
        ...data,
        estimatedValue: data.estimatedValue ? parseFloat(data.estimatedValue) : null,
        venueId,
      };
      const response = await apiRequest("POST", "/api/projects", projectData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Success",
        description: "Project created successfully!",
      });
      form.reset();
      setSelectedVenue(null);
      setShowProjectModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: z.infer<typeof projectFormSchema>) => {
      const projectData = {
        ...data,
        estimatedValue: data.estimatedValue ? parseFloat(data.estimatedValue) : null,
      };
      const response = await apiRequest("PATCH", `/api/projects/${editingProject!.id}`, projectData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Success",
        description: "Project updated successfully!",
      });
      form.reset();
      setEditingProject(null);
      setSelectedVenue(null);
      setShowProjectModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Populate form when editing an existing project
  useEffect(() => {
    if (editingProject) {
      form.reset({
        name: editingProject.name || "",
        description: editingProject.description || "",
        contactId: editingProject.contactId || "",
        status: editingProject.status || "active",
        progress: editingProject.progress || 0,
        estimatedValue: editingProject.estimatedValue?.toString() || "",
      });
    }
  }, [editingProject]);

  // Fetch deletion preview when project is selected for deletion
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['/api/projects', previewProjectId, 'deletion-preview'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${previewProjectId}/deletion-preview`);
      return response.json();
    },
    enabled: !!previewProjectId,
    retry: false
  });

  // Update deletion preview when data is loaded
  useEffect(() => {
    if (previewData && previewProjectId) {
      setDeletionPreview(previewData);
    }
  }, [previewData, previewProjectId]);

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pending-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      
      // Clear preview state
      setDeletionPreview(null);
      setPreviewProjectId(null);
      
      toast({
        title: "Project deleted",
        description: "Project and all related data have been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (projectId: string) => {
    setPreviewProjectId(projectId);
  };

  const handleConfirmDelete = () => {
    if (previewProjectId) {
      deleteProjectMutation.mutate(previewProjectId);
    }
  };

  const handleCancelDelete = () => {
    setPreviewProjectId(null);
    setDeletionPreview(null);
  };

  const onSubmit = (data: z.infer<typeof projectFormSchema>) => {
    if (editingProject) {
      updateProjectMutation.mutate(data);
    } else {
      createProjectMutation.mutate(data);
    }
  };

  const handleProjectStatusChange = async (projectId: string, newStatus: string) => {
    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/status-counts'] });
    } catch (e) {
      console.error('Status update failed', e);
      toast({ title: "Error", description: "Failed to update project status.", variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-emerald-100 text-emerald-800';
      case 'contacted': return 'bg-sky-100 text-sky-800';
      case 'hold': return 'bg-amber-100 text-amber-800';
      case 'proposal_sent': return 'bg-violet-100 text-violet-800';
      case 'booked': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'lost': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-rose-100 text-rose-800';
      case 'archived': return 'bg-gray-100 text-gray-500';
      // Legacy status support
      case 'active': return 'bg-green-100 text-green-800';
      case 'lead': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'New';
      case 'contacted': return 'Contacted';
      case 'hold': return 'Hold';
      case 'proposal_sent': return 'Proposal Sent';
      case 'booked': return 'Booked';
      case 'completed': return 'Completed';
      case 'lost': return 'Lost';
      case 'cancelled': return 'Cancelled';
      case 'archived': return 'Archived';
      case 'active': return 'Active';
      case 'lead': return 'New';
      default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }
  };

  const getContactName = (contactId: string) => {
    if (!contacts || !Array.isArray(contacts)) {
      return 'Loading...';
    }
    const contact = contacts.find(c => c.id === contactId);
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact';
  };

  const formatVenueAddress = (project: any) => {
    // Show just the venue name in the table for cleaner display
    return project.venue_name || 'No venue';
  };

  const getVenuePhone = (project: any) => {
    return project.venue_phone || 'No phone number';
  };


  const sortProjects = (projects: Project[]) => {
    if (!projects) return [];
    
    const sorted = [...projects];
    
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'client-asc':
        return sorted.sort((a, b) => getContactName(a.contactId).localeCompare(getContactName(b.contactId)));
      case 'client-desc':
        return sorted.sort((a, b) => getContactName(b.contactId).localeCompare(getContactName(a.contactId)));
      case 'date-oldest':
        return sorted.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
      case 'date-newest':
      default:
        return sorted.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    }
  };

  const sortedProjects = sortProjects(projects || []);

  const handleAddProject = () => {
    setEditingProject(null);
    form.reset();
    setSelectedVenue(null);
    setShowProjectModal(true);
  };

  const handleViewDetails = (project: Project) => {
    setLocation(`/projects/${project.id}`);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedProject(null);
  };

  return (
    <>
      <Header 
        title="Projects" 
        subtitle="Track and manage your active projects"
      />
      
      <main className="flex-1 overflow-auto p-6">
        {/* Status filter tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.key;
            // Calculate count for this tab
            let count: number | undefined;
            if (statusCounts) {
              if (tab.key === 'all') {
                count = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);
              } else if (tab.key === 'active') {
                count = ['new', 'contacted', 'hold', 'proposal_sent', 'booked', 'completed']
                  .reduce((sum, s) => sum + (statusCounts[s] || 0), 0);
              } else {
                count = statusCounts[tab.key] || 0;
              }
            }
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {!isActive && tab.key !== 'all' && tab.key !== 'active' && (
                  <span className={`w-2 h-2 rounded-full ${tab.color}`} />
                )}
                {tab.label}
                {count !== undefined && count > 0 && (
                  <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-primary-foreground/20' : 'bg-background'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Card data-testid="projects-table-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {statusFilter === 'all' ? 'All Projects' :
                 statusFilter === 'active' ? 'Active Projects' :
                 `${STATUS_TABS.find(t => t.key === statusFilter)?.label || ''} Projects`}
              </CardTitle>
              <div className="flex items-center space-x-3">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48" data-testid="select-sort-projects">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Project Name: A-Z</SelectItem>
                    <SelectItem value="name-desc">Project Name: Z-A</SelectItem>
                    <SelectItem value="client-asc">Client Name: A-Z</SelectItem>
                    <SelectItem value="client-desc">Client Name: Z-A</SelectItem>
                    <SelectItem value="date-oldest">Project Date: Oldest First</SelectItem>
                    <SelectItem value="date-newest">Project Date: Newest First</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddProject} data-testid="button-add-project">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Project
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              </div>
            ) : !projects || projects.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-projects-state">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No projects found</p>
                <Button onClick={handleAddProject} data-testid="button-add-first-project">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Project
                </Button>
              </div>
            ) : (
              <Table data-testid="projects-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Project Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjects.map((project) => (
                    <TableRow 
                      key={project.id} 
                      data-testid={`project-row-${project.id}`}
                      className="cursor-pointer"
                      onClick={() => handleViewDetails(project)}
                    >
                      <TableCell className="font-medium" data-testid={`project-name-${project.id}`}>
                        {project.name}
                      </TableCell>
                      <TableCell data-testid={`project-venue-${project.id}`}>
                        {formatVenueAddress(project)}
                      </TableCell>
                      <TableCell data-testid={`project-status-${project.id}`} onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span className={`${getStatusColor(project.status)} cursor-pointer hover:opacity-80 inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold`}>
                              {getStatusLabel(project.status)}
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {['new','contacted','hold','proposal_sent','booked','completed','lost','cancelled','archived'].map(s => (
                              <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); handleProjectStatusChange(project.id, s); }} className={project.status === s ? 'bg-muted font-semibold' : ''}>
                                {getStatusLabel(s)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell data-testid={`project-documents-${project.id}`}>
                        <DocumentStatusIndicators 
                          projectId={project.id} 
                          documentStatuses={documentStatuses?.[project.id]}
                        />
                      </TableCell>
                      <TableCell data-testid={`project-progress-${project.id}`}>
                        <div className="flex items-center space-x-2">
                          <Progress value={project.progress || 0} className="w-20" />
                          <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`project-value-${project.id}`}>
                        {project.estimatedValue ? formatCurrency(parseFloat(project.estimatedValue), (project.currency as any) || 'GBP') : '-'}
                      </TableCell>
                      <TableCell data-testid={`project-date-${project.id}`}>
                        {(() => {
                          // Show project start date if available
                          const dateValue = (project as any).start_date || (project as any).startDate;
                          if (!dateValue) return '-';
                          try {
                            const date = new Date(dateValue);
                            if (isNaN(date.getTime())) return '-';
                            return format(date, 'MMM dd, yyyy');
                          } catch {
                            return '-';
                          }
                        })()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(project);
                            }}
                            data-testid={`view-details-${project.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setEditingProject(project); setShowProjectModal(true); }}
                            data-testid={`edit-project-${project.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(project.id);
                            }}
                            data-testid={`delete-project-${project.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Project Modal */}
      <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-project-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project-contact">
                          <SelectValue placeholder="Select a contact..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts?.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.firstName} {contact.lastName} {contact.company && `(${contact.company})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3} 
                        placeholder="Project description..." 
                        {...field} 
                        value={field.value || ""}
                        data-testid="textarea-project-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Venue Selection */}
              <div className="space-y-2">
                <VenueSelector
                  onVenueSelect={setSelectedVenue}
                  selectedVenue={selectedVenue}
                  placeholder="Search for project venue..."
                  allowManual={true}
                  showMap={false}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="hold">Hold</SelectItem>
                          <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                          <SelectItem value="booked">Booked</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="estimatedValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Value</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          {...field} 
                          data-testid="input-project-value" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setShowProjectModal(false)}
                  data-testid="button-cancel-project"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProjectMutation.isPending || updateProjectMutation.isPending}
                  data-testid="button-save-project"
                >
                  {editingProject
                    ? (updateProjectMutation.isPending ? "Saving..." : "Save Changes")
                    : (createProjectMutation.isPending ? "Creating..." : "Create Project")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Project Detail Modal */}
      <ProjectDetailModal
        project={selectedProject}
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
      />

      {/* Enhanced Deletion Preview Dialog */}
      {(deletionPreview || previewLoading || previewProjectId) && (
        <AlertDialog open={true} onOpenChange={handleCancelDelete}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project - Preview</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {previewLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span>Loading deletion preview...</span>
                    </div>
                  ) : deletionPreview ? (
                    <>
                      <p>
                        You are about to delete project <strong>{deletionPreview.project.name}</strong> 
                        {deletionPreview.project.status && ` (${deletionPreview.project.status})`}.
                      </p>
                      
                      {deletionPreview.willDelete.contact ? (
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                          <p className="text-yellow-800 dark:text-yellow-200 mb-2">
                            ⚠️ This project is associated with a contact. Are you sure you want to delete?
                          </p>
                          <div className="text-sm space-y-1">
                            <p><strong>Contact:</strong> {deletionPreview.willDelete.contact.name}</p>
                            {deletionPreview.willDelete.contact.isOnlyProject && (
                              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                                Note: This contact will also be deleted since this is their only project.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : deletionPreview.willDelete.totalItems > 0 ? (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                            ⚠️ This will permanently delete associated data.
                          </h4>
                        </div>
                      ) : (
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <p className="text-green-800 dark:text-green-200">
                            ✅ This project has no associated data. It can be safely deleted.
                          </p>
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        This action cannot be undone.
                      </p>
                    </>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelDelete} disabled={deleteProjectMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              {!previewLoading && deletionPreview && (
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  disabled={deleteProjectMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                  data-testid={`confirm-delete-project-${deletionPreview.project.id}`}
                >
                  {deleteProjectMutation.isPending ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    'Delete Project'
                  )}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
