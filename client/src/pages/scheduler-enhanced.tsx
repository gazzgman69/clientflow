import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Clock, Plus, Pencil, Trash2, X, Users, CalendarCheck, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { AvailabilitySchedule, BookableService, Member, CalendarIntegration, AvailabilityRule } from '@shared/schema';

// Enhanced schema for schedule with all new fields
const scheduleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  publicLink: z.string().optional(),
  isActive: z.boolean().default(true),
  // Booking Limitations
  minAdvanceNoticeHours: z.number().min(0).optional().nullable(),
  maxFutureDays: z.number().min(0).optional().nullable(),
  dailyBookingLimit: z.number().min(0).optional().nullable(),
  weeklyBookingLimit: z.number().min(0).optional().nullable(),
  cancellationPolicyHours: z.number().min(0).optional().nullable(),
  // Visual
  headerImageUrl: z.string().optional().nullable(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface EnhancedScheduleDialogProps {
  schedule?: AvailabilitySchedule;
  onClose: () => void;
}

function EnhancedScheduleDialog({ schedule, onClose }: EnhancedScheduleDialogProps) {
  const [activeSection, setActiveSection] = useState('basic');
  const { toast } = useToast();
  const isEditing = !!schedule;

  // Fetch all necessary data
  const { data: services = [] } = useQuery<BookableService[]>({
    queryKey: ['/api/ai-features/services'],
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['/api/members'],
  });

  const { data: calendars = [] } = useQuery<CalendarIntegration[]>({
    queryKey: ['/api/calendar-integrations'],
  });

  const { data: scheduleServices = [] } = useQuery({
    queryKey: [`/api/ai-features/schedules/${schedule?.id}/services`],
    enabled: isEditing,
  });

  const { data: scheduleRules = [] } = useQuery<AvailabilityRule[]>({
    queryKey: [`/api/ai-features/schedules/${schedule?.id}/rules`],
    enabled: isEditing,
  });

  const { data: scheduleTeamMembers = [] } = useQuery({
    queryKey: [`/api/ai-features/schedules/${schedule?.id}/team-members`],
    enabled: isEditing,
  });

  const { data: scheduleCalendarChecks = [] } = useQuery({
    queryKey: [`/api/ai-features/schedules/${schedule?.id}/calendar-checks`],
    enabled: isEditing,
  });

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: schedule?.name || '',
      publicLink: schedule?.publicLink || '',
      isActive: schedule?.isActive ?? true,
      minAdvanceNoticeHours: schedule?.minAdvanceNoticeHours || null,
      maxFutureDays: schedule?.maxFutureDays || null,
      dailyBookingLimit: schedule?.dailyBookingLimit || null,
      weeklyBookingLimit: schedule?.weeklyBookingLimit || null,
      cancellationPolicyHours: schedule?.cancellationPolicyHours || null,
      headerImageUrl: schedule?.headerImageUrl || null,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      if (isEditing) {
        return apiRequest('PATCH', `/api/ai-features/schedules/${schedule.id}`, data);
      } else {
        return apiRequest('POST', '/api/ai-features/schedules', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/schedules'] });
      toast({ description: `Schedule ${isEditing ? 'updated' : 'created'} successfully` });
      onClose();
    },
    onError: (error) => {
      console.error('Schedule mutation error:', error);
      toast({ 
        variant: 'destructive',
        description: `Failed to ${isEditing ? 'update' : 'create'} schedule` 
      });
    },
  });

  const onSubmit = (data: ScheduleFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit' : 'Create'} Availability Schedule</DialogTitle>
        <DialogDescription>
          Configure your availability settings, booking rules, and calendar integration
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeSection} onValueChange={setActiveSection}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="limitations">Booking Limits</TabsTrigger>
              <TabsTrigger value="rules">Availability Rules</TabsTrigger>
              <TabsTrigger value="team">Team & Calendars</TabsTrigger>
              <TabsTrigger value="visual">Visuals</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Consultation Call Availability" data-testid="input-schedule-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publicLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Link Slug</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="consultation-availability" data-testid="input-public-link" />
                    </FormControl>
                    <FormDescription>
                      Public booking page will be available at: /book/{field.value || 'your-slug'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Active Schedule</FormLabel>
                      <FormDescription>
                        Allow clients to book appointments using this schedule
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isEditing && (
                <ServicesAssignment scheduleId={schedule.id} services={services} />
              )}
            </TabsContent>

            {/* Booking Limitations Tab */}
            <TabsContent value="limitations" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Booking Limitations</h3>
                <p className="text-sm text-muted-foreground">
                  Control when and how clients can book appointments
                </p>
              </div>

              <div className="grid gap-6">
                <div className="space-y-4 rounded-lg border p-4">
                  <h4 className="font-medium">Advance Notice</h4>
                  <FormField
                    control={form.control}
                    name="minAdvanceNoticeHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum hours in advance</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="e.g., 24"
                            data-testid="input-min-advance-hours"
                          />
                        </FormControl>
                        <FormDescription>
                          Clients must book at least this many hours in advance
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxFutureDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum days in the future</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="e.g., 30"
                            data-testid="input-max-future-days"
                          />
                        </FormControl>
                        <FormDescription>
                          Clients can't book more than this many days ahead
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <h4 className="font-medium">Booking Limits</h4>
                  <FormField
                    control={form.control}
                    name="dailyBookingLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Daily booking limit</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="e.g., 5"
                            data-testid="input-daily-limit"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum bookings allowed per day (0 = unlimited)
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weeklyBookingLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weekly booking limit</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="e.g., 20"
                            data-testid="input-weekly-limit"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum bookings allowed per week (0 = unlimited)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <h4 className="font-medium">Cancellation Policy</h4>
                  <FormField
                    control={form.control}
                    name="cancellationPolicyHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cancellation notice (hours)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="e.g., 24"
                            data-testid="input-cancellation-hours"
                          />
                        </FormControl>
                        <FormDescription>
                          Clients can't cancel within this many hours of appointment
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Availability Rules Tab */}
            <TabsContent value="rules" className="space-y-4">
              {isEditing ? (
                <AvailabilityRulesManager scheduleId={schedule.id} rules={scheduleRules} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Save the schedule first to add availability rules</p>
                </div>
              )}
            </TabsContent>

            {/* Team & Calendars Tab */}
            <TabsContent value="team" className="space-y-6">
              {isEditing ? (
                <>
                  <TeamMembersManager 
                    scheduleId={schedule.id} 
                    members={members}
                    assignedMembers={scheduleTeamMembers}
                  />
                  <CalendarChecksManager 
                    scheduleId={schedule.id}
                    calendars={calendars}
                    assignedCalendars={scheduleCalendarChecks}
                  />
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Save the schedule first to configure team members and calendar checks</p>
                </div>
              )}
            </TabsContent>

            {/* Visual Tab */}
            <TabsContent value="visual" className="space-y-4">
              <FormField
                control={form.control}
                name="headerImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Header Image URL</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="https://example.com/header.jpg" />
                    </FormControl>
                    <FormDescription>
                      Optional header image for your public booking page
                    </FormDescription>
                  </FormItem>
                )}
              />

              {form.watch('headerImageUrl') && (
                <div className="rounded-lg border overflow-hidden">
                  <img 
                    src={form.watch('headerImageUrl') || ''} 
                    alt="Header preview" 
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/800x200?text=Invalid+Image+URL';
                    }}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-schedule">
              {saveMutation.isPending ? 'Saving...' : (isEditing ? 'Update Schedule' : 'Create Schedule')}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}

// Services Assignment Component
function ServicesAssignment({ scheduleId, services }: { scheduleId: string; services: BookableService[] }) {
  const { toast } = useToast();
  const { data: assignedServices = [] } = useQuery({
    queryKey: [`/api/ai-features/schedules/${scheduleId}/services`],
  });

  const assignedServiceIds = new Set(assignedServices.map((s: any) => s.serviceId));

  const toggleService = useMutation({
    mutationFn: async ({ serviceId, isAssigned }: { serviceId: string; isAssigned: boolean }) => {
      if (isAssigned) {
        return apiRequest('DELETE', `/api/ai-features/schedules/${scheduleId}/services/${serviceId}`);
      } else {
        return apiRequest('POST', `/api/ai-features/schedules/${scheduleId}/services`, { serviceId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-features/schedules/${scheduleId}/services`] });
    },
  });

  return (
    <div className="space-y-3">
      <Label>Services Available on This Schedule</Label>
      <div className="space-y-2">
        {services.map((service) => {
          const isAssigned = assignedServiceIds.has(service.id);
          return (
            <div key={service.id} className="flex items-center space-x-2">
              <Checkbox
                checked={isAssigned}
                onCheckedChange={() => toggleService.mutate({ serviceId: service.id, isAssigned })}
                data-testid={`checkbox-service-${service.id}`}
              />
              <Label className="font-normal cursor-pointer" htmlFor={service.id}>
                {service.name} <span className="text-muted-foreground">({service.duration} min)</span>
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Availability Rules Manager Component
function AvailabilityRulesManager({ scheduleId, rules }: { scheduleId: string; rules: AvailabilityRule[] }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AvailabilityRule | null>(null);
  const { toast } = useToast();

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => apiRequest('DELETE', `/api/ai-features/rules/${ruleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-features/schedules/${scheduleId}/rules`] });
      toast({ description: 'Availability rule deleted' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Availability Rules</h3>
          <p className="text-sm text-muted-foreground">
            Define when time slots are available for booking
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge>{rule.frequency}</Badge>
                      <span className="text-sm font-medium">
                        {rule.timeStart} - {rule.timeEnd}
                      </span>
                    </div>
                    {rule.selectedDays && rule.selectedDays.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Days: {rule.selectedDays.join(', ')}
                      </p>
                    )}
                    {(rule.dateStart || rule.dateEnd) && (
                      <p className="text-sm text-muted-foreground">
                        {rule.dateStart ? new Date(rule.dateStart).toLocaleDateString() : 'No start'} 
                        {' → '}
                        {rule.dateEnd ? new Date(rule.dateEnd).toLocaleDateString() : 'No end'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No availability rules yet. Add a rule to define when slots are available.
          </CardContent>
        </Card>
      )}

      {(isAddDialogOpen || editingRule) && (
        <RuleDialog
          scheduleId={scheduleId}
          rule={editingRule}
          onClose={() => {
            setIsAddDialogOpen(false);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

// Rule Dialog Component
const ruleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  selectedDays: z.array(z.string()).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  timeStart: z.string().min(1, 'Start time is required'),
  timeEnd: z.string().min(1, 'End time is required'),
  isException: z.boolean().default(false),
});

type RuleFormData = z.infer<typeof ruleSchema>;

function RuleDialog({ scheduleId, rule, onClose }: { scheduleId: string; rule: AvailabilityRule | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEditing = !!rule;

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      frequency: rule?.frequency as any || 'weekly',
      selectedDays: rule?.selectedDays || [],
      dateStart: rule?.dateStart ? new Date(rule.dateStart).toISOString().split('T')[0] : '',
      dateEnd: rule?.dateEnd ? new Date(rule.dateEnd).toISOString().split('T')[0] : '',
      timeStart: rule?.timeStart || '09:00',
      timeEnd: rule?.timeEnd || '17:00',
      isException: rule?.isException || false,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const payload = {
        ...data,
        scheduleId,
        dateStart: data.dateStart ? new Date(data.dateStart).toISOString() : null,
        dateEnd: data.dateEnd ? new Date(data.dateEnd).toISOString() : null,
      };

      if (isEditing) {
        return apiRequest('PATCH', `/api/ai-features/rules/${rule.id}`, payload);
      } else {
        return apiRequest('POST', `/api/ai-features/schedules/${scheduleId}/rules`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-features/schedules/${scheduleId}/rules`] });
      toast({ description: `Rule ${isEditing ? 'updated' : 'created'} successfully` });
      onClose();
    },
  });

  const frequency = form.watch('frequency');
  const dayOptions = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Availability Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repeat Frequency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {frequency === 'weekly' && (
              <FormField
                control={form.control}
                name="selectedDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat On</FormLabel>
                    <div className="flex gap-2">
                      {dayOptions.map((day) => (
                        <div key={day} className="flex items-center">
                          <Checkbox
                            checked={field.value?.includes(day)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, day]);
                              } else {
                                field.onChange(current.filter((d) => d !== day));
                              }
                            }}
                          />
                          <Label className="ml-1 text-xs">{day}</Label>
                        </div>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timeStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isException"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Block out time (exception)</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Rule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Team Members Manager
function TeamMembersManager({ scheduleId, members, assignedMembers }: any) {
  const { toast } = useToast();
  const assignedMemberIds = new Set(assignedMembers.map((m: any) => m.memberId));

  const toggleMember = useMutation({
    mutationFn: async ({ memberId, isAssigned }: { memberId: string; isAssigned: boolean }) => {
      if (isAssigned) {
        return apiRequest('DELETE', `/api/ai-features/schedules/${scheduleId}/team-members/${memberId}`);
      } else {
        return apiRequest('POST', `/api/ai-features/schedules/${scheduleId}/team-members`, { memberId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-features/schedules/${scheduleId}/team-members`] });
    },
  });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" />
        <h3 className="text-lg font-medium">Team Members</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Select team members who can provide services on this schedule
      </p>
      <div className="space-y-2">
        {members.map((member: Member) => {
          const isAssigned = assignedMemberIds.has(member.id);
          return (
            <div key={member.id} className="flex items-center space-x-2">
              <Checkbox
                checked={isAssigned}
                onCheckedChange={() => toggleMember.mutate({ memberId: member.id, isAssigned })}
              />
              <Label className="font-normal">{member.name}</Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Calendar Checks Manager
function CalendarChecksManager({ scheduleId, calendars, assignedCalendars }: any) {
  const { toast } = useToast();
  const assignedCalendarIds = new Set(assignedCalendars.map((c: any) => c.calendarIntegrationId));

  const toggleCalendar = useMutation({
    mutationFn: async ({ calendarId, isAssigned }: { calendarId: string; isAssigned: boolean }) => {
      if (isAssigned) {
        return apiRequest('DELETE', `/api/ai-features/schedules/${scheduleId}/calendar-checks/${calendarId}`);
      } else {
        return apiRequest('POST', `/api/ai-features/schedules/${scheduleId}/calendar-checks`, { 
          calendarIntegrationId: calendarId 
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-features/schedules/${scheduleId}/calendar-checks`] });
    },
  });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <CalendarCheck className="w-5 h-5" />
        <h3 className="text-lg font-medium">Calendar Conflict Checking</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Check these calendars for conflicts before allowing bookings
      </p>
      <div className="space-y-2">
        {calendars.map((calendar: CalendarIntegration) => {
          const isAssigned = assignedCalendarIds.has(calendar.id);
          return (
            <div key={calendar.id} className="flex items-center space-x-2">
              <Checkbox
                checked={isAssigned}
                onCheckedChange={() => toggleCalendar.mutate({ calendarId: calendar.id, isAssigned })}
              />
              <Label className="font-normal">
                {calendar.provider} - {calendar.accountEmail}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { EnhancedScheduleDialog };
