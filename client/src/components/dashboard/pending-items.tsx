import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CreditCard,
  FileCheck,
  Clock,
  AlertTriangle,
  FileSignature,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface PendingItem {
  id: string;
  type: "invoice" | "contract" | "enquiry";
  title: string;
  clientName: string;
  projectName: string;
  sentDate: string;
  dueDate?: string;
  amount?: number;
  status: string;
  contactId: string;
  projectId?: string | null;
  isOverdue?: boolean;
  urgency: "low" | "medium" | "high";
  requiresCounterSignature?: boolean;
}

export default function PendingItems() {
  const [, setLocation] = useLocation();

  const { data: pendingItems = [], isLoading } = useQuery<PendingItem[]>({
    queryKey: ["/api/dashboard/pending-items"],
  });

  const getItemIcon = (type: string) => {
    switch (type) {
      case "invoice":
        return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case "contract":
        return <FileCheck className="h-4 w-4 text-blue-500" />;
      case "enquiry":
        return <Mail className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (item: PendingItem) => {
    if (item.isOverdue) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 text-xs">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </Badge>
      );
    }
    if (item.requiresCounterSignature) {
      return (
        <Badge className="bg-amber-100 text-amber-700 text-xs flex items-center gap-1">
          <FileSignature className="h-3 w-3" />
          Sign Required
        </Badge>
      );
    }
    switch (item.type) {
      case "invoice":
        return (
          <Badge className="bg-amber-100 text-amber-700 text-xs">Awaiting Payment</Badge>
        );
      case "contract":
        return (
          <Badge className="bg-blue-100 text-blue-700 text-xs">Awaiting Signature</Badge>
        );
      case "enquiry":
        return (
          <Badge className="bg-purple-100 text-purple-700 text-xs">New Enquiry</Badge>
        );
      default:
        return <Badge variant="outline" className="text-xs">{item.status}</Badge>;
    }
  };

  const getLeftBorderColor = (item: PendingItem) => {
    if (item.isOverdue) return "border-l-red-500 bg-red-50 dark:bg-red-900/10";
    if (item.requiresCounterSignature) return "border-l-amber-500 bg-amber-50 dark:bg-amber-900/10";
    if (item.type === "contract") return "border-l-blue-400 bg-blue-50/50 dark:bg-blue-900/10";
    if (item.type === "enquiry") return "border-l-purple-400 bg-purple-50/50 dark:bg-purple-900/10";
    return "border-l-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10";
  };

  const handleItemClick = (item: PendingItem) => {
    if (item.type === "contract") {
      setLocation(`/contracts/${item.id}`);
    } else if (item.type === "invoice") {
      if (item.projectId) {
        setLocation(`/projects/${item.projectId}`);
      } else {
        setLocation("/invoices");
      }
    } else if (item.type === "enquiry") {
      setLocation(`/contacts/${item.contactId}`);
    }
  };

  // Sort: overdue first, then by due date ascending
  const sorted = [...pendingItems].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Action Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="pending-items-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Action Required
            {pendingItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingItems.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/invoices")}>
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mb-3 text-green-400" />
            <p className="font-medium text-foreground">All clear!</p>
            <p className="text-sm mt-1">No outstanding invoices, contracts, or enquiries.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.slice(0, 8).map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className={`border-l-4 rounded-r-lg p-3 transition-colors hover:shadow-sm cursor-pointer ${getLeftBorderColor(item)}`}
                onClick={() => handleItemClick(item)}
                data-testid={`pending-item-${item.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">{getItemIcon(item.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-foreground text-sm truncate">
                        {item.title}
                      </span>
                      {getStatusBadge(item)}
                    </div>

                    <p className="text-sm font-medium text-primary truncate">
                      {item.clientName}
                      {item.projectName && item.projectName !== "General Project" && item.projectName !== "No project yet" && (
                        <span className="text-muted-foreground font-normal"> · {item.projectName}</span>
                      )}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {item.dueDate && (
                        <span className={item.isOverdue ? "text-red-600 font-semibold" : ""}>
                          Due: {format(new Date(item.dueDate), "MMM d, yyyy")}
                        </span>
                      )}
                      {item.amount !== undefined && item.amount > 0 && (
                        <span className="font-semibold text-foreground">
                          £{item.amount.toLocaleString()}
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
