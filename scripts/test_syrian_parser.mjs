import { parseSyrianId } from '../src/utils/syrianIdParser.ts';

console.log('================================================================');
console.log('🧪 TEST SUITE: SYRIAN ID PARSER COMPREHENSIVE VERIFICATION');
console.log('================================================================\n');

function formatOutput(res) {
  return {
    firstName: res.firstName || null,
    fatherName: res.fatherName || null,
    lastName: res.lastName || null,
    fullName: res.fullName || null,
    motherName: res.motherName || null,
    nationalId: res.nationalId || null,
    birthDate: res.birthDate || null,
    city: res.city || null,
    confidence: res.confidence,
    fieldsStatus: res.fieldsStatus
  };
}

// Case A: Full valid text
console.log('--- Case A: Full Valid Text ---');
const caseA = parseSyrianId(`الجمهورية العربية السورية
وزارة الداخلية
محمد
أحمد
العلي
فاطمة
الرقم الوطني: 01010123456
مكان الولادة: دمشق
تاريخ الولادة: 15/05/1990`);
console.log('Result A:', JSON.stringify(formatOutput(caseA), null, 2));

// Case B: Text without national ID
console.log('\n--- Case B: Name Only (No National ID) ---');
const caseB = parseSyrianId(`محمد أحمد العلي`);
console.log('Result B:', JSON.stringify(formatOutput(caseB), null, 2));

// Case C: 10-digit National ID with "الاسم:" label (Bug verification)
console.log('\n--- Case C: 10-digit National ID with "الاسم:" Label ---');
const caseC = parseSyrianId(`الاسم: خالد عمر المحمود
الرقم الوطني: 0101012345
تاريخ الولادة: 1985-04-12`);
console.log('Result C:', JSON.stringify(formatOutput(caseC), null, 2));

// Case D: 12-digit National ID with "الاسم:" label
console.log('\n--- Case D: 12-digit National ID with "الاسم:" Label ---');
const caseD = parseSyrianId(`الاسم: سامر حسن الحسين
الرقم الوطني: 010101234567
تاريخ الولادة: 1992-10-20`);
console.log('Result D:', JSON.stringify(formatOutput(caseD), null, 2));

// Case E: Garbage / noisy input
console.log('\n--- Case E: Noisy / Garbage Text ---');
const caseE = parseSyrianId(`ءءء 123 abc !!! ??? ~~~`);
console.log('Result E:', JSON.stringify(formatOutput(caseE), null, 2));

// Test 5: Real Syrian ID card with full civil labels
console.log('\n--- Test 5: Real Syrian ID Layout with Official Field Labels ---');
const test5 = parseSyrianId(`الجمهورية العربية السورية
وزارة الداخلية
الاسم: محمد
اسم الأب: أحمد
النسبة: العلي
اسم الأم: فاطمة
الرقم الوطني: 01010123456
مكان الولادة: دمشق
تاريخ الولادة: 15/05/1990`);
console.log('Result 5:', JSON.stringify(formatOutput(test5), null, 2));

// Test 6: Reversed order Syrian ID layout
console.log('\n--- Test 6: Reversed Order ID Layout (Old/Variant Format) ---');
const test6 = parseSyrianId(`الرقم الوطني 01010123456
التاريخ 15/05/1990
الاسم محمد أحمد العلي
الأم فاطمة`);
console.log('Result 6:', JSON.stringify(formatOutput(test6), null, 2));

// Test 7: Unlabeled clean scattered ID text
console.log('\n--- Test 7: Unlabeled Clean Scattered ID Text ---');
const test7 = parseSyrianId(`محمد أحمد العلي
فاطمة
01010123456`);
console.log('Result 7:', JSON.stringify(formatOutput(test7), null, 2));

// Test 8: Negative Rejection Test
console.log('\n--- Test 8: Non-ID Image Text (Vehicle description) ---');
const test8 = parseSyrianId(`Hyundai Tucson 2022 Turbo 4WD Silver Metallic Engine 2.0L`);
console.log('Result 8:', JSON.stringify(formatOutput(test8), null, 2));

// Test 9: Spaced National ID ("0101012345 6") with typos and noise
console.log('\n--- Test 9: Spaced National ID ("0101012345 6") & Typo Normalization ---');
const test9 = parseSyrianId(`الاسم: محمد
اسم الأب: احمد
النسبة: العلى
اسم الأم: فاطمه
الرقم الوطني: 0101012345 6
تاريخ الولادة: 15/5/1990`);
console.log('Result 9:', JSON.stringify(formatOutput(test9), null, 2));

console.log('\n================================================================');
console.log('✅ ALL TEST SUITES EXECUTED');
console.log('================================================================');
