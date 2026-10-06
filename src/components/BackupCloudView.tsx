import React, { useState } from 'react';
import { useOrca } from '../context/OrcaContext';
import { SyncAuditFullScreen } from './SyncAuditFullScreen';
import {
  Database,
  Download,
  Upload,
  RefreshCcw,
  CheckCircle,
  AlertTriangle,
  FileJson,
  Layers,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  HardDrive,
  Clock,
  Activity,
  CheckCircle2,
  Radio,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export const BackupCloudView: React.FC = () => {
  const {
    branches,
    parcels,
    currentUser,
    exportDatabaseJson,
    importDatabaseJson,
    cloudSyncState,
    timestampWorkerStats,
    triggerTimestampReconciliation,
    triggerManualCloudSync,
    pushEntireDatabaseToCloud,
    pullEntireDatabaseFromCloud,
  } = useOrca();

  const [importJsonText, setImportJsonText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isFlushingQueue, setIsFlushingQueue] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isIntegrityModalOpen, setIsIntegrityModalOpen] = useState(false);

  const handleTriggerReconcile = async () => {
    setIsReconciling(true);
    try {
      await triggerTimestampReconciliation('manual_dashboard_button');
      setStatusMessage({
        text: 'تمت مقارنة وتدقيق الطوابع الزمنية للسجلات الحساسة والصناديق وتحديثها بنجاح.',
        type: 'success',
      });
    } catch (e: any) {
      setStatusMessage({
        text: e.message || 'تعذر استكمال مقارنة الطوابع الزمنية.',
        type: 'error',
      });
    } finally {
      setIsReconciling(false);
    }
  };

  if (currentUser.role !== 'super_admin') {
    return (
      <div className="p-8 max-w-xl mx-auto text-center bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl space-y-4 my-12">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
          <Database className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">الوصول مقيد - خاص بالمدير العام حصراً</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          إدارة النسخ الاحتياطية المركزية واستعادة البيانات محصورة بالمدير العام حصراً للحفاظ على أمان وسرية بيانات منظومة أوركا.
        </p>
      </div>
    );
  }

  const handlePushAll = async () => {
    setIsPushing(true);
    setStatusMessage(null);
    try {
      const res = await pushEntireDatabaseToCloud();
      if (res.success) {
        setStatusMessage({
          text: `تمت مزامنة وحفظ ${res.count} سجلاً تشغيلياً في قاعدة البيانات بنجاح!`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.message || 'فشلت المزامنة. يرجى التحقق من حالة الاتصال.',
          type: 'error',
        });
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'حدث خطأ أثناء الاتصال بقاعدة البيانات', type: 'error' });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullAll = async () => {
    setIsPulling(true);
    setStatusMessage(null);
    try {
      const res = await pullEntireDatabaseFromCloud();
      if (res.success) {
        setStatusMessage({
          text: res.message || 'تم سحب وتحديث قاعدة البيانات بالكامل بنجاح!',
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: res.message || 'فشل سحب وتحديث البيانات.',
          type: 'error',
        });
      }
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'حدث خطأ أثناء الاستعلام من قاعدة البيانات', type: 'error' });
    } finally {
      setIsPulling(false);
    }
  };

  const handleFlushQueue = async () => {
    setIsFlushingQueue(true);
    try {
      const res = await triggerManualCloudSync();
      setStatusMessage({
        text: `تمت معالجة ${res.processed} عملية من طابور الحفظ بنجاح. المتبقي: ${res.remaining}`,
        type: 'success',
      });
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'فشلت معالجة طابور المزامنة', type: 'error' });
    } finally {
      setIsFlushingQueue(false);
    }
  };

  const handleDownloadBackup = () => {
    const dataStr = exportDatabaseJson();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orca-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMessage({
      text: 'تم تصدير النسخة الاحتياطية بنجاح بصيغة JSON القياسية!',
      type: 'success',
    });
  };

  const handleImportJson = () => {
    if (!importJsonText.trim()) return;
    const success = importDatabaseJson(importJsonText);
    if (success) {
      setStatusMessage({
        text: 'تم استيراد واستعادة قاعدة البيانات بالكامل وتحديث كافة السجلات بنجاح!',
        type: 'success',
      });
      setImportJsonText('');
    } else {
      setStatusMessage({
        text: 'فشل استيراد الملف. يرجى التأكد من صحة تنسيق JSON وهيكل البيانات.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">مركز النسخ الاحتياطي واستعادة البيانات</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Data Protection & Recovery
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تصدير النسخ الاحتياطية المشفرة، استعادة البيانات، ومزامنة السجلات المركزية دون الحاجة لأي إعدادات معقدة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsIntegrityModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-lg hover:shadow-cyan-500/20 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>مركز تدقيق المزامنة وجودة الطرود</span>
          </button>
        </div>
      </div>

      {/* Alert Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live Sync Status & Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>حالة قاعدة البيانات</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-sm font-black text-white flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                cloudSyncState.postgresConnected
                  ? 'bg-emerald-400'
                  : cloudSyncState.status === 'syncing'
                  ? 'bg-cyan-400 animate-ping'
                  : cloudSyncState.status === 'offline' || cloudSyncState.databaseBackend === 'disconnected'
                  ? 'bg-rose-500'
                  : 'bg-amber-400'
              }`}
            />
            <span>
              {cloudSyncState.postgresConnected
                ? 'PostgreSQL متصلة'
                : cloudSyncState.status === 'syncing'
                ? 'جارٍ المزامنة...'
                : cloudSyncState.status === 'offline' || cloudSyncState.databaseBackend === 'disconnected'
                ? 'غير متصل (أوفلاين)'
                : 'تخزين محلي مؤقت'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            {cloudSyncState.postgresConnected
              ? 'متصلة بقاعدة البيانات المركزية'
              : 'يعمل بالتخزين المحلي الآمن لحين ربط PostgreSQL'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>طابور الحفظ المحلي</span>
            <Radio className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-center justify-between">
            <span>{cloudSyncState.pendingQueueCount}</span>
            {cloudSyncState.pendingQueueCount > 0 && (
              <button
                onClick={handleFlushQueue}
                disabled={isFlushingQueue}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
              >
                <RefreshCcw className={`w-3 h-3 ${isFlushingQueue ? 'animate-spin' : ''}`} />
                <span>حفظ الآن</span>
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-500">عمليات محفوظة محلياً</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>إجمالي الطرود في النظام</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{parcels.length}</div>
          <div className="text-[11px] text-slate-500">سجل بوليصة وشحنة بريدية</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>إجمالي الفروع المتصلة</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono">{branches.length}</div>
          <div className="text-[11px] text-slate-500">فرع ومستودع مركزي ومحطة شحن</div>
        </div>
      </div>

      {/* Background Worker (Timestamp Reconciliation) Card */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>خدمة تدقيق الطوابع الزمنية للسجلات (Timestamp Reconciliation)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                تزامن تلقائي نشط
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              تقوم هذه الخدمة بمقارنة وتدقيق الطوابع الزمنية للبيانات المالية الحساسة (حركات الصناديق، سندات التصفية، المنافيست، والطرود) لضمان تحديث الأرصدة فوراً وبأحدث نسخة معتمدة.
            </p>
          </div>
          <button
            onClick={handleTriggerReconcile}
            disabled={isReconciling}
            className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            <span>{isReconciling ? 'جارٍ تدقيق الطوابع...' : 'تدقيق وتحديث الطوابع الزمنية الآن'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400">حالة الخدمة</div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>{timestampWorkerStats?.isActive ? 'نشط ويعمل' : 'متوقف'}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400">آخر فحص وتدقيق</div>
            <div className="text-xs font-bold text-white font-mono">
              {timestampWorkerStats?.lastRunTime
                ? new Date(timestampWorkerStats.lastRunTime).toLocaleTimeString('ar-SY')
                : 'جارٍ الفحص...'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400">إجمالي دورات الفحص</div>
            <div className="text-sm font-bold text-cyan-400 font-mono">
              {timestampWorkerStats?.totalComparisons || 0}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400">تحديثات مطبقة</div>
            <div className="text-sm font-bold text-amber-400 font-mono">
              {timestampWorkerStats?.totalReconciledRecords || 0}
            </div>
          </div>
        </div>

        {timestampWorkerStats?.lastEvent?.collectionsUpdated && timestampWorkerStats.lastEvent.collectionsUpdated.length > 0 && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              آخر سجلات تم تحديثها بناءً على الطوابع الزمنية الأحدث:{' '}
              <span className="font-mono font-bold">{timestampWorkerStats.lastEvent.collectionsUpdated.join(', ')}</span>
              {' '}— ({timestampWorkerStats.lastEvent.recordsCount} سجل)
            </span>
          </div>
        )}
      </div>

      {/* Database Synchronization Operations */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          <span>عمليات حفظ ومزامنة قاعدة البيانات</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-xs text-white">حفظ وتأكيد قاعدة البيانات بالكامل</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                تأكيد حفظ كافة الفروع والطرود والسندات في قاعدة البيانات دفعة واحدة
              </div>
            </div>
            <button
              onClick={handlePushAll}
              disabled={isPushing}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              {isPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
              <span>{isPushing ? 'جارٍ الحفظ...' : 'حفظ شامل'}</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-xs text-white">سحب واسترجاع أحدث نسخة من البيانات</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                تحديث الجلسة الحالية بآخر نسخة من قاعدة البيانات
              </div>
            </div>
            <button
              onClick={handlePullAll}
              disabled={isPulling}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50 border border-slate-700"
            >
              {isPulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4 text-amber-400" />}
              <span>{isPulling ? 'جارٍ الاسترجاع...' : 'استرجاع وتحديث'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Local JSON Backup & Restore Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">تصدير نسخة احتياطية محلية (JSON Backup)</h3>
              <p className="text-[11px] text-slate-400">حفظ نسخة احتياطية كاملة لكافة سجلات وبيانات المنظومة على جهازك</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            الملف الناتج يحتوي على جميع الفروع، الطرود، السندات، أسعار الشحن، والمستخدمين ويمكن استعادته في أي وقت على أي سيرفر أو جهاز آخر.
          </p>
          <button
            onClick={handleDownloadBackup}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
          >
            <FileJson className="w-4 h-4" />
            <span>تحميل ملف النسخة الاحتياطية (JSON)</span>
          </button>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">استيراد واستعادة قاعدة البيانات</h3>
              <p className="text-[11px] text-slate-400">لصق نص النسخة الاحتياطية لاستعادتها بالكامل</p>
            </div>
          </div>
          <textarea
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="الصق كود الـ JSON هنا لاستعادة البيانات..."
            rows={3}
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 text-white font-mono text-[11px] outline-none resize-none dir-ltr text-left"
          />
          <button
            onClick={handleImportJson}
            disabled={!importJsonText.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>استيراد واستعادة البيانات الآن</span>
          </button>
        </div>
      </div>

      {/* Sync and Parcel Integrity Hub Full-Screen */}
      <SyncAuditFullScreen
        isOpen={isIntegrityModalOpen}
        onClose={() => setIsIntegrityModalOpen(false)}
      />
    </div>
  );
};
