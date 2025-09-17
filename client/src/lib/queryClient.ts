import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Simple in-memory cache for CSRF token
let csrfTokenCache: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }
  
  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    const data = await response.json();
    csrfTokenCache = data.csrfToken;
    return csrfTokenCache;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  // For state-changing methods, include CSRF token
  const needsCsrfToken = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase());
  if (needsCsrfToken) {
    try {
      const csrfToken = await getCsrfToken();
      headers['X-CSRF-Token'] = csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token, continuing without it:', error);
      // Continue the request - let the server reject it if needed
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If we get a CSRF error, clear the cache and retry once
  if (res.status === 403 && needsCsrfToken) {
    const errorText = await res.text();
    const errorData = errorText.startsWith('{') ? JSON.parse(errorText) : { message: errorText };
    
    if (errorData.message && errorData.message.toLowerCase().includes('csrf')) {
      console.log('CSRF token expired, refreshing and retrying...');
      csrfTokenCache = null; // Clear cache
      
      try {
        const freshCsrfToken = await getCsrfToken();
        headers['X-CSRF-Token'] = freshCsrfToken;
        
        const retryRes = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
        
        await throwIfResNotOk(retryRes);
        return retryRes;
      } catch (retryError) {
        console.error('Retry with fresh CSRF token failed:', retryError);
        throw retryError;
      }
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
