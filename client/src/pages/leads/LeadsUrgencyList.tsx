import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  Calendar,
  Mail,
  CheckCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  eventDate?: string;
  venue?: string;
  projectId?: string;
  urgencyScore?: number;
  urgencyPriority?: 'low' | 'medium' | 'high' | 'urgent';
  needsReply?: boolean;
  daysSinceContact?: number;
  daysUntilEvent?: number | null;
  hasAutoReply?: boolean;
  hasPersonalReply?: boolean;
  lastContactDate?: string;
}

type FilterType = 'all' | 'needs_reply' | 'urgent' | 'this_week';

export function LeadsUrgencyList() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [, setLocation] = useLocation();
  
  // Fetch leads with urgency data
  const { data: leads = [], isLoading, refetch } = useQuery<Lead[]>({
    queryKey: ['/api/leads/urgency'],
  });
  
  // Apply filters
  const filteredLeads = leads.filter(lead => {
    if (filter === 'needs_reply') {
      return lead.needsReply === true;
    }
    if (filter === 'urgent') {
      return lead.urgencyPriority === 'urgent' || lead.urgencyPriority === 'high';
    }
    if (filter === 'this_week') {
      return lead.daysSinceContact !== undefined && lead.daysSinceContact <= 7;
    }
    return true;
  });
  
  // Sort by urgency score (highest first)
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const scoreA = a.urgencyScore || 0;
    const scoreB = b.urgencyScore || 0;
    return scoreB - scoreA;
  });
  
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-black';
      default:
        return 'bg-gray-300 text-gray-700';
    }
  };
  
  const getPriorityIcon = (lead: Lead) => {
    if (lead.needsReply) {
      return <AlertCircle className="h-4 w-4" />;
    }
    if (lead.daysUntilEvent !== null && lead.daysUntilEvent !== undefined && lead.daysUntilEvent < 14) {
      return <Calendar className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };
  
  const getStatusBadge = (lead: Lead) => {
    if (lead.needsReply) {
      return <Badge variant="destructive" className="gap-1">
        <Mail className="h-3 w-3" />
        Needs Reply
      </Badge>;
    }
    
    if (lead.hasPersonalReply) {
      return <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="h-3 w-3" />
        Replied
      </Badge>;
    }
    
    if (lead.hasAutoReply) {
      return <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
        <Mail className="h-3 w-3" />
        Auto-replied
      </Badge>;
    }
    
    return <Badge variant="outline">New</Badge>;
  };
  
  return (
    <>
      <Header 
        title="Leads" 
        subtitle="Sorted by urgency"
      />
      
      <main className="flex-1 overflow-auto p-6">
        {/* Filters and Actions */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              data-testid="filter-all"
            >
              All Leads ({leads.length})
            </Button>
            <Button
              variant={filter === 'needs_reply' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('needs_reply')}
              data-testid="filter-needs-reply"
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Needs Reply ({leads.filter(l => l.needsReply).length})
            </Button>
            <Button
              variant={filter === 'urgent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('urgent')}
              data-testid="filter-urgent"
            >
              Urgent ({leads.filter(l => l.urgencyPriority === 'urgent' || l.urgencyPriority === 'high').length})
            </Button>
            <Button
              variant={filter === 'this_week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('this_week')}
              data-testid="filter-this-week"
            >
              This Week ({leads.filter(l => l.daysSinceContact !== undefined && l.daysSinceContact <= 7).length})
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Leads List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading leads...
          </div>
        ) : sortedLeads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {filter === 'all' ? 'No leads yet' : 'No leads match this filter'}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedLeads.map((lead) => (
              <Card 
                key={lead.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  if (lead.projectId) {
                    setLocation(`/projects/${lead.projectId}`);
                  }
                }}
                data-testid={`lead-card-${lead.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Priority & Info */}
                    <div className="flex items-start gap-4 flex-1">
                      {/* Priority Indicator */}
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getPriorityColor(lead.urgencyPriority)}`}>
                          {getPriorityIcon(lead)}
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {lead.urgencyScore || 0}
                        </span>
                      </div>
                      
                      {/* Lead Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {lead.firstName} {lead.lastName}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {lead.email}
                              {lead.phone && ` • ${lead.phone}`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {getStatusBadge(lead)}
                            <Badge className={getPriorityColor(lead.urgencyPriority)}>
                              {lead.urgencyPriority || 'low'}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Event & Timing Info */}
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {lead.eventDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Event: {format(new Date(lead.eventDate), 'MMM dd, yyyy')}</span>
                              {lead.daysUntilEvent !== null && lead.daysUntilEvent !== undefined && (
                                <span className="text-xs">
                                  ({Math.floor(lead.daysUntilEvent)} days)
                                </span>
                              )}
                            </div>
                          )}
                          {lead.venue && (
                            <div className="flex items-center gap-1">
                              <span>📍 {lead.venue}</span>
                            </div>
                          )}
                          {lead.daysSinceContact !== undefined && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {lead.daysSinceContact === 0 
                                  ? 'Today' 
                                  : lead.daysSinceContact === 1
                                    ? '1 day ago'
                                    : `${lead.daysSinceContact} days ago`
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default LeadsUrgencyList;
