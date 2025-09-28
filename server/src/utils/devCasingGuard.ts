/**
 * Development-only runtime guard for API response casing
 * Warns if response keys are not camelCase (logs once per route)
 */

const warnedRoutes = new Set<string>();

/**
 * Check if a string follows camelCase convention
 */
function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Recursively check object for non-camelCase keys
 */
function findNonCamelKeys(obj: any, path: string = ''): string[] {
  const violations: string[] = [];
  
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      if (!isCamelCase(key)) {
        violations.push(fullPath);
      }
      
      // Recursively check nested objects
      if (value && typeof value === 'object') {
        violations.push(...findNonCamelKeys(value, fullPath));
      }
    }
  } else if (Array.isArray(obj)) {
    // Check first item in arrays
    if (obj.length > 0) {
      violations.push(...findNonCamelKeys(obj[0], path));
    }
  }
  
  return violations;
}

/**
 * Development guard for API response casing
 * Only active in development environment
 */
export function validateResponseCasing(route: string, responseBody: any): void {
  // Only run in development
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  // Skip if already warned for this route
  if (warnedRoutes.has(route)) {
    return;
  }
  
  try {
    const violations = findNonCamelKeys(responseBody);
    
    if (violations.length > 0) {
      console.warn(`⚠️  DEV CASING GUARD: Non-camelCase keys found in ${route}:`);
      violations.forEach(key => console.warn(`   - ${key}`));
      console.warn('   Consider updating API response to use camelCase keys');
      
      // Mark as warned to avoid spam
      warnedRoutes.add(route);
    }
  } catch (error) {
    // Silently fail in production, log in development
    console.warn(`Dev casing guard error for ${route}:`, error);
  }
}