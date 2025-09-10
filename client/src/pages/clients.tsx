import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Building, User, Home, Briefcase, Tag, FileText, MapPin } from "lucide-react";
import { AddressFields } from "@/components/shared/AddressFields";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Contact } from "@shared/schema";
import { z } from "zod";

export default function Contacts() {
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    refetchInterval: 1000, // Refresh every 1 second for real-time updates
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true, // Refresh when tab/window gains focus
    refetchOnMount: true, // Refresh when component mounts
    refetchOnReconnect: true, // Refresh on reconnect
  });

  const form = useForm<z.infer<typeof insertContactSchema>>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: {
      firstName: "",
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

  const deleteContactMutation = useMutation({
    mutationFn: async ({ contactId, cascade = false }: { contactId: string; cascade?: boolean }) => {
      const url = cascade ? `/api/contacts/${contactId}?cascade=true` : `/api/contacts/${contactId}`;
      const response = await apiRequest("DELETE", url);
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      const message = data.deletedProjects > 0 
        ? `Contact deleted successfully along with ${data.deletedProjects} associated project(s).`
        : "Contact deleted successfully.";
        
      toast({
        title: "Contact deleted",
        description: message,
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

  const onSubmit = (data: z.infer<typeof insertContactSchema>) => {
    createContactMutation.mutate(data);
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
      
      <main className="flex-1 overflow-auto p-6">
        <Card data-testid="contacts-table-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Contacts</CardTitle>
              <Button onClick={handleAddContact} data-testid="button-add-contact">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
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
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow 
                      key={contact.id} 
                      data-testid={`contact-row-${contact.id}`}
                      className="cursor-pointer"
                      onClick={() => {
                        setEditingContact(contact);
                        form.reset({
                          ...contact,
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
                    >
                      <TableCell className="font-medium" data-testid={`contact-name-${contact.id}`}>
                        {contact.firstName} {contact.lastName}
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
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="font-medium">Personal:</span> {contact.city ? `${contact.city}${contact.state ? `, ${contact.state}` : ''}` : (contact.address || '-')}
                          </div>
                          {(contact.venueCity || contact.venueAddress) && (
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Venue:</span> {contact.venueCity ? `${contact.venueCity}${contact.venueState ? `, ${contact.venueState}` : ''}` : (contact.venueAddress || '-')}
                            </div>
                          )}
                        </div>
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
                      <TableCell data-testid={`contact-created-${contact.id}`}>
                        {formatDistanceToNow(new Date(contact.createdAt!), { addSuffix: true })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`delete-contact-${contact.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{contact.firstName} {contact.lastName}"? This action cannot be undone and will remove all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteContactMutation.mutate({ contactId: contact.id })}
                                className="bg-red-600 hover:bg-red-700"
                                data-testid={`confirm-delete-contact-${contact.id}`}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="contact-form-description">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
            <div id="contact-form-description" className="text-sm text-muted-foreground">
              Fill in the contact information below. Required fields are marked with an asterisk (*).
            </div>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* 📇 Basic Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Basic Info</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-contact-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-contact-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
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

              {/* 📍 Venue Address Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Venue Address</h3>
                  <span className="text-sm text-muted-foreground">(linked to venues tab)</span>
                </div>
                
                <AddressFields
                  control={form.control}
                  countryCode={form.watch('venueCountry') || undefined}
                  onCountryChange={(countryCode) =>
                    form.setValue('venueCountry', countryCode, { shouldDirty: true, shouldValidate: true })
                  }
                  fieldNames={{
                    address1: 'venueAddress',
                    city: 'venueCity',
                    state: 'venueState',
                    postalCode: 'venueZipCode',
                    country: 'venueCountry'
                  }}
                  testIdPrefix="contact-venue"
                />
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
              <AlertDialogDescription className="space-y-4">
                <p>
                  This contact has <strong>{contactToDelete.projectCount} associated project(s)</strong> that will also be deleted:
                </p>
                <div className="bg-muted p-4 rounded-md">
                  <p className="font-semibold mb-2">Projects to be deleted:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {contactToDelete.projects?.map((project: any) => (
                      <li key={project.id} className="text-sm">
                        <span className="font-medium">{project.name}</span>
                        <span className="text-muted-foreground"> ({project.status})</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-red-600 font-medium">
                  ⚠️ This action cannot be undone. All project data, quotes, contracts, and invoices will be permanently deleted.
                </p>
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
    </>
  );
}
