import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Mail,
  CreditCard,
  User,
  Clock,
  FileCheck,
  FileSignature,
  PenLine,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface ActivityItem {
  id: string;
  type: string;
  clientName: string;
  projectName?: string | null;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  timestamp: string;
  contactId?: string | null;
  projectId?: string | null;
}

function getActivityIcon(type: string) {
  if (type.includes("invoice") || type.includes("payment")) return <CreditCard className="h-4 w-4 text-emerald-500" />;
  if (type.includes("contract") && type.includes("sign")) return <FileSignature className="h-4 w-4 text-green-500" />;
  if (type.includes("contract")) return <FileCheck className="h-4 w-4 text-blue-500" />;
  if (type.includes("quote")) return <FileText className="h-4 w-4 text-blue-500" />;
  if (type.includes("email") || type.includes("message")) return <Mail className="h-4 w-4 text-orange-500" />;
  if (type.includes("note")) return <PenLine className="h-4 w-4 text-yellow-500" />;
  if (type.includes("project")) return <Clock className="h-4 w-4 text-indigo-500" />;
  if (type.includes("contact") || type.includes("client")) return <User className="h-4 w-4 text-purple-500" />;
  return <Activity className="h-4 w-4 text-gray-400" />;
}

function getActivityBadge(type: string) {
  if (type.includes("invoice") || type.includes("payment"))
    return <Badge className="bg-emerald-100 text-emerald-700 text-xs">Payment</Badge>;
  if (type.includes("contract") && type.includes("sign"))
    return <Badge className="bg-green-100 text-green-700 text-xs">Signed</Badge>;
  if (type.includes("contract"))
    return <Badge className="bg-blue-100 text-blue-700 text-xs">Contract</Badge>;
  if (type.includes("quote"))
    return <Badge className="bg-blue-100 text-blue-700 text-xs">Quote</Badge>;
  if (type.includes("email") || type.includes("message"))
    return <Badge className="bg-orange-100 text-orange-700 text-xs">Email</Badge>;
  if (type.includes("note"))
    return <Badge className="bg-yellow-100 text-yellow-700 text-xs">Note</Badge>;
  if (type.includes("project"))
    return <Badge className="bg-indigo-100 text-indigo-700 text-xs">Project</Badge>;
  return <Badge variant="outline" className="text-xs">Activity</Badge>;
}

function formatDescription(description: string): string {
  // Make descriptions more readable
  return description
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RecentClientActivity() {
  const [, setLocation] = useLocation();

  const { data: activities = [], isLoading, isError } = useQuery<ActivityItem[]>({
    queryKey: ["/api/dashboard/client-activity"],
  });

  const handleClick = (activity: ActivityItem) => {
    if (activity.projectId) {
      setLocation(`/projects/${activity.projectId}`);
    } else if (activity.contactId) {
      setLocation(`/contacts/${activity.contactId}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Could not load recent activity. Please refresh.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="recent-client-activity-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation('/projects')}>
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Activity className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No activity yet</p>
            <p className="text-sm mt-1">Actions like sending quotes and contracts will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 10).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors cursor-pointer"
                onClick={() => handleClick(activity)}
                data-testid={`activity-item-${activity.id}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-medium text-sm text-foreground">
                      {activity.clientName !== "Unknown Client" ? activity.clientName : "System"}
                    </span>
                    {getActivityBadge(activity.type)}
                  </div>

                  <p className="text-sm text-muted-foreground leading-snug">
                    {formatDescription(activity.description)}
                    {activity.projectName && (
                      <span className="text-foreground/70"> · {activity.projectName}</span>
                    )}
                  </p>
                </div>

                <div className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
