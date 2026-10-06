import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 66 Courier Delivery Adjustments Test');
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

const handoverModalContent = fs.readFileSync('src/components/DeliveryHandoverModal.tsx', 'utf-8');

// 1. Recipient Name expansion (no truncate, break-words)
assert(
  !handoverModalContent.includes('text-xs truncate">{parcel.receiver.name}'),
  '1. Truncate class removed from recipient name display'
);
assert(
  handoverModalContent.includes('break-words leading-tight">{parcel.receiver.name}'),
  '1. Recipient name uses break-words and leading-tight for full visibility'
);

// 2. Barcode scanner section in single row
assert(
  handoverModalContent.includes('BARCODE SCANNER SECTION (قارئ الهوية الرقمية - سطر واحد مدمج)'),
  '2. Barcode scanner section comments and structure updated to single-line'
);
assert(
  handoverModalContent.includes('placeholder="قارئ الهوية: انقر هنا وامسح باركود الهوية..."'),
  '2. Single-line barcode scanner input placeholder present'
);

// 3. Remove "المحافظة" and "11/11" from national ID row
assert(
  !handoverModalContent.includes('{nationalId.length}/11 رقم'),
  '3. Counter "11/11" removed from national ID row'
);
assert(
  !handoverModalContent.includes('{detectedGov}'),
  '3. "المحافظة" badge removed from national ID row'
);
assert(
  handoverModalContent.includes('<span>الرقم الوطني:</span>'),
  '3. Label "الرقم الوطني:" is clean'
);

// 4. Remove Civil Record (الخانة والقيد)
assert(
  !handoverModalContent.includes('الخانة والقيد المدني:'),
  '4. Civil record (الخانة والقيد) field removed from JSX'
);

// 5. Remove Birth Place (محل الولادة)
assert(
  !handoverModalContent.includes('محل الولادة / المحافظة:'),
  '5. Birth place (محل الولادة) field removed from JSX'
);

// 6. Label "تاريخ الولادة" only
assert(
  handoverModalContent.includes('<span>تاريخ الولادة:</span>') &&
  !handoverModalContent.includes('<span>تاريخ الولادة (أرقام فقط):</span>'),
  '6. Birth date label is exactly "تاريخ الولادة:" without suffix'
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
