import { Request, Response, NextFunction } from 'express';

interface TenantValidationEvent {
  timestamp: string;
  event: string;
  tenantId?: string;
  userId?: string;
  operation: string;
  resourceType: string;
  resourceId?: string;
  isValid: boolean;
  violations?: string[];
  metadata?: Record<string, any>;
}

interface OrphanDetectionEvent {
  timestamp: string;
  event: 'orphan_record_detected' | 'orphan_record_prevented';
  table: string;
  recordId?: string;
  tenantId?: string;
  operation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

/**
 * Real-time tenant monitoring middleware
 * Logs and prevents operations that could create orphaned records
 */
export function tenantMonitoringMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  const originalSend = res.send;

  // Override res.json to monitor responses
  res.json = function(body: any) {
    // Capture request context at response time (after all middleware has run)
    const requestContext = {
      method: req.method,
      path: req.path,
      tenantId: (req as any).tenantId || req.session?.tenantId,
      userId: (req as any).userId || req.session?.userId,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    // Check for potential orphaned records in response data
    if (body && typeof body === 'object') {
      validateResponseForOrphans(body, requestContext);
    }
    
    return originalJson.call(this, body);
  };

  // Override res.send for additional monitoring
  res.send = function(body: any) {
    // Capture request context at response time (after all middleware has run)
    const requestContext = {
      method: req.method,
      path: req.path,
      tenantId: (req as any).tenantId || req.session?.tenantId,
      userId: (req as any).userId || req.session?.userId,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    // Log successful operations for audit trail
    if (res.statusCode >= 200 && res.statusCode < 300) {
      logSuccessfulOperation(requestContext, body);
    }
    
    return originalSend.call(this, body);
  };

  next();
}

/**
 * Validates response data for potential orphaned records
 */
function validateResponseForOrphans(data: any, context: any) {
  if (!context.tenantId) {
    logTenantValidationEvent({
      timestamp: new Date().toISOString(),
      event: 'tenant_context_missing',
      operation: `${context.method} ${context.path}`,
      resourceType: 'unknown',
      isValid: false,
      violations: ['Missing tenant context in session'],
      metadata: {
        ip: context.ip,
        userAgent: context.userAgent
      }
    });
    return;
  }

  // Check if response contains data that should have tenantId
  const suspiciousTables = [
    'leads', 'contacts', 'projects', 'quotes', 'contracts', 'invoices',
    'tasks', 'emails', 'message_threads', 'quote_items', 'user_prefs',
    'lead_automation_rules', 'lead_capture_forms', 'project_files'
  ];

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      validateDataItem(item, context, `array[${index}]`);
    });
  } else if (data && typeof data === 'object') {
    validateDataItem(data, context, 'object');
  }
}

/**
 * Validates individual data items for tenant compliance
 */
function validateDataItem(item: any, context: any, itemPath: string) {
  if (!item || typeof item !== 'object') return;

  // Check if item has tenantId field
  if (item.tenantId) {
    if (item.tenantId !== context.tenantId) {
      logTenantValidationEvent({
        timestamp: new Date().toISOString(),
        event: 'tenant_mismatch_detected',
        tenantId: context.tenantId,
        userId: context.userId,
        operation: `${context.method} ${context.path}`,
        resourceType: inferResourceType(item),
        resourceId: item.id,
        isValid: false,
        violations: [`Data belongs to tenant '${item.tenantId}' but request is from '${context.tenantId}'`],
        metadata: {
          itemPath,
          expectedTenant: context.tenantId,
          actualTenant: item.tenantId
        }
      });
    } else {
      // Valid tenant match - log for monitoring
      logTenantValidationEvent({
        timestamp: new Date().toISOString(),
        event: 'tenant_validation_success',
        tenantId: context.tenantId,
        userId: context.userId,
        operation: `${context.method} ${context.path}`,
        resourceType: inferResourceType(item),
        resourceId: item.id,
        isValid: true,
        metadata: { itemPath }
      });
    }
  } else if (shouldHaveTenantId(item)) {
    // Item should have tenantId but doesn't - potential orphan
    logOrphanDetectionEvent({
      timestamp: new Date().toISOString(),
      event: 'orphan_record_detected',
      table: inferResourceType(item),
      recordId: item.id,
      tenantId: context.tenantId,
      operation: `${context.method} ${context.path}`,
      severity: 'high',
      metadata: {
        itemPath,
        reason: 'Missing tenantId field on tenant-aware table',
        userAgent: context.userAgent,
        ip: context.ip
      }
    });
  }
}

/**
 * Determines if a data item should have a tenantId field
 */
function shouldHaveTenantId(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  
  // List of patterns that indicate tenant-aware data
  const tenantAwareIndicators = [
    'leadId', 'contactId', 'projectId', 'quoteId', 'contractId', 'invoiceId',
    'userId', 'clientId', 'messageThreadId', 'automationRuleId'
  ];
  
  return tenantAwareIndicators.some(indicator => item[indicator] !== undefined);
}

/**
 * Infers the resource type from a data item
 */
function inferResourceType(item: any): string {
  if (!item || typeof item !== 'object') return 'unknown';
  
  // Try to infer from common field patterns
  if (item.email && item.phone) return 'contact';
  if (item.status && item.projectTitle) return 'lead';
  if (item.title && item.eventDate) return 'project';
  if (item.total && item.vatAmount) return 'quote';
  if (item.subject && item.participants) return 'message_thread';
  if (item.key && item.value && item.userId) return 'user_pref';
  
  return 'unknown';
}

/**
 * Logs tenant validation events with structured format
 */
function logTenantValidationEvent(event: TenantValidationEvent) {
  const logLevel = event.isValid ? 'info' : 'warn';
  const prefix = event.isValid ? '✅ TENANT VALIDATION' : '⚠️ TENANT VIOLATION';
  
  console[logLevel](`${prefix}: ${event.event}`, {
    timestamp: event.timestamp,
    event: event.event,
    tenantId: event.tenantId,
    userId: event.userId,
    operation: event.operation,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    isValid: event.isValid,
    violations: event.violations,
    metadata: event.metadata
  });
}

/**
 * Logs orphan detection events with structured format
 */
function logOrphanDetectionEvent(event: OrphanDetectionEvent) {
  const logLevel = event.severity === 'critical' ? 'error' : 'warn';
  const prefix = event.event === 'orphan_record_detected' ? '🚨 ORPHAN DETECTED' : '🛡️ ORPHAN PREVENTED';
  
  console[logLevel](`${prefix}: ${event.event}`, {
    timestamp: event.timestamp,
    event: event.event,
    table: event.table,
    recordId: event.recordId,
    tenantId: event.tenantId,
    operation: event.operation,
    severity: event.severity,
    metadata: event.metadata
  });
}

/**
 * Logs successful operations for audit trail
 */
function logSuccessfulOperation(context: any, responseBody: any) {
  // Only log operations that modify data
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(context.method)) return;
  
  console.info('📝 TENANT OPERATION SUCCESS', {
    timestamp: context.timestamp,
    event: 'operation_success',
    tenantId: context.tenantId,
    userId: context.userId,
    operation: `${context.method} ${context.path}`,
    statusCode: 200, // Assuming success if we reach here
    hasResponseData: !!responseBody,
    metadata: {
      ip: context.ip,
      userAgent: context.userAgent
    }
  });
}

/**
 * Database operation interceptor for real-time monitoring
 * This should be used as a database middleware/plugin
 */
export class DatabaseMonitor {
  static beforeInsert(tableName: string, data: any, context?: any) {
    const tenantAwareTables = [
      'leads', 'contacts', 'projects', 'quotes', 'contracts', 'invoices',
      'tasks', 'emails', 'message_threads', 'quote_items', 'user_prefs',
      'lead_automation_rules', 'lead_capture_forms', 'project_files'
    ];
    
    if (tenantAwareTables.includes(tableName)) {
      if (!data.tenantId) {
        logOrphanDetectionEvent({
          timestamp: new Date().toISOString(),
          event: 'orphan_record_prevented',
          table: tableName,
          operation: 'INSERT',
          severity: 'critical',
          metadata: {
            reason: 'Attempted to insert record without tenantId',
            data: { ...data, password: '[REDACTED]' }, // Redact sensitive fields
            context
          }
        });
        
        throw new Error(`TENANT SECURITY: Cannot insert into ${tableName} without tenantId`);
      }
      
      // Log successful tenant-aware insertion
      console.info('✅ TENANT INSERT VALIDATED', {
        timestamp: new Date().toISOString(),
        event: 'insert_validated',
        table: tableName,
        tenantId: data.tenantId,
        recordId: data.id,
        operation: 'INSERT'
      });
    }
  }
  
  static beforeUpdate(tableName: string, where: any, data: any, context?: any) {
    const tenantAwareTables = [
      'leads', 'contacts', 'projects', 'quotes', 'contracts', 'invoices',
      'tasks', 'emails', 'message_threads', 'quote_items', 'user_prefs',
      'lead_automation_rules', 'lead_capture_forms', 'project_files'
    ];
    
    if (tenantAwareTables.includes(tableName)) {
      if (!where.tenantId && !where.tenant_id) {
        logOrphanDetectionEvent({
          timestamp: new Date().toISOString(),
          event: 'orphan_record_prevented',
          table: tableName,
          operation: 'UPDATE',
          severity: 'critical',
          metadata: {
            reason: 'Attempted to update record without tenant filter',
            where,
            data,
            context
          }
        });
        
        throw new Error(`TENANT SECURITY: Cannot update ${tableName} without tenant filter`);
      }
    }
  }
}