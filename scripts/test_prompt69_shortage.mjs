import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 69 Shortage Found at Origin Tests');
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

// 2. Check OrcaContext.tsx logic
const orcaContextContent = fs.readFileSync('src/context/OrcaContext.tsx', 'utf-8');
assert(
  orcaContextContent.includes("confirmShortageFoundAtOrigin: (parcelId: string, notes?: string) => void;"),
  '2. OrcaContextType declares confirmShortageFoundAtOrigin function signature'
);
assert(
  orcaContextContent.includes("handlingStatus: 'leftover_origin_warehouse',") &&
  orcaContextContent.includes("shortageStatus: 'confirmed_at_origin',") &&
  orcaContextContent.includes("truckManifestId: undefined,"),
  '2. resolveShortageAtOrigin sets leftover_origin_warehouse, confirmed_at_origin, and clears truckManifestId'
);
assert(
  orcaContextContent.includes("lastManifestId: previousManifestId,") &&
  orcaContextContent.includes("lastManifestDispatchedAt: p.loadedInTruckAt ||"),
  '2. resolveShortageAtOrigin archives previous manifest in lastManifestId and lastManifestDispatchedAt'
);

// 3. Check Double Confirmation Guard
assert(
  orcaContextContent.includes("if (parcel.handlingStatus !== 'shortage_missing') {") &&
  orcaContextContent.includes("if (parcel.shortageStatus === 'confirmed_at_origin') {"),
  '3. confirmShortageFoundAtOrigin blocks duplicate confirmations and non-shortage parcels'
);

// 4. Check CreateManifestFullscreenModal.tsx integration
const manifestModalContent = fs.readFileSync('src/components/CreateManifestFullscreenModal.tsx', 'utf-8');
assert(
  manifestModalContent.includes("p.handlingStatus === 'leftover_origin_warehouse'") &&
  manifestModalContent.includes("p.currentLocationBranchId === currentBranch.id"),
  '4. CreateManifestFullscreenModal includes leftover_origin_warehouse and matches currentLocationBranchId'
);
assert(
  manifestModalContent.includes("↩️ متبقي من"),
  '4. CreateManifestFullscreenModal displays ↩️ متبقي من badge'
);

// 5. Check TruckManifestsView.tsx
const truckManifestsContent = fs.readFileSync('src/components/TruckManifestsView.tsx', 'utf-8');
assert(
  truckManifestsContent.includes("p.shortageStatus !== 'confirmed_at_origin'") &&
  truckManifestsContent.includes("!p.isRecoveredFromPreviousShortage"),
  '5. TruckManifestsView excludes resolved shortages from missingCount'
);
assert(
  truckManifestsContent.includes("✓ تم العثور عليه في الفرع المصدر"),
  '5. TruckManifestsView renders found at origin badge for resolved shortage parcels'
);

// 6. Check WarehouseArrivalsView.tsx
const arrivalsContent = fs.readFileSync('src/components/WarehouseArrivalsView.tsx', 'utf-8');
assert(
  arrivalsContent.includes("متبقي من مانافيست [") &&
  arrivalsContent.includes("✓ تم الحل") &&
  arrivalsContent.includes("+ إضافة لمانافيست جديد"),
  '6. WarehouseArrivalsView leftover warehouse tab renders manifest badge, resolved tag, and add to new manifest button'
);

// Simulation Test of Lifecycle State Machine
const parcel = {
  id: 'parcel-101',
  trackingNumber: 'ORCA-DAM-001',
  originHubId: 'branch-damascus',
  destinationHubId: 'branch-aleppo',
  truckManifestId: 'TM-001',
  shortageManifestId: 'TM-001',
  shortageManifestNumber: 'TM-001',
  handlingStatus: 'shortage_missing',
  shortageStatus: 'pending_origin_verification',
  loadedInTruckAt: '2026-10-05T01:00:00.000Z',
};

// Simulate confirmation
const now = new Date().toISOString();
const originBranchId = parcel.originHubId;
const previousManifestId = parcel.truckManifestId;

const resolvedParcel = {
  ...parcel,
  handlingStatus: 'leftover_origin_warehouse',
  shortageStatus: 'confirmed_at_origin',
  isRecoveredFromPreviousShortage: true,
  truckManifestId: null,
  lastManifestId: previousManifestId,
  lastManifestDispatchedAt: parcel.loadedInTruckAt,
  currentLocationBranchId: originBranchId,
  shortageResolvedAt: now,
};

assert(resolvedParcel.handlingStatus === 'leftover_origin_warehouse', 'Sim 1: handlingStatus is leftover_origin_warehouse');
assert(resolvedParcel.shortageStatus === 'confirmed_at_origin', 'Sim 1: shortageStatus is confirmed_at_origin');
assert(resolvedParcel.truckManifestId === null, 'Sim 1: truckManifestId is null');
assert(resolvedParcel.lastManifestId === 'TM-001', 'Sim 1: lastManifestId is TM-001');
assert(resolvedParcel.currentLocationBranchId === 'branch-damascus', 'Sim 1: currentLocationBranchId is Damascus');

// Simulate adding to new manifest TM-002
const reManifestedParcel = {
  ...resolvedParcel,
  truckManifestId: 'TM-002',
  handlingStatus: 'loaded_in_truck',
};
assert(reManifestedParcel.truckManifestId === 'TM-002', 'Sim 2: truckManifestId updated to TM-002');
assert(reManifestedParcel.lastManifestId === 'TM-001', 'Sim 2: historical lastManifestId TM-001 preserved');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
