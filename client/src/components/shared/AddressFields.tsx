import { useEffect, useMemo, useState } from "react";
import { getAddressLabels } from "@/lib/i18n/addressLabels";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VenueAutocomplete } from "@/components/venues/VenueAutocomplete";
import { Button } from "@/components/ui/button";
import { MapPin, ToggleLeft, ToggleRight } from "lucide-react";

interface AddressFieldsProps {
  control?: any;
  register?: any;
  errors?: any;
  countryCode?: string;
  onCountryChange?: (countryCode: string) => void;
  fieldNames?: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  disabled?: boolean;
  className?: string;
  testIdPrefix?: string;
  includeAddress2?: boolean;
  enableAutocomplete?: boolean;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
];

export function AddressFields({
  control,
  register,
  errors,
  countryCode,
  onCountryChange,
  fieldNames = {},
  disabled = false,
  className = "",
  testIdPrefix = "address",
  includeAddress2 = false,
  enableAutocomplete = true,
}: AddressFieldsProps) {
  const [useAutocomplete, setUseAutocomplete] = useState(enableAutocomplete);
  // Default field names
  const fields = {
    address1: fieldNames.address1 || "address",
    address2: fieldNames.address2 || "address2",
    city: fieldNames.city || "city", 
    state: fieldNames.state || "state",
    postalCode: fieldNames.postalCode || "zipCode",
    country: fieldNames.country || "country",
  };

  // Get localized labels
  const labels = useMemo(() => {
    return getAddressLabels({
      countryCode,
      locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US'
    });
  }, [countryCode]);

  const handleCountryChange = (newCountryCode: string) => {
    onCountryChange?.(newCountryCode);
  };

  // Handle venue autocomplete selection
  const handleVenueSelect = (venue: { placeId: string; name: string; address: string; city?: string; state?: string; zipCode?: string; country?: string; latitude?: number; longitude?: number; }) => {
    if (control && control._setValue) {
      // Fill in the address fields based on venue data
      control._setValue(fields.address1, venue.address || '', { shouldDirty: true, shouldValidate: true });
      if (venue.city) control._setValue(fields.city, venue.city, { shouldDirty: true, shouldValidate: true });
      if (venue.state) control._setValue(fields.state, venue.state, { shouldDirty: true, shouldValidate: true });
      if (venue.zipCode) control._setValue(fields.postalCode, venue.zipCode, { shouldDirty: true, shouldValidate: true });
      if (venue.country) {
        control._setValue(fields.country, venue.country, { shouldDirty: true, shouldValidate: true });
        onCountryChange?.(venue.country);
      }
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Autocomplete toggle */}
      {enableAutocomplete && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Address Input Method</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setUseAutocomplete(!useAutocomplete)}
            className="flex items-center gap-2"
            data-testid={`${testIdPrefix}-toggle-autocomplete`}
          >
            {useAutocomplete ? (
              <>
                <ToggleRight className="h-4 w-4" />
                Smart Search
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4" />
                Manual Entry
              </>
            )}
          </Button>
        </div>
      )}

      {/* Address Line 1 - with venue autocomplete option */}
      <FormField
        control={control}
        name={fields.address1}
        render={({ field }) => (
          <FormItem>
            <FormLabel data-testid={`${testIdPrefix}-label-address`}>
              {labels.address1}
            </FormLabel>
            <FormControl>
              {useAutocomplete && enableAutocomplete ? (
                <VenueAutocomplete
                  onVenueSelect={handleVenueSelect}
                  placeholder={`Search for ${labels.address1.toLowerCase()}...`}
                  initialValue={field.value || ""}
                  disabled={disabled}
                />
              ) : (
                <Input 
                  {...field} 
                  value={field.value || ""} 
                  disabled={disabled}
                  placeholder={`Enter your ${labels.address1.toLowerCase()}`}
                  data-testid={`input-${testIdPrefix}-address`} 
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Address Line 2 (optional) */}
      {includeAddress2 && (
        <FormField
          control={control}
          name={fields.address2}
          render={({ field }) => (
            <FormItem>
              <FormLabel data-testid={`${testIdPrefix}-label-address2`}>
                {labels.address2} (Optional)
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  value={field.value || ""} 
                  disabled={disabled}
                  placeholder={`Enter your ${labels.address2.toLowerCase()}`}
                  data-testid={`input-${testIdPrefix}-address2`} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* City, State, Postal Code */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FormField
          control={control}
          name={fields.city}
          render={({ field }) => (
            <FormItem>
              <FormLabel data-testid={`${testIdPrefix}-label-city`}>
                {labels.city}
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  value={field.value || ""} 
                  disabled={disabled}
                  placeholder={`Enter your ${labels.city.toLowerCase()}`}
                  data-testid={`input-${testIdPrefix}-city`} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={fields.state}
          render={({ field }) => (
            <FormItem>
              <FormLabel data-testid={`${testIdPrefix}-label-state`}>
                {labels.state}
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  value={field.value || ""} 
                  disabled={disabled}
                  placeholder={`Enter your ${labels.state.toLowerCase()}`}
                  data-testid={`input-${testIdPrefix}-state`} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={fields.postalCode}
          render={({ field }) => (
            <FormItem>
              <FormLabel data-testid={`${testIdPrefix}-label-postal-code`}>
                {labels.postalCode}
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  value={field.value || ""} 
                  disabled={disabled}
                  placeholder={`Enter your ${labels.postalCode.toLowerCase()}`}
                  data-testid={`input-${testIdPrefix}-zip`} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Country */}
      <FormField
        control={control}
        name={fields.country}
        render={({ field }) => (
          <FormItem>
            <FormLabel data-testid={`${testIdPrefix}-label-country`}>
              {labels.country}
            </FormLabel>
            <Select 
              onValueChange={(value) => {
                field.onChange(value);
                handleCountryChange(value);
              }} 
              value={field.value || ""} 
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger data-testid={`input-${testIdPrefix}-country`}>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}