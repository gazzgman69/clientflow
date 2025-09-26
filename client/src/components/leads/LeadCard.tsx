import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Trash2 } from "lucide-react";
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
  conflictDetails?: { count: number; projectIds: string[] };
}

interface LeadCardProps {
  lead: LeadCardDTO;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, leadId: string) => void;
  onDelete?: (leadId: string) => void;
  highlightFlash?: boolean;
}

export default function LeadCard({ lead, onClick, draggable = false, onDragStart, onDelete, highlightFlash = false }: LeadCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'contacted': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'qualified': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const conflictTooltip = lead.conflictDetails ? 
    `Date conflict with ${lead.conflictDetails.count} project${lead.conflictDetails.count > 1 ? 's' : ''}. ${lead.conflictDetails.projectIds.map(id => '/projects/' + id).join(' ')}` : 
    'Date conflict';

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        highlightFlash ? 'animate-[pulse_1.5s_ease-out_1] bg-amber-50 dark:bg-amber-900' : ''
      }`}
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
          <h3 
            className="font-medium text-sm text-gray-900 dark:text-white"
            data-testid={`lead-card-name-${lead.id}`}
          >
            {lead.contactName}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {lead.hasConflict && (
            <Badge 
              variant="destructive" 
              className="text-xs cursor-pointer" 
              title={conflictTooltip}
              onClick={(e) => {
                e.stopPropagation();
                if (lead.conflictDetails?.projectIds?.[0]) {
                  // Use Link component for internal navigation instead of window.open
                  window.location.href = `/projects/${lead.conflictDetails.projectIds[0]}`;
                }
              }}
            >
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

      {/* Venue/Location */}
      <div className="text-xs text-muted-foreground mb-3">
        <span className="font-medium">Venue:</span> {lead.projectTitle || 'Not specified'}
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