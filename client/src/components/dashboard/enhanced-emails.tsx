import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  MailOpen, 
  Reply, 
  Forward, 
  Paperclip, 
  ExternalLink,
  Clock,
  User
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

interface EmailItem {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  body: string;
  receivedAt: Date;
  isRead: boolean;
  hasAttachments: boolean;
  projectName: string;
  clientName: string;
  projectId: string;
  clientId: string;
  priority: 'low' | 'medium' | 'high';
  labels: string[];
}

export default function EnhancedEmails() {
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  // Mock recent emails - in real app, this would come from API
  const recentEmails: EmailItem[] = [
    {
      id: "email-1",
      subject: "Urgent: Last minute changes to setlist",
      fromEmail: "sarah@weddingplanners.com", 
      fromName: "Sarah Johnson",
      toEmail: "band@musicpro.com",
      body: "Hi there,\n\nI hope this email finds you well. We have some last-minute changes to discuss for the wedding reception this Saturday.\n\nThe bride would like to add 'Perfect' by Ed Sheeran to the list and remove 'Sweet Caroline' from the playlist. Also, could you please arrive 30 minutes earlier for a quick sound check?\n\nPlease confirm if these changes are possible.\n\nBest regards,\nSarah Johnson\nWedding Planner\nDream Weddings Inc.",
      receivedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      isRead: false,
      hasAttachments: false,
      projectName: "June Wedding Reception",
      clientName: "Sarah & David Johnson",
      projectId: "project-1",
      clientId: "client-1",
      priority: "high",
      labels: ["urgent", "wedding"]
    },
    {
      id: "email-2",
      subject: "Payment confirmation and receipt",
      fromEmail: "accounting@grandhotel.com",
      fromName: "Grand Hotel Accounting",
      toEmail: "band@musicpro.com", 
      body: "Dear Music Pro Band,\n\nThank you for the excellent performance at our New Year's Eve Gala. Payment has been processed as follows:\n\nAmount: $5,000.00\nTransaction ID: GH-NYE-2024-001\nDate: January 2, 2024\n\nAttached is your receipt and tax documentation.\n\nWe look forward to working with you again!\n\nBest regards,\nAccounting Department\nThe Grand Hotel",
      receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      isRead: true,
      hasAttachments: true,
      projectName: "New Year's Eve Gala",
      clientName: "The Grand Hotel",
      projectId: "project-2",
      clientId: "client-2",
      priority: "medium",
      labels: ["payment", "receipt"]
    },
    {
      id: "email-3", 
      subject: "Re: Venue requirements and technical specs",
      fromEmail: "mike@corpcorp.com",
      fromName: "Mike Thompson",
      toEmail: "band@musicpro.com",
      body: "Thanks for sending the technical requirements!\n\nEverything looks good on our end. The venue has:\n- Full PA system with wireless mics\n- Stage lighting (you mentioned you'd bring your own anyway)\n- Loading dock access for equipment\n- Dedicated dressing room\n\nLoad-in can start at 5 PM, event starts at 7 PM. Will there be anything else you need from us?\n\nMike Thompson\nEvent Coordinator\nCorp Corp Inc.",
      receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      isRead: true,
      hasAttachments: false,
      projectName: "Corporate Holiday Party",
      clientName: "Corp Corp Inc.",
      projectId: "project-3", 
      clientId: "client-3",
      priority: "medium",
      labels: ["venue", "technical"]
    },
    {
      id: "email-4",
      subject: "Contract signed and returned",
      fromEmail: "jennifer@anniversaryparty.com",
      fromName: "Jennifer Davis",
      toEmail: "band@musicpro.com",
      body: "Hello,\n\nI've signed and returned the performance contract via email. Everything looks perfect!\n\nJust a couple of final questions:\n1. What time should we expect you to arrive for setup?\n2. Do you need any specific refreshments during the event?\n3. Is there a contact number for day-of coordination?\n\nLooking forward to celebrating our 25th anniversary with your music!\n\nJennifer Davis",
      receivedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      isRead: false,
      hasAttachments: true,
      projectName: "25th Anniversary Party",
      clientName: "Jennifer & Robert Davis",
      projectId: "project-4",
      clientId: "client-4", 
      priority: "medium",
      labels: ["contract", "questions"]
    },
    {
      id: "email-5",
      subject: "Booking inquiry - Summer wedding",
      fromEmail: "emily@beachresort.com",
      fromName: "Emily Richards",
      toEmail: "band@musicpro.com",
      body: "Dear Music Pro Band,\n\nI came across your website and would love to discuss your services for a beach wedding.\n\nEvent Details:\n- Date: July 15, 2024\n- Time: 5:00 PM ceremony, 6:00 PM reception\n- Location: Oceanfront Resort, Pacific Coast\n- Guests: ~150 people\n- Style: Acoustic ceremony, full band reception\n\nCould you please send over your availability and pricing?\n\nThank you!\nEmily Richards\nBride-to-be",
      receivedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      isRead: false,
      hasAttachments: false,
      projectName: "Summer Beach Wedding (Inquiry)",
      clientName: "Emily Richards",
      projectId: "project-5",
      clientId: "client-5",
      priority: "high",
      labels: ["inquiry", "wedding", "new-lead"]
    },
    {
      id: "email-6",
      subject: "Monthly performance schedule",
      fromEmail: "manager@musicclub.com",
      fromName: "Downtown Music Club",
      toEmail: "band@musicpro.com",
      body: "Hey team,\n\nHere's the performance schedule for this month:\n\nJan 12: Jazz Night (7-10 PM)\nJan 19: Blues Session (8-11 PM)\nJan 26: Open Mic Host (6-9 PM)\n\nLet me know if you need any changes or have conflicts.\n\nCheers,\nClub Manager\nDowntown Music Club",
      receivedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      isRead: true,
      hasAttachments: false,
      projectName: "Monthly Residency",
      clientName: "Downtown Music Club",
      projectId: "project-6",
      clientId: "client-6",
      priority: "low",
      labels: ["schedule", "regular-gig"]
    },
    {
      id: "email-7",
      subject: "Event feedback and future bookings",
      fromEmail: "events@restaurant.com",
      fromName: "Restaurant & Bar Events",
      toEmail: "band@musicpro.com",
      body: "Hi Music Pro Band,\n\nI wanted to follow up on last week's performance. The feedback from guests was overwhelmingly positive!\n\nWe'd love to book you for our upcoming events:\n- Valentine's Day Special (Feb 14)\n- St. Patrick's Day Celebration (Mar 17)\n- Easter Brunch (Mar 31)\n\nWould you be interested in discussing these opportunities?\n\nBest,\nEvents Team\nRestaurant & Bar",
      receivedAt: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18 hours ago
      isRead: true,
      hasAttachments: false,
      projectName: "Weekly Live Music",
      clientName: "Restaurant & Bar",
      projectId: "project-7",
      clientId: "client-7",
      priority: "medium",
      labels: ["feedback", "future-bookings"]
    }
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="bg-red-500">High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const handleProjectClick = (projectId: string, clientId: string) => {
    console.log(`Navigate to project ${projectId} for client ${clientId}`);
  };

  const handleEmailClick = (email: EmailItem) => {
    setSelectedEmail(email);
  };

  // Sort emails by received date (most recent first)
  const sortedEmails = [...recentEmails].sort((a, b) => 
    b.receivedAt.getTime() - a.receivedAt.getTime()
  );

  return (
    <Card data-testid="enhanced-emails-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Recent Emails
            <Badge variant="secondary" className="ml-2">
              {recentEmails.filter(e => !e.isRead).length} unread
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-view-all-emails">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3 pr-4">
            {sortedEmails.map((email) => (
              <div
                key={email.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                  !email.isRead ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-card'
                }`}
                onClick={() => handleEmailClick(email)}
                data-testid={`email-item-${email.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {email.isRead ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={`font-medium truncate ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {email.subject}
                      </h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {email.hasAttachments && (
                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                        )}
                        {getPriorityBadge(email.priority)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <span className="text-muted-foreground">From:</span>
                      <span className="font-medium text-foreground">{email.fromName}</span>
                      <span className="text-muted-foreground">•</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProjectClick(email.projectId, email.clientId);
                        }}
                        className="text-primary hover:underline flex items-center gap-1"
                        data-testid={`project-link-${email.id}`}
                      >
                        {email.projectName}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {email.body.substring(0, 120)}...
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(email.receivedAt, { addSuffix: true })}
                      </div>
                      <div className="text-xs">
                        {format(email.receivedAt, 'MMM d, h:mm a')}
                      </div>
                    </div>
                    
                    {email.labels.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {email.labels.slice(0, 3).map((label, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Email Detail Modal */}
        <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            {selectedEmail && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span className="truncate">{selectedEmail.subject}</span>
                    <div className="flex items-center gap-2">
                      {selectedEmail.hasAttachments && (
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      )}
                      {getPriorityBadge(selectedEmail.priority)}
                    </div>
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedEmail.fromName}</span>
                        <span className="text-muted-foreground">
                          &lt;{selectedEmail.fromEmail}&gt;
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        To: {selectedEmail.toEmail}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(selectedEmail.receivedAt, 'EEEE, MMMM d, yyyy \'at\' h:mm a')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Reply className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                      <Button variant="outline" size="sm">
                        <Forward className="h-4 w-4 mr-2" />
                        Forward
                      </Button>
                    </div>
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm">
                      {selectedEmail.body}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Project:</span>
                      <button
                        onClick={() => handleProjectClick(selectedEmail.projectId, selectedEmail.clientId)}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {selectedEmail.projectName}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                    {selectedEmail.labels.length > 0 && (
                      <div className="flex gap-1">
                        {selectedEmail.labels.map((label, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}