/**
 * Postcode/Zipcode utilities for regional validation and formatting
 * Based on country locale detection
 */

export interface PostcodeFormat {
  country: string;
  countryCode: string;
  pattern: RegExp;
  format: string;
  example: string;
}

// Postcode/Zipcode formats by country
export const POSTCODE_FORMATS: Record<string, PostcodeFormat> = {
  US: {
    country: 'United States',
    countryCode: 'US',
    pattern: /^\d{5}(-\d{4})?$/,
    format: '99999 or 99999-9999',
    example: '90210 or 90210-1234',
  },
  GB: {
    country: 'United Kingdom',
    countryCode: 'GB',
    pattern: /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
    format: 'XX99 9XX or X9X 9XX',
    example: 'SW1A 1AA or W1A 1AA',
  },
  CA: {
    country: 'Canada',
    countryCode: 'CA',
    pattern: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    format: 'X9X 9X9',
    example: 'K1A 0B1',
  },
  AU: {
    country: 'Australia',
    countryCode: 'AU',
    pattern: /^\d{4}$/,
    format: '9999',
    example: '2000',
  },
  NZ: {
    country: 'New Zealand',
    countryCode: 'NZ',
    pattern: /^\d{4}$/,
    format: '9999',
    example: '1010',
  },
  DE: {
    country: 'Germany',
    countryCode: 'DE',
    pattern: /^\d{5}$/,
    format: '99999',
    example: '10115',
  },
  FR: {
    country: 'France',
    countryCode: 'FR',
    pattern: /^\d{5}$/,
    format: '99999',
    example: '75001',
  },
  IT: {
    country: 'Italy',
    countryCode: 'IT',
    pattern: /^\d{5}$/,
    format: '99999',
    example: '00118',
  },
  ES: {
    country: 'Spain',
    countryCode: 'ES',
    pattern: /^\d{5}$/,
    format: '99999',
    example: '28001',
  },
  NL: {
    country: 'Netherlands',
    countryCode: 'NL',
    pattern: /^\d{4}\s?[A-Z]{2}$/i,
    format: '9999 XX',
    example: '1012 AB',
  },
  BE: {
    country: 'Belgium',
    countryCode: 'BE',
    pattern: /^\d{4}$/,
    format: '9999',
    example: '1000',
  },
  CH: {
    country: 'Switzerland',
    countryCode: 'CH',
    pattern: /^\d{4}$/,
    format: '9999',
    example: '8001',
  },
  SE: {
    country: 'Sweden',
    countryCode: 'SE',
    pattern: /^\d{3}\s?\d{2}$/,
    format: '999 99',
    example: '111 22',
  },
  NO: {
    country: 'Norway',
    countryCode: 'NO',
    pattern: /^\d{4}$/,
    format: '9999',
    example: '0150',
  },
  DK: {
    country: 'Denmark',
    countryCode: 'DK',
    pattern: /^\d{4}$/,
    format: '9999',
    example: '1050',
  },
  JP: {
    country: 'Japan',
    countryCode: 'JP',
    pattern: /^\d{3}-?\d{4}$/,
    format: '999-9999',
    example: '100-0001',
  },
  CN: {
    country: 'China',
    countryCode: 'CN',
    pattern: /^\d{6}$/,
    format: '999999',
    example: '100000',
  },
  IN: {
    country: 'India',
    countryCode: 'IN',
    pattern: /^\d{6}$/,
    format: '999999',
    example: '110001',
  },
  BR: {
    country: 'Brazil',
    countryCode: 'BR',
    pattern: /^\d{5}-?\d{3}$/,
    format: '99999-999',
    example: '01310-100',
  },
  MX: {
    country: 'Mexico',
    countryCode: 'MX',
    pattern: /^\d{5}$/,
    format: '99999',
    example: '01000',
  },
  ZA: {
    country: 'South Africa',
    countryCode: 'ZA',
    pattern: /^\d{4}$/,
    format: '9999',
    example: '0001',
  },
};

/**
 * Detect postcode format based on browser locale
 * Falls back to US format if detection fails
 */
export function detectPostcodeFormat(): PostcodeFormat {
  try {
    const locale = navigator.language || 'en-US';
    const region = locale.split('-')[1]?.toUpperCase();
    
    return POSTCODE_FORMATS[region] || POSTCODE_FORMATS.US;
  } catch {
    return POSTCODE_FORMATS.US;
  }
}

/**
 * Validate a postcode against its country's format
 * @param postcode - The postcode to validate
 * @param countryCode - Optional country code (auto-detected if not provided)
 */
export function validatePostcode(postcode: string, countryCode?: string): boolean {
  const format = countryCode 
    ? POSTCODE_FORMATS[countryCode] || POSTCODE_FORMATS.US
    : detectPostcodeFormat();
  
  return format.pattern.test(postcode.trim());
}

/**
 * Format a postcode according to its country's conventions
 * @param postcode - The postcode to format
 * @param countryCode - Optional country code (auto-detected if not provided)
 */
export function formatPostcode(postcode: string, countryCode?: string): string {
  const cleaned = postcode.replace(/\s/g, '').toUpperCase();
  const format = countryCode 
    ? POSTCODE_FORMATS[countryCode] || POSTCODE_FORMATS.US
    : detectPostcodeFormat();
  
  // Apply country-specific formatting
  switch (format.countryCode) {
    case 'GB':
      // UK: Add space before last 3 characters
      if (cleaned.length >= 5) {
        return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
      }
      return cleaned;
    
    case 'CA':
      // Canada: X9X 9X9
      if (cleaned.length === 6) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      }
      return cleaned;
    
    case 'NL':
      // Netherlands: 9999 XX
      if (cleaned.length === 6) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
      }
      return cleaned;
    
    case 'SE':
      // Sweden: 999 99
      if (cleaned.length === 5) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      }
      return cleaned;
    
    case 'US':
      // US: 99999 or 99999-9999
      if (cleaned.length === 9 && !cleaned.includes('-')) {
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
      }
      return cleaned;
    
    case 'JP':
      // Japan: 999-9999
      if (cleaned.length === 7 && !cleaned.includes('-')) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
      }
      return cleaned;
    
    case 'BR':
      // Brazil: 99999-999
      if (cleaned.length === 8 && !cleaned.includes('-')) {
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
      }
      return cleaned;
    
    default:
      return cleaned;
  }
}

/**
 * Get postcode placeholder text based on country
 */
export function getPostcodePlaceholder(countryCode?: string): string {
  const format = countryCode 
    ? POSTCODE_FORMATS[countryCode] || POSTCODE_FORMATS.US
    : detectPostcodeFormat();
  
  return format.example;
}

/**
 * Get postcode label based on country
 */
export function getPostcodeLabel(countryCode?: string): string {
  const format = countryCode 
    ? POSTCODE_FORMATS[countryCode] || POSTCODE_FORMATS.US
    : detectPostcodeFormat();
  
  // Return appropriate label
  if (['US', 'CA', 'MX'].includes(format.countryCode)) {
    return 'Zip Code';
  }
  return 'Postcode';
}
