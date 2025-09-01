import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@shared/schema";

export default function RecentLeads() {
  const { data: leads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-32"></div>
                    <div className="h-3 bg-muted rounded w-24"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-6 bg-muted rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentLeads = leads?.slice(0, 3) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'follow-up': return 'bg-yellow-100 text-yellow-800';
      case 'converted': return 'bg-green-100 text-green-800';
      case 'lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLeadImage = (index: number) => {
    const images = [
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
      "https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100",
      "https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&h=100"
    ];
    return images[index % images.length];
  };

  return (
    <Card data-testid="recent-leads-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Recent Leads</CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-view-all-leads">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {recentLeads.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground" data-testid="empty-leads">
            No leads found. Add your first lead to get started.
          </div>
        ) : (
          recentLeads.map((lead, index) => (
            <div 
              key={lead.id} 
              className="flex items-center justify-between p-4 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
              data-testid={`lead-item-${lead.id}`}
            >
              <div className="flex items-center space-x-4">
                <img 
                  src={getLeadImage(index)} 
                  alt="Lead avatar" 
                  className="w-10 h-10 rounded-full object-cover"
                  data-testid={`lead-avatar-${lead.id}`}
                />
                <div>
                  <p className="font-medium text-foreground" data-testid={`lead-name-${lead.id}`}>
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid={`lead-company-${lead.id}`}>
                    {lead.company || 'No company'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground" data-testid={`lead-value-${lead.id}`}>
                  ${lead.estimatedValue ? parseFloat(lead.estimatedValue).toLocaleString() : '0'}
                </p>
                <Badge 
                  className={getStatusColor(lead.status)}
                  data-testid={`lead-status-${lead.id}`}
                >
                  {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
