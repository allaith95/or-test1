import { Branch, Governorate, User, UserRole } from '../types';
import { getDefaultPermissionsForRole } from './permissionEngine';

export const GOVERNORATE_CODES: Record<Governorate, string> = {
  'دمشق': 'dam',
  'ريف دمشق': 'rif',
  'حلب': 'alp',
  'حمص': 'hms',
  'حماة': 'ham',
  'اللاذقية': 'lat',
  'طرطوس': 'tar',
  'السويداء': 'swd',
  'درعا': 'dar',
  'القنيطرة': 'qun',
  'دير الزور': 'dez',
  'الحسكة': 'hsk',
  'الرقة': 'raq',
  'إدلب': 'idl',
};

export const ALL_GOVERNORATES: Governorate[] = [
  'دمشق',
  'ريف دمشق',
  'حلب',
  'حمص',
  'حماة',
  'اللاذقية',
  'طرطوس',
  'السويداء',
  'درعا',
  'القنيطرة',
  'دير الزور',
  'الحسكة',
  'الرقة',
  'إدلب',
];

/**
 * Generate standard core user accounts for a given branch:
 * 1. Branch Manager (مدير فرع)
 * 2. Outbound Officer (مسؤول صادر - استلام وتحضير للشحن)
 * 3. Inbound Officer (مسؤول وارد - استلام وتسليم للعملاء والمناديب)
 * 4. Cashier (أمين صندوق - العمليات المالية)
 */
export function generateDefaultUsersForBranch(
  branch: Branch,
  customPassword = '123456',
  existingUsers?: User[]
): User[] {
  const cleanCode = (branch.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const govCode = GOVERNORATE_CODES[branch.governorate] || 'hub';
  const branchTag = cleanCode || govCode;
  const cleanBranchId = branch.id;
  const isMainHub = branch.type === 'main_hub';
  const branchTypeLabel = isMainHub ? 'الرئيسي' : 'الفرعي';
  const branchShort = branch.name.replace(/المركز الرئيسي - |الرئيسي - |فرع /g, '');

  const rolesConfig: Array<{
    role: UserRole;
    prefix: string;
    roleTitle: string;
    description: string;
  }> = [
    {
      role: 'hub_manager',
      prefix: 'mgr',
      roleTitle: `مدير فرع ${branchShort} (${branchTypeLabel})`,
      description: 'إدارة الفرع، متابعة العمليات، الصناديق والمنافيست',
    },
    {
      role: 'outbound_operator',
      prefix: 'out',
      roleTitle: `مسؤول صادر - فرع ${branchShort}`,
      description: 'استلام الطرود وتحضيرها للشحن وإصدار المنافيست',
    },
    {
      role: 'inbound_operator',
      prefix: 'in',
      roleTitle: `مسؤول وارد - فرع ${branchShort}`,
      description: 'استلام الطرود الواردة من الفروع وتسليمها للعملاء ومندوبي التوزيع',
    },
    {
      role: 'cashier',
      prefix: 'cash',
      roleTitle: `أمين صندوق - فرع ${branchShort}`,
      description: 'مسؤول عن العمليات المالية، الصناديق، وحوالات COD',
    },
  ];

  const existingUsernames = new Set(
    (existingUsers || []).map((u) => (u.username || '').toLowerCase().trim())
  );

  return rolesConfig.map((item) => {
    const baseUsername = `${item.prefix}_${branchTag}`;
    let uniqueUsername = baseUsername;
    let counter = 2;
    while (existingUsernames.has(uniqueUsername.toLowerCase())) {
      uniqueUsername = `${baseUsername}_${counter++}`;
    }
    existingUsernames.add(uniqueUsername.toLowerCase());

    const now = new Date().toISOString();
    return {
      id: `usr_${item.prefix}_${cleanBranchId}`,
      name: item.roleTitle,
      username: uniqueUsername,
      password: customPassword || '123456',
      role: item.role,
      branchId: cleanBranchId,
      allowedBranchIds: [cleanBranchId],
      canSwitchBranches: false,
      phone: branch.phone || '0900000000',
      isActive: true,
      permissions: getDefaultPermissionsForRole(item.role),
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Get standard human-friendly branch type label:
 * - 'main_hub' -> "رئيسي"
 * - 'collection_point' -> "فرعي (تابع لـ ...)"
 */
export function getBranchTypeLabel(branch: Branch, branches?: Branch[]): string {
  if (branch.type === 'main_hub') {
    return 'فرع رئيسي (مركز شحن)';
  }
  if (branch.type === 'agent') {
    return 'مكتب وكيل (مقاصة وعمولات)';
  }
  if (branches && branch.parentHubId) {
    const parent = branches.find((b) => b.id === branch.parentHubId);
    if (parent) {
      return `نقطة تجميع (تابعة لـ: ${parent.name})`;
    }
  }
  return 'نقطة تجميع';
}

/**
 * Filter branches based on parent-hub hierarchy:
 * - All 'main_hub' ("رئيسي") branches are always visible as major network hubs for routing.
 * - 'collection_point' ("فرعي") branches are ONLY visible if:
 *     1) The viewer is a super_admin with canSwitchBranches and in global mode (allowAllForSuperAdmin: true), OR
 *     2) The current branch is their parent main hub (`b.parentHubId === currentBranch.id`), OR
 *     3) The current branch is the sub-branch itself (`b.id === currentBranch.id`), OR
 *     4) The current branch is a sibling sub-branch under the same parent hub (`b.parentHubId === currentBranch.parentHubId`).
 * Any sub-branch belonging to ANOTHER main hub is completely hidden from search and dropdowns.
 */
export function getVisibleBranches(
  branches: Branch[],
  currentBranch?: Branch,
  currentUser?: User,
  options?: { allowAllForSuperAdmin?: boolean }
): Branch[] {
  if (!branches || branches.length === 0) return [];

  // Super admin in global mode can see everything if explicitly allowed
  if (options?.allowAllForSuperAdmin && currentUser?.role === 'super_admin' && currentUser?.canSwitchBranches) {
    return branches;
  }

  // If no branch is active, only show main hubs
  if (!currentBranch || !currentBranch.id) {
    return branches.filter((b) => b.type === 'main_hub');
  }

  const activeMainHubId =
    currentBranch.type === 'main_hub' ? currentBranch.id : currentBranch.parentHubId;

  return branches.filter((b) => {
    // Main hubs are visible across the network
    if (b.type === 'main_hub') return true;

    // Sub-branches ("فرعي"): only visible if linked to this main hub
    if (activeMainHubId && b.parentHubId === activeMainHubId) {
      return true;
    }

    // Direct match if currentBranch is this sub-branch itself
    if (b.id === currentBranch.id) {
      return true;
    }

    return false;
  });
}

/**
 * Get sub-branches ("نقاط فرعية") belonging strictly to a given main hub.
 */
export function getSubBranchesForMainHub(branches: Branch[], mainHubId: string): Branch[] {
  if (!mainHubId) return [];
  return branches.filter((b) => b.type === 'collection_point' && b.parentHubId === mainHubId);
}
