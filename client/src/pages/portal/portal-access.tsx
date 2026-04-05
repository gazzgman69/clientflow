import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PortalAccess() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Auto-verify token if present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      verifyTokenMutation.mutate(token);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAccessMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/portal/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || err.message || "Failed to request access");
      }
      return response.json();
    },
    onSuccess: () => {
      setRequestSent(true);
    },
  });

  const verifyTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch("/api/portal/auth/verify-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || err.message || "Invalid or expired link");
      }
      return response.json();
    },
    onSuccess: () => {
      // Token verified — redirect to portal
      setLocation("/portal/client");
    },
    onError: (err: Error) => {
      setTokenError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    requestAccessMutation.mutate(email.trim());
  };

  // Show loading state while auto-verifying a token from URL
  if (verifyTokenMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying your access link…</p>
        </div>
      </div>
    );
  }

  // Show error if token was invalid
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Link Expired
            </CardTitle>
            <CardDescription>
              This access link is no longer valid. Access links expire after 15 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{tokenError}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setTokenError(null);
                // Clear token from URL
                window.history.replaceState({}, "", "/portal/access");
              }}
            >
              Request a new access link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success state after requesting access
  if (requestSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Check Your Email
            </CardTitle>
            <CardDescription>
              If an account exists for <strong>{email}</strong>, you'll receive a secure access link
              shortly. The link expires in 15 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Didn't receive an email? Check your spam folder, or{" "}
              <button
                className="text-primary underline"
                onClick={() => setRequestSent(false)}
              >
                try again
              </button>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: show the email request form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Client Portal Access
          </CardTitle>
          <CardDescription>
            Enter the email address associated with your account. We'll send you a
            secure, one-time access link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portal-email">Email Address</Label>
              <Input
                id="portal-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                data-testid="input-portal-email"
              />
            </div>
            {requestAccessMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(requestAccessMutation.error as Error).message}
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={requestAccessMutation.isPending || !email.trim()}
              data-testid="button-request-access"
            >
              {requestAccessMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Access Link"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
