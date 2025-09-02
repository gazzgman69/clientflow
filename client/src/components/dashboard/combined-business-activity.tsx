import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  UserPlus, 
  FileX, 
  AlertTriangle, 
  CheckSquare, 
  ExternalLink,
  Clock,
  DollarSign,
  Calendar,
  Briefcase,
  FileText,
  Mail,
  CreditCard,
  User
} from "lucide-react";
import { format, isAfter } from "date-fns";

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

interface BusinessPriority {
  id: string;
  type: 'new_lead' | 'overdue_contract' | 'overdue_invoice' | 'todo' | 'approval_needed';
  title: string;
  description: string;
  clientName?: string;
  projectName?: string;
  amount?: number;
  dueDate?: Date;
  createdDate: Date;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  clientId?: string;
  projectId?: string;
  actionUrl?: string;
}

export default function CombinedBusinessActivity() {
  // Recent client activities
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
    }
  ];

  // Business priority items
  const businessPriorities: BusinessPriority[] = [
    {
      id: "lead-1",
      type: "new_lead",
      title: "Wedding Inquiry - Beach Resort",
      description: "Bride seeking live music for oceanfront ceremony",
      clientName: "Emily Richards",
      createdDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      urgency: "high",
      clientId: "client-new-1"
    },
    {
      id: "lead-2", 
      type: "new_lead",
      title: "Corporate Holiday Party",
      description: "Fortune 500 company needs entertainment for 200+ guests",
      clientName: "Ace Manufacturing",
      createdDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      urgency: "medium",
      clientId: "client-new-2"
    },
    {
      id: "contract-1",
      type: "overdue_contract",
      title: "Performance Contract - Unsigned",
      description: "Contract sent 2 weeks ago, no response from client",
      clientName: "Downtown Music Venue",
      projectName: "Monthly Jazz Nights",
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days overdue
      createdDate: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000),
      urgency: "critical",
      clientId: "client-3",
      projectId: "project-3"
    },
    {
      id: "invoice-1",
      type: "overdue_invoice",
      title: "Payment Overdue - Corporate Gig",
      description: "Invoice due 5 days ago, follow-up required",
      clientName: "Tech Solutions Inc.",
      projectName: "Annual Conference",
      amount: 2500,
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
      createdDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      urgency: "critical",
      clientId: "client-4",
      projectId: "project-4"
    },
    {
      id: "todo-1",
      type: "todo",
      title: "Update equipment list for spring bookings",
      description: "Review and update gear inventory for upcoming season",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      createdDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      urgency: "medium"
    },
    {
      id: "approval-1",
      type: "approval_needed",
      title: "Quote Approval Required",
      description: "High-value quote needs manager approval before sending",
      clientName: "The Grand Ballroom",
      projectName: "New Year's Eve Gala",
      amount: 15000,
      createdDate: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      urgency: "high",
      clientId: "client-6",
      projectId: "project-6"
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quote_opened': return <FileText className="h-3 w-3 text-blue-500" />;
      case 'contract_viewed': return <FileText className="h-3 w-3 text-green-500" />;
      case 'invoice_paid': return <CreditCard className="h-3 w-3 text-emerald-500" />;
      case 'questionnaire_completed': return <User className="h-3 w-3 text-purple-500" />;
      case 'email_replied': return <Mail className="h-3 w-3 text-orange-500" />;
      case 'new_lead': return <UserPlus className="h-3 w-3 text-blue-500" />;
      case 'overdue_contract': return <FileX className="h-3 w-3 text-red-500" />;
      case 'overdue_invoice': return <DollarSign className="h-3 w-3 text-red-500" />;
      case 'todo': return <CheckSquare className="h-3 w-3 text-green-500" />;
      case 'approval_needed': return <AlertTriangle className="h-3 w-3 text-orange-500" />;
      default: return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const getActivityBadge = (type: string) => {
    const badgeClass = "text-xs px-1.5 py-0.5";
    switch (type) {
      case 'quote_opened': return <Badge variant="secondary" className={`${badgeClass} bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300`}>Quote</Badge>;
      case 'contract_viewed': return <Badge variant="secondary" className={`${badgeClass} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`}>Contract</Badge>;
      case 'invoice_paid': return <Badge variant="secondary" className={`${badgeClass} bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300`}>Payment</Badge>;
      case 'questionnaire_completed': return <Badge variant="secondary" className={`${badgeClass} bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300`}>Form</Badge>;
      case 'email_replied': return <Badge variant="secondary" className={`${badgeClass} bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300`}>Email</Badge>;
      case 'new_lead': return <Badge variant="secondary" className={`${badgeClass} bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300`}>Lead</Badge>;
      case 'overdue_contract': return <Badge variant="destructive" className={`${badgeClass}`}>Overdue</Badge>;
      case 'overdue_invoice': return <Badge variant="destructive" className={`${badgeClass}`}>Overdue</Badge>;
      case 'todo': return <Badge variant="secondary" className={`${badgeClass} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`}>Todo</Badge>;
      case 'approval_needed': return <Badge variant="secondary" className={`${badgeClass} bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300`}>Approval</Badge>;
      default: return <Badge variant="outline" className={badgeClass}>Activity</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    const badgeClass = "text-xs px-1.5 py-0.5";
    switch (urgency) {
      case 'critical': return <Badge variant="destructive" className={badgeClass}>Critical</Badge>;
      case 'high': return <Badge variant="destructive" className={`${badgeClass} bg-orange-500 hover:bg-orange-600`}>High</Badge>;
      case 'medium': return <Badge variant="secondary" className={`${badgeClass} bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300`}>Medium</Badge>;
      case 'low': return <Badge variant="outline" className={badgeClass}>Low</Badge>;
      default: return <Badge variant="outline" className={badgeClass}>{urgency}</Badge>;
    }
  };

  const handleItemClick = (clientId?: string, projectId?: string, id?: string) => {
    if (clientId && projectId) {
      console.log(`Navigate to project ${projectId} for client ${clientId}`);
    } else if (clientId) {
      console.log(`Navigate to client ${clientId}`);
    } else {
      console.log(`Navigate to item ${id}`);
    }
  };

  const renderClientActivities = () => (
    <div className="space-y-2">
      {recentActivities.slice(0, 6).map((activity) => (
        <div
          key={activity.id}
          className="flex items-start gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
          data-testid={`activity-item-${activity.id}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getActivityIcon(activity.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <button
                onClick={() => handleItemClick(activity.clientId, activity.projectId)}
                className="font-medium text-xs text-foreground hover:text-primary hover:underline cursor-pointer truncate"
                data-testid={`client-name-${activity.id}`}
              >
                {activity.clientName}
              </button>
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
              {getActivityBadge(activity.type)}
            </div>
            
            <div className="text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{activity.projectName}</span>
              {activity.documentTitle && (
                <span className="block truncate"> • {activity.documentTitle}</span>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              {activity.description}
            </div>
          </div>
          
          <div className="flex-shrink-0 text-xs text-muted-foreground">
            <div>{format(activity.timestamp, 'MMM d')}</div>
            <div className="text-2xs">{format(activity.timestamp, 'h:mm a')}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBusinessPriorities = () => (
    <div className="space-y-2">
      {businessPriorities.slice(0, 6).map((item) => (
        <div
          key={item.id}
          className="p-2 rounded-md border bg-card hover:bg-muted/30 transition-colors cursor-pointer text-sm"
          onClick={() => handleItemClick(item.clientId, item.projectId, item.id)}
          data-testid={`business-item-${item.id}`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {getActivityIcon(item.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <h4 className="font-medium text-xs text-foreground truncate">
                  {item.title}
                </h4>
                {getUrgencyBadge(item.urgency)}
              </div>
              
              <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                {item.description}
              </p>
              
              <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                {item.clientName && (
                  <span className="flex items-center gap-1 truncate">
                    <span className="font-medium text-foreground">{item.clientName}</span>
                    {item.projectName && <span>• {item.projectName}</span>}
                    <ExternalLink className="h-2 w-2 flex-shrink-0" />
                  </span>
                )}
                {item.amount && (
                  <span className="font-medium text-green-600">
                    ${item.amount.toLocaleString()}
                  </span>
                )}
                {item.dueDate && (
                  <span className={isAfter(new Date(), item.dueDate) ? 'text-red-600 font-medium' : ''}>
                    Due: {format(item.dueDate, 'MMM d')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 text-xs text-muted-foreground">
              <div>{format(item.createdDate, 'MMM d')}</div>
              <div className="text-2xs">{format(item.createdDate, 'h:mm a')}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card data-testid="combined-business-activity-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-4 w-4" />
            Let's Take Care of Business
            <Badge variant="secondary" className="ml-2 text-xs">
              {businessPriorities.length + recentActivities.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" data-testid="button-view-all-activity">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="priorities" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="priorities" className="text-xs">Business Priorities ({businessPriorities.length})</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Recent Activity ({recentActivities.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="priorities" className="mt-3">
            {renderBusinessPriorities()}
          </TabsContent>
          
          <TabsContent value="activity" className="mt-3">
            {renderClientActivities()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}