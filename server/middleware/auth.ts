import type { Request, Response, NextFunction } from 'express';

// Extend Express Request to include authenticated user info
declare global {
  namespace Express {
    interface Request {
      authenticatedUserId?: string;
      authenticatedContactId?: string;
    }
  }
}

/**
 * Standard user authentication middleware
 * Checks for valid user session and sets req.authenticatedUserId
 */
export const ensureUserAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required', 
      message: 'Please log in to access this endpoint'
    });
  }
  
  req.authenticatedUserId = req.session.userId;
  next();
};

/**
 * Enhanced portal authentication middleware with portal enabled check
 * Checks for valid portal session, project access, and portal availability
 */
export const ensurePortalAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.portalContactId) {
    return res.status(401).json({ error: 'Portal authentication required' });
  }

  try {
    // Import storage dynamically to avoid circular dependencies
    const { storage } = await import('../storage');
    
    // Get contact to find associated projects and tenant
    const contact = await storage.getContact(req.session.portalContactId);
    if (!contact) {
      return res.status(401).json({ error: 'Invalid portal session' });
    }

    // Get project ID from route params if available
    const projectId = req.params.projectId || req.query.projectId || req.body.projectId;
    
    // Resolve tenant ID from project ownership or fallback to system default  
    const tenantId = await resolveTenantIdFromContact(contact.id, projectId);
    
    // SECURITY: Verify project ownership if projectId is provided
    if (projectId) {
      const hasAccess = await verifyProjectAccessForContact(contact.id, projectId);
      if (!hasAccess) {
        console.log(`🚫 SECURITY: Contact ${contact.email} denied access to project ${projectId} - not owner`);
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'You do not have access to this project.' 
        });
      }
    }
    
    // Check if portal is enabled for this tenant/project
    const portalEnabled = await isPortalEnabledForTenant(tenantId, projectId);
    if (!portalEnabled) {
      console.log(`🚫 Portal access blocked for contact ${contact.email} - portal disabled for tenant ${tenantId}, project ${projectId || 'none'}`);
      return res.status(403).json({ 
        error: 'Client portal access is currently disabled',
        message: 'The client portal has been temporarily disabled. Please contact your service provider for assistance.'
      });
    }

    req.authenticatedContactId = req.session.portalContactId;
    next();
  } catch (error) {
    console.error('Portal auth middleware error:', error);
    return res.status(500).json({ error: 'Portal authentication failed' });
  }
};

// Helper functions for portal authentication with proper security enforcement
async function resolveTenantIdFromContact(contactId: string, projectId?: string): Promise<string> {
  try {
    const { storage } = await import('../storage');
    
    if (projectId) {
      // Get project to determine tenant from assignment
      const project = await storage.getProject(projectId);
      if (project?.assignedTo) {
        return project.assignedTo;
      }
    }
    
    // Fallback to system default for single-tenant mode
    return 'system-default';
  } catch (error) {
    console.error('Error resolving tenant ID from contact:', error);
    throw new Error('Failed to resolve tenant');
  }
}

async function verifyProjectAccessForContact(contactId: string, projectId: string): Promise<boolean> {
  try {
    const { storage } = await import('../storage');
    
    // Get all projects for this contact
    const projects = await storage.getProjectsByContact(contactId);
    
    // Check if contactId has access to this specific project
    const hasAccess = projects.some(p => p.id === projectId);
    
    return hasAccess;
  } catch (error) {
    console.error('Error verifying project access:', error);
    // FAIL CLOSED: Deny access on error for security
    return false;
  }
}

async function isPortalEnabledForTenant(tenantId: string, projectId?: string): Promise<boolean> {
  try {
    // Import user prefs service to check portal settings
    const { userPrefsService } = await import('../src/services/userPrefs');
    const { storage } = await import('../storage');
    
    // 1. Read tenant.portalEnabled (default true if missing)
    const tenantPortalEnabled = await userPrefsService.getUserPref(tenantId, 'portalEnabled');
    const tenantDefault = tenantPortalEnabled !== null ? tenantPortalEnabled === 'true' : true;
    
    // 2. If no projectId provided, return tenant default
    if (!projectId) {
      return tenantDefault;
    }
    
    // 3. Check project.portalEnabledOverride
    const project = await storage.getProject(projectId);
    if (!project) {
      return tenantDefault; // Project not found, use tenant default
    }
    
    // 4. If project.portalEnabledOverride is boolean, return that; else return tenant default
    if (project.portalEnabledOverride !== null && project.portalEnabledOverride !== undefined) {
      return project.portalEnabledOverride;
    }
    
    return tenantDefault;
  } catch (error) {
    console.error('❌ SECURITY: Error checking portal enabled status - DENYING ACCESS:', error);
    // FAIL CLOSED: Default to disabled on error for security
    return false;
  }
}

/**
 * Admin authentication middleware 
 * Checks for valid user session AND admin role
 */
export const ensureAdminAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required', 
      message: 'Please log in to access this endpoint'
    });
  }
  
  // TODO: Implement proper role checking with database lookup
  // For now, allow any authenticated user in development
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ SECURITY: Admin role verification not implemented for production');
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'This endpoint requires admin privileges'
    });
  }
  
  req.authenticatedUserId = req.session.userId;
  next();
};

/**
 * Optional authentication middleware
 * Checks for authentication but allows access even if not authenticated
 * Sets req.authenticatedUserId if available
 */
export const optionalUserAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.userId) {
    req.authenticatedUserId = req.session.userId;
  }
  next();
};

/**
 * Middleware composition helper for common auth + tenant pattern
 */
export const withUserAuth = (tenantResolver: any, requireTenant: any, csrf?: any) => {
  const middleware = [ensureUserAuth, tenantResolver, requireTenant];
  if (csrf) middleware.push(csrf);
  return middleware;
};

/**
 * Middleware composition helper for portal auth pattern
 */
export const withPortalAuth = (csrf?: any) => {
  const middleware = [ensurePortalAuth];
  if (csrf) middleware.push(csrf);
  return middleware;
};