import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Truck,
  Plus,
  Send,
  Printer,
  CheckCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  ArrowRight,
  AlertCircle,
  FileSpreadsheet,
  ClipboardCheck,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sliders,
  Edit3,
  Pause,
  Play,
  XCircle,
  Boxes,
  RotateCcw,
} from 'lucide-react';
import { TruckManifest, Parcel } from '../types';
import { CreateManifestFullscreenModal } from './CreateManifestFullscreenModal';
import { ManifestVerificationModal } from './ManifestVerificationModal';
import { formDraftStorage } from '../utils/formDraftStorage';

export const TruckManifestsView: React.FC = () => {
  const {
    currentBranch,
    currentUser,
    branches,
    parcels,
    truckManifests,
    dispatchTruckManifest,
    pauseTruckManifest,
    cancelAndResetTruckManifest,
    markTruckArrived,
    receiveTruckManifest,
    openPrintModal,
    orphanParcels,
    orphanParcelsCount,
    rescueOrphanParcels,
    ensureServerConnected,
  } = useOrca();
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null);
  const [isManualRecoveryModalOpen, setIsManualRecoveryModalOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const draftKey = `truck_manifest_${currentBranch.id}`;
  const hasLocalDraft = useMemo(() => formDraftStorage.hasDraft(draftKey), [draftKey, isCreateOpen, isManualRecoveryModalOpen]);

  // Create & Edit Manifest Fullscreen Modal State
  const [manifestToEdit, setManifestToEdit] = useState<TruckManifest | null>(null);
  const [optionsOpenManifestId, setOptionsOpenManifestId] = useState<string | null>(null);
  const [confirmCancelManifest, setConfirmCancelManifest] = useState<TruckManifest | null>(null);
  const [confirmPauseResumeManifest, setConfirmPauseResumeManifest] = useState<{
    manifest: TruckManifest;
    action: 'pause' | 'resume';
  } | null>(null);

  const [selectedManifestForVerify, setSelectedManifestForVerify] = useState<TruckManifest | null>(null);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [manifestScope, setManifestScope] = useState<'all' | 'outbound' | 'inbound'>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'preparing' | 'dispatched' | 'received'>('all');
  const [expandedManifestIds, setExpandedManifestIds] = useState<Record<string, boolean>>({});
  const [isWarehouseStagingExpanded, setIsWarehouseStagingExpanded] = useState(false);

  // Ready parcels currently stored in the origin warehouse waiting for manifest preparation
  const warehouseReadyParcels = useMemo(() => {
    const knownManifestIds = new Set<string>();
    for (const m of truckManifests) {
      if (m.id) knownManifestIds.add(m.id);
      if (m.manifestNumber) knownManifestIds.add(m.manifestNumber);
    }
    return parcels.filter((p) => {
      // 1. Origin hub / branch matching
      const matchesOrigin =
        !currentBranch?.id ||
        p.originHubId === currentBranch.id ||
        p.originCollectionBranchId === currentBranch.id ||
        p.originBranchId === currentBranch.id ||
        (currentBranch.type === 'main_hub' &&
          branches.some(
            (b) =>
              (b.id === p.originCollectionBranchId || b.id === p.originBranchId) &&
              b.parentHubId === currentBranch.id
          ));

      if (!matchesOrigin) return false;

      // 2. In origin warehouse ready for manifest
      const isStatusReady =
        p.handlingStatus === 'received_at_hub' ||
        p.handlingStatus === 'received_at_origin_hub' ||
        p.handlingStatus === 'leftover_origin_warehouse';

      if (!isStatusReady) return false;

      // 3. Not currently loaded on a manifest
      return !p.truckManifestId || !knownManifestIds.has(p.truckManifestId);
    });
  }, [parcels, currentBranch, branches, truckManifests]);

  const toggleExpandManifest = (id: string) => {
    setExpandedManifestIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getParcelStatusBadge = (handlingStatus: string) => {
    switch (handlingStatus) {
      case 'received_at_dest':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">مستلم بالمستودع ✅</span>;
      case 'shortage_missing':
        return <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-500/50 text-[10px] font-bold animate-pulse">نقص مفقود 🚨</span>;
      case 'with_courier':
        return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold">مع الموزع 🛵</span>;
      case 'delivered':
        return <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] font-bold">تم التسليم 📦</span>;
      case 'in_transit':
        return <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">في الطريق 🚚</span>;
      case 'loaded_in_truck':
        return <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">محمل بالسيارة 🚛</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">{handlingStatus}</span>;
    }
  };

  // Scoped Truck Manifests (General Manager / Super Admin sees all branches; branch managers see related or filtered)
  const scopedManifests = useMemo(() => {
    return truckManifests.filter((m) => {
      if (isSuperAdmin || !currentBranch?.id) {
        return true;
      }

      const origId = (m.originHubId || '').trim().toLowerCase();
      const destId = (m.destinationHubId || '').trim().toLowerCase();
      const currId = (currentBranch?.id || '').trim().toLowerCase();
      const currCode = (currentBranch?.code || '').trim().toLowerCase();
      const currName = (currentBranch?.name || '').trim().toLowerCase();

      const isOutbound =
        origId === currId ||
        origId === currCode ||
        origId === currName ||
        branches.some(
          (b) =>
            (b.id?.toLowerCase() === currId || b.code?.toLowerCase() === currCode) &&
            (b.parentHubId?.toLowerCase() === origId || b.id?.toLowerCase() === origId)
        ) ||
        (currentBranch?.type === 'main_hub' &&
          branches.some(
            (b) =>
              (b.id?.toLowerCase() === origId || b.code?.toLowerCase() === origId) &&
              b.parentHubId?.toLowerCase() === currId
          ));

      const isInbound =
        destId === currId ||
        destId === currCode ||
        destId === currName ||
        branches.some(
          (b) =>
            (b.id?.toLowerCase() === currId || b.code?.toLowerCase() === currCode) &&
            (b.parentHubId?.toLowerCase() === destId || b.id?.toLowerCase() === destId)
        ) ||
        (currentBranch?.type === 'main_hub' &&
          branches.some(
            (b) =>
              (b.id?.toLowerCase() === destId || b.code?.toLowerCase() === destId) &&
              b.parentHubId?.toLowerCase() === currId
          ));

      if (manifestScope === 'outbound') return isOutbound;
      if (manifestScope === 'inbound') return isInbound;
      return isOutbound || isInbound;
    });
  }, [truckManifests, currentBranch, branches, manifestScope, isSuperAdmin]);

  // Tab Filtering on Scoped Manifests
  const filteredManifests = useMemo(() => {
    return scopedManifests.filter((m) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'dispatched') return m.status === 'dispatched' || m.status === 'arrived_unloading';
      return m.status === activeTab;
    });
  }, [scopedManifests, activeTab]);

  return (
    <div className="space-y-4 pb-20 text-slate-100 font-['Cairo',sans-serif]">
      {/* Top Header Card - Compact */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold">
              قسم الصادر • أسطول شاحنات الانطلاق
            </span>
            <h1 className="text-sm sm:text-base font-black text-white">
              مانافيست التحميل والترحيل ومغادرة الشاحنات
            </h1>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            فرع الانطلاق: {currentBranch.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* زر استعادة يدوي اختياري داخل قائمة المانافيستات */}
          <button
            type="button"
            id="btn_manual_manifest_recovery"
            onClick={() => setIsManualRecoveryModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700/80 hover:border-amber-500/50 rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition-all cursor-pointer"
            title="استعادة يدوية للمسودات أو الطرود المعلقة"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>استعادة يدوية</span>
            {(orphanParcelsCount > 0 || hasLocalDraft) && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            id="btn_open_fullscreen_manifest"
            onClick={() => {
              setManifestToEdit(null);
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-lg text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all transform active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ إنشاء مانافيست جديد</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {recoveryFeedback && (
        <div className="bg-emerald-900/90 border border-emerald-500/50 text-emerald-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-lg">
          <span>{recoveryFeedback}</span>
          <button
            type="button"
            onClick={() => setRecoveryFeedback(null)}
            className="text-emerald-400 hover:text-emerald-100 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Manual Recovery Modal (اختياري يظهر فقط عند الضغط على زر الاستعادة اليدوية) */}
      {isManualRecoveryModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">استعادة البيانات والمسودات اليدوية</h3>
                  <p className="text-[11px] text-slate-400">إجراءات يدوية لمعالجة الطرود أو استرجاع المسودات عند الحاجة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualRecoveryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {orphanParcelsCount > 0 ? (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>تم رصد ({orphanParcelsCount}) طرد معلق بالمستودع بدون مانافيست</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    هذه الطرود مسجلة بحالة تحميل لكنها غير مرتبطة بمانافيست قائم. يمكنك إعادتها لمستودع الصادر أو توليد مانافيست جديد بها:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const res = rescueOrphanParcels('release_to_outbound');
                        setRecoveryFeedback(res.message);
                        setIsManualRecoveryModalOpen(false);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تحرير الطرود وإعادتها للصادر ({orphanParcelsCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const res = rescueOrphanParcels('recreate_manifest');
                        setRecoveryFeedback(res.message);
                        setIsManualRecoveryModalOpen(false);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>توليد مانافيست جديد لها</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-slate-750 rounded-xl p-3 text-slate-300 flex items-center gap-2 text-[11px]">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>لا توجد طرود معلقة حالياً، جميع الطرود في مستودع الصادر مرتبطة بوضع سليم.</span>
                </div>
              )}

              {hasLocalDraft ? (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">مسودة مانافيست غير معتمدة محفوظة محلياً</span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">مسودة متوفرة</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    توجد مسودة غير معتمدة محفوظة على هذا المتصفح. يمكنك فتحها وإكمال الإدخال أو مسحها.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualRecoveryModalOpen(false);
                        setManifestToEdit(null);
                        setIsCreateOpen(true);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition cursor-pointer"
                    >
                      متابعة المسودة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        formDraftStorage.clearDraft(draftKey);
                        setRecoveryFeedback('تم حذف المسودة المحلية بنجاح.');
                        setIsManualRecoveryModalOpen(false);
                      }}
                      className="px-3 py-1.5 bg-slate-750 hover:bg-rose-900/50 hover:text-rose-200 text-slate-300 rounded-lg transition cursor-pointer"
                    >
                      مسح المسودة
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  لا توجد مسودات مانافيست معلقة في الذاكرة المحلية.
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-850 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsManualRecoveryModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Origin Warehouse Manifest Preparation Staging Area */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">
                  مستودع الصادر وتجهيز المانافيست
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono font-bold">
                  {warehouseReadyParcels.length} طرد جاهز بالمستودع
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                كافة الطرود المسجلة ميدانياً بواسطة الموزعين أو من الاستقبال المركزي، مودعة في مستودع الصادر ومتاحة فوراً للشحن بالمانافيست.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {warehouseReadyParcels.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setManifestToEdit(null);
                  setIsCreateOpen(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ إدراج في مانافيست الشاحنة ({warehouseReadyParcels.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsWarehouseStagingExpanded(!isWarehouseStagingExpanded)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>{isWarehouseStagingExpanded ? 'إخفاء الطرود' : 'عرض طرود المستودع'}</span>
              {isWarehouseStagingExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expanded Details Table */}
        {isWarehouseStagingExpanded && (
          <div className="mt-4 pt-3.5 border-t border-slate-800/80 animate-in fade-in space-y-2">
            {warehouseReadyParcels.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                لا توجد طرود حالياً في مستودع الصادر بانتظار تجهيز المانافيست. عند إضافة أي بوليصة من تطبيق الموزع أو الاستقبال ستظهر هنا فوراً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10.5px] text-slate-400 font-bold">
                      <th className="pb-2">رقم البوليصة</th>
                      <th className="pb-2">المرسل</th>
                      <th className="pb-2">المستلم والوجهة</th>
                      <th className="pb-2">المواصفات والوزن</th>
                      <th className="pb-2">أجور الشحن والمطلوب</th>
                      <th className="pb-2">مدخل البيانات (الموزع / الموظف)</th>
                      <th className="pb-2">حالة المستودع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {warehouseReadyParcels.map((p) => {
                      const destBranch = branches.find((b) => b.id === p.destinationHubId);
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 font-bold text-amber-300" dir="ltr">
                            {p.trackingNumber}
                          </td>
                          <td className="py-2.5 font-sans font-bold text-slate-200">
                            {p.sender.name}
                            <span className="block text-[10px] text-slate-400 font-mono">{p.sender.phone}</span>
                          </td>
                          <td className="py-2.5 font-sans">
                            <span className="font-bold text-slate-200">{p.receiver.name}</span>
                            <span className="block text-[10px] text-amber-400 font-bold">
                              📍 {destBranch?.name || destBranch?.governorate || 'الفرع الوجهة'}
                            </span>
                          </td>
                          <td className="py-2.5 font-sans text-slate-300">
                            {p.weightKg} كغ • {p.piecesCount} قطعة
                          </td>
                          <td className="py-2.5 font-sans">
                            <span className="font-bold text-emerald-400">
                              {p.paymentType === 'cod' ? `${p.totalDue} ${p.currency} (COD)` : `${p.shippingCost} ${p.currency}`}
                            </span>
                          </td>
                          <td className="py-2.5 font-sans">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                              {p.registeredByUserName || p.createdByName || 'المستخدم'}
                            </span>
                          </td>
                          <td className="py-2.5 font-sans">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                              جاهز للترحيل 📦
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scope Selector & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'all' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            كافة المانافيست ({scopedManifests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preparing')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'preparing' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            قيد التحميل والتجهيز ({scopedManifests.filter((m) => m.status === 'preparing').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dispatched')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'dispatched' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            في الطريق ورصيف التفريغ ({scopedManifests.filter((m) => m.status === 'dispatched' || m.status === 'arrived_unloading').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('received')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'received' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            تم الاستلام في الوجهة ({scopedManifests.filter((m) => m.status === 'received').length})
          </button>
        </div>

        {/* Direction Scope Filter (للفرع أو الإدارة العامة) */}
        {!isSuperAdmin && currentBranch?.id && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[11px] self-start sm:self-center">
            <button
              type="button"
              onClick={() => setManifestScope('all')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                manifestScope === 'all' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setManifestScope('outbound')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                manifestScope === 'outbound' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              شاحنات الصادر ↗
            </button>
            <button
              type="button"
              onClick={() => setManifestScope('inbound')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                manifestScope === 'inbound' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              شاحنات الوارد ↘
            </button>
          </div>
        )}
      </div>

      {/* Manifest Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredManifests.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-500 text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
            لا يوجد مانافيست شاحنات يطابق التبويب المحدد
          </div>
        ) : (
          filteredManifests.map((manifest) => {
            const orig = branches.find((b) => b.id === manifest.originHubId);
            const dest = branches.find((b) => b.id === manifest.destinationHubId);
            const isOutbound = manifest.originHubId === currentBranch.id;

            const manifestParcels = parcels.filter((p) => manifest.parcelIds.includes(p.id));
            const verifiedCount = manifestParcels.filter((p) =>
              ['received_at_dest', 'with_courier', 'delivered'].includes(p.handlingStatus)
            ).length;
            const missingCount = manifestParcels.filter(
              (p) =>
                (p.handlingStatus === 'shortage_missing' ||
                  (manifest.missingParcelIds && manifest.missingParcelIds.includes(p.id))) &&
                p.shortageStatus !== 'confirmed_at_origin' &&
                !p.isRecoveredFromPreviousShortage
            ).length;
            const isExpanded = !!expandedManifestIds[manifest.id];

            return (
              <div
                key={manifest.id}
                className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 hover:border-slate-600 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between gap-4 transition-all"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-cyan-300 font-mono">
                          {manifest.manifestNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            manifest.status === 'dispatched'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                              : manifest.status === 'received'
                              ? missingCount > 0
                                ? 'bg-rose-500/30 text-rose-200 border border-rose-500/60 font-black'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {manifest.status === 'dispatched'
                            ? 'في الطريق'
                            : manifest.status === 'paused'
                            ? 'موقوف مؤقتاً ⏸️'
                            : manifest.status === 'received'
                            ? missingCount > 0
                              ? `مفرغ بوجود نقص (${missingCount} مفقود)`
                              : 'تم الاستلام والتفريغ'
                            : 'قيد التجهيز بالمستودع'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 font-semibold mt-1">
                        {manifest.truckPlate} • {manifest.truckType}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openPrintModal('manifest_a4', manifest)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="طباعة مانافيست الشاحنة الرسمي"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة</span>
                      </button>

                      {(isOutbound || currentUser?.role === 'super_admin') && manifest.status !== 'received' && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOptionsOpenManifestId(optionsOpenManifestId === manifest.id ? null : manifest.id)}
                            className="px-2.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            title="خيارات المانافيست (تعديل، إيقاف مؤقت، إلغاء الرحلة)"
                          >
                            <Sliders className="w-3.5 h-3.5 text-amber-400" />
                            <span>خيارات المانافيست</span>
                            <ChevronDown className="w-3 h-3 text-amber-400/80" />
                          </button>

                          {optionsOpenManifestId === manifest.id && (
                            <div className="absolute left-0 top-full mt-1 z-30 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                              <div className="px-2.5 py-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400">
                                إجراءات وخيارات المانافيست
                              </div>

                              {/* 1. Edit Manifest */}
                              <button
                                type="button"
                                onClick={() => {
                                  setOptionsOpenManifestId(null);
                                  setManifestToEdit(manifest);
                                  setIsCreateOpen(true);
                                }}
                                className="w-full text-right px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-slate-800 rounded-xl flex items-center gap-2 transition cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4 text-cyan-400 shrink-0" />
                                <div>
                                  <div>تعديل المانافيست</div>
                                  <div className="text-[10px] text-slate-400 font-normal">تعديل السائق، الشاحنة، أو الطرود الحمولة</div>
                                </div>
                              </button>

                              {/* 2. Pause / Resume (متاح فقط عندما تكون الشاحنة قد انطلقت فعلاً) */}
                              {manifest.status === 'dispatched' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOptionsOpenManifestId(null);
                                    setConfirmPauseResumeManifest({ manifest, action: 'pause' });
                                  }}
                                  className="w-full text-right px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-950/40 rounded-xl flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Pause className="w-4 h-4 text-amber-400 shrink-0" />
                                  <div>
                                    <div>إيقاف مؤقت للرحلة</div>
                                    <div className="text-[10px] text-slate-400 font-normal">تعليق المانافيست مؤقتاً عند حدوث عائق على الطريق</div>
                                  </div>
                                </button>
                              ) : manifest.status === 'paused' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOptionsOpenManifestId(null);
                                    setConfirmPauseResumeManifest({ manifest, action: 'resume' });
                                  }}
                                  className="w-full text-right px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950/40 rounded-xl flex items-center gap-2 transition cursor-pointer"
                                >
                                  <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <div>
                                    <div>استئناف واستمرار الرحلة</div>
                                    <div className="text-[10px] text-slate-400 font-normal">إعادة تفعيل المانافيست ومتابعة خط السير للوجهة</div>
                                  </div>
                                </button>
                              ) : (
                                <div
                                  className="w-full text-right px-3 py-2 text-xs font-bold text-slate-500 bg-slate-950/50 rounded-xl flex items-center gap-2 cursor-not-allowed opacity-60 border border-slate-800/80"
                                  title="لا يمكن الإيقاف المؤقت إلا عندما تكون الشاحنة قد انطلقت فعلاً وفي طريق السفر"
                                >
                                  <Pause className="w-4 h-4 text-slate-600 shrink-0" />
                                  <div>
                                    <div className="text-slate-400 font-semibold">إيقاف مؤقت (غير متاح)</div>
                                    <div className="text-[9.5px] text-slate-500 font-normal">متاح فقط بعد مغادرة وانطلاق الشاحنة فعلياً</div>
                                  </div>
                                </div>
                              )}

                              {/* 3. Cancel Trip & Reset Manifest */}
                              <button
                                type="button"
                                onClick={() => {
                                  setOptionsOpenManifestId(null);
                                  setConfirmCancelManifest(manifest);
                                }}
                                className="w-full text-right px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-950/40 rounded-xl flex items-center gap-2 transition cursor-pointer"
                              >
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                <div>
                                  <div>إلغاء الرحلة وإعادة المانافيست</div>
                                  <div className="text-[10px] text-slate-400 font-normal">إلغاء الترحيل وإعادة المانافيست للتجهيز</div>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route Box */}
                  <div className="bg-slate-950/80 rounded-xl p-3 my-3 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500">مركز الانطلاق</span>
                      <span className="font-bold text-white">{orig?.name}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-cyan-400 transform rotate-180" />
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] text-slate-500">مركز الوجهة</span>
                      <span className="font-bold text-cyan-300">{dest?.name}</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">السائق:</span>
                      <span className="font-semibold">{manifest.driverName}</span>
                      <div className="text-[10px] text-slate-400 font-mono">{manifest.driverPhone}</div>
                    </div>

                    <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/80 font-mono">
                      <span className="text-[10px] text-slate-500 block font-sans">الحمولة الإجمالية:</span>
                      <span className="font-bold text-white">
                        {manifest.parcelIds.length} شحنات ({manifest.totalWeightKg} كغ)
                      </span>
                      <div className="text-[10px] text-amber-400 font-sans">
                        قطع: {manifest.totalPieces}
                      </div>
                    </div>
                  </div>

                  {/* Discharge Status Summary Banner */}
                  {manifest.status === 'received' && (
                    <div className="mt-3">
                      {missingCount > 0 || (manifest.missingParcelIds && manifest.missingParcelIds.length > 0) ? (
                        <div className="p-2.5 bg-rose-950/40 border border-rose-500/60 rounded-xl text-xs space-y-1 shadow-sm">
                          <div className="flex items-center gap-1.5 font-bold text-rose-300">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>تنبيه نقص تشغيلي عند التفرغ ({missingCount} طرد مفقود)</span>
                          </div>
                          {manifest.shortageNotes && (
                            <div className="text-[11px] text-rose-200/90 font-mono">
                              الملاحظة: {manifest.shortageNotes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs flex items-center gap-2 text-emerald-300 font-bold">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>تم التفريغ والمطابقة بنجاح بالكامل دون أي نقص ({verifiedCount} طرد واصل)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Parcel Breakdown Accordion */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => toggleExpandManifest(manifest.id)}
                      className="w-full py-2 px-3 bg-slate-950/90 hover:bg-slate-800/90 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-800 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-cyan-400" />
                        <span>عرض الشحنات وحالتها المحدثة فوراً ({manifestParcels.length})</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-emerald-400 font-bold">{verifiedCount} واصل</span>
                        {missingCount > 0 && <span className="text-rose-400 font-bold">({missingCount} مفقود)</span>}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2 p-2 bg-slate-950/90 rounded-xl border border-slate-800/90 max-h-56 overflow-y-auto">
                        {manifestParcels.map((p) => {
                          const isShortageFound = p.shortageStatus === 'confirmed_at_origin' || p.isRecoveredFromPreviousShortage;
                          const isStillMissing = p.handlingStatus === 'shortage_missing' && !isShortageFound;
                          return (
                            <div
                              key={p.id}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition ${
                                isStillMissing
                                  ? 'bg-rose-950/30 border-rose-500/60'
                                  : isShortageFound
                                  ? 'bg-emerald-950/20 border-emerald-500/40'
                                  : 'bg-slate-900 border-slate-800'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-cyan-300">{p.trackingNumber}</span>
                                  <span className="text-[10px] text-slate-400 font-semibold">({p.packageType})</span>
                                  {isShortageFound && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                      ✓ تم العثور عليه في الفرع المصدر {p.shortageResolvedAt ? `(تم الحل بتاريخ ${new Date(p.shortageResolvedAt).toLocaleDateString('ar-SY')})` : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-200">
                                  المستلم: {p.receiver.name} — {p.destinationAddress}
                                </div>
                                {p.shortageResolutionNotes && isShortageFound && (
                                  <div className="text-[10px] text-emerald-300/90 font-medium">
                                    ملاحظة الحل: {p.shortageResolutionNotes}
                                  </div>
                                )}
                                {p.shortageNote && isStillMissing && (
                                  <div className="text-[10px] text-rose-300 font-bold">
                                    ملاحظة النقص: {p.shortageNote}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0">
                                {isShortageFound ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    تم الحل بالمصدر
                                  </span>
                                ) : (
                                  getParcelStatusBadge(p.handlingStatus)
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5" dir="ltr">
                      <span className="text-slate-500 font-sans text-[10px]">Date:</span>
                      <span className="font-bold text-slate-300">
                        {new Date(manifest.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span>
                        {new Date(manifest.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    </span>

                    {/* Dispatch Button if In Origin and Status Preparing */}
                    {isOutbound && manifest.status === 'preparing' && (
                      <button
                        onClick={async () => {
                          const ok = await ensureServerConnected();
                          if (ok) dispatchTruckManifest(manifest.id);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>مغادرة السيارة وإرسال الإشعار للوجهة ◄</span>
                      </button>
                    )}

                    {manifest.status === 'dispatched' && isOutbound && (
                      <div className="text-xs text-amber-300 font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>الشاحنة في طريق السفر للوجهة</span>
                      </div>
                    )}

                    {manifest.status === 'paused' && (
                      <div className="text-xs text-amber-300 font-bold flex items-center gap-1.5 bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-500/40">
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                        <span>⏸️ رحلة المانافيست موقوفة مؤقتاً (بانتظار الاستئناف)</span>
                      </div>
                    )}

                    {manifest.status === 'arrived_unloading' && isOutbound && (
                      <div className="text-xs text-amber-300 font-bold flex items-center gap-1.5 bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-500/40 animate-pulse">
                        <Truck className="w-4 h-4 text-amber-400" />
                        <span>🚚 وصلت الشاحنة لفرع ({dest?.name || 'الوجهة'}) وتتحضر للتفريغ الآن</span>
                      </div>
                    )}

                    {manifest.status === 'received' && (
                      <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-500/40">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>
                          {isOutbound
                            ? `✅ فرغت السيارة لدى (${dest?.name || 'فرع الوجهة'}) وجاهزة للتسليم للزبائن`
                            : 'تم الاستلام والتفريغ بالوجهة بنجاح'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Destination Actions: Stage 1 & Stage 2 */}
                  {(!isOutbound || currentUser?.role === 'super_admin') && (manifest.status === 'dispatched' || manifest.status === 'arrived_unloading') && (
                    <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-2">
                      {manifest.status === 'dispatched' ? (
                        <button
                          type="button"
                          onClick={() => {
                            markTruckArrived(manifest.id);
                            setSelectedManifestForVerify(manifest);
                          }}
                          className="w-full sm:w-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                          title="المرحلة 1: تسجيل وصول الشاحنة وفتح نافذة التفريغ والمطابقة مباشرة"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>1️⃣ وصلت — ابدأ التفريغ</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedManifestForVerify(manifest)}
                          className="w-full sm:w-auto px-3 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-amber-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border border-amber-500/40"
                          title="الشاحنة برصيف التفريغ — فتح نافذة التفريغ والمطابقة"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>✓ وصلت — متابعة التفريغ</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => receiveTruckManifest(manifest.id)}
                        className="w-full sm:w-auto px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                        title="استقبال المانافيست وتفريغ كافة الشحنات فورا إلى مستودع الاستلام"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>⚡ استقبال فوري</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedManifestForVerify(manifest)}
                        className="w-full sm:flex-1 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>2️⃣ مطابقة الطرود وتأكيد التفريغ</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Fullscreen Manifest Creator & Audit Modal */}
      <CreateManifestFullscreenModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setManifestToEdit(null);
        }}
        manifestToEdit={manifestToEdit}
      />

      {/* Confirmation Modal for Canceling Trip & Resetting Manifest */}
      {confirmCancelManifest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">تأكيد إلغاء الرحلة وإعادة المانافيست</h3>
                <p className="text-[11px] text-slate-400 font-mono">{confirmCancelManifest.manifestNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              هل أنت متأكد من إلغاء رحلة الشاحنة (<strong className="text-white">{confirmCancelManifest.truckPlate}</strong>) وسحب الإشعار المروبط بها؟
              <br />
              سيتم إعادة المانافيست وكافة الطرود الحمولة ({confirmCancelManifest.parcelIds.length} طرد) إلى وضع <strong className="text-amber-400 font-bold">"قيد التجهيز بالمستودع"</strong> لتصبح قابلة للتعديل أو إعادة الترحيل لاحقاً.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmCancelManifest(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await ensureServerConnected();
                  if (!ok) return;
                  cancelAndResetTruckManifest(confirmCancelManifest.id);
                  setConfirmCancelManifest(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/20 transition cursor-pointer"
              >
                نعم، إلغاء الرحلة وإعادة المانافيست
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Alert Dialog for Pause & Resume Manifest */}
      {confirmPauseResumeManifest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            {confirmPauseResumeManifest.action === 'pause' ? (
              <>
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <Pause className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">تأكيد الإيقاف المؤقت للرحلة</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{confirmPauseResumeManifest.manifest.manifestNumber}</p>
                  </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <p>
                    هل أنت متأكد من رغبتك في <strong className="text-amber-300 font-bold">إيقاف رحلة الشاحنة ({confirmPauseResumeManifest.manifest.truckPlate}) مؤقتاً</strong>؟
                  </p>
                  <p className="text-[11px] text-slate-400 bg-amber-950/30 p-2 rounded-lg border border-amber-500/20">
                    💡 <span className="text-amber-200 font-semibold">تنبيه:</span> سيتم تعليق مسار الرحلة على النظام مؤقتاً لحين زوال العائق ومتابعة السفر، ولن يتم إرسال أي إشعار مرتبط بهذا الإجراء.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setConfirmPauseResumeManifest(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    إلغاء وتراجع
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await ensureServerConnected();
                      if (!ok) return;
                      pauseTruckManifest(confirmPauseResumeManifest.manifest.id);
                      setConfirmPauseResumeManifest(null);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-600/20 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>تأكيد الإيقاف المؤقت</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-emerald-400">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Play className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">تأكيد استئناف واستمرار الرحلة</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{confirmPauseResumeManifest.manifest.manifestNumber}</p>
                  </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <p>
                    هل أنت متأكد من <strong className="text-emerald-300 font-bold">استئناف واستمرار مسار الشاحنة ({confirmPauseResumeManifest.manifest.truckPlate})</strong>؟
                  </p>
                  <p className="text-[11px] text-slate-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-500/20">
                    🚚 <span className="text-emerald-200 font-semibold">تأكيد:</span> سيتم إعادة المانافيست لوضع "في الطريق" لمتابعة خط السير نحو فرع الوصول مباشرة دون إرسال أي إشعار.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setConfirmPauseResumeManifest(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    إلغاء وتراجع
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await ensureServerConnected();
                      if (!ok) return;
                      pauseTruckManifest(confirmPauseResumeManifest.manifest.id);
                      setConfirmPauseResumeManifest(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>تأكيد استمرار الرحلة</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Manifest Verification & Discharge Modal */}
      <ManifestVerificationModal
        isOpen={!!selectedManifestForVerify}
        manifest={selectedManifestForVerify}
        onClose={() => setSelectedManifestForVerify(null)}
      />
    </div>
  );
};
