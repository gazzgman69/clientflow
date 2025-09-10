/**
 * Inserts text at the current cursor position in a textarea or input element
 * and preserves the cursor position after insertion
 */
export function insertTextAtCursor(element: HTMLTextAreaElement | HTMLInputElement, textToInsert: string): void {
  const start = element.selectionStart || 0;
  const end = element.selectionEnd || 0;
  const currentValue = element.value;

  // Insert the text
  const newValue = currentValue.slice(0, start) + textToInsert + currentValue.slice(end);
  element.value = newValue;

  // Set the cursor position after the inserted text
  const newCursorPosition = start + textToInsert.length;
  element.setSelectionRange(newCursorPosition, newCursorPosition);

  // Trigger change event to update React state
  const changeEvent = new Event('change', { bubbles: true });
  element.dispatchEvent(changeEvent);

  // Focus the element
  element.focus();
}

/**
 * React hook-compatible version that works with React state
 */
export function insertTokenIntoValue(
  currentValue: string, 
  token: string, 
  cursorPosition: number = currentValue.length
): { newValue: string; newCursorPosition: number } {
  const newValue = currentValue.slice(0, cursorPosition) + token + currentValue.slice(cursorPosition);
  const newCursorPosition = cursorPosition + token.length;
  
  return { newValue, newCursorPosition };
}