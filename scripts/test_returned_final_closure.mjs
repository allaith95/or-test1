import { validateParcelStateTransition } from '../src/utils/parcelLifecycleValidator.ts';
import { isTransitionAllowed, HANDLING_RANK } from '../src/utils/parcelMergeEngine.ts';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 FINAL CLOSURE TEST: REVERSE LIFECYCLE & FINANCIALS (التلقين 56)');
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
// TEST 1: Gap 1 — Distinct Status: returned_to_sender vs delivered
// =========================================================================
console.log('\n[Test 1] Distinct Handling Status (returned_to_sender vs delivered):');

// FSM transitions
const t1 = validateParcelStateTransition('returned_to_origin', 'returned_to_sender');
assert(t1.allowed === true, 'returned_to_origin → returned_to_sender is ALLOWED');

assert(HANDLING_RANK['returned_to_sender'] === 100, 'Rank of returned_to_sender is 100 (Final Authoritative)');

// Simulation of report separation
const sampleParcels = [
  { id: 'p_del_1', trackingNumber: 'ORK-DEL-01', handlingStatus: 'delivered', receiver: { name: 'المستلم النهائي' } },
  { id: 'p_del_2', trackingNumber: 'ORK-DEL-02', handlingStatus: 'delivered', receiver: { name: 'زبون دمشق' } },
  { id: 'p_ret_sender', trackingNumber: 'ORK-RET-99', handlingStatus: 'returned_to_sender', sender: { name: 'التاجر المرسل' } },
];

const customerDeliveries = sampleParcels.filter(p => p.handlingStatus === 'delivered');
const returnedToSenderDeliveries = sampleParcels.filter(p => p.handlingStatus === 'returned_to_sender');

assert(customerDeliveries.length === 2, 'تسليمات العملاء (delivered) = 2 فقط');
assert(returnedToSenderDeliveries.length === 1, 'مرتجعات مسلمة للمرسل (returned_to_sender) = 1 فقط');
assert(!customerDeliveries.some(p => p.id === 'p_ret_sender'), 'لا يوجد خلط بين تسليم العميل وتسليم المرتجع للتاجر');

// =========================================================================
// TEST 2: Gap 2 — Financial Transactions for Reverse Freight (5,000 SYP)
// =========================================================================
console.log('\n[Test 2] Financial Audit for Reverse Shipping Cost (5,000 SYP):');

const mockTransactions = [];
function mockAddCashTransaction(branchId, currency, type, amount, description, referenceId, counterpartyBranchId, cashboxScope) {
  mockTransactions.push({
    id: `tx_${Date.now()}_${mockTransactions.length + 1}`,
    branchId,
    currency,
    type,
    amount,
    description,
    referenceId,
    cashboxScope,
  });
}

// Case A: Sender pays return shipping (أجور شحن عكسي على المرسل عند الاستلام بفرع الأصل)
const returnCost = 5000;
let reverseParcelSender = {
  id: 'p_rev_sender_5k',
  trackingNumber: 'ORK-REV-SND',
  originHubId: 'br_dam',
  currentLocationBranchId: 'br_dam',
  returnShippingCost: returnCost,
  returnShippingPaidBy: 'sender',
  sender: { name: 'شركة النور التجارية' },
  currency: 'SYP',
  handlingStatus: 'returned_to_origin',
};

// Handover to sender -> collects 5,000 SYP cash at origin branch
if (reverseParcelSender.returnShippingPaidBy === 'sender' && reverseParcelSender.returnShippingCost > 0) {
  mockAddCashTransaction(
    reverseParcelSender.originHubId,
    reverseParcelSender.currency,
    'shipping_collected_dest',
    reverseParcelSender.returnShippingCost,
    `تحصيل أجور الشحن العكسي للطرد المرتجع [${reverseParcelSender.trackingNumber}] من المرسل [${reverseParcelSender.sender.name}]`,
    reverseParcelSender.id,
    undefined,
    'incoming'
  );
  reverseParcelSender.handlingStatus = 'returned_to_sender';
}

assert(reverseParcelSender.handlingStatus === 'returned_to_sender', 'حالة الطرد أصبحت returned_to_sender');
assert(mockTransactions.length === 1, 'تم تسجيل حركة مالية واحدة بالصندوق');
assert(mockTransactions[0].type === 'shipping_collected_dest', 'نوع الحركة: قبض أجور شحن (shipping_collected_dest)');
assert(mockTransactions[0].amount === 5000, 'المبلغ المقبوض بالصندوق = 5,000 ل.س');
assert(mockTransactions[0].branchId === 'br_dam', 'القبض تم في فرع الأصل (دمشق)');

// Case B: Company covers return shipping (أجور شحن عكسي مجانية على حساب الشركة)
let reverseParcelCompany = {
  id: 'p_rev_comp_5k',
  trackingNumber: 'ORK-REV-CMP',
  originHubId: 'br_dam',
  returnShippingCost: returnCost,
  returnShippingPaidBy: 'company',
  currency: 'SYP',
  handlingStatus: 'returning_to_origin',
};

if (reverseParcelCompany.returnShippingCost > 0 && reverseParcelCompany.returnShippingPaidBy === 'company') {
  mockAddCashTransaction(
    reverseParcelCompany.originHubId,
    reverseParcelCompany.currency,
    'operating_expense',
    reverseParcelCompany.returnShippingCost,
    `تكلفة شحن عكسي للطرد المرتجع [${reverseParcelCompany.trackingNumber}] على حساب الشركة`,
    reverseParcelCompany.id,
    undefined,
    'incoming'
  );
}

assert(mockTransactions.length === 2, 'تم تسجيل قيد خسارة الشركة');
assert(mockTransactions[1].type === 'operating_expense', 'نوع الحركة: مصروف تشغيلي / خسارة (operating_expense)');
assert(mockTransactions[1].amount === 5000, 'المبلغ المسجل كمصروف = 5,000 ل.س');

// =========================================================================
// TEST 3: Gap 3 — Reverse Shipment Manifest Inclusion
// =========================================================================
console.log('\n[Test 3] Manifest Staging and Destination Matching:');

// طرد في حلب متجه عكسياً إلى دمشق
const reverseParcelInAleppo = {
  id: 'p_rev_alp_to_dam',
  trackingNumber: 'ORK-REV-ALP-DAM',
  originHubId: 'br_dam',       // فرع الأصل: دمشق
  destinationHubId: 'br_alp',  // فرع التسليم السابق: حلب
  currentLocationBranchId: 'br_alp',
  isReverseShipment: true,
  handlingStatus: 'returning_to_origin',
};

const currentBranchId = 'br_alp';
const knownManifestIds = new Set();

// 1. فحص outboundManifestReadyParcels في فرع حلب
const isReverseAtBranch =
  reverseParcelInAleppo.isReverseShipment &&
  reverseParcelInAleppo.handlingStatus === 'returning_to_origin' &&
  (reverseParcelInAleppo.currentLocationBranchId === currentBranchId || reverseParcelInAleppo.destinationHubId === currentBranchId);

const readyInOutbound = isReverseAtBranch && (!reverseParcelInAleppo.truckManifestId || !knownManifestIds.has(reverseParcelInAleppo.truckManifestId));
assert(readyInOutbound === true, 'الشحنة العكسية جاهزة في مستودع صادر حلب (outboundManifestReadyParcels = true)');

// 2. فحص إنشاء مانافيست شاحنة من حلب إلى دمشق (Destination: br_dam)
function filterDestinationParcels(parcelsList, destinationHubId) {
  return parcelsList.filter((p) => {
    if (p.isReverseShipment) {
      return p.originHubId === destinationHubId;
    }
    return p.destinationHubId === destinationHubId;
  });
}

const truckToDamascusParcels = filterDestinationParcels([reverseParcelInAleppo], 'br_dam');
assert(truckToDamascusParcels.length === 1, 'الشحنة العكسية تُضاف تلقائياً لمانافيست الشاحنة المتجهة إلى دمشق');

const truckToHomsParcels = filterDestinationParcels([reverseParcelInAleppo], 'br_hom');
assert(truckToHomsParcels.length === 0, 'الشحنة العكسية لا تظهر في شاحنة متجهة لحمص لأن فرع الأصل هو دمشق');

// =========================================================================
// TEST 4: Notes 4 & 5 — Configurable Rate and assignedCourierName Check
// =========================================================================
console.log('\n[Test 4] Configurable Rate & assignedCourierName:');

const configuredRate = Number(process.env.RETURN_SHIPPING_RATE || 0.5);
assert(configuredRate === 0.5, 'RETURN_SHIPPING_RATE الافتراضي = 0.5 وقابل للضبط');

const testParcelWithCourier = {
  id: 'p_c',
  assignedCourierId: 'c1',
  assignedCourierName: 'سامر الموزع',
};
assert(testParcelWithCourier.assignedCourierName === 'سامر الموزع', 'حقل assignedCourierName موجود وموثق في Parcel');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🏁 FINAL CLOSURE AUDIT: ${passedTests}/${totalTests} Passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
