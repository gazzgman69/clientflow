import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { EmailSummary } from "@/lib/types";

export default function EmailSummary() {
  // Mock email data for demonstration
  const emailData: EmailSummary = {
    unread: 5,
    sentToday: 12,
    pendingReplies: 3,
  };

  const recentEmails = [
    {
      id: "1",
      subject: "Re: Project Timeline",
      from: "Sarah Johnson"
    },
    {
      id: "2", 
      subject: "Contract Approval",
      from: "Emily Chen"
    }
  ];

  return (
    <Card data-testid="email-summary-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Email Summary</CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-open-email">
            Open Email
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Unread Messages</span>
            <span className="text-lg font-semibold text-foreground" data-testid="email-unread-count">
              {emailData.unread}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Sent Today</span>
            <span className="text-lg font-semibold text-foreground" data-testid="email-sent-count">
              {emailData.sentToday}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pending Replies</span>
            <span className="text-lg font-semibold text-foreground" data-testid="email-pending-count">
              {emailData.pendingReplies}
            </span>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-3">Recent Emails</h4>
          <div className="space-y-2">
            {recentEmails.map((email) => (
              <div key={email.id} className="text-sm" data-testid={`recent-email-${email.id}`}>
                <p className="font-medium text-foreground" data-testid={`email-subject-${email.id}`}>
                  {email.subject}
                </p>
                <p className="text-muted-foreground" data-testid={`email-from-${email.id}`}>
                  from {email.from}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
