import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Building, User, Home, Briefcase, Tag, FileText, MapPin } from "lucide-react";
import { AddressFields } from "@/components/shared/AddressFields";
import { VenueAutocomplete } from "@/components/venues/VenueAutocomplete";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Contact } from "@shared/schema";
import { z } from "zod";
import { splitFullName, getDisplayName } from "@shared/utils/name-splitter";

// Type for deletion preview response
interface ContactDeletionPreview {
  contact: {
    id: string;
    name: string;
    email: string;
  };
  willDelete: {
    projects: {
      id: string;
      name: string;
      emailCount: number;
      taskCount: number;
      quoteCount: number;
      contractCount: number;
      invoiceCount: number;
      leadCount: number;
    }[];
    directEmails: number;
    directQuotes: number;
    directContracts: number;
    directInvoices: number;
    totalItems: number;
  };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function Contacts() {
  const [, setLocation] = useLocation();
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<any>(null);
  const [deletionPreview, setDeletionPreview] = useState<ContactDeletionPreview | null>(null);
  const [previewContactId, setPreviewContactId] = useState<string | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactsData, isLoading } = useQuery<{contacts: Contact[], pagination: any}>({
    queryKey: ["/api/contacts"],
    refetchInterval: 10000, // Refresh every 10 seconds for better responsiveness
    refetchIntervalInBackground: false, // Don't poll when tab is inactive
    refetchOnWindowFocus: true, // Refresh when tab/window gains focus
    refetchOnMount: true, // Refresh when component mounts
    refetchOnReconnect: true, // Refresh on reconnect
    staleTime: 5000, // Data stays fresh for 5 seconds
  });

  const contacts = contactsData?.contacts || [];

  // Load recent contacts from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentContacts');
    if (stored) {
      try {
        const contactIds: string[] = JSON.parse(stored);
        // Filter to only contacts that still exist
        const recent = contactIds
          .map(id => contacts.find(c => c.id === id))
          .filter((c): c is Contact => c !== undefined)
          .slice(0, 10);
        setRecentContacts(recent);
      } catch (e) {
        // Invalid data, ignore
      }
    }
  }, [contacts]);

  // Track contact view
  const trackContactView = (contact: Contact) => {
    const stored = localStorage.getItem('recentContacts');
    let contactIds: string[] = [];
    if (stored) {
      try {
        contactIds = JSON.parse(stored);
      } catch (e) {
        contactIds = [];
      }
    }
    // Remove contact if already in list, then add to front
    contactIds = contactIds.filter(id => id !== contact.id);
    contactIds.unshift(contact.id);
    // Keep only last 10
    contactIds = contactIds.slice(0, 10);
    localStorage.setItem('recentContacts', JSON.stringify(contactIds));
    
    // Update state
    const recent = contactIds
      .map(id => contacts.find(c => c.id === id))
      .filter((c): c is Contact => c !== undefined);
    setRecentContacts(recent);
  };

  // Filter contacts by letter and tags
  const filteredContacts = contacts.filter(contact => {
    const displayName = getDisplayName(contact);
    
    // Letter filter
    if (letterFilter) {
      const firstChar = displayName.charAt(0).toUpperCase();
      if (letterFilter === '#') {
        // Show non-alphabetic characters
        if (/[A-Z]/.test(firstChar)) return false;
      } else {
        if (firstChar !== letterFilter) return false;
      }
    }
    
    // Tag filter
    if (tagFilter.length > 0) {
      if (!contact.tags || contact.tags.length === 0) return false;
      const hasAnyTag = tagFilter.some(tag => contact.tags?.includes(tag));
      if (!hasAnyTag) return false;
    }
    
    return true;
  });

  // Get all unique tags from contacts
  const allTags = Array.from(
    new Set(contacts.flatMap(c => c.tags || []))
  ).sort();

  // Fetch projects for expanded contact
  const { data: expandedContactProjects = [] } = useQuery({
    queryKey: [`/api/contacts/${expandedContactId}/projects`],
    enabled: !!expandedContactId,
  });

  const form = useForm<z.infer<typeof insertContactSchema>>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: {
      fullName: "",
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      website: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      venueAddress: "",
      venueCity: "",
      venueState: "",
      venueZipCode: "",
      venueCountry: "",
      venueId: null,
      tags: [],
      leadSource: "",
      notes: "",
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertContactSchema>) => {
      const method = editingContact ? "PUT" : "POST";
      const url = editingContact ? `/api/contacts/${editingContact.id}` : "/api/contacts";
      const response = await apiRequest(method, url, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Success",
        description: editingContact ? "Contact updated successfully!" : "Contact added successfully!",
      });
      form.reset();
      setEditingContact(null);
      setShowContactModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: editingContact ? "Failed to update contact. Please try again." : "Failed to add contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch deletion preview when contact is selected for deletion
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['/api/contacts', previewContactId, 'deletion-preview'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/contacts/${previewContactId}/deletion-preview`);
      return response.json();
    },
    enabled: !!previewContactId,
    retry: false
  });

  // Update deletion preview when data is loaded
  useEffect(() => {
    if (previewData && previewContactId) {
      setDeletionPreview(previewData);
    }
  }, [previewData, previewContactId]);

  const deleteContactMutation = useMutation({
    mutationFn: async ({ contactId, cascade = false }: { contactId: string; cascade?: boolean }) => {
      const url = cascade ? `/api/contacts/${contactId}?cascade=true` : `/api/contacts/${contactId}`;
      
      return await apiRequest("DELETE", url);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      // Clear preview state
      setDeletionPreview(null);
      setPreviewContactId(null);
      setContactToDelete(null);
      
      toast({
        title: "Contact deleted",
        description: "Contact and all related data have been deleted successfully.",
      });
    },
    onError: (error: any) => {
      if (error.requiresCascade) {
        // Show detailed confirmation dialog
        setContactToDelete(error);
      } else {
        toast({
          title: "Cannot delete contact",
          description: error.details || error.message || "Failed to delete contact. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleDeleteClick = (contactId: string) => {
    setPreviewContactId(contactId);
  };

  const handleConfirmDelete = () => {
    if (previewContactId) {
      deleteContactMutation.mutate({ contactId: previewContactId, cascade: true });
    }
  };

  const handleCancelDelete = () => {
    setPreviewContactId(null);
    setDeletionPreview(null);
  };

  const onSubmit = (data: z.infer<typeof insertContactSchema>) => {
    // Auto-split the fullName into component parts
    const nameParts = splitFullName(data.fullName || "");
    
    const submissionData = {
      ...data,
      fullName: nameParts.fullName,
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
    };

    createContactMutation.mutate(submissionData);
  };

  const handleAddContact = () => {
    setEditingContact(null);
    form.reset();
    setShowContactModal(true);
  };

  return (
    <>
      <Header 
        title="Contacts" 
        subtitle="Manage your contact relationships and information"
      />
      
      <main className="flex-1 overflow-auto p-4">
        <div className="flex gap-4">
          {/* Recent Contacts Sidebar */}
          {recentContacts.length > 0 && (
            <Card className="w-64 flex-shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Recent Contacts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {recentContacts.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => setLocation(`/contacts/${contact.id}`)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    data-testid={`recent-contact-${contact.id}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                      {getDisplayName(contact).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{getDisplayName(contact)}</div>
                      {contact.company && (
                        <div className="text-xs text-muted-foreground truncate">{contact.company}</div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <Card className="flex-1" data-testid="contacts-table-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-3">
                <CardTitle>All Contacts</CardTitle>
                <Button onClick={handleAddContact} data-testid="button-add-contact">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </div>

              {/* Alphabetical Filter */}
              <div className="flex flex-wrap gap-1 mb-3">
                <Button
                  variant={letterFilter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLetterFilter(null)}
                  className="h-7 px-2 text-xs"
                  data-testid="letter-filter-all"
                >
                  ALL
                </Button>
                {ALPHABET.map(letter => (
                  <Button
                    key={letter}
                    variant={letterFilter === letter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLetterFilter(letter)}
                    className="h-7 w-7 p-0 text-xs"
                    data-testid={`letter-filter-${letter}`}
                  >
                    {letter}
                  </Button>
                ))}
                <Button
                  variant={letterFilter === '#' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLetterFilter('#')}
                  className="h-7 w-7 p-0 text-xs"
                  data-testid="letter-filter-#"
                >
                  #
                </Button>
              </div>

              {/* Tag Filter */}
              {allTags.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">Filter by tags:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (tagFilter.includes(tag)) {
                            setTagFilter(tagFilter.filter(t => t !== tag));
                          } else {
                            setTagFilter([...tagFilter, tag]);
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                          tagFilter.includes(tag)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                        data-testid={`tag-filter-${tag}`}
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </button>
                    ))}
                    {tagFilter.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTagFilter([])}
                        className="h-auto py-0.5 text-xs"
                        data-testid="button-clear-tag-filters"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
            {isLoading ? (
              <div className="animate-pulse">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              </div>
            ) : !contacts || contacts.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-clients-state">
                <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No contacts found</p>
                <Button onClick={handleAddContact} data-testid="button-add-first-contact">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Contact
                </Button>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-12" data-testid="no-filtered-contacts">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No contacts match the current filters</p>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setLetterFilter(null);
                    setTagFilter([]);
                  }}
                  data-testid="button-clear-all-filters"
                >
                  Clear All Filters
                </Button>
              </div>
            ) : (
              <Table data-testid="clients-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company & Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => {
                    const isExpanded = expandedContactId === contact.id;
                    // Client's personal address
                    const contactAddress = [contact.address, contact.city, contact.state, contact.zipCode]
                      .filter(Boolean)
                      .join(', ');
                    
                    // Contact's venue information (stored on contact record)
                    const contactVenueInfo = [contact.venueAddress, contact.venueCity, contact.venueState]
                      .filter(Boolean)
                      .join(', ');
                    
                    return (
                      <>
                        <TableRow 
                          data-testid={`contact-row-${contact.id}`}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedContactId(null);
                            } else {
                              setExpandedContactId(contact.id);
                              trackContactView(contact);
                            }
                          }}
                        >
                          <TableCell className="font-medium" data-testid={`contact-name-${contact.id}`}>
                            {getDisplayName(contact)}
                          </TableCell>
                          <TableCell data-testid={`contact-company-${contact.id}`}>
                            <div>
                              <div className="font-medium">{contact.company || '-'}</div>
                              {contact.jobTitle && (
                                <div className="text-sm text-muted-foreground">{contact.jobTitle}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`contact-email-${contact.id}`}>
                            {contact.email}
                          </TableCell>
                          <TableCell data-testid={`contact-phone-${contact.id}`}>
                            {contact.phone || '-'}
                          </TableCell>
                          <TableCell data-testid={`contact-location-${contact.id}`}>
                            {contact.venueCity ? (
                              <div className="text-sm">
                                <span className="font-medium">{contact.venueCity}</span>
                                {contact.venueState && <span className="text-muted-foreground">, {contact.venueState}</span>}
                              </div>
                            ) : contact.city ? (
                              <div className="text-sm">
                                <span className="font-medium">{contact.city}</span>
                                {contact.state && <span className="text-muted-foreground">, {contact.state}</span>}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell data-testid={`contact-tags-${contact.id}`}>
                            {contact.tags && contact.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {contact.tags.slice(0, 2).map((tag, index) => (
                                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {tag}
                                  </span>
                                ))}
                                {contact.tags.length > 2 && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                    +{contact.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell data-testid={`contact-projects-${contact.id}`}>
                            <span className="font-medium">{contact.projectsCount || 0}</span>
                          </TableCell>
                          <TableCell data-testid={`contact-created-${contact.id}`}>
                            {contact.createdAt ? formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true }) : 'Unknown'}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingContact(contact);
                                  const displayName = getDisplayName(contact);
                                  form.reset({
                                    ...contact,
                                    fullName: displayName,
                                    tags: contact.tags || [],
                                    jobTitle: contact.jobTitle || "",
                                    website: contact.website || "",
                                    leadSource: contact.leadSource || "",
                                    notes: contact.notes || "",
                                    venueAddress: contact.venueAddress || "",
                                    venueCity: contact.venueCity || "",
                                    venueState: contact.venueState || "",
                                    venueZipCode: contact.venueZipCode || "",
                                    venueCountry: contact.venueCountry || "",
                                    venueId: contact.venueId || null
                                  });
                                  setShowContactModal(true);
                                }}
                                data-testid={`edit-contact-${contact.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(contact.id);
                                }}
                                data-testid={`delete-contact-${contact.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Inline Expansion Row */}
                        {isExpanded && (
                          <TableRow key={`${contact.id}-expansion`} data-testid={`contact-expansion-${contact.id}`}>
                            <TableCell colSpan={9} className="bg-muted/50 p-6">
                              <div className="grid grid-cols-3 gap-6">
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-2">Name:</p>
                                  <p className="font-medium cursor-pointer hover:text-primary" onClick={() => setLocation(`/contacts/${contact.id}`)}>
                                    {getDisplayName(contact)}
                                  </p>
                                </div>
                                
                                {contact.tags && contact.tags.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-2">Tags:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {contact.tags.map((tag) => (
                                        <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {contactAddress && (
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-2">Address:</p>
                                    <p className="text-sm">{contactAddress}</p>
                                  </div>
                                )}
                              </div>
                              
                              {contact.eventDate && (
                                <div className="mt-4">
                                  <p className="text-sm font-medium text-muted-foreground mb-2">Event Date:</p>
                                  <p className="text-sm">{new Date(contact.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                              )}
                              
                              {contactVenueInfo && (
                                <div className="mt-4">
                                  <p className="text-sm font-medium text-muted-foreground mb-2">Venue:</p>
                                  <p className="text-sm">{contactVenueInfo}</p>
                                </div>
                              )}
                              
                              <Separator className="my-4" />
                              
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-3">Projects:</p>
                                {expandedContactProjects && expandedContactProjects.length > 0 ? (
                                  <div className="space-y-2">
                                    {expandedContactProjects.map((project: any) => (
                                      <div 
                                        key={project.id} 
                                        className="flex items-center justify-between p-2 rounded hover:bg-background cursor-pointer"
                                        onClick={() => setLocation(`/projects/${project.id}`)}
                                      >
                                        <span className="text-sm font-medium hover:text-primary">{project.name}</span>
                                        {project.status && (
                                          <span className="text-xs px-2 py-1 rounded bg-background">{project.status}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground" data-testid={`no-projects-${contact.id}`}>
                                    No projects linked to this contact
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </div>
      </main>

      {/* Add/Edit Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
            <DialogDescription>
              Fill in the contact information below. Required fields are marked with an asterisk (*).
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* 📇 Basic Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Basic Info</h3>
                </div>
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-contact-full-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} value={field.value || ""} data-testid="input-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* 🏠 Address Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Address</h3>
                </div>
                
                <AddressFields
                  control={form.control}
                  countryCode={form.watch('country') || undefined}
                  onCountryChange={(countryCode) =>
                    form.setValue('country', countryCode, { shouldDirty: true, shouldValidate: true })
                  }
                  fieldNames={{
                    address1: 'address',
                    city: 'city',
                    state: 'state',
                    postalCode: 'zipCode',
                    country: 'country'
                  }}
                  testIdPrefix="contact"
                />
              </div>

              <Separator />

              {/* 📍 Venue Selection Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Venue</h3>
                  <span className="text-sm text-muted-foreground">(linked to venues tab)</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="venueId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Venue</FormLabel>
                      <FormControl>
                        <VenueAutocomplete
                          onVenueSelect={(venue) => {
                            // Set the venue ID, name and address fields
                            form.setValue('venueId', venue.placeId, { shouldDirty: true, shouldValidate: true });
                            form.setValue('venueName', venue.name || '', { shouldDirty: true, shouldValidate: true });
                            form.setValue('venueAddress', venue.address || '', { shouldDirty: true, shouldValidate: true });
                            form.setValue('venueCity', venue.city || '', { shouldDirty: true, shouldValidate: true });
                            form.setValue('venueState', venue.state || '', { shouldDirty: true, shouldValidate: true });
                            form.setValue('venueZipCode', venue.zipCode || '', { shouldDirty: true, shouldValidate: true });
                            form.setValue('venueCountry', venue.country || '', { shouldDirty: true, shouldValidate: true });
                          }}
                          placeholder="Search for a venue..."
                          key={`venue-${form.watch('venueAddress')}-${form.watch('venueCity')}`}
                          initialValue={
                            form.watch('venueAddress') || form.watch('venueCity') 
                              ? `${form.watch('venueAddress') || ''}, ${form.watch('venueCity') || ''}`.trim().replace(/^,\s*/, '')
                              : ''
                          }
                          className="w-full"
                          data-testid="venue-autocomplete"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Display selected venue details */}
                {(form.watch('venueAddress') || form.watch('venueCity') || form.watch('venueName')) && (
                  <div className="p-3 bg-muted/50 dark:bg-muted/20 rounded-md border">
                    <div className="text-sm font-medium mb-1">Selected Venue:</div>
                    {form.watch('venueName') && (
                      <div className="text-sm font-semibold text-foreground mb-1">
                        {form.watch('venueName')}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {[
                        form.watch('venueAddress'),
                        form.watch('venueCity'),
                        form.watch('venueState'),
                        form.watch('venueZipCode'),
                        form.watch('venueCountry')
                      ].filter(Boolean).join(', ')}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-6 px-2 text-xs"
                      onClick={() => {
                        form.setValue('venueId', null, { shouldDirty: true, shouldValidate: true });
                        form.setValue('venueName', '', { shouldDirty: true, shouldValidate: true });
                        form.setValue('venueAddress', '', { shouldDirty: true, shouldValidate: true });
                        form.setValue('venueCity', '', { shouldDirty: true, shouldValidate: true });
                        form.setValue('venueState', '', { shouldDirty: true, shouldValidate: true });
                        form.setValue('venueZipCode', '', { shouldDirty: true, shouldValidate: true });
                        form.setValue('venueCountry', '', { shouldDirty: true, shouldValidate: true });
                      }}
                      data-testid="clear-venue"
                    >
                      Clear Venue
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* 🏢 Business Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Business Info</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-contact-company" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title / Role</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-contact-job-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input type="url" {...field} value={field.value || ""} placeholder="https://example.com" data-testid="input-contact-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* 🏷️ Classification Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Classification</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                            onChange={(e) => field.onChange(e.target.value.split(",").map(tag => tag.trim()).filter(Boolean))}
                            placeholder="e.g., VIP, Long-term, Hot Lead (comma separated)" 
                            data-testid="input-contact-tags" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="leadSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Source</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="e.g., Website, Referral, Event" data-testid="input-contact-lead-source" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* 📝 Notes Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Notes</h3>
                </div>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ""} 
                          placeholder="Add any additional notes about this contact..."
                          className="min-h-[100px]"
                          data-testid="input-contact-notes" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setShowContactModal(false)}
                  data-testid="button-cancel-contact"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createContactMutation.isPending}
                  data-testid="button-save-contact"
                >
                  {createContactMutation.isPending ? "Saving..." : "Save Contact"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Cascade Delete Confirmation Dialog */}
      {contactToDelete && (
        <AlertDialog open={true} onOpenChange={(open) => !open && setContactToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact and Associated Projects</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <div>
                    This contact has <strong>{contactToDelete.projectCount} associated project(s)</strong> that will also be deleted:
                  </div>
                  <div className="bg-muted p-4 rounded-md">
                    <div className="font-semibold mb-2">Projects to be deleted:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {contactToDelete.projects?.map((project: any) => (
                        <li key={project.id} className="text-sm">
                          <span className="font-medium">{project.name}</span>
                          <span className="text-muted-foreground"> ({project.status})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-red-600 font-medium">
                    ⚠️ This action cannot be undone. All project data, quotes, contracts, and invoices will be permanently deleted.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setContactToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  // We need to find the contactId from the initial deletion attempt
                  // The contactToDelete error object should include this info
                  const contactId = contactToDelete.contactId;
                  if (contactId) {
                    deleteContactMutation.mutate({ contactId, cascade: true });
                  }
                  setContactToDelete(null);
                }}
                className="bg-red-600 hover:bg-red-700"
                data-testid="confirm-cascade-delete"
              >
                Delete Contact & {contactToDelete.projectCount} Project{contactToDelete.projectCount !== 1 ? 's' : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Enhanced Deletion Preview Dialog */}
      {(deletionPreview || previewLoading) && (
        <AlertDialog open={true} onOpenChange={handleCancelDelete}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact - Preview</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {previewLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span>Loading deletion preview...</span>
                    </div>
                  ) : deletionPreview ? (
                    <>
                      <p>
                        You are about to delete <strong>{deletionPreview.contact.name}</strong> 
                        {deletionPreview.contact.email && ` (${deletionPreview.contact.email})`}.
                      </p>
                      
                      {deletionPreview.willDelete.totalItems > 0 ? (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                            ⚠️ This will permanently delete:
                          </h4>
                          <ul className="space-y-2 text-sm">
                            {deletionPreview.willDelete.projects.length > 0 && (
                              <li>
                                <strong>{deletionPreview.willDelete.projects.length} project(s):</strong>
                                <ul className="ml-4 mt-1 space-y-1">
                                  {deletionPreview.willDelete.projects.map((project) => (
                                    <li key={project.id} className="text-gray-600 dark:text-gray-400">
                                      • {project.name}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            )}
                          </ul>
                        </div>
                      ) : (
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <p className="text-green-800 dark:text-green-200">
                            ✅ This contact has no associated data. It can be safely deleted.
                          </p>
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        This action cannot be undone.
                      </p>
                    </>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelDelete} disabled={deleteContactMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              {!previewLoading && deletionPreview && (
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  disabled={deleteContactMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                  data-testid={`confirm-delete-contact-${deletionPreview.contact.id}`}
                >
                  {deleteContactMutation.isPending ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    'Delete Contact'
                  )}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
