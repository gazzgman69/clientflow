import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Calendar, Check, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface GoogleOAuthModalProps {
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function GoogleOAuthModal({ userId, onSuccess, onCancel }: GoogleOAuthModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const startOAuth = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/auth/google/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start OAuth');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.message === 'Already connected') {
        setError('This Google account is already connected');
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      }
    },
    onError: (error: Error) => {
      setError(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your Google account email');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    startOAuth.mutate(email);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Connect Google Calendar
        </CardTitle>
        <CardDescription>
          Enter your Google account email to sync your calendar events bidirectionally
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Google Account Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={startOAuth.isPending}
              className="w-full"
              data-testid="input-google-email"
            />
            <p className="text-xs text-muted-foreground">
              We'll redirect you to Google to authorize calendar access
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={startOAuth.isPending}
              className="flex-1"
              data-testid="button-connect-google"
            >
              {startOAuth.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Connect Google Calendar
                </>
              )}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={startOAuth.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">What happens next:</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>You'll be redirected to Google</li>
            <li>Sign in and authorize calendar access</li>
            <li>Events sync automatically both ways</li>
            <li>Create events in CRM → appear in Google</li>
            <li>Create events in Google → appear in CRM</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}