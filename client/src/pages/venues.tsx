import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MapPin, Phone, Mail, Users, Edit, Trash } from "lucide-react";
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
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: VenueFormData) => 
      apiRequest("POST", "/api/venues", {
        ...data,
        capacity: data.capacity ? parseInt(data.capacity) : undefined,
        contactEmail: data.contactEmail || undefined,
        country: data.country || undefined,
      }),
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
    mutationFn: ({ id, data }: { id: string; data: VenueFormData }) =>
      apiRequest("PATCH", `/api/venues/${id}`, {
        ...data,
        capacity: data.capacity ? parseInt(data.capacity) : undefined,
        contactEmail: data.contactEmail || undefined,
        country: data.country || undefined,
      }),
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
      notes: venue.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedVenue(null);
    form.reset();
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
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Contact Information</h3>
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-contact-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-contact-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
                  <TableHead>Capacity</TableHead>
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
                      <div data-testid={`text-venue-name-${venue.id}`}>
                        {venue.name}
                      </div>
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
                      </div>
                    </TableCell>
                    <TableCell>
                      {venue.capacity && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span data-testid={`text-capacity-${venue.id}`}>{venue.capacity}</span>
                        </div>
                      )}
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