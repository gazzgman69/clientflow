import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, FileText, Send, CalendarPlus } from "lucide-react";

export default function QuickActions() {
  const quickActions = [
    {
      icon: UserPlus,
      label: "Add Lead",
      color: "text-primary",
      testId: "quick-action-add-lead"
    },
    {
      icon: FileText,
      label: "Create Quote",
      color: "text-accent",
      testId: "quick-action-create-quote"
    },
    {
      icon: Send,
      label: "Send Invoice",
      color: "text-green-600",
      testId: "quick-action-send-invoice"
    },
    {
      icon: CalendarPlus,
      label: "Schedule Call",
      color: "text-blue-600",
      testId: "quick-action-schedule-call"
    },
  ];

  return (
    <Card data-testid="quick-actions-card">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant="outline"
                className="h-auto flex flex-col items-center p-4 hover:bg-muted/50 transition-colors"
                data-testid={action.testId}
              >
                <Icon className={`${action.color} h-6 w-6 mb-2`} />
                <span className="text-sm font-medium text-foreground">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
