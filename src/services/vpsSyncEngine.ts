import {
  Branch,
  User,
  Parcel,
  TruckManifest,
  CourierManifest,
  CashboxTransaction,
  ShiftSettlementVoucher,
  DailySettlement,
  SystemNotification,
  Customer,
  PricingRule,
  FinancialVoucher,
  Expense,
  ExpenseCategoryItem,
  Vehicle,
  Employee,
  PayrollRecord,
  FixedAsset,
  DirectMessage,
  AuditLogEntry,
  CompanyBrandingSettings,
  CodTransferSettings,
  CourierIntakeSettlementVoucher,
  CloudSyncStatus,
  CloudSyncState,
  InterBranchObligation,
  ParcelEvent,
} from '../types';
import { safeStorage } from '../utils/storage';
import { loadSavedVpsConfig, VpsServerConfig } from './vpsClient';
import { timestampWorker } from './timestampReconciliationWorker';
import { getHandlingStatusRank } from '../utils/parcelMergeEngine';

export const MANIFEST_PROGRESSION: Record<string, number> = {
  draft: 0,
  loading: 1,
  ready: 2,
  dispatched: 3,
  in_transit: 4,
  arrived: 5,
  discharging: 6,
  received: 7,
  completed: 8,
  cancelled: -1,
};

const VPS_QUEUE_KEY = 'orca_vps_sync_queue';
const LAST_SYNC_KEY = 'orca_vps_last_sync_timestamp';
const LEGACY_STORAGE_KEY = 'orca_logistics_v4';

export interface VpsPendingQueueItem {
  id: string;
  collectionName: string;
  action: 'upsert' | 'delete';
  data?: any;
  timestamp: string;
}

export interface VpsRealtimeCallbacks {
  onParcels?: (parcels: Parcel[]) => void;
  onTruckManifests?: (manifests: TruckManifest[]) => void;
  onCourierManifests?: (manifests: CourierManifest[]) => void;
  onBranches?: (branches: Branch[]) => void;
  onUsers?: (users: User[]) => void;
  onTransactions?: (transactions: CashboxTransaction[]) => void;
  onShiftVouchers?: (shiftVouchers: ShiftSettlementVoucher[]) => void;
  onCourierIntakeSettlements?: (vouchers: CourierIntakeSettlementVoucher[]) => void;
  onSettlements?: (settlements: DailySettlement[]) => void;
  onNotifications?: (notifications: SystemNotification[]) => void;
  onCustomers?: (customers: Customer[]) => void;
  onPricingRules?: (pricingRules: PricingRule[]) => void;
  onVouchers?: (vouchers: FinancialVoucher[]) => void;
  onExpenses?: (expenses: Expense[]) => void;
  onExpenseCategories?: (expenseCategories: ExpenseCategoryItem[]) => void;
  onVehicles?: (vehicles: Vehicle[]) => void;
  onEmployees?: (employees: Employee[]) => void;
  onPayrollRecords?: (payrollRecords: PayrollRecord[]) => void;
  onFixedAssets?: (fixedAssets: FixedAsset[]) => void;
  onDirectMessages?: (directMessages: DirectMessage[]) => void;
  onBranding?: (branding: CompanyBrandingSettings) => void;
  onCodSettings?: (codSettings: CodTransferSettings) => void;
  onAuditLogs?: (auditLogs: AuditLogEntry[]) => void;
  onZeroWipe?: () => void;
}

export class UniversalVpsSyncEngine {
  private queue: VpsPendingQueueItem[] = [];
  private pollIntervalId: any = null;
  private stateListeners: Set<(state: CloudSyncState) => void> = new Set();
  private registeredCallbacks: VpsRealtimeCallbacks = {};
  private isProcessingQueue = false;
  private broadcastChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private sseReconnectTimer: any = null;
  private shouldReconnectSSE: boolean = true;
  private sseRetryCount: number = 0;
  private lastPingAt: number = 0;
  private pingWatchdogTimer: any = null;
  private visibilityHandlerAttached: boolean = false;
  private serverUsersCache: any[] = [];
  private serverBranchesCache: any[] = [];

  public state: CloudSyncState = {
    status: 'idle',
    lastSyncTimestamp: safeStorage.getItem(LAST_SYNC_KEY) || null,
    pendingQueueCount: 0,
    realtimeActive: false,
    boundBranchId: undefined,
    databaseBackend: 'fallback_local',
    postgresConnected: false,
    postgresPingMs: 0,
    postgresError: null,
    isConnectionFrozen: false,
    strictServerConfirmationPolicy: true,
  };

  constructor() {
    this.loadQueue();
    this.setupNetworkListeners();
    this.setupBroadcastBus();
  }

  private setupBroadcastBus() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('orca_realtime_tab_bus');
        this.broadcastChannel.onmessage = (event) => {
          const msg = event.data;
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'tab_mutation') {
            const { collection, item, action, itemId } = msg;
            if (item?.id && this.isItemPendingStrict(collection, item)) return;
            this.dispatchSingleItemToCallbacks(collection, item, action, itemId);
          } else if (msg.type === 'tab_reconcile') {
            timestampWorker.triggerImmediateReconciliation('cross_tab_trigger');
          } else if (msg.type === 'zero_wipe_reset') {
            this.executeLocalZeroWipe(false);
          }
        };
      } catch (err) {
        console.warn('[BroadcastBus] Error initializing BroadcastChannel:', err);
      }
    }
  }

  public executeLocalZeroWipe(broadcastToTabs = true) {
    // 1. Purge offline sync queue
    this.queue = [];
    this.saveQueue();

    // 2. Clear all local storage cache keys
    const STORAGE_KEY = 'ORCA_LOGISTICS_DB_CLEAN_PROD_ZERO_V5';
    const keysToPurge = [
      `${STORAGE_KEY}_parcels`,
      `${STORAGE_KEY}_truck_manifests`,
      `${STORAGE_KEY}_courier_manifests`,
      `${STORAGE_KEY}_transactions`,
      `${STORAGE_KEY}_settlements`,
      `${STORAGE_KEY}_shift_settlements`,
      `${STORAGE_KEY}_courier_intake_settlements`,
      `${STORAGE_KEY}_vouchers`,
      `${STORAGE_KEY}_customers`,
      `${STORAGE_KEY}_vehicles`,
      `${STORAGE_KEY}_employees`,
      `${STORAGE_KEY}_payroll_records`,
      `${STORAGE_KEY}_expenses`,
      `${STORAGE_KEY}_fixed_assets`,
      `${STORAGE_KEY}_direct_messages`,
      `${STORAGE_KEY}_notifications`,
      `${STORAGE_KEY}_audit_logs`,
      `${STORAGE_KEY}_branches`,
      `${STORAGE_KEY}_pricing_rules`,
      'orca_vps_sync_queue',
      'orca_worker_collection_timestamps',
      LAST_SYNC_KEY,
    ];
    for (const k of keysToPurge) {
      safeStorage.removeItem(k);
    }

    // 3. Reset all registered callbacks with empty arrays or dedicated zero wipe handler
    if (this.registeredCallbacks.onZeroWipe) {
      this.registeredCallbacks.onZeroWipe();
    } else {
      if (this.registeredCallbacks.onParcels) this.registeredCallbacks.onParcels([]);
      if (this.registeredCallbacks.onTruckManifests) this.registeredCallbacks.onTruckManifests([]);
      if (this.registeredCallbacks.onCourierManifests) this.registeredCallbacks.onCourierManifests([]);
      if (this.registeredCallbacks.onTransactions) this.registeredCallbacks.onTransactions([]);
      if (this.registeredCallbacks.onShiftVouchers) this.registeredCallbacks.onShiftVouchers([]);
      if (this.registeredCallbacks.onCourierIntakeSettlements) this.registeredCallbacks.onCourierIntakeSettlements([]);
      if (this.registeredCallbacks.onSettlements) this.registeredCallbacks.onSettlements([]);
      if (this.registeredCallbacks.onVouchers) this.registeredCallbacks.onVouchers([]);
      if (this.registeredCallbacks.onCustomers) this.registeredCallbacks.onCustomers([]);
      if (this.registeredCallbacks.onVehicles) this.registeredCallbacks.onVehicles([]);
      if (this.registeredCallbacks.onEmployees) this.registeredCallbacks.onEmployees([]);
      if (this.registeredCallbacks.onPayrollRecords) this.registeredCallbacks.onPayrollRecords([]);
      if (this.registeredCallbacks.onExpenses) this.registeredCallbacks.onExpenses([]);
      if (this.registeredCallbacks.onFixedAssets) this.registeredCallbacks.onFixedAssets([]);
      if (this.registeredCallbacks.onDirectMessages) this.registeredCallbacks.onDirectMessages([]);
      if (this.registeredCallbacks.onNotifications) this.registeredCallbacks.onNotifications([]);
      if (this.registeredCallbacks.onBranches) this.registeredCallbacks.onBranches([]);
      if (this.registeredCallbacks.onPricingRules) this.registeredCallbacks.onPricingRules([]);
    }

    // 4. Update sync engine state
    this.notifyState({
      status: 'connected',
      pendingQueueCount: 0,
      lastSyncTimestamp: new Date().toISOString(),
    });

    // 5. Broadcast to other open browser tabs
    if (broadcastToTabs && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'zero_wipe_reset' });
      } catch {}
    }
  }

  private connectServerEvents() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    this.disconnectServerEvents();

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/sync/events`;

    try {
      this.eventSource = new EventSource(url);
      
      // ⚡ onopen: طبقة الشبكة — تصفير العداد وتحديث آخر ping
      this.eventSource.onopen = () => {
        this.sseRetryCount = 0;
        this.lastPingAt = Date.now();
        console.log('[SSE] Connection opened');
      };

      // حدث مخصص من السيرفر
      this.eventSource.addEventListener('connected', () => {
        this.notifyState({ status: 'connected', realtimeActive: true });
        
        // ✅ لا Full Pull عند كل اتصال.
        // بدلاً منه: مزامنة خفيفة بعد 2 ثانية (delta فقط).
        // Full Pull يحدث فقط عند أول تشغيل (mount) أو يدوياً.
        setTimeout(() => {
          if (this.state.realtimeActive) {
            // طلب delta للأحداث الفائتة أثناء الانقطاع
            timestampWorker.triggerImmediateReconciliation('sse_reconnected');
          }
        }, 2000);
      });

      // ⚡ استماع لحدث ping (الـ Watchdog)
      this.eventSource.addEventListener('ping', () => {
        this.lastPingAt = Date.now();
      });

      this.eventSource.addEventListener('item_mutation', (e: MessageEvent) => {
        this.lastPingAt = Date.now();  // أي حدث يُحدّث lastPingAt
        try {
          const parsed = JSON.parse(e.data);
          if (parsed?.payload) {
            const { collection, item, action, itemId } = parsed.payload;
            if (item?.id && this.isItemPendingStrict(collection, item)) return;
            this.dispatchSingleItemToCallbacks(collection, item, action, itemId);
          }
        } catch {
          timestampWorker.triggerImmediateReconciliation('sse_item_mutation_parse');
        }
      });

      this.eventSource.addEventListener('batch_mutation', (e: MessageEvent) => {
        this.lastPingAt = Date.now();
        try {
          const parsed = JSON.parse(e.data);
          const operations = parsed?.payload?.operations;
          
          if (Array.isArray(operations) && operations.length > 0) {
            // ✅ New format: contains actual items
            this.dispatchBatchToCallbacks(operations);
          } else {
            // ⚠️ Old format (backward compat): trigger reconciliation
            timestampWorker.triggerImmediateReconciliation('sse_batch_mutation_legacy');
          }
        } catch (err) {
          console.warn('[SSE] batch_mutation parse error:', err);
          timestampWorker.triggerImmediateReconciliation('sse_batch_mutation_error');
        }
      });

      this.eventSource.addEventListener('full_sync', () => {
        this.lastPingAt = Date.now();
        timestampWorker.triggerImmediateReconciliation('sse_full_sync');
      });

      this.eventSource.addEventListener('clear_operational', () => {
        this.executeLocalZeroWipe(true);
        this.pullFullDatabaseFromCloud();
      });

      this.eventSource.addEventListener('zero_wipe_reset', () => {
        this.executeLocalZeroWipe(true);
        this.pullFullDatabaseFromCloud();
      });

      // ⚡ onerror: إعادة الاتصال مع Exponential Backoff
      this.eventSource.onerror = () => {
        console.warn('[SSE] Connection error');
        this.disconnectServerEvents();
        
        if (!this.shouldReconnectSSE) return;
        
        this.sseRetryCount++;
        const delay = Math.min(
          1000 * Math.pow(2, Math.min(this.sseRetryCount - 1, 5)),
          30000
        );
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.sseRetryCount})`);
        
        this.sseReconnectTimer = setTimeout(() => {
          if (this.shouldReconnectSSE) {
            this.connectServerEvents();
          }
        }, delay);
      };

      // ⚡ ابدأ الـ Watchdog
      this.startPingWatchdog();
      
      // ⚡ ربط visibilitychange مرة واحدة فقط
      this.attachVisibilityHandler();
      
    } catch (err) {
      console.error('[SSE] Failed to instantiate EventSource:', err);
    }
  }

  private disconnectServerEvents() {
    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    if (this.pingWatchdogTimer !== null) {
      clearInterval(this.pingWatchdogTimer);
      this.pingWatchdogTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private startPingWatchdog() {
    if (this.pingWatchdogTimer !== null) {
      clearInterval(this.pingWatchdogTimer);
    }
    this.pingWatchdogTimer = window.setInterval(() => {
      if (this.lastPingAt === 0) return; // لم يبدأ بعد
      const elapsed = Date.now() - this.lastPingAt;
      // السيرفر يُرسل ping كل 15s. إذا مرّ 90s → الاتصال ميت
      if (elapsed > 90000) {
        console.warn(
          `[SSE Watchdog] No ping for ${Math.round(elapsed / 1000)}s — forcing reconnect`
        );
        this.disconnectServerEvents();
        this.connectServerEvents();
      }
    }, 30000); // فحص كل 30 ثانية
  }

  private attachVisibilityHandler() {
    if (this.visibilityHandlerAttached) return;
    if (typeof document === 'undefined') return;
    
    this.visibilityHandlerAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (!this.shouldReconnectSSE) return;
        const elapsed = this.lastPingAt > 0 
          ? Date.now() - this.lastPingAt 
          : Infinity;
        // إذا مرّ أكثر من 90 ثانية بدون ping → أعد الاتصال فوراً
        if (!this.eventSource || elapsed > 90000) {
          console.log('[SSE] App visible — reconnecting');
          this.disconnectServerEvents();
          this.connectServerEvents();
        }
      }
    });
  }

  private dispatchSingleItemToCallbacks(collectionName: string, item: any, action: 'upsert' | 'delete', _itemId?: string) {
    if (!collectionName) return;

    if (action === 'delete') {
      timestampWorker.triggerImmediateReconciliation(`delete_${collectionName}`);
      return;
    }

    if (!item) return;

    switch (collectionName) {
      case 'parcels':
        if (this.registeredCallbacks.onParcels) this.registeredCallbacks.onParcels([item]);
        break;
      case 'branches':
        if (this.registeredCallbacks.onBranches) this.registeredCallbacks.onBranches([item]);
        break;
      case 'users':
        if (this.registeredCallbacks.onUsers) this.registeredCallbacks.onUsers([item]);
        break;
      case 'truckManifests':
        if (this.registeredCallbacks.onTruckManifests) this.registeredCallbacks.onTruckManifests([item]);
        break;
      case 'courierManifests':
        if (this.registeredCallbacks.onCourierManifests) this.registeredCallbacks.onCourierManifests([item]);
        break;
      case 'transactions':
        if (this.registeredCallbacks.onTransactions) this.registeredCallbacks.onTransactions([item]);
        break;
      case 'shiftSettlementVouchers':
        if (this.registeredCallbacks.onShiftVouchers) this.registeredCallbacks.onShiftVouchers([item]);
        break;
      case 'courierIntakeSettlements':
        if (this.registeredCallbacks.onCourierIntakeSettlements) this.registeredCallbacks.onCourierIntakeSettlements([item]);
        break;
      case 'settlements':
        if (this.registeredCallbacks.onSettlements) this.registeredCallbacks.onSettlements([item]);
        break;
      case 'customers':
        if (this.registeredCallbacks.onCustomers) this.registeredCallbacks.onCustomers([item]);
        break;
      case 'pricingRules':
        if (this.registeredCallbacks.onPricingRules) this.registeredCallbacks.onPricingRules([item]);
        break;
      case 'vouchers':
        if (this.registeredCallbacks.onVouchers) this.registeredCallbacks.onVouchers([item]);
        break;
      case 'expenses':
        if (this.registeredCallbacks.onExpenses) this.registeredCallbacks.onExpenses([item]);
        break;
      case 'expenseCategories':
        if (this.registeredCallbacks.onExpenseCategories) this.registeredCallbacks.onExpenseCategories([item]);
        break;
      case 'vehicles':
        if (this.registeredCallbacks.onVehicles) this.registeredCallbacks.onVehicles([item]);
        break;
      case 'employees':
        if (this.registeredCallbacks.onEmployees) this.registeredCallbacks.onEmployees([item]);
        break;
      case 'payrollRecords':
        if (this.registeredCallbacks.onPayrollRecords) this.registeredCallbacks.onPayrollRecords([item]);
        break;
      case 'fixedAssets':
        if (this.registeredCallbacks.onFixedAssets) this.registeredCallbacks.onFixedAssets([item]);
        break;
      case 'directMessages':
        if (this.registeredCallbacks.onDirectMessages) this.registeredCallbacks.onDirectMessages([item]);
        break;
      case 'notifications':
        if (this.registeredCallbacks.onNotifications) this.registeredCallbacks.onNotifications([item]);
        break;
      case 'auditLogs':
        if (this.registeredCallbacks.onAuditLogs) this.registeredCallbacks.onAuditLogs([item]);
        break;
      case 'brandingSettings':
        if (this.registeredCallbacks.onBranding) this.registeredCallbacks.onBranding(item);
        break;
      case 'codSettings':
        if (this.registeredCallbacks.onCodSettings) this.registeredCallbacks.onCodSettings(item);
        break;
    }

    const itemTime = item.updatedAt || item.timestamp || item.createdAt || new Date().toISOString();
    timestampWorker.updateLocalTimestamp(collectionName, itemTime);
  }

  /**
   * Dispatches a batch of operations to registered callbacks in 
   * ONE group per collection (single state update per collection).
   * 
   * This replaces N individual dispatches with 1 dispatch per 
   * collection type.
   */
  private dispatchBatchToCallbacks(
    operations: Array<{
      collection: string;
      item: any;
      action: 'upsert' | 'delete';
      itemId?: string;
    }>
  ): void {
    if (!Array.isArray(operations) || operations.length === 0) return;

    // Group operations by collection
    const byCollection: Record<string, {
      upserts: any[];
      deletes: string[];
    }> = {};

    for (const op of operations) {
      if (!op || !op.collection) continue;
      if (!byCollection[op.collection]) {
        byCollection[op.collection] = { upserts: [], deletes: [] };
      }
      
      if (op.action === 'delete') {
        if (op.itemId) {
          byCollection[op.collection].deletes.push(op.itemId);
        }
      } else if (op.item) {
        // ✅ isItemPendingStrict check (same as single dispatch)
        if (this.isItemPendingStrict(op.collection, op.item)) {
          continue; // skip this item
        }
        byCollection[op.collection].upserts.push(op.item);
      }
    }

    // ✅ Dispatch ONE call per collection
    for (const [collection, group] of Object.entries(byCollection)) {
      // Handle upserts
      if (group.upserts.length > 0) {
        switch (collection) {
          case 'parcels':
            if (this.registeredCallbacks.onParcels) {
              this.registeredCallbacks.onParcels(group.upserts);
            }
            break;
          case 'truckManifests':
            if (this.registeredCallbacks.onTruckManifests) {
              this.registeredCallbacks.onTruckManifests(group.upserts);
            }
            break;
          case 'courierManifests':
            if (this.registeredCallbacks.onCourierManifests) {
              this.registeredCallbacks.onCourierManifests(group.upserts);
            }
            break;
          case 'branches':
            if (this.registeredCallbacks.onBranches) {
              this.registeredCallbacks.onBranches(group.upserts);
            }
            break;
          case 'users':
            if (this.registeredCallbacks.onUsers) {
              this.registeredCallbacks.onUsers(group.upserts);
            }
            break;
          case 'customers':
            if (this.registeredCallbacks.onCustomers) {
              this.registeredCallbacks.onCustomers(group.upserts);
            }
            break;
          case 'transactions':
            if (this.registeredCallbacks.onTransactions) {
              this.registeredCallbacks.onTransactions(group.upserts);
            }
            break;
          case 'vouchers':
            if (this.registeredCallbacks.onVouchers) {
              this.registeredCallbacks.onVouchers(group.upserts);
            }
            break;
          case 'shiftSettlementVouchers':
            if (this.registeredCallbacks.onShiftVouchers) {
              this.registeredCallbacks.onShiftVouchers(group.upserts);
            }
            break;
          case 'courierIntakeSettlements':
            if (this.registeredCallbacks.onCourierIntakeSettlements) {
              this.registeredCallbacks.onCourierIntakeSettlements(group.upserts);
            }
            break;
          case 'expenses':
            if (this.registeredCallbacks.onExpenses) {
              this.registeredCallbacks.onExpenses(group.upserts);
            }
            break;
          case 'expenseCategories':
            if (this.registeredCallbacks.onExpenseCategories) {
              this.registeredCallbacks.onExpenseCategories(group.upserts);
            }
            break;
          case 'vehicles':
            if (this.registeredCallbacks.onVehicles) {
              this.registeredCallbacks.onVehicles(group.upserts);
            }
            break;
          case 'employees':
            if (this.registeredCallbacks.onEmployees) {
              this.registeredCallbacks.onEmployees(group.upserts);
            }
            break;
          case 'payrollRecords':
            if (this.registeredCallbacks.onPayrollRecords) {
              this.registeredCallbacks.onPayrollRecords(group.upserts);
            }
            break;
          case 'fixedAssets':
            if (this.registeredCallbacks.onFixedAssets) {
              this.registeredCallbacks.onFixedAssets(group.upserts);
            }
            break;
          case 'directMessages':
            if (this.registeredCallbacks.onDirectMessages) {
              this.registeredCallbacks.onDirectMessages(group.upserts);
            }
            break;
          case 'notifications':
            if (this.registeredCallbacks.onNotifications) {
              this.registeredCallbacks.onNotifications(group.upserts);
            }
            break;
          case 'auditLogs':
            if (this.registeredCallbacks.onAuditLogs) {
              this.registeredCallbacks.onAuditLogs(group.upserts);
            }
            break;
          case 'pricingRules':
            if (this.registeredCallbacks.onPricingRules) {
              this.registeredCallbacks.onPricingRules(group.upserts);
            }
            break;
          case 'brandingSettings':
            if (this.registeredCallbacks.onBranding && group.upserts[group.upserts.length - 1]) {
              this.registeredCallbacks.onBranding(group.upserts[group.upserts.length - 1]);
            }
            break;
          case 'codSettings':
            if (this.registeredCallbacks.onCodSettings && group.upserts[group.upserts.length - 1]) {
              this.registeredCallbacks.onCodSettings(group.upserts[group.upserts.length - 1]);
            }
            break;
          default:
            // Generic fallback: trigger reconciliation for unhandled
            timestampWorker.triggerImmediateReconciliation(`batch_${collection}`);
            break;
        }

        // Update timestamp for latest item in group
        const latestItem = group.upserts[group.upserts.length - 1];
        if (latestItem) {
          const itemTime = latestItem.updatedAt || latestItem.timestamp || latestItem.createdAt || new Date().toISOString();
          timestampWorker.updateLocalTimestamp(collection, itemTime);
        }
      }

      // Handle deletes (usually triggers reconciliation)
      if (group.deletes.length > 0) {
        timestampWorker.triggerImmediateReconciliation(`batch_delete_${collection}`);
      }
    }
  }

  public registerStateListener(listener: (state: CloudSyncState) => void) {
    return this.subscribeState(listener);
  }

  public resetConnection() {
    this.stopRealtimeSync();
    const cfg = loadSavedVpsConfig();
    this.state.boundBranchId = cfg.branchBindingId;
    if (Object.keys(this.registeredCallbacks).length > 0) {
      this.startRealtimeSync(this.registeredCallbacks);
    }
  }

  public subscribeState(listener: (state: CloudSyncState) => void) {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyState(patch: Partial<CloudSyncState>) {
    this.state = {
      ...this.state,
      ...patch,
      pendingQueueCount: this.queue.length,
    };
    this.stateListeners.forEach((fn) => fn(this.state));
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

  private setupNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processOfflineQueue();
      });
      window.addEventListener('offline', () => {
        this.notifyState({ status: 'offline' });
      });
    }
  }

  public startRealtimeSync(callbacks: VpsRealtimeCallbacks) {
    this.registeredCallbacks = callbacks;
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    const cfg = loadSavedVpsConfig();
    this.notifyState({
      realtimeActive: true,
      status: cfg.isConnected ? 'connected' : 'idle',
      boundBranchId: cfg.branchBindingId,
    });

    // Run first sync pull immediately
    this.pullFullDatabaseFromCloud();
    this.processOfflineQueue();

    // Connect to server real-time event stream (SSE) for < 300ms instant updates
    this.connectServerEvents();

    // Continuous light queue drain interval (zero network requests when queue is empty)
    const intervalSec = Math.max(4, cfg.syncIntervalSeconds || 6);
    this.pollIntervalId = setInterval(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.notifyState({ status: 'offline' });
        return;
      }
      // ONLY process pending offline queue if there are pending local changes
      if (this.queue.length > 0) {
        await this.processOfflineQueue();
      }
    }, intervalSec * 1000);
  }

  public stopRealtimeSync() {
    this.disconnectServerEvents();
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.notifyState({ realtimeActive: false, status: 'idle' });
  }

  public async pullFullDatabaseFromCloud(): Promise<{ success: boolean; data?: any; message?: string }> {
    const baseUrl = this.getBaseUrl();
    try {
      this.notifyState({ status: 'syncing' });
      const res = await fetch(`${baseUrl}/api/sync/pull`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        throw new Error(`Server status ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        const now = new Date().toISOString();
        safeStorage.setItem(LAST_SYNC_KEY, now);
        const isPg = Boolean(json.postgres?.connected || json.source === 'PostgreSQL');
        this.notifyState({
          status: 'connected',
          lastSyncTimestamp: now,
          errorMessage: undefined,
          databaseBackend: isPg ? 'postgresql' : 'fallback_local',
          postgresConnected: isPg,
          postgresPingMs: isPg ? 5 : 0,
          postgresError: isPg ? null : 'قاعدة PostgreSQL غير متصلة (العمل بالتخزين المحلي الآمن)',
        });

        // Cache latest confirmed server records for initial reconciliation and auto-push guards
        if (Array.isArray(json.data.users)) {
          this.serverUsersCache = json.data.users;
        }
        if (Array.isArray(json.data.branches)) {
          this.serverBranchesCache = json.data.branches;
        }

        // Dispatch to registered callbacks
        if (this.registeredCallbacks.onParcels && json.data.parcels) {
          this.registeredCallbacks.onParcels(json.data.parcels);
        }
        if (this.registeredCallbacks.onBranches && json.data.branches) {
          this.registeredCallbacks.onBranches(json.data.branches);
        }
        if (this.registeredCallbacks.onUsers && json.data.users) {
          this.registeredCallbacks.onUsers(json.data.users);
        }
        if (this.registeredCallbacks.onTruckManifests && json.data.truckManifests) {
          this.registeredCallbacks.onTruckManifests(json.data.truckManifests);
        }
        if (this.registeredCallbacks.onCourierManifests && json.data.courierManifests) {
          this.registeredCallbacks.onCourierManifests(json.data.courierManifests);
        }
        if (this.registeredCallbacks.onTransactions && json.data.transactions) {
          this.registeredCallbacks.onTransactions(json.data.transactions);
        }
        if (this.registeredCallbacks.onShiftVouchers && json.data.shiftSettlementVouchers) {
          this.registeredCallbacks.onShiftVouchers(json.data.shiftSettlementVouchers);
        }
        if (this.registeredCallbacks.onCourierIntakeSettlements && json.data.courierIntakeSettlements) {
          this.registeredCallbacks.onCourierIntakeSettlements(json.data.courierIntakeSettlements);
        }
        if (this.registeredCallbacks.onSettlements && json.data.settlements) {
          this.registeredCallbacks.onSettlements(json.data.settlements);
        }
        if (this.registeredCallbacks.onCustomers && json.data.customers) {
          this.registeredCallbacks.onCustomers(json.data.customers);
        }
        if (this.registeredCallbacks.onPricingRules && json.data.pricingRules) {
          this.registeredCallbacks.onPricingRules(json.data.pricingRules);
        }
        if (this.registeredCallbacks.onVouchers && json.data.vouchers) {
          this.registeredCallbacks.onVouchers(json.data.vouchers);
        }
        if (this.registeredCallbacks.onExpenses && json.data.expenses) {
          this.registeredCallbacks.onExpenses(json.data.expenses);
        }
        if (this.registeredCallbacks.onExpenseCategories && json.data.expenseCategories) {
          this.registeredCallbacks.onExpenseCategories(json.data.expenseCategories);
        }
        if (this.registeredCallbacks.onVehicles && json.data.vehicles) {
          this.registeredCallbacks.onVehicles(json.data.vehicles);
        }
        if (this.registeredCallbacks.onEmployees && json.data.employees) {
          this.registeredCallbacks.onEmployees(json.data.employees);
        }
        if (this.registeredCallbacks.onPayrollRecords && json.data.payrollRecords) {
          this.registeredCallbacks.onPayrollRecords(json.data.payrollRecords);
        }
        if (this.registeredCallbacks.onFixedAssets && json.data.fixedAssets) {
          this.registeredCallbacks.onFixedAssets(json.data.fixedAssets);
        }
        if (this.registeredCallbacks.onDirectMessages && json.data.directMessages) {
          this.registeredCallbacks.onDirectMessages(json.data.directMessages);
        }
        if (this.registeredCallbacks.onNotifications && json.data.notifications) {
          this.registeredCallbacks.onNotifications(json.data.notifications);
        }
        if (this.registeredCallbacks.onAuditLogs && json.data.auditLogs) {
          this.registeredCallbacks.onAuditLogs(json.data.auditLogs);
        }
        if (this.registeredCallbacks.onBranding && json.data.brandingSettings) {
          const b = Array.isArray(json.data.brandingSettings) ? json.data.brandingSettings[0] : json.data.brandingSettings;
          if (b) this.registeredCallbacks.onBranding(b);
        }
        if (this.registeredCallbacks.onCodSettings && json.data.codSettings) {
          const c = Array.isArray(json.data.codSettings) ? json.data.codSettings[0] : json.data.codSettings;
          if (c) this.registeredCallbacks.onCodSettings(c);
        }

        return { success: true, data: json.data, message: 'تم سحب البيانات من سيرفر VPS بنجاح' };
      }
      return { success: false, message: 'لا توجد بيانات' };
    } catch (err: any) {
      // ✅ لا نحذف الطابور — فقط نُسجّل الحالة
      console.warn(
        '[VpsSyncEngine] pullFullDatabaseFromCloud failed (queue preserved):',
        err?.message
      );
      this.notifyState({
        status: 'retrying',
        isConnectionFrozen: false,
        pendingQueueCount: this.queue.length,
        errorMessage: err?.message
          ? `تعذر السحب — إعادة محاولة: ${err.message}`
          : 'تعذر السحب — إعادة محاولة',
      });
      return { 
        success: false, 
        message: err?.message || 'تعذر الوصول للسيرفر' 
      };
    }
  }

  public async pushFullDatabaseToCloud(state: Record<string, any>): Promise<{ success: boolean; count: number; message: string }> {
    const baseUrl = this.getBaseUrl();
    try {
      this.notifyState({ status: 'syncing' });
      const res = await fetch(`${baseUrl}/api/sync/push`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(state),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const json = await res.json();
      const now = new Date().toISOString();
      safeStorage.setItem(LAST_SYNC_KEY, now);
      this.notifyState({
        status: 'connected',
        lastSyncTimestamp: now,
        errorMessage: undefined,
      });

      let total = 0;
      Object.keys(state).forEach((k) => {
        if (Array.isArray(state[k])) total += state[k].length;
      });

      return { success: true, count: total, message: json.message || 'تمت المزامنة وحفظ البيانات على سيرفر VPS بنجاح' };
    } catch (err: any) {
      this.notifyState({ status: 'error', errorMessage: err.message });
      return { success: false, count: 0, message: err.message || 'فشل الاتصال بسيرفر VPS' };
    }
  }

  public async purgeOperationalDataFromCloud(): Promise<{ success: boolean; message: string }> {
    const baseUrl = this.getBaseUrl();
    try {
      this.notifyState({ status: 'syncing' });
      const res = await fetch(`${baseUrl}/api/db/zero-wipe`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const json = await res.json();
      this.executeLocalZeroWipe(true);
      this.notifyState({ status: 'connected' });
      return { success: Boolean(json.success), message: json.message || 'تم تفريغ كافة البيانات وتصفير الأجهزة بنجاح' };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل تفريغ البيانات من السيرفر' };
    }
  }

  public async processOfflineQueue(): Promise<{ processed: number; remaining: number }> {
    // 🛑 Security Filter: Client NEVER pushes users or branches to server
    this.queue = this.queue.filter((q) => q.collectionName !== 'users' && q.collectionName !== 'branches');

    if (this.queue.length === 0) return { processed: 0, remaining: 0 };
    if (this.isProcessingQueue) return { processed: 0, remaining: this.queue.length };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notifyState({ status: 'offline' });
      return { processed: 0, remaining: this.queue.length };
    }

    const baseUrl = this.getBaseUrl();

    // 🛑 Cause 3 Guard: Check if server database is empty while local queue is present
    try {
      const statusRes = await fetch(`${baseUrl}/api/db/status`, {
        headers: this.getHeaders(),
      }).catch(() => null);

      if (statusRes && statusRes.ok) {
        const serverStatus = await statusRes.json();
        if ((serverStatus?.isDbEmpty || serverStatus?.isBootstrapped === false) && this.queue.length > 0) {
          console.warn('[Sync] Server DB is empty + local queue present → BLOCKED & PURGED');
          this.queue = [];
          this.saveQueue();
          this.notifyState({
            status: 'connected',
            pendingQueueCount: 0,
          });
          return { processed: 0, remaining: 0 };
        }
      }
    } catch (guardErr) {
      console.warn('[VpsSyncEngine] DB status check warning:', guardErr);
    }

    this.isProcessingQueue = true;
    const batch = [...this.queue];

    const ctrl = new AbortController();
    // Dynamic timeout: 20s base + 500ms per item (max 60s)
    const dynamicTimeout = Math.min(20000 + batch.length * 500, 60000);
    const timeoutId = setTimeout(() => ctrl.abort(), dynamicTimeout);

    try {
      const res = await fetch(`${baseUrl}/api/sync/batch`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          queue: batch.map((it) => ({
            collection: it.collectionName,
            item: it.data,
            action: it.action === 'delete' ? 'delete' : 'upsert',
            itemId: it.id,
          })),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        // Remove only successfully dispatched batch items (keep any newer items in queue)
        this.queue = this.queue.filter(
          (q) => !batch.some((b) => b.id === q.id && b.collectionName === q.collectionName)
        );
        this.saveQueue();
        const now = new Date().toISOString();
        safeStorage.setItem(LAST_SYNC_KEY, now);

        // Reset retry counter on success
        this.state.retryCount = 0;

        this.notifyState({
          status: 'connected',
          isConnectionFrozen: false, // Unfreeze on successful transmission
          lastSyncTimestamp: now,
          pendingQueueCount: this.queue.length,
          errorMessage: undefined,
        });
        setTimeout(() => {
          timestampWorker.triggerImmediateReconciliation('after_queue_drain');
        }, 300);
        return { processed: batch.length, remaining: this.queue.length };
      }

      // ✅ معالجة خاصة لـ 503 (PostgreSQL down)
      if (res.status === 503) {
        console.warn('[VpsSyncEngine] Server returned 503 (DB unavailable)');
        this.notifyState({
          status: 'error',
          isConnectionFrozen: false,
          pendingQueueCount: this.queue.length,
          errorMessage: 'قاعدة البيانات المركزية غير متاحة — سنُعيد المحاولة بعد 30 ثانية',
        });
        // retry بعد 30s (ليس 5s)
        setTimeout(() => {
          void this.processOfflineQueue();
        }, 30000);
        return { processed: 0, remaining: this.queue.length };
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      clearTimeout(timeoutId);

      // CRITICAL ARCHITECTURAL FIX: Do NOT purge queue on network error.
      // Retain all items in queue and schedule exponential backoff retry.
      const retryCount = (this.state.retryCount || 0) + 1;
      this.state.retryCount = retryCount;

      this.notifyState({
        status: 'retrying',
        isConnectionFrozen: false,
        pendingQueueCount: this.queue.length,
        errorMessage: err?.message
          ? `خطأ شبكة مؤقت — جارٍ إعادة المحاولة (${retryCount}): ${err.message}`
          : `خطأ شبكة مؤقت — جارٍ إعادة المحاولة (${retryCount})`,
      });
    } finally {
      this.isProcessingQueue = false;
      if (this.queue.length > 0) {
        // Exponential backoff: 5s, 10s, 20s, 40s, 60s max ceiling
        const delay =
          this.state.status === 'retrying'
            ? Math.min(5000 * Math.pow(2, Math.min((this.state.retryCount || 1) - 1, 5)), 60000)
            : 50;
        setTimeout(() => {
          void this.processOfflineQueue();
        }, delay);
      }
    }

    return { processed: 0, remaining: this.queue.length };
  }

  private async pollServerUpdates() {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await fetch(`${baseUrl}/api/sync/pull`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          if (this.registeredCallbacks.onParcels && json.data.parcels) {
            this.registeredCallbacks.onParcels(json.data.parcels);
          }
          if (this.registeredCallbacks.onBranches && json.data.branches) {
            this.registeredCallbacks.onBranches(json.data.branches);
          }
          if (this.registeredCallbacks.onUsers && json.data.users) {
            this.registeredCallbacks.onUsers(json.data.users);
          }
          if (this.registeredCallbacks.onTruckManifests && json.data.truckManifests) {
            this.registeredCallbacks.onTruckManifests(json.data.truckManifests);
          }
          if (this.registeredCallbacks.onCourierManifests && json.data.courierManifests) {
            this.registeredCallbacks.onCourierManifests(json.data.courierManifests);
          }
          if (this.registeredCallbacks.onTransactions && json.data.transactions) {
            this.registeredCallbacks.onTransactions(json.data.transactions);
          }
          if (this.registeredCallbacks.onShiftVouchers && json.data.shiftSettlementVouchers) {
            this.registeredCallbacks.onShiftVouchers(json.data.shiftSettlementVouchers);
          }
          if (this.registeredCallbacks.onCourierIntakeSettlements && json.data.courierIntakeSettlements) {
            this.registeredCallbacks.onCourierIntakeSettlements(json.data.courierIntakeSettlements);
          }
          if (this.registeredCallbacks.onSettlements && json.data.settlements) {
            this.registeredCallbacks.onSettlements(json.data.settlements);
          }
          if (this.registeredCallbacks.onCustomers && json.data.customers) {
            this.registeredCallbacks.onCustomers(json.data.customers);
          }
          if (this.registeredCallbacks.onPricingRules && json.data.pricingRules) {
            this.registeredCallbacks.onPricingRules(json.data.pricingRules);
          }
          if (this.registeredCallbacks.onVouchers && json.data.vouchers) {
            this.registeredCallbacks.onVouchers(json.data.vouchers);
          }
          if (this.registeredCallbacks.onExpenses && json.data.expenses) {
            this.registeredCallbacks.onExpenses(json.data.expenses);
          }
          if (this.registeredCallbacks.onExpenseCategories && json.data.expenseCategories) {
            this.registeredCallbacks.onExpenseCategories(json.data.expenseCategories);
          }
          if (this.registeredCallbacks.onVehicles && json.data.vehicles) {
            this.registeredCallbacks.onVehicles(json.data.vehicles);
          }
          if (this.registeredCallbacks.onEmployees && json.data.employees) {
            this.registeredCallbacks.onEmployees(json.data.employees);
          }
          if (this.registeredCallbacks.onPayrollRecords && json.data.payrollRecords) {
            this.registeredCallbacks.onPayrollRecords(json.data.payrollRecords);
          }
          if (this.registeredCallbacks.onFixedAssets && json.data.fixedAssets) {
            this.registeredCallbacks.onFixedAssets(json.data.fixedAssets);
          }
          if (this.registeredCallbacks.onDirectMessages && json.data.directMessages) {
            this.registeredCallbacks.onDirectMessages(json.data.directMessages);
          }
          if (this.registeredCallbacks.onNotifications && json.data.notifications) {
            this.registeredCallbacks.onNotifications(json.data.notifications);
          }
          if (this.registeredCallbacks.onAuditLogs && json.data.auditLogs) {
            this.registeredCallbacks.onAuditLogs(json.data.auditLogs);
          }
          if (this.registeredCallbacks.onBranding && json.data.brandingSettings) {
            const b = Array.isArray(json.data.brandingSettings) ? json.data.brandingSettings[0] : json.data.brandingSettings;
            if (b) this.registeredCallbacks.onBranding(b);
          }
          if (this.registeredCallbacks.onCodSettings && json.data.codSettings) {
            const c = Array.isArray(json.data.codSettings) ? json.data.codSettings[0] : json.data.codSettings;
            if (c) this.registeredCallbacks.onCodSettings(c);
          }

          const isPg = Boolean(json.postgres?.connected || json.source === 'PostgreSQL');
          this.notifyState({
            status: 'connected',
            databaseBackend: isPg ? 'postgresql' : 'fallback_local',
            postgresConnected: isPg,
            postgresPingMs: isPg ? 5 : 0,
            postgresError: isPg ? null : 'قاعدة PostgreSQL غير متصلة (العمل بالتخزين المحلي الآمن)',
          });
        }
      }
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.notifyState({ status: 'offline', databaseBackend: 'disconnected', postgresConnected: false });
      }
    }
  }

  private queueMutation(collectionName: string, id: string, data: any, action: 'upsert' | 'delete') {
    // 🛑 Security Guard: Client NEVER pushes users or branches to server
    if (collectionName === 'users' || collectionName === 'branches') {
      console.warn('[Security] Client attempted to push user/branch — BLOCKED');
      return;
    }

    if (this.state.isConnectionFrozen) {
      console.warn('[VpsSyncEngine] Connection frozen; item will still be queued:', collectionName, id);
    }

    const item: VpsPendingQueueItem = {
      id,
      collectionName,
      action,
      data: action === 'upsert' ? data : undefined,
      timestamp: new Date().toISOString(),
    };

    // Remove existing item in queue with same id if any
    this.queue = this.queue.filter((q) => !(q.collectionName === collectionName && q.id === id));
    this.queue.push(item);
    this.saveQueue();
    this.notifyState({ pendingQueueCount: this.queue.length });

    // Inform timestamp worker of local mutation
    timestampWorker.updateLocalTimestamp(collectionName, item.timestamp);

    // Broadcast across all open tabs on local machine instantly (0ms)
    try {
      this.broadcastChannel?.postMessage({
        type: 'tab_mutation',
        collection: collectionName,
        item: data,
        action,
        itemId: id,
      });
    } catch {
      // ignore
    }

    // Trigger immediate async sync
    this.processOfflineQueue();
  }

  /**
   * Force push all local database records from localStorage to the server offline queue
   * Recovers local data created on device during network isolation.
   */
  public forcePushLocalDatabase(): { queued: number; collections: number } {
    this.state.isConnectionFrozen = false;
    this.state.retryCount = 0;

    const STORAGE_KEY = 'ORCA_LOGISTICS_DB_CLEAN_PROD_ZERO_V5';

    const collectionKeys: Record<string, string[]> = {
      parcels: [
        `${STORAGE_KEY}_parcels`,
        `${LEGACY_STORAGE_KEY}_parcels`,
      ],
      truckManifests: [
        `${STORAGE_KEY}_truck_manifests`,
        `${LEGACY_STORAGE_KEY}_truck_manifests`,
      ],
      courierManifests: [
        `${STORAGE_KEY}_courier_manifests`,
        `${LEGACY_STORAGE_KEY}_courier_manifests`,
      ],
      transactions: [
        `${STORAGE_KEY}_transactions`,
        `${LEGACY_STORAGE_KEY}_transactions`,
      ],
      settlements: [
        `${STORAGE_KEY}_settlements`,
        `${LEGACY_STORAGE_KEY}_settlements`,
      ],
      shiftSettlementVouchers: [
        `${STORAGE_KEY}_shift_settlements`,
        `${LEGACY_STORAGE_KEY}_shift_settlements`,
      ],
      courierIntakeSettlements: [
        `${STORAGE_KEY}_courier_intake_settlements`,
        `${LEGACY_STORAGE_KEY}_courier_intake_settlements`,
      ],
      vouchers: [
        `${STORAGE_KEY}_vouchers`,
        `${LEGACY_STORAGE_KEY}_vouchers`,
      ],
      customers: [
        `${STORAGE_KEY}_customers`,
        `${LEGACY_STORAGE_KEY}_customers`,
      ],
      pricingRules: [
        `${STORAGE_KEY}_pricing_rules`,
        `${LEGACY_STORAGE_KEY}_pricing_rules`,
      ],
      codSettings: [
        `${STORAGE_KEY}_cod_settings`,
        `${LEGACY_STORAGE_KEY}_cod_settings`,
      ],
      expenses: [
        `${STORAGE_KEY}_expenses`,
        `${LEGACY_STORAGE_KEY}_expenses`,
      ],
      expenseCategories: [
        `${STORAGE_KEY}_expense_categories`,
        `${LEGACY_STORAGE_KEY}_expense_categories`,
      ],
      vehicles: [
        `${STORAGE_KEY}_vehicles`,
        `${LEGACY_STORAGE_KEY}_vehicles`,
      ],
      employees: [
        `${STORAGE_KEY}_employees`,
        `${LEGACY_STORAGE_KEY}_employees`,
      ],
      payrollRecords: [
        `${STORAGE_KEY}_payroll_records`,
        `${LEGACY_STORAGE_KEY}_payroll_records`,
      ],
      fixedAssets: [
        `${STORAGE_KEY}_fixed_assets`,
        `${LEGACY_STORAGE_KEY}_fixed_assets`,
      ],
      directMessages: [
        `${STORAGE_KEY}_direct_messages`,
        `${LEGACY_STORAGE_KEY}_direct_messages`,
      ],
      notifications: [
        `${STORAGE_KEY}_notifications`,
        `${LEGACY_STORAGE_KEY}_notifications`,
      ],
      interBranchObligations: ['interBranchObligations'],
      parcelEvents: ['parcelEvents'],
    };

    let queued = 0;
    let collections = 0;

    for (const [collection, keys] of Object.entries(collectionKeys)) {
      try {
        let items: any[] | null = null;
        for (const key of keys) {
          const raw = safeStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                items = parsed;
                break;
              }
            } catch {}
          }
        }
        if (!items) continue;
        collections++;
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const id =
            item.id ||
            item.trackingNumber ||
            item.manifestNumber ||
            item.username ||
            item.code ||
            item.voucherNumber;
          if (!id) continue;
          this.queueMutation(collection, String(id), item, 'upsert');
          queued++;
        }
      } catch (err) {
        console.warn(`[ForcePush] Failed to read ${collection}:`, err);
      }
    }

    void this.processOfflineQueue();
    return { queued, collections };
  }

  /**
   * Atomically queue and dispatch multiple mutations together (e.g. Manifest + Parcels + Notification)
   * Prevents race conditions and guarantees all related records reach the server in one synchronized batch.
   */
  public syncBatch(
    items: Array<{
      collectionName: string;
      id: string;
      data: any;
      action?: 'upsert' | 'delete';
    }>
  ) {
    if (this.state.isConnectionFrozen) {
      console.warn('[VpsSyncEngine] Connection frozen; batch items will still be queued.');
    }

    if (!items || items.length === 0) return;
    const now = new Date().toISOString();
    for (const it of items) {
      const act = it.action || 'upsert';
      const stampedData =
        it.data && typeof it.data === 'object'
          ? { ...it.data, updatedAt: it.data.updatedAt || now }
          : it.data;
      const queueItem: VpsPendingQueueItem = {
        id: it.id,
        collectionName: it.collectionName,
        action: act,
        data: act === 'upsert' ? stampedData : undefined,
        timestamp: now,
      };

      this.queue = this.queue.filter((q) => !(q.collectionName === it.collectionName && q.id === it.id));
      this.queue.push(queueItem);
      timestampWorker.updateLocalTimestamp(it.collectionName, now);

      try {
        this.broadcastChannel?.postMessage({
          type: 'tab_mutation',
          collection: it.collectionName,
          item: stampedData,
          action: act,
          itemId: it.id,
        });
      } catch {
        // ignore
      }
    }

    this.saveQueue();
    this.notifyState({ pendingQueueCount: this.queue.length });
    this.processOfflineQueue();
  }

  /**
   * Sends a critical item directly to server and awaits confirmation.
   * Used for money-moving or ownership-changing operations where 
   * split-brain is unacceptable.
   * 
   * @returns { success: true } only if server confirmed persistence.
   */
  public async syncCriticalItem(
    collection: string,
    id: string,
    data: any
  ): Promise<{ success: boolean; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, error: 'لا يوجد اتصال بالإنترنت' };
    }

    const baseUrl = this.getBaseUrl();
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 25000);

    try {
      const res = await fetch(`${baseUrl}/api/sync/item`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          collection,
          item: { ...data, updatedAt: new Date().toISOString() },
          action: 'upsert',
          itemId: id,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        return {
          success: false,
          error: `HTTP ${res.status}: ${errorBody.slice(0, 100)}`,
        };
      }

      const json = await res.json();
      if (json.success === false) {
        return {
          success: false,
          error: json.error || 'رفض السيرفر الحفظ',
        };
      }

      // Remove synced item from queue
      this.queue = this.queue.filter(
        (q) => !(q.collectionName === collection && q.id === id)
      );
      this.saveQueue();
      this.notifyState({ pendingQueueCount: this.queue.length });

      return { success: true };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: err?.message || 'فشل الاتصال بالسيرفر',
      };
    }
  }

  /**
   * Sends multiple critical items in one atomic batch and awaits 
   * confirmation.
   */
  public async syncCriticalBatch(
    items: Array<{
      collection: string;
      id: string;
      data: any;
      action?: 'upsert' | 'delete';
    }>
  ): Promise<{ success: boolean; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, error: 'لا يوجد اتصال بالإنترنت' };
    }
    if (items.length === 0) return { success: true };

    const baseUrl = this.getBaseUrl();
    const ctrl = new AbortController();
    // Dynamic timeout: 30s base + 500ms per item (max 90s)
    const dynamicTimeout = Math.min(30000 + items.length * 500, 90000);
    const timeoutId = setTimeout(() => ctrl.abort(), dynamicTimeout);

    try {
      const res = await fetch(`${baseUrl}/api/sync/batch`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          queue: items.map((it) => ({
            collection: it.collection,
            item: { ...it.data, updatedAt: new Date().toISOString() },
            action: it.action || 'upsert',
            itemId: it.id,
          })),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      const json = await res.json();
      if (json.success === false) {
        return {
          success: false,
          error: json.error || 'فشل الحفظ الذري',
        };
      }

      const syncedKeys = new Set(
        items.map((it) => `${it.collection}:${it.id}`)
      );
      this.queue = this.queue.filter(
        (q) => !syncedKeys.has(`${q.collectionName}:${q.id}`)
      );
      this.saveQueue();
      this.notifyState({ pendingQueueCount: this.queue.length });

      return { success: true };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: err?.message || 'فشل الاتصال',
      };
    }
  }

  /**
   * Awaits the full drain of the current queue.
   * Useful before critical operations that must be ordered.
   */
  public async flushQueue(maxWaitMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    while (this.queue.length > 0 || this.isProcessingQueue) {
      if (Date.now() - startTime > maxWaitMs) {
        console.warn('[flushQueue] Timeout — queue still has items');
        return false;
      }
      if (!this.isProcessingQueue && this.queue.length > 0) {
        await this.processOfflineQueue();
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return true;
  }

  /**
   * Manual reconnect & state recovery requested by the user.
   * Retains pending local queue items and safely attempts queue drain and data sync.
   */
  public async retryManualConnection(): Promise<{ success: boolean; message: string }> {
    this.state.retryCount = 0;
    this.state.isConnectionFrozen = false;

    this.notifyState({
      status: 'syncing',
      isConnectionFrozen: false,
      errorMessage: undefined,
    });

    await this.processOfflineQueue();
    const res = await this.pullFullDatabaseFromCloud();

    if (res.success) {
      this.notifyState({
        status: 'connected',
        isConnectionFrozen: false,
        errorMessage: undefined,
      });
      this.connectServerEvents();
      return { success: true, message: 'تم إعادة الاتصال بالسيرفر بنجاح' };
    } else {
      this.notifyState({
        status: 'error',
        isConnectionFrozen: false,
        errorMessage: res.message || 'فشل الاتصال بالسيرفر',
      });
      return { success: false, message: res.message || 'فشل الاتصال' };
    }
  }

  public unfreezeConnectionForced() {
    this.state.isConnectionFrozen = false;
    this.notifyState({
      isConnectionFrozen: false,
      status: 'idle',
      errorMessage: undefined,
      pendingQueueCount: this.queue.length,
    });
  }

  private loadQueue() {
    try {
      const raw = safeStorage.getItem(VPS_QUEUE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
        this.notifyState({ pendingQueueCount: this.queue.length });
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      const queueData = JSON.stringify(this.queue);
      if (queueData.length > 500_000) { // 500KB limit
        console.warn('[VpsSyncEngine] Queue too large, trimming to last 500 items');
        this.queue = this.queue.slice(-500);
      }
      safeStorage.setItem(VPS_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.error('[VpsSyncEngine] Failed to save queue:', err);
      // Keep going in RAM
    }
  }

  public getTombstones(_collectionName: string): Set<string> {
    return new Set();
  }

  public getServerUsers(): any[] {
    return this.serverUsersCache || [];
  }

  public getServerBranches(): any[] {
    return this.serverBranchesCache || [];
  }

  /**
   * Check if an entity has a pending local mutation waiting to be synced to the server.
   * Prevents stale remote polls from rolling back local changes currently in-flight.
   */
  public isItemPending(collectionName: string, id: string): boolean {
    if (!id) return false;
    const cleanId = id.trim().toUpperCase();
    return this.queue.some(
      (q) =>
        q.collectionName === collectionName &&
        (q.id === id ||
          q.id.trim().toUpperCase() === cleanId ||
          (q.data &&
            (q.data.id === id ||
              q.data.manifestNumber === id ||
              (q.data.manifestNumber && q.data.manifestNumber.trim().toUpperCase() === cleanId) ||
              (q.data.trackingNumber && q.data.trackingNumber.trim().toUpperCase() === cleanId))))
    );
  }

  /**
   * Smart version of isItemPending: instead of blindly blocking, 
   * it compares precedence ranks and timestamps.
   * 
   * Returns:
   *   - true  → block the incoming update (local pending wins)
   *   - false → allow the incoming update (server is more advanced)
   */
  public isItemPendingStrict(
    collectionName: string,
    incomingItem: any
  ): boolean {
    if (!incomingItem || !incomingItem.id) return false;

    const cleanId = String(incomingItem.id).trim().toUpperCase();
    const cleanTracking = incomingItem.trackingNumber ? String(incomingItem.trackingNumber).trim().toUpperCase() : '';
    const cleanManifest = incomingItem.manifestNumber ? String(incomingItem.manifestNumber).trim().toUpperCase() : '';

    const queuedItem = this.queue.find(
      (q) =>
        q.collectionName === collectionName &&
        (q.id === incomingItem.id ||
          q.id.trim().toUpperCase() === cleanId ||
          (q.data?.id && (q.data.id === incomingItem.id || String(q.data.id).trim().toUpperCase() === cleanId)) ||
          (cleanTracking && q.data?.trackingNumber && String(q.data.trackingNumber).trim().toUpperCase() === cleanTracking) ||
          (cleanManifest && q.data?.manifestNumber && String(q.data.manifestNumber).trim().toUpperCase() === cleanManifest))
    );

    if (!queuedItem) return false; // لا يوجد pending

    // ✅ الحالة 2: delete action → احجب دائماً
    if (queuedItem.action === 'delete') {
      return true;
    }

    // ✅ الحالة 1: parcels → قارن rank
    if (collectionName === 'parcels') {
      const queuedRank = getHandlingStatusRank(
        queuedItem.data?.handlingStatus
      );
      const incomingRank = getHandlingStatusRank(
        incomingItem.handlingStatus
      );

      if (incomingRank > queuedRank) return false;
      if (incomingRank < queuedRank) return true;

      const queuedTime = queuedItem.data?.updatedAt
        ? new Date(queuedItem.data.updatedAt).getTime()
        : 0;
      const incomingTime = incomingItem.updatedAt
        ? new Date(incomingItem.updatedAt).getTime()
        : 0;

      return incomingTime <= queuedTime;
    }

    // ✅ الحالة 1b: truckManifests → قارن MANIFEST_PROGRESSION
    if (collectionName === 'truckManifests') {
      const queuedRank = MANIFEST_PROGRESSION[queuedItem.data?.status] || 0;
      const incomingRank = MANIFEST_PROGRESSION[incomingItem.status] || 0;

      if (incomingRank > queuedRank) return false;
      if (incomingRank < queuedRank) return true;

      const queuedTime = queuedItem.data?.updatedAt
        ? new Date(queuedItem.data.updatedAt).getTime()
        : 0;
      const incomingTime = incomingItem.updatedAt
        ? new Date(incomingItem.updatedAt).getTime()
        : 0;

      return incomingTime <= queuedTime;
    }

    // ✅ الحالة 4: باقي collections → updatedAt فقط
    const queuedTime = queuedItem.data?.updatedAt
      ? new Date(queuedItem.data.updatedAt).getTime()
      : 0;
    const incomingTime = incomingItem.updatedAt
      ? new Date(incomingItem.updatedAt).getTime()
      : 0;

    return incomingTime <= queuedTime;
  }

  public getPendingIds(collectionName: string): Set<string> {
    const ids = new Set<string>();
    for (const q of this.queue) {
      if (q.collectionName === collectionName) {
        if (q.id) ids.add(q.id);
        if (q.data?.id) ids.add(q.data.id);
        if (q.data?.manifestNumber) ids.add(q.data.manifestNumber);
        if (q.data?.trackingNumber) ids.add(q.data.trackingNumber);
      }
    }
    return ids;
  }

  // --- Operational Mutation Handlers ---
  public syncParcel(parcel: Parcel) {
    // Canonical queue key is parcel.id with trackingNumber preserved
    const key = parcel.id || parcel.trackingNumber;
    const stamped = { ...parcel, updatedAt: parcel.updatedAt || new Date().toISOString() };
    this.queueMutation('parcels', key, stamped, 'upsert');
  }

  public deleteParcel(trackingNumber: string) {
    this.queueMutation('parcels', trackingNumber, null, 'delete');
  }

  public syncTruckManifest(manifest: TruckManifest) {
    const stamped = { ...manifest, updatedAt: manifest.updatedAt || new Date().toISOString() };
    const key = manifest.id || manifest.manifestNumber;
    this.queueMutation('truckManifests', key, stamped, 'upsert');
  }

  public deleteTruckManifest(manifestIdOrNumber: string) {
    this.queueMutation('truckManifests', manifestIdOrNumber, null, 'delete');
  }

  public syncCourierManifest(manifest: CourierManifest) {
    const stamped = { ...manifest, updatedAt: manifest.updatedAt || new Date().toISOString() };
    this.queueMutation('courierManifests', manifest.manifestNumber, stamped, 'upsert');
  }

  public deleteCourierManifest(manifestNumber: string) {
    this.queueMutation('courierManifests', manifestNumber, null, 'delete');
  }

  public syncBranch(branch: Branch) {
    this.queueMutation('branches', branch.id, branch, 'upsert');
  }

  public deleteBranch(branchId: string) {
    this.queueMutation('branches', branchId, null, 'delete');
  }

  public syncUser(user: User) {
    this.queueMutation('users', user.id, user, 'upsert');
  }

  public deleteUser(userId: string) {
    this.queueMutation('users', userId, null, 'delete');
  }

  public syncCustomer(customer: Customer) {
    this.queueMutation('customers', customer.id, customer, 'upsert');
  }

  public deleteCustomer(customerId: string) {
    this.queueMutation('customers', customerId, null, 'delete');
  }

  public syncPricingRule(rule: PricingRule) {
    this.queueMutation('pricingRules', rule.id, rule, 'upsert');
  }

  public deletePricingRule(ruleId: string) {
    this.queueMutation('pricingRules', ruleId, null, 'delete');
  }

  public syncVoucher(voucher: FinancialVoucher) {
    this.queueMutation('vouchers', voucher.id, voucher, 'upsert');
  }

  public deleteVoucher(voucherId: string) {
    this.queueMutation('vouchers', voucherId, null, 'delete');
  }

  public syncExpense(expense: Expense) {
    this.queueMutation('expenses', expense.id, expense, 'upsert');
  }

  public deleteExpense(expenseId: string) {
    this.queueMutation('expenses', expenseId, null, 'delete');
  }

  public syncExpenseCategory(cat: ExpenseCategoryItem) {
    this.queueMutation('expenseCategories', cat.id, cat, 'upsert');
  }

  public deleteExpenseCategory(catId: string) {
    this.queueMutation('expenseCategories', catId, null, 'delete');
  }

  public syncVehicle(vehicle: Vehicle) {
    this.queueMutation('vehicles', vehicle.id, vehicle, 'upsert');
  }

  public deleteVehicle(vehicleId: string) {
    this.queueMutation('vehicles', vehicleId, null, 'delete');
  }

  public syncEmployee(emp: Employee) {
    this.queueMutation('employees', emp.id, emp, 'upsert');
  }

  public deleteEmployee(empId: string) {
    this.queueMutation('employees', empId, null, 'delete');
  }

  public syncPayrollRecord(payroll: PayrollRecord) {
    this.queueMutation('payrollRecords', payroll.id, payroll, 'upsert');
  }

  public deletePayrollRecord(payrollId: string) {
    this.queueMutation('payrollRecords', payrollId, null, 'delete');
  }

  public syncFixedAsset(asset: FixedAsset) {
    this.queueMutation('fixedAssets', asset.id, asset, 'upsert');
  }

  public deleteFixedAsset(assetId: string) {
    this.queueMutation('fixedAssets', assetId, null, 'delete');
  }

  public syncDirectMessage(msg: DirectMessage) {
    this.queueMutation('directMessages', msg.id, msg, 'upsert');
  }

  public deleteDirectMessage(msgId: string) {
    this.queueMutation('directMessages', msgId, null, 'delete');
  }

  public syncTransaction(tx: CashboxTransaction) {
    this.queueMutation('transactions', tx.id, tx, 'upsert');
  }

  public deleteTransaction(txId: string) {
    this.queueMutation('transactions', txId, null, 'delete');
  }

  public syncShiftVoucher(v: ShiftSettlementVoucher) {
    this.queueMutation('shiftSettlementVouchers', v.id, v, 'upsert');
  }

  public deleteShiftVoucher(voucherId: string) {
    this.queueMutation('shiftSettlementVouchers', voucherId, null, 'delete');
  }

  public syncCourierIntakeSettlement(voucher: CourierIntakeSettlementVoucher) {
    const stamped = { ...voucher, updatedAt: (voucher as any).updatedAt || voucher.timestamp || new Date().toISOString() };
    this.queueMutation('courierIntakeSettlements', voucher.id, stamped, 'upsert');
  }

  public deleteCourierIntakeSettlement(voucherId: string) {
    this.queueMutation('courierIntakeSettlements', voucherId, null, 'delete');
  }

  public syncSettlement(s: DailySettlement) {
    this.queueMutation('settlements', s.id, s, 'upsert');
  }

  public syncBranding(b: CompanyBrandingSettings) {
    const stamped = { ...b, updatedAt: b.updatedAt || new Date().toISOString() };
    this.queueMutation('brandingSettings', 'company_branding', stamped, 'upsert');
  }

  public syncCodSettings(s: CodTransferSettings) {
    const stamped = { ...s, updatedAt: s.updatedAt || new Date().toISOString() };
    this.queueMutation('codSettings', 'system_cod_settings', stamped, 'upsert');
  }

  public syncNotification(n: SystemNotification) {
    const stamped = { ...n, updatedAt: (n as any).updatedAt || n.timestamp || new Date().toISOString() };
    this.queueMutation('notifications', n.id, stamped, 'upsert');
  }

  public syncAuditLog(log: AuditLogEntry) {
    const stamped = { ...log, updatedAt: (log as any).updatedAt || log.timestamp || new Date().toISOString() };
    this.queueMutation('auditLogs', log.id, stamped, 'upsert');
  }

  public syncObligation(obl: InterBranchObligation) {
    const stamped = { ...obl, updatedAt: obl.updatedAt || new Date().toISOString() };
    this.queueMutation('interBranchObligations', obl.id, stamped, 'upsert');
  }

  public deleteObligation(oblId: string) {
    this.queueMutation('interBranchObligations', oblId, null, 'delete');
  }

  public syncParcelEvent(event: ParcelEvent) {
    this.queueMutation('parcelEvents', event.id, event, 'upsert');
  }

  public deleteParcelEvent(eventId: string) {
    this.queueMutation('parcelEvents', eventId, null, 'delete');
  }
}

export const vpsSyncEngine = new UniversalVpsSyncEngine();

if (typeof window !== 'undefined') {
  (window as any).__orcaSyncEngine = vpsSyncEngine;
}
