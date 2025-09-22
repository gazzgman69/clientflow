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
    recaptchaEnabled: boolean;
    transparency: string;
  };
  questions: Question[];
}

interface LeadFormHostedProps {
  slug: string;
}

export default function LeadFormHosted({ slug }: LeadFormHostedProps) {
  const [location] = useLocation();
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
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

  // Load reCAPTCHA script dynamically
  useEffect(() => {
    if (!formData?.form.recaptchaEnabled) return;
    
    // Don't reload if already loaded
    if (window.grecaptcha && (window as any).recaptchaSiteKey) {
      setRecaptchaLoaded(true);
      return;
    }
    
    // Fetch site key from backend
    fetch('/api/leads/recaptcha-config')
      .then(res => res.json())
      .then(config => {
        console.log('reCAPTCHA config loaded:', { enabled: config.enabled, hasSiteKey: !!config.siteKey });
        if (!config.siteKey || !config.enabled) {
          console.error('reCAPTCHA not properly configured on server');
          return;
        }
        
        // Store site key first
        (window as any).recaptchaSiteKey = config.siteKey;
        
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${config.siteKey}`;
        script.async = true;
        script.onload = () => {
          console.log('reCAPTCHA script loaded successfully');
          window.grecaptcha.ready(() => {
            console.log('reCAPTCHA ready');
            setRecaptchaLoaded(true);
          });
        };
        script.onerror = (error) => {
          console.error('Failed to load reCAPTCHA script:', error);
        };
        document.head.appendChild(script);
      })
      .catch(err => {
        console.error('Failed to load reCAPTCHA config:', err);
      });
    
    return () => {
      const existingScript = document.head.querySelector(`script[src*="recaptcha"]`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [formData?.form.recaptchaEnabled]);

  // Submit form mutation
  const submitMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      console.log('🌐 FETCH DEBUG: Starting fetch request', { url: `/api/leads/public/${slug}/submit`, data });
      
      const response = await fetch(`/api/leads/public/${slug}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      console.log('📡 FETCH DEBUG: Response received', { 
        status: response.status, 
        statusText: response.statusText, 
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit form' }));
        console.error('❌ FETCH DEBUG: Response not ok', { status: response.status, errorData });
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ FETCH DEBUG: Success response', { result });
      return result;
    },
    onSuccess: (data) => {
      setSubmitted(true);
      // Invalidate all related caches for instant updates (like leads do)
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
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
    console.log('🔍 FORM DEBUG: handleSubmit called', { hasFormData: !!formData, formValues });
    
    if (!formData) {
      console.log('❌ FORM DEBUG: No form data available');
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

    // Get reCAPTCHA token if enabled
    let recaptchaToken = '';
    if (formData.form.recaptchaEnabled) {
      if (!recaptchaLoaded) {
        toast({
          title: 'Security verification loading',
          description: 'Please wait for security verification to load and try again.',
          variant: 'destructive',
        });
        return;
      }
      
      try {
        const siteKey = (window as any).recaptchaSiteKey;
        console.log('reCAPTCHA token generation:', { 
          hasSiteKey: !!siteKey, 
          hasGrecaptcha: !!window.grecaptcha,
          recaptchaLoaded 
        });
        
        if (!siteKey) {
          throw new Error('reCAPTCHA site key not available');
        }
        
        if (!window.grecaptcha) {
          throw new Error('reCAPTCHA script not loaded');
        }
        
        recaptchaToken = await window.grecaptcha.execute(siteKey, { action: 'submit' });
        console.log('reCAPTCHA token generated:', { tokenLength: recaptchaToken?.length });
        
        if (!recaptchaToken || recaptchaToken.length < 10) {
          throw new Error('Invalid reCAPTCHA token generated');
        }
      } catch (error) {
        console.error('reCAPTCHA error:', error);
        toast({
          title: 'Security verification failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }
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

    // Add reCAPTCHA token to submission
    if (recaptchaToken) {
      submissionData.recaptchaToken = recaptchaToken;
    }

    console.log('🚀 FORM DEBUG: About to submit form', { submissionData, url: `/api/leads/public/${slug}/submit` });
    submitMutation.mutate(submissionData);
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
        // Temporarily use a simple text input instead of venue autocomplete
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(question.mapTo, e.target.value)}
            required={question.required}
            placeholder="Enter venue location or address..."
            data-testid={`input-${question.mapTo}`}
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
              Your form has been submitted successfully. We'll be in touch soon.
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

              {formData.form.recaptchaEnabled && (
                <div className="text-xs text-muted-foreground mb-4">
                  This site is protected by reCAPTCHA and the Google{' '}
                  <a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a href="https://policies.google.com/terms" className="underline" target="_blank" rel="noopener noreferrer">
                    Terms of Service
                  </a>{' '}
                  apply.
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || submitMutation.isPending || (formData.form.recaptchaEnabled && !recaptchaLoaded)}
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