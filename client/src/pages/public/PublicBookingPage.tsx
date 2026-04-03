import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { BookableService, AvailabilitySchedule } from '@shared/schema';

interface PublicBookingPageProps {
  slug: string;
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate,
  onSelect,
  minDate,
  maxDate,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  minDate: Date;
  maxDate?: Date;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(
    selectedDate ? new Date(selectedDate + 'T00:00:00').getFullYear() : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? new Date(selectedDate + 'T00:00:00').getMonth() : today.getMonth()
  );

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function formatDay(day: number): string {
    const month = String(viewMonth + 1).padStart(2, '0');
    return `${viewYear}-${month}-${String(day).padStart(2, '0')}`;
  }

  function isDisabled(day: number): boolean {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    if (d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  }

  const blanks = Array(firstDayOfMonth).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium">{monthName}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {days.map(day => {
          const dateStr = formatDay(day);
          const disabled = isDisabled(day);
          const isSelected = selectedDate === dateStr;
          const isToday = new Date(viewYear, viewMonth, day).toDateString() === new Date().toDateString();
          return (
            <button
              key={day}
              disabled={disabled}
              onClick={() => !disabled && onSelect(dateStr)}
              className={[
                'w-full aspect-square rounded text-sm flex items-center justify-center transition-colors',
                disabled ? 'text-muted-foreground/40 cursor-not-allowed' : 'hover:bg-muted cursor-pointer',
                isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : '',
                isToday && !isSelected ? 'font-bold underline' : '',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Question Types ───────────────────────────────────────────────────────────

interface ServiceQuestion {
  label: string;
  type: 'text' | 'textarea' | 'select';
  required?: boolean;
  options?: string[];
}

function parseQuestions(raw: string | null | undefined): ServiceQuestion[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicBookingPage({ slug }: PublicBookingPageProps) {
  const [step, setStep] = useState<'service' | 'datetime' | 'questions' | 'info' | 'success'>('service');
  const [selectedService, setSelectedService] = useState<BookableService | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [clientInfo, setClientInfo] = useState({ name: '', email: '', phone: '', notes: '' });
  const [existingContact, setExistingContact] = useState<any>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const { toast } = useToast();

  // Fetch schedule
  const { data: schedule, isLoading: isLoadingSchedule } = useQuery<AvailabilitySchedule>({
    queryKey: [`/api/public/schedules/${slug}`],
  });

  // Fetch services for this schedule
  const { data: services, isLoading: isLoadingServices } = useQuery<BookableService[]>({
    queryKey: [`/api/public/schedules/${slug}/services`],
    enabled: !!schedule,
  });

  // Fetch available slots for selected date + service
  const {
    data: slotsData,
    isLoading: isLoadingSlots,
    isFetching: isFetchingSlots,
  } = useQuery<{ date: string; slots: string[] }>({
    queryKey: [
      `/api/public/schedules/${slug}/slots`,
      selectedDate,
      selectedService?.id,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedService?.id) params.set('serviceId', selectedService.id);
      const res = await fetch(`/api/public/schedules/${slug}/slots?${params}`);
      if (!res.ok) throw new Error('Failed to fetch slots');
      return res.json();
    },
    enabled: step === 'datetime' && !!selectedDate && !!selectedService,
    staleTime: 30_000,
  });

  // Reset time when date changes
  useEffect(() => { setSelectedTime(''); }, [selectedDate]);

  // Min/max date constraints from schedule
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  if (schedule?.minAdvanceNoticeHours) {
    minDate.setTime(minDate.getTime() + schedule.minAdvanceNoticeHours * 3600 * 1000);
    minDate.setHours(0, 0, 0, 0);
  }
  const maxDate = schedule?.maxFutureDays
    ? (() => { const d = new Date(); d.setDate(d.getDate() + schedule.maxFutureDays!); return d; })()
    : undefined;

  // Email check
  const checkEmail = async (email: string) => {
    if (!email || !email.includes('@')) return;
    setIsCheckingEmail(true);
    try {
      const res = await fetch('/api/public/contact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, slug }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setExistingContact(data);
          setClientInfo(prev => ({ ...prev, name: data.name || prev.name, phone: data.phone || prev.phone }));
          toast({ title: 'Welcome back!', description: 'We found your information' });
        } else {
          setExistingContact(null);
        }
      }
    } catch (e) {
      console.error('Email check error:', e);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Create booking
  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/public/bookings/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          contactId: existingContact?.contactId || null,
          projectId: existingContact?.mostRecentProjectId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create booking');
      }
      return res.json();
    },
    onSuccess: () => setStep('success'),
    onError: (err: any) => toast({ title: 'Booking failed', description: err.message, variant: 'destructive' }),
  });

  const handleServiceSelect = (service: BookableService) => {
    setSelectedService(service);
    setSelectedDate('');
    setSelectedTime('');
    setStep('datetime');
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime) return;

    // Split answers by question type
    const svcLabels = new Set(serviceQuestions.map(q => q.label));
    const serviceResponses: Record<string, string> = {};
    const projectResponses: Record<string, string> = {};
    for (const [label, answer] of Object.entries(questionAnswers)) {
      if (svcLabels.has(label)) serviceResponses[label] = answer;
      else projectResponses[label] = answer;
    }

    createBookingMutation.mutate({
      serviceId: selectedService.id,
      scheduleId: schedule?.id,
      clientName: clientInfo.name,
      clientEmail: clientInfo.email,
      clientPhone: clientInfo.phone,
      bookingDate: selectedDate,
      bookingTime: selectedTime,
      notes: clientInfo.notes,
      status: (selectedService as any).requireApproval ? 'pending' : 'confirmed',
      serviceResponses: Object.keys(serviceResponses).length > 0 ? JSON.stringify(serviceResponses) : undefined,
      projectResponses: Object.keys(projectResponses).length > 0 ? JSON.stringify(projectResponses) : undefined,
    });
  };

  // Derived questions from selected service
  const serviceQuestions = parseQuestions((selectedService as any)?.serviceQuestions);
  const projectQuestions = parseQuestions((selectedService as any)?.projectQuestions);
  // Show project questions only for new contacts (or before we know)
  const questionsToShow = [
    ...serviceQuestions.map(q => ({ ...q, _type: 'service' as const })),
    ...(!existingContact ? projectQuestions.map(q => ({ ...q, _type: 'project' as const })) : []),
  ];
  const hasQuestions = questionsToShow.length > 0;

  const handleDateTimeContinue = () => {
    if (!selectedDate || !selectedTime) return;
    if (hasQuestions) {
      setStep('questions');
    } else {
      setStep('info');
    }
  };

  const handleQuestionsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required questions
    for (const q of questionsToShow) {
      if (q.required && !questionAnswers[q.label]?.trim()) {
        toast({ title: 'Missing answer', description: `"${q.label}" is required.`, variant: 'destructive' });
        return;
      }
    }
    setStep('info');
  };

  // ── Loading / Not Found ───────────────────────────────────────────────────
  if (isLoadingSchedule) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading booking page...</span>
        </div>
      </div>
    );
  }
  if (!schedule) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Booking page not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Progress indicator steps ──────────────────────────────────────────────
  const stepOrder = ['service', 'datetime', 'info'] as const;
  const currentIdx = stepOrder.indexOf(step as any);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          {schedule.headerImageUrl && (
            <img
              src={schedule.headerImageUrl}
              alt=""
              className="w-full h-40 object-cover rounded-xl mb-6"
            />
          )}
          <h1 className="text-3xl font-bold mb-2" data-testid="text-booking-title">
            {schedule.name}
          </h1>
          {(schedule as any).description && (
            <p className="text-muted-foreground" data-testid="text-booking-description">
              {(schedule as any).description}
            </p>
          )}
        </div>

        {/* Progress */}
        {step !== 'success' && (() => {
          const progressSteps = hasQuestions
            ? ['Service', 'Date & Time', 'Questions', 'Your Info']
            : ['Service', 'Date & Time', 'Your Info'];
          const stepOrder = hasQuestions
            ? ['service', 'datetime', 'questions', 'info']
            : ['service', 'datetime', 'info'];
          const currentStepIdx = stepOrder.indexOf(step as string);
          return (
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-2">
                {progressSteps.map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 ${i === currentStepIdx ? 'text-primary' : i < currentStepIdx ? 'text-green-600' : 'text-muted-foreground'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        i === currentStepIdx ? 'bg-primary text-primary-foreground' :
                        i < currentStepIdx ? 'bg-green-600 text-white' : 'bg-muted'
                      }`}>
                        {i < currentStepIdx ? '✓' : i + 1}
                      </div>
                      <span className="text-sm hidden sm:inline">{label}</span>
                    </div>
                    {i < progressSteps.length - 1 && <div className="w-8 sm:w-12 h-px bg-muted mx-1" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Step 1: Service Selection ── */}
        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Select a Service</h2>
            {isLoadingServices ? (
              <Card><CardContent className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardContent></Card>
            ) : services && services.length > 0 ? (
              <div className="grid gap-4">
                {services.map(service => (
                  <Card
                    key={service.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleServiceSelect(service)}
                    data-testid={`card-service-option-${service.id}`}
                  >
                    <CardHeader>
                      <CardTitle>{service.name}</CardTitle>
                      {service.description && <CardDescription>{service.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{service.duration} minutes</span>
                          {service.location && (
                            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                              {service.location}
                            </span>
                          )}
                        </div>
                        {service.price && (
                          <div className="text-lg font-semibold">£{service.price}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No services available for booking at this time.
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Step 2: Date & Time ── */}
        {step === 'datetime' && selectedService && (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Calendar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pick a Date</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniCalendar
                  selectedDate={selectedDate}
                  onSelect={setSelectedDate}
                  minDate={minDate}
                  maxDate={maxDate}
                />
              </CardContent>
            </Card>

            {/* Time slots */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {selectedDate
                    ? `Available Times — ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
                    : 'Select a date first'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedDate ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Choose a date on the left to see available times.
                  </p>
                ) : isLoadingSlots || isFetchingSlots ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading times…</span>
                  </div>
                ) : slotsData && slotsData.slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                    {slotsData.slots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={[
                          'py-2 text-sm rounded-md border transition-colors',
                          selectedTime === slot
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-muted-foreground/20 hover:border-primary hover:text-primary',
                        ].join(' ')}
                        data-testid={`button-slot-${slot}`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No available times on this date. Please try another day.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="sm:col-span-2 flex gap-2">
              <Button variant="outline" onClick={() => setStep('service')} data-testid="button-back-to-service">
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedDate || !selectedTime}
                onClick={handleDateTimeContinue}
                data-testid="button-continue-to-info"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Questions (only shown when service has intake questions) ── */}
        {step === 'questions' && (
          <Card>
            <CardHeader>
              <CardTitle>A few quick questions</CardTitle>
              <CardDescription>
                Help us prepare for your {selectedService?.name}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleQuestionsSubmit} className="space-y-5">
                {questionsToShow.map((q, i) => (
                  <div key={i}>
                    <Label htmlFor={`q-${i}`}>
                      {q.label}{q.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {q.type === 'textarea' ? (
                      <Textarea
                        id={`q-${i}`}
                        value={questionAnswers[q.label] || ''}
                        onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.label]: e.target.value }))}
                        required={q.required}
                        placeholder="Your answer…"
                      />
                    ) : q.type === 'select' && q.options ? (
                      <select
                        id={`q-${i}`}
                        value={questionAnswers[q.label] || ''}
                        onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.label]: e.target.value }))}
                        required={q.required}
                        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                      >
                        <option value="">Select an option…</option>
                        {q.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={`q-${i}`}
                        value={questionAnswers[q.label] || ''}
                        onChange={e => setQuestionAnswers(prev => ({ ...prev, [q.label]: e.target.value }))}
                        required={q.required}
                        placeholder="Your answer…"
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('datetime')}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1">
                    Continue
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4 (or 3 if no questions): Client Info ── */}
        {step === 'info' && (
          <Card>
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>
                {existingContact
                  ? 'Welcome back! Please confirm your details.'
                  : 'Please provide your contact details to complete the booking'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Booking summary banner */}
              <div className="bg-muted rounded-lg px-4 py-3 mb-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
                <span><strong>{selectedService?.name}</strong></span>
                <span>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span>{selectedTime}</span>
                {selectedService?.duration && <span>{selectedService.duration} min</span>}
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={clientInfo.email}
                      onChange={e => setClientInfo({ ...clientInfo, email: e.target.value })}
                      onBlur={e => checkEmail(e.target.value)}
                      required
                      disabled={isCheckingEmail}
                      data-testid="input-client-email"
                    />
                    {isCheckingEmail && (
                      <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
                    )}
                  </div>
                  {existingContact && <p className="text-xs text-green-600 mt-1">✓ We found your information</p>}
                </div>

                {existingContact ? (
                  <>
                    <div>
                      <Label>Full Name</Label>
                      <Input value={clientInfo.name} readOnly className="bg-muted" data-testid="input-client-name" />
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <Input value={clientInfo.phone} readOnly className="bg-muted" data-testid="input-client-phone" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={clientInfo.name}
                        onChange={e => setClientInfo({ ...clientInfo, name: e.target.value })}
                        required
                        placeholder="Jane Smith"
                        data-testid="input-client-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={clientInfo.phone}
                        onChange={e => setClientInfo({ ...clientInfo, phone: e.target.value })}
                        required
                        placeholder="+44 7700 900000"
                        data-testid="input-client-phone"
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="notes">Additional Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={clientInfo.notes}
                    onChange={e => setClientInfo({ ...clientInfo, notes: e.target.value })}
                    placeholder="Any special requests or information…"
                    data-testid="input-booking-notes"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(hasQuestions ? 'questions' : 'datetime')}
                    data-testid="button-back-to-datetime"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={createBookingMutation.isPending || isCheckingEmail}
                    className="flex-1"
                    data-testid="button-submit-booking"
                  >
                    {createBookingMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Booking…</>
                    ) : selectedService?.requireApproval ? 'Request Booking' : 'Complete Booking'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2" data-testid="text-booking-success">
                {selectedService?.requireApproval ? 'Request Received!' : 'Booking Confirmed!'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {selectedService?.requireApproval
                  ? "We'll review your request and send you a confirmation email shortly."
                  : "You'll receive a confirmation email shortly."}
              </p>
              <div className="bg-muted rounded-lg p-4 text-left max-w-md mx-auto">
                <h3 className="font-semibold mb-3">Booking Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span>{selectedService?.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span>{selectedTime}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{selectedService?.duration} min</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{clientInfo.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{clientInfo.email}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
