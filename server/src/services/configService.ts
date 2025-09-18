import { userPrefsService } from './userPrefs';

/**
 * Central configuration service that manages application settings
 * Provides a unified interface for accessing configuration values
 * with proper validation and fallbacks
 */
export class ConfigService {
  private static instance: ConfigService;
  private configCache = new Map<string, string>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get a configuration value with proper validation
   */
  async getConfig(key: string, options: {
    required?: boolean;
    defaultValue?: string;
    minLength?: number;
    description?: string;
    skipCache?: boolean;
  } = {}): Promise<string | null> {
    const { required = false, defaultValue, minLength, description, skipCache = false } = options;
    
    // Check cache first (unless skipped)
    if (!skipCache && this.isCacheValid(key)) {
      return this.configCache.get(key) || null;
    }
    
    let value: string | null = null;
    
    // Try different sources in order of preference
    
    // 1. Environment variables (for infrastructure-level configs)
    if (this.isInfrastructureConfig(key)) {
      value = process.env[key] || null;
    } else {
      // 2. User preferences for application settings
      try {
        value = await userPrefsService.getUserPref('system', key);
      } catch (error) {
        console.warn(`Failed to fetch config ${key} from user preferences:`, error);
      }
      
      // 3. Fallback to environment if not found in preferences
      if (!value) {
        value = process.env[key] || null;
      }
    }
    
    // 4. Use default value if provided
    if (!value && defaultValue !== undefined) {
      value = defaultValue;
    }
    
    // Validation
    if (!value && required) {
      const desc = description ? ` (${description})` : '';
      throw new Error(`Required configuration '${key}' is missing${desc}`);
    }
    
    if (value && minLength && value.length < minLength) {
      const desc = description ? ` (${description})` : '';
      throw new Error(`Configuration '${key}' must be at least ${minLength} characters${desc}`);
    }
    
    // Cache the result
    if (value && !skipCache) {
      this.configCache.set(key, value);
      this.cacheTimestamps.set(key, Date.now());
    }
    
    return value;
  }

  /**
   * Set a configuration value (for non-infrastructure configs)
   */
  async setConfig(key: string, value: string): Promise<boolean> {
    if (this.isInfrastructureConfig(key)) {
      throw new Error(`Cannot set infrastructure config '${key}' - use environment variables`);
    }
    
    try {
      const success = await userPrefsService.setUserPref('system', key, value);
      if (success) {
        // Update cache
        this.configCache.set(key, value);
        this.cacheTimestamps.set(key, Date.now());
      }
      return success;
    } catch (error) {
      console.error(`Failed to set config ${key}:`, error);
      return false;
    }
  }

  /**
   * Get session secret with proper validation
   */
  async getSessionSecret(): Promise<string> {
    const secret = await this.getConfig('SESSION_SECRET', {
      required: true,
      minLength: 32,
      description: 'Session encryption secret (minimum 32 characters)',
      defaultValue: process.env.NODE_ENV === 'production' ? undefined : 'fallback-secret-for-development-only-min32chars'
    });
    
    if (!secret) {
      throw new Error('SESSION_SECRET configuration is required');
    }
    
    if (process.env.NODE_ENV === 'production' && secret === 'fallback-secret-for-development-only-min32chars') {
      throw new Error('Production environment cannot use fallback SESSION_SECRET');
    }
    
    return secret;
  }

  /**
   * Validate all required configurations on startup
   */
  async validateRequiredConfigs(): Promise<void> {
    const requiredConfigs = [
      {
        key: 'SESSION_SECRET',
        minLength: 32,
        description: 'Session encryption secret'
      }
    ];
    
    const errors: string[] = [];
    
    for (const config of requiredConfigs) {
      try {
        await this.getConfig(config.key, {
          required: true,
          minLength: config.minLength,
          description: config.description,
          skipCache: true
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Failed to validate ${config.key}`);
      }
    }
    
    if (errors.length > 0) {
      console.error('❌ Configuration validation failed:');
      errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Configuration validation failed');
    }
    
    console.log('✅ All required configurations validated successfully');
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Check if a config key represents infrastructure-level configuration
   */
  private isInfrastructureConfig(key: string): boolean {
    const infraKeys = [
      'DATABASE_URL',
      'NODE_ENV',
      'PORT',
      'REPL_ID',
      'ENCRYPTION_MASTER_KEY',
      'BACKUP_ENCRYPTION_KEY'
    ];
    return infraKeys.includes(key);
  }

  /**
   * Check if cached value is still valid
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    
    return Date.now() - timestamp < this.CACHE_TTL;
  }
}

// Export singleton instance
export const configService = ConfigService.getInstance();