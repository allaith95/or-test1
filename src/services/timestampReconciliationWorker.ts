import { safeStorage } from '../utils/storage';
import { loadSavedVpsConfig } from './vpsClient';

export interface TimestampDigest {
  count: number;
  latestTimestamp: string;
  maxTimeMs: number;
}

export interface WorkerReconciliationEvent {
  timestamp: string;
  serverTime: string;
  timeDriftMs: number;
  collectionsUpdated: string[];
  recordsCount: number;
  message: string;
}

export interface TimestampWorkerStats {
  isActive: boolean;
  status: 'idle' | 'comparing' | 'reconciling' | 'synced' | 'offline' | 'error';
  lastRunTime: string | null;
  serverTime: string | null;
  timeDriftMs: number;
  totalComparisons: number;
  totalReconciledRecords: number;
  lastEvent: WorkerReconciliationEvent | null;
  collectionTimestamps: Record<string, string>;
  serverDigests: Record<string, TimestampDigest>;
  errorMessage?: string;
}

export type SensitiveCollectionName =
  | 'transactions'
  | 'shiftSettlementVouchers'
  | 'settlements'
  | 'truckManifests'
  | 'courierManifests'
  | 'parcels'
  | 'vouchers'
  | 'expenses'
  | 'expenseCategories'
  | 'branches'
  | 'users'
  | 'customers'
  | 'pricingRules'
  | 'brandingSettings'
  | 'codSettings'
  | 'vehicles'
  | 'employees'
  | 'payrollRecords'
  | 'fixedAssets'
  | 'notifications'
  | 'directMessages'
  | 'auditLogs'
  | 'courierIntakeSettlements';

export interface ReconciliationCallbacks {
  onDeltaReceived?: (delta: Record<string, any[]>, updatedCollections: string[]) => void;
  onFullPullNeeded?: () => Promise<void>;
  getLocalItems?: (collection: string) => any[];
}

const STORAGE_TIMESTAMPS_KEY = 'orca_worker_collection_timestamps';

export class TimestampReconciliationWorker {
  private timerId: any = null;
  private isProcessing = false;
  private callbacks: ReconciliationCallbacks = {};
  private listeners: Set<(stats: TimestampWorkerStats) => void> = new Set();

  private localTimestamps: Record<string, string> = {};
  private stats: TimestampWorkerStats = {
    isActive: false,
    status: 'idle',
    lastRunTime: null,
    serverTime: null,
    timeDriftMs: 0,
    totalComparisons: 0,
    totalReconciledRecords: 0,
    lastEvent: null,
    collectionTimestamps: {},
    serverDigests: {},
  };

  constructor() {
    this.loadSavedTimestamps();
    this.setupBrowserEvents();
  }

  private loadSavedTimestamps() {
    try {
      const saved = safeStorage.getItem(STORAGE_TIMESTAMPS_KEY);
      if (saved) {
        this.localTimestamps = JSON.parse(saved);
        this.stats.collectionTimestamps = { ...this.localTimestamps };
      }
    } catch {
      this.localTimestamps = {};
    }
  }

  private saveTimestamps() {
    try {
      safeStorage.setItem(STORAGE_TIMESTAMPS_KEY, JSON.stringify(this.localTimestamps));
      this.stats.collectionTimestamps = { ...this.localTimestamps };
    } catch {
      // storage quota or private browsing
    }
  }

  private setupBrowserEvents() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.triggerImmediateReconciliation('شبكة متصلة - فحص فوري');
      });
      window.addEventListener('focus', () => {
        this.triggerImmediateReconciliation('نافذة نشطة - فحص فوري');
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.triggerImmediateReconciliation('استعادة الواجهة - فحص فوري');
        }
      });
    }
  }

  public subscribe(listener: (stats: TimestampWorkerStats) => void) {
    this.listeners.add(listener);
    listener(this.stats);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(patch: Partial<TimestampWorkerStats>) {
    this.stats = {
      ...this.stats,
      ...patch,
    };
    this.listeners.forEach((fn) => fn(this.stats));
  }

  public getStats(): TimestampWorkerStats {
    return { ...this.stats };
  }

  public registerCallbacks(cb: ReconciliationCallbacks) {
    this.callbacks = cb;
  }

  private getBaseUrl(): string {
    const cfg = loadSavedVpsConfig();
    return (cfg.serverUrl || '').trim().replace(/\/+$/, '');
  }

  private getHeaders(): Record<string, string> {
    const cfg = loadSavedVpsConfig();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cfg.apiKey) {
      headers['Authorization'] = `Bearer ${cfg.apiKey}`;
    }
    return headers;
  }

  /**
   * Updates local timestamp for a collection after local mutation or sync
   */
  public updateLocalTimestamp(collection: string, timestamp?: string) {
    const t = timestamp || new Date().toISOString();
    const current = this.localTimestamps[collection];
    if (!current || new Date(t).getTime() > new Date(current).getTime()) {
      this.localTimestamps[collection] = t;
      this.saveTimestamps();
    }
  }

  private lastCycleTime = 0;

  /**
   * Start the background reconciliation worker
   * intervalSeconds: 0 means purely event & action driven (zero periodic timer)
   * intervalSeconds > 0 means background heartbeat (default 5s)
   */
  public start(intervalSeconds = 5) {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this.notify({ isActive: true, status: 'idle' });

    // Run first cycle gently after 500ms
    setTimeout(() => {
      this.runReconciliationCycle('بدء تشغيل المراقب');
    }, 500);

    // If intervalSeconds is 0, operate in 100% Action & Event Driven mode
    if (intervalSeconds > 0) {
      const safeIntervalMs = Math.max(30000, intervalSeconds * 1000);
      this.timerId = setInterval(() => {
        // Pause if tab is hidden / minimized in background to protect router bandwidth
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        this.runReconciliationCycle();
      }, safeIntervalMs);
    }

    // Attach visibility and focus listeners for instant synchronization
    if (typeof window !== 'undefined') {
      const onFocusOrVisible = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          this.triggerImmediateReconciliation('window_focus_or_visible');
        }
      };
      window.removeEventListener('focus', onFocusOrVisible);
      window.addEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      document.addEventListener('visibilitychange', onFocusOrVisible);
    }
  }

  /**
   * Stop background worker
   */
  public stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.notify({ isActive: false, status: 'idle' });
  }

  /**
   * Force an immediate reconciliation cycle on demand
   */
  public async triggerImmediateReconciliation(triggerReason?: string) {
    if (this.isProcessing) return;
    const now = Date.now();
    // Throttle / debounce (5000ms) to prevent traffic storms across tabs or rapid event triggers
    if (now - this.lastCycleTime < 5000) return;
    return this.runReconciliationCycle(triggerReason);
  }

  /**
   * Core worker cycle:
   * 1. Fetches server timestamp digests
   * 2. Compares local timestamp vs server timestamp per sensitive collection
   * 3. Fetches delta for any newer records on server
   * 4. Dispatches delta to application context instantly
   */
  public async runReconciliationCycle(reason?: string): Promise<boolean> {
    if (this.isProcessing) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify({ status: 'offline' });
      return false;
    }

    const baseUrl = this.getBaseUrl();
    this.isProcessing = true;
    this.notify({ status: 'comparing' });

    try {
      const startTime = Date.now();
      // Step 1: Lightweight timestamp digest fetch with 6s timeout
      const ctrl1 = new AbortController();
      const timeout1 = setTimeout(() => ctrl1.abort(), 6000);
      let timestampRes: Response;
      try {
        timestampRes = await fetch(`${baseUrl}/api/sync/timestamps`, {
          method: 'GET',
          headers: this.getHeaders(),
          signal: ctrl1.signal,
        });
      } finally {
        clearTimeout(timeout1);
      }

      if (!timestampRes.ok) {
        throw new Error(`Server returned ${timestampRes.status}`);
      }

      const timestampJson = await timestampRes.json();
      if (!timestampJson.success || !timestampJson.digests) {
        throw new Error('Invalid timestamp digest response');
      }

      const serverTimeStr = timestampJson.serverTime || new Date().toISOString();
      const serverTimeMs = new Date(serverTimeStr).getTime();
      const clientTimeMs = Date.now();
      const driftMs = Math.round(serverTimeMs - clientTimeMs);

      const serverDigests: Record<string, TimestampDigest> = timestampJson.digests;
      const collectionsNeedingDelta: string[] = [];
      const timestampsToSend: Record<string, string> = {};
      const countsToSend: Record<string, number> = {};

      // Compute local max timestamps if available
      for (const col of Object.keys(serverDigests)) {
        const sDigest = serverDigests[col];
        let localTimeStr = this.localTimestamps[col];
        const localItems = this.callbacks.getLocalItems ? this.callbacks.getLocalItems(col) : null;
        const localCount = Array.isArray(localItems) ? localItems.length : 0;
        countsToSend[col] = localCount;

        // If no saved local timestamp, check items from memory or default to 1970
        if (!localTimeStr && localItems && localItems.length > 0) {
          let maxLocalMs = 0;
          for (const it of localItems) {
            const itTime = this.extractItemTimeMs(it);
            if (itTime > maxLocalMs) maxLocalMs = itTime;
          }
          if (maxLocalMs > 0) {
            localTimeStr = new Date(maxLocalMs).toISOString();
            this.localTimestamps[col] = localTimeStr;
          }
        }

        const localTimeMs = localTimeStr ? new Date(localTimeStr).getTime() : 0;
        timestampsToSend[col] = localTimeStr || '1970-01-01T00:00:00.000Z';

        // Check if server has newer timestamps or count mismatch
        if (
          sDigest.count !== localCount ||
          sDigest.maxTimeMs > localTimeMs
        ) {
          collectionsNeedingDelta.push(col);
        }
      }

      let totalNewRecords = 0;
      const updatedCollections: string[] = [];

      // Step 2: Fetch delta if server has changes (with 8s timeout)
      if (collectionsNeedingDelta.length > 0) {
        this.notify({ status: 'reconciling' });
        const ctrl2 = new AbortController();
        const timeout2 = setTimeout(() => ctrl2.abort(), 8000);
        let deltaRes: Response;
        try {
          deltaRes = await fetch(`${baseUrl}/api/sync/delta`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              timestamps: timestampsToSend,
              counts: countsToSend,
            }),
            signal: ctrl2.signal,
          });
        } finally {
          clearTimeout(timeout2);
        }

        if (deltaRes.ok) {
          const deltaJson = await deltaRes.json();
          if (deltaJson.success && deltaJson.delta) {
            const delta = deltaJson.delta;
            for (const col of Object.keys(delta)) {
              const list = delta[col];
              if (Array.isArray(list)) {
                totalNewRecords += list.length;
                updatedCollections.push(col);

                if (list.length > 0) {
                  // Update local timestamp to highest from delta or server max
                  let highestMs = 0;
                  for (const it of list) {
                    const itTime = this.extractItemTimeMs(it);
                    if (itTime > highestMs) highestMs = itTime;
                  }
                  const serverMaxMs = serverDigests[col]?.maxTimeMs || 0;
                  const safeMs = Math.max(highestMs, serverMaxMs);
                  if (safeMs > 0) {
                    this.localTimestamps[col] = new Date(safeMs).toISOString();
                  }
                } else {
                  // Collection wiped on server
                  this.localTimestamps[col] = '1970-01-01T00:00:00.000Z';
                }
              }
            }

            this.saveTimestamps();

            // Dispatch to registered context handler
            if (this.callbacks.onDeltaReceived && updatedCollections.length > 0) {
              this.callbacks.onDeltaReceived(delta, updatedCollections);
            }
          }
        }
      }

      const nowIso = new Date().toISOString();
      const lastEvent: WorkerReconciliationEvent | null =
        updatedCollections.length > 0
          ? {
              timestamp: nowIso,
              serverTime: serverTimeStr,
              timeDriftMs: driftMs,
              collectionsUpdated: updatedCollections,
              recordsCount: totalNewRecords,
              message: `تمت مزامنة ${totalNewRecords} سجل فوري (${updatedCollections.join(', ')}) بناءً على الطابع الزمني`,
            }
          : this.stats.lastEvent;

      this.notify({
        status: 'synced',
        lastRunTime: nowIso,
        serverTime: serverTimeStr,
        timeDriftMs: driftMs,
        totalComparisons: this.stats.totalComparisons + 1,
        totalReconciledRecords: this.stats.totalReconciledRecords + totalNewRecords,
        serverDigests,
        lastEvent,
        errorMessage: undefined,
      });

      return true;
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      this.notify({
        status: 'error',
        errorMessage: isTimeout ? 'تأخر في استجابة الشبكة المحلية (Timeout > 6s)' : (err.message || 'خطأ في مقارنة الطوابع الزمنية مع السيرفر'),
      });
      return false;
    } finally {
      this.isProcessing = false;
      this.lastCycleTime = Date.now();
    }
  }

  private extractItemTimeMs(item: any): number {
    if (!item || typeof item !== 'object') return 0;
    const candidates = [
      item.updatedAt,
      item.timestamp,
      item.closedAt,
      item.approvedAt,
      item.dispatchedAt,
      item.receivedAt,
      item.arrivedAtDestAt,
      item.createdAt,
      item.date,
      item._syncedAt,
    ];
    let max = 0;
    for (const c of candidates) {
      if (c) {
        const ms = new Date(c).getTime();
        if (!isNaN(ms) && ms > max) max = ms;
      }
    }
    return max;
  }
}

export const timestampWorker = new TimestampReconciliationWorker();
