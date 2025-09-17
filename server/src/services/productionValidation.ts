/**
 * Production validation service
 * Validates all required environment variables and configuration at startup
 */

interface ProductionSecret {
  name: string;
  required: boolean;
  minLength?: number;
  description: string;
}

const REQUIRED_PRODUCTION_SECRETS: ProductionSecret[] = [
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection string'
  },
  {
    name: 'SESSION_SECRET',
    required: true,
    minLength: 32,
    description: 'Session encryption secret (minimum 32 characters)'
  },
  {
    name: 'ENCRYPTION_MASTER_KEY',
    required: true,
    minLength: 32,
    description: 'Master encryption key for sensitive data (minimum 32 characters)'
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: true,
    description: 'Google OAuth client ID for calendar and email integration'
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: true,
    description: 'Google OAuth client secret for calendar and email integration'
  },
  {
    name: 'STRIPE_SECRET_KEY',
    required: true,
    description: 'Stripe secret key for payment processing'
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    description: 'Stripe webhook secret for secure webhook verification'
  }
];

const OPTIONAL_PRODUCTION_SECRETS: ProductionSecret[] = [
  {
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    description: 'Twilio account SID for SMS functionality (optional)'
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    required: false,
    description: 'Twilio auth token for SMS functionality (optional)'
  },
  {
    name: 'TWILIO_PHONE_NUMBER',
    required: false,
    description: 'Twilio phone number for SMS functionality (optional)'
  },
  {
    name: 'GOOGLE_MAPS_API_KEY',
    required: false,
    description: 'Google Maps API key for geocoding (optional)'
  }
];

export class ProductionValidationError extends Error {
  constructor(message: string, public details: string[]) {
    super(message);
    this.name = 'ProductionValidationError';
  }
}

/**
 * Validate all production secrets and configuration
 */
export function validateProductionSecrets(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if we're in production mode
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    console.log('🔒 Running in PRODUCTION mode - validating all secrets...');
  } else {
    console.log('🛠️ Running in DEVELOPMENT mode - validating required secrets...');
  }

  // Validate required secrets
  for (const secret of REQUIRED_PRODUCTION_SECRETS) {
    const value = process.env[secret.name];
    
    if (!value || value.trim() === '') {
      errors.push(`${secret.name} is required: ${secret.description}`);
      continue;
    }

    // Check minimum length if specified
    if (secret.minLength && value.length < secret.minLength) {
      errors.push(`${secret.name} must be at least ${secret.minLength} characters long`);
      continue;
    }

    // Validate specific formats
    if (secret.name === 'DATABASE_URL' && !value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
      errors.push(`${secret.name} must be a valid PostgreSQL connection string (postgresql:// or postgres://)`);
      continue;
    }

    console.log(`✅ ${secret.name}: configured`);
  }

  // Validate optional secrets (warn if missing in production)
  for (const secret of OPTIONAL_PRODUCTION_SECRETS) {
    const value = process.env[secret.name];
    
    if (!value || value.trim() === '') {
      if (isProduction) {
        warnings.push(`${secret.name} not configured: ${secret.description}`);
      }
    } else {
      console.log(`✅ ${secret.name}: configured`);
    }
  }

  // Validate Twilio group (all or none)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  const hasSomeTwilio = !!(twilioSid || twilioToken || twilioPhone);
  const hasAllTwilio = !!(twilioSid && twilioToken && twilioPhone);

  if (hasSomeTwilio && !hasAllTwilio) {
    errors.push('Twilio configuration incomplete: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must all be set together');
  }

  // Check for development fallbacks that should not exist in production
  if (isProduction) {
    // Additional production-only validations
    const port = process.env.PORT;
    if (!port) {
      warnings.push('PORT not specified - defaulting to 5000');
    }

    // Ensure no development-specific environment variables
    const devVars = ['VITE_DEV_MODE', 'ALLOW_DEV_FALLBACKS'];
    for (const devVar of devVars) {
      if (process.env[devVar]) {
        errors.push(`Development variable ${devVar} must not be set in production`);
      }
    }
  }

  // Print warnings
  if (warnings.length > 0) {
    console.warn('⚠️ Production Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  // Fail if there are errors
  if (errors.length > 0) {
    console.error('❌ Production Validation Failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new ProductionValidationError(
      `Production validation failed with ${errors.length} error(s)`,
      errors
    );
  }

  if (isProduction) {
    console.log('🔒 Production secrets validation passed');
  } else {
    console.log('🛠️ Development secrets validation passed');
  }
}

/**
 * Check if service dependencies are properly configured
 */
export function validateServiceConfiguration(): {
  twilio: boolean;
  googleMaps: boolean;
  stripe: boolean;
  encryption: boolean;
} {
  return {
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    stripe: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    encryption: !!process.env.ENCRYPTION_MASTER_KEY
  };
}

/**
 * Validate tenant configuration in production
 */
export function validateTenantConfiguration(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // In production, we need proper tenant resolution
    // This could be extended to validate domain mappings, etc.
    console.log('🏢 Tenant configuration: Production multi-tenant mode enabled');
  } else {
    console.log('🏢 Tenant configuration: Development single-tenant mode');
  }
}