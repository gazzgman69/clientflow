import { z } from 'zod';

export interface FormFieldMapping {
  /** The database model this field maps to */
  model: 'leads' | 'contacts' | 'projects';
  /** The specific database column */
  field: string;
  /** The expected data type */
  type: 'text' | 'email' | 'phone' | 'date' | 'textarea' | 'number';
  /** Whether this field is required */
  required?: boolean;
  /** Custom sanitizer function for this field */
  sanitizer?: (value: any) => any;
  /** Human-readable label for UI */
  label: string;
  /** Whether this mapping is deprecated */
  deprecated?: boolean;
  /** If deprecated, the canonical replacement key */
  replacementKey?: string;
}

// Central registry for all form field mappings
export const FORM_FIELD_REGISTRY: Record<string, FormFieldMapping> = {
  // Core lead fields
  leadName: {
    model: 'leads',
    field: 'fullName',
    type: 'text',
    required: true,
    label: 'Lead Name',
    sanitizer: (value: string) => value?.trim() || '',
  },
  leadEmail: {
    model: 'leads',
    field: 'email',
    type: 'email',
    required: true,
    label: 'Lead Email',
    sanitizer: (value: string) => value?.trim()?.toLowerCase() || '',
  },
  leadPhoneNumber: {
    model: 'leads',
    field: 'phone',
    type: 'phone',
    required: false,
    label: 'Lead Phone Number',
    sanitizer: (value: string) => value?.trim()?.replace(/[^\d+\-\(\)\s]/g, '') || '',
  },
  
  // Event-specific fields (NEW)
  eventType: {
    model: 'leads',
    field: 'eventType',
    type: 'text',
    required: false,
    label: 'Event Type',
    sanitizer: (value: string) => value?.trim() || '',
  },
  eventLocation: {
    model: 'contacts',
    field: 'venue_address', 
    type: 'text',
    required: false,
    label: 'Event Location',
    sanitizer: (value: string) => value?.trim() || '',
  },
  
  // Date and notes fields
  projectDate: {
    model: 'leads',
    field: 'projectDate',
    type: 'date',
    required: false,
    label: 'Project Date',
    sanitizer: (value: string) => {
      if (!value) return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    },
  },
  nothing: {
    model: 'leads',
    field: 'notes',
    type: 'textarea',
    required: false,
    label: 'Notes / Message',
    sanitizer: (value: string) => value?.trim() || '',
  },

  // DEPRECATED MAPPINGS - kept for backward compatibility
  whatKindOfEventIsIt: {
    model: 'leads',
    field: 'eventType',
    type: 'text',
    required: false,
    label: 'Event Type (Deprecated)',
    deprecated: true,
    replacementKey: 'eventType',
    sanitizer: (value: string) => value?.trim() || '',
  },
};

// Get all canonical (non-deprecated) field keys
export function getCanonicalFieldKeys(): string[] {
  return Object.keys(FORM_FIELD_REGISTRY).filter(
    key => !FORM_FIELD_REGISTRY[key].deprecated
  );
}

// Get all deprecated field keys and their replacements
export function getDeprecatedFieldMappings(): Record<string, string> {
  const deprecated: Record<string, string> = {};
  Object.entries(FORM_FIELD_REGISTRY).forEach(([key, mapping]) => {
    if (mapping.deprecated && mapping.replacementKey) {
      deprecated[key] = mapping.replacementKey;
    }
  });
  return deprecated;
}

// Validation schema for form payloads
export const FormPayloadSchema = z.record(z.any()).refine((data) => {
  const unknownKeys = Object.keys(data).filter(key => 
    !FORM_FIELD_REGISTRY[key] && 
    !key.includes('eventLocation') // Allow venue address components
  );
  return unknownKeys.length === 0;
}, {
  message: "Contains unknown field mappings"
});

// Error class for mapping validation
export class FormMappingError extends Error {
  constructor(
    message: string,
    public readonly unknownKeys: string[] = [],
    public readonly allowedKeys: string[] = []
  ) {
    super(message);
    this.name = 'FormMappingError';
  }
}

// Core mapping function with validation and sanitization
export interface ApplyMappingOptions {
  tenantId: string;
  allowUnknownKeys?: boolean;
  enableDeprecationWarnings?: boolean;
}

export interface MappingResult {
  leadData: Record<string, any>;
  contactData: Record<string, any>;
  projectData: Record<string, any>;
  customFieldData: Array<{key: string, value: any}>; // Store custom field responses
  warnings: string[];
  errors: string[];
}

export function applyMapping(
  payload: Record<string, any>, 
  options: ApplyMappingOptions
): MappingResult {
  const result: MappingResult = {
    leadData: {},
    contactData: {},
    projectData: {},
    customFieldData: [],
    warnings: [],
    errors: [],
  };

  // Validate all keys exist in registry
  const unknownKeys = Object.keys(payload).filter(key => 
    !FORM_FIELD_REGISTRY[key] && 
    // Allow venue address components like 'eventLocationCity', etc.
    !(key.startsWith('eventLocation') && key !== 'eventLocation')
  );
  
  if (unknownKeys.length > 0 && !options.allowUnknownKeys) {
    const allowedKeys = getCanonicalFieldKeys();
    throw new FormMappingError(
      `Unknown mapTo fields: ${unknownKeys.join(', ')}. Allowed: ${allowedKeys.join(', ')}`,
      unknownKeys,
      allowedKeys
    );
  }

  // Process each field in the payload
  Object.entries(payload).forEach(([key, value]) => {
    const mapping = FORM_FIELD_REGISTRY[key];
    
    if (!mapping) {
      // Handle venue address components separately (but not the base eventLocation field)
      if (key.includes('eventLocation') && key !== 'eventLocation') {
        handleVenueAddressComponent(key, value, result);
        return;
      }
      
      if (options.allowUnknownKeys) {
        // Treat unknown fields as potential custom fields
        result.customFieldData.push({ key, value });
        return;
      }
    }

    // Check for deprecated fields
    if (mapping.deprecated && options.enableDeprecationWarnings) {
      result.warnings.push(
        `Field '${key}' is deprecated. Use '${mapping.replacementKey}' instead.`
      );
    }

    // Sanitize the value
    let sanitizedValue = value;
    if (mapping.sanitizer) {
      try {
        sanitizedValue = mapping.sanitizer(value);
      } catch (error) {
        result.errors.push(`Failed to sanitize field '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    }

    // Apply to appropriate model
    const targetData = getTargetData(mapping.model, result);
    targetData[mapping.field] = sanitizedValue;
  });

  // Generate lead source from event type if present
  if (result.leadData.event_type) {
    result.leadData.lead_source = `${result.leadData.event_type} Lead`;
  } else if (!result.leadData.lead_source) {
    result.leadData.lead_source = 'Website Form';
  }

  return result;
}

function getTargetData(model: string, result: MappingResult): Record<string, any> {
  switch (model) {
    case 'leads': return result.leadData;
    case 'contacts': return result.contactData;
    case 'projects': return result.projectData;
    default: throw new Error(`Unknown model: ${model}`);
  }
}

function handleVenueAddressComponent(key: string, value: any, result: MappingResult): void {
  // Map venue address components to contacts model (use snake_case to match current system expectations)
  const venueFieldMap: Record<string, string> = {
    'eventLocationCity': 'venue_city',
    'eventLocationState': 'venue_state', 
    'eventLocationZipCode': 'venue_zip_code',
    'eventLocationCountry': 'venue_country',
  };

  const contactField = venueFieldMap[key];
  if (contactField && value) {
    result.contactData[contactField] = String(value).trim();
  }
}

// Utility to get form builder options
export function getFormBuilderOptions(): Array<{value: string; label: string}> {
  return getCanonicalFieldKeys()
    .map(key => ({
      value: key,
      label: FORM_FIELD_REGISTRY[key].label
    }))
    .concat([
      { value: 'custom', label: 'Custom Field' }
    ]);
}

// Utility to validate a single field mapping
export function validateFieldMapping(key: string): { valid: boolean; message?: string } {
  if (!FORM_FIELD_REGISTRY[key]) {
    const allowedKeys = getCanonicalFieldKeys();
    return {
      valid: false,
      message: `Unknown field mapping '${key}'. Allowed: ${allowedKeys.join(', ')}`
    };
  }
  
  if (FORM_FIELD_REGISTRY[key].deprecated) {
    return {
      valid: false,
      message: `Field '${key}' is deprecated. Use '${FORM_FIELD_REGISTRY[key].replacementKey}' instead.`
    };
  }
  
  return { valid: true };
}