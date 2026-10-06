export type UnifiedConnectionState =
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'DEGRADED_LOCAL'
  | 'CONNECTED';

export interface ConnectionInfo {
  state: UnifiedConnectionState;
  label: string;
  color: 'rose' | 'amber' | 'orange' | 'emerald';
  icon: 'offline' | 'syncing' | 'warning' | 'ok';
  showBanner: boolean;
  bannerMessage?: string;
}

export function deriveConnectionState(
  cloudSyncState: any,
  isOnline: boolean
): ConnectionInfo {
  // 1. DISCONNECTED — Priority
  if (
    !isOnline ||
    cloudSyncState?.status === 'offline' ||
    cloudSyncState?.databaseBackend === 'disconnected' ||
    cloudSyncState?.isConnectionFrozen
  ) {
    return {
      state: 'DISCONNECTED',
      label: 'غير متصل',
      color: 'rose',
      icon: 'offline',
      showBanner: true,
      bannerMessage:
        'لا يوجد اتصال بالسيرفر الرئيسي — النظام يعمل حالياً بوضع الحفظ المحلي الآمن.',
    };
  }

  // 2. RECONNECTING
  if (
    cloudSyncState?.status === 'retrying' ||
    cloudSyncState?.status === 'syncing'
  ) {
    return {
      state: 'RECONNECTING',
      label: 'جاري المزامنة',
      color: 'amber',
      icon: 'syncing',
      showBanner: true,
      bannerMessage: 'جاري مزامنة السجلات المعلقة مع السيرفر المركزي...',
    };
  }

  // 3. DEGRADED_LOCAL
  if (
    cloudSyncState?.status === 'connected' &&
    !cloudSyncState?.postgresConnected
  ) {
    return {
      state: 'DEGRADED_LOCAL',
      label: 'تخزين مؤقت',
      color: 'orange',
      icon: 'warning',
      showBanner: false, // لا banner — فقط badge صغير
    };
  }

  // 4. CONNECTED
  return {
    state: 'CONNECTED',
    label: 'متصل',
    color: 'emerald',
    icon: 'ok',
    showBanner: false,
  };
}
