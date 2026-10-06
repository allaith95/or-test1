import React, { useState, useEffect } from 'react';
import {
  Wallet,
  X,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Building2,
  Phone,
  User,
  Package,
  Receipt,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Banknote,
  Send,
} from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import { getParcelPaymentSummary } from '../utils/settlementMath';

export const CashierCollectionModal: React.FC = () => {
  const {
    isCashierCollectModalOpen,
    cashierCollectParcelId,
    cashierCollectNotificationId,
    closeCashierCollectModal,
    collectPaymentByCashier,
    parcels,
    currentBranch,
    currentUser,
    formatCurrency,
    formatNumber,
  } = useOrca();

  const parcel = parcels.find((p) => p.id === cashierCollectParcelId);

  // Financial calculations
  const paymentSummary = parcel ? getParcelPaymentSummary(parcel) : null;
  const shippingAmount = paymentSummary?.shippingCost || 0;
  const shippingCur = paymentSummary?.shippingCurrency || 'SYP';
  const codAmount = paymentSummary?.codAmount || 0;
  const codCur = paymentSummary?.codCurrency || 'SYP';
  const transferFee = paymentSummary?.transferFee || 0;
  const defaultSypDue = paymentSummary?.requiredSyp || 0;
  const defaultUsdDue = paymentSummary?.requiredUsd || 0;

  // Form State
  const [sypAmount, setSypAmount] = useState<number>(0);
  const [usdAmount, setUsdAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'online'>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync initial values whenever a new parcel is opened
  useEffect(() => {
    if (parcel) {
      setSypAmount(defaultSypDue);
      setUsdAmount(defaultUsdDue);
      setPaymentMethod('cash');
      setNotes('');
      setIsSuccess(false);
      setIsSubmitting(false);
    }
  }, [parcel?.id, defaultSypDue, defaultUsdDue]);

  if (!isCashierCollectModalOpen || !parcel) {
    return null;
  }

  const handleConfirm = () => {
    setIsSubmitting(true);
    try {
      collectPaymentByCashier(parcel.id, {
        sypAmount: Number(sypAmount) || 0,
        usdAmount: Number(usdAmount) || 0,
        paymentMethod,
        notes: notes.trim() || undefined,
        notificationId: cashierCollectNotificationId || undefined,
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsSubmitting(false);
        closeCashierCollectModal();
      }, 1600);
    } catch {
      setIsSubmitting(false);
    }
  };

  const totalDepositingSyp = Number(sypAmount) || 0;
  const totalDepositingUsd = Number(usdAmount) || 0;

  return (
    <div
      id="cashier_collection_modal_overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={closeCashierCollectModal}
    >
      <div
        id="cashier_collection_modal_content"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border-b border-emerald-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  تحصيل وقبض مالي - أمين صندوق الفرع
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {parcel.trackingNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                قبض المبلغ من المستلم وإيداعه دفترياً ونقدياً في صندوق الفرع
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCashierCollectModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Splash */}
        {isSuccess ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-black text-emerald-300">
                تم قبض وتحصيل المبلغ بنجاح!
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 max-w-md mx-auto leading-relaxed">
                تم إيداع المبلغ في صندوق فرع{' '}
                <span className="font-bold text-white">{currentBranch.name}</span> وإشعار قسم التسليم
                بأن الطرد مسدد بالكامل وجاهز للتسليم مباشرة للمستلم.
              </p>
            </div>
            <div className="text-[11px] font-mono text-emerald-400/80 bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-500/30">
              جاري العودة تلقائياً...
            </div>
          </div>
        ) : (
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Customer & Parcel Quick Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>المستلم:</span>
                  <strong className="text-white text-xs font-bold font-sans">
                    {parcel.receiver.name}
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>الهاتف:</span>
                  <span className="text-slate-200 font-mono text-[11px] font-bold">
                    {parcel.receiver.phone || 'غير مسجل'}
                  </span>
                </div>
                {parcel.paperReceiptNumber && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Receipt className="w-3.5 h-3.5 text-amber-400" />
                    <span>رقم الوصل الورقي:</span>
                    <span className="text-amber-300 font-mono font-bold">
                      {parcel.paperReceiptNumber}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 sm:border-r sm:border-slate-700/60 sm:pr-3">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>نوع الشحنة:</span>
                  <span className="text-slate-200 font-medium">
                    {parcel.paymentType === 'cod'
                      ? 'شحن ضد الدفع (COD تحصيل قيمة بضاعة)'
                      : parcel.paymentType === 'collect'
                      ? 'أجور الشحن على المستلم'
                      : 'مدفوع مسبقاً'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>فرع التسليم:</span>
                  <span className="text-slate-200 font-medium">{currentBranch.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>أمين الصندوق المسؤول:</span>
                  <span className="text-emerald-300 font-bold">{currentUser.name}</span>
                </div>
              </div>
            </div>

            {/* Financial Breakdown Card */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  تفاصيل المبالغ المفوترة على الطرد:
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  حسب قيود بوليصة الشحن
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">أجور الشحن</span>
                  <span className="font-mono font-bold text-slate-200">
                    {shippingAmount > 0
                      ? formatCurrency(shippingAmount, shippingCur)
                      : '0'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">قيمة البضاعة (COD)</span>
                  <span className="font-mono font-bold text-amber-400">
                    {codAmount > 0 ? formatCurrency(codAmount, codCur) : '0'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">عمولة التحويل</span>
                  <span className="font-mono font-bold text-slate-300">
                    {transferFee > 0 ? formatCurrency(transferFee, codCur) : '0'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-400 font-bold block mb-0.5">
                    المستحق المطلوب
                  </span>
                  <span className="font-mono font-black text-emerald-300">
                    {defaultSypDue > 0 && formatCurrency(defaultSypDue, 'SYP')}
                    {defaultSypDue > 0 && defaultUsdDue > 0 && ' + '}
                    {defaultUsdDue > 0 && formatCurrency(defaultUsdDue, 'USD')}
                    {defaultSypDue === 0 && defaultUsdDue === 0 && '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Accurate Cashier Input Form */}
            <div className="p-4 rounded-xl bg-slate-950/80 border-2 border-emerald-500/40 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  إدخال المبالغ المقبوضة فعلياً في الصندوق:
                </label>
                <span className="text-[10px] text-slate-400">
                  يجب إدخال المبلغ بدقة ليتم مطابقته بصندوق الفرع
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* SYP Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">المبلغ بالليرة السورية (SYP):</span>
                    {defaultSypDue > 0 && (
                      <button
                        type="button"
                        onClick={() => setSypAmount(defaultSypDue)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-medium"
                      >
                        كامل المطلوب ({formatNumber(defaultSypDue)})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={sypAmount || ''}
                      onChange={(e) => setSypAmount(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full h-10 px-3 pl-12 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute left-3 top-2.5 text-[11px] font-bold text-slate-400 font-mono">
                      ل.س
                    </span>
                  </div>
                </div>

                {/* USD Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">المبلغ بالدولار الأمريكي (USD):</span>
                    {defaultUsdDue > 0 && (
                      <button
                        type="button"
                        onClick={() => setUsdAmount(defaultUsdDue)}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-medium"
                      >
                        كامل المطلوب (${formatNumber(defaultUsdDue)})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={usdAmount || ''}
                      onChange={(e) => setUsdAmount(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full h-10 px-3 pl-10 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-400 font-mono">
                      $
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <span className="text-xs text-slate-300 font-medium block">طريقة التحصيل:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>نقداً (كاش)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === 'bank_transfer'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>حوالة مصرفية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === 'online'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>دفع إلكتروني</span>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">ملاحظات أمين الصندوق / سند القبض (اختياري):</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: تم القبض بموجب إيصال صندوق رقم 123..."
                  className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Summary of Action and Immediate Next Step */}
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <p className="font-bold text-white">الأثر المالي والتشغيلي المباشر:</p>
                  <p className="text-[11px] text-emerald-200">
                    سيتم إيداع مبلغ{' '}
                    <strong className="text-white font-mono">
                      {totalDepositingSyp > 0 ? formatCurrency(totalDepositingSyp, 'SYP') : ''}
                      {totalDepositingSyp > 0 && totalDepositingUsd > 0 ? ' + ' : ''}
                      {totalDepositingUsd > 0 ? formatCurrency(totalDepositingUsd, 'USD') : ''}
                      {totalDepositingSyp === 0 && totalDepositingUsd === 0 ? '0' : ''}
                    </strong>{' '}
                    في صندوق فرع <strong>{currentBranch.name}</strong>، وإرسال إشعار فوري عاجل لقسم التسليم يفيد بقبض
                    المبلغ وأن الطرد جاهز للتسليم مباشرة للمستلم.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!isSuccess && (
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-t border-slate-800">
            <button
              type="button"
              onClick={closeCashierCollectModal}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            >
              إلغاء وتراجع
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تأكيد القبض وإيداع المبلغ في الصندوق</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
