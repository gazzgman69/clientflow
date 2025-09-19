import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type EmailViewMode = 'unified' | 'rfc';

export interface UserPreferences {
  emailViewMode?: EmailViewMode;
  [key: string]: string | undefined;
}

/**
 * Hook for managing user preferences
 */
export function useUserPrefs(keys?: string[]) {
  const queryClient = useQueryClient();

  // Build query key with keys if provided
  const queryKey = keys?.length
    ? ['/api/user/prefs', { keys: keys.join(',') }]
    : ['/api/user/prefs'];

  const { data: prefs = {}, isLoading, error } = useQuery<UserPreferences>({
    queryKey,
    queryFn: async () => {
      const url = keys?.length 
        ? `/api/user/prefs?keys=${keys.join(',')}`
        : '/api/user/prefs';
      
      const response = await fetch(url, {
        credentials: 'include' // Use session cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user preferences');
      }
      
      return response.json();
    }
  });

  const setPreferenceMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest('POST', '/api/user/prefs', { key, value });
    },
    onSuccess: () => {
      // Invalidate user preferences queries
      queryClient.invalidateQueries({ queryKey: ['/api/user/prefs'] });
    }
  });

  const deletePreferenceMutation = useMutation({
    mutationFn: async (key: string) => {
      return apiRequest('DELETE', `/api/user/prefs/${key}`);
    },
    onSuccess: () => {
      // Invalidate user preferences queries
      queryClient.invalidateQueries({ queryKey: ['/api/user/prefs'] });
    }
  });

  return {
    prefs,
    isLoading,
    error,
    setPreference: setPreferenceMutation.mutate,
    deletePreference: deletePreferenceMutation.mutate,
    isSettingPreference: setPreferenceMutation.isPending,
    isDeletingPreference: deletePreferenceMutation.isPending
  };
}

/**
 * Specific hook for email view mode preference
 */
export function useEmailViewMode() {
  const { prefs, setPreference, isSettingPreference } = useUserPrefs(['emailViewMode']);

  const emailViewMode = (prefs.emailViewMode as EmailViewMode) || 'unified';
  
  const setEmailViewMode = (mode: EmailViewMode) => {
    setPreference({ key: 'emailViewMode', value: mode });
  };

  return {
    emailViewMode,
    setEmailViewMode,
    isSettingViewMode: isSettingPreference
  };
}