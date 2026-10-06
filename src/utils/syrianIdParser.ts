import { toLatinDigits } from './numberFormatter';
import { validateBirthDate } from './birthDateUtility';
import { normalizeCustomerNames } from './nameUtils';

export interface ParsedSyrianId {
  firstName: string;
  fatherName: string;
  lastName: string;
  fullName: string;
  motherName: string;
  nationalId: string;
  birthDate: string;
  city?: string;
  confidence: number;
  rawText: string;
  fieldsStatus: {
    nationalId: 'verified' | 'unverified' | 'empty';
    birthDate: 'verified' | 'unverified' | 'empty';
    name: 'verified' | 'unverified' | 'empty';
    motherName: 'verified' | 'unverified' | 'empty';
  };
}

/**
 * Intelligent parser for Syrian ID cards (both smart plastic cards and paper IDs).
 * Cleans, normalizes, and extracts civil registration fields using specialized patterns.
 */
export function parseSyrianId(rawOcrText: string): ParsedSyrianId {
  const cleanRaw = rawOcrText || '';
  const latinText = toLatinDigits(cleanRaw);

  let firstName = '';
  let fatherName = '';
  let lastName = '';
  let fullName = '';
  let motherName = '';
  let nationalId = '';
  let birthDate = '';
  let detectedCity = '';

  // 1. Extract 11-digit National ID (الرقم الوطني السوري)
  // Must be strictly 11 digits (handles spaces or hyphens, but rejects 10 or 12+ digits)
  const candidateMatches = latinText.match(/(?:^|\D)(\d(?:[\s\-\.]*\d){10})(?:$|\D)/g);
  if (candidateMatches) {
    for (const cand of candidateMatches) {
      const pureDigits = cand.replace(/\D/g, '');
      if (pureDigits.length === 11) {
        nationalId = pureDigits;
        break;
      }
    }
  }

  // 2. Extract Birth Date (تاريخ الولادة)
  // Supported patterns: DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, YYYY-MM-DD
  const dateRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g;
  const dateMatches = [...latinText.matchAll(dateRegex)];
  
  if (dateMatches.length > 0) {
    const [_, d, m, y] = dateMatches[0];
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    const year = y;
    
    // Check if day/month are valid
    const formattedDate = `${year}-${month}-${day}`;
    const check = validateBirthDate(formattedDate);
    if (check.isValid) {
      birthDate = formattedDate;
    }
  }

  // 3. Line by Line Text Parsing for Arabic Names
  const lines = cleanRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  // Labels and system terms on Syrian ID cards
  const labelPatterns = [
    /^الاسم\s*:?\s*/,
    /^اسم\s+الأب\s*:?\s*/,
    /^الأب\s*:?\s*/,
    /^اسم\s+الأم\s*:?\s*/,
    /^الأم\s*:?\s*/,
    /^النسبة\s*:?\s*/,
    /^الكنية\s*:?\s*/,
    /^الرقم\s+الوطني\s*:?\s*/,
    /^مكان\s+الولادة\s*:?\s*/,
    /^تاريخ\s+الولادة\s*:?\s*/,
    /^الجنس\s*:?\s*/,
    /^الديانة\s*:?\s*/,
    /^الفئة\s*:?\s*/,
    /^القيد\s*:?\s*/,
    /^أمانة\s+القيد\s*:?\s*/,
    /^الخانة\s*:?\s*/,
    /^التاريخ\s*:?\s*/,
  ];

  const noiseKeywords = [
    'الجمهورية',
    'العربية',
    'السورية',
    'وزارة',
    'الداخلية',
    'الشؤون',
    'المدنية',
    'البطاقة',
    'الشخصية',
    'هوية',
    'سورية',
    'بطاقة',
    'الرقم',
    'الوطني',
    'مكان',
    'الولادة',
    'تاريخ',
    'الجنس',
    'الخانة',
    'أمانة',
    'القيد',
    'محافظة',
    'الاسم',
    'اسم',
    'النسبة',
    'نسبة',
    'الكنية',
    'كنية',
    'اسم الأب',
    'الأب',
    'اسم الأم',
    'الأم',
    'الديانة',
    'الفئة',
  ];

  const cleanArabicLines: string[] = [];
  for (const line of lines) {
    const rawLine = line.trim();
    const arabicOnly = rawLine.replace(/[^\u0600-\u06FF\s:]/g, '').trim();
    if (!arabicOnly) continue;

    // Explicit label extraction
    const mMother = arabicOnly.match(/^(?:اسم\s+الأم|الأم)\s*:?\s*(.+)$/);
    if (mMother && mMother[1]) {
      const val = mMother[1].trim().split(/\s+/)[0];
      if (val && !noiseKeywords.includes(val)) motherName = val;
      continue;
    }
    const mFather = arabicOnly.match(/^(?:اسم\s+الأب|الأب)\s*:?\s*(.+)$/);
    if (mFather && mFather[1]) {
      const val = mFather[1].trim().split(/\s+/)[0];
      if (val && !noiseKeywords.includes(val)) fatherName = val;
      continue;
    }
    const mFamily = arabicOnly.match(/^(?:النسبة|الكنية)\s*:?\s*(.+)$/);
    if (mFamily && mFamily[1]) {
      const val = mFamily[1].trim();
      if (val && !noiseKeywords.includes(val)) lastName = val;
      continue;
    }
    const mName = arabicOnly.match(/^الاسم\s*:?\s*(.+)$/);
    if (mName && mName[1]) {
      const restWords = mName[1].trim().split(/\s+/).filter((w) => !noiseKeywords.includes(w));
      if (restWords.length >= 3) {
        firstName = restWords[0];
        fatherName = restWords[1];
        lastName = restWords.slice(2).join(' ');
      } else if (restWords.length === 2) {
        firstName = restWords[0];
        lastName = restWords[1];
      } else if (restWords.length === 1) {
        firstName = restWords[0];
      }
      continue;
    }

    // Strip labels and store cleaned line
    let cleaned = arabicOnly.replace(/:/g, ' ').trim();
    for (const p of labelPatterns) {
      cleaned = cleaned.replace(p, '').trim();
    }

    if (cleaned.length >= 2) {
      const isNoise = noiseKeywords.some((kw) => cleaned === kw || cleaned.includes(kw));
      if (!isNoise) {
        cleanArabicLines.push(cleaned);
      }
    }
  }

  // Name extraction logic from positional lines if not already extracted via labels
  if (!firstName && !fatherName && !lastName) {
    if (cleanArabicLines.length >= 3) {
      firstName = cleanArabicLines[0].split(/\s+/)[0] || '';
      fatherName = cleanArabicLines[1].split(/\s+/)[0] || '';
      lastName = cleanArabicLines[2].split(/\s+/)[0] || '';
      if (!motherName && cleanArabicLines.length >= 4) {
        motherName = cleanArabicLines[3].split(/\s+/)[0] || '';
      }
    } else if (cleanArabicLines.length === 1 || cleanArabicLines.length === 2) {
      const words = cleanArabicLines[0].split(/\s+/).filter((w) => !noiseKeywords.includes(w));
      if (words.length >= 3) {
        firstName = words[0];
        fatherName = words[1];
        lastName = words.slice(2).join(' ');
      } else if (words.length === 2) {
        firstName = words[0];
        lastName = words[1];
      }
      if (!motherName && cleanArabicLines.length === 2) {
        motherName = cleanArabicLines[1];
      }
    }
  }

  // Forbidden Name filtering (Defense-in-depth against stray labels)
  const forbiddenNameWords = [
    'الاسم',
    'اسم',
    'النسبة',
    'نسبة',
    'الكنية',
    'كنية',
    'أب',
    'الأب',
    'أم',
    'الأم',
    'الجمهورية',
    'العربية',
    'السورية',
    'الهوية',
    'بطاقة',
    'رقم',
    'الرقم',
    'الوطني',
    'تاريخ',
    'مكان',
    'الولادة',
    'الجنس',
    'الخانة',
  ];

  if (forbiddenNameWords.includes(firstName) || firstName.length < 2) {
    firstName = '';
  }
  if (forbiddenNameWords.includes(fatherName) || fatherName.length < 2) {
    fatherName = '';
  }
  if (forbiddenNameWords.includes(lastName) || lastName.length < 2) {
    lastName = '';
  }
  if (forbiddenNameWords.includes(motherName) || motherName.length < 2) {
    motherName = '';
  }

  // 4. City / Governorate detection
  const syrianCities = [
    'دمشق',
    'ريف دمشق',
    'حلب',
    'حمص',
    'حماة',
    'اللاذقية',
    'طرطوس',
    'إدلب',
    'درعا',
    'السويداء',
    'القنيطرة',
    'دير الزور',
    'الرقة',
    'الحسكة',
  ];
  for (const city of syrianCities) {
    if (cleanRaw.includes(city)) {
      detectedCity = city;
      break;
    }
  }

  // Normalize full name
  const norm = normalizeCustomerNames({
    firstName,
    fatherName,
    lastName,
  });
  fullName = norm.fullName;
  firstName = norm.firstName;
  fatherName = norm.fatherName;
  lastName = norm.lastName;
  if (motherName) {
    motherName = motherName.replace(/ه$/, 'ة').trim();
  }

  // 4. Calculate Confidence Score
  let score = 0;
  let totalWeight = 0;

  // National ID weight: 40%
  totalWeight += 40;
  const nidStatus: 'verified' | 'unverified' | 'empty' =
    nationalId && nationalId.length === 11 ? 'verified' : nationalId ? 'unverified' : 'empty';
  if (nidStatus === 'verified') score += 40;

  // Birth date weight: 20%
  totalWeight += 20;
  const bDateStatus: 'verified' | 'unverified' | 'empty' = birthDate ? 'verified' : 'empty';
  if (bDateStatus === 'verified') score += 20;

  // Triple Name weight: 30%
  totalWeight += 30;
  const nameStatus: 'verified' | 'unverified' | 'empty' =
    firstName && fatherName && lastName ? 'verified' : firstName ? 'unverified' : 'empty';
  if (nameStatus === 'verified') score += 30;
  else if (nameStatus === 'unverified') score += 15;

  // Mother name weight: 10%
  totalWeight += 10;
  const motherStatus: 'verified' | 'unverified' | 'empty' = motherName ? 'verified' : 'empty';
  if (motherStatus === 'verified') score += 10;

  const confidence = Math.min(100, Math.round((score / totalWeight) * 100));

  return {
    firstName,
    fatherName,
    lastName,
    fullName,
    motherName,
    nationalId,
    birthDate,
    city: detectedCity,
    confidence,
    rawText: cleanRaw,
    fieldsStatus: {
      nationalId: nidStatus,
      birthDate: bDateStatus,
      name: nameStatus,
      motherName: motherStatus,
    },
  };
}
