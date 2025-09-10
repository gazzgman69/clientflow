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
        console.error('Google Places Autocomplete API error:', data.status);
        return [];
      }

      return data.predictions;
    } catch (error) {
      console.error('Error fetching place predictions:', error);
      throw new Error('Failed to fetch place predictions from Google Places API');
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
    const locality = this.getComponent(components, 'locality')?.long_name || '';
    const adminLevel1 = this.getComponent(components, 'administrative_area_level_1')?.short_name || '';
    const postalCode = this.getComponent(components, 'postal_code')?.long_name || '';
    const country = this.getComponent(components, 'country')?.short_name || '';

    // Build address lines
    const address1 = [streetNumber, route].filter(Boolean).join(' ');
    const address2 = subpremise || undefined;

    return {
      name: place.name,
      address1,
      address2,
      city: locality,
      state: adminLevel1,
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