import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, Mail, Phone, Building, MapPin, Calendar, Globe, Tag, ExternalLink, Folder
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Contact, Project } from "@shared/schema";
import { getDisplayName } from "@shared/utils/name-splitter";

interface ContactFieldDefinition {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  required: boolean;
  options: string[] | null;
  displayOrder: number;
}

interface ContactFieldValue {
  id: string;
  contactId: string;
  fieldDefinitionId: string;
  value: string;
}

export default function ContactDetail() {
  const [match, params] = useRoute("/contacts/:id");
  const [, setLocation] = useLocation();
  const contactId = params?.id;

  // Fetch contact data
  const { data: contact, isLoading: contactLoading } = useQuery<Contact>({
    queryKey: ["/api/contacts", contactId],
    enabled: !!contactId,
  });

  // Fetch projects for this contact
  const { data: contactProjects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/contacts", contactId, "projects"],
    enabled: !!contactId,
  });

  // Fetch custom field definitions
  const { data: fieldDefinitions = [] } = useQuery<ContactFieldDefinition[]>({
    queryKey: ["/api/contact-field-definitions"],
  });

  // Fetch custom field values for this contact
  const { data: fieldValues = [] } = useQuery<ContactFieldValue[]>({
    queryKey: ["/api/contacts", contactId, "field-values"],
    enabled: !!contactId,
  });

  if (!match || !contactId) {
    return null;
  }

  const displayName = contact ? getDisplayName(contact) : '';
  const contactAddress = [contact?.address, contact?.city, contact?.state, contact?.zipCode]
    .filter(Boolean)
    .join(', ');
  const venueAddressFull = [contact?.venueAddress, contact?.venueCity, contact?.venueState, contact?.venueZipCode]
    .filter(Boolean)
    .join(', ');

  // Create a map of field values by field definition ID
  const fieldValueMap = new Map(
    fieldValues.map(fv => [fv.fieldDefinitionId, fv.value])
  );

  return (
    <>
      <Header />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-6 px-4 max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setLocation("/contacts")}
              className="mb-4"
              data-testid="button-back-to-contacts"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contacts
            </Button>

            {contactLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-3xl font-bold" data-testid="contact-name">
                    {displayName}
                  </h1>
                  <Link href={`/contacts/${contactId}/edit`}>
                    <Button variant="outline" data-testid="button-edit-contact">
                      Edit Contact
                    </Button>
                  </Link>
                </div>
                {contact?.company && (
                  <p className="text-muted-foreground text-lg" data-testid="contact-company">
                    {contact.company}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Contact Information Card */}
            <div className="lg:col-span-2 space-y-6">
              <Card data-testid="card-contact-info">
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                  {contactLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {contact?.email && (
                        <div className="flex items-center gap-3" data-testid="contact-email">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Email</p>
                            <a href={`mailto:${contact.email}`} className="hover:underline">
                              {contact.email}
                            </a>
                          </div>
                        </div>
                      )}

                      {contact?.phone && (
                        <div className="flex items-center gap-3" data-testid="contact-phone">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Phone</p>
                            <a href={`tel:${contact.phone}`} className="hover:underline">
                              {contact.phone}
                            </a>
                          </div>
                        </div>
                      )}

                      {contact?.company && (
                        <div className="flex items-center gap-3" data-testid="contact-company-detail">
                          <Building className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Company</p>
                            <p>{contact.company}</p>
                            {contact.jobTitle && (
                              <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {contactAddress && (
                        <div className="flex items-center gap-3" data-testid="contact-address">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Address</p>
                            <p>{contactAddress}</p>
                          </div>
                        </div>
                      )}

                      {contact?.website && (
                        <div className="flex items-center gap-3" data-testid="contact-website">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Website</p>
                            <a 
                              href={contact.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline text-blue-600 dark:text-blue-400"
                            >
                              {contact.website}
                            </a>
                          </div>
                        </div>
                      )}

                      {contact?.eventDate && (
                        <div className="flex items-center gap-3" data-testid="contact-event-date">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Event Date</p>
                            <p>{format(new Date(contact.eventDate), 'MMMM d, yyyy')}</p>
                          </div>
                        </div>
                      )}

                      {(contact?.venueName || venueAddressFull) && (
                        <>
                          <Separator className="my-4" />
                          <h3 className="font-semibold mb-3">Venue Information</h3>
                          
                          {contact?.venueName && (
                            <div className="flex items-center gap-3" data-testid="venue-name">
                              <Building className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">Venue Name</p>
                                <p>{contact.venueName}</p>
                              </div>
                            </div>
                          )}

                          {venueAddressFull && (
                            <div className="flex items-center gap-3" data-testid="venue-address">
                              <MapPin className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-muted-foreground">Venue Address</p>
                                <p>{venueAddressFull}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {contact?.tags && contact.tags.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <div className="flex items-start gap-3" data-testid="contact-tags">
                            <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm text-muted-foreground mb-2">Tags</p>
                              <div className="flex flex-wrap gap-2">
                                {contact.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" data-testid={`tag-${tag}`}>
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {contact?.notes && (
                        <>
                          <Separator className="my-4" />
                          <div data-testid="contact-notes">
                            <p className="text-sm text-muted-foreground mb-2">Notes</p>
                            <p className="whitespace-pre-wrap">{contact.notes}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Custom Fields Card */}
              {fieldDefinitions.length > 0 && (
                <Card data-testid="card-custom-fields">
                  <CardHeader>
                    <CardTitle>Custom Fields</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {fieldDefinitions
                        .sort((a, b) => a.displayOrder - b.displayOrder)
                        .map((field) => {
                          const value = fieldValueMap.get(field.id);
                          if (!value) return null;

                          return (
                            <div key={field.id} data-testid={`custom-field-${field.name}`}>
                              <p className="text-sm text-muted-foreground">{field.label}</p>
                              <p className="font-medium">{value}</p>
                            </div>
                          );
                        })}
                      {fieldDefinitions.filter(f => fieldValueMap.has(f.id)).length === 0 && (
                        <p className="text-sm text-muted-foreground" data-testid="no-custom-fields">
                          No custom field values set for this contact.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Projects Card */}
              <Card data-testid="card-projects">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Folder className="h-5 w-5" />
                      Projects ({contactProjects.length})
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {projectsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : contactProjects.length === 0 ? (
                    <p className="text-muted-foreground text-sm" data-testid="no-projects">
                      No projects found for this contact.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {contactProjects.map((project) => (
                        <Link key={project.id} href={`/projects/${project.id}`}>
                          <button
                            className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left group"
                            data-testid={`project-${project.id}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                                    {project.name}
                                  </h4>
                                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                  {project.status && (
                                    <Badge variant="outline" data-testid={`project-status-${project.id}`}>
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
                                  <p className="text-sm text-muted-foreground mt-2 truncate" data-testid={`project-location-${project.id}`}>
                                    <MapPin className="h-3 w-3 inline mr-1" />
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
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Quick Stats */}
            <div className="space-y-6">
              <Card data-testid="card-quick-stats">
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Projects</p>
                      <p className="text-2xl font-bold" data-testid="stat-projects-count">
                        {contactProjects.length}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Lead Source</p>
                      <p className="font-medium" data-testid="stat-lead-source">
                        {contact?.leadSource || 'Not specified'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
