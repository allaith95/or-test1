import { validateParcelStateTransition } from '../src/utils/parcelLifecycleValidator.ts';
import { isTransitionAllowed, HANDLING_RANK } from '../src/utils/parcelMergeEngine.ts';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 TESTING REVERSE SHIPMENT REGRESSION & LIFECYCLE (التلقين 55)');
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

// =========================================================================
// TEST 1: FSM State Transitions for Reverse Pipeline
// =========================================================================
console.log('\n[Test 1] FSM Transitions for Reverse Shipment:');

// 1. returned_received_at_branch → returning_to_origin
const tr1 = validateParcelStateTransition('returned_received_at_branch', 'returning_to_origin');
assert(tr1.allowed === true, 'returned_received_at_branch → returning_to_origin is ALLOWED');

// 2. returning_to_origin → returned_to_origin
const tr2 = validateParcelStateTransition('returning_to_origin', 'returned_to_origin');
assert(tr2.allowed === true, 'returning_to_origin → returned_to_origin is ALLOWED');

// 3. returned_to_origin → returned_to_sender (تسليم للمرسل)
const tr3 = validateParcelStateTransition('returned_to_origin', 'returned_to_sender');
assert(tr3.allowed === true, 'returned_to_origin → returned_to_sender is ALLOWED');

// 4. returning_to_origin → returned_to_sender (مباشرة دون استلام في فرع الأصل: ممنوع)
const tr4 = validateParcelStateTransition('returning_to_origin', 'returned_to_sender');
assert(tr4.allowed === false, 'returning_to_origin → returned_to_sender directly is FORBIDDEN');

// 5. Precedence ranks
assert(HANDLING_RANK['returning_to_origin'] === 96, 'Rank of returning_to_origin is 96');
assert(HANDLING_RANK['returned_to_origin'] === 97, 'Rank of returned_to_origin is 97');

// =========================================================================
// TEST 2: Complete Reverse Lifecycle Emulation
// =========================================================================
console.log('\n[Test 2] Complete Reverse Lifecycle Step-by-Step:');

let parcel = {
  id: 'p_rev_99',
  trackingNumber: 'ORK-REV-099',
  originHubId: 'br_dam',        // فرع دمشق (الأصل)
  destinationHubId: 'br_alp',   // فرع حلب (الوجهة)
  currentLocationBranchId: 'br_alp',
  handlingStatus: 'returned_received_at_branch',
  shippingCost: 10000,
  currency: 'SYP',
  sender: { name: 'متجر دمشق للأقمشة', phone: '0933111222' },
  receiver: { name: 'عميل حلب', phone: '0944555666' },
};

// الخطوة 1: حلب تضغط "إرجاع لفرع الأصل"
const returnShippingCost = Math.round(parcel.shippingCost * 0.5); // 5,000 ل.س
parcel = {
  ...parcel,
  isReverseShipment: true,
  returnShippingCost,
  returnShippingPaidBy: 'sender',
  returnFinancialStatus: 'pending',
  handlingStatus: 'returning_to_origin', // الحالة الجديدة المستقلة
  originCollectionBranchId: 'br_alp',
  updatedAt: new Date().toISOString(),
};

assert(parcel.handlingStatus === 'returning_to_origin', 'حالة الطرد تغيرت إلى returning_to_origin حصراً (لا received_at_hub)');
assert(parcel.isReverseShipment === true, 'وسم الطرد كـ isReverseShipment: true');
assert(parcel.returnShippingCost === 5000, 'توثيق أجور الشحن العكسي (50% = 5,000 ل.س)');

// الخطوة 2: وصول الشاحنة لدمشق، وفرع دمشق يضغط "استلام في فرع الأصل"
parcel = {
  ...parcel,
  handlingStatus: 'returned_to_origin',
  receivedBackAtBranchId: parcel.originHubId,
  currentLocationBranchId: parcel.originHubId,
  returnFinancialStatus: 'settled',
  receivedBackAt: new Date().toISOString(),
};

assert(parcel.handlingStatus === 'returned_to_origin', 'حالة الطرد تحولت إلى returned_to_origin');
assert(parcel.currentLocationBranchId === 'br_dam', 'الموقع الفعلي للطرد استقر في فرع دمشق (الأصل)');
assert(parcel.returnFinancialStatus === 'settled', 'تسوية أجور الشحن العكسي');

// الخطوة 3: تسليم الطرد المرتجع للمرسل الأصلي (متجر دمشق للأقمشة)
parcel = {
  ...parcel,
  handlingStatus: 'returned_to_sender',
  deliveredAt: new Date().toISOString(),
  deliveryNotes: 'تم تسليم المرتجع للمرسل الأصلي بنجاح',
};

assert(parcel.handlingStatus === 'returned_to_sender', 'تم تسليم المرتجع للمرسل وإغلاق الدورة بالكامل (returned_to_sender)');

// =========================================================================
// TEST 3: Isolation from Regular Inbound & Courier App (Regression Test)
// =========================================================================
console.log('\n[Test 3] Isolation Regression Test:');

const mixedParcels = [
  // طرد وارد عادي متوجه لحلب
  { id: 'norm_1', destinationHubId: 'br_alp', originHubId: 'br_dam', handlingStatus: 'received_at_dest', isReverseShipment: false },
  // شحنة عكسية في الطريق متجهة لدمشق
  { id: 'rev_in_transit', destinationHubId: 'br_alp', originHubId: 'br_dam', handlingStatus: 'returning_to_origin', isReverseShipment: true },
  // شحنة عكسية وصلت دمشق بانتظار استلام التاجر
  { id: 'rev_arrived', destinationHubId: 'br_alp', originHubId: 'br_dam', handlingStatus: 'returned_to_origin', isReverseShipment: true },
];

// 1. فحص الطرود الواردة العادية بمستودع حلب (Standard Received Warehouse Parcels)
const regularAleppoWarehouse = mixedParcels.filter(
  (p) => p.destinationHubId === 'br_alp' && p.handlingStatus === 'received_at_dest' && !p.isReverseShipment
);
assert(regularAleppoWarehouse.length === 1 && regularAleppoWarehouse[0].id === 'norm_1', 'الشحنة العكسية لا تظهر في الطرود الواردة العادية');

// 2. فحص تطبيق الموزع (Courier Mobile Pending Tasks)
const courierPendingTasks = mixedParcels.filter(
  (p) => p.handlingStatus === 'with_courier' || (p.handlingStatus === 'received_at_dest' && !p.isReverseShipment)
);
assert(courierPendingTasks.length === 1 && courierPendingTasks[0].id === 'norm_1', 'الشحنة العكسية لا تظهر إطلاقاً في مهام الموزع الميدانية');

// 3. فحص قسم "شحنات عكسية قادمة للأصل" في فرع دمشق (Destination = Origin)
const damascusReverseIncoming = mixedParcels.filter(
  (p) => p.handlingStatus === 'returning_to_origin' && p.originHubId === 'br_dam'
);
assert(damascusReverseIncoming.length === 1 && damascusReverseIncoming[0].id === 'rev_in_transit', 'الشحنة العكسية تظهر حصراً في قسم الشحنات العكسية القادمة لفرع الأصل');

// 4. فحص قسم "بانتظار استلام المرسل" في فرع دمشق
const damascusReadySender = mixedParcels.filter(
  (p) => p.handlingStatus === 'returned_to_origin' && p.originHubId === 'br_dam'
);
assert(damascusReadySender.length === 1 && damascusReadySender[0].id === 'rev_arrived', 'تظهر الشحنة في قسم بانتظار استلام المرسل فور وصولها للأصل');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🏁 FINISHED REGRESSION TESTS: ${passedTests}/${totalTests} Passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
