import { safeStorage } from '../utils/storage';

export interface VpsServerConfig {
  serverUrl: string; // e.g. "http://localhost:3000" or "https://api.orca-express.com"
  apiKey?: string; // Optional security auth token
  companyName: string;
  companyCode: string;
  autoSyncEnabled: boolean;
  syncIntervalSeconds: number; // e.g. 5 seconds
  isConnected: boolean;
  lastPingMs: number;
  lastConnectedAt: string | null;
  environmentMode: 'production' | 'staging' | 'local_vps';
  branchBindingId?: string;
}

const VPS_CONFIG_STORAGE_KEY = 'orca_vps_server_config';

export const DEFAULT_VPS_CONFIG: VpsServerConfig = {
  serverUrl: '',
  apiKey: '',
  companyName: 'أوركا إكسبريس للخدمات اللوجستية والشحن',
  companyCode: 'ORCA-SY-VPS',
  autoSyncEnabled: true,
  syncIntervalSeconds: 5,
  isConnected: true,
  lastPingMs: 0,
  lastConnectedAt: null,
  environmentMode: 'production',
  branchBindingId: '',
};

/**
 * Load saved VPS server configuration from local storage
 */
export function loadSavedVpsConfig(): VpsServerConfig {
  try {
    const raw = safeStorage.getItem(VPS_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_VPS_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to parse saved VPS configuration:', err);
  }
  return { ...DEFAULT_VPS_CONFIG };
}

/**
 * Save VPS configuration to local storage
 */
export function saveVpsConfig(config: VpsServerConfig): void {
  try {
    safeStorage.setItem(VPS_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save VPS configuration:', err);
  }
}

/**
 * Test live connection to VPS Server URL
 */
export async function testVpsConnection(config: VpsServerConfig): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  serverInfo?: any;
}> {
  const targetUrl = (config.serverUrl || '').trim().replace(/\/+$/, '');
  const urlToFetch = targetUrl ? `${targetUrl}/api/health` : '/api/health';

  const startTime = Date.now();
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 5000);

  try {
    const res = await fetch(urlToFetch, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      signal: ctrl.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.max(5, Date.now() - startTime);

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        latencyMs,
        message: `تم التحقق بنجاح والاتصال بسيرفر VPS الخاص بالشركة! سرعة الاستجابة: ${latencyMs}ms`,
        serverInfo: data,
      };
    } else {
      return {
        success: false,
        latencyMs,
        message: `أرجع السيرفر رمز استجابة: ${res.status} (${res.statusText})`,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      latencyMs: 0,
      message:
        err.name === 'AbortError'
          ? 'انتهت مهلة الاتصال بسيرفر VPS (Timeout > 5s). تحقق من صحة الرابط وجدار الحماية.'
          : `تعذر الوصول إلى سيرفر VPS (${err.message || 'خطأ في الاتصال'}). تحقق من تشغيل السيرفر أو الرابط.`,
    };
  }
}

/**
 * Fetch live PostgreSQL database status from the server
 */
export async function fetchPostgresStatus(serverUrl?: string): Promise<{
  success: boolean;
  postgres: {
    connected: boolean;
    pingMs: number;
    database?: string;
    error?: string | null;
    counts?: Record<string, number>;
    configSource?: string;
  };
  fallbackFileActive: boolean;
  recordCountsInMemory?: Record<string, number>;
}> {
  const targetUrl = (serverUrl || '').trim().replace(/\/+$/, '');
  const url = targetUrl ? `${targetUrl}/api/db/status` : '/api/db/status';

  try {
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
    return {
      success: false,
      postgres: { connected: false, pingMs: 0, error: `Server error: ${res.status}` },
      fallbackFileActive: true,
    };
  } catch (e: any) {
    return {
      success: false,
      postgres: { connected: false, pingMs: 0, error: e.message },
      fallbackFileActive: true,
    };
  }
}

/**
 * Send connection string to server to test and connect PostgreSQL
 */
export async function connectPostgresDatabase(
  serverUrl: string | undefined,
  databaseUrl: string
): Promise<{ success: boolean; message: string; status?: any }> {
  const targetUrl = (serverUrl || '').trim().replace(/\/+$/, '');
  const url = targetUrl ? `${targetUrl}/api/db/connect` : '/api/db/connect';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseUrl }),
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      message: `فشل الاتصال: ${e.message}`,
    };
  }
}

/**
 * Trigger seeding local database memory into PostgreSQL tables
 */
export async function seedPostgresDatabase(
  serverUrl?: string
): Promise<{ success: boolean; message: string; recordsSaved?: number; error?: string }> {
  const targetUrl = (serverUrl || '').trim().replace(/\/+$/, '');
  const url = targetUrl ? `${targetUrl}/api/db/seed-to-postgres` : '/api/db/seed-to-postgres';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (e: any) {
    return {
      success: false,
      message: 'فشل الترحيل',
      error: e.message,
    };
  }
}

/**
 * Fetch live Financial Audit Trail from PostgreSQL
 */
export async function fetchFinancialAuditTrail(
  serverUrl?: string,
  limit = 50
): Promise<{ success: boolean; count: number; isPostgres: boolean; data: any[]; error?: string }> {
  const targetUrl = (serverUrl || '').trim().replace(/\/+$/, '');
  const url = targetUrl ? `${targetUrl}/api/audit/financial?limit=${limit}` : `/api/audit/financial?limit=${limit}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
    return { success: false, count: 0, isPostgres: false, data: [], error: `Server response: ${res.status}` };
  } catch (e: any) {
    return { success: false, count: 0, isPostgres: false, data: [], error: e.message };
  }
}

/**
 * Initialize a fresh, clean PostgreSQL database with standard tables and initial users
 */
export async function initCleanPostgresDatabase(
  serverUrl?: string
): Promise<{ success: boolean; message: string; postgresCleared?: boolean; error?: string }> {
  const targetUrl = (serverUrl || '').trim().replace(/\/+$/, '');
  const url = targetUrl ? `${targetUrl}/api/db/init-clean` : '/api/db/init-clean';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, message: 'فشلت التهيئة', error: e.message };
  }
}


