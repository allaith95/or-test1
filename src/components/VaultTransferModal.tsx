import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useOrca } from '../context/OrcaContext';
import { Currency, FinancialVoucher } from '../types';
import { ArrowRightLeft, Building2, Coins, User, FileText, CheckCircle2, AlertTriangle, X, ShieldCheck } from 'lucide-react';

interface VaultTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (voucher: FinancialVoucher) => void;
}

export const VaultTransferModal: React.FC<VaultTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    currentBranch,
    currentBranchWithDerivedBalance,
    branches,
    currentUser,
    addFinancialVoucher,
    formatCurrency,
  } = useOrca();

  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('SYP');
  const [amount, setAmount] = useState<number>(0);
  const [carrierName, setCarrierName] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<string>('تغذية سيولة صندوق الفرع');
  const [description, setDescription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !currentBranch) return null;

  // Filter valid target branches (excluding current branch)
  const availableTargetBranches = branches.filter((b) => b.id !== currentBranch.id && b.isActive);

  // Available vault balance in current branch
  const availableBalance = currency === 'SYP' ? currentBranchWithDerivedBalance.boxSypBalance || 0 : currentBranchWithDerivedBalance.boxUsdBalance || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!targetBranchId) {
      setErrorMsg('يرجى اختيار الفرع المستلم للمناقلة.');
      return;
    }

    if (!amount || amount <= 0) {
      setErrorMsg('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    if (amount > availableBalance) {
      setErrorMsg(`المبلغ المطلوب (${formatCurrency(amount, currency)}) يتجاوز الرصيد المتوفر حالياً بالصندوق (${formatCurrency(availableBalance, currency)}).`);
      return;
    }

    const targetBranch = branches.find((b) => b.id === targetBranchId);

    const newVoucher = addFinancialVoucher({
      type: 'transfer',
      branchId: currentBranch.id,
      counterpartyBranchId: targetBranchId,
      currency,
      amount,
      paidByOrTo: carrierName.trim() ? `بواسطة الموصل: ${carrierName.trim()} -> فرع ${targetBranch?.name}` : `فرع ${targetBranch?.name}`,
      reasonCategory,
      description: description.trim() || `مناقلة صناديق من فرع [${currentBranch.name}] إلى فرع [${targetBranch?.name || ''}]`,
      performedByUserId: currentUser.id,
      performedByUserName: currentUser.name || currentUser.username,
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
      cashboxScope: 'master',
    });

    onSuccess(newVoucher);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>سند مناقلة صناديق بين الفروع</span>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] rounded-full font-mono">
                  حصري لمدراء الفروع
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تحويل ونقل السيولة النقدية المباشرة من صندوق فرعك إلى صندوق فرع آخر
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs font-bold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current Source Branch Vault Status Box */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-400 block">الفرع المصدر (الصندوق المحول منه):</span>
              <span className="text-sm font-bold text-cyan-300 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span>{currentBranch.name}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">الرصيد المتاح (SYP):</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(currentBranchWithDerivedBalance.boxSypBalance || 0, 'SYP')}</span>
              </div>
              <div className="h-6 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400 block text-[10px]">الرصيد المتاح (USD):</span>
                <span className="text-amber-400 font-bold">{formatCurrency(currentBranchWithDerivedBalance.boxUsdBalance || 0, 'USD')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Branch Dropdown */}
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">
                الفرع المستلم (الصندوق المحول إليه) <span className="text-rose-400">*</span>
              </label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                required
              >
                <option value="">-- اختر الفرع المستلم --</option>
                {availableTargetBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.governorate}) {b.type === 'agent' ? '[مكتب وكيل]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">عملة التحويل والمناقلة</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency('SYP')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    currency === 'SYP'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>ليرة سورية (SYP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>دولار أمريكي (USD)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount Input */}
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">
                المبلغ المراد مناقلته <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={availableBalance}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 font-mono focus:outline-none focus:border-purple-500 pl-16"
                  required
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 font-mono">
                  {currency}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                الحد الأقصى المتاح: {formatCurrency(availableBalance, currency)}
              </span>
            </div>

            {/* Carrier / Driver Name */}
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">
                اسم السائق / الموصل المعتمد للنقل (اختياري)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  placeholder="مثال: السائق أبو خالد / عهدة نقل"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500 pl-8"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Reason Category */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1 block">تصنيف وسبب المناقلة</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
            >
              <option value="تغذية سيولة صندوق الفرع">تغذية سيولة صندوق الفرع (تأمين سيولة تسليم الحوالات والـ COD)</option>
              <option value="تصفية عهدة مالية ومقاصة داخلية">تصفية عهدة مالية ومقاصة داخلية بين الصناديق</option>
              <option value="مناقلة نقدية دورية بين الفروع">مناقلة نقدية دورية بين الفروع مع شاحنة النقل</option>
              <option value="تحويل أرباح وإيرادات للفرع الرئيسي">تحويل أرباح وإيرادات للفرع الرئيسي</option>
            </select>
          </div>

          {/* Description & Notes */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1 block">بيان وملاحظات السند التفصيلية</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب أي ملاحظات إضافية بخصوص كيس السيولة المنقول أو تفاصيل التسليم..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Confirmation Notice */}
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-2.5 text-[11px] text-purple-200">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>
              سيتم خصم المبلغ فوراً من صندوق فرعكم ({currentBranch.name}) وقيده لصالح صندوق الفرع المستلم، وإصدار سند مناقلة صناديق رسمي برقم مرجعي تلقائي مع إشعار مدير الفرع المستلم.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>إصدار وتأكيد سند مناقلة الصناديق ⇄</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
