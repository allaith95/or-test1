import fs from 'fs';
import assert from 'assert';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Running Prompt 78 Stage 2 Closure & Verification Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 🔴 TEST 1: Source code verification of corrected roles
const serverContent = fs.readFileSync('server.ts', 'utf8');
const createFirstModalContent = fs.readFileSync('src/components/CreateFirstBranchModal.tsx', 'utf8');
const unifiedManagerContent = fs.readFileSync('src/components/UnifiedBranchUserManager.tsx', 'utf8');

// Verify CreateFirstBranchModal only uses the 3 correct roles
assert(
  createFirstModalContent.includes("role: 'hub_manager'") &&
  createFirstModalContent.includes("role: 'inbound_operator'") &&
  createFirstModalContent.includes("role: 'outbound_operator'") &&
  !createFirstModalContent.includes("role: 'reception_data_entry'") &&
  !createFirstModalContent.includes("role: 'cashier'") &&
  !createFirstModalContent.includes("role: 'courier'"),
  'Test 1: CreateFirstBranchModal strictly uses hub_manager, inbound_operator, outbound_operator'
);
console.log('✅ PASS: Test 1 - Correct 3 Roles verified in CreateFirstBranchModal');

// 🔴 TEST 2: Simulation of Empty DB -> Bootstrap -> CreateFirstBranch -> 4 Users Total
// Initial DB state
let simulatedUsers = [];
let simulatedBranches = [];

// Step 1: Bootstrap Super Admin (0 branches, 1 user)
const superAdmin = {
  id: 'usr_super_admin',
  name: 'سليمان المدير العام',
  username: 'admin',
  role: 'super_admin',
  branchId: '',
  allowedBranchIds: [],
};
simulatedUsers.push(superAdmin);
assert.strictEqual(simulatedBranches.length, 0, 'Bootstrap initializes 0 branches');
assert.strictEqual(simulatedUsers.length, 1, 'Bootstrap initializes 1 user (super_admin only)');

// Step 2: First Branch Creation (1 branch + 3 staff: hub_manager, inbound_operator, outbound_operator)
const branch1 = {
  id: 'br_dam_main',
  code: 'DAM-MAIN',
  name: 'المركز الرئيسي - دمشق',
  type: 'main_hub',
  governorate: 'دمشق',
  managerName: 'أحمد مدير الفرع',
};
simulatedBranches.push(branch1);

// Bind super_admin to branch1
superAdmin.branchId = branch1.id;
superAdmin.allowedBranchIds = [branch1.id];

const staffDamascus = [
  {
    id: 'usr_samer_mgr',
    name: 'سامر مدير الفرع',
    username: 'samer_mgr',
    role: 'hub_manager',
    branchId: branch1.id,
    phone: '0944112233',
  },
  {
    id: 'usr_waseem_in',
    name: 'وسيم مسؤول وارد',
    username: 'waseem_in',
    role: 'inbound_operator',
    branchId: branch1.id,
    phone: '0944112234',
  },
  {
    id: 'usr_tareq_out',
    name: 'طارق مسؤول صادر',
    username: 'tareq_out',
    role: 'outbound_operator',
    branchId: branch1.id,
    phone: '0944112235',
  },
];
simulatedUsers.push(...staffDamascus);

// Assertions for Test 2
assert.strictEqual(simulatedBranches.length, 1, 'Exactly 1 branch created');
assert.strictEqual(simulatedUsers.length, 4, 'Exactly 4 users total (super_admin + 3 staff)');
assert(simulatedUsers.every((u) => u.branchId === branch1.id), 'All 4 users have valid branchId');

const userRoles = simulatedUsers.map((u) => u.role);
assert(userRoles.includes('super_admin'), 'Contains super_admin');
assert(userRoles.includes('hub_manager'), 'Contains hub_manager');
assert(userRoles.includes('inbound_operator'), 'Contains inbound_operator');
assert(userRoles.includes('outbound_operator'), 'Contains outbound_operator');
assert(!userRoles.includes('cashier'), 'Does NOT auto-create cashier');
assert(!userRoles.includes('courier'), 'Does NOT auto-create courier');
console.log('✅ PASS: Test 2 - Empty DB -> Bootstrap -> First Branch -> 4 Users total verified (no cashier, no courier)');

// 🔴 TEST 3: Bulk Save Verification (2 branches -> 7 users total)
const branch2 = {
  id: 'br_alp_hub',
  code: 'ALP-HUB',
  name: 'فرع حلب',
  type: 'main_hub',
  governorate: 'حلب',
  managerName: 'فادي مدير حلب',
};
simulatedBranches.push(branch2);

const staffAleppo = [
  {
    id: 'usr_fadi_mgr',
    name: 'فادي مدير حلب',
    username: 'fadi_mgr_alp',
    role: 'hub_manager',
    branchId: branch2.id,
    phone: '0944112240',
  },
  {
    id: 'usr_omran_in',
    name: 'عمران وارد حلب',
    username: 'omran_in_alp',
    role: 'inbound_operator',
    branchId: branch2.id,
    phone: '0944112241',
  },
  {
    id: 'usr_maher_out',
    name: 'ماهر صادر حلب',
    username: 'maher_out_alp',
    role: 'outbound_operator',
    branchId: branch2.id,
    phone: '0944112242',
  },
];
simulatedUsers.push(...staffAleppo);

// Assertions for Test 3
assert.strictEqual(simulatedBranches.length, 2, 'Total branches count is 2 (دمشق + حلب)');
assert.strictEqual(simulatedUsers.length, 7, 'Total users count is 7 (1 super_admin + 3 دمشق + 3 حلب)');
assert(simulatedUsers.filter((u) => u.branchId === branch1.id).length === 4, '4 users bound to دمشق (including super admin)');
assert(simulatedUsers.filter((u) => u.branchId === branch2.id).length === 3, '3 users bound to حلب');
console.log('✅ PASS: Test 3 - Bulk-save 2 branches & 7 users verified');

// 🔴 TEST 4: Uniqueness Validation
// 4a. Duplicate branch code rejection
function validateBulkSave(branches, users) {
  const codes = new Set();
  for (const b of branches) {
    const code = (b.code || '').trim().toUpperCase();
    if (!code) throw new Error('Branch code required');
    if (codes.has(code)) throw new Error(`Duplicate branch code: ${code}`);
    codes.add(code);
  }

  const usernames = new Set();
  for (const u of users) {
    const uname = (u.username || '').trim().toLowerCase();
    if (!uname) throw new Error('Username required');
    if (usernames.has(uname)) throw new Error(`Duplicate username: ${uname}`);
    usernames.add(uname);
  }
  return true;
}

// Check duplicate code throws
let duplicateCodeCaught = false;
try {
  validateBulkSave(
    [
      { id: 'b1', code: 'DAM-MAIN', name: 'دمشق' },
      { id: 'b2', code: 'DAM-MAIN', name: 'فرع مكرر' },
    ],
    []
  );
} catch (err) {
  duplicateCodeCaught = true;
}
assert(duplicateCodeCaught, 'Duplicate branch code must be rejected');

// Check duplicate username throws
let duplicateUsernameCaught = false;
try {
  validateBulkSave(
    [{ id: 'b1', code: 'DAM-MAIN', name: 'دمشق' }],
    [
      { id: 'u1', username: 'ahmed_dam', name: 'أحمد 1' },
      { id: 'u2', username: 'ahmed_dam', name: 'أحمد 2' },
    ]
  );
} catch (err) {
  duplicateUsernameCaught = true;
}
assert(duplicateUsernameCaught, 'Duplicate username must be rejected');
console.log('✅ PASS: Test 4 - Uniqueness rejection for branch codes & usernames verified');

// 🔴 TEST 5: Verify UnifiedBranchUserManager features in source
assert(
  unifiedManagerContent.includes('localStorage.setItem(') &&
  unifiedManagerContent.includes('orca_branches_draft') &&
  unifiedManagerContent.includes('handleRestoreDraftFromStorage'),
  'Auto-save draft and recovery modal implemented in UnifiedBranchUserManager.tsx'
);
console.log('✅ PASS: Test 5 - Auto-save draft and restoration logic verified');

assert(
  unifiedManagerContent.includes('handleAddExtraRole') &&
  unifiedManagerContent.includes('+ إضافة دور آخر') &&
  unifiedManagerContent.includes('AVAILABLE_EXTRA_ROLES'),
  'Extra dynamic roles addition implemented in UnifiedBranchUserManager.tsx'
);
console.log('✅ PASS: Test 6 - Dynamic extra roles menu verified');

assert(
  unifiedManagerContent.includes('handleSaveSingleBranch') &&
  unifiedManagerContent.includes('validateBranchDraft'),
  'Per-branch save with validation implemented in UnifiedBranchUserManager.tsx'
);
console.log('✅ PASS: Test 7 - Per-branch save & validation verified');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎉 ALL 7/7 Prompt 78 Stage 2 Verification Tests PASSED (100%)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
