import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { Project, Contact } from "@shared/schema";
import { z } from "zod";
import ProjectDetailModal from "@/components/modals/project-detail-modal";
import { VenueSelector } from "@/components/venues";

const projectFormSchema = insertProjectSchema.extend({
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

export default function Projects() {
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);
  const [sortBy, setSortBy] = useState<string>('date-newest');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 1000, // Refresh every 1 second for real-time updates
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true, // Refresh when tab/window gains focus
    refetchOnMount: true, // Refresh when component mounts
    refetchOnReconnect: true, // Refresh on reconnect
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    refetchInterval: 1000, // Refresh every 1 second for real-time updates
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true, // Refresh when tab/window gains focus
    refetchOnMount: true, // Refresh when component mounts
    refetchOnReconnect: true, // Refresh on reconnect
  });

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

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
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

  const onSubmit = (data: z.infer<typeof projectFormSchema>) => {
    createProjectMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getContactName = (contactId: string) => {
    const contact = contacts?.find(c => c.id === contactId);
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact';
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
    setSelectedProject(project);
    setShowDetailModal(true);
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
        <Card data-testid="projects-table-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Projects</CardTitle>
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
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Created</TableHead>
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
                      <TableCell data-testid={`project-client-${project.id}`}>
                        {getContactName(project.contactId)}
                      </TableCell>
                      <TableCell data-testid={`project-status-${project.id}`}>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`project-progress-${project.id}`}>
                        <div className="flex items-center space-x-2">
                          <Progress value={project.progress || 0} className="w-20" />
                          <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`project-value-${project.id}`}>
                        {project.estimatedValue ? `$${parseFloat(project.estimatedValue).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell data-testid={`project-created-${project.id}`}>
                        {format(new Date(project.createdAt!), 'MMM dd, yyyy')}
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
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`edit-project-${project.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`delete-project-${project.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{project.name}"? This action cannot be undone and will remove all associated tasks, files, and data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteProjectMutation.mutate(project.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  data-testid={`confirm-delete-project-${project.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on-hold">On Hold</SelectItem>
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
                  disabled={createProjectMutation.isPending}
                  data-testid="button-save-project"
                >
                  {createProjectMutation.isPending ? "Creating..." : "Create Project"}
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
    </>
  );
}
