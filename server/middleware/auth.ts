import type { Request, Response, NextFunction } from 'express';
import { SecurityRequest, trackSecurityEvent } from './tenantSecurity';

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
 * Enhanced user authentication middleware with security logging
 * Checks for valid user session and sets req.authenticatedUserId with security tracking
 */
export const ensureUserAuth = (req: Request, res: Response, next: NextFunction) => {
  console.log('🔵 [ensureUserAuth] ENTRY POINT - middleware starting');
  console.log('[ensureUserAuth] Middleware called:', {
    path: req.path,
    method: req.method,
    hasSession: !!req.session,
    sessionId: req.session?.id,
    userId: req.session?.userId,
    tenantId: req.session?.tenantId
  });
  
  if (!req.session?.userId) {
    console.error('[ensureUserAuth] ❌ Auth failed - no userId in session');
    // Log failed authentication attempt
    logSecurityEvent('auth_failure', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    return res.status(401).json({ 
      error: 'Authentication required', 
      message: 'Please log in to access this endpoint'
    });
  }
  
  console.log('[ensureUserAuth] ✅ Auth passed for userId:', req.session.userId);
  
  // Log successful authentication
  logSecurityEvent('auth_success', {
    userId: req.session.userId,
    ip: req.ip,
    path: req.path,
    method: req.method
  });
  
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
    
    // Get contact with tenant scoping from session
    const portalTenantId = req.session.tenantId;
    if (!portalTenantId) {
      console.error('🚨 SECURITY: Portal session missing tenantId for contact', req.session.portalContactId);
      return res.status(401).json({ error: 'Invalid portal session - missing tenant context' });
    }
    const contact = await storage.getContact(req.session.portalContactId, portalTenantId);
    if (!contact) {
      return res.status(401).json({ error: 'Invalid portal session' });
    }

    // Get project ID from route params if available
    const projectId = req.params.projectId || req.query.projectId || req.body.projectId;
    
    // Resolve tenant ID from project ownership or fallback to system default  
    const tenantId = await resolveTenantIdFromContact(contact.id, projectId);
    
    // SECURITY: Verify project ownership if projectId is provided
    if (projectId) {
      const hasAccess = await verifyProjectAccessForContact(contact.id, projectId, portalTenantId);
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

async function verifyProjectAccessForContact(contactId: string, projectId: string, tenantId?: string): Promise<boolean> {
  try {
    const { storage } = await import('../storage');
    
    // Get all projects for this contact (tenant-scoped if tenantId available)
    const projects = tenantId 
      ? await storage.getProjectsByContact(contactId, tenantId)
      : await storage.getProjectsByContact(contactId);
    
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
  
  try {
    // Check admin role with proper database lookup
    const hasAdminRole = await verifyAdminRole(req.session.userId);
    if (!hasAdminRole) {
      console.log(`🚫 SECURITY: User ${req.session.userId} denied admin access - insufficient privileges`);
      return res.status(403).json({ 
        error: 'Admin access required',
        message: 'This endpoint requires admin privileges'
      });
    }
    
    req.authenticatedUserId = req.session.userId;
    next();
  } catch (error) {
    console.error('❌ SECURITY: Admin role verification failed:', error);
    // FAIL CLOSED: Deny access on error for security
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Unable to verify admin privileges' 
    });
  }
};

// Helper function for admin role verification with proper security enforcement
async function verifyAdminRole(userId: string): Promise<boolean> {
  try {
    const { storage } = await import('../storage');
    
    // Get user to check admin role
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`🚫 SECURITY: Admin check failed - user ${userId} not found`);
      return false;
    }
    
    // Check if user has admin role
    // In production, this should check a proper role field or permissions table
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    
    // For development, allow first user to be admin if no admin exists
    if (!isAdmin && process.env.NODE_ENV === 'development') {
      const allUsers = await storage.getUsers();
      const hasAnyAdmin = allUsers.some(u => u.role === 'admin' || u.role === 'super_admin');
      
      if (!hasAnyAdmin && allUsers.length > 0 && allUsers[0].id === userId) {
        console.log(`🔧 DEV: Granting admin access to first user ${userId} (no admins exist)`);
        return true;
      }
    }
    
    return isAdmin;
  } catch (error) {
    console.error('Error verifying admin role:', error);
    // FAIL CLOSED: Deny access on error for security
    return false;
  }
}

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
 * Enhanced secure authentication middleware with tenant security
 */
export const ensureSecureAuth = async (req: SecurityRequest, res: Response, next: NextFunction) => {
  // First ensure basic authentication
  if (!req.session?.userId) {
    logSecurityEvent('secure_auth_failure', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      reason: 'no_session'
    });
    
    return res.status(401).json({ 
      error: 'Authentication required', 
      message: 'Please log in to access this endpoint'
    });
  }

  try {
    // Import storage for enhanced security checks
    const { storage } = await import('../storage');
    
    // Validate user still exists and is active
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      logSecurityEvent('secure_auth_failure', {
        userId: req.session.userId,
        ip: req.ip,
        path: req.path,
        reason: 'user_not_found'
      });
      
      // Clear invalid session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying invalid session:', err);
      });
      
      return res.status(401).json({ 
        error: 'Invalid session', 
        message: 'User account not found'
      });
    }

    // Check if user account is active/not suspended
    if (user.status && user.status !== 'active') {
      logSecurityEvent('secure_auth_failure', {
        userId: user.id,
        userStatus: user.status,
        ip: req.ip,
        path: req.path,
        reason: 'user_suspended'
      });
      
      return res.status(403).json({ 
        error: 'Account suspended', 
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // Log successful secure authentication
    logSecurityEvent('secure_auth_success', {
      userId: user.id,
      userRole: user.role,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    req.authenticatedUserId = req.session.userId;
    next();
  } catch (error) {
    console.error('❌ SECURITY: Enhanced auth validation failed:', error);
    logSecurityEvent('secure_auth_error', {
      userId: req.session?.userId,
      ip: req.ip,
      path: req.path,
      error: error.message
    });
    
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Unable to validate user session'
    });
  }
};

/**
 * Middleware composition helper for standard auth + tenant pattern
 */
export const withUserAuth = (tenantResolver: any, requireTenant: any, csrf?: any) => {
  const middleware = [ensureUserAuth, tenantResolver, requireTenant];
  if (csrf) middleware.push(csrf);
  return middleware;
};

/**
 * Middleware composition helper for enhanced secure auth + tenant security
 */
export const withSecureAuth = (tenantResolver: any, requireTenant: any, csrf?: any) => {
  const middleware = [ensureSecureAuth, tenantResolver, requireTenant];
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

/**
 * SUPERADMIN authentication middleware with impersonation context support
 * Checks for SUPERADMIN role, handling both normal and impersonation scenarios
 */
export const ensureSuperAdminAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required', 
      message: 'Please log in to access this endpoint'
    });
  }
  
  try {
    // Determine the actual admin user ID and tenant ID based on impersonation state
    let adminUserId: string;
    let adminTenantId: string | undefined;

    if (req.session.isImpersonating && req.session.originalUserId) {
      // During impersonation, check the original admin's credentials
      adminUserId = req.session.originalUserId;
      adminTenantId = req.session.originalTenantId;
    } else {
      // Normal case, check current user
      adminUserId = req.session.userId;
      adminTenantId = req.session.tenantId;
    }

    // Verify SUPERADMIN role with global lookup (bypass tenant isolation)
    const hasSuperAdminRole = await verifySuperAdminRole(adminUserId, adminTenantId);
    if (!hasSuperAdminRole) {
      console.log(`🚫 SECURITY: User ${adminUserId} denied SUPERADMIN access - insufficient privileges`);
      return res.status(403).json({ 
        error: 'SUPERADMIN access required',
        message: 'This endpoint requires SUPERADMIN privileges'
      });
    }
    
    req.authenticatedUserId = adminUserId;
    next();
  } catch (error) {
    console.error('❌ SECURITY: SUPERADMIN role verification failed:', error);
    // FAIL CLOSED: Deny access on error for security
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Unable to verify SUPERADMIN privileges' 
    });
  }
};

// Helper function for SUPERADMIN role verification with proper security enforcement
async function verifySuperAdminRole(userId: string, tenantId?: string): Promise<boolean> {
  try {
    const { storage } = await import('../storage');
    
    // GLOBAL SUPERADMIN CHECK: Query across all tenants to find user
    // This bypasses tenant isolation for SUPERADMIN role verification
    const user = await storage.getUserGlobal(userId);
    if (!user) {
      console.log(`🚫 SECURITY: SUPERADMIN check failed - user ${userId} not found globally`);
      return false;
    }
    
    // Check if user has super_admin role (strict check)
    const isSuperAdmin = user.role === 'super_admin';
    
    if (isSuperAdmin) {
      console.log(`✅ SECURITY: SUPERADMIN access granted to user ${userId} (role: ${user.role}, found in tenant: ${user.tenantId})`);
    } else {
      console.log(`🚫 SECURITY: User ${userId} denied SUPERADMIN access - role: ${user.role}`);
    }
    
    return isSuperAdmin;
  } catch (error) {
    console.error('Error verifying SUPERADMIN role:', error);
    // FAIL CLOSED: Deny access on error for security
    return false;
  }
}

// Helper function for security event logging (delegates to shared trackSecurityEvent)
function logSecurityEvent(event: string, data: any): void {
  // Use the shared trackSecurityEvent function for consistency
  trackSecurityEvent(event, undefined, { ...data, source: 'AuthMiddleware' });
}