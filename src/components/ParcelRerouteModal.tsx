import React, { useState, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Currency, PaymentType, PackageType, Dimensions, ReceiverInfo, PartyInfo } from '../types';
import { tokenizeArabicName } from '../utils/nameUtils';
import {
  ArrowRightLeft,
  XCircle,
  Building2,
  User,
  Phone,
  Package,
  Scale,
  DollarSign,
  AlertTriangle,
  FileText,
  Copy,
  Printer,
  Sparkles,
  CheckCircle2,
  CreditCard,
  MapPin,
  Tag,
  Lock,
  Check,
  Calendar,
} from 'lucide-react';

export const ParcelRerouteModal: React.FC = () => {
  const {
    isRerouteModalOpen,
    selectedParcelForReroute,
    closeRerouteModal,
    rerouteParcel,
    branches,
    currentBranch,
    formatCurrency,
    openPrintModal,
    pricingRules,
  } = useOrca();

  const parcel = selectedParcelForReroute;

  // English-only formatting helpers for numbers and dates
  const formatEnCurrency = (amount: number | string | null | undefined, cur: Currency | string = 'SYP') => {
    return formatCurrency(amount, cur as Currency, { digitStyle: 'latin' });
  };

  const formatEnDate = (dateVal: string | number | Date | null | undefined) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  };

  // New Destination Hub
  const availableDestBranches = branches.filter((b) => b.id !== currentBranch?.id);
  const [newDestBranchId, setNewDestBranchId] = useState<string>('');
  const [newDestAddress, setNewDestAddress] = useState<string>('');

  // Receiver info (new recipient) - Must be tripartite name and mandatory phone
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  const [receiverCity, setReceiverCity] = useState<string>('');

  // Financial Breakdown: Previous financials are locked; only new route shipping cost is configurable
  const [currency, setCurrency] = useState<Currency>('SYP');
  const [carriedOverDueAmount, setCarriedOverDueAmount] = useState<number>(0);
  const [newShippingCost, setNewShippingCost] = useState<number>(0);
  const [newCodAmount, setNewCodAmount] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<PaymentType>('collect');
  const [rerouteReason, setRerouteReason] = useState<string>('وصل بالخطأ ويجب إعادة توجيهه للوجهة الصحيحة');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successNewParcel, setSuccessNewParcel] = useState<any | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [activeParcelSnapshot, setActiveParcelSnapshot] = useState<typeof parcel | null>(null);

  // Initialize form when modal opens with a parcel
  useEffect(() => {
    if (parcel && isRerouteModalOpen) {
      setActiveParcelSnapshot(parcel);
      setSuccessNewParcel(null);
      setIsSubmitting(false);
      setValidationError(null);
      setCopiedTracking(false);

      // Select first destination branch that is not current
      const defaultDest = branches.find((b) => b.id !== (currentBranch?.id || parcel.destinationHubId));
      setNewDestBranchId(defaultDest ? defaultDest.id : '');
      setNewDestAddress(defaultDest ? defaultDest.city : '');

      // Receiver info reset
      setReceiverName('');
      setReceiverPhone('');
      setReceiverCity(defaultDest ? defaultDest.city : '');

      setCurrency(parcel.currency || 'SYP');

      // Calculate Carried Over Amount (fixed and locked from previous parcel)
      let carried = 0;
      if (parcel.paymentType === 'collect' || parcel.paymentType === 'cod' || parcel.paymentType === 'cod_destination') {
        carried = parcel.shippingCost || 0;
      }
      setCarriedOverDueAmount(carried);

      // Previous COD amount is locked from original parcel
      const originalCod = parcel.codAmount || 0;
      setNewCodAmount(originalCod);
      setPaymentType(originalCod > 0 ? 'cod' : 'collect');

      // Default new shipping cost estimation
      const estimatedNewShipping = parcel.shippingCost || (parcel.currency === 'USD' ? 5 : 25000);
      setNewShippingCost(estimatedNewShipping);
      setRerouteReason('وصل بالخطأ ويجب إعادة توجيهه للوجهة الصحيحة');
    }
  }, [parcel, isRerouteModalOpen, branches, currentBranch]);

  const effectiveParcel = parcel || activeParcelSnapshot;

  if (!isRerouteModalOpen || !effectiveParcel) {
    return null;
  }

  const originalOriginBranch = branches.find((b) => b.id === effectiveParcel.originHubId);
  const originalDestBranch = branches.find((b) => b.id === effectiveParcel.destinationHubId);
  const currentHubName = currentBranch?.name || originalDestBranch?.name || 'المركز الحالي';
  const selectedNewDestBranch = branches.find((b) => b.id === newDestBranchId);

  // Validation helper: Tripartite Arabic name (at least 3 tokens)
  const nameTokens = tokenizeArabicName(receiverName.trim());
  const isTripartiteName = nameTokens.length >= 3;
  const hasPhone = receiverPhone.trim().replace(/\s+/g, '').length >= 9;

  // Quick helper: copy original receiver info without national ID
  const handleCopyOriginalReceiver = () => {
    setReceiverName(effectiveParcel.receiver?.name || '');
    setReceiverPhone(effectiveParcel.receiver?.phone || '');
    if (selectedNewDestBranch) {
      setReceiverCity(selectedNewDestBranch.city);
    }
    setValidationError(null);
  };

  // Total Due calculation: previous carried over + new shipping fee + previous COD
  const calculatedTotalDue =
    Number(carriedOverDueAmount || 0) +
    Number(newShippingCost || 0) +
    Number(newCodAmount || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!newDestBranchId) {
      setValidationError('يرجى تحديد فرع الوجهة الجديد للشحنة.');
      return;
    }

    if (!receiverName.trim()) {
      setValidationError('يرجى إدخال اسم المستلم الجديد.');
      return;
    }

    const tokens = tokenizeArabicName(receiverName.trim());
    if (tokens.length < 3) {
      setValidationError(
        `يجب أن يكون اسم المستلم الجديد اسماً ثلاثياً (الاسم الأول، اسم الأب، الكنية/العائلة). تم إدخال ${tokens.length} من 3 مقاطع مطلوبة.`
      );
      return;
    }

    const cleanPhone = receiverPhone.trim().replace(/\s+/g, '');
    if (!cleanPhone) {
      setValidationError('يرجى إدخال رقم هاتف المستلم الجديد (إلزامي).');
      return;
    }
    if (cleanPhone.length < 9) {
      setValidationError('يرجى إدخال رقم هاتف صحيح للمستلم الجديد (9 أرقام على الأقل).');
      return;
    }

    setIsSubmitting(true);

    try {
      // Safe dimensions
      const safeDimensions: Dimensions = {
        lengthCm: Number(effectiveParcel.dimensions?.lengthCm || (effectiveParcel.dimensions as any)?.length || 30),
        widthCm: Number(effectiveParcel.dimensions?.widthCm || (effectiveParcel.dimensions as any)?.width || 20),
        heightCm: Number(effectiveParcel.dimensions?.heightCm || (effectiveParcel.dimensions as any)?.height || 15),
      };

      // New Receiver object without national ID (تم إلغاء الرقم الوطني تماماً من هذه الواجهة)
      const newReceiver: ReceiverInfo = {
        name: receiverName.trim(),
        phone: cleanPhone,
        nationalId: undefined,
        city: receiverCity || selectedNewDestBranch?.city || '',
        address: newDestAddress.trim() || undefined,
      };

      // Sender object is strictly locked to original parcel sender
      const newSender: PartyInfo = {
        name: effectiveParcel.sender?.name || 'مرسل غير محدد',
        phone: effectiveParcel.sender?.phone || '',
        city: effectiveParcel.sender?.city || '',
        address: effectiveParcel.sender?.address || '',
        nationalId: effectiveParcel.sender?.nationalId,
      };

      // Reroute with strictly locked package specs and locked previous financials
      const createdParcel = rerouteParcel(effectiveParcel.id, {
        newDestinationHubId: newDestBranchId,
        newDestinationAddress: newDestAddress,
        newReceiver,
        sender: newSender,
        packageType: effectiveParcel.packageType || 'box',
        weightKg: Number(effectiveParcel.weightKg || 1),
        dimensions: safeDimensions,
        piecesCount: Number(effectiveParcel.piecesCount || 1),
        contentDescription: effectiveParcel.contentDescription || 'طرد معاد توجيهه',
        specialInstructions: effectiveParcel.specialInstructions || undefined,
        carriedOverDueAmount: Number(carriedOverDueAmount || 0),
        newShippingCost: Number(newShippingCost || 0),
        newCodAmount: Number(newCodAmount || 0),
        totalDue: Number(calculatedTotalDue || 0),
        currency: effectiveParcel.currency || 'SYP',
        paymentType: newCodAmount > 0 ? 'cod' : 'collect',
        rerouteReason: rerouteReason || 'وصل بالخطأ ويجب إعادة توجيهه للوجهة الصحيحة',
      });

      if (createdParcel) {
        setSuccessNewParcel(createdParcel);
      } else {
        setValidationError('تعذر إتمام عملية إعادة التوجيه. يرجى التحقق من صحة بيانات الطرد والمحاولة مجدداً.');
      }
    } catch (error: any) {
      console.error('Error during rerouteParcel execution:', error);
      setValidationError(error?.message || 'حدث خطأ أثناء معالجة وإصدار البوليصة الجديدة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden animate-in fade-in duration-200">
      <div className="flex flex-col w-full h-full bg-slate-950 overflow-hidden">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-amber-500/20 shrink-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-amber-500/20 text-white">
              <ArrowRightLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black text-white tracking-wide">
                  إعادة توجيه الشحنة (بوليصة جديدة)
                </h2>
                <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full">
                  تحويل مسار
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-bold">
                  واجهة كاملة الشاشة
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تعديل وجهة الطرد وإصدار بوليصة مستقلة تنطلق من {currentHubName} مع ترحيل المستحقات المالية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeRerouteModal}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>إغلاق</span>
          </button>
        </div>

        {/* Success Screen after rerouting */}
        {successNewParcel ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-12 text-center space-y-6 max-w-4xl mx-auto w-full flex flex-col justify-center">
            <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">تمت إعادة توجيه الطرد بنجاح!</h3>
              <p className="text-sm text-slate-300 mt-2 max-w-lg mx-auto">
                تم إغلاق البوليصة القديمة (<span className="font-mono text-amber-300 font-bold" dir="ltr">{effectiveParcel?.trackingNumber || successNewParcel.reroutedFromTrackingNumber}</span>) وإنشاء البوليصة الجديدة برقم:
              </p>
              <div className="mt-4 inline-block px-6 py-3 bg-emerald-950/60 border-2 border-emerald-500/50 rounded-2xl">
                <span className="text-xs text-emerald-300 block font-bold">رقم البوليصة الجديد:</span>
                <span className="text-2xl font-black font-mono text-emerald-200 tracking-wider" dir="ltr">
                  {successNewParcel.trackingNumber}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 max-w-lg mx-auto text-right text-xs space-y-2.5 shadow-xl">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">تاريخ ووقت التحويل (English):</span>
                <span className="font-bold text-slate-200 font-mono" dir="ltr">{formatEnDate(new Date())}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">الوجهة الجديدة:</span>
                <span className="font-bold text-white">{selectedNewDestBranch?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">المستلم الجديد:</span>
                <span className="font-bold text-white">
                  {successNewParcel.receiver.name} (<span className="font-mono" dir="ltr">{successNewParcel.receiver.phone}</span>)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">المبلغ المرحّل من السابقة:</span>
                <span className="font-bold text-amber-300 font-mono" dir="ltr">{formatEnCurrency(successNewParcel.carriedOverDueAmount || 0, currency)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">أجور الشحن الجديدة:</span>
                <span className="font-bold text-blue-300 font-mono" dir="ltr">{formatEnCurrency(successNewParcel.shippingCost, currency)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2 text-sm">
                <span className="text-slate-200 font-bold">إجمالي التحصيل من المستلم:</span>
                <span className="font-black text-emerald-400 font-mono text-base" dir="ltr">{formatEnCurrency(successNewParcel.totalDue, currency)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  openPrintModal('parcel_3part', successNewParcel);
                  closeRerouteModal();
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>طباعة البوليصة الجديدة (3 أجزاء) ◄</span>
              </button>
              <button
                type="button"
                onClick={closeRerouteModal}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition cursor-pointer"
              >
                إغلاق والعودة
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full max-w-7xl mx-auto space-y-6 custom-scrollbar">
            {/* Operational Alert Banner */}
            <div className="p-4 bg-amber-950/50 border border-amber-500/40 rounded-2xl flex items-start gap-3 text-xs leading-relaxed text-amber-200 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-amber-300 block mb-0.5">تنبيه الربط التتبعي والمحاسبي:</span>
                سيتم وسم الطرد الحالي (<span className="font-mono font-bold text-white" dir="ltr">{parcel.trackingNumber}</span>) كـ <strong>"مُعاد التوجيه"</strong>، وفتح بوليصة شحن جديدة تنطلق من <strong>{currentHubName}</strong> باتجاه الوجهة الجديدة، مع ترحيل المستحقات لتُحصَّل دفعة واحدة من المستلم الأخير.
              </div>
            </div>

            {/* Validation Error Banner */}
            {validationError && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-500/60 rounded-2xl flex items-center gap-3 text-xs text-rose-200 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="font-bold">{validationError}</span>
              </div>
            )}

            {/* Original Parcel Summary Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 mb-3 gap-2">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  بيانات البوليصة الأصلية الحالية
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800" dir="ltr">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{formatEnDate(parcel.createdAt)}</span>
                  </span>
                  <span className="px-2.5 py-1 bg-slate-800 font-mono text-xs font-black text-amber-300 rounded-lg border border-slate-700" dir="ltr">
                    {parcel.trackingNumber}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[11px] mb-0.5">المسار الأصلي:</span>
                  <span className="font-bold text-white">
                    {originalOriginBranch?.name} ◄ {originalDestBranch?.name}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[11px] mb-0.5">المرسل الأصلي:</span>
                  <span className="font-bold text-white">{parcel.sender.name}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[11px] mb-0.5">المستلم الأصلي:</span>
                  <span className="font-bold text-white">{parcel.receiver.name}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[11px] mb-0.5">المستحقات الحالية:</span>
                  <span className="font-bold text-amber-400 font-mono" dir="ltr">
                    {formatEnCurrency(parcel.totalDue, parcel.currency)} ({parcel.paymentType === 'prepaid' ? 'مدفوع سلفاً' : 'غير مدفوع'})
                  </span>
                </div>
              </div>
            </div>

            {/* Step 1: New Route & Destination */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                1. مسار الشحن الجديد
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    مركز الانطلاق الجديد (الموقع الحالي للطرد)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentHubName}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 font-bold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    مركز الوجهة الجديد المقصود *
                  </label>
                  <select
                    value={newDestBranchId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setNewDestBranchId(newId);
                      const b = branches.find((br) => br.id === newId);
                      if (b) {
                        setNewDestAddress(b.city);
                        if (!receiverCity) setReceiverCity(b.city);
                      }
                    }}
                    required
                    className="w-full bg-slate-800 border-2 border-amber-500/50 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="">-- اختر الفرع / المحافظة الجديدة --</option>
                    {availableDestBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: New Recipient Data (Tripartite Name + Phone Required - NO National ID) & Locked Sender Data */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  2. بيانات المستلم الجديد (اسم ثلاثي ورقم هاتف فقط)
                </h3>
                <button
                  type="button"
                  onClick={handleCopyOriginalReceiver}
                  className="text-xs text-amber-300 hover:text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ بيانات المستلم السابق ({effectiveParcel.receiver?.name})</span>
                </button>
              </div>

              {/* Recipient Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-300">
                      اسم المستلم الجديد (ثلاثي إلزامي) *
                    </label>
                    {receiverName.trim() && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                          isTripartiteName
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isTripartiteName ? (
                          <>
                            <Check className="w-3 h-3" />
                            اسم ثلاثي معتمد
                          </>
                        ) : (
                          `مطلوب 3 مقاطع (${nameTokens.length}/3)`
                        )}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="الاسم الأول، اسم الأب، الكنية/العائلة..."
                    value={receiverName}
                    onChange={(e) => {
                      setReceiverName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition ${
                      receiverName.trim() && !isTripartiteName
                        ? 'border-amber-500 ring-1 ring-amber-500/30'
                        : receiverName.trim() && isTripartiteName
                        ? 'border-emerald-500/60'
                        : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                  {receiverName.trim() && !isTripartiteName && (
                    <p className="text-[10px] text-amber-300/90 mt-1">
                      ⚠️ يرجى إدخال الاسم ثلاثياً (الاسم، اسم الأب، الكنية) ليتم اعتماد الشحنة رسمياً.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    رقم هاتف المستلم الجديد (إلزامي) *
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    placeholder="09XXXXXXXX"
                    value={receiverPhone}
                    onChange={(e) => {
                      setReceiverPhone(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400 text-left"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    يُشترط رقم هاتف فعال للتواصل والتسليم دون الحاجة لرقم وطني
                  </span>
                </div>
              </div>

              {/* Destination Address */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  مدينة / عنوان التسليم للوجهة الجديدة
                </label>
                <input
                  type="text"
                  placeholder="العنوان التفصيلي أو منطقة التسليم بالوجهة الجديدة..."
                  value={newDestAddress}
                  onChange={(e) => setNewDestAddress(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Locked Sender Data (بيانات المرسل الأصلي مقفلة ومحمية من التعديل) */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    بيانات المرسل الأصلي (ثابتة ومحمية من التعديل)
                  </span>
                  <span className="text-[10px] text-amber-400/80 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                    مقفل بأمر النظام
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-lg">
                    <span className="text-slate-400 text-[11px]">اسم المرسل:</span>
                    <span className="font-bold text-white">{effectiveParcel.sender?.name}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-lg">
                    <span className="text-slate-400 text-[11px]">هاتف المرسل (English):</span>
                    <span className="font-bold text-white font-mono" dir="ltr">{effectiveParcel.sender?.phone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Package Specs (بيانات ومواصفات الشحنة مقفلة تماماً ومطابقة للأصل) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  3. مواصفات الطرد المنقول
                </h3>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3 text-amber-400" />
                  مواصفات الشحنة مقفلة ومطابقة للأصل
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                  <span className="block text-[11px] font-bold text-slate-400 mb-0.5">نوع الطرد</span>
                  <span className="text-xs font-black text-white">{effectiveParcel.packageType}</span>
                </div>
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                  <span className="block text-[11px] font-bold text-slate-400 mb-0.5">الوزن (Weight)</span>
                  <span className="text-xs font-black text-white font-mono" dir="ltr">{effectiveParcel.weightKg} kg</span>
                </div>
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                  <span className="block text-[11px] font-bold text-slate-400 mb-0.5">عدد القطع (Pieces)</span>
                  <span className="text-xs font-black text-white font-mono" dir="ltr">{effectiveParcel.piecesCount || 1} pcs</span>
                </div>
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                  <span className="block text-[11px] font-bold text-slate-400 mb-0.5">وصف المحتوى</span>
                  <span className="text-xs font-bold text-slate-200 truncate block" title={effectiveParcel.contentDescription}>
                    {effectiveParcel.contentDescription || 'غير محدد'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 4: Financial Accumulation & Calculation Engine (البيانات المالية السابقة مقفلة) */}
            <div className="space-y-3 bg-gradient-to-br from-slate-900 to-amber-950/30 border border-amber-500/30 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  4. المنظومة المالية وترحيل المستحقات (البيانات المالية السابقة مقفلة)
                </h3>
                <span className="text-[10px] font-bold text-amber-400/90 flex items-center gap-1 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3 text-amber-400" />
                  المستحقات السابقة ثابتة
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Carried over fees (Locked) */}
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-amber-300">
                      المبلغ المرحّل من البوليصة السابقة ({currency})
                    </label>
                    <span className="text-[10px] text-amber-400/80 flex items-center gap-0.5 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">
                      <Lock className="w-3 h-3" /> مقفل
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-amber-300 font-black font-mono flex items-center justify-between">
                    <span dir="ltr">{formatEnCurrency(carriedOverDueAmount, currency)}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {carriedOverDueAmount > 0 ? 'أجور شحن سابقة مستحقة' : 'لا توجد مستحقات سابقة'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    مبلغ مالي سابق ثابت مرحّل آلياً لا يمكن تعديله
                  </span>
                </div>

                {/* 2. New shipping cost (Editable for the new route leg) */}
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
                  <label className="block text-[11px] font-bold text-blue-300 mb-1">
                    أجور الشحن للمسار الجديد ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    dir="ltr"
                    value={newShippingCost}
                    onChange={(e) => setNewShippingCost(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-blue-500/40 rounded-lg px-3 py-1.5 text-xs text-blue-300 font-black font-mono focus:outline-none focus:border-blue-400"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    (أجور النقل من {currentHubName} إلى الوجهة الجديدة)
                  </span>
                </div>

                {/* 3. COD (Locked to original parcel codAmount) */}
                <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-emerald-300">
                      قيمة البضاعة المحولة COD ({currency})
                    </label>
                    <span className="text-[10px] text-emerald-400/80 flex items-center gap-0.5 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <Lock className="w-3 h-3" /> مقفل
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-300 font-black font-mono flex items-center justify-between">
                    <span dir="ltr">{formatEnCurrency(newCodAmount, currency)}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {newCodAmount > 0 ? 'مبلغ التحصيل لصالح المرسل' : 'شحنة بدون COD'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    القيمة المالية للبضاعة ثابتة ومحمية من البوليصة السابقة
                  </span>
                </div>
              </div>

              {/* Total Due Banner */}
              <div className="bg-amber-950/60 border-2 border-amber-500/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
                <div>
                  <span className="text-xs font-bold text-amber-200 block">
                    إجمالي المبلغ المطلوب تحصيله من المستلم الجديد:
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span>= المرحّل</span>
                    <span className="font-mono text-amber-300 font-bold" dir="ltr">({formatEnCurrency(carriedOverDueAmount, currency)})</span>
                    <span>+ الشحن الجديد</span>
                    <span className="font-mono text-blue-300 font-bold" dir="ltr">({formatEnCurrency(newShippingCost, currency)})</span>
                    <span>+ البضاعة</span>
                    <span className="font-mono text-emerald-300 font-bold" dir="ltr">({formatEnCurrency(newCodAmount, currency)})</span>
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-2xl font-black font-mono text-emerald-400 tracking-wider" dir="ltr">
                    {formatEnCurrency(calculatedTotalDue, currency)}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-bold">
                    طريقة الدفع: {newCodAmount > 0 ? 'ضد الدفع COD' : 'على المستلم'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 5: Reason for reroute */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                سبب إعادة التوجيه *
              </label>
              <select
                value={rerouteReason}
                onChange={(e) => setRerouteReason(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-medium cursor-pointer"
              >
                <option value="وصل بالخطأ ويجب إعادة توجيهه للوجهة الصحيحة">
                  وصل بالخطأ ويجب إعادة توجيهه للوجهة الصحيحة
                </option>
                <option value="طلب العميل / المرسل تغيير وجهة الشحنة لمحافظة أخرى">
                  طلب العميل / المرسل تغيير وجهة الشحنة لمحافظة أخرى
                </option>
                <option value="تغيير المستلم ومكان التسليم بطلب صاحب الشحنة">
                  تغيير المستلم ومكان التسليم بطلب صاحب الشحنة
                </option>
                <option value="إعادة توجيه لأسباب لوجستية وتشغيلية">
                  إعادة توجيه لأسباب لوجستية وتشغيلية
                </option>
              </select>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={closeRerouteModal}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newDestBranchId}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-black rounded-xl shadow-lg shadow-amber-950/60 flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الإصدار...' : 'تأكيد إعادة التوجيه وإصدار البوليصة الجديدة ◄'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
