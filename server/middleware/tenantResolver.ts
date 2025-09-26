import { Request, Response, NextFunction } from 'express';
import { setTenantContext } from '../utils/tenantContext';

// Extended Request interface with tenant context
export interface TenantRequest extends Request {
  tenantId?: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
  };
  authenticatedUserId?: string; // Add for auth integration
}

/**
 * Tenant resolver middleware for multitenancy support
 * Identifies current tenant from subdomain, domain, or user context
 */
export const tenantResolver = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    console.log('🏢 TENANT RESOLVER CALLED:', {
      path: req.path,
      method: req.method,
      host: req.get('host'),
      hasSession: !!req.session,
      sessionData: req.session ? { tenantId: req.session.tenantId, userId: req.session.userId } : null
    });
    
    // PRODUCTION: Tenant resolution must always work from session, subdomain, or domain
    // No development fallbacks allowed in production

    // Extract and normalize host with proxy-awareness for production security
    const host = getSecureHost(req).toLowerCase().split(':')[0]; // Remove port and normalize case
    const subdomain = extractSubdomain(host);
    let tenantSlug = 'default'; // Safe default for slug

    // Priority: 1. Session-based tenant (authenticated user), 2. Custom domain, 3. Subdomain
    
    // 1. Check for session-based tenant (authenticated users) - HIGHEST PRIORITY
    // Add fallback to req.session.user?.tenantId for additional auth patterns
    let resolvedFromSession = false;
    try {
      if (req.session?.tenantId && typeof req.session.tenantId === 'string') {
        req.tenantId = req.session.tenantId.trim();
        resolvedFromSession = true;
      } else if (req.session?.user?.tenantId && typeof req.session.user.tenantId === 'string') {
        req.tenantId = req.session.user.tenantId.trim();
        resolvedFromSession = true;
      }
    } catch (sessionError) {
      console.error('Error reading session data for tenant resolution:', sessionError);
      // Continue with other resolution methods
    }
    
    // 2. Check for custom domain mapping (only if no session tenant)
    if (!req.tenantId) {
      try {
        const { storage } = await import('../storage');
        
        // Development mode: Enable PROPER multi-tenant testing
        if (process.env.NODE_ENV === 'development' && 
            (host === 'localhost' || host === '127.0.0.1' || host.includes('replit.dev'))) {
          
          // Check for dev tenant override via query param or header for testing
          const testTenant = req.query.tenant || req.get('X-Test-Tenant');
          if (testTenant && typeof testTenant === 'string') {
            try {
              const tenant = await storage.getTenantBySlug(testTenant);
              if (tenant) {
                req.tenantId = tenant.id;
                tenantSlug = tenant.slug;
              }
            } catch (error) {
              console.error('Error fetching test tenant:', error);
            }
          }
          
          // Only fallback to default if no session tenant and no test override
          if (!req.tenantId) {
            try {
              const defaultTenant = await storage.getTenantBySlug('default');
              if (defaultTenant) {
                req.tenantId = defaultTenant.id;
                tenantSlug = defaultTenant.slug;
              } else {
                req.tenantId = process.env.DEV_TENANT_ID || 'development-tenant';
                tenantSlug = 'default';
              }
            } catch (devTenantError) {
              console.error('Error fetching development tenant:', devTenantError);
              req.tenantId = process.env.DEV_TENANT_ID || 'development-tenant';
              tenantSlug = 'default';
            }
          }
        } else {
          // Production mode: Check for custom domain first (with www normalization)
          if (host && host !== 'localhost' && !host.includes('replit.dev')) {
            try {
              let tenantByDomain = await storage.getTenantByDomain(host);
              // If no exact match and host has www, try without www
              if (!tenantByDomain && host.startsWith('www.')) {
                tenantByDomain = await storage.getTenantByDomain(host.substring(4));
              }
              // If no exact match and host doesn't have www, try with www
              if (!tenantByDomain && !host.startsWith('www.')) {
                tenantByDomain = await storage.getTenantByDomain(`www.${host}`);
              }
              
              if (tenantByDomain) {
                req.tenantId = tenantByDomain.id;
                tenantSlug = tenantByDomain.slug;
              }
            } catch (domainLookupError) {
              console.error('Error during domain tenant lookup:', domainLookupError);
            }
          }
          
          // 3. Check for subdomain-based tenant resolution (only if no domain match)
          if (!req.tenantId && subdomain && typeof subdomain === 'string' && 
              subdomain !== 'www' && subdomain !== 'api' && !subdomain.match(/^\d+$/)) {
            try {
              const tenantBySlug = await storage.getTenantBySlug(subdomain.trim());
              if (tenantBySlug) {
                req.tenantId = tenantBySlug.id;
                tenantSlug = tenantBySlug.slug;
              }
            } catch (subdomainLookupError) {
              console.error('Error during subdomain tenant lookup:', subdomainLookupError);
            }
          }
        }
      } catch (tenantLookupError) {
        console.error('Error during tenant database lookup:', tenantLookupError);
        // Fall through to error handling below
      }
    }

    // If no tenant resolved, deny access
    if (!req.tenantId || typeof req.tenantId !== 'string' || req.tenantId.trim().length === 0) {
      console.warn('Tenant resolution failed', {
        hasSession: !!req.session,
        sessionTenantId: req.session?.tenantId ? '[PRESENT]' : '[MISSING]',
        userTenantId: req.session?.user?.tenantId ? '[PRESENT]' : '[MISSING]',
        host: host || '[MISSING]',
        subdomain: subdomain || '[NONE]',
        userAgent: req.get('User-Agent')?.substring(0, 100) || '[MISSING]'
      });
      
      return res.status(400).json({ 
        error: 'No tenant context found',
        message: 'Unable to determine tenant from request context'
      });
    }

    // Validate and sanitize tenant ID
    const sanitizedTenantId = req.tenantId.trim();
    if (sanitizedTenantId.length > 100) { // Prevent excessively long tenant IDs
      console.error('Tenant ID too long:', sanitizedTenantId.length);
      return res.status(400).json({ 
        error: 'Invalid tenant context',
        message: 'Tenant identifier is invalid'
      });
    }

    // Load full tenant details from database
    try {
      const { storage } = await import('../storage');
      const fullTenant = await storage.getTenant(sanitizedTenantId);
      
      if (fullTenant && fullTenant.isActive) {
        req.tenant = {
          id: fullTenant.id,
          name: fullTenant.name,
          slug: fullTenant.slug,
          plan: fullTenant.plan || 'starter',
          isActive: fullTenant.isActive
        };
      } else if (process.env.NODE_ENV === 'development' && 
                 (sanitizedTenantId === 'development-tenant' || sanitizedTenantId === process.env.DEV_TENANT_ID)) {
        // Development fallback tenant (enhanced to handle custom DEV_TENANT_ID)
        req.tenant = {
          id: sanitizedTenantId,
          name: 'Development Tenant',
          slug: 'default',
          plan: 'starter',
          isActive: true
        };
      } else {
        // Tenant not found or inactive
        console.warn('Tenant not found or inactive:', sanitizedTenantId);
        return res.status(403).json({ 
          error: 'Invalid tenant context',
          message: 'Tenant not found or suspended'
        });
      }
    } catch (tenantFetchError) {
      console.error('Error fetching tenant details:', tenantFetchError);
      return res.status(500).json({ error: 'Failed to resolve tenant context' });
    }

    // Set PostgreSQL session variable for RLS policies
    try {
      await setTenantContext(req.tenantId);
    } catch (tenantContextError) {
      console.error('Failed to set database tenant context:', tenantContextError);
      return res.status(500).json({ 
        error: 'Failed to initialize tenant context',
        message: 'Database tenant isolation setup failed'
      });
    }

    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve tenant context' });
  }
};

/**
 * Securely extract host with proxy-awareness for production deployment
 * Handles reverse proxies, CDNs, and prevents host header spoofing
 * Only trusts proxy headers when Express trust proxy is properly configured
 */
function getSecureHost(req: any): string {
  // Check if Express app is configured to trust proxy headers
  const trustProxy = req.app?.get('trust proxy') || process.env.TRUST_PROXY === 'true';
  
  // Only honor proxy headers if trust proxy is explicitly configured
  if (trustProxy) {
    // Check for forwarded host headers (reverse proxy/CDN scenarios)
    const forwardedHost = req.get('x-forwarded-host');
    const forwarded = req.get('forwarded');
    
    // Parse standard Forwarded header first (RFC 7239)
    if (forwarded) {
      const hostMatch = forwarded.match(/host=([^;,\s]+)/i);
      if (hostMatch) {
        return hostMatch[1].replace(/"/g, ''); // Remove quotes if present
      }
    }
    
    // Check X-Forwarded-Host (common proxy header)
    if (forwardedHost) {
      // Take the first host if comma-separated list
      return forwardedHost.split(',')[0].trim();
    }
    
    // Use Express req.hostname if trust proxy is configured
    if (req.hostname && req.hostname !== 'localhost') {
      return req.hostname;
    }
  } else {
    // Trust proxy not configured - warn about potential proxy header spoofing
    const forwardedHost = req.get('x-forwarded-host');
    const forwarded = req.get('forwarded');
    
    if (process.env.NODE_ENV === 'production' && (forwardedHost || forwarded)) {
      console.warn('Ignoring proxy headers - trust proxy not configured. Set app.set("trust proxy", true) or TRUST_PROXY=true');
    }
  }
  
  // Fallback to raw Host header
  const rawHost = req.get('host') || '';
  
  // Security warning for production without proxy configuration
  if (process.env.NODE_ENV === 'production' && !trustProxy) {
    console.warn('Production deployment using raw Host header - configure reverse proxy and trust proxy for security');
  }
  
  return rawHost;
}

/**
 * Extract subdomain from normalized host (without port)
 * Examples: 
 *   'acme.myapp.com' -> 'acme'
 *   'www.myapp.com' -> 'www'
 *   'myapp.com' -> null
 *   'localhost' -> null
 */
function extractSubdomain(host: string): string | null {
  // Host should already be normalized (lowercase, no port)
  const parts = host.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
}

/**
 * Middleware to require tenant context
 * Use this on routes that must have tenant isolation
 */
export const requireTenant = (req: TenantRequest, res: Response, next: NextFunction) => {
  if (!req.tenantId) {
    return res.status(400).json({ 
      error: 'Tenant context required',
      message: 'This operation requires tenant context'
    });
  }
  next();
};

/**
 * Middleware to check tenant permissions/plan limits
 */
export const checkTenantPermissions = (requiredPlan: 'starter' | 'pro' | 'enterprise' = 'starter') => {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    if (!req.tenant.isActive) {
      return res.status(403).json({ 
        error: 'Tenant suspended',
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // TODO: Implement plan hierarchy checking
    // For now, allow all operations
    next();
  };
};