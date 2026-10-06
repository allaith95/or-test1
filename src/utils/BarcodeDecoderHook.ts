/**
 * BarcodeDecoderHook.ts
 * 
 * Advanced Barcode Decoder for Honeywell Xenon 1900 / PDF417 / 2D Scanners.
 * - Global keypress/keydown listener with buffer timing detection (< 50ms between keys)
 * - Automatic translation for Arabic Keyboard Wedge layout corruption
 * - Advanced regex cleaning for noise/garbage characters
 * - Syrian Smart ID Card field extraction
 */

import {
  processHoneywellRawBarcode,
  transliterateArabicToQwerty,
  transliterateQwertyToArabic,
  normalizeDigits,
  extractNationalIdFromBarcode,
  extractBirthDateFromBarcodeRaw,
  extractNamesFromBarcode,
  resolveSmartSyrianCivilProfile,
  normalizeBirthDateToISO
} from './BarcodeScannerUtility';

export interface DecodedSmartIdData {
  raw: string;
  asciiMapped: string;
  nationalId: string;
  firstName: string;
  fatherName: string;
  lastName: string;
  motherName: string;
  birthDate: string;
  city: string;
  idType: 'syrian' | 'palestinian';
  isStructured: boolean;
  isValid: boolean;
  missingFields: string[];
}

export const mapArabicKeyboardToAscii = transliterateArabicToQwerty;
export const extractNationalIdNumber = extractNationalIdFromBarcode;
export const extractBirthDateFromBarcode = extractBirthDateFromBarcodeRaw;

/**
 * Main Syrian Smart ID & Barcode Parser function.
 * Processes raw scanner string and extracts structured fields.
 */
export function parseSyrianSmartIdBarcode(rawText: string): DecodedSmartIdData {
  const raw = (rawText || '').trim();
  if (!raw) {
    return {
      raw: '',
      asciiMapped: '',
      nationalId: '',
      firstName: '',
      fatherName: '',
      lastName: '',
      motherName: '',
      birthDate: '',
      city: 'دمشق',
      idType: 'syrian',
      isStructured: false,
      isValid: false,
      missingFields: ['nationalId'],
    };
  }

  const processed = processHoneywellRawBarcode(raw);

  return {
    raw: processed.rawInput,
    asciiMapped: processed.cleanedText,
    nationalId: processed.nationalId,
    firstName: processed.firstName,
    fatherName: processed.fatherName,
    lastName: processed.lastName,
    motherName: processed.motherName,
    birthDate: processed.birthDate,
    city: processed.city,
    idType: processed.idType,
    isStructured: raw.includes('#') || raw.includes('|') || raw.includes(';'),
    isValid: processed.isValid,
    missingFields: [],
  };
}

export default parseSyrianSmartIdBarcode;
