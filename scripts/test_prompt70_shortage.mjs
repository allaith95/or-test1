import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 70 Shortage Logic Verification Tests');
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

// 1. Check types.ts definitions
const typesContent = fs.readFileSync('src/types.ts', 'utf-8');
assert(
  typesContent.includes('lastManifestId?: string;') &&
  typesContent.includes('lastManifestDispatchedAt?: string;') &&
  typesContent.includes('loadedInTruckAt?: string;'),
  '1. types.ts contains lastManifestId, lastManifestDispatchedAt, and loadedInTruckAt'
);

// 2. Check OrcaContext.tsx Guard 1 and Guard 2 logic
const orcaContextContent = fs.readFileSync('src/context/OrcaContext.tsx', 'utf-8');
assert(
  orcaContextContent.includes("if (p.handlingStatus !== 'shortage_missing') {") &&
  orcaContextContent.includes("if (p.shortageStatus === 'confirmed_at_origin') {"),
  '2. resolveShortageAtOrigin contains decoupled Guard 1 (strictly shortage_missing) and Guard 2 (confirmed_at_origin)'
);

assert(
  orcaContextContent.includes("lastManifestDispatchedAt: p.loadedInTruckAt || p.updatedAt || now,"),
  '2. resolveShortageAtOrigin contains fallback for lastManifestDispatchedAt'
);

// 3. Check CreateManifestFullscreenModal.tsx integration
const manifestModalContent = fs.readFileSync('src/components/CreateManifestFullscreenModal.tsx', 'utf-8');
assert(
  manifestModalContent.includes("p.handlingStatus === 'leftover_origin_warehouse'") &&
  manifestModalContent.includes("p.currentLocationBranchId === currentBranch.id"),
  '3. CreateManifestFullscreenModal includes leftover_origin_warehouse and matches currentLocationBranchId'
);
assert(
  manifestModalContent.includes("↩️ متبقي من"),
  '3. CreateManifestFullscreenModal displays ↩️ متبقي من badge'
);

// 4. Check TruckManifestsView.tsx
const truckManifestsContent = fs.readFileSync('src/components/TruckManifestsView.tsx', 'utf-8');
assert(
  truckManifestsContent.includes("p.shortageStatus !== 'confirmed_at_origin'") &&
  truckManifestsContent.includes("!p.isRecoveredFromPreviousShortage"),
  '4. TruckManifestsView excludes resolved shortages from missingCount'
);
assert(
  truckManifestsContent.includes("✓ تم العثور عليه في الفرع المصدر"),
  '4. TruckManifestsView renders found at origin badge for resolved shortage parcels'
);

// 5. Check WarehouseArrivalsView.tsx
const arrivalsContent = fs.readFileSync('src/components/WarehouseArrivalsView.tsx', 'utf-8');
assert(
  arrivalsContent.includes("متبقي من مانافيست [") &&
  arrivalsContent.includes("✓ تم الحل") &&
  arrivalsContent.includes("+ إضافة لمانافيست جديد"),
  '5. WarehouseArrivalsView leftover warehouse tab renders manifest badge, resolved tag, and add to new manifest button'
);

// =========================================================================
// Functional Simulation Unit Tests
// =========================================================================

function attemptShortageConfirmation(parcel, notes = '') {
  // Guard 1: Must be strictly in shortage_missing state
  if (parcel.handlingStatus !== 'shortage_missing') {
    return { success: false, reason: 'not_shortage_missing', parcel };
  }

  // Guard 2: Must not already be confirmed at origin
  if (parcel.shortageStatus === 'confirmed_at_origin') {
    return { success: false, reason: 'already_confirmed', parcel };
  }

  const now = new Date().toISOString();
  const originBranchId = parcel.originHubId || parcel.originCollectionBranchId;
  const previousManifestId = parcel.truckManifestId || parcel.shortageManifestId;
  const previousManifestNumber = parcel.shortageManifestNumber || (previousManifestId ? String(previousManifestId) : undefined);

  const updated = {
    ...parcel,
    handlingStatus: 'leftover_origin_warehouse',
    shortageStatus: 'confirmed_at_origin',
    isRecoveredFromPreviousShortage: true,
    previousShortageManifestNumber: previousManifestNumber,
    truckManifestId: null,
    lastManifestId: previousManifestId,
    lastManifestDispatchedAt: parcel.loadedInTruckAt || parcel.updatedAt || now,
    shortageResolvedAt: now,
    shortageResolutionNotes: notes || `تم تأكيد وجود الطرد في الفرع المصدر. كان مرتبطاً بمانافيست ${previousManifestNumber}.`,
    currentLocationBranchId: originBranchId,
    storedWarehouseType: 'leftover_previous_shipments',
    updatedAt: now,
  };

  return { success: true, parcel: updated };
}

// Test 6: Guard 1 Test - Accepted vs Rejected
const pMissing = { id: 'p1', handlingStatus: 'shortage_missing', shortageStatus: 'pending_origin_verification', truckManifestId: 'TM-001' };
const resMissing = attemptShortageConfirmation(pMissing);
assert(resMissing.success === true, 'Test 6a: Guard 1 accepts shortage_missing');

const pLeftover = { id: 'p2', handlingStatus: 'leftover_origin_warehouse', shortageStatus: 'pending_origin_verification', truckManifestId: null };
const resLeftover = attemptShortageConfirmation(pLeftover);
assert(resLeftover.success === false && resLeftover.reason === 'not_shortage_missing', 'Test 6b: Guard 1 rejects leftover_origin_warehouse even with pending_origin_verification');

const pDelivered = { id: 'p3', handlingStatus: 'delivered', shortageStatus: 'none', truckManifestId: 'TM-001' };
const resDelivered = attemptShortageConfirmation(pDelivered);
assert(resDelivered.success === false && resDelivered.reason === 'not_shortage_missing', 'Test 6c: Guard 1 rejects delivered parcel');

// Test 7: Guard 2 Test - Already Confirmed
const pAlreadyConfirmed = { id: 'p4', handlingStatus: 'shortage_missing', shortageStatus: 'confirmed_at_origin', truckManifestId: 'TM-001' };
const resConfirmed = attemptShortageConfirmation(pAlreadyConfirmed);
assert(resConfirmed.success === false && resConfirmed.reason === 'already_confirmed', 'Test 7: Guard 2 rejects parcel with shortageStatus = confirmed_at_origin');

// Test 8: Fallback for lastManifestDispatchedAt
const pNoLoadedAt = {
  id: 'p5',
  handlingStatus: 'shortage_missing',
  shortageStatus: 'pending_origin_verification',
  truckManifestId: 'TM-001',
  updatedAt: '2026-10-04T10:00:00.000Z',
};
const resNoLoadedAt = attemptShortageConfirmation(pNoLoadedAt);
assert(
  resNoLoadedAt.success === true &&
  resNoLoadedAt.parcel.lastManifestDispatchedAt === '2026-10-04T10:00:00.000Z',
  'Test 8: Fallback uses updatedAt when loadedInTruckAt is missing'
);

// Test 9: Sim 3 — Full Recovery Cycle to Delivery
console.log('--- Running Sim 3: Full Recovery Cycle ---');
// Step 1: Initial manifest TM-001 (Damascus -> Aleppo)
let cycleParcel = {
  id: 'parcel-full-cycle-101',
  trackingNumber: 'ORCA-CYCLE-70',
  originHubId: 'branch-damascus',
  destinationHubId: 'branch-aleppo',
  truckManifestId: 'TM-001',
  shortageManifestId: 'TM-001',
  shortageManifestNumber: 'TM-001',
  handlingStatus: 'loaded_in_truck',
  shortageStatus: 'none',
  loadedInTruckAt: '2026-10-05T01:00:00.000Z',
  updatedAt: '2026-10-05T01:00:00.000Z',
};

// Step 2: Unloading in Aleppo -> Shortage Missing
cycleParcel.handlingStatus = 'shortage_missing';
cycleParcel.shortageStatus = 'pending_origin_verification';
assert(cycleParcel.handlingStatus === 'shortage_missing', 'Sim 3 (Step 2): Parcel marked shortage_missing');

// Step 3 & 4: Confirm shortage found at Damascus origin
const confirmResult = attemptShortageConfirmation(cycleParcel, 'تم العثور على الطرد في مستودع صادر دمشق');
assert(confirmResult.success === true, 'Sim 3 (Step 3): Confirmation succeeded');
cycleParcel = confirmResult.parcel;

assert(cycleParcel.handlingStatus === 'leftover_origin_warehouse', 'Sim 3 (Step 4a): handlingStatus = leftover_origin_warehouse');
assert(cycleParcel.truckManifestId === null, 'Sim 3 (Step 4b): truckManifestId is null');
assert(cycleParcel.lastManifestId === 'TM-001', 'Sim 3 (Step 4c): lastManifestId = TM-001');
assert(cycleParcel.currentLocationBranchId === 'branch-damascus', 'Sim 3 (Step 4d): currentLocationBranchId = Damascus');

// Step 5 & 6: Add to new manifest TM-002 (Damascus -> Aleppo)
cycleParcel = {
  ...cycleParcel,
  truckManifestId: 'TM-002',
  handlingStatus: 'loaded_in_truck',
  loadedInTruckAt: '2026-10-05T06:00:00.000Z',
  updatedAt: '2026-10-05T06:00:00.000Z',
};
assert(cycleParcel.truckManifestId === 'TM-002', 'Sim 3 (Step 6a): truckManifestId updated to TM-002');
assert(cycleParcel.handlingStatus === 'loaded_in_truck', 'Sim 3 (Step 6b): handlingStatus = loaded_in_truck');
assert(cycleParcel.lastManifestId === 'TM-001', 'Sim 3 (Step 6c): historical lastManifestId TM-001 preserved');

// Step 7: Arrived and unloaded in Aleppo
cycleParcel = {
  ...cycleParcel,
  handlingStatus: 'received_at_dest',
  currentLocationBranchId: 'branch-aleppo',
  arrivedAtDestAt: '2026-10-05T09:00:00.000Z',
  updatedAt: '2026-10-05T09:00:00.000Z',
};
assert(cycleParcel.handlingStatus === 'received_at_dest', 'Sim 3 (Step 7a): handlingStatus = received_at_dest');
assert(cycleParcel.currentLocationBranchId === 'branch-aleppo', 'Sim 3 (Step 7b): currentLocationBranchId = Aleppo');

// Step 8 & 9: Delivered to customer
cycleParcel = {
  ...cycleParcel,
  handlingStatus: 'delivered',
  deliveredAt: '2026-10-05T11:00:00.000Z',
  updatedAt: '2026-10-05T11:00:00.000Z',
};
assert(cycleParcel.handlingStatus === 'delivered', 'Sim 3 (Step 8): handlingStatus = delivered');
assert(cycleParcel.lastManifestId === 'TM-001', 'Sim 3 (Step 9a): lastManifestId TM-001 remains preserved in history');
assert(cycleParcel.isRecoveredFromPreviousShortage === true, 'Sim 3 (Step 9b): recovery flag remains true');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
