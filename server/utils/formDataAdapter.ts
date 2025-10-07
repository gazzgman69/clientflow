/**
 * Form Data Adapter
 * 
 * Maps incoming Lead Capture payloads from either numeric keys ("1","2","3")
 * or q-style keys ("q1","q2","q_123...") to the form's canonical question IDs.
 * 
 * This adapter provides a tolerant lookup layer that:
 * - Treats numeric "1" as equivalent to "q1" based on orderIndex
 * - Preserves full IDs like "q_1758575106312"
 * - Routes unmapped keys to customFieldData[]
 */

interface Question {
  id: string;
  mapTo?: string;
  orderIndex: number;
  label?: string;
  type?: string;
  required?: boolean;
}

interface AdapterResult {
  mappedData: Record<string, any>;
  unmappedKeys: string[];
  translatedKeys: Array<{ from: string; to: string }>;
}

/**
 * Adapt incoming form data keys to match question IDs
 * 
 * @param formData - Raw form submission data (may have numeric or q-style keys)
 * @param questions - Array of form questions from database
 * @returns Adapted data with proper question IDs as keys
 */
export function adaptFormDataKeys(
  formData: Record<string, any>,
  questions: Question[]
): AdapterResult {
  const mappedData: Record<string, any> = {};
  const unmappedKeys: string[] = [];
  const translatedKeys: Array<{ from: string; to: string }> = [];

  // Build lookup maps for efficient resolution
  const questionById = new Map<string, Question>();
  const questionByOrderIndex = new Map<number, Question>();
  
  for (const question of questions) {
    questionById.set(question.id, question);
    questionByOrderIndex.set(question.orderIndex, question);
  }

  // Process each incoming key
  for (const [key, value] of Object.entries(formData)) {
    let resolvedQuestionId: string | null = null;

    // Strategy 1: Direct match (e.g., "q1", "q_1758575106312")
    if (questionById.has(key)) {
      resolvedQuestionId = key;
    }
    // Strategy 2: Numeric key - map to question by orderIndex
    else if (/^\d+$/.test(key)) {
      const numericKey = parseInt(key, 10);
      
      // Try 1-indexed (most common: "1" → orderIndex 0)
      const question1Indexed = questionByOrderIndex.get(numericKey - 1);
      if (question1Indexed) {
        resolvedQuestionId = question1Indexed.id;
        translatedKeys.push({ from: key, to: resolvedQuestionId });
      }
      // Try 0-indexed (less common: "0" → orderIndex 0)
      else {
        const question0Indexed = questionByOrderIndex.get(numericKey);
        if (question0Indexed) {
          resolvedQuestionId = question0Indexed.id;
          translatedKeys.push({ from: key, to: resolvedQuestionId });
        }
      }
    }
    // Strategy 3: Short q-style without number (e.g., "q" + number)
    // This handles potential "q" prefix variations
    else if (key.startsWith('q') && key.length > 1) {
      // Already handled by Strategy 1, but keep for completeness
      if (questionById.has(key)) {
        resolvedQuestionId = key;
      }
    }

    // Store result
    if (resolvedQuestionId) {
      mappedData[resolvedQuestionId] = value;
    } else {
      unmappedKeys.push(key);
      mappedData[key] = value; // Keep original for customFieldData
    }
  }

  return {
    mappedData,
    unmappedKeys,
    translatedKeys
  };
}

/**
 * Validate that required canonical fields are present after mapping
 * 
 * @param transformedData - Data after transformation to canonical fields
 * @param questions - Form questions to check requirements
 * @returns Validation result with missing fields
 */
export function validateRequiredFields(
  transformedData: Record<string, any>,
  questions: Question[]
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  // Check for required canonical fields
  // leadEmail is always required for lead creation
  if (!transformedData.leadEmail && !transformedData.email) {
    missingFields.push('leadEmail (Email Address)');
  }

  // Check other required questions
  for (const question of questions) {
    if (question.required && question.mapTo && question.mapTo !== 'nothing') {
      const canonicalValue = transformedData[question.mapTo];
      if (!canonicalValue || (typeof canonicalValue === 'string' && canonicalValue.trim() === '')) {
        missingFields.push(`${question.mapTo} (${question.label || question.id})`);
      }
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Parse and normalize date from multiple formats
 * Accepts: dd/mm/yyyy, yyyy-mm-dd, ISO strings
 * Returns: ISO string for database storage
 */
export function normalizeDateInput(dateValue: string | Date): string | null {
  if (!dateValue) return null;

  try {
    // If already a Date object
    if (dateValue instanceof Date) {
      return dateValue.toISOString();
    }

    const dateStr = String(dateValue).trim();

    // Pattern 1: dd/mm/yyyy
    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Pattern 2: yyyy-mm-dd or ISO format
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    return null;
  } catch (error) {
    console.error('Date normalization error:', error);
    return null;
  }
}

/**
 * Format date for display (dd/mm/yyyy)
 */
export function formatDateForDisplay(date: Date | string | null): string | null {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (error) {
    return null;
  }
}

/**
 * Format datetime for display (dd/mm/yyyy HH:mm)
 */
export function formatDateTimeForDisplay(date: Date | string | null): string | null {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    return null;
  }
}
