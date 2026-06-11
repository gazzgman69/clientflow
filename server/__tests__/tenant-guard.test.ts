/**
 * Tenant fail-closed guard tests (no database required).
 *
 * These lock in the remediation from the 2026-06 tenant-isolation audit: every
 * tenant-sensitive storage method must FAIL CLOSED when called without a tenantId,
 * rather than silently running an unscoped query that returns/mutates other tenants'
 * rows. Each guarded method throws BEFORE touching the database, so this suite runs
 * without a live Postgres connection.
 *
 * If someone removes a guard (or adds a new cross-tenant method without one), the
 * corresponding case here fails. This is the backstop that the transpile-only build
 * (which never type-checks the IStorage arity) cannot provide.
 */
import { describe, it, expect } from '@jest/globals';
import { DrizzleStorage } from '../storage';

const storage = new DrizzleStorage();

// method name -> args to pass with a MISSING tenantId (empty string in the tenant slot)
const GUARDED: Array<[string, unknown[]]> = [
  ['getEmails', ['']],
  ['getEmailsByClient', ['client-1', '']],
  ['getSmsMessages', ['']],
  ['getSmsMessage', ['sms-1', '']],
  ['updateSmsMessage', ['sms-1', {}, '']],
  ['deleteSmsMessage', ['sms-1', '']],
  ['getCalendarSyncLogs', ['']],
  ['getCalendarSyncLog', ['log-1', '']],
  ['createCalendarSyncLog', [{}, '']],
  ['updateCalendarSyncLog', ['log-1', {}, '']],
  ['getCalendarIntegration', ['int-1', '']],
  ['removeProjectMember', ['proj-1', 'mem-1', '']],
  ['getMemberAvailability', ['mem-1', '']],
  ['getEventsByClient', ['client-1', '']],
  ['getEventsByIntegration', ['int-1', '']],
  ['getEventsByProject', ['proj-1', '']],
  ['getEventById', ['evt-1', '']],
  ['getEventsByContactEmail', ['a@b.com', '']],
  ['updateProjectFile', ['file-1', {}, '']],
  ['updateAvailabilityRule', ['rule-1', {}, '']],
  ['deleteAvailabilityRule', ['rule-1', '']],
  ['getProjectForms', ['proj-1', '']],
  ['createProjectForm', [{ projectId: 'proj-1' }, '']],
  ['deleteProjectForm', ['form-1', '']],
];

describe('storage tenant fail-closed guards', () => {
  for (const [method, args] of GUARDED) {
    it(`${method} throws when tenantId is missing`, async () => {
      const fn = (storage as any)[method];
      expect(typeof fn).toBe('function');
      await expect(fn.apply(storage, args)).rejects.toThrow(/requires a tenantId/);
    });
  }
});
