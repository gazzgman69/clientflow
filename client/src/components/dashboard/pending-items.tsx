import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CreditCard, FileCheck, UserCheck, ExternalLink, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, format, isAfter, addDays } from "date-fns";

interface PendingItem {
  id: string;
  type: 'quote' | 'contract' | 'invoice' | 'questionnaire';
  title: string;
  clientName: string;
  projectName: string;
  sentDate: Date;
  dueDate?: Date;
  amount?: number;
  status: string;
  clientId: string;
  projectId: string;
  isOverdue?: boolean;
  urgency: 'low' | 'medium' | 'high';
}

export default function PendingItems() {
  // Mock pending items - in real app, this would come from API
  const pendingItems: PendingItem[] = [
    {
      id: "1",
      type: "quote",
      title: "Wedding Reception Quote",
      clientName: "Sarah & David Johnson",
      projectName: "June Wedding",
      sentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      amount: 2500,
      status: "sent",
      clientId: "client-1",
      projectId: "project-1",
      urgency: "medium"
    },
    {
      id: "2",
      type: "contract",
      title: "Performance Agreement",
      clientName: "The Grand Hotel",
      projectName: "New Year's Eve Gala",
      sentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      status: "pending_signature",
      clientId: "client-2",
      projectId: "project-2",
      urgency: "high"
    },
    {
      id: "3",
      type: "invoice",
      title: "Final Payment - Corporate Event",
      clientName: "Tech Solutions Inc.",
      projectName: "Annual Conference",
      sentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
      amount: 1800,
      status: "overdue",
      clientId: "client-3",
      projectId: "project-3",
      isOverdue: true,
      urgency: "high"
    },
    {
      id: "4",
      type: "questionnaire",
      title: "Event Planning Questionnaire",
      clientName: "Jennifer Davis",
      projectName: "25th Anniversary Party",
      sentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      status: "pending_completion",
      clientId: "client-4",
      projectId: "project-4",
      urgency: "medium"
    },
    {
      id: "5",
      type: "contract",
      title: "Venue Performance Contract",
      clientName: "Downtown Music Club",
      projectName: "Monthly Residency",
      sentDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (overdue)
      status: "overdue",
      clientId: "client-5",
      projectId: "project-5",
      isOverdue: true,
      urgency: "high"
    },
    {
      id: "6",
      type: "quote",
      title: "Birthday Party Entertainment",
      clientName: "Mike Thompson",
      projectName: "50th Birthday Celebration", 
      sentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      amount: 1200,
      status: "sent",
      clientId: "client-6",
      projectId: "project-6",
      urgency: "low"
    }
  ];

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'quote': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'contract': return <FileCheck className="h-4 w-4 text-green-500" />;
      case 'invoice': return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case 'questionnaire': return <UserCheck className="h-4 w-4 text-purple-500" />;
      default: return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (item: PendingItem) => {
    if (item.isOverdue) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Overdue
      </Badge>;
    }
    
    switch (item.status) {
      case 'sent': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Sent</Badge>;
      case 'pending_signature': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Pending Signature</Badge>;
      case 'pending_completion': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">Pending Completion</Badge>;
      default: return <Badge variant="outline">{item.status}</Badge>;
    }
  };

  const getUrgencyColor = (urgency: string, isOverdue?: boolean) => {
    if (isOverdue) return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
    switch (urgency) {
      case 'high': return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
      case 'low': return 'border-l-green-500 bg-green-50 dark:bg-green-900/10';
      default: return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10';
    }
  };

  const handleClientClick = (clientId: string, projectId: string) => {
    // In real app, this would navigate to the project page
    console.log(`Navigate to project ${projectId} for client ${clientId}`);
  };

  // Sort by urgency and overdue status
  const sortedItems = [...pendingItems].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    
    const urgencyOrder = { high: 3, medium: 2, low: 1 };
    return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
  });

  return (
    <Card data-testid="pending-items-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Items
            <Badge variant="secondary" className="ml-2">
              {pendingItems.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-view-all-pending">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className={`border-l-4 rounded-r-lg p-4 transition-colors hover:shadow-sm ${getUrgencyColor(item.urgency, item.isOverdue)}`}
              data-testid={`pending-item-${item.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex-shrink-0 mt-0.5">
                    {getItemIcon(item.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-foreground truncate">
                        {item.title}
                      </h4>
                      {getStatusBadge(item)}
                    </div>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <button
                        onClick={() => handleClientClick(item.clientId, item.projectId)}
                        className="font-medium text-sm text-primary hover:underline cursor-pointer"
                        data-testid={`client-link-${item.id}`}
                      >
                        {item.clientName}
                      </button>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        • {item.projectName}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Sent: {format(item.sentDate, 'MMM d, yyyy')}
                      </span>
                      {item.dueDate && (
                        <span className={item.isOverdue ? 'text-red-600 font-medium' : ''}>
                          Due: {format(item.dueDate, 'MMM d, yyyy')}
                        </span>
                      )}
                      {item.amount && (
                        <span className="font-medium text-foreground">
                          ${item.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}