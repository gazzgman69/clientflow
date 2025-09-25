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
 */
export function cleanVenueAddress(address: string, venueName: string): string {
  if (!address || !venueName) return address || '';
  
  // Convert to lowercase for comparison
  const cleanAddress = address.trim();
  const cleanVenueName = venueName.trim().toLowerCase();
  
  // Split address by commas to check each part
  const addressParts = cleanAddress.split(',').map(part => part.trim());
  
  // Remove parts that contain the venue name
  const cleanedParts = addressParts.filter(part => {
    const partLower = part.toLowerCase();
    return !partLower.includes(cleanVenueName) || partLower.length <= cleanVenueName.length + 5;
  });
  
  // If we removed too much, keep the original but remove exact duplicates
  if (cleanedParts.length === 0) {
    return cleanAddress.replace(new RegExp(`${venueName},?\\s*`, 'gi'), '');
  }
  
  return cleanedParts.join(', ');
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