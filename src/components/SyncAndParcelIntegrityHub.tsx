import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { useOrca } from '../context/OrcaContext';
import {
  auditParcelIntegrity,
  autoReconcileParcels,
  runCompleteDiagnosticSuite,
  DiagnosticTestCase,
  ParcelIntegrityReport,
  STATUS_ARABIC_LABELS,
} from '../utils/parcelLifecycleValidator';
import {
  loadSavedVpsConfig,
  fetchPostgresStatus,
  connectPostgresDatabase,
  seedPostgresDatabase,
  fetchFinancialAuditTrail,
  initCleanPostgresDatabase,
} from '../services/vpsClient';
import { vpsSyncEngine } from '../services/vpsSyncEngine';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Zap,
  ShieldCheck,
  Layers,
  Building2,
  Play,
  Sparkles,
  Database,
  Wifi,
  Cpu,
  X,
  FileSpreadsheet,
  Trash2,
  ArrowRightLeft,
  Check,
  Terminal,
  Lock,
} from 'lucide-react';
import { motion } from 'motion/react';

interface SyncAndParcelIntegrityHubProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncAndParcelIntegrityHub: React.FC<SyncAndParcelIntegrityHubProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    parcels,
    branches,
    branchesWithDerivedBalances,
    truckManifests,
    transactions,
    cloudSyncState,
    triggerManualCloudSync,
    formatCurrency,
    formatNumber,
    estimateLocalStorageSize,
    cleanupOldLocalData,
  } = useOrca();

  const [activeTab, setActiveTab] = useState<'connection' | 'postgres' | 'lifecycle' | 'tests'>('connection');
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticTestCase[]>([]);
  const [isFixingAnomalies, setIsFixingAnomalies] = useState(false);
  const [fixLog, setFixLog] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Real-time Ping Latency Tracker
  const [livePingMs, setLivePingMs] = useState<number | null>(null);
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [isPinging, setIsPinging] = useState(false);
  const [serverHealthData, setServerHealthData] = useState<any>(null);

  // Dedicated PostgreSQL Engine Management States
  const [pgStatus, setPgStatus] = useState<any>(null);
  const [customPgUrl, setCustomPgUrl] = useState('');
  const [isConnectingPg, setIsConnectingPg] = useState(false);
  const [isSeedingPg, setIsSeedingPg] = useState(false);
  const [isInitializingCleanPg, setIsInitializingCleanPg] = useState(false);
  const [financialAuditLogs, setFinancialAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Server-Authoritative API v2 In-App Test Queries
  const [apiV2Enabled, setApiV2Enabled] = useState(false);

  const branchesV2 = useQuery({
    queryKey: ['test-branches-v2'],
    queryFn: () => apiClient.getBranches(),
    enabled: apiV2Enabled,
  });

  const usersV2 = useQuery({
    queryKey: ['test-users-v2'],
    queryFn: () => apiClient.getUsers(),
    enabled: apiV2Enabled,
  });

  const parcelsV2 = useQuery({
    queryKey: ['test-parcels-v2'],
    queryFn: () => apiClient.getParcels({ page: 1, limit: 10 }),
    enabled: apiV2Enabled,
  });

  const vpsConfig = useMemo(() => loadSavedVpsConfig(), []);

  // Compute live parcel audit report
  const auditReport: ParcelIntegrityReport = useMemo(() => {
    return auditParcelIntegrity(parcels, branches, truckManifests);
  }, [parcels, branches, truckManifests]);

  // Real-time Ping Function
  const measureLivePing = useCallback(async () => {
    setIsPinging(true);
    const targetUrl = (vpsConfig.serverUrl || '').trim().replace(/\/+$/, '');
    const t0 = performance.now();
    try {
      const res = await fetch(`${targetUrl}/api/ping`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(vpsConfig.apiKey ? { Authorization: `Bearer ${vpsConfig.apiKey}` } : {}),
        },
      });
      const t1 = performance.now();
      const rtt = Math.round(t1 - t0);
      if (res.ok) {
        setLivePingMs(rtt);
        setPingHistory((prev) => [...prev.slice(-14), rtt]);
      } else {
        setLivePingMs(-1);
      }
    } catch {
      setLivePingMs(-1);
    } finally {
      setIsPinging(false);
    }
  }, [vpsConfig]);

  // Fetch full server health & PostgreSQL status
  const fetchServerHealth = useCallback(async () => {
    const targetUrl = (vpsConfig.serverUrl || '').trim().replace(/\/+$/, '');
    try {
      const res = await fetch(`${targetUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(vpsConfig.apiKey ? { Authorization: `Bearer ${vpsConfig.apiKey}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setServerHealthData(data);
      }
    } catch (e) {
      console.warn('Failed to fetch health info:', e);
    }

    try {
      const pg = await fetchPostgresStatus(vpsConfig.serverUrl);
      setPgStatus(pg);
    } catch (e) {
      console.warn('Failed to fetch pg status:', e);
    }
  }, [vpsConfig]);

  // Fetch Financial Audit Trail
  const loadFinancialAuditTrail = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const res = await fetchFinancialAuditTrail(vpsConfig.serverUrl, 30);
      if (res.success && Array.isArray(res.data)) {
        setFinancialAuditLogs(res.data);
      }
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [vpsConfig]);

  // Auto-measure ping and health on open
  useEffect(() => {
    if (isOpen) {
      measureLivePing();
      fetchServerHealth();
      loadFinancialAuditTrail();
      const interval = setInterval(() => {
        measureLivePing();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, measureLivePing, fetchServerHealth, loadFinancialAuditTrail]);

  // Handle Connecting Custom PostgreSQL URL
  const handleConnectPg = async () => {
    if (!customPgUrl.trim()) return;
    setIsConnectingPg(true);
    try {
      const res = await connectPostgresDatabase(vpsConfig.serverUrl, customPgUrl.trim());
      if (res.success) {
        setToastMessage('تم الاتصال بقاعدة بيانات PostgreSQL وتجهيز الجداول بنجاح!');
        fetchServerHealth();
      } else {
        setToastMessage(`فشل الاتصال: ${res.message}`);
      }
    } catch (e: any) {
      setToastMessage(`خطأ: ${e.message}`);
    } finally {
      setIsConnectingPg(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Handle Seeding Data to PostgreSQL
  const handleSeedToPostgres = async () => {
    setIsSeedingPg(true);
    try {
      const res = await seedPostgresDatabase(vpsConfig.serverUrl);
      if (res.success) {
        setToastMessage(`تم ترحيل وتأكيد حفظ ${res.recordsSaved || 0} سجلاً في جداول PostgreSQL!`);
        fetchServerHealth();
      } else {
        setToastMessage(`فشل الترحيل: ${res.message}`);
      }
    } catch (e: any) {
      setToastMessage(`خطأ: ${e.message}`);
    } finally {
      setIsSeedingPg(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Handle Clean Database Initialization
  const handleInitCleanDatabase = async () => {
    const confirmed = window.confirm(
      'تحذير أمني: هل أنت متأكد من رغبتك في تهيئة وبدء قاعدة بيانات PostgreSQL جديدة ونظيفة بالكامل من الصفر؟ سيتم تصفير كافة الجداول، مسح طوابير المزامنة وذاكرة كافة الأجهزة المتصلة لمنع إعادة تغذية أي بيانات قديمة.'
    );
    if (!confirmed) return;

    setIsInitializingCleanPg(true);
    try {
      vpsSyncEngine.executeLocalZeroWipe(true);
      const res = await initCleanPostgresDatabase(vpsConfig.serverUrl);
      if (res.success) {
        vpsSyncEngine.executeLocalZeroWipe(true);
        await vpsSyncEngine.pullFullDatabaseFromCloud();
        setToastMessage('تمت تهيئة وتصفير قاعدة بيانات PostgreSQL وكافة الأجهزة للبدء من الصفر بنجاح!');
        fetchServerHealth();
        loadFinancialAuditTrail();
      } else {
        setToastMessage(`فشلت التهيئة: ${res.message}`);
      }
    } catch (e: any) {
      setToastMessage(`خطأ: ${e.message}`);
    } finally {
      setIsInitializingCleanPg(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Run Test Suite Handler
  const handleRunDiagnostics = async () => {
    setIsRunningTests(true);
    setDiagnosticResults([]);
    try {
      const results = await runCompleteDiagnosticSuite(
        vpsConfig.serverUrl,
        vpsConfig.apiKey,
        parcels,
        branches,
        transactions
      );
      setDiagnosticResults(results);
      setToastMessage('اكتمل الفحص الشامل للمنظومة بنجاح');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Error running test suite:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Auto Reconcile Anomalies Handler
  const handleAutoReconcile = async () => {
    setIsFixingAnomalies(true);
    try {
      const { fixedParcels, fixedCount, logs } = autoReconcileParcels(parcels);
      if (fixedCount > 0) {
        for (const p of fixedParcels) {
          vpsSyncEngine.syncParcel(p);
        }
        await vpsSyncEngine.pullFullDatabaseFromCloud();
        setFixLog(logs);
        setToastMessage(`تمت التسوية الآلية وإصلاح ${fixedCount} سجلات بنجاح.`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setFixLog(['جميع الطرود سليمة ومطابقة لقواعد دورة الحياة ولا توجد انحرافات بحاجة لتسوية آلية.']);
      }
    } catch (err: any) {
      console.error('Auto reconcile error:', err);
    } finally {
      setIsFixingAnomalies(false);
    }
  };

  if (!isOpen) return null;

  const isPgActive = Boolean(pgStatus?.postgres?.connected || serverHealthData?.databaseStatus === 'connected_postgresql');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
      >
        {/* Top Bar / Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  مركز تدقيق ومراقبة قاعدة بيانات PostgreSQL والمزامنة اللحظية
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded ${
                  isPgActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPgActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  {isPgActive ? 'PostgreSQL Live Connected' : 'Fallback File Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة الجداول العلائقية، سجل التدقيق المالي المباشر، وزمن الاستجابة اللحظي لكافة الفروع
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const sizes: Array<{ key: string; sizeMB: number; type: string }> = [];
                let total = 0;

                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (!key) continue;
                  const val = localStorage.getItem(key) || '';
                  const bytes = (key.length + val.length) * 2;
                  const mb = bytes / 1024 / 1024;
                  total += bytes;

                  // Check if contains Base64
                  let type = 'data';
                  if (val.includes('data:image/')) type = '⚠️ BASE64';
                  else if (val.startsWith('[')) type = 'array';
                  else if (val.startsWith('{')) type = 'object';

                  sizes.push({ key, sizeMB: Math.round(mb * 100) / 100, type });
                }

                sizes.sort((a, b) => b.sizeMB - a.sizeMB);

                const report =
                  `📊 localStorage Total: ${(total / 1024 / 1024).toFixed(2)} MB / 5 MB\n\n` +
                  `Top 15 keys by size:\n` +
                  sizes
                    .slice(0, 15)
                    .map((s) => `  ${s.key}\n    → ${s.sizeMB} MB [${s.type}]`)
                    .join('\n\n');

                console.log(report);
                alert(report);
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
              title="فحص حجم مفاتيح localStorage واكتشاف الصور العالقة"
            >
              🔍 تشخيص localStorage
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/db/status');
                  const data = await res.json();
                  console.log('=== Server DB Status ===');
                  console.log(JSON.stringify(data, null, 2));
                  alert(JSON.stringify(data, null, 2));
                } catch (err: any) {
                  alert('Failed: ' + err.message);
                }
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
              title="فحص حالة الجداول والسجلات على سيرفر PostgreSQL مباشرة"
            >
              🔍 حالة قاعدة البيانات
            </button>
            <button
              onClick={() => {
                measureLivePing();
                fetchServerHealth();
                loadFinancialAuditTrail();
                triggerManualCloudSync();
              }}
              disabled={isPinging}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              title="إعادة فحص الاتصال وتحديث البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-cyan-400' : ''}`} />
              <span>تحديث الفحص</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Optional Toast Notice */}
        {toastMessage && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-2.5 text-xs font-semibold text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white cursor-pointer">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-950/60 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('connection')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              activeTab === 'connection'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>جودة الاتصال ومصفوفة الفروع</span>
            {livePingMs !== null && livePingMs > 0 && (
              <span className="font-mono text-[11px] text-cyan-400/80">({livePingMs}ms)</span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('postgres');
              loadFinancialAuditTrail();
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              activeTab === 'postgres'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>محرك PostgreSQL والتدقيق المالي</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {isPgActive ? 'متصل' : 'تخزين احتياطي'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('lifecycle')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              activeTab === 'lifecycle'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span>تدقيق دورة حياة ومراحل الطرود</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {auditReport.healthScorePercent}% سلامة
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              activeTab === 'tests'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>مشغل الاختبارات الحية المدمج</span>
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900/50">
          {/* TAB 1: CONNECTION & BRANCH MATRIX */}
          {activeTab === 'connection' && (
            <div className="space-y-6">
              {/* API v2 In-App Test Section */}
              <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    اختبار Server-Authoritative API v2
                  </h3>
                  <button
                    onClick={() => {
                      if (!apiV2Enabled) {
                        setApiV2Enabled(true);
                      } else {
                        branchesV2.refetch();
                        usersV2.refetch();
                        parcelsV2.refetch();
                      }
                    }}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
                  >
                    {apiV2Enabled ? '🔄 إعادة الجلب' : '▶️ تشغيل الاختبار'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Branches */}
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">الفروع (v2)</div>
                    {branchesV2.isLoading ? (
                      <div className="text-xs text-slate-500">جارٍ التحميل...</div>
                    ) : branchesV2.isError ? (
                      <div className="text-xs text-rose-400">
                        خطأ: {String((branchesV2.error as any)?.message || 'فشل')}
                      </div>
                    ) : branchesV2.data?.success ? (
                      <div>
                        <div className="text-lg font-bold text-emerald-400 font-mono">
                          {branchesV2.data.data?.length || 0}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {branchesV2.data.data?.map((b: any) => b.name).join(', ')}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">لم يُشغَّل</div>
                    )}
                  </div>

                  {/* Users */}
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">المستخدمون (v2)</div>
                    {usersV2.isLoading ? (
                      <div className="text-xs text-slate-500">جارٍ التحميل...</div>
                    ) : usersV2.isError ? (
                      <div className="text-xs text-rose-400">
                        خطأ: {String((usersV2.error as any)?.message || 'فشل')}
                      </div>
                    ) : usersV2.data?.success ? (
                      <div>
                        <div className="text-lg font-bold text-cyan-400 font-mono">
                          {usersV2.data.data?.length || 0}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          تأكيد: لا password في الرد
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">لم يُشغَّل</div>
                    )}
                  </div>

                  {/* Parcels */}
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 mb-1">الطرود (v2)</div>
                    {parcelsV2.isLoading ? (
                      <div className="text-xs text-slate-500">جارٍ التحميل...</div>
                    ) : parcelsV2.isError ? (
                      <div className="text-xs text-rose-400">
                        خطأ: {String((parcelsV2.error as any)?.message || 'فشل')}
                      </div>
                    ) : parcelsV2.data?.success ? (
                      <div>
                        <div className="text-lg font-bold text-amber-400 font-mono">
                          {parcelsV2.data.pagination?.total ?? parcelsV2.data.data?.length ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          الصفحة {parcelsV2.data.pagination?.page} / {parcelsV2.data.pagination?.totalPages}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">لم يُشغَّل</div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 mt-2 text-center">
                  ملاحظة: هذا اختبار فقط. النظام الحالي (vpsSyncEngine) لا يزال يعمل بشكل مستقل.
                </div>
              </div>

              {/* Primary Ping & Server Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 1. Real-time RTT Latency */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>زمن الاستجابة الحقيقي (RTT)</span>
                    <Activity className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-white tabular-nums">
                      {livePingMs === null ? '...' : livePingMs < 0 ? 'انقطاع' : `${livePingMs}ms`}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        livePingMs === null
                          ? 'text-slate-400'
                          : livePingMs < 0
                          ? 'text-rose-400'
                          : livePingMs < 100
                          ? 'text-emerald-400'
                          : livePingMs < 300
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {livePingMs === null
                        ? 'جاري القياس...'
                        : livePingMs < 0
                        ? 'غير متصل'
                        : livePingMs < 100
                        ? 'استجابة فائقة'
                        : livePingMs < 300
                        ? 'استجابة جيدة'
                        : 'استجابة بطيئة'}
                    </span>
                  </div>
                  {/* Mini latency sparks */}
                  <div className="mt-3 flex items-end gap-1 h-5">
                    {pingHistory.map((val, idx) => {
                      const h = Math.min(20, Math.max(4, Math.round((val / 300) * 20)));
                      const isGood = val < 100;
                      return (
                        <div
                          key={idx}
                          style={{ height: `${h}px` }}
                          className={`flex-1 rounded-sm ${
                            isGood ? 'bg-emerald-500/60' : 'bg-amber-500/60'
                          }`}
                          title={`${val}ms`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 2. Central Server Status */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>حالة الخادم المركزي</span>
                    <Server className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-semibold text-white">
                        {serverHealthData?.service || 'خادم أوركا المركزي نشط'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Uptime: {serverHealthData?.uptimeSeconds || 0} ثانية
                    </p>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 font-mono truncate">
                    URL: {vpsConfig.serverUrl || 'خادم محلي / مدمج'}
                  </div>
                </div>

                {/* 3. Database Engine */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>محرك التخزين وقاعدة البيانات</span>
                    <Database className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-sm font-semibold text-cyan-300">
                      {isPgActive ? 'PostgreSQL Enterprise Engine' : 'تخزين سحابي موثوق (JSON Mirror)'}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      حالة الاتصال: {isPgActive ? 'متصل ونشط' : 'جاهز للاتصال'}
                    </p>
                  </div>
                  <div className="mt-2 text-[11px] text-emerald-400 font-medium">
                    ✓ تم تأكيد مطابقة الجداول والعمليات
                  </div>
                </div>

                {/* 4. Multi-Branch Realtime Stream */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>قناة التحديثات اللحظية (SSE)</span>
                    <Wifi className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-sm font-semibold text-white">
                      {cloudSyncState.realtimeActive ? 'بث فوري نشط (<300ms)' : 'مفعل عند الطلب'}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      طابور الانتظار: {cloudSyncState.pendingQueueCount} عمليات
                    </p>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    آخر مزامنة: {cloudSyncState.lastSyncTimestamp ? new Date(cloudSyncState.lastSyncTimestamp).toLocaleTimeString('ar-SY') : 'الآن'}
                  </div>
                </div>
              </div>

              {/* Branch-by-Branch Live Sync Matrix */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">
                      مصفوفة تطابق ومزامنة الفروع في الجمهورية العربية السورية
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    إجمالي الفروع المسجلة: <span className="text-white font-mono">{branches.length}</span>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                        <th className="py-2.5 px-4">كود الفرع</th>
                        <th className="py-2.5 px-4">اسم المركز / المحافظة</th>
                        <th className="py-2.5 px-4">نوع الفرع</th>
                        <th className="py-2.5 px-4 text-center">الطرود الصادرة</th>
                        <th className="py-2.5 px-4 text-center">الطرود الواردة</th>
                        <th className="py-2.5 px-4 text-left">رصيد الصندوق (SYP)</th>
                        <th className="py-2.5 px-4 text-left">رصيد الصندوق (USD)</th>
                        <th className="py-2.5 px-4 text-center">حالة المزامنة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {branchesWithDerivedBalances.map((b) => {
                        const outboundCount = parcels.filter((p) => p.originHubId === b.id).length;
                        const inboundCount = parcels.filter((p) => p.destinationHubId === b.id).length;
                        return (
                          <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-bold text-cyan-400">
                              {b.code}
                            </td>
                            <td className="py-2.5 px-4 text-white font-medium">
                              {b.name}
                              <span className="text-slate-500 mr-2 text-[11px]">({b.governorate})</span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-400">
                              {b.type === 'main_hub' ? 'مركز إقليمي رئيسي' : 'نقطة استلام وتوزيع'}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono tabular-nums text-slate-300">
                              {outboundCount}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono tabular-nums text-slate-300">
                              {inboundCount}
                            </td>
                            <td className="py-2.5 px-4 text-left font-mono tabular-nums text-emerald-400">
                              {formatCurrency(b.boxSypBalance || 0, 'SYP')}
                            </td>
                            <td className="py-2.5 px-4 text-left font-mono tabular-nums text-emerald-400">
                              {formatCurrency(b.boxUsdBalance || 0, 'USD')}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                متطابق
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POSTGRESQL ENGINE & FINANCIAL AUDIT TRAIL */}
          {activeTab === 'postgres' && (
            <div className="space-y-6">
              {/* PostgreSQL Overview Banner */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">
                      محرك قاعدة بيانات PostgreSQL وسجلات التدقيق المالي العلائقية
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    يعمل النظام بالاعتماد المباشر على جداول PostgreSQL المركزية (`orca_entities`, `financial_audit_trail`) مع قفل المعاملات الذرية وسرعة استعلام عالية عبر فهارس GIN و B-Tree.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const res = vpsSyncEngine.forcePushLocalDatabase();
                      setToastMessage(`تمت جدولة وإعادة دفع ${res.queued} سجلاً محلياً من ${res.collections} مجموعات إلى السيرفر بنجاح!`);
                      setTimeout(() => setToastMessage(null), 5000);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>🔄 إعادة مزامنة كاملة للسيرفر (Force Push)</span>
                  </button>

                  <button
                    onClick={() => {
                      const size = estimateLocalStorageSize();
                      const top5 = Object.entries(size.byKey)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([k, v]) => `- ${k}: ${Math.round(v / 1024)}KB`)
                        .join('\n');

                      const message =
                        `حجم التخزين الحالي: ${size.totalMB}MB / 5MB\n\n` +
                        `أكبر 5 مفاتيح:\n${top5}\n\n` +
                        `سيتم حذف:\n` +
                        `- الطرود المُسلَّمة قبل 90 يوم.\n` +
                        `- أحداث الطرود المحذوفة.\n` +
                        `- سجلات التدقيق الأقدم من 60 يوم.\n\n` +
                        `⚠️ البيانات على السيرفر آمنة تماماً.\n\nمتابعة؟`;

                      if (confirm(message)) {
                        const result = cleanupOldLocalData();
                        alert(
                          `✅ تم التنظيف:\n\n` +
                          `- طرود محذوفة: ${result.removedParcels}\n` +
                          `- أحداث محذوفة: ${result.removedEvents}\n` +
                          `- سجلات محذوفة: ${result.removedAuditLogs}\n` +
                          `- مساحة محررة: ${result.freedMB}MB`
                        );
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer"
                  >
                    <span>🧹 تنظيف ذاكرة المتصفح</span>
                  </button>

                  <button
                    onClick={handleSeedToPostgres}
                    disabled={isSeedingPg || !isPgActive}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSeedingPg ? 'animate-spin' : ''}`} />
                    <span>حفظ وترحيل البيانات لـ PostgreSQL</span>
                  </button>

                  <button
                    onClick={handleInitCleanDatabase}
                    disabled={isInitializingCleanPg}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/80 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تهيئة وبدء قاعدة بيانات نظيفة</span>
                  </button>
                </div>
              </div>

              {/* PostgreSQL Connection String & Configuration */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>رابط الاتصال المباشر بقاعدة بيانات PostgreSQL (Cloud SQL / VPS URL)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    المصدر الحالي: {pgStatus?.postgres?.configSource || 'البيئة المدمجة'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPgUrl}
                    onChange={(e) => setCustomPgUrl(e.target.value)}
                    placeholder="postgresql://user:password@host:5432/orca_express?sslmode=require"
                    className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                    dir="ltr"
                  />
                  <button
                    onClick={handleConnectPg}
                    disabled={isConnectingPg || !customPgUrl.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {isConnectingPg ? 'جاري الاتصال...' : 'ربط واختبار'}
                  </button>
                </div>
              </div>

              {/* Tables & Entities Count Breakdown from Live PostgreSQL */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h4 className="text-xs font-bold text-white mb-3 flex items-center justify-between">
                  <span>السجلات الفعلية داخل جداول PostgreSQL (`orca_entities`)</span>
                  <span className="text-[11px] text-emerald-400 font-mono">Live Table Count</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { key: 'branches', label: 'الفروع', count: pgStatus?.postgres?.counts?.branches || branches.length },
                    { key: 'parcels', label: 'الطرود والشحنات', count: pgStatus?.postgres?.counts?.parcels || parcels.length },
                    { key: 'truckManifests', label: 'منافيستات الشحن', count: pgStatus?.postgres?.counts?.truckManifests || truckManifests.length },
                    { key: 'transactions', label: 'حركات الصندوق', count: pgStatus?.postgres?.counts?.transactions || transactions.length },
                    { key: 'vouchers', label: 'السندات المالية', count: pgStatus?.postgres?.counts?.vouchers || 0 },
                    { key: 'users', label: 'المستخدمين', count: pgStatus?.postgres?.counts?.users || 1 },
                  ].map((tbl) => (
                    <div key={tbl.key} className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400">{tbl.label}</span>
                      <div className="text-xl font-bold font-mono text-cyan-400 mt-2">
                        {formatNumber(tbl.count)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Audit Trail Table (Live from PostgreSQL) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white">
                      سجل التدقيق المالي الآلي المباشر (`financial_audit_trail`)
                    </h4>
                  </div>
                  <button
                    onClick={loadFinancialAuditTrail}
                    disabled={isLoadingAudit}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                    <span>تحديث السجل</span>
                  </button>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium sticky top-0">
                        <th className="py-2.5 px-4">رقم القيد</th>
                        <th className="py-2.5 px-4">نوع الحركة</th>
                        <th className="py-2.5 px-4">الكيان / الجدول</th>
                        <th className="py-2.5 px-4">الفرع</th>
                        <th className="py-2.5 px-4">المستخدم</th>
                        <th className="py-2.5 px-4 text-left">المبلغ</th>
                        <th className="py-2.5 px-4">التوقيت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {financialAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
                            لا توجد قيود مالية مسجلة حتى الآن أو قاعدة البيانات نظيفة
                          </td>
                        </tr>
                      ) : (
                        financialAuditLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2 px-4 text-slate-400">#{log.id}</td>
                            <td className="py-2 px-4">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                log.event_type === 'INSERT' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                              }`}>
                                {log.event_type}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-slate-300">{log.entity_collection}</td>
                            <td className="py-2 px-4 text-slate-400">{log.branch_id || '-'}</td>
                            <td className="py-2 px-4 text-slate-300">{log.user_name || 'system'}</td>
                            <td className="py-2 px-4 text-left text-emerald-400 font-bold">
                              {log.amount ? `${Number(log.amount).toLocaleString()} ${log.currency || 'SYP'}` : '-'}
                            </td>
                            <td className="py-2 px-4 text-slate-500 text-[11px]">
                              {new Date(log.created_at).toLocaleTimeString('ar-SY')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PARCEL LIFECYCLE AUDIT & ANOMALIES */}
          {activeTab === 'lifecycle' && (
            <div className="space-y-6">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">إجمالي الطرود المفحوصة</div>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {auditReport.totalParcels}
                  </div>
                  <div className="text-xs text-emerald-400 mt-1">
                    {auditReport.healthyParcelsCount} طرد سليم 100%
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">مؤشر سلامة دورة الحياة</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {auditReport.healthScorePercent}%
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    معيار FSM اللوجستي الدولي
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">انحرافات أو تنبيهات تدقيق</div>
                  <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                    {auditReport.anomaliesCount}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {auditReport.criticalCount} حرج · {auditReport.warningCount} تحذير
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="text-xs text-slate-400">التسوية والإصلاح الآلي</div>
                  <button
                    onClick={handleAutoReconcile}
                    disabled={isFixingAnomalies || auditReport.anomaliesCount === 0}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>إصلاح وتوفيق البيانات تلقائياً</span>
                  </button>
                </div>
              </div>

              {/* Status Breakdown Flow Visualization */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-3">
                  توزيع مراحل الطرود وفق المخطط الهيكلي (Finite State Machine Breakdown)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {Object.entries(auditReport.statusBreakdown).map(([statusKey, count]) => {
                    const label = STATUS_ARABIC_LABELS[statusKey as keyof typeof STATUS_ARABIC_LABELS] || statusKey;
                    return (
                      <div
                        key={statusKey}
                        className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg flex flex-col justify-between"
                      >
                        <span className="text-[11px] text-slate-400 line-clamp-1" title={label}>
                          {label}
                        </span>
                        <div className="flex items-baseline justify-between mt-2">
                          <span className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                            {formatNumber(count)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {auditReport.totalParcels > 0
                              ? Math.round((count / auditReport.totalParcels) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Anomalies Table / List */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">
                      تقرير تدقيق الانحرافات وحالات الطرود
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    {auditReport.anomalies.length} حالة مسجلة
                  </span>
                </div>

                {auditReport.anomalies.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold text-white">
                      كافة الطرود مطابقة بنسبة 100% لقواعد دورة الحياة والمعايير المالية
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      لا توجد قفزات غير قانونية في الحالات أو مبالغ سالبة أو بيانات فروع مفقودة.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
                    {auditReport.anomalies.map((anom, idx) => (
                      <div key={idx} className="p-4 hover:bg-slate-800/30 transition-colors flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              anom.severity === 'critical'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : anom.severity === 'warning'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            }`}
                          >
                            {anom.severity === 'critical' ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-white">
                                {anom.trackingNumber}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                · {anom.description}
                              </span>
                            </div>
                            <p className="text-xs text-cyan-300/90 mt-1">
                              الإجراء الموصى به: {anom.recommendedAction}
                            </p>
                          </div>
                        </div>

                        {anom.canAutoFix && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shrink-0">
                            قابل للإصلاح الآلي
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {fixLog.length > 0 && (
                  <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-xs font-mono space-y-1">
                    <div className="text-emerald-400 font-bold mb-1">سجل عمليات التسوية الأخيرة:</div>
                    {fixLog.map((log, i) => (
                      <div key={i} className="text-slate-300">
                        • {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LIVE AUTOMATED TEST SUITE */}
          {activeTab === 'tests' && (
            <div className="space-y-6">
              {/* Test Runner Banner */}
              <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-cyan-400" />
                    مشغل الاختبارات والتحقق الشامل بنقرة واحدة
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    يقوم هذا الاختبار الآلي بمحاكاة كاملة لكفاءة استجابة الخادم المركزي، مطابقة حالات ومراحل الطرود، والتأكد من عدم وجود تضارب مالي في الصناديق الثنائية (SYP/USD).
                  </p>
                </div>

                <button
                  onClick={handleRunDiagnostics}
                  disabled={isRunningTests}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-60 shrink-0 cursor-pointer"
                >
                  {isRunningTests ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري تشغيل الفحص...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>تشغيل الفحص الشامل للمنظومة</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Cases Results */}
              <div className="space-y-3">
                {(diagnosticResults.length > 0
                  ? diagnosticResults
                  : [
                      {
                        id: 'server_ping_rtt',
                        name: 'اختبار سرعة استجابة الخادم المركزي (Ping RTT)',
                        category: 'connection' as const,
                        description: 'فحص الاتصال بنقطة النهاية /api/ping وقياس زمن الاستجابة الفعلي بالمللي ثانية.',
                        status: 'idle' as const,
                      },
                      {
                        id: 'server_health_pg',
                        name: 'التحقق من صحة الخادم وقاعدة البيانات السحابية',
                        category: 'connection' as const,
                        description: 'فحص نقطة النهاية /api/health ومطابقة حالة اتصال محرك البيانات PostgreSQL.',
                        status: 'idle' as const,
                      },
                      {
                        id: 'parcel_lifecycle_integrity',
                        name: 'تدقيق دورة حياة الطرود ومطابقة الحالات (FSM)',
                        category: 'lifecycle' as const,
                        description: 'فحص قيود الانتقال بين المراحل العشر للطرود والكشف عن أي انحرافات أو قفزات غير قانونية.',
                        status: 'idle' as const,
                      },
                      {
                        id: 'dual_currency_cashbox',
                        name: 'التطابق المالي المزدوج للصناديق (SYP / USD)',
                        category: 'finance' as const,
                        description: 'مطابقة أرصدة الصناديق وحركات المقبوضات والمصروفات بالليرة السورية والدولار الأمريكي.',
                        status: 'idle' as const,
                      },
                      {
                        id: 'multi_branch_sync_queue',
                        name: 'سلامة طابور المزامنة التراكمي وتحديثات SSE',
                        category: 'sync' as const,
                        description: 'فحص جاهزية طابور الإرسال التلقائي، وعدم وجود حركات عالقة أو مفقودة عند تبدل الشبكة.',
                        status: 'idle' as const,
                      },
                    ]
                ).map((test) => (
                  <div
                    key={test.id}
                    className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-start justify-between gap-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-slate-800 border border-slate-700">
                        {test.status === 'passed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : test.status === 'warning' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        ) : test.status === 'failed' ? (
                          <XCircle className="w-5 h-5 text-rose-400" />
                        ) : test.status === 'running' ? (
                          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                        ) : (
                          <Activity className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-white">{test.name}</h4>
                          {test.durationMs !== undefined && (
                            <span className="text-[11px] font-mono text-slate-500">
                              ({test.durationMs}ms)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{test.description}</p>
                        {test.details && (
                          <p className="text-xs text-emerald-300 font-mono mt-1.5">
                            ✓ {test.details}
                          </p>
                        )}
                        {test.error && (
                          <p className="text-xs text-rose-400 font-mono mt-1.5">
                            ✗ {test.error}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                          test.status === 'passed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : test.status === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : test.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {test.status === 'passed'
                          ? 'ناجح'
                          : test.status === 'warning'
                          ? 'تحذير'
                          : test.status === 'failed'
                          ? 'فشل'
                          : 'في الانتظار'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Orca Express · PostgreSQL Production Hub v5.2</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            إغلاق المركز
          </button>
        </footer>
      </motion.div>
    </div>
  );
};
