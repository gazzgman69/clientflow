import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Phone, Building, MapPin, Calendar, ExternalLink, Folder } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "wouter";

interface ContactPreviewPopupProps {
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Contact {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  tags?: string[];
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  venueAddress?: string;
  venueCity?: string;
  venueState?: string;
  venueZipCode?: string;
  venueName?: string;
  createdAt: string;
  eventDate?: string;
  projectsCount?: number;
}

interface Project {
  id: string;
  name: string;
  status: string;
  eventDate: string | null;
  eventLocation: string | null;
}

export function ContactPreviewPopup({ contactId, open, onOpenChange }: ContactPreviewPopupProps) {
  const { data: contact, isLoading: contactLoading } = useQuery<Contact>({
    queryKey: ["/api/contacts", contactId],
    enabled: open && !!contactId,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/contacts", contactId, "projects"],
    enabled: open && !!contactId,
  });

  if (!open) return null;

  const displayName = contact?.fullName || `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || 'Contact';
  const contactAddress = [contact?.address, contact?.city, contact?.state, contact?.zipCode]
    .filter(Boolean)
    .join(', ');
  const venueAddressFull = [contact?.venueAddress, contact?.venueCity, contact?.venueState, contact?.venueZipCode]
    .filter(Boolean)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="dialog-contact-preview">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <Link href={`/contacts/${contactId}`}>
              <button
                className="text-xl font-semibold hover:text-primary transition-colors"
                onClick={() => onOpenChange(false)}
                data-testid="link-contact-name"
              >
                {contactLoading ? <Skeleton className="h-6 w-48" /> : displayName}
              </button>
            </Link>
            {contact?.projectsCount !== undefined && (
              <Badge variant="secondary" data-testid="badge-projects-count">
                {contact.projectsCount} {contact.projectsCount === 1 ? 'Project' : 'Projects'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {contactLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Contact Information */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact Info</h3>
                <div className="space-y-2">
                  {contact?.email && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-email">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                    </div>
                  )}
                  {contact?.phone && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-phone">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                    </div>
                  )}
                  {contact?.company && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-company">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.company}</span>
                    </div>
                  )}
                  {contactAddress && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-address">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{contactAddress}</span>
                    </div>
                  )}
                  {contact?.eventDate && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-event-date">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Event: {format(new Date(contact.eventDate), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Venue Information */}
              {(contact?.venueName || venueAddressFull) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Venue</h3>
                  <div className="space-y-2">
                    {contact?.venueName && (
                      <div className="flex items-center gap-2 text-sm" data-testid="text-venue-name">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{contact.venueName}</span>
                      </div>
                    )}
                    {venueAddressFull && (
                      <div className="flex items-center gap-2 text-sm" data-testid="text-venue-address">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{venueAddressFull}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {contact?.tags && contact.tags.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <Badge key={tag} variant="outline" data-testid={`badge-tag-${tag}`}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects List */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  Projects ({projects.length})
                </h3>
                {projectsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-projects">
                    No projects found for this contact
                  </p>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <Link key={project.id} href={`/projects/${project.id}`}>
                        <button
                          onClick={() => onOpenChange(false)}
                          className="w-full p-3 border rounded-lg hover:bg-accent transition-colors text-left group"
                          data-testid={`button-project-${project.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                                  {project.name}
                                </h4>
                                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {project.status && (
                                  <Badge variant="outline" className="text-xs" data-testid={`badge-status-${project.id}`}>
                                    {project.status}
                                  </Badge>
                                )}
                                {project.eventDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(project.eventDate), 'MMM d, yyyy')}
                                  </span>
                                )}
                              </div>
                              {project.eventLocation && (
                                <p className="text-xs text-muted-foreground mt-1 truncate" data-testid={`text-location-${project.id}`}>
                                  {project.eventLocation}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close">
            Close
          </Button>
          <Link href={`/contacts/${contactId}`}>
            <Button onClick={() => onOpenChange(false)} data-testid="button-view-details">
              View Full Details
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
