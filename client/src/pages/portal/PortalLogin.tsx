import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

type LoginStep = 'email' | 'code';

export default function PortalLogin() {
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Request OTP mutation
  const requestOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/portal/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to request code');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: 'Check your email for the verification code',
      });
      setStep('code');
      setExpiresIn(data.expiresIn);

      // Start countdown timer
      let timeLeft = data.expiresIn;
      const timer = setInterval(() => {
        timeLeft--;
        setExpiresIn(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(timer);
          setStep('email');
          setEmail('');
          setCode('');
          setExpiresIn(null);
          toast({
            title: 'Code Expired',
            description: 'Your verification code has expired. Please request a new one.',
            variant: 'destructive',
          });
        }
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch('/api/portal/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to verify code');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'You are now logged in',
      });
      // Redirect to portal client after a brief delay
      setTimeout(() => {
        setLocation('/portal/client');
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setCode('');
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: 'Error',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }
    requestOtpMutation.mutate(email);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast({
        title: 'Error',
        description: 'Please enter a valid 6-digit code',
        variant: 'destructive',
      });
      return;
    }
    verifyOtpMutation.mutate(code);
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Client Portal Access</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={requestOtpMutation.isPending}
                  className="mt-1"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={requestOtpMutation.isPending || !email}
                className="w-full"
              >
                {requestOtpMutation.isPending ? 'Sending...' : 'Send Verification Code'}
              </Button>

              <p className="text-sm text-gray-500 text-center">
                Enter your email to receive a 6-digit verification code
              </p>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={verifyOtpMutation.isPending}
                  maxLength={6}
                  className="mt-1 text-center text-lg tracking-widest"
                  autoFocus
                />
              </div>

              {expiresIn !== null && (
                <div className="text-sm text-gray-600 text-center">
                  Code expires in {formatTime(expiresIn)}
                </div>
              )}

              <Button
                type="submit"
                disabled={verifyOtpMutation.isPending || code.length !== 6}
                className="w-full"
              >
                {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify Code'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setExpiresIn(null);
                }}
                disabled={verifyOtpMutation.isPending}
                className="w-full"
              >
                Back
              </Button>

              <p className="text-sm text-gray-500 text-center">
                We sent a 6-digit code to {email}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
