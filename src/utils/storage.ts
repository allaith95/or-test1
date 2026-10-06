// Persistent Storage Architecture — Orca Logistics
// Uses localStorage as the primary store.
// Falls back to memory only if localStorage is unavailable.
// NEVER auto-clears data on unload/refresh.

const memoryFallback = new Map<string, string>();

/**
 * Admin-only: Explicitly clears all site data.
 * ⚠️ Only call from an admin button with explicit user confirmation.
 */
export async function clearAllSiteCacheAndStorage(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.clear();
      } catch (e) {
        console.warn('[Storage] localStorage clear warning:', e);
      }
      try {
        window.sessionStorage.clear();
      } catch (e) {
        console.warn('[Storage] sessionStorage clear warning:', e);
      }
      memoryFallback.clear();

      if ('caches' in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map((k) => window.caches.delete(k)));
        } catch (cErr) {
          console.warn('[Storage] caches purge warning:', cErr);
        }
      }

      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) await reg.unregister();
        } catch (swErr) {
          console.warn('[Storage] SW unregister warning:', swErr);
        }
      }

      console.log('[Storage] Admin purge completed.');
    }
  } catch (err) {
    console.warn('[Storage] Purge error:', err);
  }
}

/**
 * safeStorage: uses localStorage as primary persistence.
 * Survives page reloads, tab closures, and browser restarts.
 * Falls back to memory ONLY if localStorage fails (rare).
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Fallback
    }
    return memoryFallback.get(key) ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (err) {
      // QuotaExceededError — log clearly, do NOT silently fail
      console.error(
        `[Storage] ⚠️ localStorage setItem failed for key "${key}":`,
        err
      );
    }
    // Only use memory as last resort (visible in console)
    memoryFallback.set(key, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Fallback
    }
    memoryFallback.delete(key);
  },

  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.clear();
      }
    } catch {
      // Fallback
    }
    memoryFallback.clear();
  },
};

export function safeConfirm(message: string): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
  } catch {
    console.warn('window.confirm blocked; proceeding.');
    return true;
  }
  return true;
}

export const setPrintMode = (mode: 'a4' | 'thermal' | 'thermal-58') => {
  if (typeof document !== 'undefined') {
    document.body.classList.remove('print-a4', 'print-thermal', 'print-thermal-58');
    document.body.classList.add(`print-${mode}`);
  }
};

export const clearPrintMode = () => {
  if (typeof document !== 'undefined') {
    document.body.classList.remove('print-a4', 'print-thermal', 'print-thermal-58', 'orca-printing');
  }
};

export function safePrint(mode: 'a4' | 'thermal' | 'thermal-58' = 'a4'): void {
  try {
    if (typeof window !== 'undefined') {
      window.focus();
      setPrintMode(mode);
      document.body.classList.add('orca-printing');
      const cleanUp = () => {
        clearPrintMode();
        window.removeEventListener('afterprint', cleanUp);
      };
      window.addEventListener('afterprint', cleanUp);
      if (typeof window.print === 'function') window.print();
      setTimeout(cleanUp, 2000);
    }
  } catch (err) {
    console.warn('window.print error:', err);
    clearPrintMode();
  }
}

/**
 * Emergency localStorage cleanup to free up quota when hitting the 5MB browser limit.
 * Trims oversized logs, deletes legacy duplicate keys, and strips orphan Base64 strings.
 */
export function emergencyLocalStorageCleanup(): {
  beforeMB: number;
  afterMB: number;
  freedMB: number;
  removed: string[];
} {
  const beforeMB = estimateTotalSize();
  const removed: string[] = [];

  if (typeof window === 'undefined' || !window.localStorage) {
    return { beforeMB: 0, afterMB: 0, freedMB: 0, removed: [] };
  }

  // 1. Delete orphan Base64 remaining in any localStorage key
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const val = localStorage.getItem(key) || '';

    if (val.includes('data:image/')) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.map((item: any) => {
            const copy = { ...item };
            for (const k of Object.keys(copy)) {
              if (typeof copy[k] === 'string' && copy[k].startsWith('data:image/')) {
                copy[k] = '__MIGRATED__';
              }
            }
            if (copy.sender && typeof copy.sender === 'object') {
              for (const k of Object.keys(copy.sender)) {
                if (typeof copy.sender[k] === 'string' && copy.sender[k].startsWith('data:image/')) {
                  copy.sender[k] = '__MIGRATED__';
                }
              }
            }
            if (copy.receiver && typeof copy.receiver === 'object') {
              for (const k of Object.keys(copy.receiver)) {
                if (typeof copy.receiver[k] === 'string' && copy.receiver[k].startsWith('data:image/')) {
                  copy.receiver[k] = '__MIGRATED__';
                }
              }
            }
            return copy;
          });
          localStorage.setItem(key, JSON.stringify(cleaned));
          removed.push(`${key} (stripped base64)`);
        }
      } catch (err) {
        console.warn(`Failed to clean ${key}:`, err);
      }
    }
  }

  // 2. Remove obsolete legacy keys from previous versions
  const legacyKeys = [
    'orca_logistics_v4_parcels',
    'orca_logistics_v4_truck_manifests',
    'orca_logistics_v4_transactions',
    'orca_logistics_v4_customers',
    'orca_logistics_v4_users',
    'orca_logistics_v4_branches',
    'orca_vps_sync_queue',
  ];

  for (const key of legacyKeys) {
    const val = localStorage.getItem(key);
    if (val) {
      localStorage.removeItem(key);
      removed.push(key);
    }
  }

  // 3. Trim parcelEvents (keep only last 500)
  try {
    const evKey = 'parcelEvents';
    const raw = localStorage.getItem(evKey);
    if (raw) {
      const events = JSON.parse(raw);
      if (Array.isArray(events) && events.length > 500) {
        const kept = events
          .sort(
            (a, b) =>
              new Date(b.serverTimestamp || 0).getTime() -
              new Date(a.serverTimestamp || 0).getTime()
          )
          .slice(0, 500);
        localStorage.setItem(evKey, JSON.stringify(kept));
        removed.push(`${evKey} (trimmed to 500)`);
      }
    }
  } catch {}

  // 4. Trim audit logs (keep only last 200)
  try {
    const logKey = 'ORCA_LOGISTICS_DB_CLEAN_PROD_ZERO_V5_audit_logs';
    const raw = localStorage.getItem(logKey);
    if (raw) {
      const logs = JSON.parse(raw);
      if (Array.isArray(logs) && logs.length > 200) {
        const kept = logs.slice(0, 200);
        localStorage.setItem(logKey, JSON.stringify(kept));
        removed.push(`${logKey} (trimmed to 200)`);
      }
    }
  } catch {}

  // 5. Trim notifications (keep only last 100)
  try {
    const notKey = 'ORCA_LOGISTICS_DB_CLEAN_PROD_ZERO_V5_notifications';
    const raw = localStorage.getItem(notKey);
    if (raw) {
      const nots = JSON.parse(raw);
      if (Array.isArray(nots) && nots.length > 100) {
        const kept = nots.slice(0, 100);
        localStorage.setItem(notKey, JSON.stringify(kept));
        removed.push(`${notKey} (trimmed to 100)`);
      }
    }
  } catch {}

  const afterMB = estimateTotalSize();

  return {
    beforeMB: Math.round(beforeMB * 100) / 100,
    afterMB: Math.round(afterMB * 100) / 100,
    freedMB: Math.round((beforeMB - afterMB) * 100) / 100,
    removed,
  };
}

export function estimateTotalSize(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const val = localStorage.getItem(key) || '';
    total += (key.length + val.length) * 2;
  }
  return total / 1024 / 1024;
}
