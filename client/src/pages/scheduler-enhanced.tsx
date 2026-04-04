import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Pencil, Trash2, ArrowLeft, ChevronDown, Users,
  CalendarCheck, AlertCircle, X,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { AvailabilitySchedule, BookableService, Member, CalendarIntegration, AvailabilityRule } from '@shared/schema';

/* ─── Form schema ────────────────────────────────────────────────────────────── */

const scheduleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  publicLink: z.string().optional(),
  isActive: z.boolean().default(true),
  headerImageUrl: z.string().optional().nullable(),
  // Booking limitations (null = unlimited / disabled)
  minAdvanceNoticeEnabled: z.boolean().default(false),
  minAdvanceNoticeHours: z.number().min(0).optional().nullable(),
  maxFutureDaysEnabled: z.boolean().default(false),
  maxFutureDays: z.number().min(0).optional().nullable(),
  dailyLimitEnabled: z.boolean().default(false),
  dailyBookingLimit: z.number().min(0).optional().nullable(),
  weeklyLimitEnabled: z.boolean().default(false),
  weeklyBookingLimit: z.number().min(0).optional().nullable(),
  cancellationPolicyEnabled: z.boolean().default(false),
  cancellationPolicyHours: z.number().min(0).optional().nullable(),
  // Per-schedule overrides (enabled = override active; value = what to override with)
  requirePhoneOverrideEnabled: z.boolean().default(false),
  requirePhoneOverride: z.boolean().default(false),
  disableTimezonePreviewOverrideEnabled: z.boolean().default(false),
  disableTimezonePreviewOverride: z.boolean().default(false),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

/* ─── Schedule Settings Page (full-page, 5 sections) ────────────────────────── */

function ScheduleSettingsPage({
  schedule,
  onClose,
}: {
  schedule?: AvailabilitySchedule;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!schedule;
  const sched = schedule as any;

  // Which sections are expanded
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    1: true, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false,
  });
  const toggleSection = (n: number) =>
    setOpenSections(prev => ({ ...prev, [n]: !prev[n] }));

  /* ── Data queries ── */
  const { data: services = [] } = useQuery<BookableService[]>({
    queryKey: ['/api/ai-features/services'],
  });
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['/api/members'],
  });
  const { data: calendars = [] } = useQuery<CalendarIntegration[]>({
    queryKey: ['/api/calendar-integrations'],
  });
  const { data: scheduleRules = [] } = useQuery<AvailabilityRule[]>({
    queryKey: [`/api/ai-features/schedules/${schedule?.id}/rules`],
    enabled: isEditing,
  });
  const { data: scheduleTeamMembers = [] } = useQuery<any[]>({
    queryKey: [`/api/ai-features/schedules/${schedule?.id}/team-members`],
    enabled: isEditing,
  });
  const { data: scheduleCalendarChecks = [] } = useQuery<any[]>({
    queryKey: [`/api/ai-features/schedules/${schedule?.id}/calendar-checks`],
    enabled: isEditing,
  });

  /* ── Form ── */
  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: sched?.name || '',
      publicLink: sched?.publicLink || '',
      isActive: sched?.isActive ?? true,
      headerImageUrl: sched?.headerImageUrl || null,
      minAdvanceNoticeEnabled: !!sched?.minAdvanceNoticeHours,
      minAdvanceNoticeHours: sched?.minAdvanceNoticeHours || 24,
      maxFutureDaysEnabled: !!sched?.maxFutureDays,
      maxFutureDays: sched?.maxFutureDays || 30,
      dailyLimitEnabled: !!sched?.dailyBookingLimit,
      dailyBookingLimit: sched?.dailyBookingLimit || 5,
      weeklyLimitEnabled: !!sched?.weeklyBookingLimit,
      weeklyBookingLimit: sched?.weeklyBookingLimit || 20,
      cancellationPolicyEnabled: !!sched?.cancellationPolicyHours,
      cancellationPolicyHours: sched?.cancellationPolicyHours || 24,
      requirePhoneOverrideEnabled: sched?.requirePhoneOverride != null,
      requirePhoneOverride: sched?.requirePhoneOverride ?? false,
      disableTimezonePreviewOverrideEnabled: sched?.disableTimezonePreviewOverride != null,
      disableTimezonePreviewOverride: sched?.disableTimezonePreviewOverride ?? false,
    },
  });

  // Auto-generate slug from name when creating a new schedule
  const watchedName = form.watch('name');
  useEffect(() => {
    if (!isEditing) {
      const slug = watchedName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 60);
      form.setValue('publicLink', slug, { shouldDirty: false });
    }
  }, [watchedName, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      const payload = {
        name: data.name,
        publicLink: data.publicLink || null,
        isActive: data.isActive,
        headerImageUrl: data.headerImageUrl || null,
        minAdvanceNoticeHours: data.minAdvanceNoticeEnabled ? (data.minAdvanceNoticeHours ?? null) : null,
        maxFutureDays: data.maxFutureDaysEnabled ? (data.maxFutureDays ?? null) : null,
        dailyBookingLimit: data.dailyLimitEnabled ? (data.dailyBookingLimit ?? null) : null,
        weeklyBookingLimit: data.weeklyLimitEnabled ? (data.weeklyBookingLimit ?? null) : null,
        cancellationPolicyHours: data.cancellationPolicyEnabled ? (data.cancellationPolicyHours ?? null) : null,
        requirePhoneOverride: data.requirePhoneOverrideEnabled ? data.requirePhoneOverride : null,
        disableTimezonePreviewOverride: data.disableTimezonePreviewOverrideEnabled ? data.disableTimezonePreviewOverride : null,
      };
      if (isEditing) {
        return apiRequest('PATCH', `/api/ai-features/schedules/${schedule.id}`, payload);
      }
      return apiRequest('POST', '/api/ai-features/schedules', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/schedules'] });
      toast({ description: `Schedule ${isEditing ? 'updated' : 'created'} successfully` });
      onClose();
    },
    onError: () => {
      toast({ variant: 'destructive', description: `Failed to ${isEditing ? 'update' : 'create'} schedule` });
    },
  });

  /* ── Section Header ── */
  function SectionHeader({ n, title, isOpen }: { n: number; title: string; isOpen: boolean }) {
    return (
      <div
        className="flex items-center gap-3 px-6 py-4 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => toggleSection(n)}
      >
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {n}
        </span>
        <span className="font-semibold text-sm tracking-wide uppercase flex-1 text-gray-700">
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>
    );
  }

  /* ── Locked section message (requires schedule to exist first) ── */
  const SaveFirstNotice = () => (
    <div className="px-6 pb-6">
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        Save the schedule name first, then come back to configure this section.
      </div>
    </div>
  );

  /* ────────────────────────────── RENDER ──────────────────────────────────── */
  return (
    <div
      className="bg-white rounded-xl border shadow-sm overflow-hidden"
      data-testid="schedule-settings-page"
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Schedules
          </Button>
          <span className="text-gray-300">|</span>
          <h2 className="text-base font-semibold">Schedule Settings</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={form.handleSubmit((data) => saveMutation.mutate(data))}
            disabled={saveMutation.isPending}
            data-testid="button-save-schedule"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Sections ── */}
      <Form {...form}>
        <div className="divide-y">

          {/* ①  NAME & SERVICES ──────────────────────────────────── */}
          <div>
            <SectionHeader n={1} title="Name & Services" isOpen={openSections[1]} />
            {openSections[1] && (
              <div className="px-6 pb-6 space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Availability Schedule Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Consultation Call Availability"
                          className="mt-1"
                          data-testid="input-schedule-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publicLink"
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel>Public Link Slug</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="consultation-availability"
                          className="mt-1"
                          data-testid="input-public-link"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Booking page: /book/{field.value || 'your-slug'}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-pointer">Schedule is active</FormLabel>
                    </FormItem>
                  )}
                />

                <div>
                  <Label className="text-sm font-medium">Services Available on This Schedule</Label>
                  {isEditing ? (
                    <ServicesAssignment scheduleId={schedule.id} services={services} />
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      Save the schedule first to assign services.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ②  SCHEDULING HEADER IMAGE ───────────────────────────── */}
          <div>
            <SectionHeader n={2} title="Scheduling Header Image" isOpen={openSections[2]} />
            {openSections[2] && (
              <div className="px-6 pb-6 space-y-4">
                <FormField
                  control={form.control}
                  name="headerImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="https://example.com/header.jpg"
                          className="mt-1 max-w-md"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Optional header image shown at the top of your public booking page.
                      </p>
                    </FormItem>
                  )}
                />
                {form.watch('headerImageUrl') && (
                  <div className="rounded-lg border overflow-hidden max-w-md">
                    <img
                      src={form.watch('headerImageUrl') || ''}
                      alt="Header preview"
                      className="w-full h-40 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/800x160?text=Invalid+URL';
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ③  TEAM MEMBERS ──────────────────────────────────────── */}
          <div>
            <SectionHeader n={3} title="Team Members" isOpen={openSections[3]} />
            {openSections[3] && (
              isEditing ? (
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Select team members who offer services on this schedule.
                  </p>
                  <TeamMembersManager
                    scheduleId={schedule.id}
                    members={members}
                    assignedMembers={scheduleTeamMembers}
                  />
                </div>
              ) : (
                <SaveFirstNotice />
              )
            )}
          </div>

          {/* ④  CALENDAR CHECKS ───────────────────────────────────── */}
          <div>
            <SectionHeader n={4} title="Calendar Checks" isOpen={openSections[4]} />
            {openSections[4] && (
              isEditing ? (
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose calendars to cross-check for conflicts before allowing bookings.
                  </p>
                  <CalendarChecksManager
                    scheduleId={schedule.id}
                    calendars={calendars}
                    assignedCalendars={scheduleCalendarChecks}
                  />
                </div>
              ) : (
                <SaveFirstNotice />
              )
            )}
          </div>

          {/* ⑤  BOOKING LIMITATIONS ──────────────────────────────── */}
          <div>
            <SectionHeader n={5} title="Booking Limitations" isOpen={openSections[5]} />
            {openSections[5] && (
              <div className="px-6 pb-6 space-y-5">
                <p className="text-sm text-muted-foreground">
                  Control when and how clients can book or change appointments.
                </p>

                {/* Prevent clients from scheduling less than X hours in advance */}
                <LimitRow
                  form={form}
                  toggleKey="minAdvanceNoticeEnabled"
                  valueKey="minAdvanceNoticeHours"
                  label="less than"
                  unit="hours in advance"
                  prefix="Prevent clients from scheduling"
                />

                {/* Prevent clients from scheduling more than X days in the future */}
                <LimitRow
                  form={form}
                  toggleKey="maxFutureDaysEnabled"
                  valueKey="maxFutureDays"
                  label="more than"
                  unit="days in the future"
                  prefix="Prevent clients from scheduling"
                />

                <div className="border-t pt-4 space-y-4">
                  <p className="text-sm font-medium text-gray-700">Limit the Number of Time Slots Booked</p>

                  <LimitRow
                    form={form}
                    toggleKey="dailyLimitEnabled"
                    valueKey="dailyBookingLimit"
                    label="Daily"
                    unit="per day"
                  />

                  <LimitRow
                    form={form}
                    toggleKey="weeklyLimitEnabled"
                    valueKey="weeklyBookingLimit"
                    label="Weekly"
                    unit="per week"
                  />
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Prevent Cancelling or Changing Appointments
                  </p>
                  <LimitRow
                    form={form}
                    toggleKey="cancellationPolicyEnabled"
                    valueKey="cancellationPolicyHours"
                    label="less than"
                    unit="hours in advance"
                    prefix="Prevent changes"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ⑥  AVAILABILITY RULES ────────────────────────────────── */}
          <div>
            <SectionHeader n={6} title="Availability Rules" isOpen={openSections[6]} />
            {openSections[6] && (
              isEditing ? (
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Define the days and times when this schedule is open for bookings.
                  </p>
                  <AvailabilityRulesManager
                    scheduleId={schedule.id}
                    rules={scheduleRules}
                  />
                </div>
              ) : (
                <SaveFirstNotice />
              )
            )}
          </div>

          {/* ⑦  SETTINGS OVERRIDE ────────────────────────────────── */}
          <div>
            <SectionHeader n={7} title="Settings (Override Global)" isOpen={openSections[7]} />
            {openSections[7] && (
              <div className="px-6 pb-6 space-y-5">
                <p className="text-sm text-muted-foreground">
                  These override the global scheduler settings for this schedule only.
                  Leave as <strong>Use global</strong> to inherit from the Settings tab.
                </p>

                <OverrideRow
                  label="Require Phone Number"
                  description="Require clients to provide a phone number when booking."
                  form={form}
                  enabledKey="requirePhoneOverrideEnabled"
                  valueKey="requirePhoneOverride"
                />

                <OverrideRow
                  label="Turn Off Time Zone Preview"
                  description="Only show times in your timezone; block clients from switching."
                  form={form}
                  enabledKey="disableTimezonePreviewOverrideEnabled"
                  valueKey="disableTimezonePreviewOverride"
                />
              </div>
            )}
          </div>

        </div>{/* end sections */}
      </Form>
    </div>
  );
}

/* ─── Limit Row helper ───────────────────────────────────────────────────────── */

function LimitRow({ form, toggleKey, valueKey, label, unit, prefix }: {
  form: any;
  toggleKey: string;
  valueKey: string;
  label: string;
  unit: string;
  prefix?: string;
}) {
  const enabled = form.watch(toggleKey);
  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={enabled}
        onCheckedChange={(v: boolean) => form.setValue(toggleKey, v)}
      />
      {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <Input
        type="number"
        className={`w-20 text-center ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}
        value={form.watch(valueKey) ?? 0}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          form.setValue(valueKey, parseInt(e.target.value) || 0)
        }
        disabled={!enabled}
      />
      <span className="text-sm text-gray-500">{unit}</span>
    </div>
  );
}

/* ─── Services Assignment ────────────────────────────────────────────────────── */

function ServicesAssignment({ scheduleId, services }: { scheduleId: string; services: BookableService[] }) {
  const { data: assignedServices = [] } = useQuery({
    queryKey: [`/api/ai-features/schedules/${scheduleId}/services`],
  });

  const assignedServiceIds = new Set(assignedServices.map((s: any) => s.serviceId));

  const toggleService = useMutation({
    mutationFn: async ({ serviceId, isAssigned }: { serviceId: string; isAssigned: boolean }) => {
      if (isAssigned) {
        return apiRequest('DELETE', `/api/ai-features/schedules/${scheduleId}/services/${serviceId}`);
      }
      return apiRequest('POST', `/api/ai-features/schedules/${scheduleId}/services`, { serviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/ai-features/schedules/${scheduleId}/services`],
      });
    },
  });

  // Currently assigned services (shown as tags)
  const assigned = services.filter(s => assignedServiceIds.has(s.id));
  // Available to add
  const available = services.filter(s => !assignedServiceIds.has(s.id));

  return (
    <div className="mt-2 space-y-3">
      {/* Assigned list */}
      {assigned.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assigned.map(s => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-sm px-3 py-1 rounded-full"
            >
              {s.name}
              <button
                type="button"
                onClick={() => toggleService.mutate({ serviceId: s.id, isAssigned: true })}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add dropdown */}
      {available.length > 0 && (
        <Select
          value=""
          onValueChange={serviceId =>
            toggleService.mutate({ serviceId, isAssigned: false })
          }
        >
          <SelectTrigger className="max-w-xs text-muted-foreground">
            <SelectValue placeholder="Select a service to add" />
          </SelectTrigger>
          <SelectContent>
            {available.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.duration} min)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {services.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No services yet. Create a service in the Services tab first.
        </p>
      )}

      {assigned.length === 0 && available.length > 0 && (
        <p className="text-xs text-red-500">At least one service is required.</p>
      )}
    </div>
  );
}

/* ─── Availability Rules Manager ────────────────────────────────────────────── */

function AvailabilityRulesManager({ scheduleId, rules }: { scheduleId: string; rules: AvailabilityRule[] }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AvailabilityRule | null>(null);
  const { toast } = useToast();

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => apiRequest('DELETE', `/api/ai-features/rules/${ruleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-features/schedules/${scheduleId}/rules`] });
      toast({ description: 'Rule deleted' });
    },
  });

  return (
    <div className="space-y-4">
      {rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between bg-gray-50 border rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="secondary">{rule.frequency}</Badge>
                <span className="font-medium">{rule.timeStart} – {rule.timeEnd}</span>
                {rule.selectedDays && rule.selectedDays.length > 0 && (
                  <span className="text-muted-foreground">{rule.selectedDays.join(', ')}</span>
                )}
                {rule.isException && <Badge variant="destructive">Blocked</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditingRule(rule)}>
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
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No rules yet. Add a rule to define when time slots are available.
        </p>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
        <Plus className="w-3 h-3 mr-1" /> Add Rule
      </Button>

      {(isAddDialogOpen || editingRule) && (
        <RuleDialog
          scheduleId={scheduleId}
          rule={editingRule}
          onClose={() => { setIsAddDialogOpen(false); setEditingRule(null); }}
        />
      )}
    </div>
  );
}

/* ─── Rule Dialog ────────────────────────────────────────────────────────────── */

const ruleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  selectedDays: z.array(z.string()).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  timeStart: z.string().min(1, 'Start time required'),
  timeEnd: z.string().min(1, 'End time required'),
  isException: z.boolean().default(false),
});

type RuleFormData = z.infer<typeof ruleSchema>;

function RuleDialog({
  scheduleId,
  rule,
  onClose,
}: {
  scheduleId: string;
  rule: AvailabilityRule | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!rule;

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      frequency: (rule?.frequency as any) || 'weekly',
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
      if (isEditing) return apiRequest('PATCH', `/api/ai-features/rules/${rule.id}`, payload);
      return apiRequest('POST', `/api/ai-features/schedules/${scheduleId}/rules`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-features/schedules/${scheduleId}/rules`] });
      toast({ description: `Rule ${isEditing ? 'updated' : 'created'}` });
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
                      <SelectTrigger className="mt-1">
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
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {dayOptions.map((day) => (
                        <label
                          key={day}
                          className={`flex items-center justify-center w-9 h-9 rounded-full border text-xs font-medium cursor-pointer transition-colors ${
                            field.value?.includes(day)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          <Checkbox
                            checked={field.value?.includes(day)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              field.onChange(
                                checked ? [...current, day] : current.filter((d) => d !== day)
                              );
                            }}
                            className="sr-only"
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timeStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} className="mt-1" />
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
                      <Input type="time" {...field} className="mt-1" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="mt-1" />
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
                      <Input type="date" {...field} className="mt-1" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isException"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0 cursor-pointer">Block out time (exception)</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save Rule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Team Members Manager ───────────────────────────────────────────────────── */

function TeamMembersManager({ scheduleId, members, assignedMembers }: {
  scheduleId: string;
  members: Member[];
  assignedMembers: any[];
}) {
  const assignedMemberIds = new Set(assignedMembers.map((m: any) => m.memberId));

  const toggleMember = useMutation({
    mutationFn: async ({ memberId, isAssigned }: { memberId: string; isAssigned: boolean }) => {
      if (isAssigned) {
        return apiRequest('DELETE', `/api/ai-features/schedules/${scheduleId}/team-members/${memberId}`);
      }
      return apiRequest('POST', `/api/ai-features/schedules/${scheduleId}/team-members`, { memberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/ai-features/schedules/${scheduleId}/team-members`],
      });
    },
  });

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No team members found. Add team members in your account settings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member: Member) => {
        const isAssigned = assignedMemberIds.has(member.id);
        return (
          <div key={member.id} className="flex items-center gap-3">
            <Switch
              checked={isAssigned}
              onCheckedChange={() => toggleMember.mutate({ memberId: member.id, isAssigned })}
            />
            <span className="text-sm font-medium">{member.name}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Calendar Checks Manager ───────────────────────────────────────────────── */

function CalendarChecksManager({ scheduleId, calendars, assignedCalendars }: {
  scheduleId: string;
  calendars: CalendarIntegration[];
  assignedCalendars: any[];
}) {
  const assignedCalendarIds = new Set(assignedCalendars.map((c: any) => c.calendarIntegrationId));

  const toggleCalendar = useMutation({
    mutationFn: async ({ calendarId, isAssigned }: { calendarId: string; isAssigned: boolean }) => {
      if (isAssigned) {
        return apiRequest('DELETE', `/api/ai-features/schedules/${scheduleId}/calendar-checks/${calendarId}`);
      }
      return apiRequest('POST', `/api/ai-features/schedules/${scheduleId}/calendar-checks`, {
        calendarIntegrationId: calendarId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/ai-features/schedules/${scheduleId}/calendar-checks`],
      });
    },
  });

  if (calendars.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No calendars connected. Connect a Google Calendar in the Calendar section.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {calendars.map((calendar: CalendarIntegration) => {
        const isAssigned = assignedCalendarIds.has(calendar.id);
        return (
          <div key={calendar.id} className="flex items-center gap-3">
            <Switch
              checked={isAssigned}
              onCheckedChange={() => toggleCalendar.mutate({ calendarId: calendar.id, isAssigned })}
            />
            <span className="text-sm font-medium">
              {(calendar as any).accountEmail || calendar.provider}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Override Row helper ────────────────────────────────────────────────────── */

function OverrideRow({ label, description, form, enabledKey, valueKey }: {
  label: string;
  description: string;
  form: any;
  enabledKey: string;
  valueKey: string;
}) {
  const isOverriding = form.watch(enabledKey);
  const overrideValue = form.watch(valueKey);

  return (
    <div className="flex items-start gap-4 border rounded-lg p-4 bg-gray-50">
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {isOverriding ? (
          <>
            <Switch
              checked={overrideValue}
              onCheckedChange={(v: boolean) => form.setValue(valueKey, v)}
            />
            <span className="text-xs font-medium text-blue-600">{overrideValue ? 'On' : 'Off'}</span>
            <button
              type="button"
              onClick={() => form.setValue(enabledKey, false)}
              className="text-xs text-muted-foreground hover:text-gray-800 underline"
            >
              Use global
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => form.setValue(enabledKey, true)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Override
          </button>
        )}
      </div>
    </div>
  );
}

export { ScheduleSettingsPage };

// Backward-compatible export alias
export { ScheduleSettingsPage as EnhancedScheduleDialog };
