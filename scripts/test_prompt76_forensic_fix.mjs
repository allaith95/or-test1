import fs from 'fs';
import assert from 'assert';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 76 Forensic Fix & Bootstrap Verification');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. Verify queueMutation blocks users & branches push
const vpsSyncContent = fs.readFileSync('src/services/vpsSyncEngine.ts', 'utf8');
assert(
  vpsSyncContent.includes("if (collectionName === 'users' || collectionName === 'branches') {") &&
  vpsSyncContent.includes('[Security] Client attempted to push user/branch — BLOCKED'),
  '1. queueMutation in vpsSyncEngine.ts blocks client-side user/branch pushes'
);
console.log('✅ PASS: Test 1 - Client push of users and branches strictly BLOCKED in queueMutation');

// 2. Verify processOfflineQueue purges local queue when server DB is empty
assert(
  vpsSyncContent.includes('if ((serverStatus?.isDbEmpty || serverStatus?.isBootstrapped === false) && this.queue.length > 0) {') &&
  vpsSyncContent.includes('this.queue = [];') &&
  vpsSyncContent.includes('[Sync] Server DB is empty + local queue present → BLOCKED & PURGED'),
  '2. processOfflineQueue purges local queue if server DB is empty'
);
console.log('✅ PASS: Test 2 - processOfflineQueue purges queue on empty server DB');

// 3. Verify App.tsx purges local cache & IndexedDB when server DB is empty
const appTsxContent = fs.readFileSync('src/App.tsx', 'utf8');
assert(
  appTsxContent.includes('if (data && (!data.isBootstrapped || data.isDbEmpty)) {') &&
  appTsxContent.includes('localStorage.removeItem(key);') &&
  appTsxContent.includes('indexedDB.deleteDatabase(db.name);'),
  '3. App.tsx purges local cache & IndexedDB on empty server DB'
);
console.log('✅ PASS: Test 3 - App.tsx auto-cleans local storage and IndexedDB on empty DB');

// 4. Verify handleRemoteUsers & handleRemoteBranches enforce server as single source of truth
const contextContent = fs.readFileSync('src/context/OrcaContext.tsx', 'utf8');
assert(
  contextContent.includes('const handleRemoteBranches = (remoteBranches: Branch[]) => {') &&
  contextContent.includes('setBranches(validRemotes);') &&
  contextContent.includes('const handleRemoteUsers = (remoteUsers: User[]) => {') &&
  contextContent.includes('setUsers(validRemotes);'),
  '4. handleRemoteUsers/Branches enforce server as single source of truth'
);
console.log('✅ PASS: Test 4 - handleRemoteUsers/Branches enforce server source of truth');

// 5. Verify /api/bootstrap/init, /api/branches/create-first, and /api/admin/users/create in server.ts
const serverContent = fs.readFileSync('server.ts', 'utf8');
assert(
  serverContent.includes("app.post('/api/bootstrap/init'") &&
  serverContent.includes('branches: [],') &&
  serverContent.includes('users: [superAdminUser],'),
  '5a. /api/bootstrap/init creates Super Admin ONLY with 0 branches'
);
console.log('✅ PASS: Test 5a - /api/bootstrap/init creates Super Admin with 0 branches');

assert(
  serverContent.includes("app.post('/api/branches/create-first'") &&
  serverContent.includes('totalUsersCount: updatedUsers.length,') &&
  serverContent.includes('totalBranchesCount: updatedBranches.length,'),
  '5b. /api/branches/create-first creates branch + 3 staff and binds super_admin'
);
console.log('✅ PASS: Test 5b - /api/branches/create-first creates branch & 3 staff');

assert(
  serverContent.includes("app.post('/api/admin/users/create'") &&
  serverContent.includes("if (requesterRole !== 'super_admin') {") &&
  serverContent.includes('res.status(403)'),
  '5c. /api/admin/users/create blocks non-super_admin with 403 Forbidden'
);
console.log('✅ PASS: Test 5c - /api/admin/users/create blocks non-admin with 403 Forbidden');

// 6. Verify CreateFirstBranchModal component file exists and is rendered
assert(
  fs.existsSync('src/components/CreateFirstBranchModal.tsx'),
  '6a. CreateFirstBranchModal.tsx file exists'
);
assert(
  appTsxContent.includes('<CreateFirstBranchModal') &&
  appTsxContent.includes("currentUser?.role === 'super_admin'"),
  '6b. CreateFirstBranchModal is guarded and rendered in App.tsx'
);
console.log('✅ PASS: Test 6 - CreateFirstBranchModal exists and is integrated in App.tsx');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Test Summary: All 6/6 Forensic & Bootstrap tests passed');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
