import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Package,
  User,
  MapPin,
  Calendar,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  Printer,
  Bell,
  ArrowRight,
  ShieldCheck,
  Building,
  Building2,
  History,
  DollarSign,
  Scale,
  Box,
  Share2,
  FileText,
  Phone,
  QrCode,
  Tag,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import { HandlingStatus } from '../types';
import { OrcaLogo } from './OrcaLogo';
import { getParcelPaymentSummary } from '../utils/settlementMath';
import {
  getParcelTimelineFromEvents,
  getEventLabelAr,
  getEventDimensionStyle,
  formatEventTimestamp,
} from '../utils/parcelTimelineHelpers';
import { PhotoFromIndexedDB } from './PhotoFromIndexedDB';

export const ParcelStatusModal: React.FC = () => {
  const {
    selectedParcelForQuickView,
    setSelectedParcelForQuickView,
    currentUser,
    openPrintModal,
    branches,
    truckManifests,
    parcelEvents,
    notifyReceiver,
    setActiveModule,
    formatCurrency,
  } = useOrca();

  const isAppManager = currentUser?.role === 'super_admin';

  const [copiedTracking, setCopiedTracking] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  const parcelTimeline = useMemo(() => {
    if (!selectedParcelForQuickView) return [];
    return getParcelTimelineFromEvents(
      selectedParcelForQuickView.id,
      parcelEvents,
      'desc'
    );
  }, [selectedParcelForQuickView?.id, parcelEvents]);

  if (!selectedParcelForQuickView) return null;

  const parcel = selectedParcelForQuickView;

  const originHub = branches.find((b) => b.id === parcel.originHubId);
  const destHub = branches.find((b) => b.id === parcel.destinationHubId);
  const originSecondary = branches.find((b) => b.id === parcel.originCollectionBranchId);

  const truckManifest = parcel.truckManifestId
    ? truckManifests.find((m) => m.id === parcel.truckManifestId || m.manifestNumber === parcel.truckManifestId)
    : null;
  const manifestNumberDisplay = truckManifest?.manifestNumber || parcel.truckManifestId || 'بانتظار التحميل في رحلة';

  const weightAndTypeNote = (() => {
    if (parcel.packageNotes && parcel.packageNotes.trim()) {
      return parcel.packageNotes.trim();
    }
    if (parcel.specialInstructions && parcel.specialInstructions.includes('ملاحظة الوزن والنوع:')) {
      const match = parcel.specialInstructions.match(/ملاحظة الوزن والنوع:\s*([^|]+)/);
      if (match && match[1]) return match[1].trim();
    }
    if (parcel.packageNotes) return parcel.packageNotes;
    return parcel.specialInstructions || '';
  })();

  const normalizeStatus = (status: string): HandlingStatus => {
    if (status === 'received_at_origin_hub') return 'received_at_hub';
    if (status === 'arrived_at_dest_hub') return 'received_at_dest';
    if (status === 'out_for_delivery') return 'with_courier';
    return status as HandlingStatus;
  };

  const normalizedStatus = normalizeStatus(parcel.handlingStatus);

  const stages: { key: HandlingStatus; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'received_at_hub', label: 'تسجيل وتجهيز في المركز', desc: 'تم استلام الشحنة وتثبيت بياناتها وإصدار الباركود', icon: Package },
    { key: 'loaded_in_truck', label: 'شحن في مانفيست الشاحنة', desc: 'تم التحميل والربط بمانفيست الشحن البري', icon: Truck },
    { key: 'in_transit', label: 'في الطريق بين المحافظات', desc: 'الشاحنة في مسار النقل بين مراكز المحافظات', icon: Truck },
    { key: 'received_at_dest', label: 'واصل مستودع الوجهة', desc: 'جاهز للتسليم المباشر أو التوزيع', icon: Building },
    { key: 'with_courier', label: 'مع مندوب التوصيل', desc: 'خرج للتوصيل لعنوان المستلم', icon: MapPin },
    { key: 'delivered', label: 'تم التسليم والتحصيل', desc: 'تم تسليم الطرد وتدوين الهوية وإقفال الذمة', icon: CheckCircle2 },
  ];

  const currentStageIndex = stages.findIndex((s) => s.key === normalizedStatus);

  const getStatusBadge = (status: string) => {
    if (parcel.isRecoveredFromPreviousShortage || parcel.shortageStatus === 'confirmed_at_origin') {
      return { text: 'بمركز الانطلاق (ناقص من شحنة سابقة) ⚠️', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
    const norm = normalizeStatus(status);
    switch (norm) {
      case 'received_at_hub':
        return { text: 'مسجل في مركز الانطلاق', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      case 'loaded_in_truck':
        return { text: 'محمل في الشاحنة', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'in_transit':
        return { text: 'في الطريق بين المحافظات', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'received_at_dest':
        return { text: 'واصل لمستودع الوصول', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'with_courier':
        return { text: 'خرج مع المندوب', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
      case 'delivered':
        return { text: 'تم التسليم بنجاح', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'shortage_missing':
        return { text: 'نقص معلق للتحقق ⚠️', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      case 'lost_in_transit':
        return { text: 'مفقود (بمستودع الفقد والتسويات) 🚨', bg: 'bg-rose-600/30 text-rose-200 border-rose-500/60' };
      case 'settled_loss_compensated':
        return { text: 'مفقود (تم التعويض والتسوية) 💰', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'returned':
        return { text: 'معاد للمستودع', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      default:
        return { text: status, bg: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  const statusBadge = getStatusBadge(parcel.handlingStatus);

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(parcel.trackingNumber);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handleNotify = () => {
    notifyReceiver(parcel.id);
    setNotificationSent(true);
    setTimeout(() => setNotificationSent(false), 3000);
  };

  const handleJumpToModule = () => {
    const norm = normalizeStatus(parcel.handlingStatus);
    if (norm === 'received_at_hub') {
      setActiveModule('intake');
    } else if (norm === 'loaded_in_truck' || norm === 'in_transit') {
      setActiveModule('manifests');
    } else if (norm === 'received_at_dest') {
      setActiveModule('arrivals');
    } else if (norm === 'with_courier' || norm === 'delivered') {
      setActiveModule('delivery');
    } else {
      setActiveModule('intake');
    }
    setSelectedParcelForQuickView(null);
  };

  return (
    <AnimatePresence>
      <div
        id="parcel-status-modal-backdrop"
        className="fixed inset-0 z-[120] bg-slate-950 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200"
      >
        <motion.div
          id="parcel-status-modal-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-950 flex flex-col w-full h-full text-slate-100 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-20 shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <OrcaLogo size={40} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-wide">بيان واستعلام الشحنة</h2>
                  <div className="flex items-center gap-1 bg-cyan-950 text-cyan-300 border border-cyan-800/70 px-2.5 py-0.5 rounded-lg font-mono font-bold text-sm">
                    <span dir="ltr">{parcel.trackingNumber}</span>
                    <button
                      type="button"
                      onClick={handleCopyTracking}
                      className="text-cyan-400 hover:text-white p-0.5 ml-1 transition-colors cursor-pointer"
                      title="نسخ رقم التتبع"
                    >
                      {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {parcel.paperReceiptNumber && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 font-mono">
                      إيصال ورقي: #{parcel.paperReceiptNumber}
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-bold">
                    واجهة كاملة الشاشة
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>
                    تاريخ التسجيل:{' '}
                    <span dir="ltr" className="font-mono text-slate-200">
                      {new Date(parcel.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </span>
                  <span>•</span>
                  <span className="text-slate-400">بواسطة: {parcel.registeredByUserName || 'موظف الاستقبال'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1 rounded-full border font-bold ${statusBadge.bg}`}>
                {statusBadge.text}
              </span>
              <button
                id="close-status-modal-btn"
                onClick={() => setSelectedParcelForQuickView(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>إغلاق</span>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 w-full max-w-7xl mx-auto custom-scrollbar">
            {/* Visual Lifecycle Progress Bar */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  مسار ومراحل الشحنة الميدانية
                </h3>
                <span className="text-xs text-cyan-400 font-mono font-bold">
                  المرحلة {currentStageIndex >= 0 ? currentStageIndex + 1 : 1} من {stages.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {stages.map((stage, idx) => {
                  const isCompleted = currentStageIndex >= idx;
                  const isCurrent = currentStageIndex === idx;
                  const Icon = stage.icon;

                  return (
                    <div
                      key={stage.key}
                      className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/30'
                          : isCompleted
                          ? 'bg-slate-900/90 border-slate-700/80 text-slate-200'
                          : 'bg-slate-950/40 border-slate-800/40 opacity-40 text-slate-500'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs mb-1.5 font-bold ${
                          isCurrent
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/40'
                            : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isCompleted && !isCurrent ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className={`text-[11px] font-bold leading-tight ${isCurrent ? 'text-cyan-300' : 'text-slate-300'}`}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sender & Receiver Civil Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sender Details */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">بيانات المرسل (جهة الانطلاق)</h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
                    مركز الانطلاق: {originHub?.city || parcel.sender.city}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">الاسم الكامل:</span>
                    <span className="font-bold text-slate-100">{parcel.sender.name}</span>
                  </div>

                  {(parcel.sender.firstName || parcel.sender.fatherName || parcel.sender.lastName) && (
                    <div className="grid grid-cols-3 gap-2 py-1 bg-slate-900/60 px-2 rounded border border-slate-800/50">
                      <div>
                        <span className="text-[10px] text-slate-500 block">الاسم</span>
                        <span className="font-medium text-slate-200">{parcel.sender.firstName || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">اسم الأب</span>
                        <span className="font-medium text-slate-200">{parcel.sender.fatherName || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">الكنية</span>
                        <span className="font-medium text-slate-200">{parcel.sender.lastName || '-'}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">اسم الأم:</span>
                    <span className="text-slate-200">{parcel.sender.motherName || 'غير مسجل'}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">تاريخ الولادة:</span>
                    <span className="font-mono text-slate-200">{parcel.sender.birthDate || 'غير مسجل'}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">الرقم الوطني السوري:</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {parcel.sender.nationalId ? (
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
                          {parcel.sender.nationalId}
                        </span>
                      ) : (
                        'غير مسجل'
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">رقم الهاتف:</span>
                    <span className="font-mono text-slate-200 flex items-center gap-1 font-bold">
                      <Phone className="w-3 h-3 text-cyan-400 inline" />
                      {parcel.sender.phone}
                    </span>
                  </div>

                  {originSecondary && (
                    <div className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-400">الفرع الثانوي المجمع:</span>
                      <span className="text-slate-200">{originSecondary.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Receiver Details */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">بيانات المستلم (جهة الوصول)</h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                    مركز الوصول: {destHub?.city || parcel.receiver.city}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">اسم المستلم:</span>
                    <span className="font-bold text-slate-100">{parcel.receiver.name}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">رقم هاتف المستلم:</span>
                    <span className="font-mono text-slate-200 flex items-center gap-1 font-bold">
                      <Phone className="w-3 h-3 text-emerald-400 inline" />
                      {parcel.receiver.phone}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">المحافظة / المدينة:</span>
                    <span className="text-slate-200">{parcel.receiver.city}</span>
                  </div>

                  <div className="py-1 border-b border-slate-800/40">
                    <span className="text-slate-400 block mb-0.5">العنوان التفصيلي للتسليم:</span>
                    <span className="text-slate-200 bg-slate-900/60 px-2 py-1 rounded block border border-slate-800/50">
                      {parcel.destinationAddress || parcel.receiver.address || 'استلام مباشر من مركز الفرع'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">حالة التحقق من الهوية:</span>
                    <span className="font-medium text-slate-200">
                      {parcel.receiver.nationalIdScanned ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          تم مسح الهوية وتأكيد التسليم
                        </span>
                      ) : (
                        <span className="text-amber-400">بانتظار التحقق عند التسليم بالمركز</span>
                      )}
                    </span>
                  </div>

                  {(parcel.receiver.idPhotoFront ||
                    parcel.receiver.idPhotoBack ||
                    (parcel as any).idPhotoFront ||
                    (parcel as any).idPhotoBack ||
                    (parcel as any).receiverIdPhotoFront ||
                    (parcel as any).receiverIdPhotoBack) && (
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                        وثائق الهوية المسجلة عند التسليم:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <PhotoFromIndexedDB
                          photoKey={
                            parcel.receiver.idPhotoFront ||
                            (parcel as any).idPhotoFront ||
                            (parcel as any).receiverIdPhotoFront
                          }
                          alt="ID Front"
                          className="w-full h-20 object-cover rounded-lg border border-slate-800"
                          fallback={
                            <div className="w-full h-20 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center text-[10px] text-slate-500">
                              الوجه الأمامي غير متوفر
                            </div>
                          }
                        />
                        <PhotoFromIndexedDB
                          photoKey={
                            parcel.receiver.idPhotoBack ||
                            (parcel as any).idPhotoBack ||
                            (parcel as any).receiverIdPhotoBack
                          }
                          alt="ID Back"
                          className="w-full h-20 object-cover rounded-lg border border-slate-800"
                          fallback={
                            <div className="w-full h-20 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center text-[10px] text-slate-500">
                              الوجه الخلفي غير متوفر
                            </div>
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Parcel Physical & Pricing Specs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Package Specifications (Weight, Count, Dates) */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-800 text-sm font-bold text-white">
                  <Box className="w-4 h-4 text-cyan-400" />
                  مواصفات وحمولة الطرد
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">نوع المحتوى:</span>
                    <span className="font-semibold text-slate-200">{parcel.packageType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">عدد القطع / الطرود:</span>
                    <span className="font-bold text-cyan-300 font-mono">{parcel.piecesCount || 1} قطعة</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">الوزن الفعلي:</span>
                    <span className="font-mono font-bold text-amber-300">{parcel.weightKg} كغ</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">تاريخ التسجيل:</span>
                    <span className="font-mono text-slate-200" dir="ltr">
                      {new Date(parcel.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">تاريخ التسليم:</span>
                    <span className={`font-mono font-semibold ${parcel.deliveredAt ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {parcel.deliveredAt
                        ? new Date(parcel.deliveredAt).toLocaleDateString('ar-SY', { year: 'numeric', month: '2-digit', day: '2-digit' })
                        : (parcel.handlingStatus === 'delivered' ? 'تم التسليم' : 'قيد الشحن والتوصيل')}
                    </span>
                  </div>
                  <div className="py-1">
                    <span className="text-slate-400 block mb-0.5">وصف المحتويات:</span>
                    <span className="text-slate-300 bg-slate-900/60 p-1.5 rounded block border border-slate-800/50">
                      {parcel.contentDescription || 'بضائع عامة وطرود بريدية'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial & Accounting */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-800 text-sm font-bold text-white">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  البيان المالي والتحصيل
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">طريقة الدفع:</span>
                    <span className="font-bold text-slate-200">
                      {parcel.paymentType === 'prepaid' && 'مدفوع مسبقاً (عند الإرسال)'}
                      {parcel.paymentType === 'collect' && 'أجرة الشحن على المستلم'}
                      {parcel.paymentType === 'cod' && 'دفع عند الاستلام + تحصيل ثمن البضاعة'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/40">
                    <span className="text-slate-400">
                      أجور الشحن {parcel.paymentType === 'cod' && parcel.codShippingPayer === 'sender' ? '(مسددة من المرسل بالفرع):' : ':'}
                    </span>
                    <span className={`font-mono font-bold ${parcel.paymentType === 'cod' && parcel.codShippingPayer === 'sender' ? 'text-cyan-300' : 'text-slate-100'}`}>
                      {formatCurrency(parcel.shippingCost ?? 0, parcel.shippingCurrency || parcel.currency || 'SYP')}
                    </span>
                  </div>

                  {parcel.codAmount > 0 && (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-800/40">
                        <span className="text-slate-400">قيمة الحوالة (ثمن البضاعة):</span>
                        <span className="font-mono font-bold text-amber-400">
                          {formatCurrency(parcel.codAmount ?? 0, parcel.codCurrency || parcel.currency || 'SYP')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/40">
                        <span className="text-slate-400">عمولة الحوالة:</span>
                        <span className="font-mono text-amber-300 font-bold">
                          {formatCurrency(parcel.transferFee ?? 0, parcel.transferFeeCurrency || parcel.codCurrency || parcel.currency || 'SYP')}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between items-center py-2 bg-slate-900 px-2.5 rounded-lg border border-emerald-500/30">
                    <span className="font-bold text-emerald-400">المطلوب تحصيله من المستلم:</span>
                    <span className="font-mono font-black text-sm sm:text-base text-emerald-300">
                      {getParcelPaymentSummary(parcel).summaryDueText}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">نوع التسعير المعتمد:</span>
                    <span className="font-semibold text-cyan-300">
                      {parcel.pricingBasis === 'weight_only' && 'حسب الوزن الفعلي فقط'}
                      {parcel.pricingBasis === 'volume_only' && 'حسب الحجم CBM فقط'}
                      {(!parcel.pricingBasis || parcel.pricingBasis === 'auto') && 'تلقائي ذكي (الأعلى بين الوزن والحجم)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logistics & Manifest Links */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-800 text-sm font-bold text-white">
                    <Truck className="w-4 h-4 text-purple-400" />
                    بيانات الشحن والمنافيست
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-400">رقم مانافيست الشحنة:</span>
                      <span className="font-mono font-bold text-purple-300" dir="ltr">
                        {manifestNumberDisplay}
                      </span>
                    </div>

                    {/* ملاحظة الوزن والنوع يكتب تحت رقم مانافيست الشحنة في الجهة اليسرى من الإيصال */}
                    <div className="py-2 px-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 my-1 shadow-inner">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-cyan-400" />
                          ملاحظة الوزن والنوع:
                        </span>
                      </div>
                      <p className="text-xs text-amber-300 font-semibold leading-relaxed">
                        {weightAndTypeNote || (parcel.weightKg ? `${parcel.weightKg} كغ - ${parcel.packageType}` : 'لا توجد ملاحظة مدونة')}
                      </p>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-400">مانفيست المندوب:</span>
                      <span className="font-mono text-orange-300" dir="ltr">
                        {parcel.courierManifestId || 'غير موكل لمندوب حالياً'}
                      </span>
                    </div>

                    {parcel.specialInstructions && (
                      <div className="py-1">
                        <span className="text-slate-400 block mb-0.5">تعليمات خاصة للشحن:</span>
                        <span className="text-amber-300 bg-amber-950/30 p-1.5 rounded block border border-amber-800/40">
                          {parcel.specialInstructions}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-2 mt-3">
                  {isAppManager && (
                    <button
                      id="status-modal-print-btn"
                      onClick={() => openPrintModal('parcel_3part', parcel)}
                      className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-cyan-600/20 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      طباعة بوليصة الشحن (3 نسخ أصلية)
                    </button>
                  )}

                  <button
                    id="status-modal-notify-btn"
                    onClick={handleNotify}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    {notificationSent ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">تم إرسال إشعار SMS ورابط التتبع!</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 text-amber-400" />
                        إرسال إشعار SMS ورابط التتبع للمستلم
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* [5-B-5-C] Parcel Events Timeline */}
            {parcelTimeline.length > 0 && (
              <div className="mt-5 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" />
                    <span>سجل مراحل الشحنة والأحداث الميدانية</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded-full">
                    {parcelTimeline.length} حدث
                  </span>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {parcelTimeline.map((event, idx) => {
                    const style = getEventDimensionStyle(event.dimension);
                    const ts = formatEventTimestamp(event.serverTimestamp);
                    const isLatest = idx === 0;

                    return (
                      <div
                        key={event.id || idx}
                        className={`relative flex gap-3 p-3 rounded-xl border transition-all ${
                          isLatest
                            ? `${style.bg} ${style.border}`
                            : 'bg-slate-900/40 border-slate-800/60'
                        }`}
                      >
                        <div className="flex flex-col items-center pt-0.5">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${style.dot} ${
                              isLatest ? 'ring-2 ring-offset-2 ring-offset-slate-950' : ''
                            }`}
                          />
                          {idx < parcelTimeline.length - 1 && (
                            <div
                              className="w-px flex-1 bg-slate-800 mt-1"
                              style={{ minHeight: '20px' }}
                            />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className={`text-xs font-bold ${style.text}`}>
                              {getEventLabelAr(event.eventType)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                              {ts.date} · {ts.time}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                            {event.userName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {event.userName}
                              </span>
                            )}
                            {event.branchId && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {branches.find((b) => b.id === event.branchId)?.name ||
                                  event.branchId}
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${style.bg} ${style.text} border ${style.border}`}
                            >
                              {style.label}
                            </span>
                          </div>

                          {event.notes && (
                            <p className="mt-2 text-[10px] text-slate-400 leading-relaxed line-clamp-2">
                              {event.notes}
                            </p>
                          )}

                          {ts.relative && (
                            <div className="mt-1 text-[9px] text-slate-600 italic">
                              {ts.relative}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-8 py-3.5 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
            <button
              type="button"
              onClick={handleJumpToModule}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 transition-colors bg-cyan-950/60 hover:bg-cyan-900/80 px-3.5 py-2 rounded-xl border border-cyan-800/50 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>الانتقال المباشر لقسم الشحنات التابع لها</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                id="status-modal-done-btn"
                onClick={() => setSelectedParcelForQuickView(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق والعودة
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
