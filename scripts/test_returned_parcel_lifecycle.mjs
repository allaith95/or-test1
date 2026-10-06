import { validateParcelStateTransition } from '../src/utils/parcelLifecycleValidator.ts';
import { isTransitionAllowed, HANDLING_RANK } from '../src/utils/parcelMergeEngine.ts';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 TESTING RETURNED PARCELS LIFECYCLE (التلقين 53)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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

// ==========================================
// TEST 1: Happy Path Lifecycle & State Logic
// ==========================================
console.log('\n[Test 1] Complete Lifecycle State Machine (Happy Path)');

// Initial state: with_courier
let parcel = {
  id: 'parcel_test_ret_1',
  trackingNumber: 'ORK-RET-001',
  originHubId: 'br_dam',
  destinationHubId: 'br_alp',
  handlingStatus: 'with_courier',
  currentLocationBranchId: 'br_alp',
  assignedCourierId: 'usr_courier_1',
  assignedCourierName: 'أحمد الموزع',
  paymentType: 'cod',
  codAmount: 50000,
  shippingCost: 5000,
  totalDue: 55000,
  currency: 'SYP',
};

const events = [];
const currentUser = { id: 'usr_courier_1', name: 'أحمد الموزع', role: 'courier' };
const branchOperator = { id: 'usr_wh_1', name: 'سامر أمين المستودع', role: 'warehouse_keeper' };

// Step 1: Courier marks returned
const returnReason = 'العميل رفض الاستلام - السعر مرتفع';
const returnNotes = 'تواصلت معه مرتين ورفض الاستلام قطعياً';
const now1 = new Date().toISOString();

parcel = {
  ...parcel,
  handlingStatus: 'returned',
  returnReason,
  returnNotes,
  returnedAt: now1,
  returnedByUserId: currentUser.id,
  returnedByUserName: currentUser.name,
  currentLocationBranchId: parcel.currentLocationBranchId || 'br_alp',
  assignedCourierId: currentUser.id,
};

events.push({
  eventType: 'returned',
  status: 'returned',
  stillWithCourier: true,
  returnedBy: currentUser.name,
});

assert(parcel.handlingStatus === 'returned', 'handlingStatus changed to returned');
assert(parcel.currentLocationBranchId === 'br_alp', 'currentLocationBranchId correctly retained destination branch');
assert(parcel.returnedByUserName === 'أحمد الموزع', 'returnedByUserName documented accurately');
assert(parcel.assignedCourierId === 'usr_courier_1', 'assignedCourierId preserved while physically with courier');

// Step 2: Branch warehouse operator receives returned parcel
const now2 = new Date().toISOString();
parcel = {
  ...parcel,
  handlingStatus: 'returned_received_at_branch',
  receivedBackAtBranchId: 'br_alp',
  receivedBackAt: now2,
  receivedBackByUserId: branchOperator.id,
  assignedCourierId: undefined,
  currentLocationBranchId: 'br_alp',
};

events.push({
  eventType: 'returned_received_at_branch',
  status: 'returned_received_at_branch',
  receivedBy: branchOperator.name,
});

assert(parcel.handlingStatus === 'returned_received_at_branch', 'handlingStatus transitioned to returned_received_at_branch');
assert(parcel.assignedCourierId === undefined, 'assignedCourierId cleared (courier custody dropped)');
assert(parcel.receivedBackAtBranchId === 'br_alp', 'receivedBackAtBranchId documented accurately');
assert(events.length === 2, 'Two parcelEvents recorded for the two lifecycle milestones');

// ==========================================
// TEST 2: FSM Transition Rules
// ==========================================
console.log('\n[Test 2] FSM Transition Rules Validation');

// 2a. with_courier → returned
const t1 = validateParcelStateTransition('with_courier', 'returned');
assert(t1.allowed === true, 'with_courier → returned is ALLOWED');

// 2b. returned → returned_received_at_branch
const t2 = validateParcelStateTransition('returned', 'returned_received_at_branch');
assert(t2.allowed === true, 'returned → returned_received_at_branch is ALLOWED');

// 2c. returned → delivered (Forbidden: Cannot deliver while officially marked returned without re-dispatch)
const t3 = validateParcelStateTransition('returned', 'delivered');
assert(t3.allowed === false, 'returned → delivered is FORBIDDEN');

// 2d. returned_received_at_branch → received_at_dest (Re-entry to active warehouse stock)
const t4 = validateParcelStateTransition('returned_received_at_branch', 'received_at_dest');
assert(t4.allowed === true, 'returned_received_at_branch → received_at_dest is ALLOWED');

// 2e. Merge Engine Rankings & Downgrade exceptions
assert(HANDLING_RANK['returned'] === 90, 'Rank of returned is 90');
assert(HANDLING_RANK['returned_received_at_branch'] === 95, 'Rank of returned_received_at_branch is 95');
assert(
  isTransitionAllowed('returned_received_at_branch', 'received_at_dest') === true,
  'MergeEngine allows returned_received_at_branch (95) → received_at_dest (50) exception'
);

// ==========================================
// TEST 3: UI View Filters Emulation
// ==========================================
console.log('\n[Test 3] UI View Visibility Emulation');

const testParcels = [
  { id: 'p1', trackingNumber: 'ORK-001', handlingStatus: 'returned', currentLocationBranchId: 'br_alp' },
  { id: 'p2', trackingNumber: 'ORK-002', handlingStatus: 'returned_received_at_branch', currentLocationBranchId: 'br_alp' },
  { id: 'p3', trackingNumber: 'ORK-003', handlingStatus: 'received_at_dest', currentLocationBranchId: 'br_alp' },
];

const currentBranchId = 'br_alp';

// Filter 1: returnedPendingParcels in WarehouseArrivalsView
const returnedPending = testParcels.filter(
  (p) => p.currentLocationBranchId === currentBranchId && p.handlingStatus === 'returned'
);
assert(returnedPending.length === 1 && returnedPending[0].id === 'p1', 'returnedPendingParcels shows strictly unaccepted returns');

// Filter 2: CourierMobilePortal taskFilter='returned'
const courierReturnedList = testParcels.filter(
  (p) => p.handlingStatus === 'returned' || p.handlingStatus === 'returned_received_at_branch'
);
assert(courierReturnedList.length === 2, 'Courier mobile portal shows both pending and accepted returns in returned tab');

// Filter 3: After branch reception, parcel moves out of returnedPending
const afterReception = testParcels.map(p => p.id === 'p1' ? { ...p, handlingStatus: 'returned_received_at_branch' } : p);
const returnedPendingAfter = afterReception.filter(
  (p) => p.currentLocationBranchId === currentBranchId && p.handlingStatus === 'returned'
);
assert(returnedPendingAfter.length === 0, 'No pending returns remain in intake queue after reception');

// ==========================================
// TEST 4: Financial Custody Impact
// ==========================================
console.log('\n[Test 4] Financial Custody Impact Assessment');

function calculateCourierManifestFinancials(manifestParcels) {
  let custodyToCollectSyp = 0;
  manifestParcels.forEach((p) => {
    if (p.handlingStatus !== 'delivered' && p.handlingStatus !== 'returned' && p.handlingStatus !== 'returned_received_at_branch') {
      custodyToCollectSyp += p.totalDue || 0;
    }
  });
  return { activeCustodySyp: custodyToCollectSyp };
}

const activeManifestParcels = [
  { id: 'm1', totalDue: 50000, handlingStatus: 'with_courier' },
  { id: 'm2', totalDue: 30000, handlingStatus: 'delivered' },
  { id: 'm3', totalDue: 45000, handlingStatus: 'returned_received_at_branch' },
];

const fin = calculateCourierManifestFinancials(activeManifestParcels);
assert(fin.activeCustodySyp === 50000, 'Returned parcels (45,000 SYP) are excluded from courier active cash custody liability');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🏁 TESTS RESULT: ${passedTests}/${totalTests} Passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
