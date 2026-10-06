import { Parcel, Customer } from '../types';
import { phonesMatch } from './phoneUtils';
import { normalizeArabicComparison } from './nameUtils';

export function normalizeNid(nid: string): string {
  return String(nid || '').replace(/\D/g, '');
}

export interface SenderVerificationResult {
  verified: boolean;
  source: 'parcel' | 'customer' | 'none';
  mismatchFields: string[];
  message: string;
}

export function verifySenderIdentity(
  parcel: Parcel,
  entered: {
    nationalId: string;
    motherName: string;
    birthDate: string;
  },
  customers: Customer[]
): SenderVerificationResult {
  // 1. تحديد المصدر
  let source: any = parcel.sender || {};
  let sourceType: 'parcel' | 'customer' | 'none' = 'parcel';

  // إذا البوليصة بدون NID → ابحث في customers بالهاتف
  if (!source.nationalId && source.phone) {
    const customerMatch = customers.find((c) =>
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

  // 2. فحص البيانات الكافية
  const sourceNid = normalizeNid(source.nationalId || '');
  const sourceMother = String(source.motherName || '').trim();
  const sourceBirth = String(source.birthDate || '').trim();

  // إذا لا يوجد NID في المصدر → رفض
  if (sourceNid.length !== 11) {
    return {
      verified: false,
      source: sourceType,
      mismatchFields: ['الرقم الوطني (غير مسجل في البوليصة)'],
      message: '⚠️ لا يمكن التحقق — البوليصة لا تحتوي على رقم وطني مسجل للمرسل. يرجى مراجعة إدارة الفرع.',
    };
  }

  const mismatches: string[] = [];
  const enteredNid = normalizeNid(entered.nationalId);
  const enteredMother = String(entered.motherName || '').trim();
  const enteredBirth = String(entered.birthDate || '').trim();

  // 3. الرقم الوطني (إلزامي - دائماً)
  if (enteredNid.length !== 11) {
    mismatches.push('الرقم الوطني غير مكتمل (11 رقماً)');
  } else if (enteredNid !== sourceNid) {
    mismatches.push('الرقم الوطني غير مطابق');
  }

  // 4. اسم الأم (إذا مسجل في المصدر)
  if (sourceMother.length >= 2) {
    if (!enteredMother) {
      mismatches.push('اسم الأم مطلوب للتحقق');
    } else if (normalizeArabicComparison(enteredMother) !== normalizeArabicComparison(sourceMother)) {
      mismatches.push('اسم الأم غير مطابق');
    }
  }

  // 5. تاريخ الولادة (إذا مسجل في المصدر)
  if (sourceBirth.length >= 8) {
    if (!enteredBirth) {
      mismatches.push('تاريخ الولادة مطلوب للتحقق');
    } else if (enteredBirth !== sourceBirth) {
      mismatches.push('تاريخ الولادة غير مطابق');
    }
  }

  // 6. الحكم النهائي
  if (mismatches.length > 0) {
    return {
      verified: false,
      source: sourceType,
      mismatchFields: mismatches,
      message: `❌ ${mismatches.join('، ')}`,
    };
  }

  return {
    verified: true,
    source: sourceType,
    mismatchFields: [],
    message: '✅ تم التحقق — البيانات مطابقة 100%',
  };
}
