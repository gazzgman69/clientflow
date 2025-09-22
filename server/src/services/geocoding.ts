import fetch from 'node-fetch';

export interface PlaceDetails {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

export interface GooglePlaceDetailsResponse {
  result: {
    place_id: string;
    name: string;
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  };
  status: string;
}

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

export interface GooglePlacePredictionsResponse {
  predictions: PlacePrediction[];
  status: string;
}

export class GeocodingService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY!;
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
    }
  }

  /**
   * Get place predictions for autocomplete
   */
  async getPlacePredictions(input: string, options: {
    sessionToken?: string;
    types?: string[];
  } = {}): Promise<PlacePrediction[]> {
    const params = new URLSearchParams({
      input,
      key: this.apiKey
    });

    if (options.sessionToken) {
      params.append('sessiontoken', options.sessionToken);
    }

    if (options.types && options.types.length > 0) {
      params.append('types', options.types.join('|'));
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;

    try {
      const response = await fetch(url);
      const data = await response.json() as GooglePlacePredictionsResponse;

      if (data.status !== 'OK') {
        console.error('Google Places Autocomplete API error:', {
          status: data.status,
          error_message: (data as any).error_message,
          input: input,
          url: url.replace(this.apiKey, 'REDACTED_KEY')
        });
        
        if (data.status === 'REQUEST_DENIED') {
          console.error(`
🚨 GOOGLE PLACES API CONFIGURATION ERROR 🚨
The Google Places API is returning REQUEST_DENIED. This usually means:

1. 📋 PLACES API NOT ENABLED: The Places API might not be enabled in your Google Cloud Console
   → Go to https://console.cloud.google.com/apis/library/places-backend.googleapis.com
   → Click "Enable"

2. 🔑 API KEY RESTRICTIONS: Your API key might have domain/IP restrictions
   → Go to https://console.cloud.google.com/apis/credentials  
   → Click on your API key
   → Check "Application restrictions" and "API restrictions"
   → Make sure your current domain is allowed

3. 💳 BILLING NOT SET UP: Google Places API requires a billing account
   → Go to https://console.cloud.google.com/billing
   → Set up billing for your project

4. 🚫 API KEY INVALID: The API key might be invalid or deleted
   → Double-check your GOOGLE_MAPS_API_KEY environment variable

Current key starts with: ${this.apiKey.substring(0, 8)}...
          `);
        }
        return [];
      }

      return data.predictions;
    } catch (error) {
      console.error('Error fetching place predictions:', error);
      console.error('Failed to connect to Google Places API. Check your internet connection and API configuration.');
      return [];
    }
  }

  /**
   * Fetch place details from Google Places API using place ID
   */
  async getPlaceDetails(placeId: string, sessionToken?: string): Promise<PlaceDetails> {
    const fields = [
      'place_id',
      'name', 
      'formatted_address',
      'address_components',
      'geometry/location'
    ].join(',');

    const params = new URLSearchParams({
      place_id: placeId,
      fields,
      key: this.apiKey
    });

    if (sessionToken) {
      params.append('sessiontoken', sessionToken);
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;

    try {
      const response = await fetch(url);
      const data = await response.json() as GooglePlaceDetailsResponse;

      if (data.status !== 'OK') {
        throw new Error(`Google Places API error: ${data.status}`);
      }

      return this.normalizePlace(data.result);
    } catch (error) {
      console.error('Error fetching place details:', error);
      throw new Error('Failed to fetch place details from Google Places API');
    }
  }

  /**
   * Normalize Google Place data into our standard format
   */
  private normalizePlace(place: GooglePlaceDetailsResponse['result']): PlaceDetails {
    const components = place.address_components;
    
    // Extract address components
    const streetNumber = this.getComponent(components, 'street_number')?.long_name || '';
    const route = this.getComponent(components, 'route')?.long_name || '';
    const subpremise = this.getComponent(components, 'subpremise')?.long_name || '';
    
    // Enhanced city extraction with comprehensive fallback strategies
    const locality = this.getComponent(components, 'locality')?.long_name || '';
    const sublocality = this.getComponent(components, 'sublocality')?.long_name || '';
    const sublocalityLevel1 = this.getComponent(components, 'sublocality_level_1')?.long_name || '';
    const postalTown = this.getComponent(components, 'postal_town')?.long_name || '';
    const adminLevel2 = this.getComponent(components, 'administrative_area_level_2')?.long_name || '';
    const adminLevel3 = this.getComponent(components, 'administrative_area_level_3')?.long_name || '';
    
    // Try to extract city from formatted address as final fallback
    let cityFromAddress = '';
    if (!locality && !sublocality && !sublocalityLevel1 && !postalTown && !adminLevel2) {
      // Parse formatted address to extract city (usually before postcode in UK)
      const addressParts = place.formatted_address.split(',').map(part => part.trim());
      // For UK addresses, city is typically the part before the postcode
      const postcodePattern = /[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/i;
      const postcodePartIndex = addressParts.findIndex(part => postcodePattern.test(part));
      if (postcodePartIndex > 0) {
        cityFromAddress = addressParts[postcodePartIndex - 1] || '';
      }
    }
    
    const city = locality || sublocality || sublocalityLevel1 || postalTown || adminLevel2 || adminLevel3 || cityFromAddress || '';
    
    // Enhanced postal code extraction
    const postalCode = this.getComponent(components, 'postal_code')?.long_name || 
                      this.getComponent(components, 'postal_code_prefix')?.long_name || '';
    
    const country = this.getComponent(components, 'country')?.short_name || '';

    // Enhanced state/county extraction based on country
    const adminLevel1 = this.getComponent(components, 'administrative_area_level_1')?.short_name || 
                       this.getComponent(components, 'administrative_area_level_1')?.long_name || '';
    const adminLevel2ForCounty = this.getComponent(components, 'administrative_area_level_2')?.long_name || '';
    
    // For UK addresses, administrative_area_level_2 is the county, not administrative_area_level_1
    // administrative_area_level_1 in UK = "England", "Scotland", "Wales", "Northern Ireland"  
    // administrative_area_level_2 in UK = "Wiltshire", "Hampshire", "Essex", etc. (actual county)
    let state = '';
    if (country === 'GB' || country === 'UK') {
      // For UK, prioritize administrative_area_level_2 (county) over administrative_area_level_1 (country subdivision)
      state = adminLevel2ForCounty || adminLevel1;
    } else {
      // For other countries, use administrative_area_level_1 (state/province) as usual
      state = adminLevel1;
    }

    // Build address lines
    const address1 = [streetNumber, route].filter(Boolean).join(' ');
    const address2 = subpremise || undefined;

    return {
      name: place.name,
      address1,
      address2,
      city,
      state,
      postalCode,
      countryCode: country,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      placeId: place.place_id
    };
  }

  /**
   * Helper to extract specific address component
   */
  private getComponent(components: GooglePlaceDetailsResponse['result']['address_components'], type: string) {
    return components.find(component => component.types.includes(type));
  }

  /**
   * Generate a static map URL for a given location
   */
  generateStaticMapUrl(latitude: number, longitude: number, options: {
    width?: number;
    height?: number;
    zoom?: number;
    markerColor?: string;
    mapType?: 'roadmap' | 'satellite' | 'terrain' | 'hybrid';
  } = {}): string {
    const {
      width = 400,
      height = 300,
      zoom = 15,
      markerColor = 'red',
      mapType = 'roadmap'
    } = options;

    const params = new URLSearchParams({
      center: `${latitude},${longitude}`,
      zoom: zoom.toString(),
      size: `${width}x${height}`,
      maptype: mapType,
      markers: `color:${markerColor}|${latitude},${longitude}`,
      key: this.apiKey
    });

    return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
  }

  /**
   * Generate a Google Maps link for opening in browser/app
   */
  generateMapsLink(latitude: number, longitude: number): string {
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }
}

export const geocodingService = new GeocodingService();