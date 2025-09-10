import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MapPin, Phone, Mail, Users, Edit, Trash, Globe, Star, Calendar, BarChart3, Tag } from "lucide-react";
import { AddressFields } from "@/components/shared/AddressFields";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Venue } from "@shared/schema";

const venueSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  capacity: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  restrictions: z.string().optional(),
  accessNotes: z.string().optional(),
  managerName: z.string().optional(),
  managerPhone: z.string().optional(),
  managerEmail: z.string().email().optional().or(z.literal("")),
  preferred: z.boolean().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
});

type VenueFormData = z.infer<typeof venueSchema>;

export default function VenuesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const { toast } = useToast();

  const { data: venues = [], isLoading } = useQuery<Venue[]>({
    queryKey: ["/api/venues"],
  });

  const form = useForm<VenueFormData>({
    resolver: zodResolver(venueSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      capacity: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      website: "",
      restrictions: "",
      accessNotes: "",
      managerName: "",
      managerPhone: "",
      managerEmail: "",
      preferred: false,
      tags: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: VenueFormData) => {
      const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      return apiRequest("POST", "/api/venues", {
        ...data,
        capacity: data.capacity ? parseInt(data.capacity) : undefined,
        contactEmail: data.contactEmail || undefined,
        country: data.country || undefined,
        website: data.website || undefined,
        managerEmail: data.managerEmail || undefined,
        tags: tags.length > 0 ? tags : undefined,
        preferred: data.preferred || false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Venue added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add venue",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: VenueFormData }) => {
      const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      return apiRequest("PATCH", `/api/venues/${id}`, {
        ...data,
        capacity: data.capacity ? parseInt(data.capacity) : undefined,
        contactEmail: data.contactEmail || undefined,
        country: data.country || undefined,
        website: data.website || undefined,
        managerEmail: data.managerEmail || undefined,
        tags: tags.length > 0 ? tags : undefined,
        preferred: data.preferred || false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      setIsDialogOpen(false);
      setSelectedVenue(null);
      form.reset();
      toast({
        title: "Success",
        description: "Venue updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update venue",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/venues/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      toast({
        title: "Success",
        description: "Venue deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete venue",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: VenueFormData) => {
    if (selectedVenue) {
      updateMutation.mutate({ id: selectedVenue.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (venue: Venue) => {
    setSelectedVenue(venue);
    form.reset({
      name: venue.name,
      address: venue.address || "",
      city: venue.city || "",
      state: venue.state || "",
      zipCode: venue.zipCode || "",
      country: venue.country || "",
      capacity: venue.capacity?.toString() || "",
      contactName: venue.contactName || "",
      contactPhone: venue.contactPhone || "",
      contactEmail: venue.contactEmail || "",
      website: venue.website || "",
      restrictions: venue.restrictions || "",
      accessNotes: venue.accessNotes || "",
      managerName: venue.managerName || "",
      managerPhone: venue.managerPhone || "",
      managerEmail: venue.managerEmail || "",
      preferred: venue.preferred || false,
      tags: venue.tags ? venue.tags.join(', ') : "",
      notes: venue.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedVenue(null);
      form.reset();
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Venues</h1>
          <p className="text-muted-foreground mt-2">
            Manage your performance venues and locations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-venue">
              <Plus className="mr-2 h-4 w-4" />
              Add Venue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedVenue ? "Edit Venue" : "Add New Venue"}
              </DialogTitle>
              <DialogDescription>
                {selectedVenue
                  ? "Update venue information"
                  : "Add a new performance venue to your list"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-venue-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  testIdPrefix="venue"
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacity</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            placeholder="500"
                            data-testid="input-capacity" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="url" 
                            placeholder="https://example.com"
                            data-testid="input-website" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Manager/Venue Contact</h3>
                  <FormField
                    control={form.control}
                    name="managerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manager Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-manager-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="managerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manager Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-manager-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="managerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manager Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-manager-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Venue Details & Restrictions</h3>
                  <FormField
                    control={form.control}
                    name="restrictions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restrictions</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} placeholder="Age restrictions, equipment limitations, etc." data-testid="textarea-restrictions" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accessNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} placeholder="Loading dock info, parking, accessibility notes, etc." data-testid="textarea-access-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="outdoor, acoustic, large-stage, etc. (comma-separated)" data-testid="input-tags" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Preferences</h3>
                  <FormField
                    control={form.control}
                    name="preferred"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Preferred Venue</FormLabel>
                          <FormControl>
                            <div className="text-sm text-muted-foreground">Mark as a preferred venue for easier booking</div>
                          </FormControl>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-preferred"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} data-testid="textarea-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDialogClose}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : selectedVenue
                      ? "Update Venue"
                      : "Add Venue"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {venues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No venues yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first performance venue to get started
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first">
              <Plus className="mr-2 h-4 w-4" />
              Add First Venue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venues.map((venue) => (
                  <TableRow 
                    key={venue.id}
                    data-testid={`venue-row-${venue.id}`}
                    className="cursor-pointer"
                    onClick={() => handleEdit(venue)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {venue.preferred && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
                        <div data-testid={`text-venue-name-${venue.id}`}>
                          {venue.name}
                        </div>
                      </div>
                      {venue.website && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Globe className="h-3 w-3" />
                          <a href={venue.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            Website
                          </a>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {(venue.address || venue.city || venue.state) && (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            <span data-testid={`text-location-${venue.id}`}>
                              {[venue.address, venue.city, venue.state]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {/* Primary Contact */}
                        {venue.contactName && (
                          <div className="text-sm font-medium" data-testid={`text-contact-name-${venue.id}`}>
                            {venue.contactName}
                          </div>
                        )}
                        {venue.contactPhone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            <span data-testid={`text-contact-phone-${venue.id}`}>{venue.contactPhone}</span>
                          </div>
                        )}
                        {venue.contactEmail && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            <span data-testid={`text-contact-email-${venue.id}`}>{venue.contactEmail}</span>
                          </div>
                        )}
                        {/* Manager Contact */}
                        {(venue.managerName || venue.managerPhone || venue.managerEmail) && (
                          <div className="text-xs text-muted-foreground border-t pt-1 mt-2">
                            <div className="font-medium">Manager:</div>
                            {venue.managerName && <div>{venue.managerName}</div>}
                            {venue.managerPhone && <div>{venue.managerPhone}</div>}
                            {venue.managerEmail && <div>{venue.managerEmail}</div>}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {venue.capacity && (
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="h-3 w-3" />
                            <span data-testid={`text-capacity-${venue.id}`}>{venue.capacity}</span>
                          </div>
                        )}
                        {venue.tags && venue.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {venue.tags.slice(0, 2).map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {venue.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{venue.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                        {(venue.restrictions || venue.accessNotes) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Tag className="h-3 w-3" />
                            <span>Has notes</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          <span data-testid={`text-use-count-${venue.id}`}>{venue.useCount || 0} uses</span>
                        </div>
                        {venue.lastUsedAt && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Last: {new Date(venue.lastUsedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(venue);
                          }}
                          data-testid={`button-edit-${venue.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(venue.id);
                          }}
                          data-testid={`button-delete-${venue.id}`}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}