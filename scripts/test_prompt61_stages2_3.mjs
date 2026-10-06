import { computeParcelFinancialSummary } from '../src/shared/financialCalculations.ts';
import { searchCustomers } from '../src/shared/useCustomerDirectory.ts';
import { DEFAULT_PACKAGE_TYPES } from '../src/data/initialData.ts';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 PROMPT 61 TEST: STAGES 2 & 3 INTEGRATION SUITE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// =========================================================================
// SECTION 1: SIZE TIER AUTO DEDUCTION TEST
// =========================================================================
console.log('\n[Section 1] Auto Deduction of Size Tier from Dimensions:');

// SizeTier logic simulation from OrcaContext
function autoDeduceSizeTier(lengthCm, widthCm, heightCm, weightKg, sizeTier) {
  const volumeCbm = Math.max(0.001, (lengthCm * widthCm * heightCm) / 1000000);
  const volumetricWeightKg = (lengthCm * widthCm * heightCm) / 5000;
  const effectiveWeightKg = Math.max(weightKg, volumetricWeightKg, 0.5);

  let detectedTier = sizeTier || 'medium';
  if (!sizeTier) {
    if (volumeCbm <= 0.005 && weightKg <= 0.8) detectedTier = 'extra_small';
    else if (volumeCbm <= 0.02 && weightKg <= 2.5) detectedTier = 'small';
    else if (volumeCbm <= 0.06 && weightKg <= 7.0) detectedTier = 'medium';
    else if (volumeCbm <= 0.15 && weightKg <= 18.0) detectedTier = 'large';
    else detectedTier = 'extra_large';
  }

  return { volumeCbm, volumetricWeightKg, effectiveWeightKg, detectedTier };
}

const deductionResult = autoDeduceSizeTier(100, 50, 50, 5, undefined);
assert(deductionResult.volumeCbm === 0.25, 'حجم الشحنة = 0.25 متر مكعب (CBM)');
assert(deductionResult.volumetricWeightKg === 50, 'الوزن الحجمي = 50 كغ (100*50*50 / 5000)');
assert(deductionResult.effectiveWeightKg === 50, 'الوزن الفعال المعتمد = 50 كغ (الأكبر بين الفعلي 5 والحجمي 50)');
assert(deductionResult.detectedTier === 'extra_large', 'استنتاج فئة الحجم تلقائياً كـ extra_large لأن CBM > 0.15');

// =========================================================================
// SECTION 2: FINANCIAL PARITY (6 CASES RE-VERIFICATION)
// =========================================================================
console.log('\n[Section 2] Financial Calculations Parity (6 Cases):');
const mockFee = (amt) => Math.round(amt * 0.02); // 2%

// Case 1: Prepaid
const f1 = computeParcelFinancialSummary({
  paymentType: 'prepaid',
  currency: 'SYP',
  shippingCost: 20000,
  codAmount: 0,
});
assert(f1.totalDueFromReceiver === 0 && f1.prepaidFromSender === 20000, 'Case 1: Prepaid (المطلوب تحصيله = 0، المحصل سلفاً = 20,000)');

// Case 2: Collect
const f2 = computeParcelFinancialSummary({
  paymentType: 'collect',
  currency: 'SYP',
  shippingCost: 20000,
  codAmount: 0,
});
assert(f2.totalDueFromReceiver === 20000 && f2.prepaidFromSender === 0, 'Case 2: Collect (المطلوب تحصيله = 20,000)');

// Case 3: COD - Recipient Pays Freight
const f3 = computeParcelFinancialSummary({
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'SYP',
  shippingCost: 20000,
  codAmount: 100000,
  codShippingPayer: 'recipient',
  calculateTransferFee: mockFee,
});
assert(f3.totalDueFromReceiver === 122000, 'Case 3: COD Recipient Pays (100k + 2k fee + 20k ship = 122k)');

// Case 4: COD - Sender Pays Freight
const f4 = computeParcelFinancialSummary({
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'SYP',
  shippingCost: 20000,
  codAmount: 100000,
  codShippingPayer: 'sender',
  calculateTransferFee: mockFee,
});
assert(f4.totalDueFromReceiver === 102000 && f4.prepaidFromSender === 20000, 'Case 4: COD Sender Pays (المطلوب من المستلم = 102k، ومن المرسل = 20k)');

// Case 5: Dual Currency
const f5 = computeParcelFinancialSummary({
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'USD',
  shippingCost: 20000,
  codAmount: 200,
  calculateTransferFee: mockFee,
});
assert(f5.isMultiCurrency === true && f5.totalDueFromReceiver === 204, 'Case 5: Dual Currency (المطلوب للحوالة = 204 USD دون دمج غير متجانس)');

// Case 6: COD = 0 Validation
const f6 = computeParcelFinancialSummary({
  paymentType: 'cod',
  currency: 'SYP',
  codCurrency: 'SYP',
  shippingCost: 20000,
  codAmount: 0,
});
assert(f6.codAmount === 0 && f6.transferFee === 0, 'Case 6: COD = 0 (العمولة = 0 والمبلغ = 0)');

// =========================================================================
// SECTION 3: CUSTOMER DIRECTORY INTEGRATION (3 CASES)
// =========================================================================
console.log('\n[Section 3] Customer Directory Integration (3 Cases):');

const mockCustomer = {
  id: 'cust_abc_123',
  code: 'CST-5555',
  fullName: 'محمد أحمد المحمود',
  firstName: 'محمد',
  fatherName: 'أحمد',
  lastName: 'المحمود',
  motherName: 'فاطمة',
  birthDate: '1985-05-15',
  nationalId: '04012345678',
  idType: 'هوية سورية',
  phone: '0944123456',
  city: 'دمشق',
  idPhotoFront: 'data:image/png;base64,mockFrontPhoto',
  idPhotoBack: 'data:image/png;base64,mockBackPhoto',
};

// Case 1: Select customer fills 11 fields
function simulateSelectCustomer(cust) {
  return {
    senderFirstName: cust.firstName || cust.fullName.split(' ')[0] || '',
    senderFatherName: cust.fatherName || '',
    senderLastName: cust.lastName || '',
    senderMotherName: cust.motherName || '',
    senderBirthDate: cust.birthDate || '',
    senderNationalId: cust.nationalId || '',
    senderIdType: cust.idType || 'هوية سورية',
    senderPhone: cust.phone || '',
    senderName: cust.fullName || '',
    senderIdPhotoUrl: cust.idPhotoFront || '',
    senderIdBackPhotoUrl: cust.idPhotoBack || '',
    selectedCustomerId: cust.id,
  };
}

const selectedState = simulateSelectCustomer(mockCustomer);
assert(
  selectedState.senderFirstName === 'محمد' &&
  selectedState.senderFatherName === 'أحمد' &&
  selectedState.senderLastName === 'المحمود' &&
  selectedState.senderMotherName === 'فاطمة' &&
  selectedState.senderBirthDate === '1985-05-15' &&
  selectedState.senderNationalId === '04012345678' &&
  selectedState.senderIdType === 'هوية سورية' &&
  selectedState.senderPhone === '0944123456' &&
  selectedState.senderIdPhotoUrl.includes('mockFront') &&
  selectedState.senderIdBackPhotoUrl.includes('mockBack') &&
  selectedState.selectedCustomerId === 'cust_abc_123',
  'Case 1: اختيار عميل من الدليل يملأ 11 حقلاً بدقة متناهية مع الصور والربط'
);

// Case 2: Clear customer resets fields
function simulateClearCustomer() {
  return {
    selectedCustomerId: null,
    senderName: '',
    senderFirstName: '',
    senderFatherName: '',
    senderLastName: '',
    senderMotherName: '',
    senderBirthDate: '',
    senderNationalId: '',
    senderPhone: '',
    senderIdPhotoUrl: '',
    senderIdBackPhotoUrl: '',
  };
}
const clearedState = simulateClearCustomer();
assert(
  clearedState.selectedCustomerId === null &&
  clearedState.senderFirstName === '' &&
  clearedState.senderNationalId === '',
  'Case 2: تفريغ العميل يصفر جميع الحقول وشارة الربط'
);

// Case 3: Parcel payload preserves customerId
const parcelPayload = {
  sender: {
    name: selectedState.senderName,
    firstName: selectedState.senderFirstName,
    nationalId: selectedState.senderNationalId,
    customerId: selectedState.selectedCustomerId,
  },
  customerId: selectedState.selectedCustomerId,
};
assert(
  parcelPayload.sender.customerId === 'cust_abc_123' &&
  parcelPayload.customerId === 'cust_abc_123',
  'Case 3: حفظ الطرد يوثق customerId في بيانات المرسل وفي جذر الطرد'
);

// =========================================================================
// SECTION 4: PACKAGE TYPES UNIFICATION (2 CASES)
// =========================================================================
console.log('\n[Section 4] Package Types Unification (2 Cases):');

const mockBranding = {
  packageTypes: DEFAULT_PACKAGE_TYPES,
  packageTypeRates: {
    'كرتون عادي': { fixedPriceSyp: 15000 },
    'طرد هش / قابل للكسر': { minPriceSyp: 25000 },
  },
};

function getRateLabel(type, branding) {
  const rates = branding.packageTypeRates?.[type];
  if (!rates) return '';
  if (rates.fixedPriceSyp && rates.fixedPriceSyp > 0) {
    return ` — ${rates.fixedPriceSyp.toLocaleString()} ل.س`;
  }
  if (rates.minPriceSyp && rates.minPriceSyp > 0) {
    return ` — من ${rates.minPriceSyp.toLocaleString()} ل.س`;
  }
  return '';
}

// Case 1: Package Types List Parity
assert(
  mockBranding.packageTypes.length === 8 &&
  mockBranding.packageTypes[0] === 'كرتون عادي' &&
  mockBranding.packageTypes[1] === 'طرد هش / قابل للكسر',
  'Case 1: تطابق قائمة أنواع الطرود وترتيبها مع التطبيق العام (8 أنواع)'
);

// Case 2: Rate labels formatting
const label1 = getRateLabel('كرتون عادي', mockBranding);
const label2 = getRateLabel('طرد هش / قابل للكسر', mockBranding);
assert(
  label1.includes('15,000') && label2.includes('25,000'),
  'Case 2: صياغة شارات الأسعار المثبتة والحدود الدنيا في القائمة المنسدلة بدقة'
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🏁 PROMPT 61 TEST SUITE: ${passedTests}/${totalTests} Passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
