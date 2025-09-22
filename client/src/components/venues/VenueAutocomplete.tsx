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
  cached?: boolean; // Flag to indicate if this is from cache
  venueId?: string; // For cached venues, includes the venue ID
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
  const [hasSelectedVenue, setHasSelectedVenue] = useState(
    initialValue && initialValue.trim().length > 0
  );
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);
  
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
    // Never fetch predictions if a venue is already selected
    if (hasSelectedVenue) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }
    
    if (!input.trim() || input.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/venues/suggest', {
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
      
      // Double-check: Never show predictions if venue already selected  
      if (!hasSelectedVenue && !(initialValue && initialValue.trim().length > 0)) {
        setShowPredictions(true);
      }
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
    isSelectingRef.current = true; // Prevent blur from closing menu
    
    // Keep the original description text throughout the process
    const originalDescription = prediction.description;
    setQuery(originalDescription);
    setShowPredictions(false);
    setPredictions([]);
    setIsLoading(true);

    try {
      let selectedVenue: SelectedVenue;

      // Handle cached venues differently
      if (prediction.cached && prediction.venueId) {
        // For cached venues, fetch the venue directly from our database
        const response = await fetch(`/api/venues/${prediction.venueId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to get cached venue details');
        }

        const venue = await response.json();
        
        // Transform cached venue data for form pre-filling
        selectedVenue = {
          placeId: venue.placeId || prediction.place_id,
          name: venue.name || prediction.structured_formatting.main_text,
          address: venue.address,
          city: venue.city,
          state: venue.state,
          zipCode: venue.zipCode,
          country: venue.country,
          latitude: venue.latitude ? parseFloat(venue.latitude) : undefined,
          longitude: venue.longitude ? parseFloat(venue.longitude) : undefined,
        };

        // Track usage for cached venue (fire and forget)
        fetch(`/api/venues/${prediction.venueId}/track-usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(err => console.warn('Failed to track venue usage:', err));

      } else {
        // For Google Places venues, get place details from Google
        const response = await fetch('/api/venues/place-details', {
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
          throw new Error('Failed to get place details');
        }

        const placeDetails = await response.json();
        
        // Transform place details for form pre-filling
        selectedVenue = {
          placeId: prediction.place_id,
          name: placeDetails.name || prediction.structured_formatting.main_text,
          address: placeDetails.address1, // Use the properly parsed street address
          city: placeDetails.city,
          state: placeDetails.state,
          zipCode: placeDetails.postalCode,
          country: placeDetails.countryCode,
          latitude: placeDetails.latitude,
          longitude: placeDetails.longitude,
        };
      }

      onVenueSelect(selectedVenue);
      
      // Mark venue as selected and hide predictions immediately
      setHasSelectedVenue(true);
      setShowPredictions(false);
      setPredictions([]);
      
      // Focus next field (blur current input)
      if (inputRef.current) {
        inputRef.current.blur();
        // Try to focus next form field
        const form = inputRef.current.closest('form');
        if (form) {
          const formElements = Array.from(form.querySelectorAll('input, select, textarea, button'));
          const currentIndex = formElements.indexOf(inputRef.current);
          const nextElement = formElements[currentIndex + 1] as HTMLElement;
          if (nextElement && nextElement.focus) {
            nextElement.focus();
          }
        }
      }
      
      // Generate new session token for next search
      setSessionToken(generateSessionToken());
      isSelectingRef.current = false;
    } catch (error) {
      console.error('Error getting place details:', error);
      // Final fallback to basic venue data from prediction
      const basicVenue: SelectedVenue = {
        placeId: prediction.place_id,
        name: prediction.structured_formatting.main_text,
        address: prediction.structured_formatting.secondary_text || prediction.structured_formatting.main_text
      };
      onVenueSelect(basicVenue);
      
      // Mark venue as selected and hide predictions immediately
      setHasSelectedVenue(true);
      setShowPredictions(false);
      setPredictions([]);
      
      // Focus next field (blur current input)
      if (inputRef.current) {
        inputRef.current.blur();
        // Try to focus next form field
        const form = inputRef.current.closest('form');
        if (form) {
          const formElements = Array.from(form.querySelectorAll('input, select, textarea, button'));
          const currentIndex = formElements.indexOf(inputRef.current);
          const nextElement = formElements[currentIndex + 1] as HTMLElement;
          if (nextElement && nextElement.focus) {
            nextElement.focus();
          }
        }
      }
      isSelectingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search handler
  useEffect(() => {
    // Don't fetch predictions if a venue has already been selected
    if (hasSelectedVenue) {
      return;
    }
    
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
            const newValue = e.target.value;
            setQuery(newValue);
            
            // Only reset venue selection if user is actually changing the text
            // Don't reset if they're just focusing or the value is the same
            if (newValue !== initialValue) {
              setHasSelectedVenue(false);
            }
          }}
          onFocus={() => {
            // Don't auto-open unless query >= 2 and no venue selected
            if (query.length >= 2 && !hasSelectedVenue) {
              setShowPredictions(true);
            }
          }}
          onBlur={() => {
            // Close menu with timeout unless selection in progress
            setTimeout(() => {
              if (!isSelectingRef.current) {
                setShowPredictions(false);
              }
            }, 0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && showPredictions) {
              e.preventDefault(); // Always prevent form submit while menu open
              if (predictions.length > 0) {
                handleVenueSelect(predictions[0]); // Select first suggestion
              }
            }
          }}
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
        <Card className="absolute top-full z-[100] mt-1 w-full shadow-lg">
          <CardContent className="p-0">
            <div className="max-h-60 overflow-y-auto">
              {predictions.map((prediction) => (
                <Button
                  key={prediction.place_id}
                  variant="ghost"
                  className="w-full justify-start p-3 h-auto text-left hover:bg-muted/50"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleVenueSelect(prediction);
                  }}
                  data-testid={`button-venue-${prediction.place_id}`}
                >
                  <MapPin className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {prediction.structured_formatting?.main_text || prediction.description}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {/* Show the most complete address information available */}
                      {prediction.structured_formatting?.secondary_text || 
                       prediction.description.split(', ').slice(1).join(', ')}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showPredictions && predictions.length === 0 && query.length >= 2 && !isLoading && (
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