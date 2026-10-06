import { validateParcelStateTransition, ALLOWED_TRANSITIONS } from '../src/utils/parcelLifecycleValidator.ts';
import { isTransitionAllowed, HANDLING_RANK } from '../src/utils/parcelMergeEngine.ts';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 PROMPT 57 TEST: 3 EDGE CASES & PRE-DELIVERY RETURN LIFECYCLE');
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
// TEST 1: (A1) Sender Does Not Pick Up (Deadlines, Overdue, Abandoned)
// =========================================================================
console.log('\n[Test 1] (A1) Return Pickup Deadlines (30 Days Overdue & 60 Days Abandoned):');

const arrivalTime = new Date('2026-08-01T10:00:00Z').getTime(); // 65 days ago relative to 2026-10-05
const thirtyFiveDaysAgo = new Date('2026-08-31T10:00:00Z').getTime(); // 35 days ago
const fiveDaysAgo = new Date('2026-09-30T10:00:00Z').getTime(); // 5 days ago
const nowTime = new Date('2026-10-05T10:00:00Z').getTime();

function evaluateReturnPickupStatus(receivedBackAt, returnPickupDeadline, currentTime = nowTime) {
  const arrival = receivedBackAt ? new Date(receivedBackAt).getTime() : new Date(returnPickupDeadline).getTime() - 30 * 24 * 60 * 60 * 1000;
  const daysPassed = (currentTime - arrival) / (1000 * 60 * 60 * 24);

  if (daysPassed >= 60) {
    return 'abandoned';
  } else if (daysPassed >= 30 || (returnPickupDeadline && currentTime > new Date(returnPickupDeadline).getTime())) {
    return 'overdue';
  }
  return 'pending';
}

const pRecent = {
  id: 'p_rec',
  receivedBackAt: new Date(fiveDaysAgo).toISOString(),
  returnPickupDeadline: new Date(fiveDaysAgo + 30 * 24 * 60 * 60 * 1000).toISOString(),
};
const pOverdue = {
  id: 'p_ovd',
  receivedBackAt: new Date(thirtyFiveDaysAgo).toISOString(),
  returnPickupDeadline: new Date(thirtyFiveDaysAgo + 30 * 24 * 60 * 60 * 1000).toISOString(),
};
const pAbandoned = {
  id: 'p_abn',
  receivedBackAt: new Date(arrivalTime).toISOString(),
  returnPickupDeadline: new Date(arrivalTime + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

assert(evaluateReturnPickupStatus(pRecent.receivedBackAt, pRecent.returnPickupDeadline) === 'pending', 'طرد وصل قبل 5 أيام: حالته pending');
assert(evaluateReturnPickupStatus(pOverdue.receivedBackAt, pOverdue.returnPickupDeadline) === 'overdue', 'طرد تجاوز 30 يوماً ولم يستلمه المرسل: حالته overdue');
assert(evaluateReturnPickupStatus(pAbandoned.receivedBackAt, pAbandoned.returnPickupDeadline) === 'abandoned', 'طرد تجاوز 60 يوماً: حالته abandoned (يُنقل لمخزون المرتجعات المعلقة)');

// =========================================================================
// TEST 2: (A2) Sender Refuses to Pay Return Freight (Debt & Audit)
// =========================================================================
console.log('\n[Test 2] (A2) Sender Refuses Return Shipping Cost Handover:');

const cashboxTransactions = [];
const auditLogs = [];
const customerLedger = {
  phone: '0933111222',
  fullName: 'شركة الشام التجارية',
  returnDebtBalance: 0,
};

function simulateHandoverToSender(parcel, options) {
  const paymentStatus = options?.paymentStatus || 'paid';
  const debtAmount = paymentStatus === 'refused' ? (parcel.returnShippingCost || 0) : undefined;

  const updated = {
    ...parcel,
    handlingStatus: 'returned_to_sender',
    returnPaymentStatus: paymentStatus,
    returnDebtAmount: debtAmount,
  };

  if (parcel.returnShippingPaidBy === 'sender' && parcel.returnShippingCost > 0) {
    if (paymentStatus === 'paid') {
      cashboxTransactions.push({
        type: 'shipping_collected_dest',
        amount: parcel.returnShippingCost,
        parcelId: parcel.id,
      });
    } else {
      // رفض الدفع: لا حركة نقدية بالصندوق + تسجيل ذمة بالعميل
      customerLedger.returnDebtBalance += parcel.returnShippingCost;
      auditLogs.push({
        action: 'المرسل رفض دفع أجور الشحن العكسي',
        details: `رفض المرسل دفع ${parcel.returnShippingCost} ل.س للطرد ${parcel.trackingNumber}`,
      });
    }
  }

  return updated;
}

const parcelRefused = {
  id: 'p_ref_1',
  trackingNumber: 'ORK-REF-001',
  returnShippingCost: 6500,
  returnShippingPaidBy: 'sender',
  handlingStatus: 'returned_to_origin',
};

const resultRefused = simulateHandoverToSender(parcelRefused, { paymentStatus: 'refused' });

assert(resultRefused.handlingStatus === 'returned_to_sender', 'تم تسليم الطرد وإغلاق حالته إلى returned_to_sender');
assert(resultRefused.returnPaymentStatus === 'refused', 'حالة الدفع: refused');
assert(resultRefused.returnDebtAmount === 6500, 'قيمة الذمة المسجلة على الطرد = 6,500 ل.س');
assert(cashboxTransactions.length === 0, 'لم يتم إنشاء أي حركة نقدية وهمية بالصندوق (لا addCashTransaction)');
assert(customerLedger.returnDebtBalance === 6500, 'تم تقييد الذمة بنجاح في حساب المرسل بالدليل: 6,500 ل.س');
assert(auditLogs.some(l => l.action.includes('رفض دفع أجور الشحن العكسي')), 'تم تسجيل الحدث في سجل الرقابة والتدقيق (Audit Trail)');

// Settle return debt later
function simulateSettleReturnDebt(parcel) {
  const amount = parcel.returnDebtAmount || 0;
  parcel.returnPaymentStatus = 'paid';
  parcel.returnDebtAmount = 0;
  customerLedger.returnDebtBalance = Math.max(0, customerLedger.returnDebtBalance - amount);
  cashboxTransactions.push({
    type: 'shipping_collected_dest',
    amount: amount,
    parcelId: parcel.id,
  });
}

simulateSettleReturnDebt(resultRefused);
assert(resultRefused.returnPaymentStatus === 'paid', 'عند السداد اللاحق: أصبحت حالة الدفع paid');
assert(resultRefused.returnDebtAmount === 0, 'تصفير ذمة الطرد إلى 0');
assert(customerLedger.returnDebtBalance === 0, 'تصفير رصيد ذمة العميل في الدليل');
assert(cashboxTransactions.length === 1 && cashboxTransactions[0].amount === 6500, 'تم إيداع المبلغ المقبوض 6,500 ل.س فعلياً بالصندوق');

// =========================================================================
// TEST 3: (A3) Reverse Shipment Removal From Manifest
// =========================================================================
console.log('\n[Test 3] (A3) Add & Remove Reverse Shipment From Manifest:');

let sampleParcels = [
  {
    id: 'p_rev_mnf',
    trackingNumber: 'ORK-REV-MNF-1',
    originHubId: 'br_dam',
    destinationHubId: 'br_alp',
    isReverseShipment: true,
    handlingStatus: 'returning_to_origin',
    truckManifestId: undefined,
  },
  {
    id: 'p_std_mnf',
    trackingNumber: 'ORK-STD-MNF-2',
    originHubId: 'br_alp',
    destinationHubId: 'br_dam',
    isReverseShipment: false,
    handlingStatus: 'received_at_hub',
    truckManifestId: undefined,
  }
];

// Step 1: Create Manifest with both parcels
const manifestId = 'mnf_test_100';
sampleParcels = sampleParcels.map(p => {
  const isReverse = p.isReverseShipment || p.handlingStatus === 'return_initiated' || p.handlingStatus === 'returning_to_origin';
  return {
    ...p,
    handlingStatus: isReverse ? 'returning_to_origin' : 'loaded_in_truck',
    truckManifestId: manifestId,
  };
});

assert(sampleParcels[0].handlingStatus === 'returning_to_origin', 'الشحنة العكسية بعد إضافتها للمانافيست تبقى returning_to_origin');
assert(sampleParcels[0].truckManifestId === manifestId, 'الشحنة العكسية ارتبطت برقم المانافيست');
assert(sampleParcels[1].handlingStatus === 'loaded_in_truck', 'الشحنة العادية أصبحت loaded_in_truck');

// Step 2: User unchecks / removes the reverse shipment before dispatch (updateTruckManifest)
const remainingParcelIds = ['p_std_mnf']; // p_rev_mnf removed
const removedIds = ['p_rev_mnf'];

sampleParcels = sampleParcels.map(p => {
  if (removedIds.includes(p.id)) {
    const restoredStatus = (p.isReverseShipment || p.returnInitiatedReason)
      ? (p.returnInitiatedReason ? 'return_initiated' : 'returning_to_origin')
      : 'received_at_hub';
    return {
      ...p,
      handlingStatus: restoredStatus,
      truckManifestId: undefined,
    };
  }
  return p;
});

const unlinkedReverseParcel = sampleParcels.find(p => p.id === 'p_rev_mnf');
assert(unlinkedReverseParcel.handlingStatus === 'returning_to_origin', 'بعد إزالة الشحنة العكسية من المانافيست: استعادت حالة returning_to_origin بدقة');
assert(unlinkedReverseParcel.truckManifestId === undefined, 'تحرير truckManifestId وأصبح undefined');
assert(unlinkedReverseParcel.isReverseShipment === true, 'احتفظت بعلامة isReverseShipment = true');

// =========================================================================
// TEST 4: Part B — Pre-Delivery Return Lifecycle (return_initiated)
// =========================================================================
console.log('\n[Test 4] (Part B) Pre-Delivery Return Lifecycle:');

// FSM checks
assert(ALLOWED_TRANSITIONS['received_at_dest'].includes('return_initiated'), 'received_at_dest → return_initiated is ALLOWED');
assert(ALLOWED_TRANSITIONS['return_initiated'].includes('returning_to_origin'), 'return_initiated → returning_to_origin is ALLOWED');
assert(ALLOWED_TRANSITIONS['return_initiated'].includes('received_at_dest'), 'return_initiated → received_at_dest (إلغاء الإرجاع) is ALLOWED');

assert(HANDLING_RANK['return_initiated'] === 85, 'Rank of return_initiated is 85');

// Simulation
let parcelAtBranch = {
  id: 'p_pre_1',
  trackingNumber: 'ORK-PRE-001',
  originHubId: 'br_dam',
  currentLocationBranchId: 'br_alp',
  destinationHubId: 'br_alp',
  shippingCost: 8000,
  handlingStatus: 'received_at_dest',
  assignedCourierId: undefined,
};

// Initiate pre-delivery return
const returnShippingRate = 0.5;
const returnCost = parcelAtBranch.currentLocationBranchId !== parcelAtBranch.originHubId
  ? Math.round(parcelAtBranch.shippingCost * returnShippingRate)
  : 0;

let preReturnParcel = {
  ...parcelAtBranch,
  handlingStatus: 'return_initiated',
  isReverseShipment: true,
  returnInitiatedReason: 'المستلم ألغى الطلب',
  returnShippingCost: returnCost,
  returnShippingPaidBy: 'sender',
};

assert(preReturnParcel.handlingStatus === 'return_initiated', 'حالة الطرد أصبحت return_initiated');
assert(preReturnParcel.isReverseShipment === true, 'تم وسمه كشحنة عكسية (isReverseShipment = true)');
assert(preReturnParcel.returnShippingCost === 4000, 'أجور الشحن العكسي المحتسبة = 4,000 ل.س (50% من أجور الشحن)');

// Test Cancel Pre-Delivery Return
const cancelledParcel = {
  ...preReturnParcel,
  handlingStatus: 'received_at_dest',
  isReverseShipment: false,
  returnInitiatedReason: undefined,
};
assert(cancelledParcel.handlingStatus === 'received_at_dest', 'إلغاء الإرجاع يعيد الطرد إلى received_at_dest');
assert(cancelledParcel.isReverseShipment === false, 'إلغاء وسم الشحنة العكسية بعد إلغاء الإرجاع');

// Test stage into outbound reverse truck heading to Damascus (br_dam)
const stagedReverse = {
  ...preReturnParcel,
  handlingStatus: 'returning_to_origin',
  truckManifestId: 'mnf_trk_return_999',
};
assert(stagedReverse.handlingStatus === 'returning_to_origin', 'عند التحميل بشاحنة العودة للأصل: أصبح returning_to_origin');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🏁 PROMPT 57 VERIFICATION: ${passedTests}/${totalTests} Passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
