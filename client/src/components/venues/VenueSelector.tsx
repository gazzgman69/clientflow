import { useState } from 'react';
import { VenueAutocomplete } from './VenueAutocomplete';
import { VenueCard } from './VenueCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectedVenue {
  placeId?: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface VenueSelectorProps {
  onVenueSelect: (venue: SelectedVenue | null) => void;
  selectedVenue?: SelectedVenue | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowManual?: boolean;
  showMap?: boolean;
}

export function VenueSelector({
  onVenueSelect,
  selectedVenue = null,
  placeholder = "Search for venues...",
  className,
  disabled = false,
  allowManual = true,
  showMap = true
}: VenueSelectorProps) {
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualVenue, setManualVenue] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  });

  // Handle venue selection from autocomplete
  const handleVenueSelect = (venue: SelectedVenue) => {
    onVenueSelect(venue);
    setShowManualEntry(false);
  };

  // Handle manual venue creation
  const handleManualSubmit = () => {
    if (!manualVenue.name.trim()) return;

    const venue: SelectedVenue = {
      name: manualVenue.name.trim(),
      address: manualVenue.address.trim(),
      city: manualVenue.city.trim() || undefined,
      state: manualVenue.state.trim() || undefined,
      zipCode: manualVenue.zipCode.trim() || undefined,
      country: manualVenue.country.trim() || undefined
    };

    onVenueSelect(venue);
    setShowManualEntry(false);
    setManualVenue({
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    });
  };

  // Handle venue removal
  const handleRemoveVenue = () => {
    onVenueSelect(null);
  };

  // Reset manual entry
  const cancelManualEntry = () => {
    setShowManualEntry(false);
    setManualVenue({
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Show selected venue */}
      {selectedVenue && !showManualEntry && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Selected Venue</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveVenue}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              data-testid="button-remove-venue"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <VenueCard
            venue={{
              id: selectedVenue.placeId || 'manual',
              name: selectedVenue.name,
              address: selectedVenue.address,
              city: selectedVenue.city,
              state: selectedVenue.state,
              zipCode: selectedVenue.zipCode,
              country: selectedVenue.country,
              latitude: selectedVenue.latitude,
              longitude: selectedVenue.longitude,
              placeId: selectedVenue.placeId,
              formattedAddress: selectedVenue.address,
              placeTypes: null,
              address2: null,
              countryCode: null
            }}
            showMap={showMap}
            mapWidth={300}
            mapHeight={150}
          />
        </div>
      )}

      {/* Show venue selector when no venue is selected */}
      {!selectedVenue && !showManualEntry && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Select Venue</Label>
          
          <VenueAutocomplete
            onVenueSelect={handleVenueSelect}
            placeholder={placeholder}
            disabled={disabled}
          />

          {allowManual && (
            <div className="flex items-center justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualEntry(true)}
                className="text-xs"
                data-testid="button-manual-venue-entry"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add venue manually
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Manual venue entry form */}
      {showManualEntry && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Add Venue Manually</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelManualEntry}
                className="h-8 w-8 p-0"
                data-testid="button-cancel-manual-entry"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="manual-name" className="text-xs">
                  Venue Name *
                </Label>
                <Input
                  id="manual-name"
                  value={manualVenue.name}
                  onChange={(e) => setManualVenue(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter venue name"
                  className="text-sm"
                  data-testid="input-manual-venue-name"
                />
              </div>

              <div>
                <Label htmlFor="manual-address" className="text-xs">
                  Address
                </Label>
                <Input
                  id="manual-address"
                  value={manualVenue.address}
                  onChange={(e) => setManualVenue(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Street address"
                  className="text-sm"
                  data-testid="input-manual-venue-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="manual-city" className="text-xs">
                    City
                  </Label>
                  <Input
                    id="manual-city"
                    value={manualVenue.city}
                    onChange={(e) => setManualVenue(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    className="text-sm"
                    data-testid="input-manual-venue-city"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-state" className="text-xs">
                    State/Province
                  </Label>
                  <Input
                    id="manual-state"
                    value={manualVenue.state}
                    onChange={(e) => setManualVenue(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                    className="text-sm"
                    data-testid="input-manual-venue-state"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="manual-zip" className="text-xs">
                    ZIP/Postal Code
                  </Label>
                  <Input
                    id="manual-zip"
                    value={manualVenue.zipCode}
                    onChange={(e) => setManualVenue(prev => ({ ...prev, zipCode: e.target.value }))}
                    placeholder="ZIP Code"
                    className="text-sm"
                    data-testid="input-manual-venue-zip"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-country" className="text-xs">
                    Country
                  </Label>
                  <Input
                    id="manual-country"
                    value={manualVenue.country}
                    onChange={(e) => setManualVenue(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Country"
                    className="text-sm"
                    data-testid="input-manual-venue-country"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleManualSubmit}
                disabled={!manualVenue.name.trim()}
                size="sm"
                className="flex-1"
                data-testid="button-save-manual-venue"
              >
                Add Venue
              </Button>
              <Button
                variant="outline"
                onClick={cancelManualEntry}
                size="sm"
                data-testid="button-cancel-manual-venue"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}