/**
 * Currency utilities for multi-currency support
 * Uses browser's Intl.NumberFormat for accurate, localized formatting
 */

// Common currencies with their default locales
export const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  MXN: { code: 'MXN', symbol: '$', name: 'Mexican Peso', locale: 'es-MX' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  CHF: { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', locale: 'de-CH' },
  SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
  NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO' },
  DKK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone', locale: 'da-DK' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'en-HK' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
  PLN: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL' },
} as const;

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

/**
 * Detect user's currency based on browser locale
 * Falls back to USD if detection fails
 */
export function detectCurrencyFromLocale(): CurrencyCode {
  try {
    const locale = navigator.language || 'en-US';
    const region = locale.split('-')[1]?.toUpperCase();
    
    // Map regions to currencies
    const regionToCurrency: Record<string, CurrencyCode> = {
      US: 'USD',
      GB: 'GBP',
      UK: 'GBP',
      DE: 'EUR',
      FR: 'EUR',
      IT: 'EUR',
      ES: 'EUR',
      NL: 'EUR',
      BE: 'EUR',
      AT: 'EUR',
      IE: 'EUR',
      PT: 'EUR',
      CA: 'CAD',
      AU: 'AUD',
      NZ: 'NZD',
      JP: 'JPY',
      CN: 'CNY',
      IN: 'INR',
      MX: 'MXN',
      BR: 'BRL',
      ZA: 'ZAR',
      CH: 'CHF',
      SE: 'SEK',
      NO: 'NOK',
      DK: 'DKK',
      SG: 'SGD',
      HK: 'HKD',
      KR: 'KRW',
      PL: 'PLN',
    };
    
    return regionToCurrency[region] || 'USD';
  } catch {
    return 'USD';
  }
}

/**
 * Format a number as currency using browser's Intl.NumberFormat
 * @param amount - The number to format
 * @param currencyCode - The currency code (USD, GBP, EUR, etc.)
 * @param options - Additional formatting options
 */
export function formatCurrency(
  amount: number | string,
  currencyCode: CurrencyCode = 'USD',
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  }
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return formatCurrency(0, currencyCode, options);
  }
  
  const currency = SUPPORTED_CURRENCIES[currencyCode];
  
  try {
    const formatter = new Intl.NumberFormat(currency.locale, {
      style: options?.showSymbol === false ? 'decimal' : 'currency',
      currency: currencyCode,
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    });
    
    return formatter.format(numAmount);
  } catch {
    // Fallback to simple formatting
    const symbol = options?.showSymbol === false ? '' : currency.symbol;
    return `${symbol}${numAmount.toFixed(2)}`;
  }
}

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: CurrencyCode): string {
  return SUPPORTED_CURRENCIES[currencyCode]?.symbol || '$';
}

/**
 * Parse a currency string to a number
 * Removes currency symbols and formatting
 */
export function parseCurrencyToNumber(currencyString: string): number {
  // Remove all non-numeric characters except decimal point and minus
  const cleaned = currencyString.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
