import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 65 Thermal vs A4 Print Verification Tests');
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

const cssContent = fs.readFileSync('src/index.css', 'utf-8');

// 1. Verify that universal unconditioned @page is removed from index.css
assert(
  !cssContent.includes('@media print {\n  *\n  @page {\n    size: A4 portrait;\n    margin: 0;\n  }') &&
  !cssContent.match(/@media print\s*\{\s*[^}]*@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*0;\s*\}/),
  '1. Universal unconditioned @page removed from root @media print'
);

// 2. Verify body.print-a4 @page and body.print-thermal @page
assert(
  cssContent.includes('body.print-a4 @page') &&
  cssContent.includes('size: A4 portrait;') &&
  cssContent.includes('body.print-thermal @page') &&
  cssContent.includes('size: 80mm 200mm;'),
  '2. Scoped @page rules for body.print-a4 and body.print-thermal configured in index.css'
);

// 3. Verify #thermal-receipt-printable has compact 80mm width in index.css
assert(
  cssContent.includes('#thermal-receipt-printable {') &&
  cssContent.includes('width: 80mm !important;') &&
  cssContent.includes('max-width: 80mm !important;'),
  '3. #thermal-receipt-printable isolated with 80mm width in index.css'
);

// 4. Verify storage.ts print helpers
const storageContent = fs.readFileSync('src/utils/storage.ts', 'utf-8');
assert(
  storageContent.includes("export const setPrintMode = (mode: 'a4' | 'thermal'") &&
  storageContent.includes("export const clearPrintMode = ()") &&
  storageContent.includes("export function safePrint(mode: 'a4' | 'thermal'"),
  '4. setPrintMode, clearPrintMode, and safePrint(mode) implemented in storage.ts'
);

// 5. Verify CourierThermalReceiptModal.tsx implementation
const thermalModalContent = fs.readFileSync('src/components/CourierThermalReceiptModal.tsx', 'utf-8');
assert(
  thermalModalContent.includes("import { safePrint } from '../utils/storage';") &&
  thermalModalContent.includes("safePrint(mode)") &&
  !thermalModalContent.includes("document.createElement('style')") &&
  thermalModalContent.includes('id="thermal-receipt-printable"'),
  '5. CourierThermalReceiptModal uses clean safePrint without inline style tags'
);

// 6. Verify PrintModal.tsx uses safePrint() for A4 printing
const printModalContent = fs.readFileSync('src/components/PrintModal.tsx', 'utf-8');
assert(
  printModalContent.includes('safePrint()') || printModalContent.includes("safePrint('a4')"),
  '6. PrintModal uses safePrint for standard A4 document printing'
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
