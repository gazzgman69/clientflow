/**
 * Name splitting utility for handling complex name formats
 * Supports hyphenated names, quoted compound names, and multiple middle names
 */

export interface SplitNameResult {
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
}

/**
 * Split a full name into component parts
 * @param fullName The complete name to split
 * @returns Object with fullName, firstName, middleName, lastName
 */
export function splitFullName(fullName: string): SplitNameResult {
  if (!fullName || typeof fullName !== 'string') {
    return {
      fullName: '',
      firstName: '',
      middleName: '',
      lastName: ''
    };
  }

  // Clean the input
  const cleaned = fullName.trim();
  
  if (!cleaned) {
    return {
      fullName: '',
      firstName: '',
      middleName: '',
      lastName: ''
    };
  }

  // Handle quoted names (e.g., "Jean Luc" Picard)
  const quotedPattern = /"([^"]+)"/g;
  const quotedMatches: string[] = [];
  let tempName = cleaned;
  let match;
  
  // Extract quoted parts and replace with placeholders
  while ((match = quotedPattern.exec(cleaned)) !== null) {
    quotedMatches.push(match[1]);
    tempName = tempName.replace(match[0], `__QUOTED_${quotedMatches.length - 1}__`);
  }

  // Split on whitespace
  const parts = tempName.split(/\s+/).filter(part => part.length > 0);
  
  // Restore quoted parts
  const restoredParts = parts.map(part => {
    const quotedMatch = part.match(/__QUOTED_(\d+)__/);
    if (quotedMatch) {
      const index = parseInt(quotedMatch[1]);
      return quotedMatches[index];
    }
    return part;
  });

  if (restoredParts.length === 0) {
    return {
      fullName: cleaned,
      firstName: '',
      middleName: '',
      lastName: ''
    };
  }

  if (restoredParts.length === 1) {
    // Single name - treat as first name
    return {
      fullName: cleaned,
      firstName: restoredParts[0],
      middleName: '',
      lastName: ''
    };
  }

  if (restoredParts.length === 2) {
    // Two names - first and last
    return {
      fullName: cleaned,
      firstName: restoredParts[0],
      middleName: '',
      lastName: restoredParts[1]
    };
  }

  // Three or more names - first, middle(s), last
  const firstName = restoredParts[0];
  const lastName = restoredParts[restoredParts.length - 1];
  const middleParts = restoredParts.slice(1, -1);
  const middleName = middleParts.join(' ');

  return {
    fullName: cleaned,
    firstName,
    middleName,
    lastName
  };
}

/**
 * Combine name parts into a full name
 * @param firstName First name
 * @param middleName Middle name(s)
 * @param lastName Last name
 * @returns Combined full name
 */
export function combineNameParts(firstName: string, middleName: string = '', lastName: string = ''): string {
  const parts = [firstName, middleName, lastName].filter(part => part && part.trim());
  return parts.join(' ').trim();
}

/**
 * Get display name prioritizing fullName, falling back to combined parts
 * @param contact Contact object with name fields
 * @returns Best available display name
 */
export function getDisplayName(contact: { 
  fullName?: string | null; 
  firstName?: string | null; 
  middleName?: string | null; 
  lastName?: string | null; 
}): string {
  // Prefer fullName if available and not empty
  if (contact.fullName && contact.fullName.trim()) {
    return contact.fullName.trim();
  }

  // Fall back to combining individual parts
  return combineNameParts(
    contact.firstName || '',
    contact.middleName || '',
    contact.lastName || ''
  );
}