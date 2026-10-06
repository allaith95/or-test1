import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  RotateCcw,
  Bike,
  Search,
  Package,
  ArrowRight,
  Receipt,
  AlertCircle,
  Clock,
  Check,
  CreditCard,
  Building2,
  FileText,
  Printer,
} from 'lucide-react';
import { Parcel, CourierManifest, User, Branch } from '../types';
import { useOrca } from '../context/OrcaContext';
import {
  calculateParcelReceivable,
} from '../utils/settlementMath';

interface CourierCustodySettlementModalProps {
  manifest: CourierManifest;
  courier?: User;
  currentBranch: Branch;
  parcels: Parcel[];
  onClose: () => void;
  onConfirmSettlement: (data: {
    deliveredIds: string[];
    uncollectedIds: string[];
    returnedIds: string[];
    collectedSyp: number;
    collectedUsd: number;
    uncollectedSyp: number;
    uncollectedUsd: number;
    courierCommissionSyp: number;
    netDepositedSyp: number;
    netDepositedUsd: number;
    returnReasons: Record<string, string>;
    notes: string;
  }) => void;
}

const COMMON_RETURN_REASONS = [
  'الزبون لم يرد على الاتصال',
  'طلب الزبون تأجيل موعد التسليم ليوم آخر',
  'العنوان غير دقيق أو خارج نطاق التغطية',
  'رفض الزبون استلام الشحنة',
  'لم يتوفر المبلغ المطلوب نقداً مع الزبون',
  'تم إلغاء الطلب من قبل المرسل',
  'الزبون مسافر / غير متواجد حالياً',
  'سبب آخر (ملاحظة يدوية)',
];

export const CourierCustodySettlementModal: React.FC<CourierCustodySettlementModalProps> = ({
  manifest,
  courier,
  currentBranch,
  parcels,
  onClose,
  onConfirmSettlement,
}) => {
  const { formatCurrency, ensureServerConnected } = useOrca();

  // Parcels belonging to this manifest
  const manifestParcels = useMemo(() => {
    return parcels.filter((p) => manifest.parcelIds.includes(p.id));
  }, [parcels, manifest.parcelIds]);

  // Status mapping: parcelId -> 'delivered' | 'delivered_uncollected' | 'returned'
  const [deliveryStatusMap, setDeliveryStatusMap] = useState<
    Record<string, 'delivered' | 'delivered_uncollected' | 'returned'>
  >(() => {
    const map: Record<string, 'delivered' | 'delivered_uncollected' | 'returned'> = {};
    manifestParcels.forEach((p) => {
      // If parcel is already marked delivered_uncollected, preserve it
      if (p.handlingStatus === 'delivered_uncollected' || manifest.uncollectedParcelIds?.includes(p.id)) {
        map[p.id] = 'delivered_uncollected';
      } else if (p.handlingStatus === 'delivered' || manifest.deliveredParcelIds?.includes(p.id)) {
        map[p.id] = 'delivered';
      } else if (manifest.returnedParcelIds?.includes(p.id)) {
        map[p.id] = 'returned';
      } else {
        // Default to delivered & collected
        map[p.id] = 'delivered';
      }
    });
    return map;
  });

  // Return reasons
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const [customReturnReasons, setCustomReturnReasons] = useState<Record<string, string>>({});

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'delivered_uncollected' | 'returned'>('all');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVoucherPreview, setShowVoucherPreview] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Categorize parcel IDs
  const deliveredIds = useMemo(() => {
    return manifestParcels.filter((p) => deliveryStatusMap[p.id] === 'delivered').map((p) => p.id);
  }, [manifestParcels, deliveryStatusMap]);

  const uncollectedIds = useMemo(() => {
    return manifestParcels.filter((p) => deliveryStatusMap[p.id] === 'delivered_uncollected').map((p) => p.id);
  }, [manifestParcels, deliveryStatusMap]);

  const returnedIds = useMemo(() => {
    return manifestParcels.filter((p) => deliveryStatusMap[p.id] === 'returned').map((p) => p.id);
  }, [manifestParcels, deliveryStatusMap]);

  // Filtered parcels for table display
  const filteredParcels = useMemo(() => {
    return manifestParcels.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.paperReceiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.receiver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.receiver.phone.includes(searchQuery);

      const currentStatus = deliveryStatusMap[p.id];
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'delivered' && currentStatus === 'delivered') ||
        (statusFilter === 'delivered_uncollected' && currentStatus === 'delivered_uncollected') ||
        (statusFilter === 'returned' && currentStatus === 'returned');

      return matchesSearch && matchesStatus;
    });
  }, [manifestParcels, searchQuery, statusFilter, deliveryStatusMap]);

  // Financial Totals Calculation
  const financialTotals = useMemo(() => {
    let collectedSyp = 0;
    let collectedUsd = 0;

    let uncollectedSyp = 0;
    let uncollectedUsd = 0;

    manifestParcels.forEach((p) => {
      const status = deliveryStatusMap[p.id];
      const item = calculateParcelReceivable(p);

      if (status === 'delivered') {
        if (item.currency === 'USD') {
          collectedUsd += item.totalReceivable;
        } else {
          collectedSyp += item.totalReceivable;
        }
      } else if (status === 'delivered_uncollected') {
        if (item.currency === 'USD') {
          uncollectedUsd += item.totalReceivable;
        } else {
          uncollectedSyp += item.totalReceivable;
        }
      }
    });

    return {
      collectedSyp,
      collectedUsd,
      uncollectedSyp,
      uncollectedUsd,
    };
  }, [manifestParcels, deliveryStatusMap]);

  // Quick Batch Actions
  const handleMarkAllDelivered = () => {
    const map: Record<string, 'delivered' | 'delivered_uncollected' | 'returned'> = {};
    manifestParcels.forEach((p) => {
      map[p.id] = 'delivered';
    });
    setDeliveryStatusMap(map);
  };

  const handleMarkAllUncollected = () => {
    const map: Record<string, 'delivered' | 'delivered_uncollected' | 'returned'> = {};
    manifestParcels.forEach((p) => {
      map[p.id] = 'delivered_uncollected';
    });
    setDeliveryStatusMap(map);
  };

  const handleMarkAllReturned = () => {
    const map: Record<string, 'delivered' | 'delivered_uncollected' | 'returned'> = {};
    manifestParcels.forEach((p) => {
      map[p.id] = 'returned';
      if (!returnReasons[p.id]) {
        setReturnReasons((prev) => ({ ...prev, [p.id]: 'الزبون لم يرد على الاتصال' }));
      }
    });
    setDeliveryStatusMap(map);
  };

  // Toggle Single Parcel Status
  const handleSetParcelStatus = (
    parcelId: string,
    status: 'delivered' | 'delivered_uncollected' | 'returned'
  ) => {
    setDeliveryStatusMap((prev) => ({ ...prev, [parcelId]: status }));
    if (status === 'returned' && !returnReasons[parcelId]) {
      setReturnReasons((prev) => ({ ...prev, [parcelId]: 'الزبون لم يرد على الاتصال' }));
    }
  };

  // Submit Settlement
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 0. Strict server connection check
    const isOnline = await ensureServerConnected();
    if (!isOnline) {
      // Keep settlement table and selections completely intact
      return;
    }

    // Check if returned parcels have return reasons
    const missingReasons = returnedIds.filter((id) => !returnReasons[id] && !customReturnReasons[id]);
    if (missingReasons.length > 0) {
      alert('يرجى تحديد سبب الإرجاع لجميع الطرود المرتجعة للمستودع');
      return;
    }

    const finalReasons: Record<string, string> = {};
    returnedIds.forEach((id) => {
      const r = returnReasons[id];
      if (r === 'سبب آخر (ملاحظة يدوية)' && customReturnReasons[id]) {
        finalReasons[id] = customReturnReasons[id];
      } else {
        finalReasons[id] = r || 'تعذر التسليم';
      }
    });

    setIsSubmitting(true);
    try {
      const noteParts: string[] = [];
      if (settlementNotes.trim()) noteParts.push(settlementNotes.trim());
      if (uncollectedIds.length > 0) {
        noteParts.push(`[تصفية معلقة: يتضمن ${uncollectedIds.length} طرد تسليم بدون قبض بقيمة ${formatCurrency(financialTotals.uncollectedSyp, 'SYP')}]`);
      }

      onConfirmSettlement({
        deliveredIds,
        uncollectedIds,
        returnedIds,
        collectedSyp: financialTotals.collectedSyp,
        collectedUsd: financialTotals.collectedUsd,
        uncollectedSyp: financialTotals.uncollectedSyp,
        uncollectedUsd: financialTotals.uncollectedUsd,
        courierCommissionSyp: 0,
        netDepositedSyp: financialTotals.collectedSyp,
        netDepositedUsd: financialTotals.collectedUsd,
        returnReasons: finalReasons,
        notes: noteParts.join(' - '),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreditManifest = uncollectedIds.length > 0 || financialTotals.uncollectedSyp > 0 || financialTotals.uncollectedUsd > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      
      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer shadow-sm group active:scale-95 shrink-0"
            title="رجوع إلى قائمة المنافيست (Esc)"
          >
            <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>رجوع</span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white">
                  تصفية عهدة الموزع
                </h1>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {manifest.manifestNumber}
                </span>
                {isCreditManifest ? (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>تصفية معلقة (ذمة على الموزع)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>جاهزة للإغلاق الكامل</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                <span>الموزع: <strong className="text-white">{courier?.name || 'موزع معتمد'}</strong> ({courier?.phone || '-'})</span>
                <span>•</span>
                <span>الفرع: <strong className="text-slate-300">{currentBranch.name}</strong></span>
                <span>•</span>
                <span>عدد الطرود: <strong className="text-cyan-300 font-mono">{manifestParcels.length} طرد</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowVoucherPreview(!showVoucherPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">معاينة الإشعار</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 flex items-center justify-center transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* VOUCHER PREVIEW SLIDE-DOWN */}
      {showVoucherPreview && (
        <div className="bg-slate-900 border-b border-cyan-500/30 p-4 shrink-0 animate-in slide-in-from-top-2 duration-150 shadow-2xl">
          <div className="max-w-4xl mx-auto bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">إشعار تصفية عهدة موزع</span>
                <span className="font-mono text-cyan-300 text-xs font-bold">[{manifest.manifestNumber}]</span>
              </div>
              <p className="text-[11px] text-slate-400">
                بموجب هذا الإشعار، يقر فرع ({currentBranch.name}) باستلام مبالغ مقبوضة بقيمة ({formatCurrency(financialTotals.collectedSyp, 'SYP')}){financialTotals.collectedUsd > 0 ? ` و (${formatCurrency(financialTotals.collectedUsd, 'USD')})` : ''} من الموزع ({courier?.name}).
                {isCreditManifest && ` وتبقى ذمة معلقة بقيمة (${formatCurrency(financialTotals.uncollectedSyp, 'SYP')}) لقاء (${uncollectedIds.length}) طرد مسلّم بدون قبض.`}
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة</span>
              </button>
              <button
                type="button"
                onClick={() => setShowVoucherPreview(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden p-4 sm:p-6 flex flex-col space-y-4">
        
        {/* TOOLBAR & BATCH ACTIONS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
          
          {/* Quick Batch Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 ml-1">تحديد سريع:</span>
            <button
              type="button"
              onClick={handleMarkAllDelivered}
              className="px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>تسليم وقبض الكل</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAllUncollected}
              className="px-3 py-1.5 rounded-xl bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-500/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>تسليم بدون قبض الكل</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAllReturned}
              className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>إرجاع الكل للمستودع</span>
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2 flex-1 md:max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم البوليصة، المستلم، أو الهاتف..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Pills Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل ({manifestParcels.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('delivered')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  statusFilter === 'delivered' ? 'bg-emerald-600 text-white' : 'text-emerald-400'
                }`}
              >
                وقبض ({deliveredIds.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('delivered_uncollected')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  statusFilter === 'delivered_uncollected' ? 'bg-amber-600 text-white' : 'text-amber-400'
                }`}
              >
                بدون قبض ({uncollectedIds.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('returned')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  statusFilter === 'returned' ? 'bg-rose-600 text-white' : 'text-rose-400'
                }`}
              >
                مرتجع ({returnedIds.length})
              </button>
            </div>
          </div>

        </div>

        {/* SETTLEMENT TABLE */}
        <div className="flex-1 border border-slate-800 rounded-2xl overflow-hidden shadow-inner bg-slate-950 flex flex-col min-h-0">
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 sticky top-0 z-10 text-slate-300 border-b border-slate-800 font-bold">
                <tr>
                  <th className="py-3 px-3.5 w-12 text-center">#</th>
                  <th className="py-3 px-3.5 min-w-[160px]">رقم الشحنة والبوليصة</th>
                  <th className="py-3 px-3.5 min-w-[180px]">المستلم والهاتف والعنوان</th>
                  <th className="py-3 px-3.5 min-w-[150px]">المبلغ المطلوب (COD + أجور)</th>
                  <th className="py-3 px-3.5 text-center min-w-[280px]">حالة التسليم والقبض</th>
                  <th className="py-3 px-3.5 min-w-[180px]">سبب الإرجاع (في حال تعذر التسليم)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredParcels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                      لا توجد طرود مطابقة لبحثك
                    </td>
                  </tr>
                ) : (
                  filteredParcels.map((parcel, idx) => {
                    const status = deliveryStatusMap[parcel.id] || 'delivered';
                    const receivable = calculateParcelReceivable(parcel);

                    return (
                      <tr
                        key={parcel.id}
                        className={`transition-colors ${
                          status === 'delivered'
                            ? 'hover:bg-emerald-950/20 bg-slate-900/30'
                            : status === 'delivered_uncollected'
                            ? 'hover:bg-amber-950/30 bg-amber-950/20 border-r-4 border-amber-500'
                            : 'hover:bg-rose-950/30 bg-rose-950/20 border-r-4 border-rose-500'
                        }`}
                      >
                        {/* # */}
                        <td className="py-2.5 px-3.5 text-center font-mono text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Tracking */}
                        <td className="py-2.5 px-3.5 align-middle">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-cyan-300">
                              {parcel.trackingNumber}
                            </span>
                            {parcel.paperReceiptNumber && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 font-mono font-bold border border-amber-500/40">
                                ورقي: {parcel.paperReceiptNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-1">
                            <span>{parcel.packageType || 'طرد'}</span>
                            <span>•</span>
                            <span className="font-mono">{parcel.weightKg || 1} كغ</span>
                            {parcel.contentDescription && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[140px]" title={parcel.contentDescription}>
                                  {parcel.contentDescription}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Receiver */}
                        <td className="py-2.5 px-3.5 align-middle">
                          <div className="font-bold text-white text-xs">{parcel.receiver.name}</div>
                          <div className="text-xs font-mono text-emerald-400 mt-0.5" dir="ltr">
                            📞 {parcel.receiver.phone}
                          </div>
                          {parcel.receiver.address && (
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={parcel.receiver.address}>
                              📍 {parcel.receiver.address}
                            </div>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 px-3.5 align-middle">
                          <div className="text-sm font-mono font-black text-amber-300">
                            {receivable.isPrepaidWithoutCod ? (
                              <span className="text-slate-400 text-xs">0 ل.س (خالص بالفرع)</span>
                            ) : (
                              formatCurrency(receivable.totalReceivable, receivable.currency)
                            )}
                          </div>
                          {parcel.paymentType === 'cod' && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              (COD: {formatCurrency(receivable.codDue, receivable.currency)}
                              {receivable.freightDue > 0 && ` + أجور: ${formatCurrency(receivable.freightDue, receivable.currency)}`})
                            </div>
                          )}
                        </td>

                        {/* Status Toggle Segmented Buttons */}
                        <td className="py-2.5 px-3.5 align-middle text-center">
                          <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 gap-1 shadow-inner">
                            {/* Option 1: Delivered & Collected */}
                            <button
                              type="button"
                              onClick={() => handleSetParcelStatus(parcel.id, 'delivered')}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                status === 'delivered'
                                  ? 'bg-emerald-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                              }`}
                              title="تم التسليم للزبون وقبض المبلغ نقداً"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تسليم وقبض</span>
                            </button>

                            {/* Option 2: Delivered WITHOUT Collection */}
                            <button
                              type="button"
                              onClick={() => handleSetParcelStatus(parcel.id, 'delivered_uncollected')}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                status === 'delivered_uncollected'
                                  ? 'bg-amber-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                              }`}
                              title="استلم الزبون الطرد لكن المبلغ معلق كذمة على الموزع"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>تسليم بدون قبض</span>
                            </button>

                            {/* Option 3: Returned to warehouse */}
                            <button
                              type="button"
                              onClick={() => handleSetParcelStatus(parcel.id, 'returned')}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                status === 'returned'
                                  ? 'bg-rose-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                              }`}
                              title="تعذر التسليم وإعادة الطرد للمستودع"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>مرتجع</span>
                            </button>
                          </div>
                        </td>

                        {/* Return Reason Field */}
                        <td className="py-2.5 px-3.5 align-middle">
                          {status === 'returned' ? (
                            <div className="space-y-1">
                              <select
                                value={returnReasons[parcel.id] || COMMON_RETURN_REASONS[0]}
                                onChange={(e) =>
                                  setReturnReasons((prev) => ({ ...prev, [parcel.id]: e.target.value }))
                                }
                                className="w-full bg-slate-900 border border-rose-500/60 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-rose-400"
                              >
                                {COMMON_RETURN_REASONS.map((reason) => (
                                  <option key={reason} value={reason}>
                                    {reason}
                                  </option>
                                ))}
                              </select>

                              {returnReasons[parcel.id] === 'سبب آخر (ملاحظة يدوية)' && (
                                <input
                                  type="text"
                                  placeholder="سبب الإرجاع بالتفصيل..."
                                  value={customReturnReasons[parcel.id] || ''}
                                  onChange={(e) =>
                                    setCustomReturnReasons((prev) => ({
                                      ...prev,
                                      [parcel.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full bg-slate-900 border border-rose-500/60 rounded-lg px-2.5 py-1 text-xs text-rose-200 focus:outline-none"
                                  autoFocus
                                />
                              )}
                            </div>
                          ) : status === 'delivered_uncollected' ? (
                            <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>ذمة مالية معلقة على الموزع</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>مستلم ومقبوض بالكامل</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FINANCIAL SUMMARY & ACTIONS FOOTER PANEL */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shrink-0 shadow-2xl">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Box 1: Cash Deposited to Branch */}
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>المقبوض نقداً للمستودع (الصندوق)</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  عن {deliveredIds.length} طرد مسلّم ومقبوض
                </div>
              </div>
              <div className="text-left font-mono font-black text-lg text-emerald-300">
                {formatCurrency(financialTotals.collectedSyp, 'SYP')}
                {financialTotals.collectedUsd > 0 && (
                  <div className="text-xs text-cyan-300 font-bold">
                    + {formatCurrency(financialTotals.collectedUsd, 'USD')}
                  </div>
                )}
              </div>
            </div>

            {/* Box 2: Pending Uncollected Credit on Courier */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              financialTotals.uncollectedSyp > 0
                ? 'bg-amber-950/40 border-amber-500/50'
                : 'bg-slate-950/60 border-slate-800'
            }`}>
              <div>
                <div className={`text-xs font-bold flex items-center gap-1.5 ${
                  financialTotals.uncollectedSyp > 0 ? 'text-amber-300' : 'text-slate-400'
                }`}>
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>المعلق ذمة على الموزع (بدون قبض)</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  عن {uncollectedIds.length} طرد تسليم بدون قبض
                </div>
              </div>
              <div className="text-left font-mono font-black text-lg text-amber-300">
                {formatCurrency(financialTotals.uncollectedSyp, 'SYP')}
                {financialTotals.uncollectedUsd > 0 && (
                  <div className="text-xs text-cyan-300 font-bold">
                    + {formatCurrency(financialTotals.uncollectedUsd, 'USD')}
                  </div>
                )}
              </div>
            </div>

            {/* Box 3: Returned Parcels Count */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>المرتجع للمستودع</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  إعادة إلى رف الفرع
                </div>
              </div>
              <div className="text-left font-mono font-black text-lg text-rose-300">
                {returnedIds.length} طرد
              </div>
            </div>

          </div>

          {/* Notes & Confirm Action */}
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-800">
            <input
              type="text"
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              placeholder="ملاحظات إضافية للتصفية (اختياري)..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-3 rounded-xl font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0 ${
                isCreditManifest
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isCreditManifest ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>
                    اعتماد التصفية كمستند معلق ذمة على الموزع ({formatCurrency(financialTotals.uncollectedSyp, 'SYP')}) ⏳
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد التصفية وإغلاق العهدة نهائياً ✅</span>
                </>
              )}
            </button>
          </form>

        </div>

      </div>

    </div>
  );
};
