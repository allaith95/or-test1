import fs from 'fs';
import { deriveConnectionState } from '../src/utils/connectionState.ts';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 68 Database Icon Display-Only Verification');
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

// 1. Check DesktopTaskbar.tsx implementation
const taskbarContent = fs.readFileSync('src/components/DesktopTaskbar.tsx', 'utf-8');

assert(
  taskbarContent.includes("currentUser.role === 'super_admin' ? (") &&
  taskbarContent.includes('onClick={onOpenIntegrityHub}') &&
  taskbarContent.includes('<button'),
  '1. DesktopTaskbar renders clickable button only for super_admin'
);

assert(
  taskbarContent.includes('// غير super_admin: عرض فقط (غير قابل للنقر)') &&
  taskbarContent.includes('<div') &&
  taskbarContent.includes('title="حالة الاتصال (للقراءة فقط) — تواصل مع المدير للتفاصيل"'),
  '1. DesktopTaskbar renders read-only non-clickable div with explanatory tooltip for non-super_admin'
);

assert(
  taskbarContent.includes('ConnectionStatusBadge state={connectionInfo.state}'),
  '1. ConnectionStatusBadge renders dynamic connection state for all users'
);

// 2. Check MacTopBar.tsx implementation
const topbarContent = fs.readFileSync('src/components/MacTopBar.tsx', 'utf-8');

assert(
  topbarContent.includes("currentUser.role === 'super_admin' ? (") &&
  topbarContent.includes("onClick={() => setActiveModule('backup_cloud')}"),
  '2. MacTopBar renders interactive button for super_admin'
);

assert(
  topbarContent.includes('<div') &&
  topbarContent.includes('title="حالة الاتصال (للقراءة فقط) — تواصل مع المدير للتفاصيل"') &&
  topbarContent.includes('cursor-default select-none'),
  '2. MacTopBar renders read-only display div for non-super_admin'
);

// 3. Check deriveConnectionState logic
const stateOnlineConnected = deriveConnectionState({ status: 'connected', postgresConnected: true }, true);
assert(
  stateOnlineConnected.state === 'CONNECTED' && stateOnlineConnected.label === 'متصل',
  '3. deriveConnectionState returns CONNECTED (متصل) when online and connected'
);

const stateSyncing = deriveConnectionState({ status: 'syncing' }, true);
assert(
  stateSyncing.state === 'RECONNECTING' && stateSyncing.label === 'جاري المزامنة',
  '3. deriveConnectionState returns RECONNECTING (جاري المزامنة) when syncing'
);

const stateOffline = deriveConnectionState({ status: 'offline' }, true);
assert(
  stateOffline.state === 'DISCONNECTED' && stateOffline.label === 'غير متصل',
  '3. deriveConnectionState returns DISCONNECTED (غير متصل) when server is offline'
);

const stateNoInternet = deriveConnectionState({ status: 'connected' }, false);
assert(
  stateNoInternet.state === 'DISCONNECTED' && stateNoInternet.label === 'غير متصل',
  '3. deriveConnectionState returns DISCONNECTED (غير متصل) when internet is disconnected'
);

const stateDegraded = deriveConnectionState({ status: 'connected', postgresConnected: false }, true);
assert(
  stateDegraded.state === 'DEGRADED_LOCAL' && stateDegraded.label === 'تخزين مؤقت',
  '3. deriveConnectionState returns DEGRADED_LOCAL (تخزين مؤقت) when local safe fallback is active'
);

// 4. Check Security Guards (DOM manipulation resilience)
const appContent = fs.readFileSync('src/App.tsx', 'utf-8');
const syncAuditContent = fs.readFileSync('src/components/SyncAuditFullScreen.tsx', 'utf-8');

assert(
  appContent.includes("if (currentUser?.role === 'super_admin')") &&
  appContent.includes("console.warn('[Security] Non-admin attempted to open Integrity Hub')"),
  '4. App.tsx guards onOpenIntegrityHub and logs security warning if called by non-admin'
);

assert(
  syncAuditContent.includes("if (!isOpen || currentUser?.role !== 'super_admin') {") &&
  syncAuditContent.includes('return null;'),
  '4. SyncAuditFullScreen unconditionally renders null if currentUser is not super_admin'
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
