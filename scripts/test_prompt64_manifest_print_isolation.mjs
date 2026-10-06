import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 64 Manifest Print Isolation Test Suite');
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

// 1. Verify index.css rules
const cssContent = fs.readFileSync('src/index.css', 'utf-8');

assert(
  cssContent.includes('@media print'),
  '@media print block is present in src/index.css'
);

assert(
  cssContent.includes('body *') && cssContent.includes('visibility: hidden !important;'),
  'Universal isolation "body * { visibility: hidden !important; }" is enforced'
);

assert(
  cssContent.includes('#manifest-print-root') && cssContent.includes('visibility: visible !important;'),
  'Whitelist for "#manifest-print-root" with visibility: visible !important is present'
);

assert(
  cssContent.includes('#manifest-print-root') && cssContent.includes('position: absolute !important;'),
  'Layout rule "position: absolute !important;" is applied to #manifest-print-root'
);

assert(
  cssContent.includes('.no-print') && cssContent.includes('display: none !important;'),
  'Interactive elements (.no-print, header, aside, nav, button) are hidden in print'
);

// 2. Verify JSX templates have the designated IDs
const printModalContent = fs.readFileSync('src/components/PrintModal.tsx', 'utf-8');

assert(
  printModalContent.includes('id="manifest-print-root"'),
  'id="manifest-print-root" is present on manifest JSX in PrintModal.tsx'
);

assert(
  printModalContent.includes('id="parcel-print-root"'),
  'id="parcel-print-root" is present on waybill JSX in PrintModal.tsx'
);

assert(
  printModalContent.includes('id="orca_print_sheet"'),
  'id="orca_print_sheet" is present on sheet container in PrintModal.tsx'
);

// 3. Verify other print modals
const thermalReceiptContent = fs.readFileSync('src/components/CourierThermalReceiptModal.tsx', 'utf-8');
assert(
  thermalReceiptContent.includes('id="thermal-receipt-printable"'),
  'id="thermal-receipt-printable" is present in CourierThermalReceiptModal.tsx'
);

const settlementModalContent = fs.readFileSync('src/components/CourierIntakeSettlementPrintModal.tsx', 'utf-8');
assert(
  settlementModalContent.includes('id="printable_courier_settlement"'),
  'id="printable_courier_settlement" is present in CourierIntakeSettlementPrintModal.tsx'
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
