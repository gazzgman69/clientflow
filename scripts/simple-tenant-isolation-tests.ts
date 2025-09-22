#!/usr/bin/env tsx
/**
 * SIMPLIFIED TENANT ISOLATION SECURITY TESTS
 * 
 * Tests critical tenant isolation security using existing data in the system.
 * This script verifies that multi-tenancy security boundaries are properly enforced.
 * 
 * Usage: npx tsx scripts/simple-tenant-isolation-tests.ts
 */

import { storage } from '../server/storage';
import { db } from '../server/db';
import { sql, eq } from 'drizzle-orm';
import { 
  users, contacts, leads, projects, quotes, contracts, tasks, 
  emails, activities, calendarIntegrations, templates, leadCaptureForms,
  tenants 
} from '@shared/schema';

interface TestResult {
  test: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
  message: string;
  details?: any;
  securityImpact?: 'HIGH' | 'MEDIUM' | 'LOW';
}

class SimpleTenantIsolationTester {
  private results: TestResult[] = [];
  private defaultTenantId: string = '';
  private acmeTenantId: string = '';

  constructor() {
    console.log('🔐 TENANT ISOLATION SECURITY TESTER');
    console.log('====================================\n');
  }

  private addResult(result: TestResult) {
    this.results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'WARNING' ? '⚠️' : 'ℹ️';
    const impact = result.securityImpact ? ` [${result.securityImpact} RISK]` : '';
    console.log(`${icon} ${result.category}: ${result.test}${impact}`);
    if (result.message) {
      console.log(`   ${result.message}`);
    }
    console.log('');
  }

  async initializeTenants(): Promise<void> {
    console.log('🏢 Initializing tenant context...\n');

    try {
      const defaultTenant = await storage.getTenantBySlug('default');
      const acmeTenant = await storage.getTenantBySlug('acme-corp');
      
      if (!defaultTenant || !acmeTenant) {
        throw new Error('Required test tenants not found. Need default and acme-corp tenants.');
      }

      this.defaultTenantId = defaultTenant.id;
      this.acmeTenantId = acmeTenant.id;

      this.addResult({
        test: 'Tenant Context Initialization',
        category: 'SETUP',
        status: 'INFO',
        message: `Default Tenant: ${defaultTenant.name} (${this.defaultTenantId}), Acme Tenant: ${acmeTenant.name} (${this.acmeTenantId})`
      });

    } catch (error) {
      this.addResult({
        test: 'Tenant Context Initialization',
        category: 'SETUP',
        status: 'FAIL',
        message: `Failed to initialize tenants: ${error}`,
        securityImpact: 'HIGH'
      });
      throw error;
    }
  }

  // Test 1: Database-Level Tenant Data Assignment
  async testDatabaseTenantDataAssignment(): Promise<void> {
    console.log('🗃️  Testing Database-Level Tenant Data Assignment...\n');

    try {
      // Check users table
      const usersWithoutTenant = await db.select().from(users).where(sql`tenant_id IS NULL`);
      this.addResult({
        test: 'Users Table Tenant Assignment',
        category: 'DATABASE SECURITY',
        status: usersWithoutTenant.length === 0 ? 'PASS' : 'WARNING',
        message: `${usersWithoutTenant.length} users without tenant assignment found`,
        details: usersWithoutTenant.map(u => ({id: u.id, email: u.email})),
        securityImpact: usersWithoutTenant.length > 0 ? 'HIGH' : 'LOW'
      });

      // Check contacts table
      const contactsWithoutTenant = await db.select().from(contacts).where(sql`tenant_id IS NULL`);
      this.addResult({
        test: 'Contacts Table Tenant Assignment', 
        category: 'DATABASE SECURITY',
        status: contactsWithoutTenant.length === 0 ? 'PASS' : 'WARNING',
        message: `${contactsWithoutTenant.length} contacts without tenant assignment found`,
        securityImpact: contactsWithoutTenant.length > 0 ? 'HIGH' : 'LOW'
      });

      // Check leads table
      const leadsWithoutTenant = await db.select().from(leads).where(sql`tenant_id IS NULL`);
      this.addResult({
        test: 'Leads Table Tenant Assignment',
        category: 'DATABASE SECURITY',
        status: leadsWithoutTenant.length === 0 ? 'PASS' : 'WARNING',
        message: `${leadsWithoutTenant.length} leads without tenant assignment found`,
        securityImpact: leadsWithoutTenant.length > 0 ? 'HIGH' : 'LOW'
      });

      // Check projects table
      const projectsWithoutTenant = await db.select().from(projects).where(sql`tenant_id IS NULL`);
      this.addResult({
        test: 'Projects Table Tenant Assignment',
        category: 'DATABASE SECURITY',
        status: projectsWithoutTenant.length === 0 ? 'PASS' : 'WARNING',
        message: `${projectsWithoutTenant.length} projects without tenant assignment found`,
        securityImpact: projectsWithoutTenant.length > 0 ? 'HIGH' : 'LOW'
      });

    } catch (error) {
      this.addResult({
        test: 'Database-Level Tenant Data Assignment',
        category: 'DATABASE SECURITY',
        status: 'FAIL',
        message: `Database queries failed: ${error}`,
        securityImpact: 'HIGH'
      });
    }
  }

  // Test 2: Storage Method Tenant Isolation
  async testStorageMethodTenantIsolation(): Promise<void> {
    console.log('🗄️  Testing Storage Method Tenant Isolation...\n');

    try {
      // Test that different tenants get different data sets
      const defaultContacts = await storage.getContacts(this.defaultTenantId);
      const acmeContacts = await storage.getContacts(this.acmeTenantId);

      this.addResult({
        test: 'Contacts Tenant Isolation',
        category: 'STORAGE SECURITY',
        status: 'INFO',
        message: `Default tenant: ${defaultContacts.length} contacts, Acme tenant: ${acmeContacts.length} contacts`,
        details: {
          defaultTenantContacts: defaultContacts.map(c => ({id: c.id, tenantId: c.tenantId, email: c.email})),
          acmeTenantContacts: acmeContacts.map(c => ({id: c.id, tenantId: c.tenantId, email: c.email}))
        }
      });

      // Verify all returned data belongs to the correct tenant
      const defaultContactsValid = defaultContacts.every(c => c.tenantId === this.defaultTenantId);
      const acmeContactsValid = acmeContacts.every(c => c.tenantId === this.acmeTenantId);

      this.addResult({
        test: 'Contacts Tenant Filtering Accuracy',
        category: 'STORAGE SECURITY', 
        status: (defaultContactsValid && acmeContactsValid) ? 'PASS' : 'FAIL',
        message: defaultContactsValid && acmeContactsValid ? 'All contacts properly filtered by tenant' : 'SECURITY VIOLATION: Cross-tenant data found in results!',
        securityImpact: (defaultContactsValid && acmeContactsValid) ? 'LOW' : 'HIGH'
      });

      // Test leads isolation
      const defaultLeads = await storage.getLeads(this.defaultTenantId);
      const acmeLeads = await storage.getLeads(this.acmeTenantId);

      this.addResult({
        test: 'Leads Tenant Isolation',
        category: 'STORAGE SECURITY',
        status: 'INFO', 
        message: `Default tenant: ${defaultLeads.length} leads, Acme tenant: ${acmeLeads.length} leads`
      });

      const defaultLeadsValid = defaultLeads.every(l => l.tenantId === this.defaultTenantId);
      const acmeLeadsValid = acmeLeads.every(l => l.tenantId === this.acmeTenantId);

      this.addResult({
        test: 'Leads Tenant Filtering Accuracy',
        category: 'STORAGE SECURITY',
        status: (defaultLeadsValid && acmeLeadsValid) ? 'PASS' : 'FAIL',
        message: defaultLeadsValid && acmeLeadsValid ? 'All leads properly filtered by tenant' : 'SECURITY VIOLATION: Cross-tenant lead data found!',
        securityImpact: (defaultLeadsValid && acmeLeadsValid) ? 'LOW' : 'HIGH'
      });

      // Test projects isolation
      const defaultProjects = await storage.getProjects(this.defaultTenantId);
      const acmeProjects = await storage.getProjects(this.acmeTenantId);

      this.addResult({
        test: 'Projects Tenant Isolation',
        category: 'STORAGE SECURITY',
        status: 'INFO',
        message: `Default tenant: ${defaultProjects.length} projects, Acme tenant: ${acmeProjects.length} projects`
      });

      const defaultProjectsValid = defaultProjects.every(p => p.tenantId === this.defaultTenantId);
      const acmeProjectsValid = acmeProjects.every(p => p.tenantId === this.acmeTenantId);

      this.addResult({
        test: 'Projects Tenant Filtering Accuracy',
        category: 'STORAGE SECURITY',
        status: (defaultProjectsValid && acmeProjectsValid) ? 'PASS' : 'FAIL',
        message: defaultProjectsValid && acmeProjectsValid ? 'All projects properly filtered by tenant' : 'SECURITY VIOLATION: Cross-tenant project data found!',
        securityImpact: (defaultProjectsValid && acmeProjectsValid) ? 'LOW' : 'HIGH'
      });

    } catch (error) {
      this.addResult({
        test: 'Storage Method Tenant Isolation',
        category: 'STORAGE SECURITY',
        status: 'FAIL',
        message: `Storage isolation testing failed: ${error}`,
        securityImpact: 'HIGH'
      });
    }
  }

  // Test 3: Cross-Tenant Data Access Prevention
  async testCrossTenantDataAccessPrevention(): Promise<void> {
    console.log('🛡️  Testing Cross-Tenant Data Access Prevention...\n');

    try {
      // Get some data from default tenant
      const defaultContacts = await storage.getContacts(this.defaultTenantId);
      
      if (defaultContacts.length > 0) {
        // Try to access default tenant's contact using acme tenant context
        const crossTenantAccess = await storage.getContact(defaultContacts[0].id, this.acmeTenantId);
        
        this.addResult({
          test: 'Cross-Tenant Contact Access Prevention',
          category: 'ACCESS CONTROL',
          status: crossTenantAccess === undefined ? 'PASS' : 'FAIL',
          message: crossTenantAccess ? 'CRITICAL SECURITY VIOLATION: Cross-tenant data access allowed!' : 'Cross-tenant access properly blocked',
          details: crossTenantAccess ? {
            contactId: defaultContacts[0].id,
            originalTenant: this.defaultTenantId,
            accessingTenant: this.acmeTenantId,
            unauthorizedData: crossTenantAccess
          } : undefined,
          securityImpact: crossTenantAccess ? 'HIGH' : 'LOW'
        });
      } else {
        this.addResult({
          test: 'Cross-Tenant Contact Access Prevention',
          category: 'ACCESS CONTROL',
          status: 'WARNING',
          message: 'No contacts found in default tenant to test cross-tenant access',
          securityImpact: 'LOW'
        });
      }

      // Test with projects if they exist
      const defaultProjects = await storage.getProjects(this.defaultTenantId);
      
      if (defaultProjects.length > 0) {
        const crossTenantProjectAccess = await storage.getProject(defaultProjects[0].id, this.acmeTenantId);
        
        this.addResult({
          test: 'Cross-Tenant Project Access Prevention',
          category: 'ACCESS CONTROL',
          status: crossTenantProjectAccess === undefined ? 'PASS' : 'FAIL',
          message: crossTenantProjectAccess ? 'CRITICAL SECURITY VIOLATION: Cross-tenant project access allowed!' : 'Cross-tenant project access properly blocked',
          securityImpact: crossTenantProjectAccess ? 'HIGH' : 'LOW'
        });
      } else {
        this.addResult({
          test: 'Cross-Tenant Project Access Prevention',
          category: 'ACCESS CONTROL',
          status: 'WARNING',
          message: 'No projects found in default tenant to test cross-tenant access',
          securityImpact: 'LOW'
        });
      }

    } catch (error) {
      this.addResult({
        test: 'Cross-Tenant Data Access Prevention',
        category: 'ACCESS CONTROL',
        status: 'FAIL',
        message: `Cross-tenant access testing failed: ${error}`,
        securityImpact: 'HIGH'
      });
    }
  }

  // Test 4: TenantScopedStorage Wrapper Security
  async testTenantScopedStorageWrapper(): Promise<void> {
    console.log('🔒 Testing TenantScopedStorage Wrapper Security...\n');

    try {
      // Test that scoped storage only returns tenant-specific data
      const defaultScopedStorage = storage.withTenant(this.defaultTenantId);
      const acmeScopedStorage = storage.withTenant(this.acmeTenantId);

      const defaultScopedContacts = await defaultScopedStorage.getContacts();
      const acmeScopedContacts = await acmeScopedStorage.getContacts();

      this.addResult({
        test: 'TenantScopedStorage Data Isolation',
        category: 'SCOPED STORAGE',
        status: 'INFO',
        message: `Default scoped: ${defaultScopedContacts.length} contacts, Acme scoped: ${acmeScopedContacts.length} contacts`
      });

      // Verify all data from scoped storage belongs to the correct tenant
      const defaultScopedValid = defaultScopedContacts.every(c => c.tenantId === this.defaultTenantId);
      const acmeScopedValid = acmeScopedContacts.every(c => c.tenantId === this.acmeTenantId);

      this.addResult({
        test: 'TenantScopedStorage Filtering Accuracy',
        category: 'SCOPED STORAGE',
        status: (defaultScopedValid && acmeScopedValid) ? 'PASS' : 'FAIL',
        message: (defaultScopedValid && acmeScopedValid) ? 'Scoped storage properly isolates tenant data' : 'SECURITY VIOLATION: Scoped storage returning cross-tenant data!',
        securityImpact: (defaultScopedValid && acmeScopedValid) ? 'LOW' : 'HIGH'
      });

      // Test invalid tenant ID handling
      try {
        const invalidScopedStorage = storage.withTenant('');
        this.addResult({
          test: 'Invalid Tenant ID Rejection',
          category: 'SCOPED STORAGE',
          status: 'FAIL',
          message: 'SECURITY ISSUE: Empty tenant ID was accepted by scoped storage',
          securityImpact: 'HIGH'
        });
      } catch (error) {
        this.addResult({
          test: 'Invalid Tenant ID Rejection',
          category: 'SCOPED STORAGE',
          status: 'PASS',
          message: 'Scoped storage properly rejects invalid tenant IDs',
          securityImpact: 'LOW'
        });
      }

    } catch (error) {
      this.addResult({
        test: 'TenantScopedStorage Wrapper Security',
        category: 'SCOPED STORAGE',
        status: 'FAIL',
        message: `Scoped storage testing failed: ${error}`,
        securityImpact: 'HIGH'
      });
    }
  }

  // Test 5: User Authentication Tenant Boundaries
  async testUserAuthenticationTenantBoundaries(): Promise<void> {
    console.log('👤 Testing User Authentication Tenant Boundaries...\n');

    try {
      // Get users from each tenant
      const defaultUsers = await storage.getUsers(this.defaultTenantId);
      const acmeUsers = await storage.getUsers(this.acmeTenantId);

      this.addResult({
        test: 'Users Tenant Isolation',
        category: 'USER AUTHENTICATION',
        status: 'INFO',
        message: `Default tenant: ${defaultUsers.length} users, Acme tenant: ${acmeUsers.length} users`,
        details: {
          defaultUsers: defaultUsers.map(u => ({id: u.id, email: u.email, tenantId: u.tenantId})),
          acmeUsers: acmeUsers.map(u => ({id: u.id, email: u.email, tenantId: u.tenantId}))
        }
      });

      // Verify users belong to correct tenants
      const defaultUsersValid = defaultUsers.every(u => u.tenantId === this.defaultTenantId);
      const acmeUsersValid = acmeUsers.every(u => u.tenantId === this.acmeTenantId);

      this.addResult({
        test: 'Users Tenant Assignment Accuracy',
        category: 'USER AUTHENTICATION',
        status: (defaultUsersValid && acmeUsersValid) ? 'PASS' : 'FAIL',
        message: (defaultUsersValid && acmeUsersValid) ? 'All users properly assigned to correct tenants' : 'SECURITY VIOLATION: Users found with incorrect tenant assignments!',
        securityImpact: (defaultUsersValid && acmeUsersValid) ? 'LOW' : 'HIGH'
      });

      // Test cross-tenant user lookup prevention
      if (defaultUsers.length > 0 && acmeUsers.length > 0) {
        const defaultUser = defaultUsers[0];
        const crossTenantUserLookup = await storage.getUserByUsername(defaultUser.username, this.acmeTenantId);

        this.addResult({
          test: 'Cross-Tenant User Lookup Prevention',
          category: 'USER AUTHENTICATION',
          status: crossTenantUserLookup === undefined ? 'PASS' : 'FAIL',
          message: crossTenantUserLookup ? 'SECURITY VIOLATION: Cross-tenant user lookup allowed!' : 'Cross-tenant user lookup properly blocked',
          securityImpact: crossTenantUserLookup ? 'HIGH' : 'LOW'
        });
      }

    } catch (error) {
      this.addResult({
        test: 'User Authentication Tenant Boundaries',
        category: 'USER AUTHENTICATION',
        status: 'FAIL',
        message: `User authentication testing failed: ${error}`,
        securityImpact: 'HIGH'
      });
    }
  }

  // Test 6: Calendar Integration Tenant Scoping
  async testCalendarIntegrationTenantScoping(): Promise<void> {
    console.log('📅 Testing Calendar Integration Tenant Scoping...\n');

    try {
      const defaultCalendarIntegrations = await storage.getCalendarIntegrations(this.defaultTenantId);
      const acmeCalendarIntegrations = await storage.getCalendarIntegrations(this.acmeTenantId);

      this.addResult({
        test: 'Calendar Integrations Tenant Isolation',
        category: 'OAUTH SECURITY',
        status: 'INFO',
        message: `Default tenant: ${defaultCalendarIntegrations.length} integrations, Acme tenant: ${acmeCalendarIntegrations.length} integrations`
      });

      // Verify calendar integrations belong to correct tenants
      const defaultIntegrationsValid = defaultCalendarIntegrations.every(ci => ci.tenantId === this.defaultTenantId);
      const acmeIntegrationsValid = acmeCalendarIntegrations.every(ci => ci.tenantId === this.acmeTenantId);

      this.addResult({
        test: 'Calendar Integrations Tenant Assignment',
        category: 'OAUTH SECURITY',
        status: (defaultIntegrationsValid && acmeIntegrationsValid) ? 'PASS' : 'FAIL',
        message: (defaultIntegrationsValid && acmeIntegrationsValid) ? 'Calendar integrations properly isolated by tenant' : 'SECURITY VIOLATION: Calendar integrations have incorrect tenant assignments!',
        securityImpact: (defaultIntegrationsValid && acmeIntegrationsValid) ? 'LOW' : 'HIGH'
      });

      // Test cross-tenant calendar integration access
      if (defaultCalendarIntegrations.length > 0) {
        const crossTenantCalendarAccess = await storage.getCalendarIntegration(defaultCalendarIntegrations[0].id, this.acmeTenantId);
        
        this.addResult({
          test: 'Cross-Tenant Calendar Integration Access Prevention',
          category: 'OAUTH SECURITY',
          status: crossTenantCalendarAccess === undefined ? 'PASS' : 'FAIL',
          message: crossTenantCalendarAccess ? 'SECURITY VIOLATION: Cross-tenant calendar integration access allowed!' : 'Cross-tenant calendar access properly blocked',
          securityImpact: crossTenantCalendarAccess ? 'HIGH' : 'LOW'
        });
      } else {
        this.addResult({
          test: 'Cross-Tenant Calendar Integration Access Prevention',
          category: 'OAUTH SECURITY',
          status: 'WARNING',
          message: 'No calendar integrations found to test cross-tenant access',
          securityImpact: 'LOW'
        });
      }

    } catch (error) {
      this.addResult({
        test: 'Calendar Integration Tenant Scoping',
        category: 'OAUTH SECURITY',
        status: 'FAIL',
        message: `Calendar integration testing failed: ${error}`,
        securityImpact: 'MEDIUM'
      });
    }
  }

  private generateSecurityReport(): void {
    console.log('\n🔐 TENANT ISOLATION SECURITY REPORT');
    console.log('=====================================\n');

    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const info = this.results.filter(r => r.status === 'INFO').length;

    const highRiskIssues = this.results.filter(r => r.securityImpact === 'HIGH' && r.status !== 'PASS').length;
    const mediumRiskIssues = this.results.filter(r => r.securityImpact === 'MEDIUM' && r.status !== 'PASS').length;

    console.log(`📊 SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️  Warnings: ${warnings}`);
    console.log(`   ℹ️  Info: ${info}`);
    console.log(`   🚨 High Risk Issues: ${highRiskIssues}`);
    console.log(`   🔶 Medium Risk Issues: ${mediumRiskIssues}\n`);

    if (failed > 0 || highRiskIssues > 0) {
      console.log(`🚨 CRITICAL SECURITY ISSUES FOUND:`);
      this.results
        .filter(r => r.status === 'FAIL' || (r.securityImpact === 'HIGH' && r.status !== 'PASS'))
        .forEach(r => {
          console.log(`   ❌ ${r.category}: ${r.test}`);
          console.log(`      ${r.message}`);
          if (r.securityImpact) console.log(`      Risk Level: ${r.securityImpact}`);
          console.log('');
        });
    }

    if (warnings > 0) {
      console.log(`⚠️  WARNINGS THAT NEED ATTENTION:`);
      this.results
        .filter(r => r.status === 'WARNING')
        .forEach(r => {
          console.log(`   ⚠️  ${r.category}: ${r.test}`);
          console.log(`      ${r.message}`);
          console.log('');
        });
    }

    // Overall security assessment
    const testableResults = this.results.filter(r => r.status !== 'INFO');
    const securityScore = testableResults.length > 0 ? Math.round((passed / testableResults.length) * 100) : 0;
    console.log(`🎯 OVERALL SECURITY SCORE: ${securityScore}%\n`);

    if (securityScore >= 95 && highRiskIssues === 0) {
      console.log(`✅ TENANT ISOLATION: SECURE`);
      console.log(`   Multi-tenancy implementation appears secure with excellent isolation.`);
    } else if (securityScore >= 85 && highRiskIssues === 0) {
      console.log(`🔶 TENANT ISOLATION: MOSTLY SECURE`);
      console.log(`   Multi-tenancy implementation is secure but has some areas for improvement.`);
    } else if (highRiskIssues === 0) {
      console.log(`⚠️  TENANT ISOLATION: NEEDS IMPROVEMENT`);
      console.log(`   Multi-tenancy implementation has security concerns that should be addressed.`);
    } else {
      console.log(`🚨 TENANT ISOLATION: SECURITY VULNERABILITIES FOUND`);
      console.log(`   CRITICAL: High-risk security issues detected! Immediate attention required.`);
    }

    console.log('\n=====================================');
  }

  async runAllTests(): Promise<void> {
    try {
      await this.initializeTenants();
      await this.testDatabaseTenantDataAssignment();
      await this.testStorageMethodTenantIsolation();
      await this.testCrossTenantDataAccessPrevention();
      await this.testTenantScopedStorageWrapper();
      await this.testUserAuthenticationTenantBoundaries();
      await this.testCalendarIntegrationTenantScoping();

      this.generateSecurityReport();

    } catch (error) {
      console.error('❌ Critical error during tenant isolation testing:', error);
      this.addResult({
        test: 'Test Suite Execution',
        category: 'SYSTEM ERROR',
        status: 'FAIL',
        message: `Testing suite failed: ${error}`,
        securityImpact: 'HIGH'
      });
      this.generateSecurityReport();
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const tester = new SimpleTenantIsolationTester();
  await tester.runAllTests();
  process.exit(0);
}

// Check if this file is being run directly
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default SimpleTenantIsolationTester;