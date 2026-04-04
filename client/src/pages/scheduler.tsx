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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, Clock, Plus, Pencil, Trash2, Copy, ExternalLink,
  Check, X, AlertCircle, Code2, ChevronDown, ArrowLeft, User, Users,
  Settings, HelpCircle, Phone, Globe,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { BookableService, AvailabilitySchedule, Booking } from '@shared/schema';
import { ScheduleSettingsPage } from './scheduler-enhanced';

export default function Scheduler() {
  const [activeTab, setActiveTab] = useState('services');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Scheduler</h1>
        <p className="text-muted-foreground mt-2">
          Manage your bookable services, availability schedules, and appointments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="services" data-testid="tab-services" className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Services
          </TabsTrigger>
          <TabsTrigger value="availability" data-testid="tab-availability" className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Availability
          </TabsTrigger>
          <TabsTrigger value="bookings" data-testid="tab-bookings" className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Bookings
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings" className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" /> Settings
          </TabsTrigger>
          <TabsTrigger value="help" data-testid="tab-help" className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" /> Help
          </TabsTrigger>
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

        <TabsContent value="settings" className="mt-6">
          <SchedulerSettingsTab />
        </TabsContent>

        <TabsContent value="help" className="mt-6">
          <SchedulerHelpTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Scheduler Settings Tab ─────────────────────────────────────────────────── */

function SchedulerSettingsTab() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['/api/ai-features/scheduler-settings'],
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PATCH', '/api/ai-features/scheduler-settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-features/scheduler-settings'] });
      toast({ description: 'Settings saved' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' }),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading settings…</div>;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardContent className="pt-6">
          <div className="mb-5">
            <h2 className="text-base font-bold uppercase tracking-wide">Settings</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Select settings for your booking form</p>
          </div>
          <div className="divide-y">

            {/* Require Phone */}
            <div className="flex items-start gap-4 py-5">
              <Switch
                checked={settings?.requirePhone ?? false}
                onCheckedChange={v => updateMutation.mutate({ requirePhone: v })}
                disabled={updateMutation.isPending}
              />
              <div>
                <p className="font-semibold text-sm">Require Phone Number When Making Booking</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  When your contact makes a booking, require them to fill out their phone number.
                </p>
              </div>
            </div>

            {/* Disable Timezone Preview */}
            <div className="flex items-start gap-4 py-5">
              <Switch
                checked={settings?.disableTimezonePreview ?? false}
                onCheckedChange={v => updateMutation.mutate({ disableTimezonePreview: v })}
                disabled={updateMutation.isPending}
              />
              <div>
                <p className="font-semibold text-sm">Turn Off Time Zone Preview</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Only show your available booking times in your time zone. Do not allow your contacts
                  to change the time zone to preview the times in their time zone.
                </p>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Scheduler Help Tab ─────────────────────────────────────────────────────── */

function SchedulerHelpTab() {
  return (
    <div className="max-w-2xl">
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-bold uppercase tracking-wide mb-4">About Online Scheduling</h2>
          <div className="border-t pt-4 space-y-4 text-sm text-gray-700 leading-relaxed">
            <p>
              Online Scheduling will allow your contacts to easily schedule a service (appointment,
              consultation, event, session, etc.) with just a few clicks of a button.
            </p>
            <p>
              Contacts can access your availability calendar to book an appointment through a link
              you share with them, or you can embed your schedule on your website. Once they select
              the date and time and complete their basic information, they'll receive a confirmation
              email — and you can automatically send a contract, invoice, or trigger other actions.
            </p>
            <p>
              Use the <strong>Services</strong> tab to define what clients can book, the{' '}
              <strong>Availability</strong> tab to set your working hours and booking rules, and the{' '}
              <strong>Settings</strong> tab to configure global preferences like phone number
              requirements and timezone display.
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Tip: you can embed any schedule on your own website using the embed code button (
              <Code2 className="w-3.5 h-3.5 inline" />) next to each schedule.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Services Tab ───────────────────────────────────────────────────────────── */

function ServicesTab() {
  const [editingService, setEditingService] = useState<BookableService | 'new' | null>(null);

  const { data: services, isLoading } = useQuery<BookableService[]>({
    queryKey: ['/api/ai-features/services'],
  });

  // When editing, replace the tab content with the full-page editor
  if (editingService !== null) {
    return (
      <ServiceSettingsPage
        service={editingService === 'new' ? undefined : editingService}
        onClose={() => setEditingService(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Bookable Services</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage services that clients can book
          </p>
        </div>
        <Button data-testid="button-create-service" onClick={() => setEditingService('new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading services...</div>
      ) : services && services.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} onEdit={() => setEditingService(service)} />
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

function ServiceCard({ service, onEdit }: { service: BookableService; onEdit: () => void }) {
  const { toast } = useToast();
  const svc = service as any;

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
            <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-service-${service.id}`}>
              <Pencil className="w-4 h-4" />
            </Button>
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
          {svc.price && (
            <div className="text-muted-foreground">{svc.price}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Service Questions type ─────────────────────────────────────────────────── */
type QuestionType = 'text' | 'textarea' | 'yes_no' | 'select' | 'checkboxes' | 'date' | 'display_text';
interface ServiceQuestion {
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
}

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'text',         label: 'Short Answer',       description: 'Single line of text' },
  { value: 'textarea',     label: 'Long Answer',        description: 'Multiple lines of text' },
  { value: 'yes_no',       label: 'Yes / No',           description: 'Simple yes or no' },
  { value: 'select',       label: 'Choose from a List', description: 'One answer from a list' },
  { value: 'checkboxes',   label: 'Checkboxes',         description: 'Multiple answers from a list' },
  { value: 'date',         label: 'Date',               description: 'Pick a date' },
  { value: 'display_text', label: 'Text / Instructions','description': 'Display-only text block' },
];

/* ─── Service Settings Page (full-page, 12 sections) ────────────────────────── */

function ServiceSettingsPage({ service, onClose }: { service?: BookableService; onClose: () => void }) {
  const svc = service as any;
  const { toast } = useToast();

  /* ── Form state ── */
  const [formData, setFormData] = useState({
    // 1. Service Details
    serviceType: svc?.serviceType || 'individual',
    name: svc?.name || '',
    description: svc?.description || '',
    price: svc?.price || '',

    // 2. Service Time Frame
    duration: svc?.duration || 60,
    bufferBefore: svc?.bufferBefore || 0,
    bufferAfter: svc?.bufferAfter || 0,
    startTimeInterval: svc?.startTimeInterval || 30,

    // 3. Service Questions (toggle)
    questionsEnabled: !!(svc?.serviceQuestions && svc.serviceQuestions !== '[]'),

    // 4. Online Payments (toggle)
    enableOnlinePayments: !!svc?.enableOnlinePayments,
    paymentAmount: svc?.paymentAmount || '',
    paymentType: svc?.paymentType || 'deposit',

    // 5. Service Location (toggle)
    locationEnabled: !!svc?.location,
    location: svc?.location || '',
    locationDetails: svc?.locationDetails || '',

    // 6. Booking Messaging
    termsOfServiceTemplateId: svc?.termsOfServiceTemplateId || '',
    confirmationMessageTemplateId: svc?.confirmationMessageTemplateId || '',

    // 7. Project Management
    addContactTags: (svc?.addContactTags || []).join(', '),
    addProjectTags: (svc?.addProjectTags || []).join(', '),
    removeProjectTags: (svc?.removeProjectTags || []).join(', '),
    autoCreateProject: !!svc?.autoCreateProject,
    updateProjectDateToBooking: !!svc?.updateProjectDateToBooking,

    // 8. Approval Settings (toggle)
    requireApproval: !!svc?.requireApproval,
    approvalCalendarId: svc?.approvalCalendarId || '',
    approvalWorkflowId: svc?.approvalWorkflowId || '',
    approvalAutoEmail: svc?.approvalAutoEmail || 'do_not_send',

    // 9. Confirmation Settings
    confirmationCalendarId: svc?.confirmationCalendarId || '',
    confirmationWorkflowId: svc?.confirmationWorkflowId || '',
    contractTemplateId: svc?.contractTemplateId || '',

    // 10. Cancellation Settings
    cancellationMessageTemplateId: svc?.cancellationMessageTemplateId || '',
    cancellationWorkflowId: svc?.cancellationWorkflowId || '',

    // 11. Reminder Settings (toggle)
    remindersEnabled: !!(svc?.reminderMessageTemplateId || svc?.dayOfReminderTemplateId),
    reminderMessageTemplateId: svc?.reminderMessageTemplateId || '', // day-before
    dayOfReminderTemplateId: svc?.dayOfReminderTemplateId || '',

    // 12. Tracking Keys
    metaPixelId: svc?.metaPixelId || '',
  });

  const [questions, setQuestions] = useState<ServiceQuestion[]>(() => {
    try { return JSON.parse(svc?.serviceQuestions || '[]'); } catch { return []; }
  });

  // Which sections are expanded
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    1: true, 2: true, 3: true, 4: true, 5: true, 6: true,
    7: false, 8: false, 9: false, 10: false, 11: false, 12: false,
  });

  const toggleSection = (n: number) =>
    setOpenSections(prev => ({ ...prev, [n]: !prev[n] }));

  const update = (fields: Partial<typeof formData>) =>
    setFormData(prev => ({ ...prev, ...fields }));

  /* ── Data queries ── */
  const { data: contractTemplates = [] } = useQuery<any[]>({
    queryKey: ['/api/contract-templates'],
    staleTime: 60_000,
  });
  const { data: emailTemplates = [] } = useQuery<any[]>({
    queryKey: ['/api/templates'],
    staleTime: 60_000,
  });
  const { data: calendarIntegrations = [] } = useQuery<any[]>({
    queryKey: ['/api/calendar-integrations'],
    staleTime: 60_000,
  });

  /* ── Save mutation ── */
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
    onError: (error: any) =>
      toast({ title: 'Error', description: error.message || 'Failed to save service', variant: 'destructive' }),
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a service name.', variant: 'destructive' });
      if (!openSections[1]) toggleSection(1);
      return;
    }
    const tags = (csv: string) => csv.split(',').map(t => t.trim()).filter(Boolean);
    mutation.mutate({
      serviceType: formData.serviceType,
      name: formData.name,
      description: formData.description || null,
      price: formData.price || null,
      duration: Number(formData.duration),
      bufferBefore: Number(formData.bufferBefore),
      bufferAfter: Number(formData.bufferAfter),
      startTimeInterval: Number(formData.startTimeInterval),
      serviceQuestions: formData.questionsEnabled && questions.length
        ? JSON.stringify(questions)
        : null,
      enableOnlinePayments: formData.enableOnlinePayments,
      paymentAmount: formData.enableOnlinePayments && formData.paymentAmount
        ? formData.paymentAmount
        : null,
      paymentType: formData.enableOnlinePayments ? formData.paymentType : null,
      location: formData.locationEnabled ? (formData.location || null) : null,
      locationDetails: formData.locationEnabled ? (formData.locationDetails || null) : null,
      termsOfServiceTemplateId: formData.termsOfServiceTemplateId || null,
      confirmationMessageTemplateId: formData.confirmationMessageTemplateId || null,
      addContactTags: tags(formData.addContactTags),
      addProjectTags: tags(formData.addProjectTags),
      removeProjectTags: tags(formData.removeProjectTags),
      autoCreateProject: formData.autoCreateProject,
      updateProjectDateToBooking: formData.updateProjectDateToBooking,
      requireApproval: formData.requireApproval,
      approvalCalendarId: formData.requireApproval ? (formData.approvalCalendarId || null) : null,
      approvalWorkflowId: formData.requireApproval ? (formData.approvalWorkflowId || null) : null,
      approvalAutoEmail: formData.requireApproval ? formData.approvalAutoEmail : null,
      confirmationCalendarId: formData.confirmationCalendarId || null,
      confirmationWorkflowId: formData.confirmationWorkflowId || null,
      contractTemplateId: formData.contractTemplateId || null,
      cancellationMessageTemplateId: formData.cancellationMessageTemplateId || null,
      cancellationWorkflowId: formData.cancellationWorkflowId || null,
      reminderMessageTemplateId: formData.remindersEnabled
        ? (formData.reminderMessageTemplateId || null)
        : null,
      dayOfReminderTemplateId: formData.remindersEnabled
        ? (formData.dayOfReminderTemplateId || null)
        : null,
      metaPixelId: formData.metaPixelId || null,
    });
  };

  /* ── Question helpers ── */
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const addQuestion = (type: QuestionType) => {
    setQuestions(prev => [...prev, { label: '', type, required: false }]);
    setShowQuestionPicker(false);
  };
  const removeQuestion = (i: number) =>
    setQuestions(prev => prev.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, field: keyof ServiceQuestion, value: any) =>
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));

  /* ── Section Header component ── */
  function SectionHeader({
    n, title, hasToggle, toggleKey, isOpen,
  }: {
    n: number;
    title: string;
    hasToggle?: boolean;
    toggleKey?: keyof typeof formData;
    isOpen: boolean;
  }) {
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
        {hasToggle && toggleKey && (
          <Switch
            checked={formData[toggleKey] as boolean}
            onCheckedChange={v => {
              update({ [toggleKey]: v } as any);
              if (v && !isOpen) toggleSection(n);
            }}
            onClick={e => e.stopPropagation()}
          />
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>
    );
  }

  /* ── Template select helper ── */
  function TemplateSelect({
    id, label, value, onChange, templates, emptyLabel = 'None',
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    templates: any[];
    emptyLabel?: string;
  }) {
    return (
      <div>
        <Label htmlFor={id} className="text-sm">{label}</Label>
        <Select value={value || 'none'} onValueChange={v => onChange(v === 'none' ? '' : v)}>
          <SelectTrigger id={id} className="mt-1">
            <SelectValue placeholder={emptyLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{emptyLabel}</SelectItem>
            {templates.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  /* ── Calendar select helper ── */
  function CalendarSelect({ id, label, value, onChange }: {
    id: string; label: string; value: string; onChange: (v: string) => void;
  }) {
    return (
      <div>
        <Label htmlFor={id} className="text-sm">{label}</Label>
        <Select value={value || 'none'} onValueChange={v => onChange(v === 'none' ? '' : v)}>
          <SelectTrigger id={id} className="mt-1">
            <SelectValue placeholder="No calendar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No calendar</SelectItem>
            {(calendarIntegrations as any[]).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name || c.email || c.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  /* ─────────────────────────── RENDER ──────────────────────────────────────── */
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden" data-testid="service-settings-page">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Services
          </Button>
          <span className="text-gray-300">|</span>
          <h2 className="text-base font-semibold">Service Settings</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-save-service">
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Sections ── */}
      <div className="divide-y">

        {/* ①  SERVICE DETAILS ──────────────────────────────────────── */}
        <div>
          <SectionHeader n={1} title="Service Details" isOpen={openSections[1]} />
          {openSections[1] && (
            <div className="px-6 pb-6 space-y-5">
              {/* Service type */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Service Type
                </Label>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => update({ serviceType: 'individual' })}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      formData.serviceType === 'individual'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <User className="w-4 h-4" /> Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ serviceType: 'group' })}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      formData.serviceType === 'group'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <Users className="w-4 h-4" /> Group
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="svc-name">Service Name *</Label>
                <Input
                  id="svc-name"
                  value={formData.name}
                  onChange={e => update({ name: e.target.value })}
                  placeholder="e.g., Discovery Call"
                  className="mt-1"
                  data-testid="input-service-name"
                />
              </div>

              <div>
                <Label htmlFor="svc-desc">Description</Label>
                <Textarea
                  id="svc-desc"
                  value={formData.description}
                  onChange={e => update({ description: e.target.value })}
                  rows={4}
                  placeholder="Describe what's included in this service…"
                  className="mt-1"
                  data-testid="input-service-description"
                />
              </div>

              <div className="max-w-xs">
                <Label htmlFor="svc-price">Display Price</Label>
                <Input
                  id="svc-price"
                  value={formData.price}
                  onChange={e => update({ price: e.target.value })}
                  placeholder="e.g., £100 or Free"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Shown to clients on the booking page.</p>
              </div>
            </div>
          )}
        </div>

        {/* ②  SERVICE TIME FRAME ──────────────────────────────────── */}
        <div>
          <SectionHeader n={2} title="Service Time Frame" isOpen={openSections[2]} />
          {openSections[2] && (
            <div className="px-6 pb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="svc-dur">Duration (min) *</Label>
                  <Input
                    id="svc-dur"
                    type="number"
                    value={formData.duration}
                    onChange={e => update({ duration: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                    data-testid="input-service-duration"
                  />
                </div>
                <div>
                  <Label htmlFor="svc-buf-before">Buffer Before</Label>
                  <Select
                    value={String(formData.bufferBefore)}
                    onValueChange={v => update({ bufferBefore: parseInt(v) })}
                  >
                    <SelectTrigger id="svc-buf-before" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 5, 10, 15, 20, 30, 45, 60].map(m => (
                        <SelectItem key={m} value={String(m)}>
                          {m === 0 ? 'None' : `${m} min`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="svc-buf-after">Buffer After</Label>
                  <Select
                    value={String(formData.bufferAfter)}
                    onValueChange={v => update({ bufferAfter: parseInt(v) })}
                  >
                    <SelectTrigger id="svc-buf-after" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 5, 10, 15, 20, 30, 45, 60].map(m => (
                        <SelectItem key={m} value={String(m)}>
                          {m === 0 ? 'None' : `${m} min`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="svc-interval">Start Interval</Label>
                  <Select
                    value={String(formData.startTimeInterval)}
                    onValueChange={v => update({ startTimeInterval: parseInt(v) })}
                  >
                    <SelectTrigger id="svc-interval" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[15, 30, 60].map(m => (
                        <SelectItem key={m} value={String(m)}>Every {m} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ③  SERVICE QUESTIONS ───────────────────────────────────── */}
        <div>
          <SectionHeader
            n={3} title="Service Questions (Optional)"
            hasToggle toggleKey="questionsEnabled"
            isOpen={openSections[3]}
          />
          {openSections[3] && (
            <div className="px-6 pb-6">
              {!formData.questionsEnabled ? (
                <p className="text-sm text-muted-foreground">
                  Enable to collect information from clients at booking time.
                </p>
              ) : (
                <div className="space-y-3">
                  {questions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Currently you have no questions. Click "+ Add Question" to add one.
                    </p>
                  )}
                  {questions.map((q, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex-shrink-0">
                          {QUESTION_TYPES.find(t => t.value === q.type)?.label || q.type}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => removeQuestion(i)}>
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>

                      {q.type === 'display_text' ? (
                        /* Display text: just a text content area, no label/required */
                        <Textarea
                          value={q.label}
                          onChange={e => updateQuestion(i, 'label', e.target.value)}
                          placeholder="Enter instructions or information to display to clients…"
                          rows={3}
                        />
                      ) : (
                        <>
                          <Input
                            value={q.label}
                            onChange={e => updateQuestion(i, 'label', e.target.value)}
                            placeholder="Question text…"
                          />
                          {/* Options for list-based types */}
                          {(q.type === 'select' || q.type === 'checkboxes') && (
                            <Input
                              value={(q.options || []).join(', ')}
                              onChange={e =>
                                updateQuestion(i, 'options', e.target.value.split(',').map(o => o.trim()).filter(Boolean))
                              }
                              placeholder="Options: Option A, Option B, Option C"
                              className="text-sm"
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`req-${i}`}
                              checked={q.required}
                              onChange={e => updateQuestion(i, 'required', e.target.checked)}
                              className="w-3.5 h-3.5 accent-primary"
                            />
                            <label htmlFor={`req-${i}`} className="text-xs text-muted-foreground cursor-pointer">Required</label>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Question type picker */}
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuestionPicker(v => !v)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Question
                    </Button>
                    {showQuestionPicker && (
                      <div className="absolute left-0 top-9 z-20 bg-white border rounded-xl shadow-lg p-4 w-[480px] grid grid-cols-2 gap-3">
                        {QUESTION_TYPES.map(qt => (
                          <button
                            key={qt.value}
                            type="button"
                            onClick={() => addQuestion(qt.value)}
                            className="flex items-start gap-3 p-3 rounded-lg border hover:border-blue-400 hover:bg-blue-50 text-left transition-colors"
                          >
                            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-blue-600 text-xs font-bold">
                                {qt.value === 'text' ? 'A' : qt.value === 'textarea' ? '¶' : qt.value === 'yes_no' ? '✓✗' : qt.value === 'select' ? '▾' : qt.value === 'checkboxes' ? '☑' : qt.value === 'date' ? '📅' : 'T'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{qt.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{qt.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ④  ONLINE PAYMENTS ─────────────────────────────────────── */}
        <div>
          <SectionHeader
            n={4} title="Online Payments"
            hasToggle toggleKey="enableOnlinePayments"
            isOpen={openSections[4]}
          />
          {openSections[4] && (
            <div className="px-6 pb-6">
              {!formData.enableOnlinePayments ? (
                <p className="text-sm text-muted-foreground">
                  Enable to require payment when a client books this service.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <div>
                    <Label htmlFor="svc-pay-amount">Amount (£)</Label>
                    <Input
                      id="svc-pay-amount"
                      type="number"
                      step="0.01"
                      value={formData.paymentAmount}
                      onChange={e => update({ paymentAmount: e.target.value })}
                      placeholder="e.g., 50"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="svc-pay-type">Payment Type</Label>
                    <Select
                      value={formData.paymentType}
                      onValueChange={v => update({ paymentType: v })}
                    >
                      <SelectTrigger id="svc-pay-type" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="full">Full payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ⑤  SERVICE LOCATION ───────────────────────────────────── */}
        <div>
          <SectionHeader
            n={5} title="Service Location"
            hasToggle toggleKey="locationEnabled"
            isOpen={openSections[5]}
          />
          {openSections[5] && (
            <div className="px-6 pb-6 space-y-4">
              {!formData.locationEnabled ? (
                <p className="text-sm text-muted-foreground">
                  Enable to specify where this service takes place.
                </p>
              ) : (
                <>
                  <div className="max-w-xs">
                    <Label htmlFor="svc-loc">Location Type</Label>
                    <Select
                      value={formData.location || 'phone'}
                      onValueChange={v => update({ location: v })}
                    >
                      <SelectTrigger id="svc-loc" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">Phone Call</SelectItem>
                        <SelectItem value="video">Video Call (Zoom / Meet)</SelectItem>
                        <SelectItem value="in-person">In Person</SelectItem>
                        <SelectItem value="client-location">Client's Location</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="svc-loc-details">Location Details</Label>
                    <Input
                      id="svc-loc-details"
                      value={formData.locationDetails}
                      onChange={e => update({ locationDetails: e.target.value })}
                      placeholder="e.g., Zoom link, address, phone number…"
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ⑥  BOOKING MESSAGING ──────────────────────────────────── */}
        <div>
          <SectionHeader n={6} title="Booking Messaging" isOpen={openSections[6]} />
          {openSections[6] && (
            <div className="px-6 pb-6 space-y-4 max-w-md">
              <TemplateSelect
                id="svc-tos"
                label="Terms of Service"
                value={formData.termsOfServiceTemplateId}
                onChange={v => update({ termsOfServiceTemplateId: v })}
                templates={emailTemplates}
                emptyLabel="No terms of service"
              />
              <TemplateSelect
                id="svc-conf-msg"
                label="Confirmation Message"
                value={formData.confirmationMessageTemplateId}
                onChange={v => update({ confirmationMessageTemplateId: v })}
                templates={emailTemplates}
                emptyLabel="Default confirmation"
              />
              <p className="text-xs text-muted-foreground">
                Manage email templates in the{' '}
                <span className="font-medium">Templates</span> section of your account.
              </p>
            </div>
          )}
        </div>

        {/* ⑦  PROJECT MANAGEMENT ─────────────────────────────────── */}
        <div>
          <SectionHeader n={7} title="Project Management" isOpen={openSections[7]} />
          {openSections[7] && (
            <div className="px-6 pb-6 space-y-4">
              <div>
                <Label htmlFor="svc-contact-tags">Add Contact Tags on Booking</Label>
                <Input
                  id="svc-contact-tags"
                  value={formData.addContactTags}
                  onChange={e => update({ addContactTags: e.target.value })}
                  placeholder="e.g., discovery-booked, consultation (comma-separated)"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="svc-add-proj-tags">Add Project Tags</Label>
                  <Input
                    id="svc-add-proj-tags"
                    value={formData.addProjectTags}
                    onChange={e => update({ addProjectTags: e.target.value })}
                    placeholder="tag1, tag2"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="svc-rm-proj-tags">Remove Project Tags</Label>
                  <Input
                    id="svc-rm-proj-tags"
                    value={formData.removeProjectTags}
                    onChange={e => update({ removeProjectTags: e.target.value })}
                    placeholder="tag1, tag2"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="max-w-xs">
                <Label htmlFor="svc-proj-create">Project Creation Rule</Label>
                <Select
                  value={formData.autoCreateProject ? 'always' : 'never'}
                  onValueChange={v => update({ autoCreateProject: v === 'always' })}
                >
                  <SelectTrigger id="svc-proj-create" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Don't create a project</SelectItem>
                    <SelectItem value="always">Always create a project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="svc-update-date"
                  checked={formData.updateProjectDateToBooking}
                  onCheckedChange={v => update({ updateProjectDateToBooking: v })}
                />
                <Label htmlFor="svc-update-date" className="cursor-pointer">
                  Update project date to booking date
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* ⑧  APPROVAL SETTINGS ──────────────────────────────────── */}
        <div>
          <SectionHeader
            n={8} title="Approval Settings"
            hasToggle toggleKey="requireApproval"
            isOpen={openSections[8]}
          />
          {openSections[8] && (
            <div className="px-6 pb-6 space-y-4">
              {!formData.requireApproval ? (
                <p className="text-sm text-muted-foreground">
                  Enable to manually approve bookings before they are confirmed.
                </p>
              ) : (
                <>
                  <CalendarSelect
                    id="svc-approval-cal"
                    label="Calendar"
                    value={formData.approvalCalendarId}
                    onChange={v => update({ approvalCalendarId: v })}
                  />
                  <div className="max-w-xs">
                    <Label htmlFor="svc-approval-email">Auto-send waiting email</Label>
                    <Select
                      value={formData.approvalAutoEmail}
                      onValueChange={v => update({ approvalAutoEmail: v })}
                    >
                      <SelectTrigger id="svc-approval-email" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="do_not_send">Do not send</SelectItem>
                        <SelectItem value="waiting_for_approval">Waiting for approval (default)</SelectItem>
                        {emailTemplates.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ⑨  CONFIRMATION SETTINGS ──────────────────────────────── */}
        <div>
          <SectionHeader n={9} title="Confirmation Settings" isOpen={openSections[9]} />
          {openSections[9] && (
            <div className="px-6 pb-6 space-y-4 max-w-md">
              <CalendarSelect
                id="svc-conf-cal"
                label="Add to Calendar on Confirmation"
                value={formData.confirmationCalendarId}
                onChange={v => update({ confirmationCalendarId: v })}
              />
              <TemplateSelect
                id="svc-contract"
                label="Auto-send Contract"
                value={formData.contractTemplateId}
                onChange={v => update({ contractTemplateId: v })}
                templates={contractTemplates}
                emptyLabel="No contract"
              />
              <p className="text-xs text-muted-foreground">
                The client receives a signing link in their confirmation email.
              </p>
            </div>
          )}
        </div>

        {/* ⑩  CANCELLATION SETTINGS ──────────────────────────────── */}
        <div>
          <SectionHeader n={10} title="Cancellation Settings" isOpen={openSections[10]} />
          {openSections[10] && (
            <div className="px-6 pb-6 space-y-4 max-w-md">
              <TemplateSelect
                id="svc-cancel-email"
                label="Cancellation Email"
                value={formData.cancellationMessageTemplateId}
                onChange={v => update({ cancellationMessageTemplateId: v })}
                templates={emailTemplates}
                emptyLabel="Default cancellation"
              />
            </div>
          )}
        </div>

        {/* ⑪  REMINDER SETTINGS ──────────────────────────────────── */}
        <div>
          <SectionHeader
            n={11} title="Reminder Settings"
            hasToggle toggleKey="remindersEnabled"
            isOpen={openSections[11]}
          />
          {openSections[11] && (
            <div className="px-6 pb-6 space-y-4 max-w-md">
              {!formData.remindersEnabled ? (
                <p className="text-sm text-muted-foreground">
                  Enable to automatically send reminder emails to clients.
                </p>
              ) : (
                <>
                  <TemplateSelect
                    id="svc-reminder-day-before"
                    label="Day-before Reminder"
                    value={formData.reminderMessageTemplateId}
                    onChange={v => update({ reminderMessageTemplateId: v })}
                    templates={emailTemplates}
                    emptyLabel="Do not send"
                  />
                  <TemplateSelect
                    id="svc-reminder-day-of"
                    label="Day-of Reminder"
                    value={formData.dayOfReminderTemplateId}
                    onChange={v => update({ dayOfReminderTemplateId: v })}
                    templates={emailTemplates}
                    emptyLabel="Do not send"
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* ⑫  TRACKING KEYS (BETA) ────────────────────────────────── */}
        <div>
          <SectionHeader n={12} title="Tracking Keys (Beta)" isOpen={openSections[12]} />
          {openSections[12] && (
            <div className="px-6 pb-6 max-w-sm">
              <div>
                <Label htmlFor="svc-pixel">Meta Pixel ID</Label>
                <Input
                  id="svc-pixel"
                  value={formData.metaPixelId}
                  onChange={e => update({ metaPixelId: e.target.value })}
                  placeholder="e.g., 1234567890"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Track booking conversions in Meta Ads Manager.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>{/* end sections */}
    </div>
  );
}

/* ─── Availability Tab ───────────────────────────────────────────────────────── */

function AvailabilityTab() {
  const [editingSchedule, setEditingSchedule] = useState<AvailabilitySchedule | 'new' | null>(null);

  const { data: schedules, isLoading } = useQuery<AvailabilitySchedule[]>({
    queryKey: ['/api/ai-features/schedules'],
  });

  // Full-page editor mode
  if (editingSchedule !== null) {
    return (
      <ScheduleSettingsPage
        schedule={editingSchedule === 'new' ? undefined : editingSchedule}
        onClose={() => setEditingSchedule(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Availability Schedules</h2>
          <p className="text-sm text-muted-foreground">
            Define when services are available for booking
          </p>
        </div>
        <Button data-testid="button-create-schedule" onClick={() => setEditingSchedule('new')}>
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading schedules...</div>
      ) : schedules && schedules.length > 0 ? (
        <div className="grid gap-4">
          {schedules.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} onEdit={() => setEditingSchedule(schedule)} />
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

function ScheduleCard({ schedule, onEdit }: { schedule: AvailabilitySchedule; onEdit: () => void }) {
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

  const [embedOpen, setEmbedOpen] = useState(false);
  const embedSnippet = schedule.publicLink
    ? `<!-- Inline booking widget -->\n<div id="cf-booking-${schedule.publicLink}"></div>\n<script src="${window.location.origin}/embed.js"\n  data-slug="${schedule.publicLink}"\n  data-container="#cf-booking-${schedule.publicLink}">\n</script>\n\n<!-- OR: modal button -->\n<!--\n<script src="${window.location.origin}/embed.js"\n  data-slug="${schedule.publicLink}"\n  data-button-text="Book a Call">\n</script>\n-->`
    : '';

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    toast({ description: 'Embed code copied to clipboard' });
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
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyPublicLink}
                  title="Copy booking link"
                  data-testid={`button-copy-link-${schedule.id}`}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" title="Embed on your website" data-testid={`button-embed-${schedule.id}`}>
                      <Code2 className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Embed on your website</DialogTitle>
                      <DialogDescription>
                        Paste either snippet into any webpage to let visitors book without leaving your site.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <pre className="bg-muted text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all select-all">
                        {embedSnippet}
                      </pre>
                      <p className="text-xs text-muted-foreground">
                        The first snippet embeds inline. Remove the comment markers for the second snippet to show a button that opens a modal instead.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEmbedOpen(false)}>Close</Button>
                      <Button onClick={copyEmbed}><Copy className="w-4 h-4 mr-2" />Copy code</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              data-testid={`button-edit-schedule-${schedule.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
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

/* ─── Bookings Tab ───────────────────────────────────────────────────────────── */

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
                {needsApprovalCount > 0 && (
                  <span className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 rounded-full">
                    {needsApprovalCount}
                  </span>
                )}
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
    if (needsApproval) return (
      <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
        <AlertCircle className="w-3 h-3 mr-1" />Needs Approval
      </Badge>
    );
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
        <div className="font-medium">{booking.bookedBy}</div>
        <div className="text-sm text-muted-foreground">{booking.bookedEmail}</div>
      </TableCell>
      <TableCell>{serviceMap.get(booking.serviceId) || booking.serviceId}</TableCell>
      <TableCell>
        <div className="text-sm">
          {new Date(booking.startTime).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
          <br />
          <span className="text-muted-foreground">{new Date(booking.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
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
