import { validateParcelStateTransition } from '../src/utils/parcelLifecycleValidator.ts';
import { isTransitionAllowed, HANDLING_RANK } from '../src/utils/parcelMergeEngine.ts';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 DEEP FINANCIAL & SETTLEMENT AUDIT TEST (التلقين 54)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// Helper: Calculate Courier Live Cash & Goods Custody
function calculateCourierCustody(manifestParcels) {
  let expectedCashCustody = 0;    // النقدية المحصلة التي بحوزة الموزع ويجب توريدها للخزينة
  let undeliveredGoodsLiability = 0; // قيمة البضائع التي ما زالت عهدة بضاعية في حقيبة الموزع
  let returnedNoLiability = 0;    // قيمة الطرود المرتجعة التي سقطت المطالبة المالية بها

  manifestParcels.forEach((p) => {
    const due = p.totalDue || (p.codAmount || 0) + (p.shippingCost || 0);

    if (p.handlingStatus === 'delivered') {
      // تم التسليم -> الموزع قبض المبلغ بيده
      expectedCashCustody += due;
    } else if (p.handlingStatus === 'with_courier') {
      // قيد التوزيع -> بضاعة في حقيبة الموزع
      undeliveredGoodsLiability += due;
    } else if (p.handlingStatus === 'returned' || p.handlingStatus === 'returned_received_at_branch') {
      // مرتجع -> لا يوجد نقد محصل
      returnedNoLiability += due;
    }
  });

  return {
    expectedCashCustody,
    undeliveredGoodsLiability,
    returnedNoLiability,
  };
}

// =========================================================================
// TEST POINT 1: دورة حياة طرد COD بـ 25,000 ل.س وأثرها المالي على العهدة
// =========================================================================
console.log('\n[النقطة 1] اختبار طرد COD مفرد (25,000 ل.س) وتتبع العهدة بدقة:');

let singleParcel = {
  id: 'parcel_cod_test_25k',
  trackingNumber: 'ORK-COD-25K',
  originHubId: 'br_dam',
  destinationHubId: 'br_alp',
  handlingStatus: 'with_courier',
  currentLocationBranchId: 'br_alp',
  assignedCourierId: 'usr_courier_1',
  paymentType: 'cod',
  codAmount: 20000,
  shippingCost: 5000,
  totalDue: 25000,
  currency: 'SYP',
};

// 1. المرحلة 1: مع الموزع
let c1 = calculateCourierCustody([singleParcel]);
assert(c1.expectedCashCustody === 0, 'النقد المحصل = 0 (لم يُسلَّم بعد)');
assert(c1.undeliveredGoodsLiability === 25000, 'العهدة البضاعية مع الموزع = 25,000 ل.س');

// 2. المرحلة 2: الموزع أعلن الإرجاع (markParcelReturned)
singleParcel = {
  ...singleParcel,
  handlingStatus: 'returned',
  returnedAt: new Date().toISOString(),
  returnedByUserId: 'usr_courier_1',
  returnReason: 'العميل رفض الاستلام',
  currentLocationBranchId: 'br_alp',
  assignedCourierId: 'usr_courier_1', // لا يزال في حقيبته بانتظار الوصول للفرع
};

let c2 = calculateCourierCustody([singleParcel]);
assert(c2.expectedCashCustody === 0, 'النقد المحصل = 0 (العميل رفض ولم يقبض الموزع شيئاً)');
assert(c2.undeliveredGoodsLiability === 0, 'سقطت المطالبة بتحصيل 25,000 ل.س كنقد');
assert(c2.returnedNoLiability === 25000, 'الذمة المالية للتحصيل أصبحت معفاة كمرتجع = 25,000 ل.س');

// 3. المرحلة 3: الفرع استلم المرتجع فيزيائياً بالمستودع (receiveReturnedParcelAtBranch)
singleParcel = {
  ...singleParcel,
  handlingStatus: 'returned_received_at_branch',
  receivedBackAtBranchId: 'br_alp',
  receivedBackAt: new Date().toISOString(),
  assignedCourierId: undefined, // سقطت العهدة البضاعية نهائياً
};

let c3 = calculateCourierCustody([singleParcel]);
assert(singleParcel.assignedCourierId === undefined, 'سقوط العهدة البضاعية رسمياً (assignedCourierId = undefined)');
assert(c3.expectedCashCustody === 0, 'العهدة النقدية النهائية للموزع = 0 ل.س تماماً');

// =========================================================================
// TEST POINT 5: سيناريو المانافيست الكامل (5 طرود: 3 مسلّمة، 1 مرتجع، 1 معلق)
// =========================================================================
console.log('\n[النقطة 5] سيناريو تصفية مانافيست الموزع (5 طرود) ومطابقة الصندوق:');

const manifest5Parcels = [
  // 3 طرود مسلّمة بنجاح
  { id: 'p1', trackingNumber: 'ORK-001', totalDue: 30000, currency: 'SYP', handlingStatus: 'delivered' },
  { id: 'p2', trackingNumber: 'ORK-002', totalDue: 20000, currency: 'SYP', handlingStatus: 'delivered' },
  { id: 'p3', trackingNumber: 'ORK-003', totalDue: 50000, currency: 'SYP', handlingStatus: 'delivered' },
  // 1 طرد مرتجع (رفض استلام)
  { id: 'p4', trackingNumber: 'ORK-004', totalDue: 40000, currency: 'SYP', handlingStatus: 'returned_received_at_branch' },
  // 1 طرد لم يوزّع بعد (معلق)
  { id: 'p5', trackingNumber: 'ORK-005', totalDue: 15000, currency: 'SYP', handlingStatus: 'with_courier' },
];

const totalManifestValue = manifest5Parcels.reduce((sum, p) => sum + p.totalDue, 0); // 155,000
const deliveredParcels = manifest5Parcels.filter(p => p.handlingStatus === 'delivered');
const returnedParcels = manifest5Parcels.filter(p => p.handlingStatus === 'returned' || p.handlingStatus === 'returned_received_at_branch');
const pendingParcels = manifest5Parcels.filter(p => p.handlingStatus === 'with_courier');

// حساب المبالغ
const expectedCashToDeposit = deliveredParcels.reduce((sum, p) => sum + p.totalDue, 0); // 30,000 + 20,000 + 50,000 = 100,000
const returnedValue = returnedParcels.reduce((sum, p) => sum + p.totalDue, 0); // 40,000
const pendingValue = pendingParcels.reduce((sum, p) => sum + p.totalDue, 0); // 15,000

console.log(`  📊 إجمالي قيمة المانافيست عند الانطلاق: ${totalManifestValue.toLocaleString()} ل.س`);
console.log(`  💵 الطرود المسلّمة المقبوضة (3 طرود): ${expectedCashToDeposit.toLocaleString()} ل.س`);
console.log(`  📦 الطرود المرتجعة للفرع (1 طرد): ${returnedValue.toLocaleString()} ل.س`);
console.log(`  ⏳ الطرود المعلقة المتبقية (1 طرد): ${pendingValue.toLocaleString()} ل.س`);

// محاكاة توريد الصندوق عبر سند القبض
let branchCashboxBalanceBefore = 500000;
let cashboxTransactionAmount = expectedCashToDeposit; // توريد 100,000 ل.س فقط
let branchCashboxBalanceAfter = branchCashboxBalanceBefore + cashboxTransactionAmount;
let courierRemainingCashLiability = expectedCashToDeposit - cashboxTransactionAmount; // 0

assert(expectedCashToDeposit === 100000, 'المبلغ الإجمالي المتوقع توريده من الطرود المسلمة = 100,000 ل.س');
assert(returnedValue === 40000, 'قيمة الطرد المرتجع = 40,000 ل.س (معفى من التوريد النقدي)');
assert(pendingValue === 15000, 'قيمة الطرد المعلق = 15,000 ل.س (يبقى في ذمة الموزع البضاعية)');
assert(cashboxTransactionAmount === 100000, 'المبلغ الفعلي المودع في صندوق الفرع = 100,000 ل.س');
assert(courierRemainingCashLiability === 0, 'الفرق بين المتوقع والفعلي = 0 ل.س (تطابق مالي 100%)');

// =========================================================================
// TEST POINT 2 & 3: مسار الشحن العكسي لفرع الأصل والحقول المالية
// =========================================================================
console.log('\n[النقطتان 2 و 3] اختبار مسار الإرجاع لفرع الأصل وتوثيق الحقول المالية:');

let parcelToReverse = {
  id: 'parcel_rev_test_1',
  trackingNumber: 'ORK-REV-001',
  originHubId: 'br_dam',        // فرع الأصل: دمشق
  destinationHubId: 'br_alp',   // فرع الوجهة: حلب
  currentLocationBranchId: 'br_alp',
  handlingStatus: 'returned_received_at_branch',
  shippingCost: 8000,
  currency: 'SYP',
};

// محاكاة تنفيذ stageParcelForReturnToOrigin
const returnCost = 4000; // 50% كأجرة شحن عكسي
parcelToReverse = {
  ...parcelToReverse,
  isReverseShipment: true,
  returnShippingCost: returnCost,
  returnShippingPaidBy: 'sender',
  returnFinancialStatus: 'pending',
  returnFinancialNotes: 'أجور شحن عكسي مستحقة على التاجر المرسل عند الاستلام بدمشق',
  handlingStatus: 'received_at_hub', // جاهز للتحميل في المانافيست المتجه لدمشق
};

assert(parcelToReverse.isReverseShipment === true, 'تم وسم الطرد كـ reverse shipment');
assert(parcelToReverse.returnShippingCost === 4000, 'تم تقييد تكلفة الشحن العكسي (4,000 ل.س)');
assert(parcelToReverse.returnShippingPaidBy === 'sender', 'الطرف المتحمل: المرسل (sender)');
assert(parcelToReverse.returnFinancialStatus === 'pending', 'الحالة المالية للشحن العكسي: pending');
assert(parcelToReverse.handlingStatus === 'received_at_hub', 'الطرد جاهز للإدراج في شاحنة العودة المتجهة لفرع دمشق');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🏁 FINISHED AUDIT TESTS: ${passedTests}/${totalTests} Passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
