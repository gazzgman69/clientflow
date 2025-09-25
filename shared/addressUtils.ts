/**
 * Utility functions for cleaning and validating venue addresses
 * to prevent duplication and formatting issues
 */

export interface AddressComponents {
  venueName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

/**
 * Clean address field by removing venue name duplication and redundant information
 * Handles both comma-delimited and non-comma formats
 */
export function cleanVenueAddress(address: string, venueName: string): string {
  if (!address || !venueName) return address || '';
  
  let cleanAddress = address.trim();
  const cleanVenueName = venueName.trim();
  
  // Escape special regex characters in venue name
  const escapedVenueName = cleanVenueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Strategy 1: Remove venue name from the beginning of the address
  // Handles cases like "Venue Name 123 Main St" or "Venue Name, 123 Main St"
  const startPattern = new RegExp(`^${escapedVenueName}[,\\s]*`, 'i');
  cleanAddress = cleanAddress.replace(startPattern, '');
  
  // Strategy 2: Remove venue name from the end of the address
  // Handles cases like "123 Main St, Venue Name"
  const endPattern = new RegExp(`[,\\s]*${escapedVenueName}\\s*$`, 'i');
  cleanAddress = cleanAddress.replace(endPattern, '');
  
  // Strategy 3: For comma-delimited addresses, filter out parts containing venue name
  if (cleanAddress.includes(',')) {
    const addressParts = cleanAddress.split(',').map(part => part.trim());
    const cleanVenueNameLower = cleanVenueName.toLowerCase();
    
    const cleanedParts = addressParts.filter(part => {
      const partLower = part.toLowerCase();
      // Keep the part if it doesn't contain the venue name, or if it's very short (likely just a number/abbreviation)
      return !partLower.includes(cleanVenueNameLower) || part.length <= Math.max(3, cleanVenueName.length * 0.3);
    });
    
    // Only use filtered result if we have meaningful content left
    if (cleanedParts.length > 0 && cleanedParts.some(part => part.length > 2)) {
      cleanAddress = cleanedParts.join(', ');
    }
  }
  
  // Strategy 4: Remove any remaining exact venue name matches
  const exactPattern = new RegExp(escapedVenueName, 'gi');
  const potentialClean = cleanAddress.replace(exactPattern, '').replace(/,\s*,/g, ',').trim();
  
  // Only use the result if we still have meaningful content
  if (potentialClean.length > 3 && /\d/.test(potentialClean)) {
    cleanAddress = potentialClean;
  }
  
  // Clean up any remaining formatting issues
  cleanAddress = cleanAddress
    .replace(/^[,\s]+|[,\s]+$/g, '') // Remove leading/trailing commas and spaces
    .replace(/,\s*,+/g, ',') // Remove duplicate commas
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // If we ended up with an empty or very short result, return the original
  // but with basic venue name removal
  if (!cleanAddress || cleanAddress.length < 3) {
    return address.replace(new RegExp(`${escapedVenueName}[,\\s]*`, 'gi'), '').trim();
  }
  
  return cleanAddress;
}

/**
 * Remove duplicate address components that appear multiple times
 */
export function removeDuplicateAddressParts(address: string): string {
  if (!address) return '';
  
  const parts = address.split(',').map(part => part.trim());
  const uniqueParts = [];
  const seenParts = new Set();
  
  for (const part of parts) {
    const normalizedPart = part.toLowerCase().replace(/\s+/g, ' ');
    if (!seenParts.has(normalizedPart) && part.length > 0) {
      seenParts.add(normalizedPart);
      uniqueParts.push(part);
    }
  }
  
  return uniqueParts.join(', ');
}

/**
 * Validate and clean a complete venue address
 */
export function validateAndCleanVenueAddress(components: AddressComponents): AddressComponents {
  const { venueName, address, city, state, zipCode, country } = components;
  
  let cleanedAddress = address || '';
  
  // Step 1: Remove venue name duplication
  if (venueName) {
    cleanedAddress = cleanVenueAddress(cleanedAddress, venueName);
  }
  
  // Step 2: Remove duplicate parts
  cleanedAddress = removeDuplicateAddressParts(cleanedAddress);
  
  // Step 3: If address contains city/state/zip, extract just the street address
  if (city && cleanedAddress.toLowerCase().includes(city.toLowerCase())) {
    const addressParts = cleanedAddress.split(',').map(part => part.trim());
    const streetParts = [];
    
    for (const part of addressParts) {
      const partLower = part.toLowerCase();
      // Skip parts that contain city, state, or postal code patterns
      if (
        city && partLower.includes(city.toLowerCase()) ||
        state && partLower.includes(state.toLowerCase()) ||
        /\b\d{5}(-\d{4})?\b/.test(part) || // US ZIP code
        /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(part) // UK postcode
      ) {
        continue;
      }
      streetParts.push(part);
    }
    
    if (streetParts.length > 0) {
      cleanedAddress = streetParts.join(', ');
    }
  }
  
  return {
    ...components,
    address: cleanedAddress.trim()
  };
}

/**
 * Check if an address appears to have duplication issues
 */
export function hasAddressDuplication(address: string, venueName?: string): boolean {
  if (!address) return false;
  
  // Check for obvious duplication patterns
  const duplicatePattern = /(.+),\s*\1/i; // Matches "Text, Text"
  if (duplicatePattern.test(address)) return true;
  
  // Check for venue name appearing in address
  if (venueName && address.toLowerCase().includes(venueName.toLowerCase())) {
    return true;
  }
  
  // Check for excessive length (might indicate duplication)
  if (address.length > 150) return true;
  
  return false;
}