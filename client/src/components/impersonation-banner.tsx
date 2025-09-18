import { useQuery, useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function ImpersonationBanner() {
  const { toast } = useToast();

  // Check impersonation status
  const { data: impersonationStatus, isLoading } = useQuery({
    queryKey: ['/api/admin/impersonate/status'],
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  // End impersonation mutation
  const endImpersonationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/impersonate/end');
      if (!response.ok) {
        throw new Error(`Failed to end impersonation: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Impersonation ended",
        description: "You have been returned to your original account"
      });
      // Refresh auth status and impersonation status
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/impersonate/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to end impersonation",
        description: error.message || "Unable to end impersonation session",
        variant: "destructive"
      });
    }
  });

  // Don't render if loading or not impersonating
  if (isLoading || !impersonationStatus?.isImpersonating) {
    return null;
  }

  const { impersonatedUser, originalUser } = impersonationStatus;

  return (
    <Alert 
      className="rounded-none border-x-0 border-t-0 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 px-6 py-3"
      data-testid="impersonation-banner"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-amber-800 dark:text-amber-200 font-medium">
            Impersonating: 
            <span className="font-semibold">
              {impersonatedUser?.email || 'Unknown User'}
              {impersonatedUser?.firstName && impersonatedUser?.lastName && 
                ` (${impersonatedUser.firstName} ${impersonatedUser.lastName})`
              }
            </span>
          </span>
          {originalUser && (
            <span className="text-amber-700 dark:text-amber-300 text-sm">
              • Original: {originalUser.email}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => endImpersonationMutation.mutate()}
          disabled={endImpersonationMutation.isPending}
          className="bg-white dark:bg-gray-900 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
          data-testid="end-impersonation-button"
        >
          {endImpersonationMutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          ) : (
            <>
              <X className="h-3 w-3 mr-1" />
              End Impersonation
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}