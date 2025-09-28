/**
 * Check if a string follows camelCase convention
 * @param k - The string to check
 * @returns true if the string is camelCase, false otherwise
 */
export const isCamel = (k: string): boolean => {
  // camelCase pattern: starts with lowercase, followed by letters/numbers
  // No underscores or hyphens allowed
  return /^[a-z][a-zA-Z0-9]*$/.test(k);
};