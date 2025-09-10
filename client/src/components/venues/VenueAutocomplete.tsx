import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

interface SelectedVenue {
  placeId: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface VenueAutocompleteProps {
  onVenueSelect: (venue: SelectedVenue) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  initialValue?: string;
}

export function VenueAutocomplete({ 
  onVenueSelect, 
  placeholder = "Search for venues...",
  className,
  disabled = false,
  initialValue = ""
}: VenueAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [hasSelectedVenue, setHasSelectedVenue] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Generate a new session token for Places API billing optimization
  const generateSessionToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  useEffect(() => {
    setSessionToken(generateSessionToken());
  }, []);

  // Update venue selection state when initialValue changes
  useEffect(() => {
    if (initialValue && initialValue.trim().length > 0) {
      setHasSelectedVenue(true);
      setQuery(initialValue); // Update the query to show the current value
    } else {
      setHasSelectedVenue(false);
    }
  }, [initialValue]);

  // Close predictions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPredictions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch place predictions from Google Places API
  const fetchPredictions = async (input: string) => {
    if (!input.trim() || input.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/venues/autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: input.trim(),
          sessionToken,
          types: ['establishment', 'geocode'] // Focus on venues and addresses
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch predictions');
      }

      const data = await response.json();
      setPredictions(data.predictions || []);
      setShowPredictions(true);
    } catch (error) {
      console.error('Error fetching place predictions:', error);
      setPredictions([]);
      setShowPredictions(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle venue selection
  const handleVenueSelect = async (prediction: PlacePrediction) => {
    setQuery(prediction.description);
    setShowPredictions(false);
    setIsLoading(true);

    try {
      // Create venue from Google Place using the same session token
      const response = await fetch('/api/venues/from-google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placeId: prediction.place_id,
          sessionToken
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create venue from Google Place');
      }

      const venue = await response.json();
      
      // Transform venue data for callback
      const selectedVenue: SelectedVenue = {
        placeId: venue.placeId,
        name: venue.name,
        address: venue.formattedAddress || venue.address || prediction.description,
        city: venue.city,
        state: venue.state,
        zipCode: venue.zipCode,
        country: venue.country,
        latitude: venue.latitude,
        longitude: venue.longitude,
      };

      onVenueSelect(selectedVenue);
      
      // Mark venue as selected and hide predictions
      setHasSelectedVenue(true);
      setShowPredictions(false);
      setPredictions([]);
      
      // Generate new session token for next search
      setSessionToken(generateSessionToken());
    } catch (error) {
      console.error('Error selecting venue:', error);
      // Fallback: Try to get venue details directly from Google if venue creation failed
      try {
        const directResponse = await fetch('/api/venues/place-details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            placeId: prediction.place_id,
            sessionToken
          }),
        });
        
        if (directResponse.ok) {
          const placeDetails = await directResponse.json();
          const detailedVenue: SelectedVenue = {
            placeId: prediction.place_id,
            name: placeDetails.name || prediction.structured_formatting.main_text,
            address: placeDetails.address1 || prediction.description,
            city: placeDetails.city,
            state: placeDetails.state,
            zipCode: placeDetails.postalCode,
            country: placeDetails.countryCode,
            latitude: placeDetails.latitude,
            longitude: placeDetails.longitude,
          };
          onVenueSelect(detailedVenue);
          
          // Mark venue as selected and hide predictions
          setHasSelectedVenue(true);
          setShowPredictions(false);
          setPredictions([]);
        } else {
          throw new Error('Failed to get place details');
        }
      } catch (fallbackError) {
        console.error('Fallback venue selection also failed:', fallbackError);
        // Final fallback to basic venue data
        const basicVenue: SelectedVenue = {
          placeId: prediction.place_id,
          name: prediction.structured_formatting.main_text,
          address: prediction.description
        };
        onVenueSelect(basicVenue);
        
        // Mark venue as selected and hide predictions
        setHasSelectedVenue(true);
        setShowPredictions(false);
        setPredictions([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search handler
  useEffect(() => {
    // Don't fetch predictions if a venue has already been selected
    if (hasSelectedVenue) return;
    
    const timeoutId = setTimeout(() => {
      fetchPredictions(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, sessionToken, hasSelectedVenue]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHasSelectedVenue(false);
          }}
          onFocus={() => !hasSelectedVenue && query.length >= 3 && setShowPredictions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10"
          data-testid="input-venue-search"
        />
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showPredictions && predictions.length > 0 && (
        <Card className="absolute top-full z-50 mt-1 w-full shadow-lg">
          <CardContent className="p-0">
            <div className="max-h-60 overflow-y-auto">
              {predictions.map((prediction) => (
                <Button
                  key={prediction.place_id}
                  variant="ghost"
                  className="w-full justify-start p-3 h-auto text-left hover:bg-muted/50"
                  onClick={() => handleVenueSelect(prediction)}
                  data-testid={`button-venue-${prediction.place_id}`}
                >
                  <MapPin className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {prediction.structured_formatting.main_text}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showPredictions && predictions.length === 0 && query.length >= 3 && !isLoading && (
        <Card className="absolute top-full z-50 mt-1 w-full shadow-lg">
          <CardContent className="p-3">
            <div className="text-sm text-muted-foreground text-center">
              No venues found for "{query}"
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}