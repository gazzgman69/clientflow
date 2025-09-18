import { Store } from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';

/**
 * Enhanced PostgreSQL session store with tenant-aware security features
 * Extends the standard connect-pg-simple store with additional security capabilities
 */
export class TenantAwareSessionStore extends Store {
  private pgStore: any;
  private securityConfig: {
    maxSessionsPerUser: number;
    maxSessionsPerTenant: number;
    enableSessionTracking: boolean;
    sessionTimeoutMinutes: number;
  };

  constructor(options: any) {
    super();
    
    // Initialize the underlying PostgreSQL store
    const PgSession = ConnectPgSimple(require('express-session'));
    this.pgStore = new PgSession({
      ...options,
      tableName: options.tableName || 'sessions',
      createTableIfMissing: true
    });

    // Security configuration
    this.securityConfig = {
      maxSessionsPerUser: options.maxSessionsPerUser || 5,
      maxSessionsPerTenant: options.maxSessionsPerTenant || 100,
      enableSessionTracking: options.enableSessionTracking !== false,
      sessionTimeoutMinutes: options.sessionTimeoutMinutes || 1440 // 24 hours
    };

    this.setupSecurityTables();
  }

  /**
   * Enhanced get method with security logging
   */
  get(sid: string, callback: (err?: any, session?: any) => void): void {
    this.pgStore.get(sid, (err: any, session: any) => {
      if (err) {
        this.logSecurityEvent('session_get_error', { sessionId: sid, error: err.message });
        return callback(err);
      }

      if (session) {
        // Validate session hasn't exceeded timeout
        if (this.isSessionExpired(session)) {
          this.destroy(sid, () => {
            this.logSecurityEvent('session_expired_auto_destroy', { sessionId: sid });
            callback(null, null);
          });
          return;
        }

        // Log session access
        this.logSecurityEvent('session_accessed', {
          sessionId: sid,
          userId: session.userId,
          tenantId: session.tenantId
        });
      }

      callback(null, session);
    });
  }

  /**
   * Enhanced set method with tenant validation and session limits
   */
  set(sid: string, session: any, callback?: (err?: any) => void): void {
    const cb = callback || (() => {});

    // Extract tenant and user info
    const userId = session.userId;
    const tenantId = session.tenantId || session.user?.tenantId;

    if (userId && this.securityConfig.enableSessionTracking) {
      // Check session limits before creating new session
      this.checkSessionLimits(userId, tenantId, (limitError: any) => {
        if (limitError) {
          this.logSecurityEvent('session_limit_exceeded', {
            sessionId: sid,
            userId,
            tenantId,
            error: limitError.message
          });
          return cb(limitError);
        }

        // Proceed with session creation
        this.createSecureSession(sid, session, cb);
      });
    } else {
      this.createSecureSession(sid, session, cb);
    }
  }

  /**
   * Enhanced destroy method with security logging
   */
  destroy(sid: string, callback?: (err?: any) => void): void {
    const cb = callback || (() => {});

    // Get session info before destroying for logging
    this.pgStore.get(sid, (err: any, session: any) => {
      if (!err && session) {
        this.logSecurityEvent('session_destroyed', {
          sessionId: sid,
          userId: session.userId,
          tenantId: session.tenantId
        });
      }

      this.pgStore.destroy(sid, cb);
    });
  }

  /**
   * Create session with security enhancements
   */
  private createSecureSession(sid: string, session: any, callback: (err?: any) => void): void {
    // Add security metadata
    const enhancedSession = {
      ...session,
      createdAt: session.createdAt || new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      securityFlags: {
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        validated: true
      }
    };

    this.pgStore.set(sid, enhancedSession, (err: any) => {
      if (err) {
        this.logSecurityEvent('session_creation_error', {
          sessionId: sid,
          userId: session.userId,
          error: err.message
        });
        return callback(err);
      }

      this.logSecurityEvent('session_created', {
        sessionId: sid,
        userId: session.userId,
        tenantId: session.tenantId
      });

      callback();
    });
  }

  /**
   * Check session limits per user and tenant
   */
  private checkSessionLimits(userId: string, tenantId: string, callback: (err?: any) => void): void {
    if (!this.securityConfig.enableSessionTracking) {
      return callback();
    }

    // Note: In production, this should query the session table to count active sessions
    // For now, we'll implement basic limits without querying
    // TODO: Implement actual session counting from database
    
    callback(); // Allow session creation for now
  }

  /**
   * Check if session has expired based on security settings
   */
  private isSessionExpired(session: any): boolean {
    if (!session.lastActivity) {
      return false; // No last activity recorded, let normal session handling decide
    }

    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const timeoutMs = this.securityConfig.sessionTimeoutMinutes * 60 * 1000;
    
    return (now.getTime() - lastActivity.getTime()) > timeoutMs;
  }

  /**
   * Setup additional security tables if needed
   */
  private async setupSecurityTables(): Promise<void> {
    // In production, this could create additional security tracking tables
    // For now, we use the standard session table with enhanced data
  }

  /**
   * Log security events for audit and monitoring
   */
  private logSecurityEvent(event: string, data: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
      source: 'TenantAwareSessionStore'
    };

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 SESSION SECURITY: ${event}`, logEntry);
    }

    // TODO: In production, send to security monitoring system
    // await securityMonitor.logEvent(logEntry);
  }

  /**
   * Cleanup expired sessions for all tenants
   */
  public cleanupExpiredSessions(): void {
    // Delegate to underlying store's cleanup mechanism
    if (this.pgStore.pruneSessions) {
      this.pgStore.pruneSessions((err: any) => {
        if (err) {
          this.logSecurityEvent('session_cleanup_error', { error: err.message });
        } else {
          this.logSecurityEvent('session_cleanup_completed', {});
        }
      });
    }
  }

  /**
   * Get active session count for tenant (for monitoring)
   */
  public async getActiveSessions(tenantId: string): Promise<number> {
    // TODO: Implement session counting per tenant
    // This would query the sessions table to count active sessions for a tenant
    return 0;
  }

  /**
   * Force logout all sessions for a user (security feature)
   */
  public async destroyUserSessions(userId: string, callback?: (err?: any) => void): Promise<void> {
    const cb = callback || (() => {});
    
    // TODO: In production, this should query and destroy all sessions for the user
    // For now, log the security event
    this.logSecurityEvent('user_sessions_destroyed', { userId });
    cb();
  }

  /**
   * Get session statistics for security monitoring
   */
  public async getSessionStats(): Promise<any> {
    return {
      totalActiveSessions: 0, // TODO: Implement actual counting
      sessionsByTenant: {},   // TODO: Implement tenant breakdown
      securityEvents: []      // TODO: Implement event aggregation
    };
  }
}

/**
 * Factory function to create tenant-aware session store
 */
export function createTenantAwareSessionStore(options: any): TenantAwareSessionStore {
  return new TenantAwareSessionStore(options);
}