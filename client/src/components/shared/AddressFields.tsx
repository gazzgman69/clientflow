import { useEffect, useMemo } from "react";
import { getAddressLabels } from "@/lib/i18n/addressLabels";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}: AddressFieldsProps) {
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

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Address Line 1 */}
      <FormField
        control={control}
        name={fields.address1}
        render={({ field }) => (
          <FormItem>
            <FormLabel data-testid={`${testIdPrefix}-label-address`}>
              {labels.address1}
            </FormLabel>
            <FormControl>
              <Input 
                {...field} 
                value={field.value || ""} 
                disabled={disabled}
                placeholder={`Enter your ${labels.address1.toLowerCase()}`}
                data-testid={`input-${testIdPrefix}-address`} 
              />
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