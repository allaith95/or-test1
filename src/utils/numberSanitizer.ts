import React from 'react';

/**
 * Utility functions to enforce strictly numbers-only / digits-only input
 * and convert Eastern Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to standard Western digits.
 */

// Eastern Arabic digits map
const ARABIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

/**
 * Converts any Eastern Arabic digits (٠-٩) into Western digits (0-9).
 */
export function normalizeDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[٠-٩]/g, (char) => ARABIC_DIGITS_MAP[char] ?? char);
}

/**
 * Sanitizes phone number or contact string:
 * - Converts Arabic digits to English digits
 * - Allows leading '+' if present and allowed
 * - Strictly removes all letters (Arabic, Latin, etc.), spaces, symbols, and special characters
 */
export function sanitizePhone(value: string, allowLeadingPlus = true): string {
  if (!value) return '';
  const normalized = normalizeDigits(value);
  const trimmed = normalized.trim();
  const startsWithPlus = allowLeadingPlus && trimmed.startsWith('+');
  // Strip all non-digits
  const digitsOnly = trimmed.replace(/\D/g, '');
  return startsWithPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Sanitizes integer / count / quantity string (e.g. piece count, national ID, items count):
 * - Converts Arabic digits
 * - Strictly strips out everything except digits 0-9 (no letters, no negative sign, no decimals)
 */
export function sanitizeDigitsOnly(value: string): string {
  if (!value) return '';
  return normalizeDigits(value).replace(/\D/g, '');
}

/**
 * Sanitizes decimal / financial amount / weight / dimension string:
 * - Converts Arabic digits
 * - Distinguishes between thousands separators (e.g. 1,000,000) and decimal separators (e.g. 15.5 or 15٫5)
 * - Converts Arabic comma (،) or Arabic decimal separator (٫) to dot (.)
 * - Removes any letters, symbols, or invalid characters
 * - Ensures at most ONE decimal point
 */
export function sanitizeDecimal(value: string): string {
  if (!value) return '';
  let clean = normalizeDigits(value).trim();

  // If input contains Arabic decimal separator or Arabic comma
  const hasArabicComma = clean.includes('،') || clean.includes('٫');
  if (hasArabicComma) {
    clean = clean.replace(/[،٫]/g, '.');
  }

  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');

  if (hasComma && hasDot) {
    // Check which one is the last separator
    if (clean.lastIndexOf(',') < clean.lastIndexOf('.')) {
      // e.g. 1,500,000.50 -> strip commas, keep dot
      clean = clean.replace(/,/g, '');
    } else {
      // e.g. 1.500.000,50 -> strip dots, replace comma with dot
      clean = clean.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (hasComma) {
    const commaParts = clean.split(',');
    // If there are multiple commas (1,000,000) or comma is followed by 3 digits, it's thousands separator
    if (commaParts.length > 2 || (commaParts.length === 2 && commaParts[1].length === 3)) {
      clean = clean.replace(/,/g, '');
    } else {
      // Single comma used as decimal separator (e.g. 12,5)
      clean = clean.replace(/,/g, '.');
    }
  }

  // Remove all characters except digits and dot
  clean = clean.replace(/[^\d.]/g, '');

  // Keep only the first decimal point if multiple exist
  const parts = clean.split('.');
  if (parts.length > 2) {
    clean = parts[0] + '.' + parts.slice(1).join('');
  }
  return clean;
}

/**
 * Keyboard event handler that blocks any key that is not a digit or allowed control/action key.
 * Strictly prevents typing letters (Arabic or English), exponent keys ('e', 'E'), plus/minus (unless allowed).
 */
export function blockNonNumericKeys(
  e: React.KeyboardEvent<HTMLInputElement>,
  options?: {
    allowDecimal?: boolean;
    allowNegative?: boolean;
    allowLeadingPlus?: boolean;
  }
) {
  const { allowDecimal = false, allowNegative = false, allowLeadingPlus = false } = options || {};

  // Always allow standard control keys and keyboard shortcuts
  const controlKeys = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
  ];

  if (
    controlKeys.includes(e.key) ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  ) {
    return;
  }

  // Allow digits (both standard 0-9 and Arabic ٠-٩)
  if (/^[0-9٠-٩]$/.test(e.key)) {
    return;
  }

  // Allow decimal point if configured
  if (allowDecimal && (e.key === '.' || e.key === ',' || e.key === '،' || e.key === '٫')) {
    const currentValue = e.currentTarget.value || '';
    if (!currentValue.includes('.') && !currentValue.includes(',') && !currentValue.includes('٫')) {
      return;
    }
  }

  // Allow leading plus for phone
  if (allowLeadingPlus && e.key === '+') {
    const input = e.currentTarget;
    if (input.selectionStart === 0 && !input.value.includes('+')) {
      return;
    }
  }

  // Allow negative sign if explicitly permitted
  if (allowNegative && e.key === '-') {
    const input = e.currentTarget;
    if (input.selectionStart === 0 && !input.value.includes('-')) {
      return;
    }
  }

  // Block everything else: letters (Arabic/English), special characters, spaces, etc.
  e.preventDefault();
}

/**
 * Convenience helper for phone/contact input key blocking
 */
export function blockNonPhoneKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  blockNonNumericKeys(e, { allowLeadingPlus: true });
}

/**
 * Convenience helper for integer / count / quantity key blocking
 */
export function blockNonIntegerKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  blockNonNumericKeys(e, { allowDecimal: false });
}

/**
 * Convenience helper for money amounts / weights / dimensions key blocking
 */
export function blockNonAmountKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  blockNonNumericKeys(e, { allowDecimal: true });
}
