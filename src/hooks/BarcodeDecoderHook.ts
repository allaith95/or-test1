import { useEffect, useRef } from 'react';

export interface DecodedBarcodeData {
  rawText: string;
  cleanedText: string;
  nationalId: string;
  firstName: string;
  fatherName: string;
  lastName: string;
  motherName: string;
  birthDate: string;
  idType: 'syrian' | 'palestinian' | 'other';
  isStructured: boolean;
}

interface UseBarcodeDecoderOptions {
  onDecode?: (data: DecodedBarcodeData) => void;
  onRawScan?: (raw: string) => void;
  minBarcodeLength?: number;
  timeThresholdMs?: number; // Time between keystrokes (scanner is usually < 35ms)
  enabled?: boolean;
}

// Full mapping for Arabic keyboard layout -> QWERTY ASCII (Honeywell scanner output translation)
const ARABIC_TO_ASCII_MAP: Record<string, string> = {
  'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
  'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': '\'',
  'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'لا': 'b', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/',
  'ذ': '`', 'أ': 'H', 'إ': 'Y', 'آ': 'N', 'ـ': 'J',
  '؟': '?', '؛': ';', '،': ',', '»': '>', '«': '<', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '0': '0'
};

/**
 * Translates Arabic-keyboard-mapped keystrokes back to original scanner ASCII text
 */
export function translateArabicKeystrokesToAscii(input: string): string {
  if (!input) return '';
  return input
    .split('')
    .map((ch) => ARABIC_TO_ASCII_MAP[ch] || ch)
    .join('');
}

/**
 * Extracts 11-digit Syrian National ID or 9-10 digit Palestinian ID using advanced regex
 */
export function extractNationalIdWithRegex(text: string): string {
  if (!text) return '';
  // Normalize Arabic-Indic digits ٠-٩ to 0-9
  const normalized = text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  // 1. Strict 11-digit Syrian National ID match
  const syrianMatch = normalized.match(/\b\d{11}\b/) || normalized.match(/\d{11}/);
  if (syrianMatch) return syrianMatch[0];

  // 2. Palestinian 9 or 10 digit ID match
  const palMatch = normalized.match(/\b\d{9,10}\b/) || normalized.match(/\d{9,10}/);
  if (palMatch) return palMatch[0];

  // 3. Fallback: extract contiguous digits if total >= 9
  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 11) return digits.slice(0, 11);
  if (digits.length >= 9) return digits;

  return '';
}

/**
 * Decodes raw scanner data (Syrian ID / National ID / MRZ / Pipe-delimited / Key-Value)
 */
export function parseSyrianNationalIdBarcode(rawInput: string): DecodedBarcodeData {
  const rawText = rawInput || '';
  const trimmed = rawText.trim();
  const translatedAscii = translateArabicKeystrokesToAscii(trimmed);

  // Determine whether to use original or translated ASCII text
  const textToParse =
    translatedAscii.includes('|') || translatedAscii.includes(';') || translatedAscii.includes('=')
      ? translatedAscii
      : trimmed;

  let nationalId = '';
  let firstName = '';
  let fatherName = '';
  let lastName = '';
  let motherName = '';
  let birthDate = '';
  let idType: 'syrian' | 'palestinian' | 'other' = 'syrian';
  let isStructured = false;

  // 1. Check Delimited formats (| ; \t ,)
  let delimiter: string | null = null;
  if (textToParse.includes('|')) delimiter = '|';
  else if (textToParse.includes(';')) delimiter = ';';
  else if (textToParse.includes('\t')) delimiter = '\t';
  else if (textToParse.includes(',') && !textToParse.startsWith('{')) delimiter = ',';

  if (delimiter) {
    isStructured = true;
    const parts = textToParse.split(delimiter).map((s) => s.trim());

    // Key-Value format (e.g. NID=010123...;FN=محمد;LN=المصري)
    if (parts.some((p) => p.includes('='))) {
      parts.forEach((part) => {
        const [k, v] = part.split('=').map((s) => s.trim());
        if (!k || !v) return;
        const keyUpper = k.toUpperCase();
        if (keyUpper === 'NID' || keyUpper === 'ID' || keyUpper === 'NATIONALID') nationalId = v;
        else if (keyUpper === 'FN' || keyUpper === 'FIRSTNAME' || keyUpper === 'NAME') firstName = v;
        else if (keyUpper === 'MN' || keyUpper === 'MOTHER' || keyUpper === 'MOTHERNAME') motherName = v;
        else if (keyUpper === 'LN' || keyUpper === 'LASTNAME' || keyUpper === 'FAMILY') lastName = v;
        else if (keyUpper === 'FATHER' || keyUpper === 'FATHERNAME') fatherName = v;
        else if (keyUpper === 'DOB' || keyUpper === 'BIRTH') birthDate = v;
      });
    } else if (parts.length >= 2) {
      // Positional format: [Header, NationalID, FirstName, FatherName, LastName, MotherName, BirthDate]
      if (parts[0].toUpperCase() === 'PALID' || textToParse.includes('فلسطين')) idType = 'palestinian';
      else idType = 'syrian';

      const hasHeader = isNaN(Number(parts[0]));
      const idxOffset = hasHeader ? 1 : 0;

      nationalId = parts[idxOffset] || '';
      firstName = parts[idxOffset + 1] || '';
      fatherName = parts[idxOffset + 2] || '';
      lastName = parts[idxOffset + 3] || '';
      motherName = parts[idxOffset + 4] || '';
      birthDate = parts[idxOffset + 5] || '';
    }
  }
  // 2. JSON Format
  else if (
    (textToParse.startsWith('{') && textToParse.endsWith('}')) ||
    (textToParse.startsWith('[') && textToParse.endsWith(']'))
  ) {
    isStructured = true;
    try {
      const parsed = JSON.parse(textToParse);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      if (obj.idType && String(obj.idType).toLowerCase().includes('pal')) idType = 'palestinian';
      nationalId = String(obj.nationalId || obj.nid || obj.id || '');
      firstName = String(obj.firstName || obj.fName || obj.name || '');
      fatherName = String(obj.fatherName || obj.father || '');
      lastName = String(obj.lastName || obj.lName || '');
      motherName = String(obj.motherName || obj.mother || '');
      birthDate = String(obj.birthDate || obj.dob || '');
    } catch {
      // Ignore JSON parse fail
    }
  }
  // 3. MRZ ICAO format
  else if (
    textToParse.includes('SYR') ||
    textToParse.includes('PSE') ||
    textToParse.toUpperCase().startsWith('I<') ||
    textToParse.toUpperCase().startsWith('ID')
  ) {
    isStructured = true;
    if (textToParse.includes('PSE')) idType = 'palestinian';
    const matchNid = textToParse.match(/\d{11}/);
    if (matchNid) nationalId = matchNid[0];
  }

  // Final Rescue for National ID
  const cleanNationalId =
    extractNationalIdWithRegex(nationalId) ||
    extractNationalIdWithRegex(trimmed) ||
    extractNationalIdWithRegex(translatedAscii);

  if (cleanNationalId && cleanNationalId.length === 9) idType = 'palestinian';

  // Advanced Regex Cleanup for noise symbols in cleaned string
  const cleanedText = textToParse
    .replace(/[\|\{\}\?\~\`\^\<\>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    rawText,
    cleanedText,
    nationalId: cleanNationalId,
    firstName: firstName.trim(),
    fatherName: fatherName.trim(),
    lastName: lastName.trim(),
    motherName: motherName.trim(),
    birthDate: birthDate.trim(),
    idType,
    isStructured
  };
}

/**
 * React Hook to capture global scanner keystrokes in real-time, clean noise & decode Syrian ID
 */
export function useBarcodeDecoder({
  onDecode,
  onRawScan,
  minBarcodeLength = 8,
  timeThresholdMs = 45,
  enabled = true
}: UseBarcodeDecoderOptions = {}) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events originating from text input or textarea unless specific scanner focus
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Enter key signals end of barcode scan
      if (e.key === 'Enter' || e.keyCode === 13) {
        if (bufferRef.current.length >= minBarcodeLength) {
          const rawScanned = bufferRef.current;
          bufferRef.current = '';

          if (onRawScan) onRawScan(rawScanned);

          const decoded = parseSyrianNationalIdBarcode(rawScanned);
          if (onDecode) onDecode(decoded);

          // Prevent form submit if scanner triggered Enter
          e.preventDefault();
          e.stopPropagation();
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // Single printable character check
      if (e.key && e.key.length === 1) {
        // If time between keys is short (< threshold), it's likely a scanner stream
        if (timeDiff < timeThresholdMs || bufferRef.current.length > 0 || !isInputFocused) {
          bufferRef.current += e.key;

          // Clear buffer after 300ms of inactivity
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (bufferRef.current.length >= minBarcodeLength) {
              const rawScanned = bufferRef.current;
              bufferRef.current = '';
              if (onRawScan) onRawScan(rawScanned);
              const decoded = parseSyrianNationalIdBarcode(rawScanned);
              if (onDecode) onDecode(decoded);
            } else {
              bufferRef.current = '';
            }
          }, 300);
        } else {
          // Reset buffer for normal human typing
          bufferRef.current = e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, minBarcodeLength, timeThresholdMs, onDecode, onRawScan]);

  return {
    parseBarcode: parseSyrianNationalIdBarcode,
    translateArabicToAscii: translateArabicKeystrokesToAscii,
    extractNationalId: extractNationalIdWithRegex
  };
}

export default useBarcodeDecoder;
