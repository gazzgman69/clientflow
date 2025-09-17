import { Request, Response, NextFunction } from 'express';

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
    // PRODUCTION: Tenant resolution must always work from session, subdomain, or domain
    // No development fallbacks allowed in production

    // Extract host and subdomain BEFORE conditional checks to prevent scope issues
    const host = req.get('host') || '';
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
        // TODO: Implement domain-to-tenant lookup in database
        
        // 3. Check for subdomain-based tenant resolution (only if no session tenant)
        if (subdomain && typeof subdomain === 'string' && subdomain !== 'www' && subdomain !== 'api') {
          // TODO: Implement subdomain-to-tenant lookup in database
          req.tenantId = `tenant-${subdomain.trim()}`;
          tenantSlug = subdomain.trim(); // Use subdomain as slug when resolving via subdomain
        }
      } catch (subdomainError) {
        console.error('Error processing subdomain for tenant resolution:', subdomainError);
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

    // TODO: Load full tenant details from database
    // For now, create a basic tenant object with safe slug fallback
    try {
      req.tenant = {
        id: sanitizedTenantId,
        name: 'Tenant',
        slug: tenantSlug, // Now properly scoped and has safe default
        plan: 'starter',
        isActive: true
      };
    } catch (tenantCreationError) {
      console.error('Error creating tenant object:', tenantCreationError);
      return res.status(500).json({ error: 'Failed to resolve tenant context' });
    }

    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve tenant context' });
  }
};

/**
 * Extract subdomain from host header
 * Examples: 
 *   'acme.myapp.com' -> 'acme'
 *   'www.myapp.com' -> 'www'
 *   'myapp.com' -> null
 */
function extractSubdomain(host: string): string | null {
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