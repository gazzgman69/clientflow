import { useEffect, useRef, useState } from 'react';

interface UseSmartPollingOptions {
  fetchFn: () => Promise<void>;
  visibleMs?: number;   // default 30000
  hiddenMs?: number;    // default 120000
  debounceMs?: number;  // default 500
}

interface UseSmartPollingReturn {
  refetchNow: () => void;
  stop: () => void;
  lastUpdated?: Date;
  lastError?: string | null;
  fetching: boolean;
}

export function useSmartPolling({
  fetchFn,
  visibleMs = 30000,
  hiddenMs = 120000,
  debounceMs = 500
}: UseSmartPollingOptions): UseSmartPollingReturn {
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>();
  const [lastError, setLastError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  const clearInterval = () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const clearDebounce = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  };

  const executeFetch = async () => {
    if (fetching) return; // Prevent overlapping fetches
    
    setFetching(true);
    try {
      await fetchFn();
      setLastUpdated(new Date());
      setLastError(null);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Fetch failed');
    } finally {
      setFetching(false);
    }
  };

  const scheduleNextFetch = () => {
    clearInterval();
    const delay = isVisibleRef.current ? visibleMs : hiddenMs;
    intervalRef.current = setTimeout(executeFetch, delay);
  };

  const refetchNow = () => {
    clearDebounce();
    debounceRef.current = setTimeout(() => {
      executeFetch().then(() => {
        scheduleNextFetch();
      });
    }, debounceMs);
  };

  const stop = () => {
    clearInterval();
    clearDebounce();
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isVisibleRef.current;
      isVisibleRef.current = !document.hidden;
      
      if (!wasVisible && isVisibleRef.current) {
        // Tab became visible - refetch immediately and reset cadence
        refetchNow();
      } else {
        // Visibility changed - adjust cadence
        scheduleNextFetch();
      }
    };

    const handleFocus = () => {
      if (isVisibleRef.current) {
        refetchNow();
      }
    };

    // Set initial visibility state
    isVisibleRef.current = !document.hidden;

    // Start initial fetch and polling
    executeFetch().then(() => {
      scheduleNextFetch();
    });

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []); // Remove dependencies to prevent infinite loop

  return {
    refetchNow,
    stop,
    lastUpdated,
    lastError,
    fetching
  };
}