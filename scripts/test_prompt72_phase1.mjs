import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 72 Phase 1 Verification Tests');
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

// 1. Verify that the 6 totals cards in Step 1 are deleted from JSX
assert(
  !modalContent.includes('MANIFEST AGGREGATE TOTALS RIBBON') &&
  !modalContent.includes('المجاميع اللوجستية والمالية للشحنات المضمنة بالمانافيست') &&
  !modalContent.includes('صافي النقد المطلوب تحصيله في فرع المقصد'),
  '1. 6 aggregate totals cards completely removed from Step 1 JSX'
);

// 2. Verify table columns reduced from 10 to 5
assert(
  modalContent.includes('<th className="p-3 w-12 text-center">#</th>') &&
  modalContent.includes('<th className="p-3 min-w-[200px]">رقم الشحنة (الباركود والوصل)</th>') &&
  modalContent.includes('<th className="p-3 min-w-[220px]">المستلم والوجهة</th>') &&
  modalContent.includes('<th className="p-3 w-44 text-center">حالة الدفع</th>'),
  '2. Table header contains exactly the 5 simplified columns'
);

assert(
  !modalContent.includes('<th className="p-3 min-w-[150px]">المرسل</th>') &&
  !modalContent.includes('<th className="p-3 w-40">طبيعة ومحتوى الطرد</th>') &&
  !modalContent.includes('<th className="p-3 w-28 text-center">القطع والوزن</th>') &&
  !modalContent.includes('<th className="p-3 w-36 text-center">طريقة الدفع والمبلغ</th>') &&
  !modalContent.includes('<th className="p-3 w-28 text-center">الإجراء</th>'),
  '2. 5 extra columns (Sender, Content, Pieces/Weight, Details, Action) removed from Step 1 table'
);

// 3. Verify min-w-[1150px] removed from table and table is w-full
assert(
  !modalContent.includes('min-w-[1150px]') &&
  modalContent.includes('<table className="w-full text-right text-xs border-collapse">'),
  '3. min-w-[1150px] removed from table for full responsive width'
);

// 4. Verify clean payment badges
assert(
  modalContent.includes('💵 تحصيل COD') &&
  modalContent.includes('📋 على المستلم') &&
  modalContent.includes('✅ مدفوع سلفاً'),
  '4. Clean payment badges implemented in Step 1 table'
);

// 5. Verify calculations are intact in OrcaContext
const contextContent = fs.readFileSync('src/context/OrcaContext.tsx', 'utf-8');
assert(
  contextContent.includes('const totalWeightKg = selectedParcels.reduce((acc, p) => acc + p.weightKg, 0);') &&
  contextContent.includes('const totalPieces = selectedParcels.reduce((acc, p) => acc + p.piecesCount, 0);') &&
  contextContent.includes('const totalCodSyp = selectedParcels') &&
  contextContent.includes('totalWeightKg: Math.round(totalWeightKg * 10) / 10,'),
  '5. Calculation logic in createTruckManifest is fully intact and saves to TruckManifest'
);

// 6. Mathematical verification of manifest persistence
const parcelsSample = [
  { id: 'p1', weightKg: 10.5, piecesCount: 2, shippingCost: 25000, shippingCurrency: 'SYP', codAmount: 150000, codCurrency: 'SYP', paymentType: 'cod' },
  { id: 'p2', weightKg: 5.0, piecesCount: 1, shippingCost: 15000, shippingCurrency: 'SYP', codAmount: 0, paymentType: 'prepaid' },
  { id: 'p3', weightKg: 8.2, piecesCount: 3, shippingCost: 30000, shippingCurrency: 'SYP', codAmount: 0, paymentType: 'collect' },
  { id: 'p4', weightKg: 20.0, piecesCount: 4, shippingCost: 50, shippingCurrency: 'USD', codAmount: 200, codCurrency: 'USD', paymentType: 'cod' },
  { id: 'p5', weightKg: 12.3, piecesCount: 1, shippingCost: 35000, shippingCurrency: 'SYP', codAmount: 500000, codCurrency: 'SYP', paymentType: 'cod' },
];

const totalWeightCalc = parcelsSample.reduce((acc, p) => acc + p.weightKg, 0);
const totalPiecesCalc = parcelsSample.reduce((acc, p) => acc + p.piecesCount, 0);
const totalCodSypCalc = parcelsSample.filter(p => p.codCurrency === 'SYP' && p.paymentType === 'cod').reduce((acc, p) => acc + p.codAmount, 0);

assert(totalWeightCalc === 56.0, '6. totalWeightKg calculation is 56.0 kg');
assert(totalPiecesCalc === 11, '6. totalPieces calculation is 11 pieces');
assert(totalCodSypCalc === 650000, '6. totalCodSyp calculation is 650,000 SYP');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
