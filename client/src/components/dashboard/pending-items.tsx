import { useState } from "react";
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
  ChevronDown,
  ChevronRight,
  FilePen,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface PendingItem {
  id: string;
  type: "invoice" | "contract" | "enquiry" | "quote";
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

interface Group {
  key: string;
  label: string;
  items: PendingItem[];
  accentColor: string;   // left border + icon bg
  headerColor: string;   // header row bg
  countColor: string;    // badge color
}

function buildGroups(items: PendingItem[]): Group[] {
  const enquiries   = items.filter(i => i.type === "enquiry");
  const overdueInv  = items.filter(i => i.type === "invoice"  && i.isOverdue);
  const overdueCtx  = items.filter(i => i.type === "contract" && i.isOverdue);
  const pendingInv  = items.filter(i => i.type === "invoice"  && !i.isOverdue);
  const pendingCtx  = items.filter(i => i.type === "contract" && !i.isOverdue);
  const pendingQts  = items.filter(i => i.type === "quote");

  const groups: Group[] = [
    {
      key: "enquiries",
      label: "New Enquiries",
      items: enquiries,
      accentColor: "border-l-purple-400",
      headerColor: "bg-purple-50 dark:bg-purple-900/20",
      countColor: "bg-purple-100 text-purple-700",
    },
    {
      key: "overdue-invoices",
      label: "Overdue Invoices",
      items: overdueInv,
      accentColor: "border-l-red-500",
      headerColor: "bg-red-50 dark:bg-red-900/20",
      countColor: "bg-red-100 text-red-700",
    },
    {
      key: "overdue-contracts",
      label: "Overdue Contracts",
      items: overdueCtx,
      accentColor: "border-l-red-400",
      headerColor: "bg-red-50 dark:bg-red-900/20",
      countColor: "bg-red-100 text-red-700",
    },
    {
      key: "pending-quotes",
      label: "Awaiting Approval",
      items: pendingQts,
      accentColor: "border-l-amber-400",
      headerColor: "bg-amber-50 dark:bg-amber-900/20",
      countColor: "bg-amber-100 text-amber-700",
    },
    {
      key: "pending-invoices",
      label: "Awaiting Payment",
      items: pendingInv,
      accentColor: "border-l-emerald-400",
      headerColor: "bg-emerald-50 dark:bg-emerald-900/20",
      countColor: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "pending-contracts",
      label: "Awaiting Signature",
      items: pendingCtx,
      accentColor: "border-l-blue-400",
      headerColor: "bg-blue-50 dark:bg-blue-900/20",
      countColor: "bg-blue-100 text-blue-700",
    },
  ];

  return groups.filter(g => g.items.length > 0);
}

export default function PendingItems() {
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: pendingItems = [], isLoading } = useQuery<PendingItem[]>({
    queryKey: ["/api/dashboard/pending-items"],
  });

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "invoice":  return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case "contract": return <FileCheck   className="h-4 w-4 text-blue-500" />;
      case "enquiry":  return <Mail        className="h-4 w-4 text-purple-500" />;
      case "quote":    return <FilePen     className="h-4 w-4 text-amber-500" />;
      default:         return <FileText    className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (item: PendingItem) => {
    if (item.isOverdue)
      return (
        <Badge variant="destructive" className="flex items-center gap-1 text-xs">
          <AlertTriangle className="h-3 w-3" /> Overdue
        </Badge>
      );
    if (item.requiresCounterSignature)
      return (
        <Badge className="bg-amber-100 text-amber-700 text-xs flex items-center gap-1">
          <FileSignature className="h-3 w-3" /> Sign Required
        </Badge>
      );
    switch (item.type) {
      case "invoice":  return <Badge className="bg-amber-100  text-amber-700  text-xs">Awaiting Payment</Badge>;
      case "contract": return <Badge className="bg-blue-100   text-blue-700   text-xs">Awaiting Signature</Badge>;
      case "enquiry":  return <Badge className="bg-purple-100 text-purple-700 text-xs">New Enquiry</Badge>;
      case "quote":    return <Badge className="bg-amber-100  text-amber-700  text-xs">Awaiting Approval</Badge>;
      default:         return <Badge variant="outline" className="text-xs">{item.status}</Badge>;
    }
  };

  const handleItemClick = (item: PendingItem) => {
    if (item.type === "contract") {
      setLocation(`/contracts/${item.id}`);
    } else if (item.type === "invoice") {
      setLocation(item.projectId ? `/projects/${item.projectId}` : "/invoices");
    } else if (item.type === "enquiry") {
      // Go to the project if one exists, otherwise fall back to the contact
      setLocation(item.projectId ? `/projects/${item.projectId}` : `/contacts/${item.contactId}`);
    } else if (item.type === "quote") {
      setLocation(`/quotes/${item.id}`);
    } else {
      setLocation(`/contacts/${item.contactId}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Action Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const groups = buildGroups(pendingItems);

  return (
    <Card data-testid="pending-items-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Action Required
            {pendingItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingItems.length}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/invoices")}>
            View All
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mb-3 text-green-400" />
            <p className="font-medium text-foreground">All clear!</p>
            <p className="text-sm mt-1">No outstanding invoices, contracts, or enquiries.</p>
          </div>
        ) : (
          groups.map(group => {
            const isOpen = !collapsed[group.key];
            return (
              <div key={group.key} className={`rounded-lg border-l-4 overflow-hidden ${group.accentColor}`}>
                {/* Group header — click to collapse */}
                <button
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold transition-colors hover:brightness-95 ${group.headerColor}`}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2">
                    {isOpen
                      ? <ChevronDown  className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                    {group.label}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${group.countColor}`}>
                    {group.items.length}
                  </span>
                </button>

                {/* Group items */}
                {isOpen && (
                  <div className="divide-y divide-border/50">
                    {group.items.map(item => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => handleItemClick(item)}
                        data-testid={`pending-item-${item.id}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex-shrink-0 mt-0.5">{getItemIcon(item.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="font-medium text-foreground text-sm truncate">
                                {item.title}
                              </span>
                              {getStatusBadge(item)}
                            </div>
                            <p className="text-sm font-medium text-primary truncate">
                              {item.clientName}
                              {item.projectName &&
                                item.projectName !== "General Project" &&
                                item.projectName !== "No project yet" && (
                                  <span className="text-muted-foreground font-normal"> · {item.projectName}</span>
                                )}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
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
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
