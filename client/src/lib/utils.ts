import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format venue display with full address from cache when possible
 * Handles legacy venue names like "The Post Barn" by looking up full address from cache
 */
export async function formatVenueDisplay(venueValue: string): Promise<string> {
  // If already in full format (contains " - "), return as is
  if (venueValue.includes(' - ')) {
    return venueValue;
  }

  try {
    // Try to find the venue in cache using cache-only lookup
    const response = await fetch('/api/venues/autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: venueValue,
        cacheOnly: true
      }),
    });

    if (response.ok) {
      const data = await response.json();
      
      // Look for exact match in cached results
      const exactMatch = data.predictions?.find((prediction: any) => 
        prediction.description.toLowerCase().startsWith(venueValue.toLowerCase())
      );

      if (exactMatch) {
        return exactMatch.description;
      }
    }
  } catch (error) {
    console.warn('Failed to resolve venue display format:', error);
  }

  // Return original value if cache lookup fails
  return venueValue;
}
