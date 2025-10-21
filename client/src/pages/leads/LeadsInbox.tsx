import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Mail, ExternalLink, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface InboxData {
  items: LeadCardDTO[];
  nextCursor: string | null;
  counts: {
    new: number;
  };
}

interface AutoResponderLog {
  id: string;
  status: 'queued' | 'sent' | 'failed' | 'pending_auth';
  errorMessage: string | null;
  retryCount: number;
}

// Helper component to show auto-responder status for a lead
function AutoResponderStatus({ leadId }: { leadId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [] } = useQuery<AutoResponderLog[]>({
    queryKey: ['/api/auto-responders/logs/lead', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/auto-responders/logs/lead/${leadId}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (logId: string) => {
      const response = await apiRequest('POST', `/api/auto-responders/retry/${logId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auto-responders/logs/lead', leadId] });
      toast({
        title: 'Auto-response queued',
        description: 'The auto-response will be sent shortly.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to retry auto-response.',
        variant: 'destructive',
      });
    },
  });

  if (logs.length === 0) return null;

  const latestLog = logs[0];

  const getStatusIcon = () => {
    switch (latestLog.status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending_auth':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (latestLog.status) {
      case 'sent':
        return 'Auto-response sent';
      case 'failed':
        return latestLog.errorMessage || 'Auto-response failed';
      case 'pending_auth':
        return 'Email provider not connected';
      case 'queued':
        return 'Auto-response queued';
      default:
        return '';
    }
  };

  const canRetry = latestLog.status === 'failed' || latestLog.status === 'pending_auth';

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {getStatusIcon()}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getStatusText()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {canRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => retryMutation.mutate(latestLog.id)}
          disabled={retryMutation.isPending}
          data-testid={`button-retry-autoresponder-${leadId}`}
        >
          <RefreshCw className={`h-3 w-3 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}

export default function LeadsInbox() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch inbox data
  const { data: inboxData, isLoading } = useQuery<InboxData>({
    queryKey: ["/api/leads/inbox", searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await apiRequest("GET", `/api/leads/inbox?${params}`);
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for better responsiveness
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true, // Refresh when tab/window gains focus
    refetchOnMount: true, // Refresh when component mounts
  });

  // Mutation to mark lead as contacted
  const markContactedMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const response = await apiRequest("PATCH", `/api/leads/${leadId}/status`, {
        status: 'contacted'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/summary"] });
      toast({
        title: "Lead updated",
        description: "Lead marked as contacted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead status.",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete lead
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const response = await apiRequest("DELETE", `/api/leads/${leadId}`);
      return response.status === 204 ? {} : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/inbox"] });
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleMarkContacted = (leadId: string) => {
    markContactedMutation.mutate(leadId);
  };

  return (
    <>
      <Header 
        title="Leads" 
        subtitle="Inbox view for lead triage"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <Card data-testid="leads-inbox">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lead Inbox ({inboxData?.counts.new || 0} new)</CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="search-leads"
                  />
                </div>
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
            ) : !inboxData?.items || inboxData.items.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-inbox-state">
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'No leads found matching your search' : 'No leads found'}
                </p>
              </div>
            ) : (
              <Table data-testid="inbox-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Project Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboxData.items.map((lead) => (
                    <TableRow key={lead.id} data-testid={`inbox-row-${lead.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {lead.projectId ? (
                            <Link href={`/projects/${lead.projectId}`}>
                              <span 
                                className="hover:text-primary hover:underline cursor-pointer"
                                data-testid={`lead-card-name-${lead.id}`}
                              >
                                {lead.contactName}
                              </span>
                            </Link>
                          ) : (
                            <span data-testid={`lead-card-name-${lead.id}`}>
                              {lead.contactName}
                            </span>
                          )}
                          {lead.hasConflict && (
                            <Badge variant="destructive" className="text-xs">
                              Conflict
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {lead.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(lead.createdAtISO)}
                      </TableCell>
                      <TableCell>
                        {formatDate(lead.projectDateISO)}
                      </TableCell>
                      <TableCell>
                        {lead.source}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(lead.status)}>
                          {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {lead.status === 'new' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkContacted(lead.id)}
                              disabled={markContactedMutation.isPending}
                              data-testid={`mark-contacted-${lead.id}`}
                            >
                              Mark Contacted
                            </Button>
                          )}
                          <AutoResponderStatus leadId={lead.id} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.location.href = `mailto:${lead.email}`}
                            data-testid={`email-${lead.id}`}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          {lead.projectId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              data-testid={`open-project-${lead.id}`}
                            >
                              <Link href={`/projects/${lead.projectId}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLead(lead.id)}
                            disabled={deleteLeadMutation.isPending}
                            data-testid={`delete-lead-${lead.id}`}
                            className="text-muted-foreground hover:text-destructive"
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
    </>
  );
}