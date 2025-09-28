import { describe, test, expect } from '@jest/globals';
import { isCamel } from './utils/isCamel';
import request from 'supertest';
import { app } from '../app';

// Test data - simulate authenticated test user session
const testSession = {
  userId: 'test-user-id',
  tenantId: 'default-tenant'
};

describe('API Response Casing', () => {
  test('API responses use camelCase keys', async () => {
    // Test leads summary endpoint (no auth required for summary)
    const res = await request(app)
      .get('/api/leads/summary')
      .set('Cookie', `session=${JSON.stringify(testSession)}`)
      .expect(200);

    const body = res.body;
    const keys = Object.keys(Array.isArray(body) ? body[0] ?? {} : body);
    
    // Log keys for debugging
    console.log('API Response Keys:', keys);
    
    // Check that all top-level keys are camelCase
    const nonCamelKeys = keys.filter(key => !isCamel(key));
    expect(nonCamelKeys).toEqual([]);
    
    // Verify at least some keys exist
    expect(keys.length).toBeGreaterThan(0);
  });

  test('Health endpoint uses camelCase', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    const body = res.body;
    const keys = Object.keys(body);
    
    // All keys should be camelCase
    const nonCamelKeys = keys.filter(key => !isCamel(key));
    expect(nonCamelKeys).toEqual([]);
    
    // Verify expected camelCase keys exist
    expect(keys).toContain('timestamp');
    expect(keys).toContain('uptime'); 
    expect(keys).toContain('version');
  });

  test('Portal auth response uses camelCase', async () => {
    const res = await request(app)
      .post('/api/portal/auth/request-access')
      .send({ email: 'test@example.com' })
      .expect(200);

    const body = res.body;
    const keys = Object.keys(body);
    
    // All keys should be camelCase
    const nonCamelKeys = keys.filter(key => !isCamel(key));
    expect(nonCamelKeys).toEqual([]);
    
    // Verify expected camelCase keys
    expect(keys).toContain('success');
    expect(keys).toContain('message');
  });
});