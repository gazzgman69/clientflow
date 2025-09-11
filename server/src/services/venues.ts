import { storage } from '../../storage';
import { geocodingService, type PlaceDetails } from './geocoding';
import type { Venue, InsertVenue } from '@shared/schema';

export interface CreateVenueFromGoogleRequest {
  placeId: string;
  sessionToken?: string;
}

export interface CreateMinimalVenueRequest {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export class VenuesService {
  /**
   * Create or update venue from Google Place details
   * If place_id already exists, update only empty fields to preserve manual edits
   */
  async upsertFromPlace(details: PlaceDetails): Promise<Venue> {
    // Check if venue with this place_id already exists
    const existingVenues = await storage.getVenues();
    const existingVenue = existingVenues.find(v => v.placeId === details.placeId);

    if (existingVenue) {
      // Update only empty/null fields to preserve manual edits
      const updates: Partial<InsertVenue> = {};
      
      if (!existingVenue.name) updates.name = details.name;
      if (!existingVenue.address) updates.address = details.address1;
      if (!existingVenue.address2) updates.address2 = details.address2;
      if (!existingVenue.city) updates.city = details.city;
      if (!existingVenue.state) updates.state = details.state;
      if (!existingVenue.zipCode) updates.zipCode = details.postalCode;
      if (!existingVenue.country) updates.country = details.countryCode;
      if (!existingVenue.countryCode) updates.countryCode = details.countryCode;
      if (!existingVenue.latitude) updates.latitude = details.latitude.toString();
      if (!existingVenue.longitude) updates.longitude = details.longitude.toString();

      if (Object.keys(updates).length > 0) {
        try {
          const updatedVenue = await storage.updateVenue(existingVenue.id, updates);
          return updatedVenue!;
        } catch (error) {
          console.warn('Failed to update existing venue, returning existing venue:', error);
          return existingVenue;
        }
      }
      return existingVenue;
    }

    // Create new venue
    const newVenue: InsertVenue = {
      name: details.name,
      address: details.address1,
      address2: details.address2,
      city: details.city,
      state: details.state,
      zipCode: details.postalCode,
      country: details.countryCode,
      countryCode: details.countryCode,
      latitude: details.latitude.toString(),
      longitude: details.longitude.toString(),
      placeId: details.placeId,
    };

    return await storage.createVenue(newVenue);
  }

  /**
   * Create venue from Google Place ID and session token
   */
  async createFromGoogle({ placeId, sessionToken }: CreateVenueFromGoogleRequest): Promise<Venue> {
    try {
      const placeDetails = await geocodingService.getPlaceDetails(placeId, sessionToken);
      return await this.upsertFromPlace(placeDetails);
    } catch (error) {
      console.error('Error creating venue from Google Place:', error);
      throw new Error('Failed to create venue from Google Place');
    }
  }

  /**
   * Create venue with full venue data (general method)
   */
  async createVenue(venueData: InsertVenue): Promise<Venue> {
    return await storage.createVenue(venueData);
  }

  /**
   * Create minimal venue for manual entry (when user doesn't select a Google result)
   */
  async createMinimal(venueData: CreateMinimalVenueRequest): Promise<Venue> {
    const venueInsert: InsertVenue = {
      name: venueData.name,
      address: venueData.address || null,
      city: venueData.city || null,
      state: venueData.state || null,
      zipCode: venueData.zipCode || null,
      country: venueData.country || null,
    };

    return await storage.createVenue(venueInsert);
  }

  /**
   * Find venue by place_id to check cache
   */
  async findByPlaceId(placeId: string): Promise<Venue | null> {
    const venues = await storage.getVenues();
    return venues.find(v => v.placeId === placeId) || null;
  }

  /**
   * Normalize address for cache matching
   */
  private normalizeAddress(address: string): string {
    return address.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special chars
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Find venues by normalized address matching
   */
  async findByAddress(searchInput: string): Promise<Venue[]> {
    const venues = await storage.getVenues();
    const normalizedInput = this.normalizeAddress(searchInput);
    
    return venues.filter(venue => {
      if (!venue.name && !venue.address) return false;
      
      const normalizedName = venue.name ? this.normalizeAddress(venue.name) : '';
      const normalizedAddress = venue.address ? this.normalizeAddress(venue.address) : '';
      const normalizedFull = `${normalizedName} ${normalizedAddress}`.trim();
      
      return normalizedName.includes(normalizedInput) || 
             normalizedAddress.includes(normalizedInput) ||
             normalizedFull.includes(normalizedInput);
    }).sort((a, b) => {
      // Sort by use count descending, then by last used date
      const aUseCount = a.useCount || 0;
      const bUseCount = b.useCount || 0;
      if (aUseCount !== bUseCount) return bUseCount - aUseCount;
      
      const aLastUsed = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bLastUsed = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return bLastUsed - aLastUsed;
    });
  }

  /**
   * Convert venue to prediction format for consistency with Google Places API
   */
  private venueToSuggestion(venue: Venue) {
    const address = [venue.address, venue.city, venue.state, venue.country]
      .filter(Boolean)
      .join(', ');
    
    return {
      description: venue.name + (address ? ` - ${address}` : ''),
      place_id: venue.placeId || `venue:${venue.id}`, // Use internal ID if no place_id
      structured_formatting: {
        main_text: venue.name,
        secondary_text: address || 'Cached venue'
      },
      types: ['establishment'],
      cached: true, // Flag to indicate this is from cache
      venueId: venue.id // Include venue ID for direct cache lookup
    };
  }

  /**
   * Get venue suggestions from cache first, then Google Places API
   */
  async getSuggestions(input: string, options?: {
    sessionToken?: string;
    types?: string[];
  }) {
    const cacheResults: any[] = [];
    const maxCacheResults = 3;
    
    // First, search cache by address/name matching
    if (input.length >= 2) {
      const cachedVenues = await this.findByAddress(input);
      const limitedCached = cachedVenues.slice(0, maxCacheResults);
      
      for (const venue of limitedCached) {
        cacheResults.push(this.venueToSuggestion(venue));
      }
    }
    
    // If we have some cache results, limit Google results
    // Otherwise, get full results from Google
    const googleResultsLimit = cacheResults.length > 0 ? 5 - cacheResults.length : 8;
    
    let googleResults: any[] = [];
    try {
      if (googleResultsLimit > 0) {
        const googleResponse = await geocodingService.getPlacePredictions(input, options);
        googleResults = googleResponse.slice(0, googleResultsLimit).map(prediction => ({
          ...prediction,
          cached: false // Flag to indicate this is from Google
        }));
      }
    } catch (error) {
      console.warn('Google Places API error, using cache only:', error);
    }
    
    // Combine cache and Google results, with cache results first
    return [...cacheResults, ...googleResults];
  }

  /**
   * Update venue usage tracking (increment use count and update last used)
   */
  async trackVenueUsage(venueId: string): Promise<void> {
    try {
      const venue = await storage.getVenue(venueId);
      if (venue) {
        const updates = {
          useCount: (venue.useCount || 0) + 1,
          lastUsedAt: new Date()
        };
        await storage.updateVenue(venueId, updates);
      }
    } catch (error) {
      console.warn('Failed to track venue usage:', error);
      // Don't throw error - usage tracking is not critical
    }
  }

  /**
   * Generate static map URL for venue
   */
  async getStaticMapUrl(venueId: string, options?: {
    width?: number;
    height?: number;
    zoom?: number;
  }): Promise<string | null> {
    const venue = await storage.getVenue(venueId);
    
    if (!venue || !venue.latitude || !venue.longitude) {
      return null;
    }

    const lat = parseFloat(venue.latitude);
    const lng = parseFloat(venue.longitude);

    return geocodingService.generateStaticMapUrl(lat, lng, options);
  }

  /**
   * Generate Google Maps link for venue
   */
  async getMapsLink(venueId: string): Promise<string | null> {
    const venue = await storage.getVenue(venueId);
    
    if (!venue || !venue.latitude || !venue.longitude) {
      return null;
    }

    const lat = parseFloat(venue.latitude);
    const lng = parseFloat(venue.longitude);

    return geocodingService.generateMapsLink(lat, lng);
  }

  /**
   * Update venue with manual edits
   */
  async updateVenue(venueId: string, updates: Partial<InsertVenue>): Promise<Venue | null> {
    const result = await storage.updateVenue(venueId, updates);
    return result || null;
  }

  /**
   * Get all venues
   */
  async getVenues(): Promise<Venue[]> {
    return await storage.getVenues();
  }

  /**
   * Get venue by ID
   */
  async getVenue(venueId: string): Promise<Venue | null> {
    const result = await storage.getVenue(venueId);
    return result || null;
  }

  /**
   * Delete venue
   */
  async deleteVenue(venueId: string): Promise<boolean> {
    return await storage.deleteVenue(venueId);
  }
}

export const venuesService = new VenuesService();