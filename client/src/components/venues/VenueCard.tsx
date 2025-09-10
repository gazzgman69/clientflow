import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, ExternalLink, Loader2, Map, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VenueCardProps {
  venue: {
    id: string;
    name: string;
    address?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    countryCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    placeId?: string | null;
    formattedAddress?: string | null;
    placeTypes?: string[] | null;
  };
  showMap?: boolean;
  mapWidth?: number;
  mapHeight?: number;
  mapZoom?: number;
  className?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function VenueCard({
  venue,
  showMap = true,
  mapWidth = 400,
  mapHeight = 200,
  mapZoom = 15,
  className,
  onEdit,
  onDelete
}: VenueCardProps) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapsLink, setMapsLink] = useState<string | null>(null);

  // Format the full address
  const getFormattedAddress = () => {
    if (venue.formattedAddress) {
      return venue.formattedAddress;
    }

    const parts = [
      venue.address,
      venue.address2,
      venue.city,
      venue.state,
      venue.zipCode,
      venue.country
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  };

  // Load static map
  const loadMap = async () => {
    if (!venue.latitude || !venue.longitude || mapUrl || mapLoading) return;

    setMapLoading(true);
    setMapError(false);

    try {
      const response = await fetch(
        `/api/venues/${venue.id}/map?width=${mapWidth}&height=${mapHeight}&zoom=${mapZoom}`
      );

      if (!response.ok) {
        throw new Error('Failed to load map');
      }

      const data = await response.json();
      setMapUrl(data.mapUrl);
    } catch (error) {
      console.error('Error loading venue map:', error);
      setMapError(true);
    } finally {
      setMapLoading(false);
    }
  };

  // Get Google Maps link
  const getMapsLink = async () => {
    if (!venue.latitude || !venue.longitude || mapsLink) return;

    try {
      const response = await fetch(`/api/venues/${venue.id}/maps-link`);

      if (!response.ok) {
        throw new Error('Failed to get maps link');
      }

      const data = await response.json();
      setMapsLink(data.mapsLink);
      window.open(data.mapsLink, '_blank');
    } catch (error) {
      console.error('Error getting maps link:', error);
      // Fallback: construct basic Google Maps URL
      if (venue.latitude && venue.longitude) {
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`;
        window.open(fallbackUrl, '_blank');
      }
    }
  };

  // Get place type badges
  const getPlaceTypeBadges = () => {
    if (!venue.placeTypes || venue.placeTypes.length === 0) return null;

    // Filter and format common place types
    const relevantTypes = venue.placeTypes
      .filter(type => !['establishment', 'point_of_interest'].includes(type))
      .slice(0, 3)
      .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));

    return relevantTypes.map(type => (
      <Badge key={type} variant="secondary" className="text-xs">
        {type}
      </Badge>
    ));
  };

  const hasCoordinates = venue.latitude && venue.longitude;

  return (
    <Card className={cn("w-full", className)} data-testid={`card-venue-${venue.id}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header with name and badges */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-lg leading-tight" data-testid={`text-venue-name-${venue.id}`}>
              {venue.name}
            </h3>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                data-testid={`button-edit-venue-${venue.id}`}
              >
                Edit
              </Button>
            )}
          </div>
          
          {/* Place type badges */}
          <div className="flex flex-wrap gap-1">
            {getPlaceTypeBadges()}
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="leading-relaxed" data-testid={`text-venue-address-${venue.id}`}>
            {getFormattedAddress()}
          </span>
        </div>

        {/* Map section */}
        {showMap && hasCoordinates && (
          <div className="space-y-2">
            {!mapUrl && !mapLoading && !mapError && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadMap}
                className="w-full"
                data-testid={`button-load-map-${venue.id}`}
              >
                <Map className="h-4 w-4 mr-2" />
                Show Map
              </Button>
            )}

            {mapLoading && (
              <div className="flex items-center justify-center py-8 bg-muted rounded-md">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading map...</span>
              </div>
            )}

            {mapError && (
              <div className="flex items-center justify-center py-8 bg-muted rounded-md">
                <span className="text-sm text-muted-foreground">
                  Unable to load map
                </span>
              </div>
            )}

            {mapUrl && (
              <div className="relative rounded-md overflow-hidden">
                <img
                  src={mapUrl}
                  alt={`Map of ${venue.name}`}
                  className="w-full h-auto"
                  style={{ maxHeight: mapHeight }}
                  data-testid={`img-venue-map-${venue.id}`}
                />
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {hasCoordinates && (
            <Button
              variant="outline"
              size="sm"
              onClick={getMapsLink}
              className="flex-1"
              data-testid={`button-open-maps-${venue.id}`}
            >
              <Navigation className="h-4 w-4 mr-2" />
              Open in Maps
            </Button>
          )}
          
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
              data-testid={`button-delete-venue-${venue.id}`}
            >
              Delete
            </Button>
          )}
        </div>

        {/* Coordinates (for debugging/reference) */}
        {hasCoordinates && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <span data-testid={`text-venue-coordinates-${venue.id}`}>
              {venue.latitude?.toFixed(6)}, {venue.longitude?.toFixed(6)}
            </span>
            {venue.placeId && (
              <span className="ml-2" data-testid={`text-venue-place-id-${venue.id}`}>
                • Place ID: {venue.placeId.substring(0, 20)}...
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}