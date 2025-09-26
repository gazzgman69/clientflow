import { storage } from '../../storage';
import { geocodingService, type PlaceDetails } from './geocoding';
import type { Venue, InsertVenue } from '@shared/schema';
import { withTenantData } from '../../utils/tenantQueries';
import { validateAndCleanVenueAddress, hasAddressDuplication } from '@shared/addressUtils';
import { neon } from '@neondatabase/serverless';

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
  async upsertFromPlace(details: PlaceDetails, tenantId: string): Promise<Venue> {
    // Check if venue with this place_id already exists
    const existingVenues = await this.getVenues(tenantId);
    const existingVenue = existingVenues.find(v => v.placeId === details.placeId);

    if (existingVenue) {
      // Update only empty/null fields to preserve manual edits
      const updates: Partial<InsertVenue> = {};
      
      if (!existingVenue.name) updates.name = details.name;
      
      // Always apply address cleaning to detect and fix any existing duplication
      const currentAddressData = {
        venueName: existingVenue.name || details.name,
        address: existingVenue.address || details.address1,
        city: existingVenue.city || details.city,
        state: existingVenue.state || details.state,
        zipCode: existingVenue.zipCode || details.postalCode,
        country: existingVenue.country || details.countryCode
      };
      
      const cleanedAddress = validateAndCleanVenueAddress(currentAddressData);
      
      // Update empty fields with new data
      if (!existingVenue.address && details.address1) updates.address = cleanedAddress.address;
      if (!existingVenue.city && details.city) updates.city = cleanedAddress.city;
      if (!existingVenue.state && details.state) updates.state = cleanedAddress.state;
      if (!existingVenue.zipCode && details.postalCode) updates.zipCode = cleanedAddress.zipCode;
      if (!existingVenue.country && details.countryCode) updates.country = cleanedAddress.country;
      
      // Fix existing duplicated address data if cleaning changed it
      if (existingVenue.address && cleanedAddress.address !== existingVenue.address) {
        updates.address = cleanedAddress.address;
      }
      if (existingVenue.city && cleanedAddress.city !== existingVenue.city) {
        updates.city = cleanedAddress.city;
      }
      if (existingVenue.state && cleanedAddress.state !== existingVenue.state) {
        updates.state = cleanedAddress.state;
      }
      if (existingVenue.zipCode && cleanedAddress.zipCode !== existingVenue.zipCode) {
        updates.zipCode = cleanedAddress.zipCode;
      }
      if (existingVenue.country && cleanedAddress.country !== existingVenue.country) {
        updates.country = cleanedAddress.country;
      }
      
      if (!existingVenue.address2) updates.address2 = details.address2;
      if (!existingVenue.countryCode) updates.countryCode = details.countryCode;
      if (!existingVenue.latitude) updates.latitude = details.latitude.toString();
      if (!existingVenue.longitude) updates.longitude = details.longitude.toString();
      
      // Add enrichment fields - only update if empty to preserve manual edits
      if (!existingVenue.contactPhone && details.phone) updates.contactPhone = details.phone;
      if (!existingVenue.website && details.website) updates.website = details.website;
      
      // Store enriched data in meta field as JSON
      if (details.rating || details.userRatingsTotal || details.priceLevel || details.businessStatus || details.openingHours) {
        const enrichmentData = {
          rating: details.rating,
          userRatingsTotal: details.userRatingsTotal,
          priceLevel: details.priceLevel,
          businessStatus: details.businessStatus,
          openingHours: details.openingHours,
          lastEnriched: new Date().toISOString()
        };
        updates.meta = JSON.stringify(enrichmentData);
      }

      if (Object.keys(updates).length > 0) {
        try {
          const updatedVenue = await storage.updateVenue(existingVenue.id, updates, tenantId);
          return updatedVenue!;
        } catch (error) {
          console.warn('Failed to update existing venue, returning existing venue:', error);
          return existingVenue;
        }
      }
      return existingVenue;
    }

    // Create new venue with enrichment data
    const enrichmentData = {
      rating: details.rating,
      userRatingsTotal: details.userRatingsTotal,
      priceLevel: details.priceLevel,
      businessStatus: details.businessStatus,
      openingHours: details.openingHours,
      lastEnriched: new Date().toISOString()
    };

    // Clean and validate address data before storing
    const cleanedAddress = validateAndCleanVenueAddress({
      venueName: details.name,
      address: details.address1,
      city: details.city,
      state: details.state,
      zipCode: details.postalCode,
      country: details.countryCode
    });

    const newVenueData = {
      name: details.name,
      address: cleanedAddress.address,
      address2: details.address2,
      city: details.city,
      state: details.state,
      zipCode: details.postalCode,
      country: details.countryCode,
      countryCode: details.countryCode,
      latitude: details.latitude.toString(),
      longitude: details.longitude.toString(),
      placeId: details.placeId,
      // Add enrichment fields
      contactPhone: details.phone || null,
      website: details.website || null,
      meta: JSON.stringify(enrichmentData),
    };

    const newVenue: InsertVenue = withTenantData(newVenueData, tenantId);
    return await this.findOrCreateVenue(newVenue, tenantId);
  }

  /**
   * Create venue from Google Place ID and session token
   */
  async createFromGoogle({ placeId, sessionToken }: CreateVenueFromGoogleRequest, tenantId: string): Promise<Venue> {
    try {
      const placeDetails = await geocodingService.getPlaceDetails(placeId, sessionToken);
      return await this.upsertFromPlace(placeDetails, tenantId);
    } catch (error) {
      console.error('Error creating venue from Google Place:', error);
      throw new Error('Failed to create venue from Google Place');
    }
  }

  /**
   * Find existing venue or create new one to prevent duplicates
   * Uses exact normalized name + address matching for strict deduplication
   */
  async findOrCreateVenue(venueData: InsertVenue, tenantId: string): Promise<Venue> {
    // For Google Places venues, check by place_id first
    if (venueData.placeId) {
      const existingVenue = await this.findByPlaceId(venueData.placeId, tenantId);
      if (existingVenue) {
        console.log('🔍 VENUE REUSED (Place ID):', { venueId: existingVenue.id, placeId: venueData.placeId });
        // Update usage tracking
        await storage.updateVenue(existingVenue.id, {
          useCount: (existingVenue.useCount || 0) + 1,
          lastUsedAt: new Date()
        }, tenantId);
        return existingVenue;
      }
    }

    // For all venues, check by exact normalized name + address match
    if (venueData.name && venueData.address) {
      const exactMatch = await this.findExactVenueMatch(venueData.name, venueData.address, tenantId);
      if (exactMatch) {
        console.log('🔍 VENUE REUSED (Exact Match):', {
          venueId: exactMatch.id,
          name: exactMatch.name,
          address: exactMatch.address,
          inputName: venueData.name,
          inputAddress: venueData.address
        });
        // Update usage tracking
        await storage.updateVenue(exactMatch.id, {
          useCount: (exactMatch.useCount || 0) + 1,
          lastUsedAt: new Date()
        }, tenantId);
        return exactMatch;
      }
    }

    // No duplicate found, create new venue
    console.log('✅ VENUE CREATED (New):', { name: venueData.name, address: venueData.address });
    return await storage.createVenue(venueData, tenantId);
  }

  /**
   * Create venue with full venue data (general method)
   * Now includes duplicate prevention
   */
  async createVenue(venueData: InsertVenue, tenantId: string): Promise<Venue> {
    return await this.findOrCreateVenue(venueData, tenantId);
  }

  /**
   * Create minimal venue for manual entry (when user doesn't select a Google result)
   * Attempts automatic enrichment if possible
   */
  async createMinimal(venueData: CreateMinimalVenueRequest, tenantId: string): Promise<Venue> {
    // Clean and validate address data before storing
    const cleanedAddress = validateAndCleanVenueAddress({
      venueName: venueData.name,
      address: venueData.address,
      city: venueData.city,
      state: venueData.state,
      zipCode: venueData.zipCode,
      country: venueData.country
    });

    const venueData_base = {
      name: venueData.name,
      address: cleanedAddress.address || null,
      city: venueData.city || null,
      state: venueData.state || null,
      zipCode: venueData.zipCode || null,
      country: venueData.country || null,
    };

    const venueInsert: InsertVenue = withTenantData(venueData_base, tenantId);
    const createdVenue = await this.findOrCreateVenue(venueInsert, tenantId);
    
    // Attempt automatic enrichment after creation
    try {
      const enrichedVenue = await this.tryAutoEnrichVenue(createdVenue.id, tenantId);
      return enrichedVenue || createdVenue;
    } catch (error) {
      console.warn('Failed to auto-enrich venue:', error);
      return createdVenue;
    }
  }

  /**
   * Attempt to automatically enrich a venue by searching Google Places
   */
  async tryAutoEnrichVenue(venueId: string, tenantId: string): Promise<Venue | null> {
    const venue = await storage.getVenue(venueId, tenantId);
    if (!venue || venue.placeId) {
      return null; // Already has Google Places data or doesn't exist
    }

    // Don't try to enrich if we already have enrichment data
    if (venue.meta) {
      try {
        const metaData = JSON.parse(venue.meta);
        if (metaData.lastEnriched) {
          console.log(`🔍 Venue ${venue.name} already enriched, skipping`);
          return venue;
        }
      } catch (e) {
        // Invalid JSON in meta, continue with enrichment
      }
    }

    // Build search query from venue data
    const searchTerms = [venue.name, venue.address, venue.city, venue.state, venue.country]
      .filter(Boolean)
      .join(', ');
    
    if (!searchTerms || searchTerms.length < 5) {
      console.log(`🔍 Insufficient data to enrich venue: ${venue.name}`);
      return venue;
    }

    try {
      console.log(`🔍 Auto-enriching venue: ${venue.name} with query: "${searchTerms}"`);
      
      // Search for the venue on Google Places
      const predictions = await geocodingService.getPlacePredictions(searchTerms, {
        types: ['establishment', 'premise']
      });

      if (!predictions || predictions.length === 0) {
        console.log(`🔍 No Google Places results found for: ${venue.name}`);
        return venue;
      }

      // Try the first result that seems to match
      const bestMatch = predictions[0];
      const placeDetails = await geocodingService.getPlaceDetails(bestMatch.place_id);

      // Verify it's actually the same venue by checking name similarity
      const nameSimilarity = this.calculateNameSimilarity(venue.name, placeDetails.name);
      if (nameSimilarity < 0.6) {
        console.log(`🔍 Name similarity too low (${nameSimilarity}) for ${venue.name} vs ${placeDetails.name}`);
        return venue;
      }

      // Update venue with enriched data, preserving manual edits
      const updates: Partial<InsertVenue> = {};
      
      // Only update fields that are empty
      if (!venue.contactPhone && placeDetails.phone) updates.contactPhone = placeDetails.phone;
      if (!venue.website && placeDetails.website) updates.website = placeDetails.website;
      if (!venue.placeId) updates.placeId = placeDetails.placeId;
      
      // Store enrichment data in meta
      const enrichmentData = {
        rating: placeDetails.rating,
        userRatingsTotal: placeDetails.userRatingsTotal,
        priceLevel: placeDetails.priceLevel,
        businessStatus: placeDetails.businessStatus,
        openingHours: placeDetails.openingHours,
        lastEnriched: new Date().toISOString(),
        autoEnriched: true,
        confidence: nameSimilarity
      };
      updates.meta = JSON.stringify(enrichmentData);

      if (Object.keys(updates).length > 0) {
        const updatedVenue = await storage.updateVenue(venueId, updates, tenantId);
        console.log(`✅ Successfully enriched venue: ${venue.name} with phone: ${placeDetails.phone}, website: ${placeDetails.website}`);
        return updatedVenue || venue;
      }

      return venue;
    } catch (error) {
      console.warn(`❌ Failed to auto-enrich venue ${venue.name}:`, error);
      return venue;
    }
  }

  /**
   * Calculate name similarity between two venue names
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    const normalize = (str: string) => str.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;
    
    // Simple word overlap calculation
    const words1 = n1.split(' ');
    const words2 = n2.split(' ');
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Find venue by place_id to check cache
   */
  async findByPlaceId(placeId: string, tenantId: string): Promise<Venue | null> {
    const venues = await this.getVenues(tenantId);
    return venues.find(v => v.placeId === placeId) || null;
  }

  /**
   * Normalize text for venue matching (name + address)
   */
  private normalizeForMatching(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation, special chars
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Find venues by normalized name + address matching for deduplication
   */
  async findByAddress(searchInput: string, tenantId: string): Promise<Venue[]> {
    const venues = await this.getVenues(tenantId);
    const normalizedSearch = this.normalizeForMatching(searchInput);
    
    return venues.filter(venue => {
      if (!venue.name && !venue.address) return false;
      
      const normalizedName = venue.name ? this.normalizeForMatching(venue.name) : '';
      const normalizedAddress = venue.address ? this.normalizeForMatching(venue.address) : '';
      const normalizedFull = `${normalizedName} ${normalizedAddress}`.trim();
      
      // Check for exact matches on normalized text
      return normalizedName === normalizedSearch || 
             normalizedAddress === normalizedSearch ||
             normalizedFull === normalizedSearch ||
             normalizedFull.includes(normalizedSearch);
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
   * Find exact venue match by normalized name + address for strict deduplication
   */
  async findExactVenueMatch(name: string, address: string, tenantId: string): Promise<Venue | null> {
    const venues = await this.getVenues(tenantId);
    const normalizedInputName = this.normalizeForMatching(name || '');
    const normalizedInputAddress = this.normalizeForMatching(address || '');
    
    for (const venue of venues) {
      const normalizedVenueName = this.normalizeForMatching(venue.name || '');
      const normalizedVenueAddress = this.normalizeForMatching(venue.address || '');
      
      // Exact match on both name and address (normalized)
      if (normalizedVenueName === normalizedInputName && normalizedVenueAddress === normalizedInputAddress) {
        return venue;
      }
    }
    
    return null;
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
    publicOnly?: boolean; // Skip database search for public forms
  }) {
    const cacheResults: any[] = [];
    const maxCacheResults = 5;
    
    // First, search cache by address/name matching (skip for public requests)
    if (input.length >= 2 && !options?.publicOnly) {
      try {
        const cachedVenues = await this.findByAddress(input);
        const limitedCached = cachedVenues.slice(0, maxCacheResults);
        
        for (const venue of limitedCached) {
          cacheResults.push(this.venueToSuggestion(venue));
        }
      } catch (error) {
        console.warn('⚠️ Cache search failed (likely no tenant context), skipping cache:', error);
        // Continue with Google Places API only
      }
    } else if (options?.publicOnly) {
      console.log('🌍 PUBLIC MODE: Skipping venue cache search, using Google Places API only');
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
  async trackVenueUsage(venueId: string, tenantId: string): Promise<void> {
    try {
      const venue = await storage.getVenue(venueId, tenantId);
      if (venue) {
        const updates = {
          useCount: (venue.useCount || 0) + 1,
          lastUsedAt: new Date()
        };
        await storage.updateVenue(venueId, updates, tenantId);
      }
    } catch (error) {
      console.warn('Failed to track venue usage:', error);
      // Don't throw error - usage tracking is not critical
    }
  }

  /**
   * Generate static map URL for venue
   */
  async getStaticMapUrl(venueId: string, tenantId: string, options?: {
    width?: number;
    height?: number;
    zoom?: number;
  }): Promise<string | null> {
    const venue = await storage.getVenue(venueId, tenantId);
    
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
  async getMapsLink(venueId: string, tenantId: string): Promise<string | null> {
    const venue = await storage.getVenue(venueId, tenantId);
    
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
  async updateVenue(venueId: string, updates: Partial<InsertVenue>, tenantId: string): Promise<Venue | null> {
    const result = await storage.updateVenue(venueId, updates, tenantId);
    return result || null;
  }

  /**
   * Get all venues
   */
  async getVenues(tenantId: string, limit?: number, offset?: number): Promise<Venue[]> {
    // WORKAROUND: Use direct Neon client to bypass Drizzle orderSelectedFields recursion issue
    const neonClient = neon(process.env.DATABASE_URL!);
    
    const query = `
      SELECT * FROM venues 
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      ${limit !== undefined ? `LIMIT ${limit}` : ''}
      ${offset !== undefined ? `OFFSET ${offset}` : ''}
    `;
    const result = await neonClient(query, [tenantId]);
    return result as Venue[];
  }

  async getVenuesCount(tenantId: string): Promise<number> {
    // WORKAROUND: Use direct Neon client to bypass Drizzle orderSelectedFields recursion issue
    const neonClient = neon(process.env.DATABASE_URL!);
    
    const result = await neonClient('SELECT COUNT(*) as count FROM venues WHERE tenant_id = $1', [tenantId]);
    return parseInt((result[0] as any).count);
  }

  /**
   * Get venue by ID
   */
  async getVenue(venueId: string, tenantId: string): Promise<Venue | null> {
    const result = await storage.getVenue(venueId, tenantId);
    return result || null;
  }

  /**
   * Delete venue
   */
  async deleteVenue(venueId: string, tenantId: string): Promise<boolean> {
    return await storage.deleteVenue(venueId, tenantId);
  }
}

export const venuesService = new VenuesService();