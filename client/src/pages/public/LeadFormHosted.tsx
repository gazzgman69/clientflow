import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { VenueAutocomplete } from '@/components/venues/VenueAutocomplete';
import { formatVenueDisplay } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface Question {
  id: string;
  type: string;
  label: string;
  required: boolean;
  mapTo: string;
  options?: string;
  orderIndex: number;
}

interface FormData {
  form: {
    id: string;
    title: string;
    slug: string;
    transparency: string;
    consentRequired: boolean;
    consentText: string;
    privacyPolicyUrl?: string;
    dataRetentionDays: number;
  };
  questions: Question[];
  businessLogo?: string;
  businessName?: string;
}

interface LeadFormHostedProps {
  slug: string;
}

export default function LeadFormHosted({ slug }: LeadFormHostedProps) {
  const [location] = useLocation();
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formattingVenues, setFormattingVenues] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check for embed or dialog mode
  const urlParams = new URLSearchParams(window.location.search);
  const isEmbed = urlParams.get('embed') === '1';
  const isDialog = urlParams.get('dialog') === '1';

  // Fetch form data
  const { data: formData, isLoading, error } = useQuery<FormData>({
    queryKey: ['/api/leads/public', slug],
    queryFn: async () => {
      const response = await fetch(`/api/leads/public/${slug}`);
      if (!response.ok) {
        throw new Error('Form not found');
      }
      return response.json();
    },
  });

  // Format venue displays for legacy data when form loads
  useEffect(() => {
    if (!formData || formattingVenues) return;

    const formatVenueFields = async () => {
      setFormattingVenues(true);
      
      // Find venue questions
      const venueQuestions = formData.questions.filter(q => q.type === 'venue');
      if (venueQuestions.length === 0) {
        setFormattingVenues(false);
        return;
      }

      const updates: Record<string, any> = {};
      let hasUpdates = false;

      for (const question of venueQuestions) {
        const currentValue = formValues[question.mapTo];
        if (currentValue && typeof currentValue === 'string' && !currentValue.includes(' - ')) {
          // This looks like legacy venue data (just name), try to format it
          try {
            const formattedValue = await formatVenueDisplay(currentValue);
            if (formattedValue !== currentValue) {
              updates[question.mapTo] = formattedValue;
              hasUpdates = true;
            }
          } catch (error) {
            console.warn('Failed to format venue display:', currentValue, error);
          }
        }
      }

      if (hasUpdates) {
        setFormValues(prev => ({ ...prev, ...updates }));
      }
      
      setFormattingVenues(false);
    };

    formatVenueFields();
  }, [formData, formattingVenues]); // eslint-disable-line react-hooks/exhaustive-deps


  // Submit form mutation
  const submitMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await fetch(`/api/leads/public/${slug}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit form' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all related caches for instant updates (like leads do)
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });

      // If a redirect URL is configured, use it instead of the thank you screen
      if (data.afterSubmit?.redirectUrl) {
        window.location.href = data.afterSubmit.redirectUrl;
        return;
      }

      setSubmitted(true);
      toast({
        title: 'Form submitted successfully!',
        description: data.afterSubmit?.message || 'Thank you for your submission.',
      });
    },
    onError: () => {
      toast({
        title: 'Submission failed',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (questionId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData) {
      return;
    }

    // Validate required fields
    const missingRequired = formData.questions
      .filter(q => q.required)
      .find(q => !formValues[q.mapTo] || formValues[q.mapTo].toString().trim() === '');

    if (missingRequired) {
      toast({
        title: 'Required field missing',
        description: `Please fill out: ${missingRequired.label}`,
        variant: 'destructive',
      });
      return;
    }

    // Validate consent if required
    if (formData.form.consentRequired && !formValues.consent) {
      toast({
        title: 'Consent required',
        description: 'You must provide consent to process your personal data.',
        variant: 'destructive',
      });
      return;
    }

    // Check honeypot field - if filled, it's likely spam
    if (formValues.website_url && formValues.website_url.trim() !== '') {
      return; // Silent rejection - don't give spammers feedback
    }

    // Map form values to expected format
    const submissionData: Record<string, any> = {};
    formData.questions.forEach(question => {
      if (formValues[question.mapTo] !== undefined) {
        submissionData[question.mapTo] = formValues[question.mapTo];
      }
    });

    // Include venue address components even if they're not explicit form questions
    Object.keys(formValues).forEach(key => {
      if (key.includes('eventLocation') && !submissionData[key]) {
        submissionData[key] = formValues[key];
      }
    });


    submitMutation.mutate({
      data: submissionData,
      consent: formValues.consent || false
    });
  };

  const renderQuestion = (question: Question) => {
    const value = formValues[question.mapTo] || '';

    switch (question.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
      case 'date':
        return (
          <Input
            type={question.type}
            value={value}
            onChange={(e) => handleInputChange(question.mapTo, e.target.value)}
            required={question.required}
            data-testid={`input-${question.mapTo}`}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleInputChange(question.mapTo, e.target.value)}
            required={question.required}
            rows={4}
            data-testid={`textarea-${question.mapTo}`}
          />
        );

      case 'select':
        const selectOptions = question.options ? question.options.split(',').map(opt => opt.trim()) : [];
        return (
          <Select
            value={value}
            onValueChange={(val) => handleInputChange(question.mapTo, val)}
            required={question.required}
          >
            <SelectTrigger data-testid={`select-${question.mapTo}`}>
              <SelectValue placeholder="Please select..." />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((option, idx) => (
                <SelectItem key={idx} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        const radioOptions = question.options ? question.options.split(',').map(opt => opt.trim()) : [];
        return (
          <RadioGroup
            value={value}
            onValueChange={(val) => handleInputChange(question.mapTo, val)}
            data-testid={`radio-${question.mapTo}`}
          >
            {radioOptions.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${idx}`} />
                <Label htmlFor={`${question.id}-${idx}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        const checkboxOptions = question.options ? question.options.split(',').map(opt => opt.trim()) : [];
        const selectedValues = Array.isArray(value) ? value : [];
        
        return (
          <div className="space-y-2" data-testid={`checkbox-${question.mapTo}`}>
            {checkboxOptions.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${idx}`}
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleInputChange(question.mapTo, [...selectedValues, option]);
                    } else {
                      handleInputChange(question.mapTo, selectedValues.filter((v: string) => v !== option));
                    }
                  }}
                />
                <Label htmlFor={`${question.id}-${idx}`}>{option}</Label>
              </div>
            ))}
          </div>
        );

      case 'venue':
        return (
          <VenueAutocomplete
            onVenueSelect={(venue) => {
              // Create full address display - show the complete address that was selected
              const addressParts = [venue.name];
              if (venue.address) addressParts.push(venue.address);
              if (venue.city) addressParts.push(venue.city);
              if (venue.state) addressParts.push(venue.state);
              if (venue.zipCode) addressParts.push(venue.zipCode);
              
              const fullAddress = addressParts.join(', ');
                
              // Store the full address as the main value
              handleInputChange(question.mapTo, fullAddress);
              // Also store detailed venue information for server-side processing
              if (venue.placeId) handleInputChange(`${question.mapTo}PlaceId`, venue.placeId);
              if (venue.city) handleInputChange(`${question.mapTo}City`, venue.city);
              if (venue.state) handleInputChange(`${question.mapTo}State`, venue.state);
              if (venue.zipCode) handleInputChange(`${question.mapTo}ZipCode`, venue.zipCode);
              if (venue.country) handleInputChange(`${question.mapTo}Country`, venue.country);
            }}
            placeholder="Search for venues and locations..."
            initialValue={value}
            data-testid={`venue-${question.mapTo}`}
          />
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
        </div>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">Form Not Found</h2>
            <p className="text-muted-foreground">
              The form you're looking for doesn't exist or has been disabled.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={`${isDialog ? '' : 'min-h-screen'} flex items-center justify-center p-4`}>
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground">
              {formData?.form?.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.'}
            </p>
            {isDialog && (
              <Button 
                onClick={() => window.close()} 
                className="mt-4"
                data-testid="button-close-dialog"
              >
                Close
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${isDialog ? 'p-4' : 'min-h-screen py-8'} ${isEmbed ? 'p-0' : 'px-4'}`}>
      <div className="max-w-2xl mx-auto">
        {/* Business Logo */}
        {formData.businessLogo && !isEmbed && (
          <div className="flex justify-center py-5 px-6 mb-6 bg-white rounded-lg border border-gray-100 shadow-sm">
            <img
              src={formData.businessLogo}
              alt={formData.businessName || 'Business logo'}
              className="object-contain"
              style={{ maxWidth: '160px', maxHeight: '56px' }}
            />
          </div>
        )}
        <Card data-testid="lead-form-card">
          <CardHeader>
            <CardTitle className="text-2xl">{formData.form.title}</CardTitle>
            {formData.form.transparency && (
              <p className="text-sm text-muted-foreground">
                {formData.form.transparency}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {formData.questions
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((question) => (
                  <div key={question.id} className="space-y-2">
                    <Label className="text-sm font-medium">
                      {question.label}
                      {question.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    {renderQuestion(question)}
                  </div>
                ))}

              {/* Honeypot field - hidden from humans, visible to bots */}
              <input
                type="url"
                name="website_url"
                value={formValues.website_url || ''}
                onChange={(e) => handleInputChange('website_url', e.target.value)}
                style={{
                  position: 'absolute',
                  left: '-9999px',
                  width: '1px',
                  height: '1px',
                  opacity: 0,
                  overflow: 'hidden'
                }}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                data-testid="honeypot-field"
              />

              {/* Consent Checkbox - GDPR Compliance */}
              {formData.form.consentRequired && (
                <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg border">
                  <Checkbox
                    id="consent-checkbox"
                    checked={formValues.consent || false}
                    onCheckedChange={(checked) => handleInputChange('consent', checked)}
                    data-testid="checkbox-consent"
                    className="mt-0.5"
                  />
                  <div className="space-y-2">
                    <Label 
                      htmlFor="consent-checkbox" 
                      className="text-sm leading-relaxed cursor-pointer"
                    >
                      {formData.form.consentText}
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    {formData.form.privacyPolicyUrl && (
                      <a 
                        href={formData.form.privacyPolicyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-primary hover:underline"
                        data-testid="link-privacy-policy"
                      >
                        View Privacy Policy
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Your data will be retained for {formData.form.dataRetentionDays} days as per our data retention policy.
                    </p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || submitMutation.isPending}
                data-testid="button-submit-form"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}