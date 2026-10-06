/**
 * Simplified & Robust Birth Date Utility
 * 
 * Features:
 * 1. Automatic conversion of Arabic/Eastern numerals (٠١٢٣٤٥٦٧٨٩ -> 0123456789).
 * 2. Seamless parsing of any format (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DDMMYYYY).
 * 3. Non-intrusive typing without cursor hijacking or auto-inserted slashes that block backspace.
 * 4. Clean normalization to ISO (YYYY-MM-DD) and Display (DD/MM/YYYY).
 */

export function toLatinDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

/**
 * Normalizes any raw birth date string into standard DMY (DD/MM/YYYY) and ISO (YYYY-MM-DD)
 */
export function normalizeDateString(raw: string): { dmy: string; iso: string } {
  if (!raw || !raw.trim()) return { dmy: '', iso: '' };

  const latin = toLatinDigits(raw.trim());

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = latin.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2099) {
      const padM = String(m).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      return { dmy: `${padD}/${padM}/${y}`, iso: `${y}-${padM}-${padD}` };
    }
  }

  // 2. DMY format: DD/MM/YYYY or DD-MM-YYYY or D/M/YYYY
  const dmyMatch = latin.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2099) {
      const padD = String(d).padStart(2, '0');
      const padM = String(m).padStart(2, '0');
      return { dmy: `${padD}/${padM}/${y}`, iso: `${y}-${padM}-${padD}` };
    }
  }

  // 3. Continuous 8 digits e.g. 15081990 (DDMMYYYY) or 19900815 (YYYYMMDD)
  const pureDigits = latin.replace(/\D/g, '');
  if (pureDigits.length === 8) {
    // If starts with YYYY (19xx or 20xx)
    if (pureDigits.startsWith('19') || pureDigits.startsWith('20')) {
      const y = parseInt(pureDigits.slice(0, 4), 10);
      const m = parseInt(pureDigits.slice(4, 6), 10);
      const d = parseInt(pureDigits.slice(6, 8), 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const padM = String(m).padStart(2, '0');
        const padD = String(d).padStart(2, '0');
        return { dmy: `${padD}/${padM}/${y}`, iso: `${y}-${padM}-${padD}` };
      }
    } else {
      // DDMMYYYY
      const d = parseInt(pureDigits.slice(0, 2), 10);
      const m = parseInt(pureDigits.slice(2, 4), 10);
      const y = parseInt(pureDigits.slice(4, 8), 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2099) {
        const padD = String(d).padStart(2, '0');
        const padM = String(m).padStart(2, '0');
        return { dmy: `${padD}/${padM}/${y}`, iso: `${y}-${padM}-${padD}` };
      }
    }
  }

  return { dmy: latin, iso: latin };
}

/**
 * Helper to convert any raw input string directly to ISO (YYYY-MM-DD)
 */
export function normalizeBirthDateToISO(raw: string): string {
  const normalized = normalizeDateString(raw);
  return normalized.iso || toLatinDigits(raw.trim());
}

/**
 * Converts DD/MM/YYYY or raw input to ISO YYYY-MM-DD
 */
export function dmyToISO(dmy: string): string {
  if (!dmy) return '';
  const normalized = normalizeDateString(dmy);
  return normalized.iso || toLatinDigits(dmy.trim());
}

/**
 * Converts ISO YYYY-MM-DD or raw input to DD/MM/YYYY
 */
export function isoToDMY(iso: string): string {
  if (!iso) return '';
  const normalized = normalizeDateString(iso);
  return normalized.dmy || toLatinDigits(iso.trim());
}

/**
 * Input sanitization (non-intrusive typing helper)
 */
export function formatBirthDateInput(raw: string, _prev: string = ''): string {
  if (!raw) return '';
  const latin = toLatinDigits(raw);
  // Keep standard typing characters
  return latin.replace(/[^0-9\/\-\.\s]/g, '').slice(0, 10);
}

/**
 * Simple validation for birth date
 */
export function validateBirthDate(val: string): { isValid: boolean; error?: string } {
  if (!val || !val.trim()) {
    return { isValid: false, error: 'تاريخ الولادة مطلوب' };
  }

  const { dmy, iso } = normalizeDateString(val);
  if (!iso || iso.length !== 10 || !iso.includes('-')) {
    return { isValid: false, error: 'تاريخ الولادة غير مكتمل (مثال: 15/08/1990)' };
  }

  const parts = iso.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (isNaN(y) || y < 1900 || y > 2099) {
    return { isValid: false, error: 'السنة غير صالحة (يجب أن تكون 4 أرقام بين 1900 و 2099)' };
  }
  if (isNaN(m) || m < 1 || m > 12) {
    return { isValid: false, error: 'الشهر غير صالح (1 إلى 12)' };
  }
  if (isNaN(d) || d < 1 || d > 31) {
    return { isValid: false, error: 'اليوم غير صالح (1 إلى 31)' };
  }

  return { isValid: true };
}
