export type AddressLabelSet = {
  address1: string;
  address2: string;
  city: string;
  state: string;       // State/County/Province/Region
  postalCode: string;  // Zip Code / Postcode / Postal Code / Eircode
  country: string;
};

export function getAddressLabels(opts: {
  countryCode?: string;  // ISO-3166-1 alpha-2, e.g. 'GB', 'US'
  locale?: string;       // e.g. 'en-GB'
}): AddressLabelSet {
  let effectiveCountryCode = opts.countryCode;
  
  // If no countryCode provided, try to infer from locale
  if (!effectiveCountryCode && opts.locale) {
    const localeMatch = opts.locale.match(/[a-zA-Z]{2}-([A-Z]{2})/);
    effectiveCountryCode = localeMatch ? localeMatch[1] : undefined;
  }
  
  // Country-specific label mappings
  const labelMappings: Record<string, Partial<AddressLabelSet>> = {
    US: { state: "State", postalCode: "Zip Code" },
    GB: { state: "County", postalCode: "Postcode" },
    IE: { state: "County", postalCode: "Eircode" },
    CA: { state: "Province", postalCode: "Postal Code" },
    AU: { state: "State/Region", postalCode: "Postcode" },
    NZ: { state: "Region", postalCode: "Postcode" },
  };
  
  // Get country-specific labels or use defaults
  const countryLabels = effectiveCountryCode ? labelMappings[effectiveCountryCode] : {};
  
  return {
    address1: "Address Line 1",
    address2: "Address Line 2", 
    city: "City",
    state: countryLabels.state || "State/Region",
    postalCode: countryLabels.postalCode || "Postal Code",
    country: "Country",
  };
}