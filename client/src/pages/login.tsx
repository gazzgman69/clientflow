import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Building2, User, Lock, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { z } from 'zod';

// Login form schema
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

type LoginFormData = z.infer<typeof loginSchema>;

// Signup form schema
const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required')
});

type SignupFormData = z.infer<typeof signupSchema>;

interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    backgroundColor?: string;
    welcomeMessage?: string;
    loginTitle?: string;
    companyName?: string;
  };
}

// MFA step state
interface MfaState {
  mfaTokenId: string;
  email: string;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSecondsLeft, setMfaSecondsLeft] = useState(600); // 10 minutes
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  // Check if user is already authenticated and redirect
  const { data: authData } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false
  });

  useEffect(() => {
    if (authData?.user) {
      setLocation('/');
    }
  }, [authData, setLocation]);

  // MFA countdown timer
  useEffect(() => {
    if (mfaState) {
      setMfaSecondsLeft(600);
      timerRef.current = setInterval(() => {
        setMfaSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mfaState]);

  const mfaMinutes = Math.floor(mfaSecondsLeft / 60);
  const mfaSeconds = mfaSecondsLeft % 60;

  // Fetch tenant configuration for branding
  const { data: tenantConfig, isLoading: tenantLoading } = useQuery({
    queryKey: ['/api/tenant/config'],
    retry: false
  });

  const tenant = tenantConfig as TenantConfig | undefined;

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: ''
    }
  });

  // Signup form
  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: ''
    }
  });

  // Login mutation — now returns requiresMfa challenge
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest('POST', '/api/auth/login', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.requiresMfa) {
        // Move to MFA step
        setMfaState({ mfaTokenId: data.mfaTokenId, email: data.email });
        setMfaCode('');
      } else if (data.success) {
        toast({
          title: "Login successful",
          description: `Welcome back, ${data.user.firstName}!`
        });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        setLocation('/');
      } else {
        toast({
          title: "Login failed",
          description: data.error || "Invalid credentials",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login error",
        description: error.message || "Failed to log in",
        variant: "destructive"
      });
    }
  });

  // MFA verify mutation
  const mfaMutation = useMutation({
    mutationFn: async ({ mfaTokenId, code }: { mfaTokenId: string; code: string }) => {
      const response = await apiRequest('POST', '/api/auth/verify-mfa', { mfaTokenId, code });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Login successful",
          description: `Welcome back, ${data.user.firstName}!`
        });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        setLocation('/');
      } else {
        toast({
          title: "Verification failed",
          description: data.error || "Invalid code. Please try again.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Verification error",
        description: error.message || "Invalid or expired code",
        variant: "destructive"
      });
    }
  });

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      const response = await apiRequest('POST', '/api/auth/signup', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Account created",
          description: `Welcome to ${tenant?.branding?.companyName || 'BusinessCRM'}, ${data.user.firstName}!`
        });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        setLocation('/onboarding');
      } else {
        toast({
          title: "Signup failed",
          description: data.error || "Failed to create account",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Signup error",
        description: error.message || "Failed to create account",
        variant: "destructive"
      });
    }
  });

  const onLoginSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onSignupSubmit = (data: SignupFormData) => {
    signupMutation.mutate(data);
  };

  const onMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaState || !mfaCode.trim()) return;
    mfaMutation.mutate({ mfaTokenId: mfaState.mfaTokenId, code: mfaCode.trim() });
  };

  // Apply tenant branding
  const brandingStyle = {
    backgroundColor: tenant?.branding?.backgroundColor || '#ffffff',
    '--primary': tenant?.branding?.primaryColor || '#0ea5e9'
  } as React.CSSProperties;

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
      style={brandingStyle}
      data-testid="login-page"
    >
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {tenant?.branding?.logo ? (
            <img
              src={tenant.branding.logo}
              alt={`${tenant.branding.companyName || tenant.name} logo`}
              className="mx-auto h-12 w-auto mb-4"
              data-testid="tenant-logo"
            />
          ) : (
            <Building2 className="mx-auto h-12 w-12 text-blue-600 mb-4" />
          )}
          <h2 className="text-3xl font-bold text-gray-900" data-testid="login-title">
            {mfaState
              ? 'Two-Factor Authentication'
              : isSignup
                ? `Join ${tenant?.branding?.companyName || tenant?.name || 'BusinessCRM'}`
                : (tenant?.branding?.loginTitle || `Sign in to ${tenant?.branding?.companyName || tenant?.name || 'BusinessCRM'}`)
            }
          </h2>
          {tenant?.branding?.welcomeMessage && !isSignup && !mfaState && (
            <p className="mt-2 text-gray-600" data-testid="welcome-message">
              {tenant.branding.welcomeMessage}
            </p>
          )}
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">
              {mfaState ? (
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  Verify your identity
                </span>
              ) : isSignup ? 'Create your account' : 'Welcome back'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* MFA Step */}
            {mfaState ? (
              <form onSubmit={onMfaSubmit} className="space-y-4">
                <p className="text-sm text-gray-600 text-center">
                  A 6-digit verification code has been sent to{' '}
                  <span className="font-medium text-gray-900">{mfaState.email}</span>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="mfa-code">Verification code</Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl tracking-widest font-mono"
                    autoFocus
                    data-testid="input-mfa-code"
                  />
                </div>
                {mfaSecondsLeft > 0 ? (
                  <p className="text-xs text-center text-gray-500">
                    Code expires in{' '}
                    <span className="font-medium text-gray-700">
                      {mfaMinutes}:{String(mfaSeconds).padStart(2, '0')}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-center text-red-500 font-medium">
                    Code expired. Please go back and sign in again.
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={mfaMutation.isPending || mfaCode.length !== 6 || mfaSecondsLeft === 0}
                  data-testid="button-verify-mfa"
                  style={{ backgroundColor: tenant?.branding?.primaryColor || undefined }}
                >
                  {mfaMutation.isPending ? 'Verifying...' : 'Verify'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm text-gray-500"
                  onClick={() => { setMfaState(null); setMfaCode(''); }}
                  data-testid="button-back-to-login"
                >
                  Back to sign in
                </Button>
              </form>
            ) : !isSignup ? (
              /* Login Step */
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Username
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            autoComplete="username"
                            data-testid="input-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              autoComplete="current-password"
                              data-testid="input-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                    style={{ backgroundColor: tenant?.branding?.primaryColor || undefined }}
                  >
                    {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
                  </Button>
                </form>
              </Form>
            ) : (
              /* Signup Step */
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4" autoComplete="off">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={signupForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="nope" data-testid="input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="nope" data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={signupForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Username
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete="nope"
                            onChange={(e) => {
                              field.onChange(e);
                              const value = e.target.value;
                              if (value !== field.value) {
                                signupForm.setValue('username', value, { shouldValidate: true });
                              }
                            }}
                            data-testid="input-signup-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </FormLabel>
                        <FormControl>
                          <Input {...field} type="email" autoComplete="nope" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              data-testid="input-signup-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                              data-testid="button-toggle-signup-password"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={signupMutation.isPending}
                    data-testid="button-signup"
                    style={{ backgroundColor: tenant?.branding?.primaryColor || undefined }}
                  >
                    {signupMutation.isPending ? 'Creating account...' : 'Create account'}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
          {!mfaState && (
            <CardFooter className="flex flex-col space-y-4">
              <Separator />
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {isSignup ? 'Already have an account?' : "Don't have an account?"}
                </p>
                <Button
                  variant="link"
                  onClick={() => setIsSignup(!isSignup)}
                  className="p-0 h-auto text-blue-600 hover:text-blue-800"
                  data-testid={isSignup ? "link-signin" : "link-signup"}
                  style={{ color: tenant?.branding?.primaryColor || undefined }}
                >
                  {isSignup ? 'Sign in here' : 'Create one here'}
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Powered by {tenant?.branding?.companyName || tenant?.name || 'BusinessCRM'}
          </p>
        </div>
      </div>
    </div>
  );
}
