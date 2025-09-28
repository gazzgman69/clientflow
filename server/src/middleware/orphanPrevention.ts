import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to prevent creation of orphaned records
 * Validates that tenant-aware operations include proper tenant context
 */
export function orphanPreventionMiddleware(req: Request, res: Response, next: NextFunction) {
  // List of routes that create/modify tenant-aware data
  const tenantAwareRoutes = [
    '/api/leads',
    '/api/contacts', 
    '/api/projects',
    '/api/quotes',
    '/api/contracts',
    '/api/invoices',
    '/api/tasks',
    '/api/emails',
    '/api/message-threads',
    '/api/quote-items',
    '/api/user-prefs',
    '/api/lead-automation-rules',
    '/api/lead-capture-forms',
    '/api/project-files'
  ];

  // Check if this route handles tenant-aware data
  const isTenantAwareRoute = tenantAwareRoutes.some(route => 
    req.path.startsWith(route)
  );

  if (isTenantAwareRoute && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Validate tenant context exists
    if (!req.session?.tenantId) {
      console.error('🚨 ORPHAN PREVENTION: Missing tenant context', {
        timestamp: new Date().toISOString(),
        event: 'orphan_prevention_triggered',
        path: req.path,
        method: req.method,
        sessionId: req.sessionID,
        ip: req.ip,
        reason: 'No tenant context in session'
      });

      return res.status(403).json({
        error: 'TENANT_CONTEXT_REQUIRED',
        message: 'Tenant context is required for this operation',
        code: 'SECURITY_VIOLATION'
      });
    }

    // Validate request body for tenant-aware operations
    if (req.body && typeof req.body === 'object') {
      const violations = validateRequestBody(req.body, req.session.tenantId, req.path);
      
      if (violations.length > 0) {
        console.error('🚨 ORPHAN PREVENTION: Request validation failed', {
          timestamp: new Date().toISOString(),
          event: 'request_validation_failed',
          path: req.path,
          method: req.method,
          tenantId: req.session.tenantId,
          violations,
          sessionId: req.sessionID,
          ip: req.ip
        });

        return res.status(400).json({
          error: 'TENANT_VALIDATION_FAILED',
          message: 'Request violates tenant isolation rules',
          violations,
          code: 'SECURITY_VIOLATION'
        });
      }
    }

    // Log successful validation
    console.info('✅ ORPHAN PREVENTION: Request validated', {
      timestamp: new Date().toISOString(),
      event: 'request_validated',
      path: req.path,
      method: req.method,
      tenantId: req.session.tenantId,
      userId: req.session.userId,
      sessionId: req.sessionID
    });
  }

  next();
}

/**
 * Validates request body for tenant compliance
 */
function validateRequestBody(body: any, sessionTenantId: string, path: string): string[] {
  const violations: string[] = [];

  // Check if body contains tenantId field
  if (body.tenantId) {
    if (body.tenantId !== sessionTenantId) {
      violations.push(`Request tenantId '${body.tenantId}' does not match session tenantId '${sessionTenantId}'`);
    }
  } else if (shouldRequireTenantId(path)) {
    // Some endpoints should automatically include tenantId
    violations.push(`Request body missing required tenantId field for path '${path}'`);
  }

  // Check for nested objects that might need tenant validation
  if (typeof body === 'object' && body !== null) {
    checkNestedTenantFields(body, sessionTenantId, violations, 'body');
  }

  return violations;
}

/**
 * Determines if a path should require tenantId in request body
 */
function shouldRequireTenantId(path: string): boolean {
  // Paths that should always include tenantId in request body
  const requireTenantIdPaths = [
    '/api/leads',
    '/api/projects',
    '/api/quotes',
    '/api/contracts',
    '/api/invoices',
    '/api/message-threads',
    '/api/quote-items',
    '/api/lead-automation-rules',
    '/api/lead-capture-forms',
    '/api/project-files'
  ];

  return requireTenantIdPaths.some(route => path.startsWith(route));
}

/**
 * Recursively checks nested objects for tenant field compliance
 */
function checkNestedTenantFields(obj: any, sessionTenantId: string, violations: string[], path: string) {
  if (!obj || typeof obj !== 'object') return;

  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const currentPath = `${path}.${key}`;

    // Check for tenantId fields in nested objects
    if (key === 'tenantId' && value !== sessionTenantId) {
      violations.push(`Nested tenantId at '${currentPath}' does not match session tenant`);
    }

    // Check foreign key references that should match tenant
    if (key.endsWith('Id') && typeof value === 'string') {
      // These are foreign key references that should be validated for tenant ownership
      const foreignKeyFields = [
        'leadId', 'contactId', 'projectId', 'quoteId', 'contractId', 
        'invoiceId', 'taskId', 'messageThreadId', 'templateId'
      ];
      
      if (foreignKeyFields.includes(key)) {
        // Note: We can't validate foreign key tenant ownership here without database queries
        // This would need to be handled in the business logic layer
        console.info('🔍 ORPHAN PREVENTION: Foreign key reference detected', {
          timestamp: new Date().toISOString(),
          event: 'foreign_key_detected',
          field: key,
          value,
          path: currentPath,
          sessionTenantId,
          note: 'Tenant ownership should be validated in business logic'
        });
      }
    }

    // Recursively check nested objects and arrays
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          checkNestedTenantFields(item, sessionTenantId, violations, `${currentPath}[${index}]`);
        });
      } else {
        checkNestedTenantFields(value, sessionTenantId, violations, currentPath);
      }
    }
  });
}

/**
 * Response validation middleware to check for tenant leakage
 */
export function responseValidationMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;

  res.json = function(body: any) {
    // Only validate responses for authenticated users with tenant context
    if (req.session?.tenantId && body) {
      const leakageIssues = detectTenantLeakage(body, req.session.tenantId, req.path);
      
      if (leakageIssues.length > 0) {
        console.error('🚨 TENANT LEAKAGE DETECTED', {
          timestamp: new Date().toISOString(),
          event: 'tenant_leakage_detected',
          path: req.path,
          method: req.method,
          sessionTenantId: req.session.tenantId,
          userId: req.session.userId,
          leakageIssues,
          severity: 'critical'
        });

        // In production, you might want to:
        // 1. Filter out the problematic data
        // 2. Return an error
        // 3. Alert security team
        
        // For now, we'll log and continue but this is a security issue
      }
    }

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Detects potential tenant data leakage in responses
 */
function detectTenantLeakage(data: any, sessionTenantId: string, path: string): string[] {
  const issues: string[] = [];

  if (!data) return issues;

  // Check arrays of data
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      if (item && typeof item === 'object' && item.tenantId) {
        if (item.tenantId !== sessionTenantId) {
          issues.push(`Array item ${index} belongs to different tenant: ${item.tenantId}`);
        }
      }
    });
  }
  // Check single objects
  else if (typeof data === 'object' && data.tenantId) {
    if (data.tenantId !== sessionTenantId) {
      issues.push(`Response data belongs to different tenant: ${data.tenantId}`);
    }
  }

  return issues;
}