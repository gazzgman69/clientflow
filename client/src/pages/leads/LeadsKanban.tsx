import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, RefreshCw, FileText } from "lucide-react";
import LeadCard from "@/components/leads/LeadCard";
import ProjectDetailModal from "@/components/modals/project-detail-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSmartPolling } from "@/lib/useSmartPolling";

interface LeadCardDTO {
  id: string;
  contactName: string;
  email: string;
  phone: string;
  projectId: string | null;
  projectTitle: string | null;
  projectDateISO: string | null;
  source: string;
  createdAtISO: string;
  status: 'new' | 'contacted' | 'qualified' | 'archived';
  hasConflict: boolean;
  conflictDetails?: { count: number; projectIds: string[] };
}

interface KanbanData {
  columns: {
    new: LeadCardDTO[];
    contacted: LeadCardDTO[];
    qualified: LeadCardDTO[];
    archived: LeadCardDTO[];
  };
  counts: {
    new: number;
  };
}

const COLUMN_TITLES = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  archived: 'Archived'
};

const COLUMN_ORDER: (keyof KanbanData['columns'])[] = ['new', 'contacted', 'qualified', 'archived'];

export default function LeadsKanban() {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previousDataRef = useRef<KanbanData | null>(null);
  const [, setLocation] = useLocation();

  // Mark leads as viewed when page loads
  const markLeadsViewed = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leads/mark-viewed"),
    onSuccess: () => {
      // Invalidate leads summary to update badge count
      queryClient.invalidateQueries({ queryKey: ["/api/leads/summary"] });
    }
  });

  // Mark leads as viewed when page loads
  useEffect(() => {
    markLeadsViewed.mutate();
  }, []);

  // Fetch project details for modal
  const { data: projectDetails } = useQuery({
    queryKey: ["/api/projects", selectedProject?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${selectedProject.id}`);
      return response.json();
    },
    enabled: !!selectedProject?.id,
  });

  // Modal handlers
  const handleViewProjectDetails = async (projectId: string) => {
    console.log('handleViewProjectDetails called with projectId:', projectId);
    // Fetch the project details first
    try {
      console.log('Fetching project details...');
      const response = await apiRequest("GET", `/api/projects/${projectId}`);
      const project = await response.json();
      console.log('Project data received:', project);
      setSelectedProject(project);
      setShowDetailModal(true);
      console.log('Modal state set to true');
    } catch (error) {
      console.error('Error fetching project:', error);
      toast({
        title: "Error",
        description: "Failed to load project details.",
        variant: "destructive",
      });
    }
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedProject(null);
  };

  // Fetch kanban data with auto-refresh
  const { data: kanbanData, isLoading, refetch } = useQuery<KanbanData>({
    queryKey: ["/api/leads/kanban"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leads/kanban");
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for better responsiveness
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true, // Refresh when tab/window gains focus
    refetchOnMount: true, // Refresh when component mounts
  });
  
  // Simple manual refresh
  const refetchNow = () => {
    refetch();
  };
  
  const lastUpdated = new Date();
  const fetching = isLoading;

  // Mutation to update lead status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/leads/${leadId}/status`, {
        status
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/kanban"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/summary"] });
      toast({
        title: "Lead updated",
        description: "Lead status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead status. Changes reverted.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/kanban"] });
    },
  });

  // Mutation to delete lead
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const response = await apiRequest("DELETE", `/api/leads/${leadId}`);
      return response.status === 204 ? {} : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/kanban"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/summary"] });
      toast({
        title: "Lead deleted",
        description: "Lead has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete lead.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteLead = (leadId: string) => {
    deleteLeadMutation.mutate(leadId);
  };

  // Keyboard shortcut for refresh (fixed)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        refetch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refetch]);
  
  // Manual refresh from sidebar (fixed)
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener('leads:manual-refresh', handler);
    return () => window.removeEventListener('leads:manual-refresh', handler);
  }, [refetch]);
  
  const formatLastUpdated = (date?: Date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-GB', { hour12: false });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    
    if (!leadId || !kanbanData) return;

    // Find current status of the lead
    let currentStatus = '';
    for (const [status, leads] of Object.entries(kanbanData.columns)) {
      if (leads.some(lead => lead.id === leadId)) {
        currentStatus = status;
        break;
      }
    }

    // Don't update if it's the same column
    if (currentStatus === targetStatus) {
      setDraggedLeadId(null);
      setDragOverColumn(null);
      return;
    }

    // Update the lead status
    updateStatusMutation.mutate({ leadId, status: targetStatus });
    
    setDraggedLeadId(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverColumn(null);
  };

  if (isLoading) {
    return (
      <>
        <Header 
          title="Leads" 
          subtitle="Kanban board view"
        />
        <main className="flex-1 overflow-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="grid grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-4">
                  <div className="h-6 bg-muted rounded"></div>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-24 bg-muted rounded"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header 
        title="Leads" 
        subtitle="Kanban board view"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              Last updated: {formatLastUpdated(lastUpdated)}
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={refetchNow}
              disabled={fetching}
              aria-label="Refresh leads"
              data-testid="refresh-leads"
            >
              <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild data-testid="button-lead-forms">
              <Link href="/leads/capture">
                <FileText className="h-4 w-4 mr-2" />
                Lead Forms
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6" data-testid="kanban-board">
          {COLUMN_ORDER.map((columnId) => {
            const leads = kanbanData?.columns[columnId] || [];
            const title = COLUMN_TITLES[columnId];
            const isDragOver = dragOverColumn === columnId;
            
            return (
              <Card 
                key={columnId} 
                className={`${isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                data-testid={`kanban-column-${columnId}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    {title}
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                      {leads.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent 
                  className="space-y-3 min-h-[400px]"
                  onDragOver={(e) => handleDragOver(e, columnId)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, columnId)}
                >
                  {leads.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Drop leads here
                    </div>
                  ) : (
                    leads.map((lead) => (
                      <div 
                        key={lead.id}
                        className={draggedLeadId === lead.id ? 'opacity-50' : ''}
                      >
                        <LeadCard
                          lead={lead}
                          draggable={true}
                          onDragStart={handleDragStart}
                          onDelete={handleDeleteLead}
                          onClick={() => {
                            console.log('Lead card clicked:', lead);
                            if (lead.projectId) {
                              console.log('Opening modal for project:', lead.projectId);
                              handleViewProjectDetails(lead.projectId);
                            } else {
                              console.log('No project ID, navigating to new project');
                              // If no project exists, navigate to create a new project for this lead
                              setLocation(`/projects/new?leadId=${lead.id}`);
                            }
                          }}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Project Detail Modal */}
      <ProjectDetailModal
        project={selectedProject}
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
      />
    </>
  );
}