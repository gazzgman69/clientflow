import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox } from "lucide-react";
import LeadCard from "@/components/leads/LeadCard";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch kanban data
  const { data: kanbanData, isLoading } = useQuery<KanbanData>({
    queryKey: ["/api/leads/kanban"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leads/kanban");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds to pick up new form submissions
    refetchIntervalInBackground: true,
  });

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
        actions={
          <Button variant="outline" asChild data-testid="button-inbox-view">
            <Link href="/leads/inbox">
              <Inbox className="h-4 w-4 mr-2" />
              Inbox View
            </Link>
          </Button>
        }
      />
      
      <main className="flex-1 overflow-auto p-6">
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
    </>
  );
}