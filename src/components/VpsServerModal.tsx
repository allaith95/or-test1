import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  Shield,
  Radio,
  FileJson,
  Upload,
  Download,
  Copy,
  Check,
  Globe,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  Link,
  Wifi,
  Lock,
  Terminal,
  Activity,
  ArrowUpDown,
  FileCode,
} from 'lucide-react';
import {
  VpsServerConfig,
  loadSavedVpsConfig,
  saveVpsConfig,
  testVpsConnection,
  fetchPostgresStatus,
  connectPostgresDatabase,
  seedPostgresDatabase,
} from '../services/vpsClient';
import { useOrca } from '../context/OrcaContext';

interface VpsServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectedSuccess?: () => void;
}

export const VpsServerModal: React.FC<VpsServerModalProps> = ({
  isOpen,
  onClose,
  onConnectedSuccess,
}) => {
  const { branches, cloudSyncState, pushEntireDatabaseToCloud, pullEntireDatabaseFromCloud } = useOrca();

  const [config, setConfig] = useState<VpsServerConfig>(loadSavedVpsConfig());
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    message: string;
    serverInfo?: any;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'postgres' | 'guide' | 'docker'>('postgres');

  // PostgreSQL specific state
  const [pgStatus, setPgStatus] = useState<{
    connected: boolean;
    pingMs: number;
    database?: string;
    error?: string | null;
    counts?: Record<string, number>;
    configSource?: string;
  } | null>(null);
  const [pgLoading, setPgLoading] = useState(false);
  const [pgInputUrl, setPgInputUrl] = useState('');
  const [pgActionMsg, setPgActionMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadSavedVpsConfig());
      setTestResult(null);
      loadPgHealth();
    }
  }, [isOpen]);

  const loadPgHealth = async () => {
    setPgLoading(true);
    try {
      const res = await fetchPostgresStatus(config.serverUrl);
      if (res && res.postgres) {
        setPgStatus(res.postgres);
      }
    } catch (e) {
      console.error('Failed to load Postgres status:', e);
    } finally {
      setPgLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testVpsConnection(config);
      setTestResult(res);
      if (res.success) {
        setConfig((prev) => ({
          ...prev,
          isConnected: true,
          lastPingMs: res.latencyMs,
          lastConnectedAt: new Date().toISOString(),
        }));
        loadPgHealth();
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: e.message || 'فشل الاتصال بسيرفر VPS',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndActivate = async () => {
    setSaving(true);
    try {
      const updated = {
        ...config,
        isConnected: testResult?.success || config.isConnected,
        lastConnectedAt: testResult?.success ? new Date().toISOString() : config.lastConnectedAt,
      };
      saveVpsConfig(updated);
      setConfig(updated);

      // Perform initial push if connected
      if (updated.isConnected) {
        await pushEntireDatabaseToCloud();
      }

      setTimeout(() => {
        setSaving(false);
        if (onConnectedSuccess) onConnectedSuccess();
        onClose();
      }, 600);
    } catch (e) {
      setSaving(false);
    }
  };

  const handleTestPostgresConnect = async () => {
    if (!pgInputUrl.trim()) {
      setPgActionMsg({ success: false, text: 'يرجى إدخال رابط الاتصال (DATABASE_URL) أولاً' });
      return;
    }
    setPgLoading(true);
    setPgActionMsg(null);
    try {
      const res = await connectPostgresDatabase(config.serverUrl, pgInputUrl.trim());
      setPgActionMsg({
        success: res.success,
        text: res.message,
      });
      if (res.success) {
        await loadPgHealth();
      }
    } catch (e: any) {
      setPgActionMsg({ success: false, text: `خطأ: ${e.message}` });
    } finally {
      setPgLoading(false);
    }
  };

  const handleSeedPostgres = async () => {
    setSeeding(true);
    setPgActionMsg(null);
    try {
      const res = await seedPostgresDatabase(config.serverUrl);
      setPgActionMsg({
        success: res.success,
        text: res.success ? (res.message || 'تم ترحيل البيانات بنجاح!') : (res.error || 'فشل الترحيل'),
      });
      if (res.success) {
        await loadPgHealth();
      }
    } catch (e: any) {
      setPgActionMsg({ success: false, text: `خطأ أثناء الترحيل: ${e.message}` });
    } finally {
      setSeeding(false);
    }
  };

  const handleExportConfigJson = () => {
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orca-vps-client-config-${config.companyCode || 'node'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">إعدادات VPS وقواعد بيانات PostgreSQL المركزية</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  PostgreSQL 16 جاهز
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ربط النظام السحابي بقواعد بيانات PostgreSQL المركزية للأمان التام، الأداء الفائق وتزامن الفروع اللحظي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('postgres')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'postgres'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>قواعد بيانات PostgreSQL</span>
            {pgStatus?.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>بيانات خادم VPS والفروع</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>دليل الربط المحلي والسحابي بالتفصيل</span>
          </button>

          <button
            onClick={() => setActiveTab('docker')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'docker'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>أوامر Docker Compose السريعة</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* TAB 1: POSTGRESQL */}
          {activeTab === 'postgres' && (
            <div className="space-y-6">
              {/* Live PostgreSQL Status Card */}
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  pgStatus?.connected
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        pgStatus?.connected
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-white">
                          {pgStatus?.connected
                            ? 'قاعدة بيانات PostgreSQL متصلة وتعمل بنجاح!'
                            : 'PostgreSQL في وضع الجاهزية (يعمل حالياً بالتخزين الاحتياطي التلقائي)'}
                        </span>
                        {pgStatus?.connected && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            ACID Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {pgStatus?.connected ? (
                          <>
                            اسم القاعدة: <strong className="text-cyan-300">{pgStatus.database || 'orca_express'}</strong> • زمن الاستجابة: <strong className="text-emerald-300">{pgStatus.pingMs}ms</strong> • المصدر: <span className="font-mono text-[11px]">{pgStatus.configSource}</span>
                          </>
                        ) : (
                          'النظام مؤهل بالكامل للربط بقاعدة بوستغريس محلية أو سحابية. أدخل الرابط بالأسفل لتفعيل الاتصال المباشر.'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadPgHealth}
                      disabled={pgLoading}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${pgLoading ? 'animate-spin text-cyan-400' : ''}`} />
                      <span>تحديث الحالة</span>
                    </button>
                    <a
                      href="/api/db/export-sql"
                      download
                      className="px-3.5 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير .SQL Dump</span>
                    </a>
                  </div>
                </div>

                {/* Database Tables Summary */}
                {pgStatus?.counts && Object.keys(pgStatus.counts).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800/80">
                    <div className="text-[11px] font-bold text-slate-400 mb-2">إحصائيات السجلات المخزنة في جداول PostgreSQL:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {Object.entries(pgStatus.counts).map(([collection, count]) => (
                        <div key={collection} className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                          <div className="text-[10px] text-slate-400 truncate">{collection}</div>
                          <div className="text-sm font-black text-cyan-400 mt-0.5">{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Connect / Update Database URL */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>تحديد رابط الاتصال بقاعدة بيانات PostgreSQL (DATABASE_URL):</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    PostgreSQL 14 / 15 / 16
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="postgresql://postgres:password@localhost:5432/orca_express"
                      value={pgInputUrl}
                      onChange={(e) => setPgInputUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 dir-ltr text-left"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    💡 يمكنك وضع رابط اتصال محلي <code>localhost:5432</code> أو رابط سحابي من سيرفرك الـ VPS أو من مزود سحابي مثل (Supabase, Neon, AWS RDS, Hetzner).
                  </p>
                </div>

                {pgActionMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      pgActionMsg.success
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-950/40 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {pgActionMsg.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{pgActionMsg.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleTestPostgresConnect}
                    disabled={pgLoading}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${pgLoading ? 'animate-spin' : ''}`} />
                    <span>{pgLoading ? 'جارٍ فحص الاتصال وتوليد الجداول...' : 'اختبار وتفعيل الاتصال بقاعدة PostgreSQL'}</span>
                  </button>

                  <button
                    onClick={handleSeedPostgres}
                    disabled={seeding || !pgStatus?.connected}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <ArrowUpDown className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
                    <span>{seeding ? 'جارٍ ترحيل البيانات...' : 'ترحيل كافة البيانات الحالية إلى PostgreSQL الآن'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Examples */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      مثال الرابط المحلي (Localhost / Docker)
                    </span>
                    <button
                      onClick={() => handleCopy('postgresql://postgres:postgres@localhost:5432/orca_express', 'loc')}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copied === 'loc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>نسخ</span>
                    </button>
                  </div>
                  <code className="block p-2 rounded-lg bg-slate-900 text-[11px] font-mono text-slate-300 dir-ltr text-left overflow-x-auto">
                    postgresql://postgres:postgres@localhost:5432/orca_express
                  </code>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      مثال الرابط السحابي (VPS / Remote Postgres)
                    </span>
                    <button
                      onClick={() => handleCopy('postgresql://orca_admin:YourSecretPassword@your-vps-ip:5432/orca_express?sslmode=prefer', 'vps')}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copied === 'vps' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>نسخ</span>
                    </button>
                  </div>
                  <code className="block p-2 rounded-lg bg-slate-900 text-[11px] font-mono text-slate-300 dir-ltr text-left overflow-x-auto">
                    postgresql://orca_admin:YourSecret@your-vps-ip:5432/orca_express
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VPS SERVER CONFIG */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              {/* Connection Status Card */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  config.isConnected
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      config.isConnected
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {config.isConnected ? <CheckCircle className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">
                      {config.isConnected ? 'متصل بسيرفر VPS السحابي بنجاح' : 'السيرفر غير متصل حالياً'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {config.isConnected && config.lastConnectedAt
                        ? `آخر استجابة: ${config.lastPingMs || 15}ms • تم الاتصال: ${new Date(
                            config.lastConnectedAt
                          ).toLocaleTimeString('ar-SY')}`
                        : 'أدخل رابط الـ VPS واضغط اختبار الاتصال'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                      config.isConnected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {config.isConnected ? 'LIVE ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>رابط سيرفر VPS الرئيسي (Server URL / IP Domain):</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://system.orca-express.com أو http://your-vps-ip:3000"
                    value={config.serverUrl}
                    onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 dir-ltr text-left"
                  />
                  <span className="text-[11px] text-slate-400">
                    اترك الحقل فارغاً إذا كنت تستخدم السيرفر المحلي المدمج لنفس النطاق.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>مفتاح أمان API السري (Optional API Key):</span>
                  </label>
                  <input
                    type="password"
                    placeholder="orca-secure-key-2026..."
                    value={config.apiKey || ''}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400 dir-ltr text-left font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ربط هذا المتصفح بفرع محدد (تلقائي):</span>
                  </label>
                  <select
                    value={config.branchBindingId || ''}
                    onChange={(e) => setConfig({ ...config, branchBindingId: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">جميع الفروع (المركز الإداري العام)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold">{testResult.message}</div>
                    {testResult.serverInfo && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        سيرفر: {testResult.serverInfo.service} v{testResult.serverInfo.version} • قاعدة البيانات:{' '}
                        {testResult.serverInfo.databaseStatus}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STEP-BY-STEP GUIDE (LOCAL & CLOUD) */}
          {activeTab === 'guide' && (
            <div className="space-y-6 text-xs leading-relaxed text-slate-300">
              {/* Architecture diagram banner */}
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 space-y-2">
                <div className="font-bold flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>معمارية النظام المعتمدة: Node.js/Express + PostgreSQL 16</span>
                </div>
                <p>
                  يقوم سيرفر التطبيق (`server.ts` + `server/postgres.ts`) بالعمل كخادم واجهة وخادم API مركزي، متصلاً مباشرة بقاعدة بيانات <strong>PostgreSQL</strong>.
                  جميع حركات الطرود، المنافيست، الصناديق، والتحويلات يتم تسجيلها بأمان تام (ACID Transactions) ومزامنتها لحظياً بين كافة الفروع.
                </p>
              </div>

              {/* Section 1: Local Setup */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-black">
                    A
                  </span>
                  <span>طريقة الربط محلياً على جهازك (Localhost Setup):</span>
                </div>

                <div className="space-y-3 pr-2">
                  <p className="text-slate-300">
                    <strong>الخيار 1 (الأسهل والأسرع): تشغيل PostgreSQL عبر Docker:</strong>
                  </p>
                  <div className="relative">
                    <pre className="p-3 rounded-xl bg-slate-900 font-mono text-[11px] text-cyan-300 dir-ltr text-left overflow-x-auto">
                      docker run -d --name orca-postgres -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=orca_express -p 5432:5432 postgres:16-alpine
                    </pre>
                    <button
                      onClick={() => handleCopy('docker run -d --name orca-postgres -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=orca_express -p 5432:5432 postgres:16-alpine', 'drun')}
                      className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copied === 'drun' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>نسخ</span>
                    </button>
                  </div>

                  <p className="text-slate-300">
                    <strong>الخيار 2: استخدام PostgreSQL المثبت على جهازك (أو عبر pgAdmin):</strong>
                  </p>
                  <ul className="list-disc list-inside text-slate-400 space-y-1">
                    <li>افتح pgAdmin أو أداة psql، وأنشئ قاعدة بيانات جديدة باسم: <code>CREATE DATABASE orca_express;</code></li>
                    <li>
                      في ملف <code>.env</code> بالمشروع، ضع المتغير التالي:
                      <div className="mt-1 p-2 rounded bg-slate-900 font-mono text-cyan-300 dir-ltr text-left">
                        DATABASE_URL="postgresql://postgres:your_password@localhost:5432/orca_express"
                      </div>
                    </li>
                    <li>
                      شغّل التطبيق بالأمر: <code>npm run dev</code> وسيتولى التطبيق إنشاء كافة الجداول والفهارس تلقائياً!
                    </li>
                  </ul>
                </div>
              </div>

              {/* Section 2: Cloud VPS Setup */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-black">
                    B
                  </span>
                  <span>طريقة الربط سحابياً على سيرفر VPS (Production Setup):</span>
                </div>

                <div className="space-y-3 pr-2">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="font-bold text-white">1. تثبيت PostgreSQL على سيرفر Ubuntu:</div>
                    <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-cyan-300 dir-ltr text-left space-y-1">
                      <div>sudo apt update && sudo apt install -y postgresql postgresql-contrib</div>
                      <div>sudo -u postgres psql -c "CREATE DATABASE orca_express;"</div>
                      <div>sudo -u postgres psql -c "CREATE USER orca_admin WITH ENCRYPTED PASSWORD 'StrongPassword2026!';"</div>
                      <div>sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE orca_express TO orca_admin;"</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="font-bold text-white">2. تجهيز ملف البيئة (.env) على سيرفر VPS:</div>
                    <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-cyan-300 dir-ltr text-left">
                      DATABASE_URL="postgresql://orca_admin:StrongPassword2026!@localhost:5432/orca_express"
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="font-bold text-white">3. تشغيل التطبيق بالخلفية عبر PM2:</div>
                    <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-cyan-300 dir-ltr text-left space-y-1">
                      <div>npm run build</div>
                      <div>pm2 start "node dist/server.cjs" --name "orca-system"</div>
                      <div>pm2 save && pm2 startup</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 space-y-1">
                    <div className="font-bold">✨ النسخ الاحتياطي التلقائي اليومي (Cron job):</div>
                    <p className="text-slate-300 text-[11px]">
                      يمكنك أخذ نسخة احتياطية يومية من قاعدة بيانات PostgreSQL بأمر بسيط في جدول الـ cron:
                    </p>
                    <code className="block p-1.5 rounded bg-slate-900 font-mono text-[10px] text-emerald-400 dir-ltr text-left">
                      pg_dump -U orca_admin orca_express {'>'} /backups/orca_$(date +\%F).sql
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DOCKER COMPOSE */}
          {activeTab === 'docker' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span>ملف تشغيل Docker Compose المتكامل (التطبيق + PostgreSQL 16):</span>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(
                        `version: '3.8'

services:
  # 1. خادم تطبيق أوركا إكسبريس
  orca-app:
    build: .
    container_name: orca-app
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://orca_user:orca_secret_2026@orca-postgres:5432/orca_express
    depends_on:
      orca-postgres:
        condition: service_healthy
    volumes:
      - orca-data:/app/vps-data

  # 2. قاعدة بيانات PostgreSQL الرسمية
  orca-postgres:
    image: postgres:16-alpine
    container_name: orca-postgres
    restart: always
    environment:
      POSTGRES_USER: orca_user
      POSTGRES_PASSWORD: orca_secret_2026
      POSTGRES_DB: orca_express
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orca_user -d orca_express"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  orca-data:
  pgdata:`,
                        'compose'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                  >
                    {copied === 'compose' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'compose' ? 'تم النسخ!' : 'نسخ ملف docker-compose.yml'}</span>
                  </button>
                </div>

                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300 dir-ltr text-left overflow-x-auto max-h-72">
{`version: '3.8'

services:
  # 1. خادم تطبيق أوركا إكسبريس
  orca-app:
    build: .
    container_name: orca-app
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://orca_user:orca_secret_2026@orca-postgres:5432/orca_express
    depends_on:
      orca-postgres:
        condition: service_healthy
    volumes:
      - orca-data:/app/vps-data

  # 2. قاعدة بيانات PostgreSQL الرسمية
  orca-postgres:
    image: postgres:16-alpine
    container_name: orca-postgres
    restart: always
    environment:
      POSTGRES_USER: orca_user
      POSTGRES_PASSWORD: orca_secret_2026
      POSTGRES_DB: orca_express
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orca_user -d orca_express"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  orca-data:
  pgdata:`}
                </pre>
              </div>

              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-300 leading-relaxed space-y-1">
                <strong>🚀 أمر الإطلاق بنقرة واحدة على سيرفر VPS:</strong>
                <p className="text-slate-400">
                  بمجرد وضع الكود في ملف <code>docker-compose.yml</code> على سيرفرك، نفّذ الأمر التالي:
                </p>
                <div className="p-2 rounded bg-slate-950 font-mono text-cyan-400 dir-ltr text-left">
                  docker compose up -d --build
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportConfigJson}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition"
            >
              <FileJson className="w-4 h-4 text-cyan-400" />
              <span>تصدير ملف تهيئة الفروع (.json)</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
              <span>{testing ? 'جارٍ الفحص...' : 'فحص واختبار الاتصال بالسيرفر'}</span>
            </button>

            <button
              onClick={handleSaveAndActivate}
              disabled={saving}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/20 cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{saving ? 'جارٍ الحفظ والمزامنة...' : 'حفظ وتفعيل الاتصال المباشر'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
