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
}

/**
 * Tenant resolver middleware for multitenancy support
 * Identifies current tenant from subdomain, domain, or user context
 */
export const tenantResolver = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    // For development/single-tenant mode, use default tenant
    if (process.env.NODE_ENV === 'development') {
      // In development, we'll use a default tenant ID for now
      // In production, this would be resolved from subdomain/domain
      req.tenantId = 'default-tenant';
      req.tenant = {
        id: 'default-tenant',
        name: 'Default Tenant',
        slug: 'default',
        plan: 'starter', 
        isActive: true
      };
      return next();
    }

    // Production tenant resolution logic
    // Priority: 1. Custom domain, 2. Subdomain, 3. User-based fallback
    
    // 1. Check for custom domain mapping
    const host = req.get('host') || '';
    // TODO: Implement domain-to-tenant lookup in database
    
    // 2. Check for subdomain-based tenant resolution
    const subdomain = extractSubdomain(host);
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      // TODO: Implement subdomain-to-tenant lookup in database
      req.tenantId = `tenant-${subdomain}`;
    }

    // 3. Fallback to user-based tenant (if user is authenticated)
    if (!req.tenantId && req.session?.user?.tenantId) {
      req.tenantId = req.session.user.tenantId;
    }

    // If no tenant resolved, deny access
    if (!req.tenantId) {
      return res.status(400).json({ 
        error: 'No tenant context found',
        message: 'Unable to determine tenant from request context'
      });
    }

    // TODO: Load full tenant details from database
    // For now, create a basic tenant object
    req.tenant = {
      id: req.tenantId,
      name: 'Tenant',
      slug: subdomain || 'default',
      plan: 'starter',
      isActive: true
    };

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