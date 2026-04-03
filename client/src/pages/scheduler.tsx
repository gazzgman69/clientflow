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
import { Calendar, Clock, Plus, Pencil, Trash2, Copy, ExternalLink, Check, X, AlertCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { BookableService, AvailabilitySchedule, Booking } from '@shared/schema';
import { EnhancedScheduleDialog } from './scheduler-enhanced';

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
    mutationFn: () => apiRequest('DELETE', `/api/ai-features/services/${service.id}`),
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

interface ServiceQuestion { label: string; type: 'text' | 'textarea' | 'select'; required: boolean; options?: string[] }

function ServiceDialog({ service, onClose }: { service?: BookableService; onClose: () => void }) {
  const svc = service as any;
  const [formData, setFormData] = useState({
    name: svc?.name || '',
    description: svc?.description || '',
    duration: svc?.duration || 60,
    bufferBefore: svc?.bufferBefore || 0,
    bufferAfter: svc?.bufferAfter || 0,
    price: svc?.price || '',
    location: svc?.location || '',
    requireApproval: !!svc?.requireApproval,
    addContactTags: (svc?.addContactTags || []).join(', '),
  });
  const [questions, setQuestions] = useState<ServiceQuestion[]>(() => {
    try { return JSON.parse(svc?.serviceQuestions || '[]'); } catch { return []; }
  });
  const { toast } = useToast();

  const addQuestion = () =>
    setQuestions(prev => [...prev, { label: '', type: 'text', required: false }]);

  const removeQuestion = (i: number) =>
    setQuestions(prev => prev.filter((_, idx) => idx !== i));

  const updateQuestion = (i: number, field: keyof ServiceQuestion, value: any) =>
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (service) return apiRequest('PATCH', `/api/ai-features/services/${service.id}`, data);
      return apiRequest('POST', '/api/ai-features/services', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/services'] });
      toast({ description: service ? 'Service updated' : 'Service created' });
      onClose();
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message || 'Failed to save service', variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = formData.addContactTags.split(',').map(t => t.trim()).filter(Boolean);
    mutation.mutate({
      ...formData,
      duration: Number(formData.duration),
      bufferBefore: Number(formData.bufferBefore),
      bufferAfter: Number(formData.bufferAfter),
      addContactTags: tags,
      serviceQuestions: questions.length ? JSON.stringify(questions) : null,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-service-form">
      <DialogHeader>
        <DialogTitle>{service ? 'Edit Service' : 'Create Service'}</DialogTitle>
        <DialogDescription>{service ? 'Update the service details below.' : 'Create a new bookable service.'}</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">

          {/* Basics */}
          <div><Label htmlFor="name">Service Name *</Label>
            <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required data-testid="input-service-name" /></div>
          <div><Label htmlFor="description">Description</Label>
            <Textarea id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} data-testid="input-service-description" /></div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="duration">Duration (min) *</Label>
              <Input id="duration" type="number" value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })} required data-testid="input-service-duration" /></div>
            <div><Label htmlFor="bufferBefore">Buffer Before</Label>
              <Input id="bufferBefore" type="number" value={formData.bufferBefore} onChange={e => setFormData({ ...formData, bufferBefore: parseInt(e.target.value) || 0 })} data-testid="input-service-buffer-before" /></div>
            <div><Label htmlFor="bufferAfter">Buffer After</Label>
              <Input id="bufferAfter" type="number" value={formData.bufferAfter} onChange={e => setFormData({ ...formData, bufferAfter: parseInt(e.target.value) || 0 })} data-testid="input-service-buffer-after" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="price">Price (optional)</Label>
              <Input id="price" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="e.g., 100" data-testid="input-service-price" /></div>
            <div><Label htmlFor="location">Location / Format</Label>
              <Input id="location" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., Zoom, Phone, In-person" /></div>
          </div>

          {/* Approval */}
          <div className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              id="requireApproval"
              checked={formData.requireApproval}
              onChange={e => setFormData({ ...formData, requireApproval: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <Label htmlFor="requireApproval" className="cursor-pointer">
              Require approval before confirming bookings
            </Label>
          </div>

          {/* Contact tags */}
          <div>
            <Label htmlFor="addContactTags">Auto-tag contacts on booking (comma-separated)</Label>
            <Input
              id="addContactTags"
              value={formData.addContactTags}
              onChange={e => setFormData({ ...formData, addContactTags: e.target.value })}
              placeholder="e.g., discovery-booked, consultation"
            />
          </div>

          {/* Intake Questions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Intake Questions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="w-3 h-3 mr-1" /> Add Question
              </Button>
            </div>
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions yet. Add questions to collect information from clients at booking time.</p>
            )}
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex gap-2">
                    <Input
                      value={q.label}
                      onChange={e => updateQuestion(i, 'label', e.target.value)}
                      placeholder="Question text…"
                      className="flex-1"
                    />
                    <select
                      value={q.type}
                      onChange={e => updateQuestion(i, 'type', e.target.value)}
                      className="border rounded-md px-2 text-sm bg-background"
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Long text</option>
                      <option value="select">Dropdown</option>
                    </select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(i)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                  {q.type === 'select' && (
                    <Input
                      value={(q.options || []).join(', ')}
                      onChange={e => updateQuestion(i, 'options', e.target.value.split(',').map(o => o.trim()).filter(Boolean))}
                      placeholder="Options: Google, Instagram, Referral"
                      className="text-sm"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`req-${i}`} checked={q.required} onChange={e => updateQuestion(i, 'required', e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
                    <label htmlFor={`req-${i}`} className="text-xs text-muted-foreground cursor-pointer">Required</label>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-service">
            {mutation.isPending ? 'Saving…' : service ? 'Update' : 'Create'}
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
          <EnhancedScheduleDialog onClose={() => setIsCreateDialogOpen(false)} />
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
    mutationFn: () => apiRequest('DELETE', `/api/ai-features/schedules/${schedule.id}`),
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
              <EnhancedScheduleDialog
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

function BookingsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/ai-features/bookings', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter === 'needs_approval') {
        params.append('status', 'pending');
      } else if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const response = await fetch(`/api/ai-features/bookings?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const all = await response.json();
      if (statusFilter === 'needs_approval') {
        return all.filter((b: any) => b.approvalStatus === 'pending_approval');
      }
      return all;
    },
  });

  const { data: services } = useQuery<BookableService[]>({
    queryKey: ['/api/ai-features/services'],
  });
  const serviceMap = new Map((services || []).map(s => [s.id, s.name]));

  const needsApprovalCount = (bookings || []).filter((b: any) => b.approvalStatus === 'pending_approval').length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Bookings</h2>
          <p className="text-sm text-muted-foreground">View and manage client bookings</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-booking-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="needs_approval">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                Needs Approval
                {needsApprovalCount > 0 && <span className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 rounded-full">{needsApprovalCount}</span>}
              </span>
            </SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading bookings…</div>
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
              {bookings.map(booking => (
                <BookingRow key={booking.id} booking={booking} serviceMap={serviceMap} />
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No bookings found.</CardContent>
        </Card>
      )}
    </div>
  );
}

function BookingRow({ booking, serviceMap }: { booking: Booking; serviceMap: Map<string, string> }) {
  const { toast } = useToast();
  const bk = booking as any;

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest('PATCH', `/api/ai-features/bookings/${booking.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/bookings'] });
      toast({ description: 'Booking updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not update booking', variant: 'destructive' }),
  });

  const needsApproval = bk.approvalStatus === 'pending_approval';

  const getStatusBadge = () => {
    if (needsApproval) return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50"><AlertCircle className="w-3 h-3 mr-1" />Needs Approval</Badge>;
    switch (booking.status) {
      case 'confirmed':  return <Badge>Confirmed</Badge>;
      case 'pending':    return <Badge variant="secondary">Pending</Badge>;
      case 'cancelled':  return <Badge variant="destructive">Cancelled</Badge>;
      case 'completed':  return <Badge variant="outline">Completed</Badge>;
      default:           return <Badge variant="secondary">{booking.status}</Badge>;
    }
  };

  return (
    <TableRow data-testid={`row-booking-${booking.id}`}>
      <TableCell>
        <div className="font-medium">{booking.clientName}</div>
        <div className="text-sm text-muted-foreground">{booking.clientEmail}</div>
      </TableCell>
      <TableCell>{serviceMap.get(booking.serviceId) || booking.serviceId}</TableCell>
      <TableCell>
        <div className="text-sm">
          {new Date(booking.bookingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          <br />
          <span className="text-muted-foreground">{booking.bookingTime}</span>
        </div>
      </TableCell>
      <TableCell>{getStatusBadge()}</TableCell>
      <TableCell>
        <div className="flex gap-1.5 flex-wrap">
          {needsApproval && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => updateMutation.mutate({ status: 'confirmed', approvalStatus: 'approved' })}
                disabled={updateMutation.isPending}
                data-testid={`button-approve-booking-${booking.id}`}
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => updateMutation.mutate({ status: 'cancelled', approvalStatus: 'rejected' })}
                disabled={updateMutation.isPending}
                data-testid={`button-decline-booking-${booking.id}`}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Decline
              </Button>
            </>
          )}
          {!needsApproval && booking.status === 'pending' && (
            <Button
              size="sm"
              onClick={() => updateMutation.mutate({ status: 'confirmed' })}
              disabled={updateMutation.isPending}
              data-testid={`button-confirm-booking-${booking.id}`}
            >
              Confirm
            </Button>
          )}
          {(booking.status === 'pending' || booking.status === 'confirmed') && !needsApproval && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateMutation.mutate({ status: 'cancelled' })}
              disabled={updateMutation.isPending}
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
