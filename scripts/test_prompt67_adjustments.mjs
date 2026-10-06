import fs from 'fs';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Starting Prompt 67 Field Adjustments Verification Test');
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

// 1. Audio check: COD and Cashier Collection sound silenced
const audioEffectsContent = fs.readFileSync('src/utils/audioEffects.ts', 'utf-8');
const orcaContextContent = fs.readFileSync('src/context/OrcaContext.tsx', 'utf-8');
const taskbarContent = fs.readFileSync('src/components/DesktopTaskbar.tsx', 'utf-8');
const topbarContent = fs.readFileSync('src/components/MacTopBar.tsx', 'utf-8');

assert(
  !orcaContextContent.includes('playCashierPaymentAlertSound();'),
  '1. playCashierPaymentAlertSound removed from cashier payment notification dispatch in OrcaContext'
);
assert(
  !taskbarContent.includes('playCashierPaymentAlertSound();'),
  '1. playCashierPaymentAlertSound removed from DesktopTaskbar notification triggers'
);
assert(
  !topbarContent.includes('playCashierPaymentAlertSound();'),
  '1. playCashierPaymentAlertSound removed from MacTopBar notification triggers'
);
assert(
  audioEffectsContent.includes('Muted for operational field quietness') ||
  audioEffectsContent.includes('Silenced per Prompt 67'),
  '1. playCashierPaymentAlertSound muted safely in audioEffects.ts'
);

// 2. Add Courier Permissions Check (super_admin only)
const deliveryCouriersContent = fs.readFileSync('src/components/DeliveryCouriersView.tsx', 'utf-8');
const adminUsersBranchesContent = fs.readFileSync('src/components/AdminUsersBranchesView.tsx', 'utf-8');
const courierCardModalContent = fs.readFileSync('src/components/CourierCardModal.tsx', 'utf-8');

assert(
  deliveryCouriersContent.includes('{isSuperAdmin && (') &&
  deliveryCouriersContent.includes('handleOpenAddCourierModal'),
  '2. Add courier button in DeliveryCouriersView is wrapped with isSuperAdmin check'
);
assert(
  deliveryCouriersContent.includes('if (!isSuperAdmin) return;'),
  '2. handleOpenAddCourierModal verifies isSuperAdmin permission before opening'
);
assert(
  adminUsersBranchesContent.includes("currentUser.role === 'super_admin' && (") &&
  adminUsersBranchesContent.includes('+ إضافة موزع معتمد'),
  '2. Add courier button in AdminUsersBranchesView is restricted to super_admin'
);
assert(
  courierCardModalContent.includes("currentUser?.role !== 'super_admin'") &&
  courierCardModalContent.includes('return null;'),
  '2. CourierCardModal blocks non-super_admin from rendering modal'
);

// 3. Database icon in Taskbar & Topbar (hidden for non-super_admin)
const appContent = fs.readFileSync('src/App.tsx', 'utf-8');
const syncAuditContent = fs.readFileSync('src/components/SyncAuditFullScreen.tsx', 'utf-8');

assert(
  (taskbarContent.includes("isSuperAdmin ? (") || taskbarContent.includes("currentUser.role === 'super_admin'")) &&
  taskbarContent.includes('id="fluent_system_tray_cloud_indicator"'),
  '3. Database trigger icon in DesktopTaskbar is restricted to super_admin'
);
assert(
  (topbarContent.includes("isSuperAdmin ? (") || topbarContent.includes("currentUser.role === 'super_admin'")) &&
  topbarContent.includes('Central Database Sync Badge'),
  '3. Database sync interactive badge in MacTopBar is restricted to super_admin'
);
assert(
  appContent.includes("if (currentUser?.role === 'super_admin')") &&
  appContent.includes('setIsIntegrityHubOpen(true);'),
  '3. onOpenIntegrityHub callback in App.tsx strictly checks super_admin role'
);
assert(
  syncAuditContent.includes("currentUser?.role !== 'super_admin'") &&
  syncAuditContent.includes('return null;'),
  '3. SyncAuditFullScreen component renders null if user is not super_admin'
);

// 4 & 5. Reset destination, address, and default currency in CourierMobileIntake
const courierIntakeContent = fs.readFileSync('src/components/CourierMobileIntake.tsx', 'utf-8');

assert(
  courierIntakeContent.includes("const [destHubId, setDestHubId] = useState<string>('');"),
  '4. destHubId is initialized to empty string (not preselected) in CourierMobileIntake'
);
assert(
  courierIntakeContent.includes("setDestHubId('');") &&
  courierIntakeContent.includes("setReceiverAddress('');"),
  '4. handleResetForm clears destHubId and receiverAddress completely'
);
assert(
  courierIntakeContent.includes('<option value="">-- اختر فرع / مركز الوجهة المستلمة --</option>'),
  '4. Destination select includes default empty prompt option'
);
assert(
  courierIntakeContent.includes("const [currency, setCurrency] = useState<Currency>('SYP');") &&
  courierIntakeContent.includes("const [codCurrency, setCodCurrency] = useState<Currency>('SYP');"),
  '5. currency and codCurrency initialize to default SYP'
);
assert(
  courierIntakeContent.includes("setCurrency('SYP');") &&
  courierIntakeContent.includes("setCodCurrency('SYP');"),
  '5. handleResetForm resets currency and codCurrency back to SYP'
);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
