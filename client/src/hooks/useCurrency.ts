import { useQuery } from '@tanstack/react-query';
import { formatCurrency, detectCurrencyFromLocale, getCurrencySymbol, type CurrencyCode } from '@/lib/currency';

/**
 * Hook to access current tenant currency settings
 * Provides formatting utilities with the correct currency
 */
export function useCurrency() {
  // Fetch tenant settings
  const { data: tenantSettings, isLoading } = useQuery({
    queryKey: ['/api/tenant-settings'],
    queryFn: async () => {
      const response = await fetch('/api/tenant-settings', {
        credentials: 'include'
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get currency code (from settings or browser detection)
  const currencyCode: CurrencyCode = tenantSettings?.currency || detectCurrencyFromLocale();

  // Get currency symbol
  const currencySymbol = getCurrencySymbol(currencyCode);

  // Format a number as currency
  const format = (amount: number | string, options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  }) => {
    return formatCurrency(amount, currencyCode, options);
  };

  return {
    currencyCode,
    currencySymbol,
    format,
    isLoading,
  };
}
