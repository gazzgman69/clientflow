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
  Briefcase
} from "lucide-react";
import { formatDistanceToNow, format, isAfter } from "date-fns";

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

export default function BusinessPriorities() {
  // Mock business priority items - in real app, this would come from API
  const businessPriorities: BusinessPriority[] = [
    // New Leads
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
    
    // Overdue Documents
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
    
    // To-dos
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
      id: "todo-2",
      type: "todo", 
      title: "Schedule venue walkthrough",
      description: "Visit new wedding venue before next Saturday's event",
      clientName: "Sarah & David Johnson",
      projectName: "June Wedding",
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
      createdDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      urgency: "high",
      clientId: "client-5",
      projectId: "project-5"
    },
    
    // Workflow Approvals
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
    },
    {
      id: "approval-2",
      type: "approval_needed",
      title: "Contract Amendment Review",
      description: "Client requested changes to standard performance contract",
      clientName: "Restaurant & Lounge",
      projectName: "Weekly Live Music",
      createdDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      urgency: "medium",
      clientId: "client-7", 
      projectId: "project-7"
    }
  ];

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'new_lead': return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'overdue_contract': return <FileX className="h-4 w-4 text-red-500" />;
      case 'overdue_invoice': return <DollarSign className="h-4 w-4 text-red-500" />;
      case 'todo': return <CheckSquare className="h-4 w-4 text-green-500" />;
      case 'approval_needed': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'high': return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
      default: return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  const getItemsByType = (type: string) => {
    return businessPriorities.filter(item => item.type === type)
      .sort((a, b) => {
        const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      });
  };

  const handleItemClick = (item: BusinessPriority) => {
    if (item.clientId && item.projectId) {
      console.log(`Navigate to project ${item.projectId} for client ${item.clientId}`);
    } else if (item.clientId) {
      console.log(`Navigate to client ${item.clientId}`);
    } else {
      console.log(`Navigate to ${item.type} item ${item.id}`);
    }
  };

  const newLeads = getItemsByType('new_lead');
  const overdueItems = [...getItemsByType('overdue_contract'), ...getItemsByType('overdue_invoice')];
  const todos = getItemsByType('todo');
  const approvals = getItemsByType('approval_needed');

  const renderItemsList = (items: BusinessPriority[]) => (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => handleItemClick(item)}
          data-testid={`business-item-${item.id}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getItemIcon(item.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-foreground truncate">
                  {item.title}
                </h4>
                {getUrgencyBadge(item.urgency)}
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {item.description}
              </p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {item.clientName && (
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-foreground">{item.clientName}</span>
                    {item.projectName && <span>• {item.projectName}</span>}
                    <ExternalLink className="h-3 w-3" />
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
                <span>
                  {formatDistanceToNow(item.createdDate, { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card data-testid="business-priorities-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Let's Take Care of Business
          <Badge variant="secondary" className="ml-2">
            {businessPriorities.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({businessPriorities.length})</TabsTrigger>
            <TabsTrigger value="leads">Leads ({newLeads.length})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({overdueItems.length})</TabsTrigger>
            <TabsTrigger value="todos">To-dos ({todos.length})</TabsTrigger>
            <TabsTrigger value="approvals">Approvals ({approvals.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-4">
            {renderItemsList(businessPriorities)}
          </TabsContent>
          
          <TabsContent value="leads" className="mt-4">
            {newLeads.length > 0 ? renderItemsList(newLeads) : (
              <div className="text-center text-muted-foreground py-8">
                No new leads to review
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="overdue" className="mt-4">
            {overdueItems.length > 0 ? renderItemsList(overdueItems) : (
              <div className="text-center text-muted-foreground py-8">
                No overdue items
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="todos" className="mt-4">
            {todos.length > 0 ? renderItemsList(todos) : (
              <div className="text-center text-muted-foreground py-8">
                No pending to-dos
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="approvals" className="mt-4">
            {approvals.length > 0 ? renderItemsList(approvals) : (
              <div className="text-center text-muted-foreground py-8">
                No items requiring approval
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}