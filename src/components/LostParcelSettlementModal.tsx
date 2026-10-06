import React, { useState } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Currency } from '../types';
import {
  ShieldAlert,
  Coins,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Phone,
  Building2,
  Package,
  RotateCcw,
  Sparkles,
  Lock,
  Info,
  Check,
  Building,
  MapPin,
} from 'lucide-react';

export const LostParcelSettlementModal: React.FC = () => {
  const {
    isLostParcelSettlementModalOpen,
    selectedLostParcelForSettlement,
    closeLostParcelSettlementModal,
    settleLostParcel,
    branches,
    currentUser,
    formatCurrency,
  } = useOrca();

  const parcel = selectedLostParcelForSettlement;
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [settlementMode, setSettlementMode] = useState<'compensation' | 'found_later'>('compensation');
  const [compensationAmount, setCompensationAmount] = useState<number>(() => {
    if (!parcel) return 0;
    return parcel.codAmount > 0 ? parcel.codAmount : parcel.priceSyp || 250000;
  });
  const [currency, setCurrency] = useState<Currency>(() => parcel?.currency || 'SYP');
  const [beneficiaryName, setBeneficiaryName] = useState<string>(() => parcel?.sender?.name || parcel?.receiver?.name || '');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState<string>(() => parcel?.sender?.phone || parcel?.receiver?.phone || '');
  const [responsibleParty, setResponsibleParty] = useState<'company' | 'driver' | 'insurance' | 'shared'>('company');
  const [targetFoundBranchId, setTargetFoundBranchId] = useState<string>(() => parcel?.originHubId || parcel?.destinationHubId || '');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLostParcelSettlementModalOpen || !parcel) {
    return null;
  }

  const originBranch = branches.find((b) => b.id === parcel.originHubId);
  const destBranch = branches.find((b) => b.id === parcel.destinationHubId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setIsSubmitting(true);
    try {
      settleLostParcel(parcel.id, settlementMode, {
        compensationAmount: Number(compensationAmount),
        currency,
        beneficiaryName,
        beneficiaryPhone,
        responsibleParty,
        notes,
        targetFoundBranchId,
      });
      closeLostParcelSettlementModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-slate-900 p-5 border-b border-rose-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">تسوية ومعالجة طرد مفقود</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  صلاحية مدير التطبيق حصراً
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                البوليصة: <span className="font-mono font-bold text-rose-300">{parcel.trackingNumber}</span> | من فرع ({originBranch?.name || 'الصادر'}) إلى ({destBranch?.name || 'الوجهة'})
              </p>
            </div>
          </div>
          <button
            onClick={closeLostParcelSettlementModal}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        {!isSuperAdmin ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-white">إجراءات التسوية محصورة بمدير التطبيق</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              وفقاً لسياسة الشركة، يتم البت في ملفات الطرود المفقودة وتحديد مسار التسوية (التعويض المالي الإداري أو تأكيد العثور على الطرد) حصراً من قبل مدير التطبيق لضمان الحوكمة ودقة القيود.
            </p>
            <button
              type="button"
              onClick={closeLostParcelSettlementModal}
              className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
              {/* Parcel Summary Card */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">المرسل (فرع الصادر)</span>
                  <span className="text-white font-bold">{parcel.sender?.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono block">{parcel.sender?.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">المستلم (الوجهة)</span>
                  <span className="text-white font-bold">{parcel.receiver?.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono block">{parcel.receiver?.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">نوع ومواصفات الطرد</span>
                  <span className="text-slate-200">{parcel.packageType} ({parcel.weightKg} كغ)</span>
                  <span className="text-[10px] text-slate-400 block truncate">{parcel.contentDescription}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">قيمة البضاعة / الشحن</span>
                  <span className="font-mono font-bold text-emerald-400 block">
                    {formatCurrency(parcel.codAmount > 0 ? parcel.codAmount : parcel.shippingCost, parcel.currency)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {parcel.paymentType === 'cod' ? 'شحنة تحصيل ثمن (COD)' : 'شحن مسبق / قياسي'}
                  </span>
                </div>
              </div>

              {/* Settlement Path Selector (The 2 exact paths requested) */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-200 block">
                  حدد مسار التسوية المعتمد من قبل الإدارة:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Path 1: Administrative Compensation (No cashbox deduction) */}
                  <button
                    type="button"
                    onClick={() => setSettlementMode('compensation')}
                    className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between gap-2 cursor-pointer ${
                      settlementMode === 'compensation'
                        ? 'bg-rose-950/40 border-rose-500 text-white shadow-xl shadow-rose-950/40 ring-1 ring-rose-500/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <Coins className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-black text-rose-300">المسار الأول: تسوية وتعويض مالي</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white mb-1">تسوية إدارية وتعويض مالي</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        توثيق تسوية إدارية رسمية مع تعويض الزبون دون التأثير المالي على الصناديق اليومية للموظفين.
                      </p>
                    </div>
                  </button>

                  {/* Path 2: Recovered / Found (Restores to active logistics) */}
                  <button
                    type="button"
                    onClick={() => setSettlementMode('found_later')}
                    className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between gap-2 cursor-pointer ${
                      settlementMode === 'found_later'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-xl shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-black text-emerald-300">المسار الثاني: تم العثور على الطرد</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white mb-1">تم العثور على الطرد واستعادته</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        إلغاء حالة الفقدان فوراً وإعادة الطرد لوضعه السابق القابل للشحن أو التسليم.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Form Fields according to selected Mode */}
              {settlementMode === 'compensation' ? (
                <div className="space-y-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 animate-fadeIn">
                  {/* Notice Banner about no cashier drawer impact */}
                  <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      <strong>ملاحظة محاسبية وإدارية:</strong> يتم تسجيل هذا التعويض كبند تسوية إدارية معتمد برقم توثيقي خاص، ولا يُخصم من الصناديق النقدية اليومية للموظفين بالفروع.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        مبلغ التعويض المعتمد:
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={compensationAmount}
                        onChange={(e) => setCompensationAmount(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">عملة التعويض:</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as Currency)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-rose-500 cursor-pointer"
                      >
                        <option value="SYP">ليرة سورية (SYP)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        اسم المستفيد (مستلم التعويض):
                      </label>
                      <input
                        type="text"
                        required
                        value={beneficiaryName}
                        onChange={(e) => setBeneficiaryName(e.target.value)}
                        placeholder="المرسل أو المستلم المستحق..."
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        رقم هاتف المستفيد:
                      </label>
                      <input
                        type="text"
                        value={beneficiaryPhone}
                        onChange={(e) => setBeneficiaryPhone(e.target.value)}
                        placeholder="رقم الهاتف للتواصل..."
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      الجهة المسؤولة عن تغطية الخسارة:
                    </label>
                    <select
                      value={responsibleParty}
                      onChange={(e) => setResponsibleParty(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-rose-500 cursor-pointer"
                    >
                      <option value="company">حساب أمانات وخسائر الشركة 100%</option>
                      <option value="driver">سائق الشاحنة المكلف بالنقل</option>
                      <option value="insurance">شركة التأمين</option>
                      <option value="shared">تقاسم مشترك بين الأطراف</option>
                    </select>
                  </div>
                </div>
              ) : (
                /* Mode 2: Found & Restored */
                <div className="space-y-4 bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/30 animate-fadeIn">
                  <div>
                    <label className="text-[11px] font-bold text-emerald-300 block mb-1.5">
                      حدد الفرع / المستودع الذي تم العثور على الطرد فيه:
                    </label>
                    <select
                      value={targetFoundBranchId}
                      onChange={(e) => setTargetFoundBranchId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-emerald-500/40 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          فرع {b.name} ({b.city}) {b.id === parcel.originHubId ? '◄ (فرع الصادر - يعود للشحن بالمانافيست القادم)' : b.id === parcel.destinationHubId ? '◄ (فرع الوجهة - يعود للتسليم الفوري)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 bg-emerald-900/20 rounded-xl border border-emerald-500/20 text-xs text-emerald-200/90 flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      {targetFoundBranchId === parcel.originHubId ? (
                        <span>
                          سيعود الطرد فوراً إلى <strong>مستودع فرع الصادر</strong> بحالة تشغيلية جاهزة لإدراجه في مانافيست شاحنة جديدة إلى الوجهة.
                        </span>
                      ) : (
                        <span>
                          سيعود الطرد فوراً إلى <strong>مستودع الاستلام بالوجهة</strong> ويصبح جاهزاً للتسليم المباشر أو التوزيع للزبون.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  ملاحظات ومحضر قرار الإدارة:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أدخل أي ملاحظات تفصيلية لقرار التسوية والاعتماد..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 custom-scrollbar"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-950/90 p-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeLostParcelSettlementModal}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-2.5 rounded-xl text-white font-black text-xs flex items-center gap-2 shadow-lg cursor-pointer transition active:scale-95 disabled:opacity-50 ${
                  settlementMode === 'compensation'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-rose-950/50'
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-emerald-950/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {settlementMode === 'compensation'
                    ? 'اعتماد التسوية والتعويض الإداري'
                    : 'تأكيد العثور وإعادة الطرد للشحن/التسليم'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
