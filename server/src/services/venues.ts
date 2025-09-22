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
   * Enhanced caching reduces unnecessary API calls
   */
  async getSuggestions(input: string, options?: {
    sessionToken?: string;
    types?: string[];
    cacheOnly?: boolean;
  }) {
    const cacheResults: any[] = [];
    const maxCacheResults = 5;
    
    // First, search cache by address/name matching
    if (input.length >= 2) {
      const cachedVenues = await this.findByAddress(input);
      const limitedCached = cachedVenues.slice(0, maxCacheResults);
      
      for (const venue of limitedCached) {
        cacheResults.push(this.venueToSuggestion(venue));
      }
    }
    
    // Enhanced caching logic:
    // Skip Google API if we have good cache results or if cacheOnly flag is set
    let shouldQueryGoogle = true;
    let googleResultsLimit = 8;
    
    // If cacheOnly flag is set, skip Google API entirely
    if (options?.cacheOnly) {
      shouldQueryGoogle = false;
      console.log('🏠 CACHE ONLY: Skipping Google API call due to cacheOnly flag');
    } else if (cacheResults.length > 0) {
      // Calculate cache result quality score
      const qualityScore = this.calculateCacheQualityScore(input, cacheResults);
      
      console.log(`🎯 Cache results for "${input}": ${cacheResults.length} found, quality score: ${qualityScore}`);
      
      if (cacheResults.length >= 3 && qualityScore >= 0.7) {
        // High quality cache results - skip Google API entirely
        shouldQueryGoogle = false;
        console.log('🚀 CACHE HIT: Skipping Google API call due to high-quality cache results');
      } else if (cacheResults.length >= 2 && qualityScore >= 0.5) {
        // Good cache results - limit Google API calls  
        googleResultsLimit = Math.max(1, 4 - cacheResults.length);
        console.log(`🏃 CACHE PARTIAL: Limiting Google API to ${googleResultsLimit} results`);
      } else {
        // Some cache results but not great - get more from Google
        googleResultsLimit = Math.max(3, 6 - cacheResults.length);
      }
    }
    
    let googleResults: any[] = [];
    if (shouldQueryGoogle && googleResultsLimit > 0) {
      try {
        console.log(`📡 Querying Google Places API for "${input}" (limit: ${googleResultsLimit})`);
        const googleResponse = await geocodingService.getPlacePredictions(input, options);
        googleResults = googleResponse.slice(0, googleResultsLimit).map(prediction => ({
          ...prediction,
          cached: false // Flag to indicate this is from Google
        }));
        console.log(`📥 Google API returned ${googleResults.length} results`);
      } catch (error) {
        console.warn('⚠️ Google Places API error, using cache only:', error);
      }
    }
    
    const finalResults = [...cacheResults, ...googleResults];
    console.log(`📊 Final results for "${input}": ${finalResults.length} total (${cacheResults.length} cached, ${googleResults.length} from Google)`);
    
    // Cache this search query for future optimization
    this.recordSearchQuery(input, finalResults.length);
    
    return finalResults;
  }

  /**
   * Calculate cache quality score based on how well cached results match the search input
   */
  private calculateCacheQualityScore(input: string, cacheResults: any[]): number {
    if (cacheResults.length === 0) return 0;
    
    const normalizedInput = this.normalizeAddress(input.toLowerCase());
    let totalScore = 0;
    
    for (const result of cacheResults) {
      const normalizedDescription = this.normalizeAddress(result.description.toLowerCase());
      const normalizedMainText = this.normalizeAddress(result.structured_formatting.main_text.toLowerCase());
      
      // Check for exact matches
      if (normalizedMainText === normalizedInput || normalizedDescription.startsWith(normalizedInput)) {
        totalScore += 1.0; // Perfect match
      } else if (normalizedMainText.includes(normalizedInput)) {
        totalScore += 0.8; // Good match
      } else if (normalizedDescription.includes(normalizedInput)) {
        totalScore += 0.6; // Decent match
      } else {
        totalScore += 0.2; // Weak match
      }
    }
    
    return Math.min(1.0, totalScore / cacheResults.length);
  }

  /**
   * Record search queries for future caching optimization
   * In a production app, this could be stored in a separate table/cache
   */
  private recordSearchQuery(input: string, resultCount: number): void {
    // For now, just log it - in production, you might store this data
    // for analytics and further cache optimization
    console.log(`📝 Search recorded: "${input}" → ${resultCount} results`);
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