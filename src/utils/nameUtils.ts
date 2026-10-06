// Utility for normalizing and safely separating Arabic personal names
// into First Name, Father Name, and Last Name without any collisions

const COMPOUND_PREFIXES = ['عبد', 'أبو', 'ابو', 'أم', 'ام', 'ابن'];
const COMPOUND_SUFFIXES = [
  'الدين',
  'الله',
  'الرحمن',
  'الرحيم',
  'الملك',
  'القدوس',
  'السلام',
  'المؤمن',
  'المهيمن',
  'العزيز',
  'الجبار',
  'المتكبر',
  'الخالق',
  'البارئ',
  'المصور',
  'الغفار',
  'الوهاب',
  'الرزاق',
  'الفتاح',
  'العليم',
  'الباسط',
  'الحليم',
  'العظيم',
  'الكريم',
  'المجيد',
  'الصبور',
];

export interface NormalizedCustomerNames {
  fullName: string;
  firstName: string;
  fatherName: string;
  lastName: string;
}

/**
 * Splits a full name string into tokens, grouping compound words like "عبد الله" or "نور الدين"
 */
export function tokenizeArabicName(fullName: string): string[] {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const tokens: string[] = [];
  let i = 0;
  while (i < words.length) {
    const current = words[i];
    const next = words[i + 1];

    if (next && COMPOUND_PREFIXES.includes(current)) {
      tokens.push(`${current} ${next}`);
      i += 2;
    } else if (next && COMPOUND_SUFFIXES.includes(next)) {
      tokens.push(`${current} ${next}`);
      i += 2;
    } else {
      tokens.push(current);
      i += 1;
    }
  }

  return tokens;
}

/**
 * Normalizes customer name components so that firstName, fatherName, and lastName
 * are strictly distinct and never conflated, concatenated, or misaligned.
 */
export function normalizeCustomerNames(input: {
  fullName?: string;
  firstName?: string;
  fatherName?: string;
  lastName?: string;
}): NormalizedCustomerNames {
  let fName = (input.firstName || '').trim();
  let father = (input.fatherName || '').trim();
  let lName = (input.lastName || '').trim();
  const rawFullName = (input.fullName || '').trim();

  // 1. If firstName, fatherName, and lastName are already individually provided
  if (fName && father && lName) {
    // If lastName accidentally starts with fatherName (e.g. father="أحمد", lastName="أحمد العلي")
    if (lName.startsWith(father + ' ')) {
      lName = lName.substring(father.length + 1).trim();
    } else if (lName === father) {
      // If lastName is an exact duplicate of fatherName, attempt recovery from fullName
      if (rawFullName) {
        const tokens = tokenizeArabicName(rawFullName);
        if (tokens.length >= 3) {
          lName = tokens.slice(2).join(' ');
        }
      }
    }
    const resolvedFull = [fName, father, lName].filter(Boolean).join(' ');
    return {
      fullName: resolvedFull,
      firstName: fName,
      fatherName: father,
      lastName: lName,
    };
  }

  // 2. If firstName and lastName are provided, but fatherName is empty
  if (fName && !father && lName) {
    // Check if lastName contains both fatherName and family name (e.g. lastName="أحمد العلي")
    const tokens = tokenizeArabicName(lName);
    if (tokens.length >= 2) {
      father = tokens[0];
      lName = tokens.slice(1).join(' ');
    }
  }

  // 3. If firstName and fatherName are given, but lastName is empty
  if (fName && father && !lName) {
    if (rawFullName) {
      const tokens = tokenizeArabicName(rawFullName);
      // Remove tokens that match firstName and fatherName
      if (tokens.length >= 3) {
        lName = tokens.slice(2).join(' ');
      }
    }
  }

  // 4. If firstName is missing or lastName is missing, derive systematically from rawFullName
  if ((!fName || !lName) && rawFullName) {
    const tokens = tokenizeArabicName(rawFullName);
    if (tokens.length === 1) {
      if (!fName) fName = tokens[0];
    } else if (tokens.length === 2) {
      if (!fName) fName = tokens[0];
      if (!lName) lName = tokens[1];
    } else if (tokens.length >= 3) {
      if (!fName) fName = tokens[0];
      if (!father) father = tokens[1];
      if (!lName) lName = tokens.slice(2).join(' ');
    }
  }

  // 5. Final safety check: if lName still starts with father, remove the duplicated father prefix
  if (father && lName && lName.startsWith(father + ' ')) {
    lName = lName.substring(father.length + 1).trim();
  }

  const resolvedFullName = [fName, father, lName].filter(Boolean).join(' ') || rawFullName;

  return {
    fullName: resolvedFullName,
    firstName: fName,
    fatherName: father,
    lastName: lName,
  };
}

/**
 * Normalizes a phone number for comparison (strips non-digits, country codes 00963, +963, 963, leading 0)
 */
export function normalizePhoneForComparison(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00963')) digits = digits.slice(5);
  else if (digits.startsWith('963')) digits = digits.slice(3);
  while (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/**
 * Normalizes Arabic text for collision-free comparison
 * Unifies alef forms (أ، إ، آ -> ا), taa marbouta (ة -> ه), and yaa (ى -> ي)
 */
export function normalizeArabicComparison(text?: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // strip tashkeel/diacritics
    .replace(/\s+/g, ' ');
}

/**
 * Generates a canonical deduplication key for a customer record
 */
export function getCanonicalCustomerKey(c: {
  id?: string;
  nationalId?: string;
  phone?: string;
  secondaryPhone?: string;
  fullName?: string;
}): string {
  const nid = (c.nationalId || '').replace(/\D/g, '');
  if (nid.length >= 7) return `nid_${nid}`;

  const phone = normalizePhoneForComparison(c.phone);
  if (phone.length >= 6) return `ph_${phone}`;

  const secPhone = normalizePhoneForComparison(c.secondaryPhone);
  if (secPhone.length >= 6) return `ph_${secPhone}`;

  const name = normalizeArabicComparison(c.fullName);
  if (name.length >= 3) return `name_${name}`;

  return c.id ? `id_${c.id}` : `unknown_${Math.random()}`;
}

/**
 * Checks if two customer records represent the same person to strictly prevent duplicates
 */
export function isSameCustomer(
  a: { id?: string; nationalId?: string; phone?: string; secondaryPhone?: string; fullName?: string },
  b: { id?: string; nationalId?: string; phone?: string; secondaryPhone?: string; fullName?: string }
): boolean {
  if (a.id && b.id && a.id === b.id) return true;

  const nidA = (a.nationalId || '').replace(/\D/g, '');
  const nidB = (b.nationalId || '').replace(/\D/g, '');
  if (nidA.length >= 7 && nidB.length >= 7 && nidA === nidB) return true;

  const phoneA = normalizePhoneForComparison(a.phone);
  const secPhoneA = normalizePhoneForComparison(a.secondaryPhone);
  const phoneB = normalizePhoneForComparison(b.phone);
  const secPhoneB = normalizePhoneForComparison(b.secondaryPhone);

  if (phoneA.length >= 6) {
    if (phoneB.length >= 6 && phoneA === phoneB) return true;
    if (secPhoneB.length >= 6 && phoneA === secPhoneB) return true;
  }
  if (secPhoneA.length >= 6) {
    if (phoneB.length >= 6 && secPhoneA === phoneB) return true;
    if (secPhoneB.length >= 6 && secPhoneA === secPhoneB) return true;
  }

  const nameA = normalizeArabicComparison(a.fullName);
  const nameB = normalizeArabicComparison(b.fullName);
  if (nameA.length >= 3 && nameB.length >= 3 && nameA === nameB) {
    // If names match, check if either has phone that contradicts
    if (phoneA && phoneB && phoneA !== phoneB) {
      // Different phone numbers might be different people with same common name,
      // unless one is a substring of the other or one has missing phone
      return false;
    }
    return true;
  }

  return false;
}
