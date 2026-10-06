import { Parcel, Customer } from '../types';
import { phonesMatch } from './phoneUtils';
import { normalizeArabicComparison, tokenizeArabicName } from './nameUtils';

export function normalizeNid(nid: string): string {
  return String(nid || '').replace(/\D/g, '');
}

export interface ReceiverVerificationResult {
  verified: boolean;
  source: 'parcel' | 'customer' | 'new_id';
  mismatchFields: string[];
  message: string;
}

/**
 * Validates whether entered receiver name matches the official name registered in the waybill.
 * Tolerates prefixes, differences in diacritics/alef, and presence of middle names.
 */
export function areNamesMatching(enteredFullName: string, officialFullName: string): { matches: boolean; reason?: string } {
  const normEntered = normalizeArabicComparison(enteredFullName);
  const normOfficial = normalizeArabicComparison(officialFullName);

  if (!normEntered || !normOfficial) {
    return { matches: false, reason: 'الاسم غير مكتمل' };
  }

  // Exact normalized match
  if (normEntered === normOfficial) {
    return { matches: true };
  }

  const enteredTokens = tokenizeArabicName(normEntered);
  const officialTokens = tokenizeArabicName(normOfficial);

  if (enteredTokens.length === 0 || officialTokens.length === 0) {
    return { matches: false, reason: 'الاسم غير مكتمل' };
  }

  // First name comparison
  const firstEntered = enteredTokens[0];
  const firstOfficial = officialTokens[0];
  if (firstEntered !== firstOfficial) {
    return {
      matches: false,
      reason: `الاسم الأول (${firstEntered}) لا يطابق المسجل في البوليصة (${firstOfficial})`,
    };
  }

  // If official name has 2 or more tokens, check father or family name
  if (officialTokens.length >= 2) {
    const lastOfficial = officialTokens[officialTokens.length - 1];
    const lastEntered = enteredTokens[enteredTokens.length - 1];

    const hasLastMatch =
      lastEntered === lastOfficial ||
      enteredTokens.slice(1).includes(lastOfficial) ||
      officialTokens.slice(1).includes(lastEntered);

    if (!hasLastMatch) {
      return {
        matches: false,
        reason: `الكنية أو اسم العائلة (${lastEntered}) لا يطابق المسجل في البوليصة (${lastOfficial})`,
      };
    }
  }

  return { matches: true };
}

/**
 * Strict Identity Verification Engine for Parcel Recipient Delivery Handover
 */
export function verifyReceiverIdentity(
  parcel: Parcel,
  entered: {
    receiverRelation: string;
    actualReceiverName: string;
    firstName?: string;
    fatherName?: string;
    lastName?: string;
    nationalId: string;
    motherName?: string;
    birthDate?: string;
    phone?: string;
  },
  customers: Customer[] = []
): ReceiverVerificationResult {
  const isDirectReceiver = !entered.receiverRelation || entered.receiverRelation === 'المستلم بالذات';
  const mismatches: string[] = [];

  // 1. Locate Source Records (Parcel Receiver or Customer Directory)
  let source: any = parcel.receiver || {};
  let sourceType: 'parcel' | 'customer' | 'new_id' = 'parcel';

  if (!source.nationalId && source.phone) {
    const customerMatch = (customers || []).find(
      (c) =>
        c &&
        c.phone &&
        source.phone &&
        (normalizeNid(c.phone) === normalizeNid(source.phone) || phonesMatch(c.phone, source.phone))
    );
    if (customerMatch) {
      source = { ...source, ...customerMatch };
      sourceType = 'customer';
    }
  }

  const sourceNid = normalizeNid(source.nationalId || '');
  const sourceMother = String(source.motherName || source.idMotherName || '').trim();
  const sourceBirth = String(source.birthDate || '').trim();
  const enteredNid = normalizeNid(entered.nationalId || '');
  const enteredMother = String(entered.motherName || '').trim();
  const enteredBirth = String(entered.birthDate || '').trim();

  // Strict check on 11 digits national ID
  if (enteredNid.length !== 11) {
    mismatches.push('الرقم الوطني غير مكتمل (11 رقماً حصراً)');
  }

  if (isDirectReceiver) {
    // 2. Strict Receiver Name Matching with Waybill
    const enteredFullName =
      [
        (entered.firstName || '').trim(),
        (entered.fatherName || '').trim(),
        (entered.lastName || '').trim(),
      ]
        .filter(Boolean)
        .join(' ') || (entered.actualReceiverName || '').trim();

    const officialReceiverName = (parcel.receiver?.name || '').trim();

    if (!enteredFullName) {
      mismatches.push('اسم المستلم مطلوب');
    } else if (officialReceiverName) {
      const nameCheck = areNamesMatching(enteredFullName, officialReceiverName);
      if (!nameCheck.matches) {
        mismatches.push(nameCheck.reason || 'اسم المستلم غير مطابق لاسم المستلم في البوليصة');
      }
    }

    // 3. Compare with Registered National ID (if available in parcel or directory)
    if (sourceNid && sourceNid.length === 11) {
      if (enteredNid.length === 11 && enteredNid !== sourceNid) {
        mismatches.push(
          `الرقم الوطني غير مطابق للرقم المسجل (${sourceType === 'parcel' ? 'في البوليصة' : 'في دليل العملاء'})`
        );
      }
    }

    // 4. Mother Name verification (if available in source)
    if (sourceMother && sourceMother.length >= 2) {
      if (!enteredMother) {
        mismatches.push('اسم الأم مطلوب للتحقق');
      } else if (normalizeArabicComparison(enteredMother) !== normalizeArabicComparison(sourceMother)) {
        mismatches.push('اسم الأم غير مطابق للمسجل رسمياً');
      }
    }

    // 5. Birth Date verification (if available in source)
    if (sourceBirth && sourceBirth.length >= 8) {
      const normSourceBirth = sourceBirth.replace(/\D/g, '');
      const normEnteredBirth = enteredBirth.replace(/\D/g, '');
      if (!enteredBirth) {
        mismatches.push('تاريخ الولادة مطلوب للتحقق');
      } else if (normSourceBirth && normEnteredBirth && normSourceBirth !== normEnteredBirth) {
        mismatches.push('تاريخ الولادة غير مطابق للمسجل رسمياً');
      }
    }
  } else {
    // Representative / Proxy / First-degree relative
    const repName = (entered.actualReceiverName || '').trim();
    if (!repName || repName.length < 4) {
      mismatches.push('اسم المستلم الفعلي (الوكيل/المفوض/القريب) مطلوب بالكامل');
    }
  }

  // 6. Final Verdict
  if (mismatches.length > 0) {
    return {
      verified: false,
      source: sourceNid ? sourceType : 'new_id',
      mismatchFields: mismatches,
      message: `❌ ${mismatches.join('، ')}`,
    };
  }

  return {
    verified: true,
    source: sourceNid ? sourceType : 'new_id',
    mismatchFields: [],
    message: isDirectReceiver
      ? '✅ تم التحقق — بيانات المستلم مطابقة 100% لبوليصة الشحن'
      : `✅ تم التحقق — صفة الاستلام موثقة بموجب (${entered.receiverRelation})`,
  };
}
