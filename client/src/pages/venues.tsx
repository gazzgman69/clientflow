import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MapPin, Phone, Mail, Users, Edit, Trash, Globe, Star, Calendar, BarChart3, Tag, Clock, DollarSign, CheckCircle } from "lucide-react";
import { AddressFields } from "@/components/shared/AddressFields";
import { VenueAutocomplete, clearVenueAutocompleteCache } from "@/components/venues/VenueAutocomplete";
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

// Helper function to parse enriched venue metadata
function parseVenueEnrichment(meta: string | null) {
  if (!meta) return null;
  try {
    const parsed = JSON.parse(meta);
    return {
      rating: parsed.rating,
      userRatingsTotal: parsed.userRatingsTotal,
      priceLevel: parsed.priceLevel,
      businessStatus: parsed.businessStatus,
      openingHours: parsed.openingHours,
      lastEnriched: parsed.lastEnriched,
      autoEnriched: parsed.autoEnriched,
      confidence: parsed.confidence
    };
  } catch {
    return null;
  }
}

// Helper function to get price level display
function getPriceLevelDisplay(priceLevel: number | null | undefined) {
  if (!priceLevel) return null;
  const symbols = ['$', '$$', '$$$', '$$$$'];
  return symbols[priceLevel - 1] || null;
}

export default function VenuesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const { toast } = useToast();

  const { data: venuesData, isLoading } = useQuery<{ venues: Venue[] }>({
    queryKey: ["/api/venues"],
  });

  const venues = venuesData?.venues || [];

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
      
      // Convert string values to proper types for minimal API (no coordinates required)
      const payload = {
        name: data.name,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zipCode || undefined,
        country: data.country || undefined,
        capacity: data.capacity ? parseInt(data.capacity) : undefined,
        contactName: data.contactName || undefined,
        contactPhone: data.contactPhone || undefined,
        contactEmail: data.contactEmail || undefined,
        website: data.website || undefined,
        restrictions: data.restrictions || undefined,
        accessNotes: data.accessNotes || undefined,
        managerName: data.managerName || undefined,
        managerPhone: data.managerPhone || undefined,
        managerEmail: data.managerEmail || undefined,
        preferred: data.preferred || false,
        tags: tags.length > 0 ? tags : undefined,
        notes: data.notes || undefined,
      };
      
      // Remove empty string values to avoid validation issues
      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === null) {
          delete payload[key];
        }
      });
      
      return apiRequest("POST", "/api/venues/minimal", payload);
    },
    onSuccess: () => {
      // Clear autocomplete cache and invalidate venues list for new venue creation
      clearVenueAutocompleteCache();
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
      
      // Convert string values to proper types for API (no coordinates)
      const payload = {
        name: data.name,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zipCode || undefined,
        country: data.country || undefined,
        capacity: data.capacity ? parseInt(data.capacity) : undefined,
        contactName: data.contactName || undefined,
        contactPhone: data.contactPhone || undefined,
        contactEmail: data.contactEmail || undefined,
        website: data.website || undefined,
        restrictions: data.restrictions || undefined,
        accessNotes: data.accessNotes || undefined,
        managerName: data.managerName || undefined,
        managerPhone: data.managerPhone || undefined,
        managerEmail: data.managerEmail || undefined,
        preferred: data.preferred || false,
        tags: tags.length > 0 ? tags : undefined,
        notes: data.notes || undefined,
      };
      
      // Remove empty string values to avoid validation issues
      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === null) {
          delete payload[key];
        }
      });
      
      return apiRequest("PATCH", `/api/venues/${id}`, payload);
    },
    onSuccess: (_, { id }) => {
      // Clear autocomplete cache and invalidate venue queries
      clearVenueAutocompleteCache();
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/venues", id] });
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
    onSuccess: (_, id) => {
      // Clear autocomplete cache, invalidate venues list and remove specific venue from cache
      clearVenueAutocompleteCache();
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      queryClient.removeQueries({ queryKey: ["/api/venues", id] });
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
    } else if (!selectedVenue) {
      // Opening dialog for new venue - reset form to blank values
      form.reset({
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
        placeId: "",
        latitude: "",
        longitude: "",
      });
    }
  };

  const handleVenueSelect = (selectedPlace: {
    placeId: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    // Auto-fill all the form fields with Google Places data
    form.setValue('name', selectedPlace.name, { shouldDirty: true, shouldValidate: true });
    form.setValue('address', selectedPlace.address, { shouldDirty: true, shouldValidate: true });
    if (selectedPlace.city) {
      form.setValue('city', selectedPlace.city, { shouldDirty: true, shouldValidate: true });
    }
    if (selectedPlace.state) {
      form.setValue('state', selectedPlace.state, { shouldDirty: true, shouldValidate: true });
    }
    if (selectedPlace.zipCode) {
      form.setValue('zipCode', selectedPlace.zipCode, { shouldDirty: true, shouldValidate: true });
    }
    if (selectedPlace.country) {
      form.setValue('country', selectedPlace.country, { shouldDirty: true, shouldValidate: true });
    }
    
    // Store Google Places data in hidden form fields for when user clicks Save
    form.setValue('placeId', selectedPlace.placeId);
    form.setValue('latitude', selectedPlace.latitude?.toString() || '');
    form.setValue('longitude', selectedPlace.longitude?.toString() || '');
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
                {/* Google Places Search Integration */}
                <div>
                  <FormLabel className="text-base font-medium">Search for Venue</FormLabel>
                  <p className="text-sm text-muted-foreground mb-2">
                    Search Google Places to automatically fill venue details
                  </p>
                  <VenueAutocomplete
                    onVenueSelect={handleVenueSelect}
                    placeholder="Search for venues, restaurants, theaters, etc..."
                    className="w-full"
                  />
                </div>
                
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

                {/* Enriched Venue Details Display - Only show when editing existing venue */}
                {selectedVenue && (() => {
                  const enrichment = parseVenueEnrichment(selectedVenue.meta);
                  return enrichment && (
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        Google Places Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Phone Number */}
                        {selectedVenue.contactPhone && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Phone</div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-sm">{selectedVenue.contactPhone}</span>
                            </div>
                          </div>
                        )}

                        {/* Rating and Reviews */}
                        {enrichment.rating && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Rating</div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                                <span className="font-medium text-lg">{enrichment.rating}</span>
                              </div>
                              {enrichment.userRatingsTotal && (
                                <span className="text-sm text-muted-foreground">
                                  ({enrichment.userRatingsTotal} reviews)
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Price Level */}
                        {enrichment.priceLevel && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Price Level</div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-green-600 text-lg">
                                {getPriceLevelDisplay(enrichment.priceLevel)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {enrichment.priceLevel === 1 && 'Inexpensive'}
                                {enrichment.priceLevel === 2 && 'Moderate'}
                                {enrichment.priceLevel === 3 && 'Expensive'}
                                {enrichment.priceLevel === 4 && 'Very Expensive'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Business Status */}
                        {enrichment.businessStatus && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Status</div>
                            <div className="flex items-center gap-2">
                              {enrichment.businessStatus === 'OPERATIONAL' ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  <span className="text-green-600 font-medium">Open</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-muted-foreground font-medium">{enrichment.businessStatus}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Opening Hours */}
                        {enrichment.openingHours && enrichment.openingHours.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Hours</div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium">Available</span>
                              <details className="text-xs">
                                <summary className="cursor-pointer text-blue-600 hover:underline">View Hours</summary>
                                <div className="mt-2 space-y-1 bg-background p-2 rounded border">
                                  {enrichment.openingHours.slice(0, 7).map((hours, idx) => (
                                    <div key={idx} className="text-xs">
                                      {hours}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Enrichment Info */}
                      {enrichment.lastEnriched && (
                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>
                              {enrichment.autoEnriched ? '🤖 Auto-enriched' : '✋ Manually enriched'} 
                              {enrichment.confidence && ` (${Math.round(enrichment.confidence * 100)}% match)`}
                            </span>
                            <span>
                              {new Date(enrichment.lastEnriched).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                {/* Address Line 1 */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="venue-input-address1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* City, State, Postal Code, Country */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="venue-input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="venue-input-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postcode</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="venue-input-postalCode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="venue-input-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                    onClick={() => handleDialogClose(false)}
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
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {(venue.address || venue.city || venue.state) && (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            <span data-testid={`text-location-${venue.id}`}>
                              {(() => {
                                // If address exists and seems to be a formatted address (contains commas), use it
                                if (venue.address && venue.address.includes(',')) {
                                  return venue.address;
                                }
                                // Otherwise build from components
                                return [venue.address, venue.city, venue.state]
                                  .filter(Boolean)
                                  .join(", ");
                              })()}
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
                        {/* Enriched Data - Rating and Business Info */}
                        {(() => {
                          const enrichment = parseVenueEnrichment(venue.meta);
                          return enrichment && (
                            <div className="space-y-1 border-b pb-2 mb-2">
                              {enrichment.rating && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                  <span className="font-medium">{enrichment.rating}</span>
                                  {enrichment.userRatingsTotal && (
                                    <span className="text-xs text-muted-foreground">
                                      ({enrichment.userRatingsTotal} reviews)
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                {enrichment.priceLevel && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <DollarSign className="h-3 w-3 text-green-600" />
                                    <span className="font-medium text-green-600">
                                      {getPriceLevelDisplay(enrichment.priceLevel)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Website */}
                        {venue.website && (
                          <div className="flex items-center gap-1 text-sm">
                            <Globe className="h-3 w-3" />
                            <a href={venue.website} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600">
                              Website
                            </a>
                          </div>
                        )}
                        
                        {/* Venue Capacity */}
                        {venue.capacity && (
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="h-3 w-3" />
                            <span data-testid={`text-capacity-${venue.id}`}>{venue.capacity}</span>
                          </div>
                        )}
                        
                        {/* Tags */}
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
                        
                        {/* Notes indicator */}
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