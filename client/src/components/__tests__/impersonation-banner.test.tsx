import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImpersonationBanner } from '../impersonation-banner';
import { apiRequest } from '@/lib/queryClient';

// Mock the apiRequest function
jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: {
    invalidateQueries: jest.fn()
  }
}));

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ImpersonationBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when not impersonating', async () => {
    // Mock API response for not impersonating
    mockApiRequest.mockImplementation((method, url) => {
      if (url === '/api/admin/impersonate/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            isImpersonating: false,
            originalUser: null,
            impersonatedUser: null
          })
        } as Response);
      }
      return Promise.reject(new Error('Unexpected API call'));
    });

    render(<ImpersonationBanner />, { wrapper: createWrapper() });
    
    // Wait for the query to complete
    await waitFor(() => {
      expect(screen.queryByTestId('impersonation-banner')).not.toBeInTheDocument();
    });
  });

  it('should render banner when impersonating', async () => {
    // Mock API response for impersonating
    mockApiRequest.mockImplementation((method, url) => {
      if (url === '/api/admin/impersonate/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            isImpersonating: true,
            originalUser: {
              id: 'admin-123',
              email: 'admin@test.com',
              firstName: 'Admin',
              lastName: 'User',
              role: 'super_admin'
            },
            impersonatedUser: {
              id: 'user-123',
              email: 'user@test.com',
              firstName: 'Test',
              lastName: 'User',
              role: 'user'
            }
          })
        } as Response);
      }
      return Promise.reject(new Error('Unexpected API call'));
    });

    render(<ImpersonationBanner />, { wrapper: createWrapper() });
    
    // Wait for the banner to appear
    await waitFor(() => {
      expect(screen.getByTestId('impersonation-banner')).toBeInTheDocument();
    });
    
    // Check that impersonated user info is displayed
    expect(screen.getByText(/Impersonating:/)).toBeInTheDocument();
    expect(screen.getByText(/user@test.com/)).toBeInTheDocument();
    expect(screen.getByText(/Original: admin@test.com/)).toBeInTheDocument();
    expect(screen.getByTestId('end-impersonation-button')).toBeInTheDocument();
  });

  it('should handle end impersonation click', async () => {
    // Mock status API response
    mockApiRequest.mockImplementation((method, url) => {
      if (method === 'GET' && url === '/api/admin/impersonate/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            isImpersonating: true,
            originalUser: { id: 'admin-123', email: 'admin@test.com' },
            impersonatedUser: { id: 'user-123', email: 'user@test.com' }
          })
        } as Response);
      }
      
      if (method === 'POST' && url === '/api/admin/impersonate/end') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            message: 'Impersonation ended successfully'
          })
        } as Response);
      }
      
      return Promise.reject(new Error('Unexpected API call'));
    });

    render(<ImpersonationBanner />, { wrapper: createWrapper() });
    
    // Wait for banner to render
    await waitFor(() => {
      expect(screen.getByTestId('end-impersonation-button')).toBeInTheDocument();
    });
    
    // Click the end impersonation button
    fireEvent.click(screen.getByTestId('end-impersonation-button'));
    
    // Wait for the API call and success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Impersonation ended",
          description: "You have been returned to your original account"
        })
      );
    });
  });

  it('should handle end impersonation error', async () => {
    // Mock status API response
    mockApiRequest.mockImplementation((method, url) => {
      if (method === 'GET' && url === '/api/admin/impersonate/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            isImpersonating: true,
            originalUser: { id: 'admin-123', email: 'admin@test.com' },
            impersonatedUser: { id: 'user-123', email: 'user@test.com' }
          })
        } as Response);
      }
      
      if (method === 'POST' && url === '/api/admin/impersonate/end') {
        return Promise.resolve({
          ok: false,
          status: 500
        } as Response);
      }
      
      return Promise.reject(new Error('Unexpected API call'));
    });

    render(<ImpersonationBanner />, { wrapper: createWrapper() });
    
    // Wait for banner to render
    await waitFor(() => {
      expect(screen.getByTestId('end-impersonation-button')).toBeInTheDocument();
    });
    
    // Click the end impersonation button
    fireEvent.click(screen.getByTestId('end-impersonation-button'));
    
    // Wait for error toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to end impersonation",
          variant: "destructive"
        })
      );
    });
  });

  it('should display user names when available', async () => {
    mockApiRequest.mockImplementation((method, url) => {
      if (url === '/api/admin/impersonate/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            isImpersonating: true,
            originalUser: {
              id: 'admin-123',
              email: 'admin@test.com',
              firstName: 'Admin',
              lastName: 'User'
            },
            impersonatedUser: {
              id: 'user-123',
              email: 'user@test.com',
              firstName: 'John',
              lastName: 'Doe'
            }
          })
        } as Response);
      }
      return Promise.reject(new Error('Unexpected API call'));
    });

    render(<ImpersonationBanner />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/user@test.com \(John Doe\)/)).toBeInTheDocument();
    });
  });
});