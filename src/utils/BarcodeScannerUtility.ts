/**
 * BarcodeScannerUtility.ts
 *
 * Comprehensive Universal Decoder & Transliteration Engine for Syrian Smart ID Cards,
 * Honeywell Xenon 1900, PDF417, DataMatrix, and 2D Barcode Readers.
 * 
 * Features:
 * 1. Syrian National ID extraction (11 digits, starting with 01-14, handles leading zeros).
 * 2. Real Arabic name extraction & strict filtering against keyboard wedge / technical noise.
 * 3. Birth Date normalization to DD/MM/YYYY and ISO YYYY-MM-DD.
 * 4. Automatic Syrian Governorate resolution from ID prefix (01-14).
 * 5. Protection against false Palestinian identification and gibberish names.
 */

export interface ExtractedSmartIdFields {
  rawInput: string;
  cleanedText: string;
  transliteratedText: string;
  nationalId: string;
  birthDate: string; // ISO format (YYYY-MM-DD)
  birthDateDisplay: string; // Display format (DD/MM/YYYY)
  firstName: string;
  fatherName: string;
  lastName: string;
  motherName: string;
  city: string;
  idType: 'syrian' | 'palestinian';
  isValid: boolean;
}

/**
 * Standard Arabic 101/102 Keyboard Layout <-> QWERTY ASCII Mapping
 */
export const ARABIC_TO_QWERTY_MAP: Record<string, string> = {
  'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
  'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': '\'',
  'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'لا': 'b', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/',
  'ذ': '`', 'أ': 'H', 'إ': 'Y', 'آ': 'N', 'ـ': 'J',
  '؟': '?', '؛': ';', '،': ',', '»': '>', '«': '<', '}': '}', '{': '{', ']': ']', '[': '['
};

export const QWERTY_TO_ARABIC_MAP: Record<string, string> = {};
Object.entries(ARABIC_TO_QWERTY_MAP).forEach(([ar, en]) => {
  QWERTY_TO_ARABIC_MAP[en] = ar;
});
QWERTY_TO_ARABIC_MAP['H'] = 'أ';
QWERTY_TO_ARABIC_MAP['h'] = 'ا';
QWERTY_TO_ARABIC_MAP['Y'] = 'إ';
QWERTY_TO_ARABIC_MAP['y'] = 'غ';
QWERTY_TO_ARABIC_MAP['N'] = 'آ';
QWERTY_TO_ARABIC_MAP['n'] = 'ى';
QWERTY_TO_ARABIC_MAP['b'] = 'لا';
QWERTY_TO_ARABIC_MAP['B'] = 'لآ';
QWERTY_TO_ARABIC_MAP['T'] = 'لإ';
QWERTY_TO_ARABIC_MAP['G'] = 'لأ';

// CP-1256 (Windows-1256) Byte Map to Arabic Unicode Characters
export const CP1256_BYTE_TO_ARABIC: Record<number, string> = {
  0xC1: 'ء', 0xC2: 'آ', 0xC3: 'أ', 0xC4: 'ؤ', 0xC5: 'إ', 0xC6: 'ئ', 0xC7: 'ا',
  0xC8: 'ب', 0xC9: 'ة', 0xCA: 'ت', 0xCB: 'ث', 0xCC: 'ج', 0xCD: 'ح', 0xCE: 'خ',
  0xCF: 'د', 0xD0: 'ذ', 0xD1: 'ر', 0xD2: 'ز', 0xD3: 'س', 0xD4: 'ش', 0xD5: 'ص',
  0xD6: 'ض', 0xD8: 'ط', 0xD9: 'ظ', 0xDA: 'ع', 0xDB: 'غ', 0xE0: 'ـ', 0xE1: 'ف',
  0xE2: 'ق', 0xE3: 'ك', 0xE4: 'ل', 0xE5: 'م', 0xE6: 'ن', 0xE7: 'ه', 0xE8: 'و',
  0xE9: 'ى', 0xEA: 'ي', 0xEB: 'ً', 0xEC: 'ٌ', 0xED: 'ٍ', 0xEE: 'َ', 0xEF: 'ُ',
  0xF0: 'ِ', 0xF1: 'ّ', 0xF2: 'ْ'
};

/**
 * Decodes UTF-8 Mojibake (e.g. Ø§Ø­Ù…Ø¯ -> احمد)
 */
export function decodeUtf8Mojibake(input: string): string {
  if (!input) return '';
  try {
    // Check if contains typical UTF-8 mojibake markers like Ø, Ù, etc.
    if (!/[\u00C0-\u00FF]/.test(input)) return input;
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      bytes[i] = input.charCodeAt(i) & 0xFF;
    }
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const decoded = decoder.decode(bytes);
    if (/[\u0600-\u06FF]/.test(decoded)) {
      return decoded;
    }
  } catch {
    // fallback
  }
  return input;
}

/**
 * Decodes Windows-1256 Mojibake (e.g. ÇÍãÏ -> احمد)
 */
export function decodeWindows1256Mojibake(input: string): string {
  if (!input) return '';
  let result = '';
  let convertedCount = 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i) & 0xFF;
    if (CP1256_BYTE_TO_ARABIC[code]) {
      result += CP1256_BYTE_TO_ARABIC[code];
      convertedCount++;
    } else {
      result += input[i];
    }
  }
  return convertedCount > 0 ? result : input;
}

/**
 * Transliterates text from Arabic keyboard wedge mapping to QWERTY ASCII
 */
export function transliterateArabicToQwerty(input: string): string {
  if (!input) return '';
  return input
    .split('')
    .map((ch) => ARABIC_TO_QWERTY_MAP[ch] || ch)
    .join('');
}

/**
 * Transliterates text from QWERTY ASCII to Arabic keyboard layout
 */
export function transliterateQwertyToArabic(input: string): string {
  if (!input) return '';
  return input
    .split('')
    .map((ch) => QWERTY_TO_ARABIC_MAP[ch] || ch)
    .join('');
}

/**
 * Normalizes Eastern Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to Standard Western Digits (0-9)
 */
export function normalizeDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Universal Tracking Number Extractor for Barcode & QR Scanners.
 * Handles:
 * 1. Plain Code-128 tracking numbers (e.g. 'ORK-DAM-2026-0001', 'RC-998811')
 * 2. Arabic Keyboard mapped inputs (e.g. 'خقن-يشئ-2026-0001' -> 'ORK-DAM-2026-0001')
 * 3. Scanned URLs (e.g. 'https://app.com/?track=ORK-DAM-2026-0001' or 'https://.../#track=...')
 * 4. Scanned JSON QR payloads (e.g. '{"waybill":"ORK-DAM-2026-0001",...}')
 * 5. Scanned summary text with prefixes
 * 6. Eastern Arabic digits
 */
export function extractCleanTrackingQuery(rawInput: string): string {
  if (!rawInput) return '';
  let text = String(rawInput).trim();

  // 1. Check if it is a JSON payload from QR
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.waybill) return String(parsed.waybill).trim();
      if (parsed.trackingNumber) return String(parsed.trackingNumber).trim();
      if (parsed.receipt) return String(parsed.receipt).trim();
    } catch {
      // ignore json parse error
    }
  }

  // 2. Check if it is a URL with track or no parameter
  if (text.includes('track=') || text.includes('no=')) {
    try {
      const match = text.match(/[?&#](?:track|no)=([^&#\s]+)/i);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim();
      }
    } catch {
      // fallback
    }
  }

  // 3. Normalize Arabic digits to Latin digits
  text = normalizeDigits(text);

  // 4. Check if typed with Arabic keyboard layout (transliterate to QWERTY)
  if (/[\u0600-\u06FF]/.test(text)) {
    const transliterated = transliterateArabicToQwerty(text).toUpperCase();
    if (transliterated.includes('ORK') || transliterated.includes('RC') || transliterated.includes('PKG')) {
      const match = transliterated.match(/(ORK-[A-Z0-9-]+|RC-[A-Z0-9-]+|PKG-[A-Z0-9-]+)/i);
      if (match) return match[1].trim();
      text = transliterated;
    }
  }

  // 5. Look for standard ORCA tracking pattern inside any mixed text
  const orkaPattern = text.match(/\b(ORK-[A-Z0-9-]+|RC-[A-Z0-9-]+|PKG-[A-Z0-9-]+)\b/i);
  if (orkaPattern) {
    return orkaPattern[1].trim();
  }

  // 6. Clean control characters and extra whitespace
  return text.replace(/[\r\n\t]/g, '').trim();
}

/**
 * Cleans garbage/noise symbols resulting from raw binary barcode streams or hardware interrupts
 */
export function cleanHoneywellBarcodeNoise(raw: string): string {
  if (!raw) return '';
  let text = normalizeDigits(raw.trim());
  text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  return text;
}

/**
 * Formats any date string into Day/Month/Year (DD/MM/YYYY)
 */
export function formatDateToDMY(rawDate: string): string {
  if (!rawDate) return '';
  const s = normalizeDigits(rawDate.trim()).replace(/[\/\.]/g, '-');

  // 1. ISO format YYYY-MM-DD or YYYY-M-D
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 2. DD-MM-YYYY or D-M-YYYY
  const dmyMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}/${m}/${y}`;
  }

  // 3. Continuous 8 digits
  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    const yCandidate = parseInt(digits.slice(0, 4), 10);
    if (yCandidate >= 1920 && yCandidate <= 2025) {
      return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
    }
    const endYCandidate = parseInt(digits.slice(4, 8), 10);
    if (endYCandidate >= 1920 && endYCandidate <= 2025) {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }
  }

  return s;
}

/**
 * Normalizes any date string into standard ISO format: YYYY-MM-DD
 */
export function normalizeBirthDateToISO(rawDate: string): string {
  if (!rawDate) return '';
  const s = normalizeDigits(rawDate.trim()).replace(/[\/\.]/g, '-');

  // 1. ISO format YYYY-MM-DD or YYYY-M-D
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. DD-MM-YYYY or D-M-YYYY
  const dmyMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Continuous 8 digits
  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    const yCandidate = parseInt(digits.slice(0, 4), 10);
    if (yCandidate >= 1920 && yCandidate <= 2025) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }
    const endYCandidate = parseInt(digits.slice(4, 8), 10);
    if (endYCandidate >= 1920 && endYCandidate <= 2025) {
      return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
    }
  }

  return s;
}

/**
 * Extracts Date of Birth (DOB) and returns both the normalized date and the cleaned text with date removed
 */
export function extractBirthDateAndStrip(raw: string): { birthDate: string; textWithoutDate: string } {
  if (!raw) return { birthDate: '', textWithoutDate: '' };
  const norm = normalizeDigits(raw.trim());

  let birthDate = '';
  let textWithoutDate = norm;

  // 1. Formatted date tokens (DD-MM-YYYY or YYYY-MM-DD with -, /, .)
  const dateRegexDmy = /(?:\b|[#|;\s,])(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})(?:\b|[#|;\s,])/;
  const matchDmy = norm.match(dateRegexDmy);
  if (matchDmy) {
    const d = matchDmy[1].padStart(2, '0');
    const m = matchDmy[2].padStart(2, '0');
    const y = matchDmy[3];
    const yearNum = parseInt(y, 10);
    if (yearNum >= 1920 && yearNum <= 2025) {
      birthDate = `${y}-${m}-${d}`;
      textWithoutDate = textWithoutDate.replace(matchDmy[0], ' ');
      return { birthDate, textWithoutDate };
    }
  }

  const dateRegexYmd = /(?:\b|[#|;\s,])(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})(?:\b|[#|;\s,])/;
  const matchYmd = norm.match(dateRegexYmd);
  if (matchYmd) {
    const y = matchYmd[1];
    const m = matchYmd[2].padStart(2, '0');
    const d = matchYmd[3].padStart(2, '0');
    const yearNum = parseInt(y, 10);
    if (yearNum >= 1920 && yearNum <= 2025) {
      birthDate = `${y}-${m}-${d}`;
      textWithoutDate = textWithoutDate.replace(matchYmd[0], ' ');
      return { birthDate, textWithoutDate };
    }
  }

  // 2. 8-digit date patterns like 20030813 or 13082003 or 19950404
  const tokens = norm.split(/[#|;\t,\n\r\s]+/).map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const digits = token.replace(/\D/g, '');
    if (digits.length === 8) {
      const yCandidate = parseInt(digits.slice(0, 4), 10);
      const mCandidate = parseInt(digits.slice(4, 6), 10);
      const dCandidate = parseInt(digits.slice(6, 8), 10);
      if (yCandidate >= 1920 && yCandidate <= 2025 && mCandidate >= 1 && mCandidate <= 12 && dCandidate >= 1 && dCandidate <= 31) {
        birthDate = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
        textWithoutDate = textWithoutDate.replace(token, ' ');
        return { birthDate, textWithoutDate };
      }

      const endYCandidate = parseInt(digits.slice(4, 8), 10);
      const startDCandidate = parseInt(digits.slice(0, 2), 10);
      const midMCandidate = parseInt(digits.slice(2, 4), 10);
      if (endYCandidate >= 1920 && endYCandidate <= 2025 && midMCandidate >= 1 && midMCandidate <= 12 && startDCandidate >= 1 && startDCandidate <= 31) {
        birthDate = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
        textWithoutDate = textWithoutDate.replace(token, ' ');
        return { birthDate, textWithoutDate };
      }
    }
  }

  return { birthDate, textWithoutDate };
}

/**
 * Extracts Syrian National ID (11 digits, governorate codes 01 to 14)
 */
export function extractNationalIdFromBarcode(raw: string): string {
  if (!raw) return '';
  const { textWithoutDate } = extractBirthDateAndStrip(raw);
  const norm = textWithoutDate;

  // 1. Direct regex match for # 11-digits # (e.g. #06100053730#)
  const hashExplicit = norm.match(/#\s*(\d{11})\s*#/);
  if (hashExplicit && hashExplicit[1]) {
    const p = parseInt(hashExplicit[1].substring(0, 2), 10);
    if (p >= 1 && p <= 14) return hashExplicit[1];
    return hashExplicit[1];
  }

  // 2. Explicit tokens enclosed by delimiters
  const tokens = norm.split(/[#|;\t,\n\r\s]+/).map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const cleanToken = token.replace(/\D/g, '');
    if (cleanToken.length === 11) {
      const prefix = parseInt(cleanToken.substring(0, 2), 10);
      if (prefix >= 1 && prefix <= 14) {
        return cleanToken;
      }
    }
  }

  // 3. Match 11 continuous digits starting with Syrian Governorate Code (01 to 14)
  const govRegex = /(?:^|[^\d])(0[1-9]|1[0-4])(\d{9})(?:[^\d]|$)/;
  const govMatch = norm.match(govRegex);
  if (govMatch) {
    return govMatch[1] + govMatch[2];
  }

  // 4. Any 11 continuous digits
  for (const token of tokens) {
    const cleanToken = token.replace(/\D/g, '');
    if (cleanToken.length === 11) {
      return cleanToken;
    }
  }

  const any11Match = norm.match(/(?:^|[^\d])(\d{11})(?:[^\d]|$)/);
  if (any11Match && any11Match[1]) {
    return any11Match[1];
  }

  // 5. Check if 10-digit number is missing leading zero (e.g. 10 digits starting with 1-9 representing 01-09)
  for (const token of tokens) {
    const cleanToken = token.replace(/\D/g, '');
    if (cleanToken.length === 10) {
      const p = parseInt(cleanToken.substring(0, 1), 10);
      if (p >= 1 && p <= 9) {
        return '0' + cleanToken;
      }
    }
  }

  // 6. Sliding window in digits-only text
  const digitsOnly = norm.replace(/\D/g, '');
  for (let i = 0; i <= digitsOnly.length - 11; i++) {
    const candidate = digitsOnly.substring(i, i + 11);
    const prefix = parseInt(candidate.substring(0, 2), 10);
    if (prefix >= 1 && prefix <= 14) {
      return candidate;
    }
  }

  return '';
}

/**
 * Extracts Date of Birth directly from barcode
 */
export function extractBirthDateFromBarcodeRaw(raw: string): string {
  const { birthDate } = extractBirthDateAndStrip(raw);
  return birthDate;
}

/**
 * Banned words: technical keys, hardware codes, keyboard wedge artifacts, and governorates
 */
const BANNED_NAME_WORDS = new Set([
  // Governorates & Civil Metadata
  'دمشق', 'ريف', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'ادلب', 'السويداء', 'سويداء',
  'درعا', 'دير', 'الزور', 'الحسكة', 'حسكة', 'الرقة', 'رقة', 'القنيطرة', 'قنيطرة',
  'الاسم', 'اسم', 'الأب', 'الاب', 'الكنية', 'كنية', 'النسبة', 'نسبة', 'اللقب', 'لقب',
  'الأم', 'الام', 'التولد', 'تولد', 'الميلاد', 'ميلاد', 'الخانة', 'خانة', 'القيد', 'قيد',
  'الرقم', 'رقم', 'الوطني', 'وطني', 'البطاقة', 'بطاقة', 'الشخصية', 'شخصية',
  'الجمهورية', 'العربية', 'السورية', 'وزارة', 'الداخلية', 'الشؤون', 'المدنية', 'الجنس', 'ذكر', 'أنثى', 'انثى',
  // Technical / Keyboard Wedge Gibberish / Noise words
  'عهيتاوكة', 'عهيتا', 'لح', 'ألله', 'الله', 'سؤ', 'عهيتام', ' uid ', 'gp', 'hggi', 'sc', 'doc', 'null', 'undefined',
  'آإ', 'قض', 'خر', 'كغقه', 'كغ', 'آإقض', 'خركغقه'
]);

/**
 * Validates whether a token is a genuine Arabic civil name
 */
export function isValidArabicName(str: string): boolean {
  if (!str) return false;
  const clean = str.trim();
  
  // Must be between 3 and 20 characters
  if (clean.length < 3 || clean.length > 20) {
    // Only accept 2-letter words if they are known valid Arabic names
    if (clean.length === 2 && ['مي'].includes(clean)) {
      return true;
    }
    return false;
  }
  
  // Must ONLY contain Arabic alphabet letters and spaces
  if (!/^[\u0621-\u064A\s]+$/.test(clean)) return false;
  
  // Must not be in banned list
  if (BANNED_NAME_WORDS.has(clean)) return false;
  
  // Ban words where 'ة' (Teh Marbuta) appears anywhere other than the end of a word
  if (/[^\s]ة[^\s]/.test(clean)) return false;

  // Ban repeated or invalid alef/hamza combinations
  if (
    clean.includes('اا') ||
    clean.includes('اأ') ||
    clean.includes('أا') ||
    clean.includes('إا') ||
    clean.includes('آأ') ||
    clean.includes('آإ') ||
    clean.includes('إآ') ||
    clean.includes('ءء') ||
    clean.includes('ءآ') ||
    clean.includes('زء') ||
    clean.includes('كغ') ||
    clean.includes('قض') ||
    clean.includes('ظث') ||
    clean.includes('ذض') ||
    clean.includes('طوف') ||
    clean.includes('خدس')
  ) {
    return false;
  }
  
  return true;
}

/**
 * Cleans and sanitizes a single name word
 */
function sanitizeSingleName(str: string): string {
  if (!str) return '';
  const cleaned = str
    .replace(/[0-9\x00-\x1F\x7F-\x9F\|\{\}\?\~\`\^\<\>\#\$\@\/\%\*\&\!=\+\\\_÷×:;,\-\.\[\]\(\)\"\'\t\r\n؟]/g, '')
    .replace(/[\u064B-\u0652]/g, '') // remove Arabic diacritics
    .trim();

  return isValidArabicName(cleaned) ? cleaned : '';
}

/**
 * Robust Name Extractor from Barcode Text (supports labeled keys and real Arabic delimited fields)
 */
export function extractNamesFromBarcode(raw: string): {
  firstName: string;
  fatherName: string;
  lastName: string;
  motherName: string;
  city: string;
} {
  if (!raw) return { firstName: '', fatherName: '', lastName: '', motherName: '', city: '' };

  // Generate candidate representations: raw, UTF-8 mojibake decoded, Windows-1256 decoded, QWERTY transliterated
  const candidates = [
    raw,
    decodeUtf8Mojibake(raw),
    decodeWindows1256Mojibake(raw),
    transliterateQwertyToArabic(raw),
    decodeWindows1256Mojibake(transliterateArabicToQwerty(raw))
  ];

  for (const candidateText of candidates) {
    if (!candidateText) continue;
    const cleaned = cleanHoneywellBarcodeNoise(candidateText);

    let firstName = '';
    let fatherName = '';
    let lastName = '';
    let motherName = '';
    let city = '';

    // 1. Check Explicit Arabic Labels in text (e.g. الاسم: احمد, الاب: بسام...)
    const mFN = cleaned.match(/(?:الاسم|اسم)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
    if (mFN && mFN[1]) firstName = sanitizeSingleName(mFN[1]);

    const mLN = cleaned.match(/(?:النسبة|الكنية|اللقب|العائلة)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
    if (mLN && mLN[1]) lastName = sanitizeSingleName(mLN[1]);

    const mFat = cleaned.match(/(?:الأب|الاب|اسم\s*الأب|اسم\s*الاب)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
    if (mFat && mFat[1]) fatherName = sanitizeSingleName(mFat[1]);

    const mMoth = cleaned.match(/(?:الأم|الام|اسم\s*الأم|اسم\s*الام)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
    if (mMoth && mMoth[1]) motherName = sanitizeSingleName(mMoth[1]);

    const mCity = cleaned.match(/(?:المحافظة|المدينة|مكان\s*القيد|القيد)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
    if (mCity && mCity[1]) {
      const candidateCity = mCity[1].trim();
      if (['دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'السويداء', 'درعا', 'دير الزور', 'الحسكة', 'الرقة', 'القنيطرة'].includes(candidateCity)) {
        city = candidateCity;
      }
    }

    // If valid names are found via labels, return immediately
    if (firstName && (fatherName || lastName)) {
      return { firstName, fatherName, lastName, motherName, city };
    }

    // 2. Extract tokens by splitting delimiters (#, |, ;, tabs, newlines, *, commas)
    const textWithoutNumbers = cleaned
      .replace(/\b\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4}\b/g, ' ')
      .replace(/\b\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}\b/g, ' ')
      .replace(/\d+/g, ' ');

    const rawTokens = textWithoutNumbers
      .split(/[#|;\t\r\n,\/\\=\*\^]+/g)
      .map((t) => t.trim())
      .filter(Boolean);

    const validTokens: string[] = [];

    for (const t of rawTokens) {
      const words = t.split(/\s+/).map((w) => w.trim()).filter(Boolean);
      for (const w of words) {
        const sanitized = sanitizeSingleName(w);
        if (sanitized && isValidArabicName(sanitized)) {
          validTokens.push(sanitized);
        } else if (['دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'السويداء', 'درعا', 'دير الزور', 'الحسكة', 'الرقة', 'القنيطرة'].includes(w)) {
          city = w;
        }
      }
    }

    // If valid human names are found
    if (validTokens.length >= 2) {
      firstName = validTokens[0] || '';
      fatherName = validTokens[1] || '';
      if (validTokens.length >= 3) {
        lastName = validTokens[2] || '';
      }
      if (validTokens.length >= 4) {
        motherName = validTokens[3] || '';
      }

      return {
        firstName: sanitizeSingleName(firstName),
        fatherName: sanitizeSingleName(fatherName),
        lastName: sanitizeSingleName(lastName),
        motherName: sanitizeSingleName(motherName),
        city: city || '',
      };
    }
  }

  return {
    firstName: '',
    fatherName: '',
    lastName: '',
    motherName: '',
    city: '',
  };
}

/**
 * Syrian Governorate Mapping from official 2-digit National ID prefix (01-14)
 */
export const SYRIAN_GOVERNORATE_PREFIXES: Record<string, string> = {
  '01': 'دمشق',
  '02': 'ريف دمشق',
  '03': 'حلب',
  '04': 'حمص',
  '05': 'حماة',
  '06': 'اللاذقية',
  '07': 'إدلب',
  '08': 'طرطوس',
  '09': 'الرقة',
  '10': 'دير الزور',
  '11': 'الحسكة',
  '12': 'درعا',
  '13': 'السويداء',
  '14': 'القنيطرة',
};

/**
 * Universal Syrian Civil Registry Profile Builder:
 * Derives governorate from National ID prefix (01-14) and integrates with scanned civil names.
 */
export function resolveSmartSyrianCivilProfile(
  nid: string,
  dob?: string
): {
  firstName: string;
  fatherName: string;
  lastName: string;
  motherName: string;
  birthDate: string;
  city: string;
} {
  const cleanNid = (nid || '').replace(/\D/g, '');
  const resolvedDob = dob ? normalizeBirthDateToISO(dob) : '';

  const govPrefix = cleanNid.substring(0, 2);
  const city = SYRIAN_GOVERNORATE_PREFIXES[govPrefix] || 'دمشق';

  return {
    firstName: '',
    fatherName: '',
    lastName: '',
    motherName: '',
    birthDate: resolvedDob,
    city,
  };
}

export interface SyrianIdScannerResult {
  raw: string;
  cleanedText: string;
  nationalId: string;
  isNationalIdValid: boolean;
  birthDate: string; // ISO format: YYYY-MM-DD
  birthDateDisplay: string; // DMY format: DD/MM/YYYY
  isBirthDateValid: boolean;
  firstName: string;
  fatherName: string;
  lastName: string;
  motherName: string;
  city: string;
  isReordered: boolean;
  notes: string[];
}

/**
 * Universal Processing & Heuristic Re-ordering Logic for Syrian Smart ID Barcode/Scanner Payloads
 * - Validates National ID via strict Regex (11 digits, governorate codes 01-14)
 * - Validates Birth Date via strict Regex (DMY / YMD / 8-digit)
 * - Reconstructs disordered / unstructured tokens into standard Syrian ID order:
 *   [National ID] -> [Birth Date] -> [Governorate] -> [First Name] -> [Father's Name] -> [Last Name] -> [Mother's Name]
 */
export function processSyrianIdScannerPayload(rawInput: string): SyrianIdScannerResult {
  const raw = (rawInput || '').trim();
  const notes: string[] = [];
  let isReordered = false;

  if (!raw) {
    return {
      raw: '',
      cleanedText: '',
      nationalId: '',
      isNationalIdValid: false,
      birthDate: '',
      birthDateDisplay: '',
      isBirthDateValid: false,
      firstName: '',
      fatherName: '',
      lastName: '',
      motherName: '',
      city: 'دمشق',
      isReordered: false,
      notes: ['المدخلات فارغة'],
    };
  }

  // 1. Cleaning and multi-encoding normalization
  const cleanedText = cleanHoneywellBarcodeNoise(raw);

  // 2. Regex Extraction & Validation for Syrian National ID (11 Digits, 01-14 governorate code)
  let nationalId = '';
  let isNationalIdValid = false;

  // Strict regex: 11 digits starting with valid governorate code 01-14
  const strictNidRegex = /(?:^|[^\d])(0[1-9]|1[0-4])(\d{9})(?:[^\d]|$)/;
  const strictNidMatch = cleanedText.match(strictNidRegex);

  if (strictNidMatch && strictNidMatch[1] && strictNidMatch[2]) {
    nationalId = strictNidMatch[1] + strictNidMatch[2];
    isNationalIdValid = true;
  } else {
    // Fallback regex: Any 11 consecutive digits
    const anyNidRegex = /(?:^|[^\d])(\d{11})(?:[^\d]|$)/;
    const anyNidMatch = cleanedText.match(anyNidRegex);
    if (anyNidMatch && anyNidMatch[1]) {
      nationalId = anyNidMatch[1];
      const p = parseInt(nationalId.substring(0, 2), 10);
      isNationalIdValid = p >= 1 && p <= 14;
    } else {
      // Check for 10-digit number missing leading zero
      const tenDigitMatch = cleanedText.match(/(?:^|[^\d])([1-9]\d{9})(?:[^\d]|$)/);
      if (tenDigitMatch && tenDigitMatch[1]) {
        nationalId = '0' + tenDigitMatch[1];
        isNationalIdValid = true;
        notes.push('تم تصحيح الصفر البادئ للرقم الوطني');
      }
    }
  }

  // 3. Regex Extraction & Validation for Birth Date
  let birthDate = '';
  let isBirthDateValid = false;
  let remainingText = cleanedText;

  // If National ID was found, strip it from remainingText so it won't interfere with date or names
  if (nationalId) {
    remainingText = remainingText.replace(nationalId, ' ');
  }

  // Regex A: Formatted date tokens (DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY)
  const dmyRegex = /(?:^|[^\d])(0[1-9]|[12][0-9]|3[01])[\/\-\.](0[1-9]|1[0-2])[\/\-\.](19\d{2}|20\d{2})(?:[^\d]|$)/;
  const dmyMatch = remainingText.match(dmyRegex);

  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    const yearNum = parseInt(y, 10);
    if (yearNum >= 1920 && yearNum <= 2026) {
      birthDate = `${y}-${m}-${d}`;
      isBirthDateValid = true;
      remainingText = remainingText.replace(dmyMatch[0], ' ');
    }
  }

  // Regex B: Formatted date tokens (YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD)
  if (!birthDate) {
    const ymdRegex = /(?:^|[^\d])(19\d{2}|20\d{2})[\/\-\.](0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12][0-9]|3[01])(?:[^\d]|$)/;
    const ymdMatch = remainingText.match(ymdRegex);
    if (ymdMatch) {
      const y = ymdMatch[1];
      const m = ymdMatch[2].padStart(2, '0');
      const d = ymdMatch[3].padStart(2, '0');
      const yearNum = parseInt(y, 10);
      if (yearNum >= 1920 && yearNum <= 2026) {
        birthDate = `${y}-${m}-${d}`;
        isBirthDateValid = true;
        remainingText = remainingText.replace(ymdMatch[0], ' ');
      }
    }
  }

  // Regex C: 8 consecutive digits (YYYYMMDD or DDMMYYYY)
  if (!birthDate) {
    const eightDigitRegex = /(?:^|[^\d])(\d{8})(?:[^\d]|$)/g;
    let match8;
    while ((match8 = eightDigitRegex.exec(remainingText)) !== null) {
      const numStr = match8[1];
      const yCandidate = parseInt(numStr.slice(0, 4), 10);
      const mCandidate = parseInt(numStr.slice(4, 6), 10);
      const dCandidate = parseInt(numStr.slice(6, 8), 10);

      if (yCandidate >= 1920 && yCandidate <= 2026 && mCandidate >= 1 && mCandidate <= 12 && dCandidate >= 1 && dCandidate <= 31) {
        birthDate = `${numStr.slice(0, 4)}-${numStr.slice(4, 6)}-${numStr.slice(6, 8)}`;
        isBirthDateValid = true;
        remainingText = remainingText.replace(match8[0], ' ');
        break;
      }

      const endYCandidate = parseInt(numStr.slice(4, 8), 10);
      const startDCandidate = parseInt(numStr.slice(0, 2), 10);
      const midMCandidate = parseInt(numStr.slice(2, 4), 10);

      if (endYCandidate >= 1920 && endYCandidate <= 2026 && midMCandidate >= 1 && midMCandidate <= 12 && startDCandidate >= 1 && startDCandidate <= 31) {
        birthDate = `${numStr.slice(4, 8)}-${numStr.slice(2, 4)}-${numStr.slice(0, 2)}`;
        isBirthDateValid = true;
        remainingText = remainingText.replace(match8[0], ' ');
        break;
      }
    }
  }

  // 4. Governorate / City Detection & Inference
  let city = '';
  const govList = ['دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'السويداء', 'درعا', 'دير الزور', 'الحسكة', 'الرقة', 'القنيطرة'];
  for (const gov of govList) {
    if (remainingText.includes(gov)) {
      city = gov;
      remainingText = remainingText.replace(gov, ' ');
      break;
    }
  }

  // If city not found in text, infer from National ID prefix (01-14)
  if (!city && nationalId && nationalId.length >= 2) {
    const prefix = nationalId.substring(0, 2);
    city = SYRIAN_GOVERNORATE_PREFIXES[prefix] || 'دمشق';
  }

  // 5. Heuristic Re-ordering for Unstructured / Shuffled Tokens
  // Standard Syrian National ID Layout:
  // [الاسم الأول (First Name)] -> [اسم الأب (Father Name)] -> [الكنية / اللقب (Last Name)] -> [اسم الأم (Mother Name)]
  let firstName = '';
  let fatherName = '';
  let lastName = '';
  let motherName = '';

  // Extract explicit labels if present
  const mFN = remainingText.match(/(?:الاسم|اسم)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
  if (mFN && mFN[1]) firstName = sanitizeSingleName(mFN[1]);

  const mLN = remainingText.match(/(?:النسبة|الكنية|اللقب|العائلة)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
  if (mLN && mLN[1]) lastName = sanitizeSingleName(mLN[1]);

  const mFat = remainingText.match(/(?:الأب|الاب|اسم\s*الأب|اسم\s*الاب)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
  if (mFat && mFat[1]) fatherName = sanitizeSingleName(mFat[1]);

  const mMoth = remainingText.match(/(?:الأم|الام|اسم\s*الأم|اسم\s*الام)\s*[:=]\s*([\u0600-\u06FFA-Za-z]+)/i);
  if (mMoth && mMoth[1]) motherName = sanitizeSingleName(mMoth[1]);

  // If labeled extraction was incomplete, extract tokens and heuristically re-order them
  if (!firstName || !lastName || !fatherName) {
    // Strip remaining numbers, dates, punctuation
    const textWithoutNumbers = remainingText
      .replace(/\d+/g, ' ')
      .replace(/[\x00-\x1F\x7F-\x9F\|\{\}\?\~\`\^\<\>\#\$\@\/\%\*\&\!=\+\\\_÷×:;,\-\.\[\]\(\)\"\'\t\r\n؟]/g, ' ');

    const rawTokens = textWithoutNumbers
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const validNameTokens: string[] = [];

    for (const t of rawTokens) {
      const sanitized = sanitizeSingleName(t);
      if (sanitized && isValidArabicName(sanitized)) {
        if (!validNameTokens.includes(sanitized)) {
          validNameTokens.push(sanitized);
        }
      }
    }

    if (validNameTokens.length >= 2) {
      isReordered = true;
      if (!firstName && validNameTokens[0]) firstName = validNameTokens[0];
      if (!fatherName && validNameTokens[1]) fatherName = validNameTokens[1];
      if (!lastName && validNameTokens[2]) lastName = validNameTokens[2];
      if (!motherName && validNameTokens[3]) motherName = validNameTokens[3];

      // If only 2 tokens found (e.g. FirstName and LastName)
      if (validNameTokens.length === 2 && !lastName) {
        lastName = validNameTokens[1];
        fatherName = '';
      }

      notes.push('تمت إعادة ترتيب حقول الهوية السورية بنجاح وفق النمط المعتاد');
    }
  }

  const birthDateDisplay = formatDateToDMY(birthDate);

  return {
    raw,
    cleanedText,
    nationalId,
    isNationalIdValid,
    birthDate,
    birthDateDisplay,
    isBirthDateValid,
    firstName: sanitizeSingleName(firstName),
    fatherName: sanitizeSingleName(fatherName),
    lastName: sanitizeSingleName(lastName),
    motherName: sanitizeSingleName(motherName),
    city: city || 'دمشق',
    isReordered,
    notes,
  };
}

/**
 * Main function: Universal Process for any 2D Barcode scanner stream
 */
export function processHoneywellRawBarcode(rawInput: string): ExtractedSmartIdFields {
  const result = processSyrianIdScannerPayload(rawInput);

  return {
    rawInput: result.raw,
    cleanedText: result.cleanedText,
    transliteratedText: transliterateArabicToQwerty(result.cleanedText),
    nationalId: result.nationalId,
    birthDate: result.birthDate,
    birthDateDisplay: result.birthDateDisplay,
    firstName: result.firstName,
    fatherName: result.fatherName,
    lastName: result.lastName,
    motherName: result.motherName,
    city: result.city,
    idType: 'syrian',
    isValid: Boolean(result.nationalId && result.nationalId.length >= 9),
  };
}

export default processHoneywellRawBarcode;
