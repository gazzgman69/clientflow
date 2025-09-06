import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, ExternalLink, Trash2 } from "lucide-react";
import { Link } from "wouter";

interface LeadCardDTO {
  id: string;
  contactName: string;
  email: string;
  phone: string;
  projectId: string | null;
  projectTitle: string | null;
  projectDateISO: string | null;
  source: string;
  createdAtISO: string;
  status: 'new' | 'contacted' | 'qualified' | 'archived';
  hasConflict: boolean;
}

interface LeadCardProps {
  lead: LeadCardDTO;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, leadId: string) => void;
  onDelete?: (leadId: string) => void;
}

export default function LeadCard({ lead, onClick, draggable = false, onDragStart, onDelete }: LeadCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className="bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, lead.id) : undefined}
      aria-grabbed={draggable ? 'false' : undefined}
      tabIndex={draggable ? 0 : undefined}
      data-testid={`lead-card-${lead.id}`}
    >
      {/* Header with name and conflict badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {lead.projectId ? (
            <Link href={`/projects/${lead.projectId}`}>
              <h3 
                className="font-medium text-sm hover:text-primary hover:underline cursor-pointer"
                data-testid={`lead-card-name-${lead.id}`}
              >
                {lead.contactName}
              </h3>
            </Link>
          ) : (
            <h3 
              className="font-medium text-sm"
              data-testid={`lead-card-name-${lead.id}`}
            >
              {lead.contactName}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lead.hasConflict && (
            <Badge variant="destructive" className="text-xs">
              Date conflict
            </Badge>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(lead.id);
              }}
              title="Delete Lead"
              data-testid={`delete-lead-${lead.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Project Date */}
      <div className="text-xs text-muted-foreground mb-2">
        <span className="font-medium">Event:</span> {formatDate(lead.projectDateISO)}
      </div>

      {/* Source */}
      <div className="text-xs text-muted-foreground mb-3">
        {lead.source}
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <Badge className={getStatusColor(lead.status)}>
          {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
        </Badge>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `mailto:${lead.email}`;
            }}
            title="Send Email"
            data-testid={`email-lead-${lead.id}`}
          >
            <Mail className="h-3 w-3" />
          </Button>
          {lead.projectId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
              }}
              title="View Project"
              data-testid={`view-project-${lead.id}`}
              asChild
            >
              <Link href={`/projects/${lead.projectId}`}>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Accessibility hint for draggable items */}
      {draggable && (
        <div className="sr-only">
          Press space or enter to grab this lead card for dragging
        </div>
      )}
    </div>
  );
}