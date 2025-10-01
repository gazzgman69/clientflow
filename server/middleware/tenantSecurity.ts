import { Request, Response, NextFunction } from 'express';
import { TenantRequest } from './tenantResolver';

// Extend session data types for security features
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    tenantId?: string;
    user?: {
      tenantId: string;
    };
    lastActivity?: string;
    // SUPERADMIN impersonation properties
    originalUserId?: string;
    originalTenantId?: string;
    impersonatedUserId?: string;
    isImpersonating?: boolean;
  }
}

// Extended Request interface for security context
export interface SecurityRequest extends TenantRequest {
  securityContext?: {
    tenantId: string;
    userId: string;
    sessionId: string;
    userRole: string;
    permissions: string[];
    lastActivity: Date;
    ipAddress: string;
    userAgent: string;
  };
}

/**
 * Enhanced tenant-aware session validation middleware
 * Provides comprehensive security checks for multi-tenant sessions
 */
export const validateTenantSession = async (req: SecurityRequest, res: Response, next: NextFunction) => {
  try {
    // Ensure we have tenant context
    if (!req.tenantId || !req.tenant) {
      return res.status(400).json({ 
        error: 'Tenant context required',
        message: 'Request must include valid tenant context'
      });
    }

    // Ensure we have user authentication
    if (!req.session?.userId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Valid user session required'
      });
    }

    // SECURITY: Validate session belongs to current tenant
    const sessionTenantId = req.session.tenantId || req.session.user?.tenantId;
    if (sessionTenantId && sessionTenantId !== req.tenantId) {
      console.warn(`🚨 SECURITY VIOLATION: User ${req.session.userId} session tenant mismatch`, {
        sessionTenant: sessionTenantId,
        requestTenant: req.tenantId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Clear potentially compromised session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
      });
      
      return res.status(403).json({ 
        error: 'Session security violation',
        message: 'Session has been terminated for security reasons'
      });
    }

    // Import storage for user validation
    const { storage } = await import('../storage');
    
    // Validate user exists and belongs to tenant
    const user = await storage.getUser(req.session.userId, req.tenantId);
    if (!user) {
      console.warn(`🚨 SECURITY: User ${req.session.userId} not found - terminating session`);
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
      });
      
      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'User account not found'
      });
    }

    // SECURITY: Ensure user belongs to the current tenant
    if (user.tenantId && user.tenantId !== req.tenantId) {
      console.warn(`🚨 SECURITY VIOLATION: User ${user.email} does not belong to tenant ${req.tenantId}`, {
        userTenant: user.tenantId,
        requestTenant: req.tenantId,
        ip: req.ip
      });
      
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'User does not have access to this tenant'
      });
    }

    // Build security context
    req.securityContext = {
      tenantId: req.tenantId,
      userId: user.id,
      sessionId: req.sessionID,
      userRole: user.role || 'user',
      permissions: getUserPermissions(user.role || 'user'),
      lastActivity: new Date(),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };

    // Update session with current tenant info for future validation
    if (!req.session.tenantId) {
      req.session.tenantId = req.tenantId;
    }

    // Track security metrics
    trackSecurityEvent('session_validated', req.securityContext);

    next();
  } catch (error) {
    console.error('❌ SECURITY: Tenant session validation failed:', error);
    return res.status(500).json({ 
      error: 'Security validation failed',
      message: 'Unable to validate session security'
    });
  }
};

/**
 * Tenant-aware permission middleware
 * Validates user has required permissions within tenant context
 */
export const requirePermission = (permission: string) => {
  return (req: SecurityRequest, res: Response, next: NextFunction) => {
    if (!req.securityContext) {
      return res.status(401).json({ 
        error: 'Security context required',
        message: 'Request must be validated through security middleware'
      });
    }

    const hasPermission = req.securityContext.permissions.includes(permission) ||
                         req.securityContext.permissions.includes('admin') ||
                         req.securityContext.userRole === 'super_admin';

    if (!hasPermission) {
      console.warn(`🚫 PERMISSION DENIED: User ${req.securityContext.userId} lacks permission "${permission}"`, {
        userRole: req.securityContext.userRole,
        tenantId: req.securityContext.tenantId,
        permissions: req.securityContext.permissions
      });

      trackSecurityEvent('permission_denied', req.securityContext, { 
        requiredPermission: permission 
      });

      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Access denied: ${permission} permission required`
      });
    }

    trackSecurityEvent('permission_granted', req.securityContext, { 
      grantedPermission: permission 
    });

    next();
  };
};

/**
 * Enhanced session timeout middleware
 * Implements sliding session expiry with tenant-specific settings
 */
export const enforceSessionTimeout = async (req: SecurityRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.session || !req.securityContext) {
      return next();
    }

    const lastActivity = req.session.lastActivity ? new Date(req.session.lastActivity) : new Date();
    const now = new Date();
    const timeSinceActivity = now.getTime() - lastActivity.getTime();

    // Get tenant-specific timeout settings (default 24 hours)
    const sessionTimeout = await getTenantSessionTimeout(req.tenantId || 'default');
    
    if (timeSinceActivity > sessionTimeout) {
      console.log(`⏰ Session timeout for user ${req.securityContext.userId} in tenant ${req.tenantId}`);
      
      trackSecurityEvent('session_timeout', req.securityContext);
      
      req.session.destroy((err) => {
        if (err) console.error('Error destroying expired session:', err);
      });
      
      return res.status(401).json({ 
        error: 'Session expired',
        message: 'Your session has expired. Please log in again.'
      });
    }

    // Update last activity
    if (req.session) {
      req.session.lastActivity = now.toISOString();
    }
    next();
  } catch (error) {
    console.error('❌ Session timeout enforcement failed:', error);
    next(); // Continue processing on error
  }
};

/**
 * Cross-tenant access prevention middleware
 * Prevents users from accessing resources across tenant boundaries
 * SECURITY FIX: Tenant ID must ONLY come from server-side session/context, never from client
 */
export const preventCrossTenantAccess = (req: SecurityRequest, res: Response, next: NextFunction) => {
  if (!req.securityContext) {
    return res.status(401).json({ 
      error: 'Security context required'
    });
  }

  // SECURITY FIX: Removed tenant override from request params/body/query
  // Tenant ID should ONLY come from server-side session (req.securityContext.tenantId)
  // Any attempt to specify tenantId in request params/body/query is a security violation
  
  // DEVELOPMENT MODE ONLY: Allow tenant override for testing with explicit feature flag + admin auth
  if (process.env.NODE_ENV === 'development' && 
      process.env.ALLOW_DEV_TENANT_OVERRIDE === '1' &&
      req.session?.userId) {
    const devTenantOverride = req.query.devTenantOverride || req.headers['x-dev-tenant-override'];
    if (devTenantOverride && typeof devTenantOverride === 'string') {
      console.warn(`⚠️ DEV MODE: Tenant override requested by ${req.session.userId} to ${devTenantOverride}`);
      // Still log this as a security event for audit purposes
      trackSecurityEvent('dev_tenant_override', req.securityContext, {
        requestedTenant: devTenantOverride,
        path: req.path,
        note: 'Development mode tenant override - should never occur in production'
      });
    }
  }
  
  // Check if client is attempting to specify tenantId (which is a security violation)
  const attemptedTenantOverride = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  
  if (attemptedTenantOverride) {
    console.error(`🚨 SECURITY VIOLATION: Client attempted to specify tenantId in request`, {
      userId: req.securityContext.userId,
      userTenant: req.securityContext.tenantId,
      attemptedTenant: attemptedTenantOverride,
      path: req.path,
      method: req.method,
      source: req.params.tenantId ? 'params' : req.body.tenantId ? 'body' : 'query'
    });

    trackSecurityEvent('tenant_override_attempt', req.securityContext, {
      attemptedTenant: attemptedTenantOverride,
      path: req.path,
      note: 'Client attempted to override tenant - blocked'
    });

    return res.status(403).json({ 
      error: 'Security violation',
      message: 'Tenant specification in request is not allowed'
    });
  }

  next();
};

/**
 * Security audit logging middleware
 * Logs security-relevant events for compliance and monitoring
 */
export const auditSecurityEvents = (req: SecurityRequest, res: Response, next: NextFunction) => {
  if (!req.securityContext) {
    return next();
  }

  // Log high-risk operations
  const highRiskPaths = ['/api/users', '/api/settings', '/api/admin', '/api/tenants'];
  const isHighRisk = highRiskPaths.some(path => req.path.startsWith(path));
  
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  if (isHighRisk || isStateChanging) {
    trackSecurityEvent('api_access', req.securityContext, {
      method: req.method,
      path: req.path,
      isHighRisk,
      isStateChanging
    });
  }

  next();
};

// Helper functions

/**
 * Get user permissions based on role
 */
function getUserPermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    'super_admin': ['admin', 'manage_users', 'manage_tenants', 'manage_billing', 'view_audit', 'manage_settings'],
    'admin': ['manage_users', 'manage_settings', 'view_audit', 'manage_projects', 'manage_leads'],
    'manager': ['manage_projects', 'manage_leads', 'view_reports'],
    'user': ['view_projects', 'manage_own_tasks'],
    'viewer': ['view_projects']
  };

  return permissions[role] || permissions['user'];
}

/**
 * Get tenant-specific session timeout
 */
export async function getTenantSessionTimeout(tenantId: string): Promise<number> {
  try {
    // Default to 24 hours (in milliseconds)
    const defaultTimeout = 24 * 60 * 60 * 1000;
    
    // In production, this could check tenant settings
    // For now, return default with potential for enterprise tenants to have longer sessions
    return defaultTimeout;
  } catch (error) {
    console.error('Error getting tenant session timeout:', error);
    return 24 * 60 * 60 * 1000; // Fallback to 24 hours
  }
}

/**
 * Track security events for monitoring and compliance
 */
export function trackSecurityEvent(
  event: string, 
  context: SecurityRequest['securityContext'], 
  metadata?: Record<string, any>
): void {
  try {
    const securityLog = {
      timestamp: new Date().toISOString(),
      event,
      tenantId: context?.tenantId,
      userId: context?.userId,
      sessionId: context?.sessionId,
      userRole: context?.userRole,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: metadata || {}
    };

    // In production, this should log to a secure audit system
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 SECURITY EVENT: ${event}`, securityLog);
    }

    // TODO: In production, send to security monitoring system
    // await securityMonitoring.logEvent(securityLog);
  } catch (error) {
    console.error('❌ Failed to track security event:', error);
  }
}

/**
 * Middleware composition helper for enhanced security
 */
export const withTenantSecurity = (
  requireAuth: any, 
  tenantResolver: any, 
  requireTenant: any, 
  csrf?: any
) => {
  const middleware = [
    requireAuth, 
    tenantResolver, 
    requireTenant, 
    validateTenantSession,
    enforceSessionTimeout,
    preventCrossTenantAccess,
    auditSecurityEvents
  ];
  
  if (csrf) middleware.push(csrf);
  return middleware;
};