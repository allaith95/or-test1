import React, { useState, useMemo, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Parcel, CourierManifest, IdDocumentType } from '../types';
import {
  Truck,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Wallet,
  LogOut,
  ChevronRight,
  Building2,
  Clock,
  ArrowRight,
  PlusCircle,
  Share2,
  User,
  Boxes,
  Package,
  Printer,
  Bluetooth,
  AlertCircle,
  AlertTriangle,
  Receipt,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrcaLogo } from './OrcaLogo';
import { CourierMobileIntake } from './CourierMobileIntake';
import { CourierThermalReceiptModal } from './CourierThermalReceiptModal';
import { getParcelPaymentSummary } from '../utils/settlementMath';

export const CourierMobilePortal: React.FC = () => {
  const {
    parcels,
    courierManifests,
    currentBranch,
    currentUser,
    branches,
    deliverParcel,
    markParcelReturned,
    settleCourierManifest,
    formatCurrency,
    openPrintModal,
    getCourierIntakeFinancials,
    courierIntakeSettlements,
    openCourierIntakeVoucherPrint,
    handoverCourierParcelsToHub,
    logout,
  } = useOrca();

  // Intake cashbox financials and unsettled parcels
  const intakeFinancials = useMemo(() => {
    return getCourierIntakeFinancials(currentUser.id);
  }, [getCourierIntakeFinancials, currentUser.id, parcels]);

  // Parcels registered by this courier that are currently "with_courier" (مع المندوب للتسليم)
  const courierReadyParcels = useMemo(() => {
    return parcels.filter(
      (p) =>
        (p.createdById === currentUser.id ||
          p.collectedByCourierId === currentUser.id ||
          p.registeredByCourierName === currentUser.name ||
          p.collectedByCourierName === currentUser.name) &&
        p.handlingStatus === 'with_courier'
    );
  }, [parcels, currentUser]);

  const [handoverSuccessMsg, setHandoverSuccessMsg] = useState<string | null>(null);
  const [handoverErrorMsg, setHandoverErrorMsg] = useState<string | null>(null);

  const handleHandoverParcels = (parcelIds?: string[]) => {
    setHandoverErrorMsg(null);
    const targetIds =
      parcelIds && parcelIds.length > 0
        ? parcelIds
        : courierReadyParcels.map((p) => p.id);

    if (targetIds.length === 0) {
      setHandoverErrorMsg('لا توجد أي طرود بعهدة الموزع بانتظار التسليم حالياً.');
      setTimeout(() => setHandoverErrorMsg(null), 5000);
      return;
    }

    const updated = handoverCourierParcelsToHub(targetIds);
    if (updated.length > 0) {
      setHandoverSuccessMsg(
        `✓ تم تسليم (${updated.length}) طرود جاهزة للشحن للمركز بنجاح! تحولت حالتها إلى "بمركز الانطلاق (جاهز للشحن)" وأصبحت جاهزة للتحميل في المانافيست.`
      );
      setTimeout(() => {
        setHandoverSuccessMsg(null);
      }, 7000);
    } else {
      setHandoverErrorMsg('تعذر تسليم الطرود للمركز، يرجى التحقق من حالة الطرود والمحاولة مجدداً.');
      setTimeout(() => setHandoverErrorMsg(null), 5000);
    }
  };

  const courierVouchers = useMemo(() => {
    return courierIntakeSettlements.filter((s) => s.courierId === currentUser.id);
  }, [courierIntakeSettlements, currentUser.id]);

  // Settlement View Sub-Tab
  const [settlementTab, setSettlementTab] = useState<'intake_cashbox' | 'delivery_custody'>('intake_cashbox');

  // Strictly resolve the courier's assigned branch exclusively from database without any default/demo fallback
  const courierAssignedBranch = useMemo(() => {
    if (currentUser?.branchId) {
      const found = branches.find((b) => b.id === currentUser.branchId);
      if (found) return found;
    }
    // Only if super_admin is inspecting the portal and has chosen a branch:
    if (currentUser?.role === 'super_admin' && currentBranch && currentBranch.id && currentBranch.id !== 'all_branches') {
      return currentBranch;
    }
    return null;
  }, [currentUser?.branchId, currentUser?.role, branches, currentBranch]);

  // =========================================================================
  // VIEW NAVIGATION STATE: 'home' (The 2 Primary Icons) | 'intake' | 'manifest' | 'settlement'
  // =========================================================================
  const [currentView, setCurrentView] = useState<'home' | 'intake' | 'manifest' | 'settlement'>('home');

  // Filter & Search State for Manifest Delivery
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'delivered' | 'returned'>('pending');

  // Modal State for Delivery & Returns
  const [selectedParcelForDelivery, setSelectedParcelForDelivery] = useState<Parcel | null>(null);
  const [selectedParcelForReturn, setSelectedParcelForReturn] = useState<Parcel | null>(null);
  const [showTodayParcelsModal, setShowTodayParcelsModal] = useState(false);
  const [thermalPrintParcel, setThermalPrintParcel] = useState<Parcel | null>(null);
  const [thermalAutoBluetooth, setThermalAutoBluetooth] = useState(false);

  // Delivery Form State
  const [actualReceiverName, setActualReceiverName] = useState('');
  const [receiverRelation, setReceiverRelation] = useState('المستلم بالذات');
  const [idType, setIdType] = useState<IdDocumentType>('syrian');
  const [nationalId, setNationalId] = useState('');
  const [nationalIdPhotoUrl, setNationalIdPhotoUrl] = useState('');
  const [nationalIdBackPhotoUrl, setNationalIdBackPhotoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [collectedSyp, setCollectedSyp] = useState<number>(0);
  const [collectedUsd, setCollectedUsd] = useState<number>(0);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryErrorNotice, setDeliveryErrorNotice] = useState<string | null>(null);

  // Return Form State
  const [selectedReturnReason, setSelectedReturnReason] = useState<string>('الزبون رفض استلام الشحنة');
  const [customReturnNotes, setCustomReturnNotes] = useState('');

  // Settlement Form State
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSettlingSubmitted, setIsSettlingSubmitted] = useState(false);

  // Quick preset return reasons
  const RETURN_REASONS = [
    '🚫 الزبون رفض استلام الشحنة',
    '📞 رقم الهاتف مغلق أو لا يجيب',
    '📍 العنوان غير دقيق / خارج نطاق التوزيع',
    '⏰ طلب الزبون تأجيل التسليم لموعد آخر',
    '💵 عدم توفر المبلغ المطلوب مع المستلم',
    '📝 سبب آخر (ملاحظة مخصصة)',
  ];

  // =========================================================================
  // MANIFEST DELIVERIES COMPUTATIONS & LOGIC
  // =========================================================================
  const courierActiveManifests = useMemo(() => {
    return courierManifests.filter((m) => {
      const isForCourier =
        m.courierId === currentUser.id ||
        currentUser.role === 'super_admin' ||
        currentUser.role === 'hub_manager';
      return isForCourier && (m.status === 'active' || m.status === 'courier_credit');
    });
  }, [courierManifests, currentUser]);

  const [selectedManifestId, setSelectedManifestId] = useState<string>('');

  // Synchronize selected manifest
  useEffect(() => {
    if (courierActiveManifests.length > 0) {
      if (!selectedManifestId || !courierActiveManifests.some((m) => m.id === selectedManifestId)) {
        setSelectedManifestId(courierActiveManifests[0].id);
      }
    } else {
      setSelectedManifestId('');
    }
  }, [courierActiveManifests, selectedManifestId]);

  const primaryActiveManifest = useMemo(() => {
    if (!selectedManifestId) return courierActiveManifests[0] || null;
    return courierActiveManifests.find((m) => m.id === selectedManifestId) || courierActiveManifests[0] || null;
  }, [courierActiveManifests, selectedManifestId]);

  // Courier Assigned Parcels: from active manifest
  const courierParcels = useMemo(() => {
    if (!primaryActiveManifest) return [];
    return parcels.filter((p) => primaryActiveManifest.parcelIds.includes(p.id));
  }, [parcels, primaryActiveManifest]);

  // Parcels registered today by this courier
  const courierIntakeTodayParcels = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return parcels.filter(
      (p) =>
        (p.createdById === currentUser.id ||
          p.registeredByCourierName === currentUser.name) &&
        (p.createdAt || '').startsWith(today)
    );
  }, [parcels, currentUser]);

  const courierIntakeTodayCount = courierIntakeTodayParcels.length;

  // Filtered Parcels for Mobile Display
  const filteredParcels = useMemo(() => {
    return courierParcels.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.trackingNumber.toLowerCase().includes(q) ||
        p.receiver.name.toLowerCase().includes(q) ||
        p.receiver.phone.includes(q) ||
        p.destinationAddress.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (taskFilter === 'pending') {
        return p.handlingStatus === 'with_courier' || p.handlingStatus === 'received_at_dest';
      }
      if (taskFilter === 'delivered') {
        return p.handlingStatus === 'delivered';
      }
      if (taskFilter === 'returned') {
        return p.handlingStatus === 'returned' || p.handlingStatus === 'returned_received_at_branch';
      }

      return true;
    });
  }, [courierParcels, searchQuery, taskFilter]);

  // Financial Custody Calculations for Active Manifest
  const manifestFinancials = useMemo(() => {
    if (!primaryActiveManifest) {
      return {
        totalParcelsCount: 0,
        deliveredCount: 0,
        returnedCount: 0,
        pendingCount: 0,
        collectedSyp: 0,
        collectedUsd: 0,
      };
    }

    const assignedParcels = parcels.filter((p) => primaryActiveManifest.parcelIds.includes(p.id));
    const delivered = assignedParcels.filter((p) => p.handlingStatus === 'delivered');
    const returned = assignedParcels.filter(
      (p) => p.handlingStatus === 'returned' || p.handlingStatus === 'returned_received_at_branch'
    );
    const pending = assignedParcels.filter(
      (p) => p.handlingStatus !== 'delivered' && p.handlingStatus !== 'returned' && p.handlingStatus !== 'returned_received_at_branch'
    );

    let collectedSyp = 0;
    let collectedUsd = 0;

    delivered.forEach((p) => {
      if (p.collectedSyp && p.collectedSyp > 0) {
        collectedSyp += p.collectedSyp;
      } else if (p.currency === 'SYP') {
        collectedSyp += p.collectedAmount || p.totalDue;
      }

      if (p.collectedUsd && p.collectedUsd > 0) {
        collectedUsd += p.collectedUsd;
      } else if (p.currency === 'USD') {
        collectedUsd += p.collectedAmount || p.totalDue;
      }
    });

    return {
      totalParcelsCount: assignedParcels.length,
      deliveredCount: delivered.length,
      returnedCount: returned.length,
      pendingCount: pending.length,
      collectedSyp,
      collectedUsd,
    };
  }, [primaryActiveManifest, parcels]);

  // Handle Opening Delivery Modal
  const handleOpenDeliveryModal = (parcel: Parcel) => {
    setSelectedParcelForDelivery(parcel);
    setActualReceiverName(parcel.receiver.name || '');
    setReceiverRelation('المستلم بالذات');
    setIdType(parcel.receiver.idType || 'syrian');
    setNationalId(parcel.receiver.nationalId || '');
    setNationalIdPhotoUrl(parcel.receiver.nationalIdPhotoUrl || '');
    setNationalIdBackPhotoUrl((parcel.receiver as any).nationalIdBackPhotoUrl || '');
    setSignatureUrl(parcel.receiver.signatureUrl || '');

    if (parcel.currency === 'SYP') {
      setCollectedSyp(parcel.totalDue);
      setCollectedUsd(0);
    } else {
      setCollectedSyp(0);
      setCollectedUsd(parcel.totalDue);
    }
    setDeliveryNotes('');
  };

  // Confirm Parcel Delivery Action
  const handleConfirmDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParcelForDelivery) return;

    const res = deliverParcel(
      selectedParcelForDelivery.id,
      nationalId,
      nationalIdPhotoUrl,
      collectedSyp + collectedUsd,
      deliveryNotes,
      {
        actualReceiverName,
        receiverRelation,
        idType,
        idBackPhotoUrl: nationalIdBackPhotoUrl,
        signatureUrl,
        collectedSyp,
        collectedUsd,
      }
    );

    if (res && res.success === false) {
      setDeliveryErrorNotice(res.error || 'تعذر تسليم الطرد');
      return;
    }

    setDeliveryErrorNotice(null);
    setSelectedParcelForDelivery(null);
  };

  // Confirm Return Action
  const handleConfirmReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParcelForReturn) return;

    const finalReason =
      selectedReturnReason === '📝 سبب آخر (ملاحظة مخصصة)'
        ? customReturnNotes || 'سبب غير محدد'
        : selectedReturnReason;

    markParcelReturned(selectedParcelForReturn.id, finalReason, customReturnNotes);
    setSelectedParcelForReturn(null);
  };

  // Submit Settlement Request to Branch Cashier
  const handleRequestSettlement = () => {
    if (!primaryActiveManifest) return;

    const deliveredIds = parcels
      .filter((p) => primaryActiveManifest.parcelIds.includes(p.id) && p.handlingStatus === 'delivered')
      .map((p) => p.id);

    const returnedIds = parcels
      .filter((p) => primaryActiveManifest.parcelIds.includes(p.id) && p.handlingStatus === 'returned')
      .map((p) => p.id);

    settleCourierManifest(primaryActiveManifest.id, deliveredIds, returnedIds, {
      collectedSyp: manifestFinancials.collectedSyp,
      collectedUsd: manifestFinancials.collectedUsd,
      courierCommissionSyp: 0,
      netDepositedSyp: manifestFinancials.collectedSyp,
      netDepositedUsd: manifestFinancials.collectedUsd,
      notes: settlementNotes,
    });

    setIsSettlingSubmitted(true);
    setTimeout(() => setIsSettlingSubmitted(false), 3000);
  };

  // Live Clock (24h format for Damascus timezone)
  const [liveTime, setLiveTime] = useState('');
  useEffect(() => {
    const updateClock = () => {
      setLiveTime(
        new Intl.DateTimeFormat('ar-SY', {
          timeZone: 'Asia/Damascus',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date())
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="courier_mobile_app_root"
      className="w-full max-w-lg mx-auto min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif] relative select-none shadow-2xl border-x border-slate-800"
      dir="rtl"
    >
      {/* ========================================================================= */}
      {/* UNIFIED COURIER HEADER: [👤 علي المحمدي • فرع دمشق • 14:32]                 */}
      {/* ========================================================================= */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-3 py-2.5 sticky top-0 z-40 backdrop-blur-xl shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          {currentView !== 'home' ? (
            <button
              onClick={() => setCurrentView('home')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700 transition active:scale-95 flex items-center gap-1 text-xs font-bold cursor-pointer shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
              <span>الرئيسية</span>
            </button>
          ) : (
            <div className="w-7 h-7 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Single-line header: 12px, gray, concise [User • Branch • 14:32] */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
            <span className="font-bold text-white truncate max-w-[130px] sm:max-w-[160px]">
              {currentUser.name}
            </span>
            <span className="text-slate-600 font-bold">•</span>
            <span className="text-amber-300 font-medium truncate max-w-[120px]">
              {courierAssignedBranch ? courierAssignedBranch.name : 'فرع غير محدد'}
            </span>
            <span className="text-slate-600 font-bold">•</span>
            <span className="text-slate-400 font-mono text-[11px] shrink-0">
              {liveTime}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {currentView === 'manifest' && (
            <button
              onClick={() => {
                setSettlementTab('delivery_custody');
                setCurrentView('settlement');
              }}
              className="p-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-xl border border-amber-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="تسوية العهدة"
            >
              <Wallet className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm('هل تريد بالتأكيد تسجيل الخروج وقفل الجلسة؟')) {
                logout();
              }
            }}
            className="p-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 rounded-xl border border-slate-700 transition active:scale-95 cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: (A) HOME (2 ICONS) | (B) INTAKE FORM | (C) MANIFEST VIEW  */}
      {/* ========================================================================= */}
      <main className="flex-1 p-3.5 overflow-y-auto">
        
        {/* ======================================================================= */}
        {/* VIEW A: THE 2 PRIMARY ACTION CARDS (الشاشة الرئيسية للموزع v2)          */}
        {/* ======================================================================= */}
        {currentView === 'home' && (
          <div className="space-y-3.5 py-1">
            
            {/* Feedback Alerts for Handover */}
            {handoverSuccessMsg && (
              <div className="bg-emerald-950/80 border-2 border-emerald-500/60 rounded-2xl p-3 text-xs text-emerald-200 font-bold flex items-center justify-between shadow-xl animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{handoverSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHandoverSuccessMsg(null)}
                  className="text-slate-400 hover:text-white px-1.5 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {handoverErrorMsg && (
              <div className="bg-rose-950/80 border-2 border-rose-500/60 rounded-2xl p-3 text-xs text-rose-200 font-bold flex items-center justify-between shadow-xl animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{handoverErrorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setHandoverErrorMsg(null)}
                  className="text-slate-400 hover:text-white px-1.5 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* THE TWO PRIMARY HERO ACTION BUTTONS (Hero Action Cards)            */}
            {/* ------------------------------------------------------------------- */}
            <div className="grid grid-cols-1 gap-3">
              
              {/* PRIMARY BUTTON 1: 📦 تسجيل طرد جديد */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentView('intake')}
                className="w-full h-24 bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-slate-900 border-2 border-amber-400/60 hover:border-amber-400 rounded-3xl p-4 text-right transition-all shadow-[0_8px_30px_rgba(245,186,19,0.15)] relative overflow-hidden group cursor-pointer flex items-center justify-between"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

                <div className="flex items-center gap-3.5 z-10">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0 group-hover:rotate-3 transition-transform">
                    <Package className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                      تسجيل طرد جديد
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-bold text-amber-300">
                        {courierIntakeTodayCount} طرد سُجّل اليوم
                      </span>
                      <span className="text-slate-500 text-[10px]">•</span>
                      <span className="text-[10px] text-slate-400 font-medium">استلام وتوثيق</span>
                    </div>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0 group-hover:-translate-x-1 transition-transform z-10">
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </div>
              </motion.button>

              {/* PRIMARY BUTTON 2: 🚚 تسليم وتوزيع الطرود */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentView('manifest')}
                className="w-full h-24 bg-gradient-to-r from-emerald-500/15 via-slate-900/90 to-slate-900 border-2 border-emerald-400/60 hover:border-emerald-400 rounded-3xl p-4 text-right transition-all shadow-[0_8px_30px_rgba(16,185,129,0.15)] relative overflow-hidden group cursor-pointer flex items-center justify-between"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />

                <div className="flex items-center gap-3.5 z-10">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0 group-hover:-rotate-3 transition-transform">
                    <Truck className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                      تسليم وتوزيع الطرود
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      {manifestFinancials.pendingCount > 0 ? (
                        <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {manifestFinancials.pendingCount} بانتظار التسليم
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400">
                          لا توجد مهام توزيع معلقة
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-xl bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center text-emerald-400 shrink-0 group-hover:-translate-x-1 transition-transform z-10">
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </div>
              </motion.button>

            </div>

            {/* ------------------------------------------------------------------- */}
            {/* COMPACT INTERACTIVE 2x2 METRIC GRID (ملخص الوردية والصناديق)       */}
            {/* ------------------------------------------------------------------- */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-400 px-1 flex items-center justify-between">
                <span>ملخص الوردية والصناديق المالية:</span>
                <span className="text-[9.5px] text-slate-500">انقر على أي بطاقة للتفاصيل</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Cell 1: طرود مسجلة اليوم */}
                <div
                  onClick={() => setShowTodayParcelsModal(true)}
                  className="bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-amber-400/40 rounded-2xl p-3 shadow-md backdrop-blur-md cursor-pointer transition-all duration-150 active:scale-[0.98] group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] font-bold text-slate-400 group-hover:text-amber-300 transition-colors">طرود اليوم</span>
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="font-mono text-base font-black text-amber-300">
                    {courierIntakeTodayCount} <span className="text-xs font-sans text-slate-400">طرد</span>
                  </div>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5 truncate">
                    {courierReadyParcels.length > 0 ? `${courierReadyParcels.length} بعهدتك` : 'كلها مسلّمة للمركز'}
                  </span>
                </div>

                {/* Cell 2: رصيد مقبوضات الاستلام */}
                <div
                  onClick={() => {
                    setSettlementTab('intake_cashbox');
                    setCurrentView('settlement');
                  }}
                  className="bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-amber-400/40 rounded-2xl p-3 shadow-md backdrop-blur-md cursor-pointer transition-all duration-150 active:scale-[0.98] group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] font-bold text-slate-400 group-hover:text-amber-300 transition-colors">مقبوضات الاستلام</span>
                    <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="font-mono text-sm font-black text-amber-300 truncate">
                    {formatCurrency(intakeFinancials.totalPrepaidSyp, 'SYP')}
                  </div>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5 truncate">
                    {intakeFinancials.unsettledParcels.length} طرود قيد التوريد
                  </span>
                </div>

                {/* Cell 3: مهام التوزيع */}
                <div
                  onClick={() => {
                    setTaskFilter('pending');
                    setCurrentView('manifest');
                  }}
                  className="bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-emerald-400/40 rounded-2xl p-3 shadow-md backdrop-blur-md cursor-pointer transition-all duration-150 active:scale-[0.98] group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] font-bold text-slate-400 group-hover:text-emerald-300 transition-colors">مهام التوزيع</span>
                    <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="font-mono text-sm font-black text-emerald-300">
                    {manifestFinancials.pendingCount} <span className="text-xs text-slate-400 font-sans">متبقي</span>
                  </div>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5 truncate">
                    {manifestFinancials.deliveredCount} مسلّم بنجاح
                  </span>
                </div>

                {/* Cell 4: متحصلات COD */}
                <div
                  onClick={() => {
                    setSettlementTab('delivery_custody');
                    setCurrentView('settlement');
                  }}
                  className="bg-slate-900/80 hover:bg-slate-850/90 border border-slate-800 hover:border-emerald-400/40 rounded-2xl p-3 shadow-md backdrop-blur-md cursor-pointer transition-all duration-150 active:scale-[0.98] group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] font-bold text-slate-400 group-hover:text-emerald-300 transition-colors">تحصيلات COD</span>
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="font-mono text-sm font-black text-emerald-300 truncate">
                    {formatCurrency(manifestFinancials.collectedSyp, 'SYP')}
                  </div>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5 truncate">
                    تصفية العهدة ➔
                  </span>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* CONTEXTUAL HUB HANDOVER CAPSULE BUTTON (يظهر فقط عند وجود طرود)    */}
            {/* ------------------------------------------------------------------- */}
            {courierReadyParcels.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleHandoverParcels(courierReadyParcels.map((p) => p.id))}
                  className="w-full h-12 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>تسليم الطرود للمركز ({courierReadyParcels.length} بعهدتك)</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* ======================================================================= */}
        {/* VIEW B: MOBILE PARCEL INTAKE (تسجيل طرد جديد عبر الجوال بكامل الحقول)   */}
        {/* ======================================================================= */}
        {currentView === 'intake' && (
          <CourierMobileIntake onBack={() => setCurrentView('home')} />
        )}

        {/* ======================================================================= */}
        {/* VIEW C: MANIFEST DELIVERIES (مانافيست التوزيع والتسليم الفعلي)           */}
        {/* ======================================================================= */}
        {currentView === 'manifest' && (
          <div className="space-y-4">
            
            {/* Active Manifest Selector & Stats */}
            <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-3xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-black text-white">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  <span>المانافيست النشط:</span>
                </div>
                <button
                  onClick={() => setCurrentView('settlement')}
                  className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-[11px] hover:bg-amber-500/30 transition cursor-pointer"
                >
                  تسوية العهدة ({formatCurrency(manifestFinancials.collectedSyp, 'SYP')})
                </button>
              </div>

              {/* Manifest Selector if multiple */}
              {courierActiveManifests.length > 1 && (
                <div>
                  <select
                    value={selectedManifestId}
                    onChange={(e) => setSelectedManifestId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                  >
                    {courierActiveManifests.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.manifestNumber} ({m.parcelIds.length} طرد)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Stats Counters */}
              <div className="grid grid-cols-4 gap-1.5 pt-1 text-center font-mono">
                <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">الإجمالي</span>
                  <span className="text-sm font-black text-white">{manifestFinancials.totalParcelsCount}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-amber-400 block">جاهز</span>
                  <span className="text-sm font-black text-amber-400">{manifestFinancials.pendingCount}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-emerald-400 block">تم التسليم</span>
                  <span className="text-sm font-black text-emerald-400">{manifestFinancials.deliveredCount}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-rose-400 block">مرتجع</span>
                  <span className="text-sm font-black text-rose-400">{manifestFinancials.returnedCount}</span>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، الهاتف، البوليصة أو العنوان..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-4 gap-1">
                {(['pending', 'all', 'delivered', 'returned'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTaskFilter(tab)}
                    className={`py-2 rounded-xl text-xs font-bold transition ${
                      taskFilter === tab
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    {tab === 'pending'
                      ? 'قيد التسليم'
                      : tab === 'all'
                      ? 'الكل'
                      : tab === 'delivered'
                      ? 'المُسلَّمة'
                      : 'المرتجعة'}
                  </button>
                ))}
              </div>
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {filteredParcels.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
                  <Boxes className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">لا توجد طرود مطابقة في هذا التصنيف</p>
                </div>
              ) : (
                filteredParcels.map((parcel) => {
                  const isDelivered = parcel.handlingStatus === 'delivered';
                  const isReturnedPending = parcel.handlingStatus === 'returned';
                  const isReturnedReceived = parcel.handlingStatus === 'returned_received_at_branch';
                  const isReturned = isReturnedPending || isReturnedReceived;

                  return (
                    <motion.div
                      key={parcel.id}
                      layout
                      className={`bg-slate-900/90 border rounded-3xl p-4 shadow-lg space-y-3 transition-all ${
                        isDelivered
                          ? 'border-emerald-500/30 opacity-75'
                          : isReturnedReceived
                          ? 'border-blue-500/30 opacity-75'
                          : isReturnedPending
                          ? 'border-rose-500/30 opacity-75'
                          : 'border-slate-800 hover:border-amber-500/40'
                      }`}
                    >
                      {/* Parcel Header */}
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-amber-400" />
                          <span className="font-mono text-xs font-black text-white" dir="ltr">
                            {parcel.trackingNumber}
                          </span>
                        </div>
                        {isDelivered ? (
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> تم التسليم
                          </span>
                        ) : isReturnedPending ? (
                          <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> مرتجع - بانتظار تسليمه للفرع
                          </span>
                        ) : isReturnedReceived ? (
                          <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> مرتجع - تم استلامه من الفرع ✓
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> جاهز للتسليم
                          </span>
                        )}
                      </div>

                      {/* Receiver & Location Details */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-slate-200">
                            <User className="w-3.5 h-3.5 text-amber-400" />
                            <span>{parcel.receiver.name}</span>
                          </div>
                          <a
                            href={`tel:${parcel.receiver.phone}`}
                            className="text-emerald-400 hover:text-emerald-300 font-mono text-[11px] flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                            dir="ltr"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{parcel.receiver.phone}</span>
                          </a>
                        </div>

                        <div className="flex items-start gap-1.5 text-slate-400 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>{parcel.destinationAddress || parcel.receiver.address || 'مركز الفرع'}</span>
                        </div>
                      </div>

                      {/* Financial Amount Banner */}
                      <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">المطلوب تحصيله:</span>
                          <span className="text-[10px] text-slate-400">
                            {parcel.paymentType === 'prepaid' ? 'مدفوع سلفاً' : 'تحصيل نقدي عند الباب'}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="font-mono text-xs sm:text-sm font-black text-emerald-400">
                            {getParcelPaymentSummary(parcel).summaryDueText}
                          </span>
                        </div>
                      </div>

                      {/* Thermal Receipt & Waybill Print Quick Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setThermalAutoBluetooth(true);
                              setThermalPrintParcel(parcel);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                            title="طباعة حرارية مباشرة عبر البلوتوث"
                          >
                            <Bluetooth className="w-3.5 h-3.5" />
                            <span>طباعة حرارية (بلوتوث)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openPrintModal('parcel_3part', parcel)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                            title="طباعة البوليصة الورقية A4"
                          >
                            <Printer className="w-3.5 h-3.5 text-cyan-400" />
                            <span>بوليصة A4</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setThermalAutoBluetooth(false);
                            setThermalPrintParcel(parcel);
                          }}
                          className="text-[10px] text-slate-400 hover:text-amber-400 underline cursor-pointer"
                        >
                          معاينة الإيصال
                        </button>
                      </div>

                      {/* Action Buttons for Pending Parcels */}
                      {!isDelivered && !isReturned && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => handleOpenDeliveryModal(parcel)}
                            className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تسليم وقبض</span>
                          </button>

                          <button
                            onClick={() => setSelectedParcelForReturn(parcel)}
                            className="py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4 text-rose-400" />
                            <span>إرجاع الطرد</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ======================================================================= */}
        {/* ======================================================================= */}
        {/* VIEW D: COURIER FINANCIAL SETTLEMENT VIEW (تسوية وترصيد صناديق الموزع)    */}
        {/* ======================================================================= */}
        {currentView === 'settlement' && (
          <div className="space-y-4">
            
            {/* Top Sub-Tabs to Switch Between the Two Isolated Cashboxes */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSettlementTab('intake_cashbox')}
                className={`py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  settlementTab === 'intake_cashbox'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>مقبوضات تسجيل الطرود ({intakeFinancials.unsettledParcels.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSettlementTab('delivery_custody')}
                className={`py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  settlementTab === 'delivery_custody'
                    ? 'bg-emerald-600 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>عهدة التوزيع (COD)</span>
              </button>
            </div>

            {/* TAB 1: صندوق مقبوضات تسجيل الطرود (Intake & Prepaid Cashbox) */}
            {settlementTab === 'intake_cashbox' && (
              <div className="space-y-3">
                {/* Financial Summary Card */}
                <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-3xl p-4 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-white">صندوق مقبوضات تسجيل الطرود</h3>
                        <span className="text-[10px] text-amber-400 font-mono">
                          {intakeFinancials.unsettledParcels.length} طرود مسجلة بانتظار التوريد
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9.5px] font-bold text-amber-300">
                      معزول عن التوزيع
                    </span>
                  </div>

                  {/* Amounts Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">مقبوضات سلفاً (ل.س):</span>
                      <span className="font-mono text-base font-black text-amber-300">
                        {formatCurrency(intakeFinancials.totalPrepaidSyp, 'SYP')}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">مقبوضات سلفاً ($):</span>
                      <span className="font-mono text-base font-black text-emerald-400">
                        {formatCurrency(intakeFinancials.totalPrepaidUsd, 'USD')}
                      </span>
                    </div>
                  </div>

                  {/* Flow Notice */}
                  <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-amber-300">منهجية الترصيد المدمج عند العودة للفرع:</span>
                      عند وصولك لفرع الانطلاق، يقوم مدقق المستودع / أمين الصندوق بفحص طرودك ومسح الباركودات في شاشة التدقيق المدمج واستلام الطرود والمبالغ معاً وإصدار سند ترصيد رسمي فوري.
                    </div>
                  </div>
                </div>

                {/* Unsettled Parcels List */}
                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-lg space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-amber-400" />
                      <span>الطرود المسجلة قيد التسليم للمركز ({intakeFinancials.unsettledParcels.length})</span>
                    </span>
                  </div>

                  {intakeFinancials.unsettledParcels.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1.5 opacity-80" />
                      <span>جميع الطرود المسجلة ميدانياً تم تدقيقها وتوريدها للفرع بنجاح.</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {intakeFinancials.unsettledParcels.map((parcel) => {
                        const isPrepaid =
                          parcel.paymentType === 'prepaid' ||
                          (parcel.paymentType === 'cod' && parcel.codShippingPayer === 'sender');
                        return (
                          <div
                            key={parcel.id}
                            className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 text-xs flex items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5 truncate">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-amber-300">{parcel.trackingNumber}</span>
                                {parcel.paperReceiptNumber && (
                                  <span className="text-[9.5px] text-slate-500 font-mono">
                                    ({parcel.paperReceiptNumber})
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                <span>المرسل: {parcel.sender.name}</span> • <span>المستلم: {parcel.receiver.name}</span>
                              </div>
                            </div>

                            <div className="text-left shrink-0">
                              <span
                                className={`text-[10px] font-bold block ${
                                  isPrepaid ? 'text-amber-300' : 'text-slate-400'
                                }`}
                              >
                                {isPrepaid ? formatCurrency(parcel.shippingCost, parcel.currency) : 'تحصيل وجهة'}
                              </span>
                              <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-bold">
                                بانتظار التسليم
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Previous Intake Settlement Vouchers */}
                {courierVouchers.length > 0 && (
                  <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-lg space-y-3">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>سندات التوريد والترصيد السابقة ({courierVouchers.length})</span>
                    </span>

                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {courierVouchers.map((voucher) => (
                        <div
                          key={voucher.id}
                          className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-emerald-400 block">{voucher.voucherNumber}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(voucher.timestamp).toLocaleDateString('ar-SY')} • {voucher.parcelsCount} طرود
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-left">
                              <span className="font-mono font-black text-white text-xs block">
                                {formatCurrency(voucher.totalPrepaidSyp, 'SYP')}
                              </span>
                              {voucher.totalPrepaidUsd > 0 && (
                                <span className="font-mono font-bold text-emerald-400 text-[10px] block">
                                  ${voucher.totalPrepaidUsd}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => openCourierIntakeVoucherPrint(voucher)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 transition cursor-pointer"
                              title="معاينة وطباعة السند"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: صندوق عهدة وتحصيلات التوزيع (Delivery & COD Custody) */}
            {settlementTab === 'delivery_custody' && (
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-3">
                <div className="flex items-center justify-between text-xs font-black text-emerald-400 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    <span>تصفية عهدة ومتحصلات التوزيع (COD)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    المانافيست: {primaryActiveManifest?.manifestNumber || 'لا يوجد'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400 font-bold">المقبوضات المحصلة (ل.س):</span>
                    <span className="font-mono text-base font-black text-emerald-400">
                      {formatCurrency(manifestFinancials.collectedSyp, 'SYP')}
                    </span>
                  </div>

                  {manifestFinancials.collectedUsd > 0 && (
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                      <span className="text-slate-400 font-bold">المقبوضات المحصلة ($):</span>
                      <span className="font-mono text-base font-black text-emerald-300">
                        {formatCurrency(manifestFinancials.collectedUsd, 'USD')}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[10px]">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block font-bold">المسلّم:</span>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {manifestFinancials.deliveredCount}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block font-bold">المرتجع:</span>
                      <span className="font-mono font-bold text-rose-400 text-xs">
                        {manifestFinancials.returnedCount}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block font-bold">المتبقي:</span>
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        {manifestFinancials.pendingCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">ملاحظات تصفية العهدة لأمين الصندوق:</label>
                  <textarea
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    placeholder="ملاحظات أو مبالغ مرفقة للتسليم..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {isSettlingSubmitted ? (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-center text-xs text-emerald-300 font-bold">
                    ✓ تم تقديم طلب تصفية العهدة بنجاح وبانتظار اعتماد أمين الصندوق
                  </div>
                ) : (
                  <button
                    onClick={handleRequestSettlement}
                    disabled={!primaryActiveManifest}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    إرسال طلب تصفية عهدة التوزيع إلى الصندوق
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 4. DELIVERY MODAL                                                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedParcelForDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-black text-white">توثيق تسليم الشحنة</h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedParcelForDelivery(null);
                    setDeliveryErrorNotice(null);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {deliveryErrorNotice && (
                <div className="bg-rose-950/80 border border-rose-500/80 text-rose-200 p-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{deliveryErrorNotice}</span>
                </div>
              )}

              <form onSubmit={handleConfirmDeliverySubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">اسم المستلم الفعلي:</label>
                  <input
                    type="text"
                    value={actualReceiverName}
                    onChange={(e) => setActualReceiverName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">صلة القرابة بالمستلم:</label>
                  <select
                    value={receiverRelation}
                    onChange={(e) => setReceiverRelation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="المستلم بالذات">المستلم بالذات</option>
                    <option value="أب / أم">أب / أم</option>
                    <option value="أخ / أخت">أخ / أخت</option>
                    <option value="ابن / ابنة">ابن / ابنة</option>
                    <option value="وكيل / مفوض">وكيل / مفوض</option>
                    <option value="زميل عمل">زميل عمل</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">الرقم الوطني / الهوية:</label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="11 رقماً"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    dir="ltr"
                  />
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-bold">المبلغ المقبوض:</span>
                  <span className="font-mono text-sm font-black text-emerald-400">
                    {formatCurrency(selectedParcelForDelivery.totalDue, selectedParcelForDelivery.currency)}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">ملاحظات التسليم:</label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="ملاحظات اختيارية..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    تأكيد التسليم وقبض المبلغ
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedParcelForDelivery(null)}
                    className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. RETURN MODAL                                                           */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedParcelForReturn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-400" />
                  <h3 className="text-sm font-black text-white">تسجيل طرد كـ مرتجع</h3>
                </div>
                <button
                  onClick={() => setSelectedParcelForReturn(null)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmReturnSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">سبب الإرجاع:</label>
                  <div className="space-y-1.5">
                    {RETURN_REASONS.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedReturnReason(r)}
                        className={`w-full text-right p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                          selectedReturnReason === r
                            ? 'bg-rose-950/80 border-rose-500 text-rose-200 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-rose-600/20"
                  >
                    تأكيد إرجاع الطرد
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedParcelForReturn(null)}
                    className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* MODAL: TODAY'S REGISTERED PARCELS LIST (قائمة طرود اليوم المسجلة)         */}
        {/* ======================================================================= */}
        {showTodayParcelsModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-4 shadow-2xl flex flex-col max-h-[85vh] text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">طرود اليوم المسجلة</h3>
                    <p className="text-[10px] text-slate-400">
                      {courierIntakeTodayParcels.length} طرد تم إدخاله وتوثيقه اليوم
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTodayParcelsModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {courierIntakeTodayParcels.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 my-4">
                    <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-300">لم يتم تسجيل أي طرود اليوم بعد</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      اضغط على زر "تسجيل طرد جديد" للبدء في استلام وتوثيق الشحنات
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTodayParcelsModal(false);
                        setCurrentView('intake');
                      }}
                      className="mt-3 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-xs shadow-md transition cursor-pointer"
                    >
                      تسجيل أول طرد الآن ➔
                    </button>
                  </div>
                ) : (
                  courierIntakeTodayParcels.map((parcel) => {
                    const isPrepaid = parcel.paymentType === 'prepaid';
                    const isWithCourier = parcel.handlingStatus === 'with_courier';
                    return (
                      <div
                        key={parcel.id}
                        className="bg-slate-950/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-3 space-y-2 text-xs transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-amber-300 text-xs">
                              {parcel.trackingNumber}
                            </span>
                            {parcel.paperReceiptNumber && (
                              <span className="text-[9.5px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                وصل: {parcel.paperReceiptNumber}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold border ${
                              isWithCourier
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isWithCourier ? 'بعهدتك' : 'مسلّم للمركز'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-0.5">
                          <div>
                            <span className="text-[9.5px] text-slate-500 block">المرسل:</span>
                            <span className="font-bold truncate block">{parcel.sender.name}</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-500 block">المستلم:</span>
                            <span className="font-bold truncate block">{parcel.receiver.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">الأجور:</span>
                            <span className="font-mono font-bold text-white">
                              {formatCurrency(parcel.shippingCost, parcel.currency)}
                            </span>
                            <span
                              className={`text-[9px] px-1 rounded ${
                                isPrepaid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                              }`}
                            >
                              {isPrepaid ? 'مدفوع سلفاً' : 'تحصيل وجهة'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setThermalPrintParcel(parcel);
                              }}
                              className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg border border-amber-500/30 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title="طباعة إشعار حراري (80mm)"
                            >
                              <Printer className="w-3 h-3" />
                              <span>حراري 80mm</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openPrintModal('parcel_3part', parcel);
                              }}
                              className="px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 rounded-lg border border-cyan-500/30 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title="طباعة بوليصة رسمية (A4)"
                            >
                              <FileText className="w-3 h-3" />
                              <span>A4</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const text = `📦 *وصل استلام طرد - أوركا إكسبريس*\nرقم التتبع: *${parcel.trackingNumber}*\nالمرسل: ${parcel.sender.name}\nالمستلم: ${parcel.receiver.name}\nالوجهة: ${parcel.destinationAddress}\nالمبلغ: ${parcel.shippingCost} ${parcel.currency}`;
                                const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                                const a = document.createElement('a');
                                a.href = url;
                                a.target = '_blank';
                                a.rel = 'noopener noreferrer';
                                a.click();
                              }}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 rounded-lg border border-slate-800 transition cursor-pointer"
                              title="مشاركة عبر واتساب"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 mt-2 border-t border-slate-800 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowTodayParcelsModal(false);
                    setCurrentView('intake');
                  }}
                  className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>تسجيل طرد جديد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTodayParcelsModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. COURIER THERMAL RECEIPT MODAL                                          */}
      {/* ========================================================================= */}
      <CourierThermalReceiptModal
        parcel={thermalPrintParcel}
        isOpen={!!thermalPrintParcel}
        onClose={() => {
          setThermalPrintParcel(null);
          setThermalAutoBluetooth(false);
        }}
        autoConnectBluetooth={thermalAutoBluetooth}
      />
    </div>
  );
};
