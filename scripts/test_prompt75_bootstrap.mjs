import fs from 'fs';
import assert from 'assert';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 75 Bootstrap Logic Verification Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const appTsxContent = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Verify bootstrapState state declaration in App.tsx
assert(
  appTsxContent.includes("const [bootstrapState, setBootstrapState] = useState<'checking' | 'needed' | 'ready'>('checking');"),
  '1. App.tsx declares bootstrapState with checking, needed, ready states'
);
console.log('✅ PASS: 1. bootstrapState state declared in App.tsx');

// 2. Verify checkBootstrapStatus logic cleans stale sessions when DB is empty
assert(
  appTsxContent.includes('if (data && !data.isBootstrapped) {') &&
  appTsxContent.includes("safeStorage.removeItem('orca_session_current_user_obj');") &&
  appTsxContent.includes("setBootstrapState('needed');"),
  '2. checkBootstrapStatus purges stale sessions when isBootstrapped is false'
);
console.log('✅ PASS: 2. Stale sessions purged on empty DB');

// 3. Verify API failure fallback sets bootstrapState to needed
assert(
  appTsxContent.includes("console.error('[Bootstrap] Check failed:', err);") &&
  appTsxContent.includes("setBootstrapState('needed');"),
  '3. API error fallback sets bootstrapState to needed'
);
console.log('✅ PASS: 3. Server offline fallback to needed bootstrapState');

// 4. Verify bootstrapState checks happen BEFORE portal / auth / public landing checks
const checkingIndex = appTsxContent.indexOf("if (bootstrapState === 'checking')");
const neededIndex = appTsxContent.indexOf("if (bootstrapState === 'needed' || isBootstrapOpen)");
const publicLandingIndex = appTsxContent.indexOf('if (!isAuthenticated) {');
const courierPortalIndex = appTsxContent.indexOf('if (isCourierPortalMode) {');

assert(checkingIndex !== -1, 'Checking guard exists');
assert(neededIndex !== -1, 'Needed guard exists');
assert(
  checkingIndex < courierPortalIndex && neededIndex < courierPortalIndex && neededIndex < publicLandingIndex,
  '4. Bootstrap guards executed BEFORE portal and auth checks'
);
console.log('✅ PASS: 4. Bootstrap check executed prior to auth & landing screens');

// 5. Verify /api/bootstrap/status endpoint in server.ts
const serverContent = fs.readFileSync('server.ts', 'utf8');
assert(
  serverContent.includes("app.get('/api/bootstrap/status'"),
  '5. server.ts contains GET /api/bootstrap/status route'
);
console.log('✅ PASS: 5. /api/bootstrap/status route exists in server.ts');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Test Summary: 5/5 tests passed');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
