import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 73 Phase 2 (Merge Steps) Verification Tests');
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

const modalContent = fs.readFileSync('src/components/CreateManifestFullscreenModal.tsx', 'utf-8');

// 1. Verify that currentStep and Step 2 wrapper are removed
assert(
  !modalContent.includes("currentStep === 'select'") &&
  !modalContent.includes("currentStep === 'audit'") &&
  !modalContent.includes("setCurrentStep('audit')") &&
  !modalContent.includes("setCurrentStep('select')"),
  '1. currentStep state and step switcher completely eliminated'
);

// 2. Verify Step Tabs removed from header
assert(
  !modalContent.includes('1. اختيار وفلترة الطرود') &&
  !modalContent.includes('2. التدقيق والمعاينة النهائية') &&
  !modalContent.includes('handleProceedToAudit'),
  '2. Step tabs and handleProceedToAudit removed from header'
);

// 3. Verify securitySealNumber is included in the top settings strip
assert(
  modalContent.includes('الرصاصة الأمنية') &&
  modalContent.includes('value={securitySealNumber}') &&
  modalContent.includes('onChange={(e) => setSecuritySealNumber(e.target.value)}'),
  '3. Security seal number input integrated into top settings strip'
);

// 4. Verify manifestNotes input is included
assert(
  modalContent.includes('ملاحظات المانافيست الرسمية') &&
  modalContent.includes('value={manifestNotes}') &&
  modalContent.includes('onChange={(e) => setManifestNotes(e.target.value)}'),
  '4. Manifest notes input integrated into bottom notes strip'
);

// 5. Verify direct Save & Print in Footer
assert(
  modalContent.includes('id="btn_confirm_and_save_manifest"') &&
  modalContent.includes('حفظ واعتماد المانافيست ◄') &&
  modalContent.includes('openPrintModal(\'manifest_a4\', previewManifest)'),
  '5. Direct save button and print preview button active in single unified footer'
);

// 6. Verify total weight & parcel count in Footer
assert(
  modalContent.includes('formatQuantity(totalWeightKg, \'weight\')') &&
  modalContent.includes('selectedParcelIds.length'),
  '6. Total weight indicator and selected parcels count rendered in footer'
);

// 7. Verify handleFinalSave does all validations and conflict checks
assert(
  modalContent.includes('if (!destinationHubId)') &&
  modalContent.includes('if (!selectedParcelIds || selectedParcelIds.length === 0)') &&
  modalContent.includes('if (!driverName.trim())') &&
  modalContent.includes('if (!truckPlate.trim())') &&
  modalContent.includes('createTruckManifest(') &&
  modalContent.includes('openPrintModal(\'manifest_a4\', newManifest)'),
  '7. handleFinalSave runs full validation, creates manifest, and triggers official A4 print modal'
);

// 8. Verify Table and Mobile Cards
assert(
  modalContent.includes('hidden sm:block') &&
  modalContent.includes('sm:hidden p-3 space-y-2') &&
  modalContent.includes('💵 تحصيل COD') &&
  modalContent.includes('📋 على المستلم') &&
  modalContent.includes('✅ مدفوع سلفاً'),
  '8. Responsive table (desktop) and cards (mobile) rendered with payment badges'
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
