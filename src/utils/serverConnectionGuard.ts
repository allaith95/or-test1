// Server Connection & Strict Online Persistence Guard Utility
// Ensures that critical operations ONLY commit to the central server when online,
// preventing ghost data loss and preserving in-progress form inputs completely.

export const SERVER_OFFLINE_NOTICE =
  'لا يوجد اتصال بالسيرفر الرئيسي، يرجى الانتظار حتى عودة الاتصال والبقاء ضمن الصفحة الحالية';

let isLastKnownServerOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let lastServerCheckTimestamp = 0;
const SERVER_CHECK_TTL_MS = 2500; // 2.5 seconds cache for fast user interaction

const serverConnectionListeners = new Set<(online: boolean) => void>();

export function subscribeServerConnection(listener: (online: boolean) => void): () => void {
  serverConnectionListeners.add(listener);
  listener(isLastKnownServerOnline);
  return () => {
    serverConnectionListeners.delete(listener);
  };
}

function notifyServerConnectionChange(online: boolean) {
  if (isLastKnownServerOnline !== online) {
    isLastKnownServerOnline = online;
    serverConnectionListeners.forEach((fn) => fn(online));
  }
}

/**
 * Perform a quick active ping to the server
 */
export async function checkServerReachable(force = false): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyServerConnectionChange(false);
    return false;
  }

  const now = Date.now();
  if (!force && now - lastServerCheckTimestamp < SERVER_CHECK_TTL_MS) {
    return isLastKnownServerOnline;
  }

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch('/api/ping', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    const online = res.ok;
    lastServerCheckTimestamp = now;
    notifyServerConnectionChange(online);
    return online;
  } catch {
    lastServerCheckTimestamp = now;
    notifyServerConnectionChange(false);
    return false;
  }
}

/**
 * Synchronous quick check based on last known state
 */
export function isServerOnlineSync(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return isLastKnownServerOnline;
}

// Attach browser window events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    checkServerReachable(true);
  });
  window.addEventListener('offline', () => {
    notifyServerConnectionChange(false);
  });
  // Initial check on load
  setTimeout(() => {
    checkServerReachable(true);
  }, 1000);
}
