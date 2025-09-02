import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Mail, CreditCard, User, Clock, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ClientActivity {
  id: string;
  type: 'quote_opened' | 'contract_viewed' | 'invoice_paid' | 'questionnaire_completed' | 'email_replied';
  clientName: string;
  projectName: string;
  documentTitle?: string;
  timestamp: Date;
  description: string;
  clientId: string;
  projectId: string;
}

export default function RecentClientActivity() {
  // Mock recent client activities - in real app, this would come from API
  const recentActivities: ClientActivity[] = [
    {
      id: "1",
      type: "contract_viewed",
      clientName: "Sarah Johnson",
      projectName: "Wedding Reception",
      documentTitle: "Performance Contract #WR-2024-001",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      description: "Opened and viewed contract",
      clientId: "client-1",
      projectId: "project-1"
    },
    {
      id: "2", 
      type: "quote_opened",
      clientName: "Mike Thompson",
      projectName: "Corporate Event",
      documentTitle: "Event Quote #CE-2024-015",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      description: "Opened quote document",
      clientId: "client-2",
      projectId: "project-2"
    },
    {
      id: "3",
      type: "invoice_paid",
      clientName: "The Grand Hotel",
      projectName: "New Year's Eve Gala",
      documentTitle: "Invoice #NYE-2024-003",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      description: "Payment received",
      clientId: "client-3",
      projectId: "project-3"
    },
    {
      id: "4",
      type: "questionnaire_completed",
      clientName: "Jennifer Davis",
      projectName: "Anniversary Party",
      documentTitle: "Event Planning Questionnaire",
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      description: "Completed event details form",
      clientId: "client-4",
      projectId: "project-4"
    },
    {
      id: "5",
      type: "email_replied",
      clientName: "Downtown Music Venue",
      projectName: "Monthly Residency",
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      description: "Replied to setlist confirmation email",
      clientId: "client-5",
      projectId: "project-5"
    },
    {
      id: "6",
      type: "contract_viewed",
      clientName: "Emily Wilson",
      projectName: "Graduation Celebration",
      documentTitle: "Performance Agreement #GC-2024-007",
      timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18 hours ago
      description: "Downloaded contract PDF",
      clientId: "client-6",
      projectId: "project-6"
    },
    {
      id: "7",
      type: "quote_opened",
      clientName: "Restaurant & Bar",
      projectName: "Live Music Series",
      documentTitle: "Monthly Performance Quote",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      description: "Viewed pricing details",
      clientId: "client-7",
      projectId: "project-7"
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quote_opened': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'contract_viewed': return <FileText className="h-4 w-4 text-green-500" />;
      case 'invoice_paid': return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case 'questionnaire_completed': return <User className="h-4 w-4 text-purple-500" />;
      case 'email_replied': return <Mail className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'quote_opened': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Quote</Badge>;
      case 'contract_viewed': return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Contract</Badge>;
      case 'invoice_paid': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Payment</Badge>;
      case 'questionnaire_completed': return <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Form</Badge>;
      case 'email_replied': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">Email</Badge>;
      default: return <Badge variant="outline">Activity</Badge>;
    }
  };

  const handleClientClick = (clientId: string, projectId: string) => {
    // In real app, this would navigate to the project page
    console.log(`Navigate to project ${projectId} for client ${clientId}`);
  };

  return (
    <Card data-testid="recent-client-activity-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Recent Client Activity
          </CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-view-all-activity">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivities.slice(0, 8).map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              data-testid={`activity-item-${activity.id}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => handleClientClick(activity.clientId, activity.projectId)}
                    className="font-medium text-foreground hover:text-primary hover:underline cursor-pointer"
                    data-testid={`client-name-${activity.id}`}
                  >
                    {activity.clientName}
                  </button>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  {getActivityBadge(activity.type)}
                </div>
                
                <div className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{activity.projectName}</span>
                  {activity.documentTitle && (
                    <span> • {activity.documentTitle}</span>
                  )}
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {activity.description}
                </div>
              </div>
              
              <div className="flex-shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}