import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { useOrca } from '../context/OrcaContext';
import {
  auditParcelIntegrity,
  autoReconcileParcels,
  STATUS_ARABIC_LABELS,
  ParcelIntegrityReport,
} from '../utils/parcelLifecycleValidator';
import { fetchPostgresStatus } from '../services/vpsClient';
import { vpsSyncEngine } from '../services/vpsSyncEngine';
import { safeStorage } from '../utils/storage';
import {
  Activity,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle,
  Package,
  DollarSign,
  Zap,
  Wrench,
  Server,
  Database,
  Wifi,
  HardDrive,
  Clock,
  Layers,
  FileSpreadsheet,
  Download,
  Trash2,
  Play,
  ShieldCheck,
  Building,
  ArrowRightLeft,
  AlertCircle,
  FileText,
  Sliders,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { HandlingStatus, Parcel } from '../types';

interface SyncAuditFullScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'parcels' | 'financial' | 'sync' | 'tools';

export const SyncAuditFullScreen: React.FC<SyncAuditFullScreenProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    parcels,
    branches,
    branchesWithDerivedBalances,
    truckManifests,
    transactions,
    vouchers,
    interBranchObligations,
    cloudSyncState,
    triggerManualCloudSync,
    formatCurrency,
    formatNumber,
    estimateLocalStorageSize,
    cleanupOldLocalData,
  } = useOrca();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toISOString());

  // PostgreSQL Status State
  const [pgStatus, setPgStatus] = useState<{ connected: boolean; pingMs: number; database?: string } | null>(null);
  const [isPingingPg, setIsPingingPg] = useState(false);

  // Storage estimation
  const [storageEstimate, setStorageEstimate] = useState<{ totalBytes: number; byKey: Record<string, number> }>({
    totalBytes: 0,
    byKey: {},
  });

  // Parcels Audit Report
  const [integrityReport, setIntegrityReport] = useState<ParcelIntegrityReport | null>(null);
  const [parcelSearchTerm, setParcelSearchTerm] = useState('');
  const [parcelStatusFilter, setParcelStatusFilter] = useState<string>('all');

  // Financial Filter
  const [txSearchTerm, setTxSearchTerm] = useState('');

  // Queue state for Tab 4
  const [rawQueue, setRawQueue] = useState<any[]>([]);

  // Migration v2 Dry Run Results
  const [migrationDryResult, setMigrationDryResult] = useState<any | null>(null);
  const [isCheckingMigration, setIsCheckingMigration] = useState(false);

  // Auto-reconcile logs
  const [reconcileLogs, setReconcileLogs] = useState<string[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);

  // Server-Authoritative API v2 Testing States
  const [apiV2Enabled, setApiV2Enabled] = useState(false);

  const branchesV2 = useQuery({
    queryKey: ['audit-fullscreen-branches-v2'],
    queryFn: () => apiClient.getBranches(),
    enabled: apiV2Enabled,
  });

  const usersV2 = useQuery({
    queryKey: ['audit-fullscreen-users-v2'],
    queryFn: () => apiClient.getUsers(),
    enabled: apiV2Enabled,
  });

  const parcelsV2 = useQuery({
    queryKey: ['audit-fullscreen-parcels-v2'],
    queryFn: () => apiClient.getParcels({ limit: 10 }),
    enabled: apiV2Enabled,
  });

  // Self-Healing History State
  const [healingHistory, setHealingHistory] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('orca_healing_history') || '[]');
    } catch {
      return [];
    }
  });

  const refreshHealingHistory = useCallback(() => {
    try {
      setHealingHistory(JSON.parse(localStorage.getItem('orca_healing_history') || '[]'));
    } catch {
      setHealingHistory([]);
    }
  }, []);

  // Show Toast Helper
  const showToast = useCallback((text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Ping Postgres
  const refreshPostgresStatus = useCallback(async () => {
    setIsPingingPg(true);
    try {
      const res = await fetchPostgresStatus();
      if (res?.success && res.postgres) {
        setPgStatus(res.postgres);
      } else {
        setPgStatus({ connected: false, pingMs: 0 });
      }
    } catch {
      setPgStatus({ connected: false, pingMs: 0 });
    } finally {
      setIsPingingPg(false);
    }
  }, []);

  // Read Storage & Queue
  const refreshStorageAndQueue = useCallback(() => {
    try {
      const est = estimateLocalStorageSize();
      setStorageEstimate(est);
    } catch {
      // ignore
    }

    try {
      const raw = safeStorage.getItem('orca_vps_sync_queue');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRawQueue(parsed);
          return;
        }
      }
      setRawQueue([]);
    } catch {
      setRawQueue([]);
    }
  }, [estimateLocalStorageSize]);

  // Run Parcels Integrity Audit
  const refreshParcelsAudit = useCallback(() => {
    try {
      const rep = auditParcelIntegrity(parcels, branches, truckManifests);
      setIntegrityReport(rep);
    } catch (e) {
      console.error('Audit parcel integrity error:', e);
    }
  }, [parcels, branches, truckManifests]);

  // Master Refresh
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshPostgresStatus(),
        triggerManualCloudSync(),
      ]);
      refreshStorageAndQueue();
      refreshParcelsAudit();
      refreshHealingHistory();
      setLastRefreshedAt(new Date().toISOString());
      showToast('تم تحديث كافة المؤشرات والبيانات بنجاح', 'success');
    } catch (err: any) {
      showToast(err?.message || 'فشل التحديث الشامل', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshPostgresStatus, triggerManualCloudSync, refreshStorageAndQueue, refreshParcelsAudit, refreshHealingHistory, showToast]);

  // Initial load and periodic tick
  useEffect(() => {
    if (isOpen) {
      handleRefreshAll();
      const interval = setInterval(() => {
        refreshStorageAndQueue();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, handleRefreshAll, refreshStorageAndQueue]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate Critical Alerts
  const alerts = useMemo(() => {
    const list: Array<{ id: string; title: string; description: string; severity: 'critical' | 'warning' }> = [];

    // 1. Queue alert
    const qCount = cloudSyncState.pendingQueueCount ?? rawQueue.length;
    if (qCount >= 10) {
      list.push({
        id: 'queue_high',
        title: `عمليات معلقة كثيرة في طابور المزامنة (${qCount} عملية)`,
        description: 'يوجد عدد كبير من السجلات بانتظار الإرسال إلى السيرفر، يرجى التحقق من استقرار الاتصال بالإنترنت.',
        severity: 'critical',
      });
    }

    // 2. Storage alert
    const mbUsed = storageEstimate.totalBytes / (1024 * 1024);
    if (mbUsed >= 4.0) {
      list.push({
        id: 'storage_high',
        title: `مساحة التخزين المحلي قاربت الامتلاء (${mbUsed.toFixed(2)} MB / 5 MB)`,
        description: 'التخزين المحلي بالمتصفح أوشك على بلوغ الحد الأقصى. استخدم أداة "تنظيف الذاكرة المؤقتة" لتفريغ المساحة.',
        severity: 'critical',
      });
    }

    // 3. PostgreSQL connection
    const pgIsConnected = pgStatus ? pgStatus.connected : cloudSyncState.postgresConnected;
    if (pgIsConnected === false) {
      list.push({
        id: 'pg_disconnected',
        title: 'قاعدة بيانات PostgreSQL المركزية غير متصلة',
        description: 'السيرفر يعمل في وضع الملفات المؤقتة Fallback ولا يتم ترحيل الحركات إلى قاعدة البيانات المعتمدة.',
        severity: 'critical',
      });
    }

    // 4. Last sync aging > 5 minutes
    if (cloudSyncState.lastSyncTimestamp) {
      const diffMs = Date.now() - new Date(cloudSyncState.lastSyncTimestamp).getTime();
      if (diffMs > 5 * 60 * 1000) {
        list.push({
          id: 'sync_stale',
          title: 'لم تُنجز مزامنة سحابية منذ أكثر من 5 دقائق',
          description: 'آخر اتصال ناجح بالسيرفر كان قديماً، قد تحتاج للضغط على "تحديث كامل" لإعادة المزامنة.',
          severity: 'warning',
        });
      }
    }

    // 5. SSE Real-time alert
    if (cloudSyncState.realtimeActive === false) {
      list.push({
        id: 'sse_inactive',
        title: 'الاتصال اللحظي (SSE) معطل',
        description: 'التحديثات الفورية بين الفروع تعمل عبر الاستطلاع الدوري الخفيف بدلاً من البث المباشر.',
        severity: 'warning',
      });
    }

    // 6. Parcels anomalies
    if (integrityReport && integrityReport.criticalCount > 0) {
      list.push({
        id: 'parcels_critical',
        title: `تم رصد (${integrityReport.criticalCount}) شذوذ حرج في دورة حياة الطرود`,
        description: 'يوجد طرود معلقة أو بحالات غير متسقة، يرجى مراجعة تبويب "الطرود" لتنفيذ الإصلاح الذاتي.',
        severity: 'critical',
      });
    }

    return list;
  }, [cloudSyncState, rawQueue.length, storageEstimate.totalBytes, pgStatus, integrityReport]);

  // Filtered Parcels for Tab 2
  const filteredParcels = useMemo(() => {
    let list = [...parcels];
    if (parcelStatusFilter !== 'all') {
      list = list.filter((p) => p.handlingStatus === parcelStatusFilter);
    }
    if (parcelSearchTerm.trim()) {
      const term = parcelSearchTerm.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.trackingNumber.toLowerCase().includes(term) ||
          p.receiver?.name.toLowerCase().includes(term) ||
          p.sender?.name.toLowerCase().includes(term)
      );
    }
    // Return last 20
    return list.slice(0, 20);
  }, [parcels, parcelStatusFilter, parcelSearchTerm]);

  // Financial calculations for Tab 3
  const financialTotals = useMemo(() => {
    const totalTransactions = transactions.length;
    const totalVouchers = vouchers?.length || 0;
    const pendingObligations = (interBranchObligations || []).filter(
      (o) => o.clearingStatus === 'pending' || o.senderPayoutStatus === 'pending'
    ).length;
    
    // Total derived balances
    let totalBalancesSyp = 0;
    let totalBalancesUsd = 0;
    (branchesWithDerivedBalances || []).forEach((b) => {
      totalBalancesSyp += b.boxSypBalance || 0;
      totalBalancesUsd += b.boxUsdBalance || 0;
    });

    // Zero or negative amounts
    const zeroOrNegativeTxs = transactions.filter((t) => (t.amount || 0) <= 0).length;
    const missingBranchTxs = transactions.filter((t) => !t.branchId).length;

    // Aging obligations > 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const agingObligations = (interBranchObligations || []).filter(
      (o) =>
        (o.clearingStatus === 'pending' || o.senderPayoutStatus === 'pending') &&
        new Date(o.createdAt).getTime() < thirtyDaysAgo
    ).length;

    return {
      totalTransactions,
      totalVouchers,
      pendingObligations,
      totalBalancesSyp,
      totalBalancesUsd,
      zeroOrNegativeTxs,
      missingBranchTxs,
      agingObligations,
    };
  }, [transactions, vouchers, interBranchObligations, branchesWithDerivedBalances]);

  // Last 20 Transactions for Tab 3
  const recentTransactions = useMemo(() => {
    let list = [...transactions];
    if (txSearchTerm.trim()) {
      const term = txSearchTerm.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.description || '').toLowerCase().includes(term) ||
          (t.referenceId || '').toLowerCase().includes(term)
      );
    }
    return list.slice(-20).reverse();
  }, [transactions, txSearchTerm]);

  if (!isOpen || currentUser?.role !== 'super_admin') {
    return null;
  }

  // Tools: Force Pull
  const handleForcePull = async () => {
    setIsRefreshing(true);
    try {
      const res = await vpsSyncEngine.pullFullDatabaseFromCloud();
      if (res.success) {
        showToast('تم سحب كامل قاعدة البيانات من السيرفر بنجاح', 'success');
        refreshParcelsAudit();
      } else {
        showToast(res.message || 'فشل السحب من السيرفر', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'خطأ أثناء السحب', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Tools: Force Push
  const handleForcePush = () => {
    try {
      const res = vpsSyncEngine.forcePushLocalDatabase();
      showToast(`تمت جدولة دفع ${res.queued} سجلاً محلياً من ${res.collections} مجموعات للسيرفر`, 'success');
      refreshStorageAndQueue();
    } catch (e: any) {
      showToast(e?.message || 'خطأ أثناء الدفع', 'error');
    }
  };

  // Tools: Local Storage Cleanup
  const handleCleanupLocalStorage = () => {
    try {
      cleanupOldLocalData();
      refreshStorageAndQueue();
      showToast('تم تنظيف السجلات المؤقتة وتفريغ الذاكرة المحلية بنجاح', 'success');
    } catch (e: any) {
      showToast(e?.message || 'خطأ أثناء التنظيف', 'error');
    }
  };

  // Tools: Clear Queue
  const handleClearQueueSafely = () => {
    const ok = window.confirm(
      'تحذير: هل أنت متأكد من رغبتك في تفريغ طابور المزامنة المحلي؟ العمليات المعلقة غير المتزامنة سيتم حذفها.'
    );
    if (!ok) return;

    try {
      safeStorage.setItem('orca_vps_sync_queue', JSON.stringify([]));
      setRawQueue([]);
      showToast('تم تفريغ طابور المزامنة بنجاح', 'warning');
    } catch (e: any) {
      showToast(e?.message || 'فشل تفريغ الطابور', 'error');
    }
  };

  // Tools: Check Migration v2 Dry Run
  const handleCheckMigrationV2 = async () => {
    setIsCheckingMigration(true);
    try {
      const res = await fetch('/api/db/migrate-to-app-tables?dry=1', { method: 'POST' });
      const json = await res.json();
      setMigrationDryResult(json);
      showToast('تم فحص ترحيل الجداول بنجاح', 'success');
    } catch (e: any) {
      showToast(e?.message || 'فشل فحص الترحيل', 'error');
    } finally {
      setIsCheckingMigration(false);
    }
  };

  // Tools: Export JSON Report
  const handleExportJsonReport = () => {
    try {
      const reportData = {
        exportDate: new Date().toISOString(),
        cloudSyncState,
        postgresStatus: pgStatus,
        storageEstimation: storageEstimate,
        financialTotals,
        parcelsCount: parcels.length,
        parcelsIntegrityReport: integrityReport,
        activeAlerts: alerts,
        branchesCount: branches.length,
        truckManifestsCount: truckManifests.length,
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orca-system-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('تم تصدير التقرير الفني الشامل بنجاح', 'success');
    } catch (e: any) {
      showToast(e?.message || 'فشل تصدير التقرير', 'error');
    }
  };

  // Tools: Auto Reconcile Parcels
  const handleAutoReconcile = () => {
    setIsReconciling(true);
    try {
      const result = autoReconcileParcels(parcels);
      setReconcileLogs(result.logs);
      if (result.fixedCount > 0) {
        showToast(`تمت معالجة وإصلاح ${result.fixedCount} طرداً شاذة بنجاح`, 'success');
        refreshParcelsAudit();
      } else {
        showToast('لم يتم رصد أي شذوذ يتطلب إصلاحاً ذاتياً', 'success');
      }
    } catch (e: any) {
      showToast(e?.message || 'فشل تنفيذ الإصلاح الذاتي', 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950 w-screen h-screen h-[100dvh] flex flex-col overflow-hidden text-slate-100"
      dir="rtl"
    >
      {/* ========================================================================= */}
      {/* 1. HEADER (العنوان، مؤشر الوقت، زر التحديث، زر الإغلاق) */}
      {/* ========================================================================= */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>مركز تدقيق المزامنة وجودة الطرود</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                Full-Screen Workstation
              </span>
            </h1>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>آخر تحديث: {new Date(lastRefreshedAt).toLocaleTimeString('ar-SY')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700 disabled:opacity-50"
            title="تحديث كافة الفحوصات والمؤشرات فورياً"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">تحديث شامل</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 flex items-center justify-center transition cursor-pointer"
            title="إغلاق المركز (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`px-4 py-2 text-xs font-bold flex items-center justify-between border-b transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
              : toastMessage.type === 'warning'
              ? 'bg-amber-950 text-amber-200 border-amber-800'
              : 'bg-rose-950 text-rose-200 border-rose-800'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TABS NAVIGATION (5 تبويبات واضحة مع شارات التنبيه) */}
      {/* ========================================================================= */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-4 sm:px-6 shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'النظرة العامة', icon: Activity, badge: alerts.length > 0 ? alerts.length : null },
          { id: 'parcels', label: 'تدقيق الطرود', icon: Package, badge: integrityReport && integrityReport.anomaliesCount > 0 ? integrityReport.anomaliesCount : null },
          { id: 'financial', label: 'التدقيق المالي', icon: DollarSign, badge: financialTotals.pendingObligations > 0 ? financialTotals.pendingObligations : null },
          { id: 'sync', label: 'المزامنة السحابية', icon: Zap, badge: (cloudSyncState.pendingQueueCount ?? rawQueue.length) > 0 ? (cloudSyncState.pendingQueueCount ?? rawQueue.length) : null },
          { id: 'tools', label: 'أدوات التشغيل', icon: Wrench, badge: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-3 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== null && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT (محتوى التبويبات الخمسة) */}
      {/* ========================================================================= */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950">
        
        {/* ===================================================================== */}
        {/* TAB 1: OVERVIEW (النظرة العامة) */}
        {/* ===================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4 KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* 1. Sync Status Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">حالة المزامنة السحابية</span>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      cloudSyncState.status === 'connected'
                        ? 'bg-emerald-500 animate-pulse'
                        : cloudSyncState.status === 'syncing'
                        ? 'bg-amber-500 animate-spin'
                        : 'bg-rose-500'
                    }`}
                  />
                </div>
                <div className="my-2">
                  <div className="text-xl font-black text-white flex items-center gap-2">
                    {cloudSyncState.status === 'connected' ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        متصل بالكامل
                      </span>
                    ) : cloudSyncState.status === 'syncing' ? (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                        جارٍ المزامنة...
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                        منقطع / دون اتصال
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-1">
                    {cloudSyncState.lastSyncTimestamp
                      ? `آخر مزامنة: ${new Date(cloudSyncState.lastSyncTimestamp).toLocaleTimeString('ar-SY')}`
                      : 'لم تتم المزامنة بعد'}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span>البث اللحظي (SSE):</span>
                  <strong className={cloudSyncState.realtimeActive ? 'text-emerald-400' : 'text-slate-400'}>
                    {cloudSyncState.realtimeActive ? 'نشط (<300ms)' : 'معطل'}
                  </strong>
                </div>
              </div>

              {/* 2. Queue Count Card */}
              {(() => {
                const q = cloudSyncState.pendingQueueCount ?? rawQueue.length;
                const isGreen = q === 0;
                const isYellow = q > 0 && q < 10;
                const isRed = q >= 10;
                return (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">طابور العمليات (Queue)</span>
                      <Layers className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="my-2">
                      <div className="text-2xl font-black font-mono">
                        <span
                          className={
                            isGreen ? 'text-emerald-400' : isYellow ? 'text-amber-400' : 'text-rose-400 animate-pulse'
                          }
                        >
                          {q}
                        </span>
                        <span className="text-xs text-slate-400 font-normal mr-2">عملية معلقة</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {isGreen ? 'الطابور فارغ وكافة البيانات مرفوعة' : isYellow ? 'طابور خفيف قيد المعالجة' : 'تراكم في الطابور بحاجة لتدقيق'}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span>إعادة المحاولة:</span>
                      <strong className="text-slate-300 font-mono">{cloudSyncState.retryCount || 0} مرات</strong>
                    </div>
                  </div>
                );
              })()}

              {/* 3. PostgreSQL Database Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">قاعدة بيانات PostgreSQL</span>
                  <Database className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="my-2">
                  <div className="text-xl font-black flex items-center gap-2">
                    {pgStatus?.connected || cloudSyncState.postgresConnected ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        متصلة ونشطة
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <X className="w-5 h-5 text-rose-400" />
                        غير متصلة
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1">
                    <span>زمن الاستجابة:</span>
                    <strong className="text-cyan-300">{pgStatus?.pingMs ? `${pgStatus.pingMs} ms` : 'N/A'}</strong>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span>اسم القاعدة:</span>
                  <strong className="text-slate-400 font-mono truncate max-w-[120px]">
                    {pgStatus?.database || 'orca_db'}
                  </strong>
                </div>
              </div>

              {/* 4. LocalStorage Size Card */}
              {(() => {
                const bytes = storageEstimate.totalBytes;
                const mb = bytes / (1024 * 1024);
                const percent = Math.min(100, Math.round((mb / 5.0) * 100));
                return (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">ذاكرة المتصفح المحلية</span>
                      <HardDrive className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="my-2">
                      <div className="text-xl font-black font-mono text-white flex items-baseline gap-1.5">
                        <span>{mb.toFixed(2)} MB</span>
                        <span className="text-xs text-slate-500">/ 5 MB</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percent > 80 ? 'bg-rose-500' : percent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span>الاستهلاك:</span>
                      <strong className={percent > 80 ? 'text-rose-400' : 'text-slate-300'}>{percent}%</strong>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Self-Healing Card & History */}
            {healingHistory.length > 0 && (
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-emerald-950/30 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>سجل التصحيحات التلقائية (Self-Healing Log)</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/40">
                          {healingHistory.length} عملية تصحيح
                        </span>
                      </h3>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        آخر تصحيح تلقائي: <strong className="text-amber-300 font-mono">{new Date(healingHistory[0].timestamp).toLocaleString('ar-SY')}</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={refreshHealingHistory}
                    className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>تحديث السجل</span>
                  </button>
                </div>

                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px]">
                        <th className="py-2 px-3 font-semibold">التوقيت</th>
                        <th className="py-2 px-3 font-semibold">رقم التتبع</th>
                        <th className="py-2 px-3 font-semibold">نوع العملية</th>
                        <th className="py-2 px-3 font-semibold">السبب والبيان التوضيحي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {healingHistory.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(item.timestamp).toLocaleTimeString('ar-SY')}
                          </td>
                          <td className="py-2 px-3 font-bold text-cyan-300">
                            {item.trackingNumber}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {item.type === 'in_transit_to_received' ? 'تصحيح إلى واصل مستودع' : 'تصحيح إلى نقص معلق'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300 font-sans text-xs">
                            {item.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Critical Alerts Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>لوحة التنبيهات والجاهزية التشغيلية</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {alerts.length} تنبيه
                  </span>
                </h3>
                {alerts.length === 0 && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    كافة الفحوصات والأنظمة سليمة بنسبة 100%
                  </span>
                )}
              </div>

              {alerts.length === 0 ? (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>لا توجد أي تنبيهات حرجة حالياً. محرك المزامنة وقاعدة البيانات والطرود تعمل بتناغم تام.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {alerts.map((al) => (
                    <div
                      key={al.id}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
                        al.severity === 'critical'
                          ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                          : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          al.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <div className="space-y-1">
                        <div className="text-xs font-bold">{al.title}</div>
                        <div className="text-[11px] opacity-80 leading-relaxed">{al.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Summary Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">الطرود المسجلة</div>
                <div className="text-2xl font-black text-cyan-300 font-mono">{parcels.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">موزعة على كافة فروع المنظومة</div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">حركات الصندوق التراكمية</div>
                <div className="text-2xl font-black text-emerald-300 font-mono">{transactions.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">سندات قبض وصرف ومناقلات</div>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1">الفروع والمراكز المعتمدة</div>
                <div className="text-2xl font-black text-amber-300 font-mono">{branches.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">مربوطة بالشبكة السحابية المركزية</div>
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: PARCELS (تدقيق وجودة الطرود) */}
        {/* ===================================================================== */}
        {activeTab === 'parcels' && (
          <div className="space-y-6">
            
            {/* Health Score & Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono text-2xl font-black text-cyan-300">
                  {integrityReport ? `${integrityReport.healthScorePercent}%` : '100%'}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">مؤشر الجودة وسلامة دورة حياة الطرود</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    فحص آلي لـ {parcels.length} طرداً ضد قواعد الاتساق التشغيلي وعدم قفز الحالات.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshParcelsAudit}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة الفحص</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoReconcile}
                  disabled={isReconciling}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isReconciling ? 'جارٍ الإصلاح...' : 'إصلاح ذاتي آلي'}</span>
                </button>
              </div>
            </div>

            {/* Status Breakdown Grid (15 Handling Statuses) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">توزيع الطرود حسب الحالة التشغيلية (Handling Status Breakdown)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {Object.entries(STATUS_ARABIC_LABELS).map(([statusKey, arabicLabel]) => {
                  const count = parcels.filter((p) => p.handlingStatus === statusKey).length;
                  return (
                    <div
                      key={statusKey}
                      onClick={() => setParcelStatusFilter(parcelStatusFilter === statusKey ? 'all' : statusKey)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        parcelStatusFilter === statusKey
                          ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="text-[10px] text-slate-400 truncate">{arabicLabel}</div>
                        <div className="text-[9px] font-mono text-slate-500 truncate">{statusKey}</div>
                      </div>
                      <span className="text-sm font-black font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Parcels Table with Search & Filter */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={parcelSearchTerm}
                    onChange={(e) => setParcelSearchTerm(e.target.value)}
                    placeholder="بحث برقم البوليصة أو اسم المستلم أو المرسل..."
                    className="w-full sm:max-w-md bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  {parcelStatusFilter !== 'all' && (
                    <button
                      onClick={() => setParcelStatusFilter('all')}
                      className="px-2.5 py-1.5 text-xs text-cyan-400 bg-cyan-950/50 border border-cyan-800 rounded-lg whitespace-nowrap cursor-pointer"
                    >
                      إلغاء فلتر الحالة ✕
                    </button>
                  )}
                </div>
                <span className="text-xs text-slate-400">عرض أحدث 20 طرد</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">رقم التتبع</th>
                      <th className="py-2.5 px-3">الحالة التشغيلية</th>
                      <th className="py-2.5 px-3">المرسل ← المستلم</th>
                      <th className="py-2.5 px-3">المبلغ الإجمالي</th>
                      <th className="py-2.5 px-3">آخر تحديث</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredParcels.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                          لا توجد طرود مطابقة لمعايير البحث
                        </td>
                      </tr>
                    ) : (
                      filteredParcels.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-bold text-cyan-300">{p.trackingNumber}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-950 border border-slate-800 text-slate-300">
                              {STATUS_ARABIC_LABELS[p.handlingStatus] || p.handlingStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-300">
                            {p.sender?.name || '—'} ← {p.receiver?.name || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-400 font-bold">
                            {formatCurrency(p.totalDue || 0, p.currency || 'SYP')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {p.updatedAt ? new Date(p.updatedAt).toLocaleTimeString('ar-SY') : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reconcile Logs if any */}
            {reconcileLogs.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  <span>سجل المعالجة والإصلاح الذاتي الأخير</span>
                </h4>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400 max-h-36 overflow-y-auto space-y-1">
                  {reconcileLogs.map((log, idx) => (
                    <div key={idx}>• {log}</div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: FINANCIAL (التدقيق المالي) */}
        {/* ===================================================================== */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            
            {/* 4 Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400">عدد الحركات (Transactions)</span>
                <div className="my-2">
                  <div className="text-2xl font-black font-mono text-cyan-400">{financialTotals.totalTransactions}</div>
                  <div className="text-[11px] text-slate-500">حركات مالية مسجلة بالدفاتر</div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 flex justify-between">
                  <span>حركات بصفر أو سالب:</span>
                  <strong className={financialTotals.zeroOrNegativeTxs > 0 ? 'text-amber-400 font-mono' : 'text-emerald-400 font-mono'}>
                    {financialTotals.zeroOrNegativeTxs}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400">السندات المعتمدة (Vouchers)</span>
                <div className="my-2">
                  <div className="text-2xl font-black font-mono text-emerald-400">{financialTotals.totalVouchers}</div>
                  <div className="text-[11px] text-slate-500">سندات قبض وتسديد موثقة</div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 flex justify-between">
                  <span>حركات دون فرع:</span>
                  <strong className={financialTotals.missingBranchTxs > 0 ? 'text-rose-400 font-mono' : 'text-emerald-400 font-mono'}>
                    {financialTotals.missingBranchTxs}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400">الذمم المعلقة بين الفروع</span>
                <div className="my-2">
                  <div className="text-2xl font-black font-mono text-amber-400">{financialTotals.pendingObligations}</div>
                  <div className="text-[11px] text-slate-500">مطالبات ذمم معلقة للتحويل</div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 flex justify-between">
                  <span>متأخرة لأكثر من 30 يوماً:</span>
                  <strong className={financialTotals.agingObligations > 0 ? 'text-rose-400 font-mono' : 'text-emerald-400 font-mono'}>
                    {financialTotals.agingObligations}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400">إجمالي أرصدة الصناديق</span>
                <div className="my-2">
                  <div className="text-sm font-black font-mono text-emerald-400 truncate">
                    {formatCurrency(financialTotals.totalBalancesSyp, 'SYP')}
                  </div>
                  <div className="text-sm font-black font-mono text-cyan-400 truncate">
                    {formatCurrency(financialTotals.totalBalancesUsd, 'USD')}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5 flex justify-between">
                  <span>عدد الفروع المطابقة:</span>
                  <strong className="text-slate-200 font-mono">{branches.length} فرع</strong>
                </div>
              </div>

            </div>

            {/* Recent Transactions Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <input
                  type="text"
                  value={txSearchTerm}
                  onChange={(e) => setTxSearchTerm(e.target.value)}
                  placeholder="بحث في سجلات الحركات المالية أو رقم البوليصة..."
                  className="w-full sm:max-w-md bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-xs text-slate-400">آخر 20 حركة مسجلة</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">النوع</th>
                      <th className="py-2.5 px-3">البيان والتفاصيل</th>
                      <th className="py-2.5 px-3">المبلغ</th>
                      <th className="py-2.5 px-3">الفرع / الصندوق</th>
                      <th className="py-2.5 px-3">التوقيت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                          لا توجد حركات مالية مسجلة
                        </td>
                      </tr>
                    ) : (
                      recentTransactions.map((tx) => {
                        const isInflow = [
                          'shipping_income_prepaid',
                          'shipping_collected_dest',
                          'cod_collected_dest',
                          'transfer_fee_income',
                          'settlement_received_from_branch',
                          'voucher_receipt',
                          'shift_settlement_received_inflow',
                          'deposit',
                        ].includes(tx.type);
                        return (
                          <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 font-sans">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isInflow
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                                }`}
                              >
                                {isInflow ? 'مقبوضات +' : 'مدفوعات -'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-300 max-w-xs truncate">
                              {tx.description}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white">
                              {formatCurrency(tx.amount || 0, tx.currency || 'SYP')}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">
                              {branches.find((b) => b.id === tx.branchId)?.name || tx.branchId || 'المركز'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                              {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString('ar-SY') : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: SYNC (المزامنة والسيرفر) */}
        {/* ===================================================================== */}
        {activeTab === 'sync' && (
          <div className="space-y-6">
            
            {/* Live Sync Engine State Card (Every 2s) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>حالة محرك المزامنة اللحظي (Live Engine State)</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">تحديث تلقائي كل ثانيتين</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">الحالة العامة</div>
                  <div className="text-sm font-black text-emerald-400 font-mono mt-1">{cloudSyncState.status}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">حجم الطابور</div>
                  <div className="text-sm font-black text-cyan-400 font-mono mt-1">
                    {cloudSyncState.pendingQueueCount ?? rawQueue.length}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">تدفق SSE اللحظي</div>
                  <div className="text-sm font-black text-emerald-400 font-mono mt-1">
                    {cloudSyncState.realtimeActive ? 'نشط' : 'معطل'}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">عداد إعادة المحاولة</div>
                  <div className="text-sm font-black text-slate-300 font-mono mt-1">
                    {cloudSyncState.retryCount || 0}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">تجميد الاتصال</div>
                  <div className="text-sm font-black text-slate-300 font-mono mt-1">
                    {cloudSyncState.isConnectionFrozen ? 'مجمد ❄️' : 'سليم ✅'}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">الفرع المقترن</div>
                  <div className="text-sm font-black text-amber-300 font-mono mt-1 truncate">
                    {cloudSyncState.boundBranchId || 'عام / الكل'}
                  </div>
                </div>
              </div>
            </div>

            {/* Offline Queue Items Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>عناصر طابور المزامنة المعلقة (Queue Inspection)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    العمليات المخزنة محلياً بانتظار التأكيد مع سيرفر VPS ({rawQueue.length} عنصر).
                  </p>
                </div>
                {rawQueue.length > 0 && (
                  <button
                    onClick={handleClearQueueSafely}
                    className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    تفريغ الطابور 🗑️
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">المجموعة (Collection)</th>
                      <th className="py-2.5 px-3">معرف العنصر (ID)</th>
                      <th className="py-2.5 px-3">نوع الإجراء (Action)</th>
                      <th className="py-2.5 px-3">وقت الجدولة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {rawQueue.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-emerald-400 font-sans">
                          ✓ لا توجد أي عناصر معلقة في الطابور — كافة البيانات متزامنة
                        </td>
                      </tr>
                    ) : (
                      rawQueue.slice(0, 20).map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 text-cyan-300 font-bold">{it.collectionName}</td>
                          <td className="py-2.5 px-3 text-slate-300">{it.id}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                it.action === 'delete'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {it.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {it.timestamp ? new Date(it.timestamp).toLocaleTimeString('ar-SY') : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Server-Authoritative API v2 Test Section (Preserved) */}
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>اختبار Server-Authoritative API v2 (المسار المباشر)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    استعلام مباشر من واجهات REST v2 للتحقق من الاتصال المتوازي المستقل.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!apiV2Enabled) {
                      setApiV2Enabled(true);
                    } else {
                      branchesV2.refetch();
                      usersV2.refetch();
                      parcelsV2.refetch();
                    }
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md shadow-cyan-600/30"
                >
                  {apiV2Enabled ? '🔄 إعادة الجلب' : '▶️ تشغيل الاختبار'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Branches */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 mb-1">الفروع (/api/v2/branches)</div>
                  {branchesV2.isLoading ? (
                    <div className="text-xs text-slate-500">جارٍ التحميل...</div>
                  ) : branchesV2.isError ? (
                    <div className="text-xs text-rose-400">خطأ: {String((branchesV2.error as any)?.message || 'فشل')}</div>
                  ) : branchesV2.data?.success ? (
                    <div>
                      <div className="text-xl font-bold text-emerald-400 font-mono">
                        {branchesV2.data.data?.length || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-1">
                        {branchesV2.data.data?.map((b: any) => b.name).join(', ')}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">لم يُشغَّل بعد</div>
                  )}
                </div>

                {/* Users */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 mb-1">المستخدمون (/api/v2/users)</div>
                  {usersV2.isLoading ? (
                    <div className="text-xs text-slate-500">جارٍ التحميل...</div>
                  ) : usersV2.isError ? (
                    <div className="text-xs text-rose-400">خطأ: {String((usersV2.error as any)?.message || 'فشل')}</div>
                  ) : usersV2.data?.success ? (
                    <div>
                      <div className="text-xl font-bold text-cyan-400 font-mono">
                        {usersV2.data.data?.length || 0}
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-1">✓ تأمين الحماية (لا password في الرد)</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">لم يُشغَّل بعد</div>
                  )}
                </div>

                {/* Parcels */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 mb-1">الطرود (/api/v2/parcels)</div>
                  {parcelsV2.isLoading ? (
                    <div className="text-xs text-slate-500">جارٍ التحميل...</div>
                  ) : parcelsV2.isError ? (
                    <div className="text-xs text-rose-400">خطأ: {String((parcelsV2.error as any)?.message || 'فشل')}</div>
                  ) : parcelsV2.data?.success ? (
                    <div>
                      <div className="text-xl font-bold text-amber-400 font-mono">
                        {parcelsV2.data.pagination?.total ?? parcelsV2.data.data?.length ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        صفحة {parcelsV2.data.pagination?.page || 1} من {parcelsV2.data.pagination?.totalPages || 1}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">لم يُشغَّل بعد</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: TOOLS (أدوات التشغيل والصيانة) */}
        {/* ===================================================================== */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  <span>مركز عمليات وصيانة البيانات (Operational Tools)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  أدوات احترافية لإدارة قاعدة البيانات المحلية والسحابية وتصدير التقارير.
                </p>
              </div>

              {/* Tools Action Grid (2 columns on sm+) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* 1. Force Pull */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-cyan-400" />
                      <span>تحديث وسحب كامل (Force Pull)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      سحب أحدث نسخة من قاعدة البيانات السحابية واستبدال الكاش المحلي.
                    </div>
                  </div>
                  <button
                    onClick={handleForcePull}
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition shrink-0"
                  >
                    سحب الآن
                  </button>
                </div>

                {/* 2. Force Push */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>دفع محلي كامل (Force Push)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      إعادة إدراج جميع البيانات المحلية بطابور المزامنة وإرسالها للسيرفر.
                    </div>
                  </div>
                  <button
                    onClick={handleForcePush}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition shrink-0"
                  >
                    دفع الآن
                  </button>
                </div>

                {/* 3. Cleanup localStorage */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-amber-400" />
                      <span>تنظيف الذاكرة المحلية (Cleanup)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      حذف السجلات المؤقتة وتفريغ النسخ الاحتياطية القديمة لتوفير مساحة.
                    </div>
                  </div>
                  <button
                    onClick={handleCleanupLocalStorage}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition shrink-0"
                  >
                    تنظيف
                  </button>
                </div>

                {/* 4. Clear Offline Queue */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>تفريغ الطابور بحذر (Drain Queue)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      مسح طابور العمليات غير المتزامنة في حال وجود تعليق أو تكرار.
                    </div>
                  </div>
                  <button
                    onClick={handleClearQueueSafely}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition shrink-0"
                  >
                    تفريغ
                  </button>
                </div>

                {/* 5. Check Migration v2 */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-cyan-400" />
                      <span>فحص ترحيل الجداول (Migration v2 Dry Run)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      محاكاة ترحيل الجداول العلائقية app_* دون التأثير على البيانات الحية.
                    </div>
                  </div>
                  <button
                    onClick={handleCheckMigrationV2}
                    disabled={isCheckingMigration}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl border border-cyan-800 shadow-md cursor-pointer transition shrink-0 disabled:opacity-50"
                  >
                    {isCheckingMigration ? 'جارٍ الفحص...' : 'فحص تجريبي'}
                  </button>
                </div>

                {/* 6. Export JSON Report */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>تصدير تقرير فني شامل (JSON)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      تنزيل ملف تشخيصي يحتوي على كافة الإحصاءات وحالات الطرود والتنبيهات.
                    </div>
                  </div>
                  <button
                    onClick={handleExportJsonReport}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition shrink-0 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير</span>
                  </button>
                </div>

                {/* 7. Audit Parcels */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      <span>إعادة تدقيق شذوذ الطرود</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      تشغيل الفاحص البرمجي لحالات الطرود ورتب التقدم ومسارات النقل.
                    </div>
                  </div>
                  <button
                    onClick={refreshParcelsAudit}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 shadow-md cursor-pointer transition shrink-0"
                  >
                    تدقيق الآن
                  </button>
                </div>

                {/* 8. Auto Reconcile */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>معالجة وإصلاح ذاتي آلي</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      تصحيح الأخطاء الطفيفة كربط الفروع وحل تضارب الحالات الصادرة تلقائياً.
                    </div>
                  </div>
                  <button
                    onClick={handleAutoReconcile}
                    disabled={isReconciling}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition shrink-0 disabled:opacity-50"
                  >
                    {isReconciling ? 'جارٍ الإصلاح...' : 'إصلاح ذاتي'}
                  </button>
                </div>

              </div>

              {/* Migration Dry Run Result Box */}
              {migrationDryResult && (
                <div className="mt-4 p-4 bg-slate-950 border border-cyan-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-cyan-300">نتائج الفحص التجريبي لترحيل الجداول (Dry Run Results)</h4>
                    <button onClick={() => setMigrationDryResult(null)} className="text-xs text-slate-500 hover:text-white">✕</button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-300 max-h-48 overflow-y-auto bg-slate-900/80 p-3 rounded border border-slate-800" dir="ltr">
                    {JSON.stringify(migrationDryResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 4. FOOTER (حالة الاتصال، عدد التنبيهات، رقم الإصدار) */}
      {/* ========================================================================= */}
      <footer className="bg-slate-900 border-t border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                cloudSyncState.status === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <strong className="text-slate-200">
              {cloudSyncState.status === 'connected' ? 'السيرفر متصل' : 'السيرفر غير متصل'}
            </strong>
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline font-mono">
            طابور المزامنة: {cloudSyncState.pendingQueueCount ?? rawQueue.length}
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline font-mono">
            الذاكرة: {(storageEstimate.totalBytes / (1024 * 1024)).toFixed(2)} MB
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-cyan-300/80">
            {alerts.length > 0 ? `⚠️ ${alerts.length} تنبيهات نشطة` : '✓ لا توجد تنبيهات'}
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            ORCA System v2.6.4
          </span>
        </div>
      </footer>
    </div>
  );
};
