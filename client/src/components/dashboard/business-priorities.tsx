import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileX,
  DollarSign,
  CheckSquare,
  ExternalLink,
  Briefcase,
  CheckCircle2,
} from "lucide-react";
import { format, isAfter } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/currency";

interface BusinessPriority {
  id: string;
  type: "overdue_contract" | "overdue_invoice" | "todo" | "new_lead";
  title: string;
  description: string;
  clientName?: string;
  projectName?: string;
  amount?: number;
  dueDate?: string;
  createdDate: string;
  urgency: "low" | "medium" | "high" | "critical";
  contactId?: string;
  projectId?: string;
}

export default function BusinessPriorities() {
  const [, setLocation] = useLocation();

  const { data: priorities = [], isLoading } = useQuery<BusinessPriority[]>({
    queryKey: ["/api/dashboard/business-priorities"],
  });

  const getItemIcon = (type: string) => {
    switch (type) {
      case "overdue_contract":
        return <FileX className="h-4 w-4 text-red-500" />;
      case "overdue_invoice":
        return <DollarSign className="h-4 w-4 text-red-500" />;
      case "todo":
        return <CheckSquare className="h-4 w-4 text-blue-500" />;
      default:
        return <Briefcase className="h-4 w-4 text-gray-500" />;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return (
          <Badge className="bg-orange-500 text-white hover:bg-orange-600">High</Badge>
        );
      case "medium":
        return (
          <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>
        );
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const handleClick = (item: BusinessPriority) => {
    if (item.type === "todo" && item.projectId) {
      setLocation(`/projects/${item.projectId}`);
    } else if (item.contactId) {
      setLocation(`/contacts/${item.contactId}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Let's Take Care of Business
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="business-priorities-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Let's Take Care of Business
            {priorities.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {priorities.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")}>
            All Projects
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {priorities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mb-3 text-green-400" />
            <p className="font-medium text-foreground">You're on top of it!</p>
            <p className="text-sm mt-1">No overdue tasks or urgent items right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {priorities.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleClick(item)}
                data-testid={`business-item-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">{getItemIcon(item.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-foreground text-sm truncate">
                        {item.title}
                      </span>
                      {getUrgencyBadge(item.urgency)}
                    </div>

                    <p className="text-sm text-muted-foreground mb-1">{item.description}</p>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {item.clientName && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-foreground">{item.clientName}</span>
                          {item.projectName && <span>· {item.projectName}</span>}
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                      {item.amount && (
                        <span className="font-medium text-green-600">
                          {formatCurrency(item.amount, 'GBP')}
                        </span>
                      )}
                      {item.dueDate && (
                        <span
                          className={
                            isAfter(new Date(), new Date(item.dueDate))
                              ? "text-red-600 font-medium"
                              : ""
                          }
                        >
                          Due: {format(new Date(item.dueDate), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
