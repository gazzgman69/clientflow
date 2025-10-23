import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Plus, Pencil, Trash2, Copy, ExternalLink } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { BookableService, AvailabilitySchedule, Booking } from '@shared/schema';

export default function Scheduler() {
  const [activeTab, setActiveTab] = useState('services');
  const { toast } = useToast();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Scheduler</h1>
        <p className="text-muted-foreground mt-2">
          Manage your bookable services, availability schedules, and appointments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
          <TabsTrigger value="availability" data-testid="tab-availability">Availability</TabsTrigger>
          <TabsTrigger value="bookings" data-testid="tab-bookings">Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-6">
          <ServicesTab />
        </TabsContent>

        <TabsContent value="availability" className="mt-6">
          <AvailabilityTab />
        </TabsContent>

        <TabsContent value="bookings" className="mt-6">
          <BookingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ServicesTab() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: services, isLoading } = useQuery<BookableService[]>({
    queryKey: ['/api/ai-features/services'],
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Bookable Services</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage services that clients can book
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-service">
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <ServiceDialog
            onClose={() => setIsCreateDialogOpen(false)}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading services...</div>
      ) : services && services.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No services yet. Create your first bookable service to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: BookableService }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/ai-features/services/${service.id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/services'] });
      toast({ description: 'Service deleted successfully' });
    },
  });

  return (
    <Card data-testid={`card-service-${service.id}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{service.name}</CardTitle>
            <CardDescription className="mt-1">{service.description}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" data-testid={`button-edit-service-${service.id}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <ServiceDialog
                service={service}
                onClose={() => setIsEditDialogOpen(false)}
              />
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-service-${service.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{service.duration} minutes</span>
            {service.bufferBefore > 0 && <Badge variant="outline">{service.bufferBefore}m before</Badge>}
            {service.bufferAfter > 0 && <Badge variant="outline">{service.bufferAfter}m after</Badge>}
          </div>
          {service.price && (
            <div className="text-muted-foreground">
              ${service.price}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceDialog({ service, onClose }: { service?: BookableService; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: service?.name || '',
    description: service?.description || '',
    duration: service?.duration || 60,
    bufferBefore: service?.bufferBefore || 0,
    bufferAfter: service?.bufferAfter || 0,
    price: service?.price || '',
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (service) {
        return apiRequest(`/api/ai-features/services/${service.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      }
      return apiRequest('/api/ai-features/services', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/services'] });
      toast({ description: service ? 'Service updated successfully' : 'Service created successfully' });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <DialogContent data-testid="dialog-service-form">
      <DialogHeader>
        <DialogTitle>{service ? 'Edit Service' : 'Create Service'}</DialogTitle>
        <DialogDescription>
          {service ? 'Update the service details below.' : 'Create a new bookable service.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Service Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-service-name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="input-service-description"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="duration">Duration (min)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                required
                data-testid="input-service-duration"
              />
            </div>
            <div>
              <Label htmlFor="bufferBefore">Buffer Before (min)</Label>
              <Input
                id="bufferBefore"
                type="number"
                value={formData.bufferBefore}
                onChange={(e) => setFormData({ ...formData, bufferBefore: parseInt(e.target.value) })}
                data-testid="input-service-buffer-before"
              />
            </div>
            <div>
              <Label htmlFor="bufferAfter">Buffer After (min)</Label>
              <Input
                id="bufferAfter"
                type="number"
                value={formData.bufferAfter}
                onChange={(e) => setFormData({ ...formData, bufferAfter: parseInt(e.target.value) })}
                data-testid="input-service-buffer-after"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="price">Price (optional)</Label>
            <Input
              id="price"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="e.g., 100"
              data-testid="input-service-price"
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-service">
            {mutation.isPending ? 'Saving...' : service ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function AvailabilityTab() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: schedules, isLoading } = useQuery<AvailabilitySchedule[]>({
    queryKey: ['/api/ai-features/schedules'],
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Availability Schedules</h2>
          <p className="text-sm text-muted-foreground">
            Define when services are available for booking
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-schedule">
              <Plus className="w-4 h-4 mr-2" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <ScheduleDialog onClose={() => setIsCreateDialogOpen(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading schedules...</div>
      ) : schedules && schedules.length > 0 ? (
        <div className="grid gap-4">
          {schedules.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No schedules yet. Create your first availability schedule.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: AvailabilitySchedule }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/ai-features/schedules/${schedule.id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/schedules'] });
      toast({ description: 'Schedule deleted successfully' });
    },
  });

  const copyPublicLink = () => {
    const link = `${window.location.origin}/book/${schedule.publicLink}`;
    navigator.clipboard.writeText(link);
    toast({ description: 'Public booking link copied to clipboard' });
  };

  return (
    <Card data-testid={`card-schedule-${schedule.id}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{schedule.name}</CardTitle>
            {schedule.description && (
              <CardDescription className="mt-1">{schedule.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-2">
            {schedule.publicLink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={copyPublicLink}
                data-testid={`button-copy-link-${schedule.id}`}
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" data-testid={`button-edit-schedule-${schedule.id}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <ScheduleDialog
                schedule={schedule}
                onClose={() => setIsEditDialogOpen(false)}
              />
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-schedule-${schedule.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{schedule.timezone}</span>
          </div>
          {schedule.publicLink && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <ExternalLink className="w-4 h-4" />
              <span className="text-xs truncate">/book/{schedule.publicLink}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleDialog({ schedule, onClose }: { schedule?: AvailabilitySchedule; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: schedule?.name || '',
    description: schedule?.description || '',
    timezone: schedule?.timezone || 'America/New_York',
    publicLink: schedule?.publicLink || '',
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (schedule) {
        return apiRequest(`/api/ai-features/schedules/${schedule.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      }
      return apiRequest('/api/ai-features/schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/schedules'] });
      toast({ description: schedule ? 'Schedule updated successfully' : 'Schedule created successfully' });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <DialogContent data-testid="dialog-schedule-form">
      <DialogHeader>
        <DialogTitle>{schedule ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
        <DialogDescription>
          {schedule ? 'Update the schedule details below.' : 'Create a new availability schedule.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Schedule Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-schedule-name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="input-schedule-description"
            />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
            >
              <SelectTrigger data-testid="select-schedule-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="publicLink">Public Booking Link (optional)</Label>
            <Input
              id="publicLink"
              value={formData.publicLink}
              onChange={(e) => setFormData({ ...formData, publicLink: e.target.value })}
              placeholder="e.g., my-availability"
              data-testid="input-schedule-public-link"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Creates a booking page at /book/your-link
            </p>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-schedule">
            {mutation.isPending ? 'Saving...' : schedule ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function BookingsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/ai-features/bookings', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const response = await fetch(`/api/ai-features/bookings?${params}`);
      if (!response.ok) throw new Error('Failed to fetch bookings');
      return response.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Bookings</h2>
          <p className="text-sm text-muted-foreground">
            View and manage client bookings
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-booking-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading bookings...</div>
      ) : bookings && bookings.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No bookings found.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest(`/api/ai-features/bookings/${booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/bookings'] });
      toast({ description: 'Booking status updated' });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      case 'completed':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <TableRow data-testid={`row-booking-${booking.id}`}>
      <TableCell>
        <div>
          <div className="font-medium">{booking.clientName}</div>
          <div className="text-sm text-muted-foreground">{booking.clientEmail}</div>
        </div>
      </TableCell>
      <TableCell>{booking.serviceId}</TableCell>
      <TableCell>
        <div className="text-sm">
          {new Date(booking.bookingDate).toLocaleDateString()}
          <br />
          {booking.bookingTime}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusColor(booking.status)}>
          {booking.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          {booking.status === 'pending' && (
            <Button
              size="sm"
              onClick={() => updateStatusMutation.mutate('confirmed')}
              disabled={updateStatusMutation.isPending}
              data-testid={`button-confirm-booking-${booking.id}`}
            >
              Confirm
            </Button>
          )}
          {(booking.status === 'pending' || booking.status === 'confirmed') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatusMutation.mutate('cancelled')}
              disabled={updateStatusMutation.isPending}
              data-testid={`button-cancel-booking-${booking.id}`}
            >
              Cancel
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
