import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Clock, CheckCircle, Loader2 } from 'lucide-react';
import type { BookableService, AvailabilitySchedule } from '@shared/schema';

interface PublicBookingPageProps {
  slug: string;
}

export default function PublicBookingPage({ slug }: PublicBookingPageProps) {
  const [step, setStep] = useState<'service' | 'datetime' | 'info' | 'success'>('service');
  const [selectedService, setSelectedService] = useState<BookableService | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [clientInfo, setClientInfo] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [existingContact, setExistingContact] = useState<any>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const { toast } = useToast();

  // Fetch schedule by public link
  const { data: schedule, isLoading: isLoadingSchedule } = useQuery<AvailabilitySchedule>({
    queryKey: [`/api/public/schedules/${slug}`],
  });

  // Fetch available services for this schedule
  const { data: services, isLoading: isLoadingServices } = useQuery<BookableService[]>({
    queryKey: [`/api/public/schedules/${slug}/services`],
    enabled: !!schedule,
  });

  // Email check function
  const checkEmail = async (email: string) => {
    if (!email || !email.includes('@')) return;
    
    setIsCheckingEmail(true);
    try {
      const response = await fetch('/api/public/contact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, slug }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setExistingContact(data);
          setClientInfo(prev => ({
            ...prev,
            name: data.name || prev.name,
            phone: data.phone || prev.phone,
          }));
          toast({
            title: 'Welcome back!',
            description: 'We found your information',
          });
        } else {
          setExistingContact(null);
        }
      }
    } catch (error) {
      console.error('Error checking email:', error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const response = await fetch(`/api/public/bookings/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingData,
          contactId: existingContact?.contactId || null,
          projectId: existingContact?.mostRecentProjectId || null,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setStep('success');
    },
    onError: (error: any) => {
      toast({
        title: 'Booking failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleServiceSelect = (service: BookableService) => {
    setSelectedService(service);
    setStep('datetime');
  };

  const handleDateTimeSubmit = () => {
    if (!selectedDate || !selectedTime) {
      toast({
        title: 'Missing information',
        description: 'Please select both a date and time',
        variant: 'destructive',
      });
      return;
    }
    setStep('info');
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService || !selectedDate || !selectedTime) {
      toast({
        title: 'Missing information',
        description: 'Please complete all previous steps',
        variant: 'destructive',
      });
      return;
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
      status: 'pending',
    });
  };

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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-booking-title">
            {schedule.name}
          </h1>
          {schedule.description && (
            <p className="text-muted-foreground" data-testid="text-booking-description">
              {schedule.description}
            </p>
          )}
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step === 'service' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'service' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                1
              </div>
              <span className="text-sm">Service</span>
            </div>
            <div className="w-16 h-px bg-muted" />
            <div className={`flex items-center gap-2 ${step === 'datetime' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'datetime' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                2
              </div>
              <span className="text-sm">Date & Time</span>
            </div>
            <div className="w-16 h-px bg-muted" />
            <div className={`flex items-center gap-2 ${step === 'info' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'info' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                3
              </div>
              <span className="text-sm">Your Info</span>
            </div>
          </div>
        </div>

        {/* Step 1: Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Select a Service</h2>
            {isLoadingServices ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </CardContent>
              </Card>
            ) : services && services.length > 0 ? (
              <div className="grid gap-4">
                {services.map((service) => (
                  <Card
                    key={service.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleServiceSelect(service)}
                    data-testid={`card-service-option-${service.id}`}
                  >
                    <CardHeader>
                      <CardTitle>{service.name}</CardTitle>
                      {service.description && (
                        <CardDescription>{service.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{service.duration} minutes</span>
                        </div>
                        {service.price && (
                          <div className="text-lg font-semibold">
                            ${service.price}
                          </div>
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

        {/* Step 2: Date & Time Selection */}
        {step === 'datetime' && selectedService && (
          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
              <CardDescription>
                Booking: {selectedService.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="input-booking-date"
                />
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  data-testid="input-booking-time"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep('service')}
                  data-testid="button-back-to-service"
                >
                  Back
                </Button>
                <Button
                  onClick={handleDateTimeSubmit}
                  className="flex-1"
                  data-testid="button-continue-to-info"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Client Information */}
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
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {/* Email field - always shown first */}
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={clientInfo.email}
                      onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                      onBlur={(e) => checkEmail(e.target.value)}
                      required
                      data-testid="input-client-email"
                      disabled={isCheckingEmail}
                    />
                    {isCheckingEmail && (
                      <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
                    )}
                  </div>
                  {existingContact && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ We found your information
                    </p>
                  )}
                </div>

                {/* Conditional fields based on whether contact exists */}
                {existingContact ? (
                  // Simplified form for existing contacts - pre-filled, read-only
                  <>
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={clientInfo.name}
                        readOnly
                        className="bg-muted"
                        data-testid="input-client-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={clientInfo.phone}
                        readOnly
                        className="bg-muted"
                        data-testid="input-client-phone"
                      />
                    </div>
                  </>
                ) : (
                  // Extended form for new contacts
                  <>
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={clientInfo.name}
                        onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                        required
                        data-testid="input-client-name"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={clientInfo.phone}
                        onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                        required
                        data-testid="input-client-phone"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </>
                )}

                {/* Notes field - always editable */}
                <div>
                  <Label htmlFor="notes">Additional Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={clientInfo.notes}
                    onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })}
                    placeholder="Any special requests or information..."
                    data-testid="input-booking-notes"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('datetime')}
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
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Booking...
                      </>
                    ) : (
                      'Complete Booking'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {step === 'success' && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2" data-testid="text-booking-success">
                Booking Confirmed!
              </h2>
              <p className="text-muted-foreground mb-4">
                We've received your booking request. You'll receive a confirmation email shortly.
              </p>
              <div className="bg-muted rounded-lg p-4 text-left max-w-md mx-auto">
                <h3 className="font-semibold mb-2">Booking Details:</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>Service:</strong> {selectedService?.name}</div>
                  <div><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString()}</div>
                  <div><strong>Time:</strong> {selectedTime}</div>
                  <div><strong>Name:</strong> {clientInfo.name}</div>
                  <div><strong>Email:</strong> {clientInfo.email}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
