// Guard for single-page offline continuity
// Rule: No reliance on browser cache except strictly for the active page where connection was severed,
// until connection is restored or the browser is closed.

import { subscribeServerConnection } from './serverConnectionGuard';

export const PAGE_ARABIC_NAMES: Record<string, string> = {
  dashboard: 'لوحة التحكم والمؤشرات اللوجستية',
  intake: 'تسجيل وإرسال الطرود (المستودع)',
  manifests: 'منافيست الشاحنات (الترحيل والتحميل)',
  arrivals: 'استلام وتفريغ الشاحنات بالمستودع',
  delivery: 'تسليم الطرود للزبائن والمندوبين',
  cashbox: 'الصندوق المالي والحسابات',
  pricing: 'محرك التسعير والتعرفات',
  admin_users: 'المستخدمين والفروع والصلاحيات',
  backup_cloud: 'النسخ الاحتياطي والمزامنة السحابية',
  master_admin: 'لوحة الإدارة العليا والرقابة',
  expenses: 'المصاريف والنفقات التشغيلية',
  customers: 'دليل العملاء (المرسلين والمستلمين)',
  vehicles: 'أسطول الشاحنات والمركبات',
  payroll: 'رواتب ومستحقات الموظفين',
  fixed_assets: 'الأصول الثابتة والعهد',
  courier_portal: 'بوابة المندوبين الميدانية',
  customer_portal: 'بوابة تتبع الشحنات للزبائن',
};

let currentActivePageId = 'intake';
let isConnectionSevered = typeof navigator !== 'undefined' ? !navigator.onLine : false;
let disconnectedPageId: string | null = null;
let disconnectedTimestamp: number | null = null;

const disconnectedPageBuffers = new Map<string, any>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('[OfflinePageGuard] Listener error:', e);
    }
  });
}

/**
 * Update the active page/module in view
 */
export function setCurrentActivePage(pageId: string) {
  if (pageId && currentActivePageId !== pageId) {
    currentActivePageId = pageId;
    notifyListeners();
  }
}

export function getCurrentActivePage(): string {
  return currentActivePageId;
}

/**
 * Handle network connection state transitions
 */
export function handleConnectionStateChange(online: boolean) {
  if (!online) {
    if (!isConnectionSevered) {
      isConnectionSevered = true;
      disconnectedPageId = currentActivePageId;
      disconnectedTimestamp = Date.now();
      console.warn(
        `[OfflinePageGuard] انقطع الاتصال بالسيرفر! تفعيل عزل الحماية وحصر كاش الصفحة حصرياً على: [${disconnectedPageId}]`
      );
      notifyListeners();
    }
  } else {
    if (isConnectionSevered) {
      isConnectionSevered = false;
      disconnectedPageId = null;
      disconnectedTimestamp = null;
      disconnectedPageBuffers.clear();
      console.log(
        '[OfflinePageGuard] استعادة الاتصال بالسيرفر الرئيسي! تم إلغاء كاش الصفحة واستئناف المزامنة الحية مباشرة.'
      );
      notifyListeners();
    }
  }
}

/**
 * Check whether a specific page is authorized to use an offline buffer.
 * STRICT RULE: Only the exact page where the connection was severed may use its offline buffer.
 */
export function isPageAllowedOfflineBuffer(pageId: string): boolean {
  if (!isConnectionSevered) {
    // When online, NEVER rely on offline cache; always live server
    return false;
  }
  return disconnectedPageId === pageId;
}

/**
 * Check if the user is attempting to navigate away from the disconnected page
 */
export function isNavigationBlockedByDisconnection(targetPageId: string): boolean {
  if (!isConnectionSevered) return false;
  if (!disconnectedPageId) return false;
  return targetPageId !== disconnectedPageId;
}

/**
 * Save draft/buffer strictly for the disconnected page
 */
export function saveDisconnectedPageBuffer(pageId: string, snapshot: any) {
  if (isConnectionSevered && disconnectedPageId === pageId) {
    disconnectedPageBuffers.set(pageId, {
      savedAt: Date.now(),
      snapshot,
    });
  }
}

/**
 * Retrieve buffer strictly for the disconnected page
 */
export function getDisconnectedPageBuffer(pageId: string): any | null {
  if (isConnectionSevered && disconnectedPageId === pageId) {
    const entry = disconnectedPageBuffers.get(pageId);
    return entry?.snapshot ?? null;
  }
  return null;
}

/**
 * Get human-readable details about the disconnected page
 */
export function getDisconnectedPageDetails() {
  const arabicName = disconnectedPageId
    ? PAGE_ARABIC_NAMES[disconnectedPageId] || disconnectedPageId
    : null;
  return {
    isConnectionSevered,
    disconnectedPageId,
    disconnectedPageName: arabicName,
    disconnectedTimestamp,
  };
}

/**
 * Subscribe to offline guard state changes
 */
export function subscribeOfflinePageGuard(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Hook into serverConnectionGuard
subscribeServerConnection((online) => {
  handleConnectionStateChange(online);
});

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => handleConnectionStateChange(true));
  window.addEventListener('offline', () => handleConnectionStateChange(false));
}
