import { validateParcelForm } from '../src/shared/parcelValidation.ts';
import { computeParcelFinancialSummary } from '../src/shared/financialCalculations.ts';
import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 62 Field Adjustments Test Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// Test 1: ID Card Photo Validation (Both faces required)
// -----------------------------------------------------------------------------
console.log('\n--- 1. Testing Mandatory ID Photos (Front & Back) ---');

const baseValidInput = {
  packageType: 'كرتون عادي',
  senderFirstName: 'أحمد',
  senderFatherName: 'محمد',
  senderLastName: 'الحسن',
  senderMotherName: 'فاطمة',
  senderBirthDate: '1990-05-15',
  senderNationalId: '01010101010',
  senderPhone: '0933112233',
  receiverName: 'خالد علي',
  receiverPhone: '0944112233',
  destinationHubId: 'hub-aleppo',
  originHubId: 'hub-damascus',
  destinationAddress: 'حلب - العزيزية',
  activeShippingCost: 15000,
  weightKg: 1,
  packageNotes: 'طرد عادي',
  contentDescription: 'أوراق رسمية',
  paymentType: 'collect',
};

// Case 1.1: Front only
const resFrontOnly = validateParcelForm({
  ...baseValidInput,
  senderIdPhotoFront: 'photo_front_key',
  senderIdPhotoBack: '',
});
assert(!resFrontOnly.valid, 'Front photo only should fail validation');
assert(
  resFrontOnly.errors.some((e) => e.includes('الوجه الأمامي والوجه الخلفي')),
  'Front photo only error message mentions both faces'
);

// Case 1.2: Back only
const resBackOnly = validateParcelForm({
  ...baseValidInput,
  senderIdPhotoFront: '',
  senderIdPhotoBack: 'photo_back_key',
});
assert(!resBackOnly.valid, 'Back photo only should fail validation');
assert(
  resBackOnly.errors.some((e) => e.includes('الوجه الأمامي والوجه الخلفي')),
  'Back photo only error message mentions both faces'
);

// Case 1.3: Neither
const resNeither = validateParcelForm({
  ...baseValidInput,
  senderIdPhotoFront: '',
  senderIdPhotoBack: '',
});
assert(!resNeither.valid, 'No photos should fail validation');

// Case 1.4: Both present
const resBoth = validateParcelForm({
  ...baseValidInput,
  senderIdPhotoFront: 'photo_front_key',
  senderIdPhotoBack: 'photo_back_key',
});
assert(resBoth.valid, 'Both photos present should pass validation');

// -----------------------------------------------------------------------------
// Test 2: Verify Code in CourierMobileIntake.tsx
// -----------------------------------------------------------------------------
console.log('\n--- 2. Verifying CourierMobileIntake.tsx Structure ---');

const intakeCode = fs.readFileSync('src/components/CourierMobileIntake.tsx', 'utf-8');

// Check header does not have route span
assert(
  !intakeCode.includes('{originHub.governorate} ➔ {destGovernorate}'),
  'Header route span [originHub.governorate ➔ destGovernorate] is removed from header'
);

// Check progress indicator exists
assert(
  intakeCode.includes('{completedFieldsCount}/10'),
  'Progress indicator [X/10] is present in header'
);

// Check dimensions inputs are removed from CourierMobileIntake
assert(
  !intakeCode.includes('setLengthCm') && !intakeCode.includes('setWidthCm') && !intakeCode.includes('setHeightCm'),
  'Dimensions state (lengthCm, widthCm, heightCm) removed from CourierMobileIntake'
);

// Check calculatePrice uses default 20, 20, 20
assert(
  intakeCode.includes('20,\n      20,\n      20,'),
  'calculatePrice uses 20, 20, 20 fixed dimensions in CourierMobileIntake'
);

// Check financial card does not display technical pricing engine breakdown
assert(
  !intakeCode.includes('أجرة محرك التسعير:'),
  'Financial card does NOT display technical "أجرة محرك التسعير:" breakdown'
);

// Check submit button has "حفظ وطباعة البوليصة"
assert(
  intakeCode.includes('حفظ وطباعة البوليصة'),
  'Sticky submit button is labeled "حفظ وطباعة البوليصة"'
);

// Check badge states for ID photos
assert(
  intakeCode.includes('✅ الهوية مكتملة') &&
  intakeCode.includes('🔴 الوجه الثاني مطلوب') &&
  intakeCode.includes('🔴 صورتا الهوية مطلوبتان'),
  'ID photos badges correctly reflect 3 states (both, one, none)'
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
