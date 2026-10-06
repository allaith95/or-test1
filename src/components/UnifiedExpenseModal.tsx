import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOrca } from '../context/OrcaContext';
import { Expense, ExpenseCategory, Currency, CashboxScope, UserRole } from '../types';
import { FormattedAmountInput } from './FormattedAmountInput';
import {
  blockNonAmountKeys,
  sanitizeDecimal,
} from '../utils/numberSanitizer';
import {
  Receipt,
  Building2,
  Coins,
  User,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Upload,
  Truck,
  Box,
  Wallet,
  Clock,
  Sparkles,
  Tag,
  Maximize2,
  Trash2,
  Layers,
} from 'lucide-react';

interface UnifiedExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (expense: Expense) => void;
  initialBranchId?: string;
  initialAssetId?: string;
  initialVehicleId?: string;
}

export const UnifiedExpenseModal: React.FC<UnifiedExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialBranchId,
  initialAssetId,
  initialVehicleId,
}) => {
  const {
    currentBranch,
    branches,
    currentUser,
    expenseCategories,
    vehicles,
    fixedAssets,
    brandingSettings,
    addExpense,
    formatCurrency,
    formatNumber,
    getRoleCashboxData,
    ensureServerConnected,
  } = useOrca();

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState<ExpenseCategory>('وقود ومحروقات');
  const [branchId, setBranchId] = useState(initialBranchId || currentBranch?.id || '');
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<Currency>('SYP');
  const [paidTo, setPaidTo] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoicePhotoUrl, setInvoicePhotoUrl] = useState('');
  const [isLinkedToVehicle, setIsLinkedToVehicle] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [isLinkedToAsset, setIsLinkedToAsset] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Track previous isOpen state to only reset fields on fresh opening
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Fresh open: completely clear/reset fields for a new voucher
      setTitle('');
      setAmount(0);
      setPaidTo('');
      setInvoiceNumber('');
      setInvoicePhotoUrl('');
      setNotes('');
      setErrorMsg('');
      setCurrency('SYP');

      // Initialize default category
      const firstCat = expenseCategories[0] || {
        id: 'cat_fuel',
        name: 'وقود ومحروقات',
      };
      setCategoryId(firstCat.id);
      setCategoryName(firstCat.name as ExpenseCategory);

      // Context bindings
      setBranchId(initialBranchId || currentBranch?.id || (branches[0]?.id ?? ''));
      setVehicleId(initialVehicleId || '');
      setIsLinkedToVehicle(Boolean(initialVehicleId));
      setAssetId(initialAssetId || '');
      setIsLinkedToAsset(Boolean(initialAssetId));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, expenseCategories, currentBranch, branches, initialBranchId, initialAssetId, initialVehicleId]);

  if (!isOpen) return null;

  const targetBranch = branches.find((b) => b.id === branchId) || currentBranch;

  // Auto-bind role cashbox data (No manual cashbox selector needed)
  const roleBoxData = getRoleCashboxData
    ? getRoleCashboxData(currentUser.role as UserRole, targetBranch?.id || currentBranch?.id)
    : {
        scope: 'outgoing' as CashboxScope,
        boxName: 'صندوق العمليات',
        branchName: targetBranch?.name || currentBranch?.name || 'الفرع الرئيسي',
        fullTitle: 'صندوق ' + (targetBranch?.name || ''),
        syp: 0,
        usd: 0,
      };

  const selectedCatObj = expenseCategories.find(
    (c) => c.id === categoryId || c.name === categoryName
  ) || expenseCategories[0];

  // Check approval requirements
  const requiresManagerApproval = selectedCatObj ? selectedCatObj.requiresManagerApproval : false;
  const isDirectApproval = currentUser.role === 'super_admin' || !requiresManagerApproval;

  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId);
    const found = expenseCategories.find((c) => c.id === catId);
    if (found) {
      setCategoryName(found.name as ExpenseCategory);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoicePhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const ok = await ensureServerConnected();
    if (!ok) return;

    if (!title.trim()) {
      setErrorMsg('يرجى إدخال بيان أو عنوان المصروف.');
      return;
    }

    if (!paidTo.trim()) {
      setErrorMsg('يرجى إدخال اسم المستفيد / المدفوع له.');
      return;
    }

    if (!amount || amount <= 0) {
      setErrorMsg('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    const createdExpense = addExpense({
      title: title.trim(),
      category: selectedCatObj ? (selectedCatObj.name as ExpenseCategory) : categoryName,
      categoryId: selectedCatObj ? selectedCatObj.id : categoryId,
      branchId: targetBranch?.id || currentBranch.id,
      vehicleId: isLinkedToVehicle && vehicleId ? vehicleId : undefined,
      assetId: isLinkedToAsset && assetId ? assetId : undefined,
      amount,
      currency,
      paidTo: paidTo.trim(),
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoicePhotoUrl: invoicePhotoUrl || undefined,
      paymentMethod: 'cash_box', // Direct cashbox disbursement automatically
      paidByUserId: currentUser.id,
      performedByUserName: currentUser.name || currentUser.username,
      cashboxScope: roleBoxData.scope, // Automatically debited from user's role cashbox
      requiresApproval: requiresManagerApproval,
      status: isDirectApproval ? 'approved' : 'pending',
      date: new Date().toISOString().split('T')[0],
      notes: notes.trim() || undefined,
    });

    if (onSuccess) {
      onSuccess(createdExpense);
    }

    onClose();
  };

  return createPortal(
    <div
      id="unified_expense_modal_overlay"
      className="fixed inset-0 z-[220] w-screen h-screen h-[100dvh] bg-slate-950 text-slate-100 flex flex-col overflow-hidden m-0 p-0 animate-in fade-in duration-200 font-['Cairo',sans-serif] select-none"
    >
      <div className="bg-slate-900 w-full h-full flex flex-col overflow-hidden">
        {/* Fullscreen Modal Header */}
        <div className="px-5 py-3.5 sm:px-8 sm:py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500/20 via-amber-500/20 to-orange-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>سند صرف نفقات ومصروفات</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-rose-400" />
                  <span>إصدار سند صرف رسمي</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono font-bold">
                  {new Date().toISOString().split('T')[0]}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                قيد خصم مالي مباشر وموثق من صندوق الدور والفرع مع إصدار السند بالتوازي
              </p>
            </div>
          </div>
        </div>

        {/* User & Automatic Role Cashbox Context Bar */}
        <div className="px-5 py-3 sm:px-8 bg-slate-950/70 border-b border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 block font-medium">المستخدم منشئ السند:</span>
              <span className="font-bold text-white truncate block">
                {currentUser.name || currentUser.username}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 block font-medium">الفرع المسجل عليه:</span>
              <span className="font-bold text-cyan-300 truncate block">
                {targetBranch?.name}
              </span>
            </div>
          </div>

          {/* Role Box (Automatic Cashbox - No manual selection) */}
          <div className="flex items-center gap-2.5 bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/30">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-amber-300/80 block font-medium">الصندوق المقتطع منه تلقائياً:</span>
              <span className="font-black text-amber-300 truncate block">
                {roleBoxData.boxName}
              </span>
            </div>
          </div>

          {/* Category Approval Status */}
          <div className="flex items-center gap-2.5 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isDirectApproval
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
              }`}
            >
              {isDirectApproval ? <ShieldCheck className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-slate-400 block font-medium">حالة اعتماد الفئة:</span>
              <span
                className={`font-bold text-xs truncate block ${
                  isDirectApproval ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {isDirectApproval ? 'صرف مباشر فوري' : 'يتطلب موافقة المدير'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Main Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1 flex flex-col justify-between space-y-6 custom-scrollbar">
          <div className="w-full space-y-6 flex-1">
            {errorMsg && (
              <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs font-bold text-rose-300 flex items-center gap-3 shadow-lg shadow-rose-950/40 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Main Form Fields Grid - Expanded Horizontally */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
              {/* Right/Primary Column (6 Cols on desktop) */}
              <div className="lg:col-span-6 space-y-5">
                {/* Title / Statement */}
                <div>
                  <label className="text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                    <span>
                      بيان أو عنوان المصروف التفصيلي <span className="text-rose-400">*</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      (سبب الصرف بوضوح)
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    id="voucher_title_input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: تعبئة وقود مازوت لشاحنة النقل / شراء قرطاسية وأوراق فواتير / صيانة طابعات الباركود"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-2xl px-4 py-3 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:font-normal placeholder:text-slate-500"
                  />
                  {/* Quick Suggestions Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[10px] text-slate-500">اقتراحات سريعة:</span>
                    {[
                      'تعبئة وقود ومحروقات',
                      'شراء قرطاسية ومطبوعات',
                      'أجور صيانة وتصليح',
                      'ضيافة ومستلزمات مكتبية',
                      'نثريات تشغيلية وطوارئ',
                    ].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setTitle(sug)}
                        className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] border border-slate-700 transition"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Selection Section with Fixed Dropdown & Badges */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-amber-400" />
                      <span>
                        تصنيف وبند المصروف <span className="text-rose-400">*</span>
                      </span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      (اختر التصنيف المالي المناسب)
                    </span>
                  </div>

                  <select
                    id="expense_category_select"
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
                  >
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.requiresManagerApproval ? '— [يتطلب موافقة المدير]' : '— [صرف مباشر معتمد]'}
                      </option>
                    ))}
                  </select>

                  {/* Category Quick Selector Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {expenseCategories.slice(0, 8).map((c) => {
                      const isSelected = c.id === categoryId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCategoryChange(c.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-rose-500/25 text-rose-300 border-rose-500/60 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Beneficiary / Paid To */}
                <div>
                  <label className="text-xs font-bold text-slate-200 mb-1.5 block">
                    الجهة المستفيدة / المدفوع له (المستلم) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    id="voucher_paid_to_input"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    placeholder="مثال: محطة وقود النور / شركة الأهرام للمطبوعات / الفني أحمد / السائق سامر"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:font-normal placeholder:text-slate-500 shadow-inner"
                  />
                </div>

                {/* Action Buttons Placed Clearly Under Beneficiary */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="submit"
                    id="submit_expense_voucher_btn"
                    className="flex-1 py-3.5 px-6 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-2xl text-sm sm:text-base font-black flex items-center justify-center gap-2.5 shadow-xl shadow-rose-950/60 hover:shadow-rose-900/80 transition-all cursor-pointer border border-rose-400/30 active:scale-[0.99]"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>إصدار وقيد سند الصرف المالي</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    id="cancel_expense_voucher_btn"
                    className="py-3.5 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700 active:scale-[0.99] shrink-0"
                  >
                    <X className="w-4 h-4" />
                    <span>إلغاء وخروج</span>
                  </button>
                </div>
              </div>

              {/* Left/Financial & Detail Column (6 Cols on desktop) */}
              <div className="lg:col-span-6 space-y-5">
                {/* Amount & Currency Section */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      <span>
                        المبلغ المصروف <span className="text-rose-400">*</span>
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-7 relative">
                      <FormattedAmountInput
                        required
                        id="voucher_amount_input"
                        value={amount}
                        currency={currency}
                        onChange={(num) => setAmount(num)}
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-base sm:text-lg text-emerald-400 font-mono font-black focus:outline-none pl-16 shadow-inner"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                        {currency}
                      </span>
                    </div>

                    <div className="sm:col-span-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrency('SYP')}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                          currency === 'SYP'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        <span>ليرة (SYP)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrency('USD')}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                          currency === 'USD'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        <span>دولار (USD)</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Add Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500">زيادة سريعة:</span>
                    {currency === 'SYP' ? (
                      <>
                        {[50000, 100000, 250000, 500000, 1000000, 5000000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAmount((prev) => prev + val)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-slate-700 text-[11px] font-mono rounded-lg transition"
                          >
                            +{formatNumber(val)}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {[10, 20, 50, 100, 500, 1000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAmount((prev) => prev + val)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-slate-700 text-[11px] font-mono rounded-lg transition"
                          >
                            +${val}
                          </button>
                        ))}
                      </>
                    )}
                    {amount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(0)}
                        className="px-2.5 py-1 text-rose-400 hover:text-rose-300 text-[11px] font-bold transition mr-auto"
                      >
                        تفريغ
                      </button>
                    )}
                  </div>
                </div>

                {/* Invoice Number & Document Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      رقم الفاتورة / الإيصال المرجعي
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="مثال: INV-9842 / إيصال 55"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      صورة الفاتورة أو الإيصال
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 border border-dashed border-slate-700 hover:border-rose-500 bg-slate-950 rounded-xl p-2 text-center cursor-pointer transition flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white">
                        <Upload className="w-3.5 h-3.5 text-rose-400" />
                        <span className="truncate">{invoicePhotoUrl ? 'تغيير الصورة' : 'رفع إيصال'}</span>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                      {invoicePhotoUrl && (
                        <div className="relative w-8 h-8 rounded-lg border border-slate-700 overflow-hidden shrink-0 bg-slate-950">
                          <img src={invoicePhotoUrl} alt="Receipt" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Optional Vehicle & Fixed Asset Linkage */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">
                      ربط بمركبة أو أصل ثابت (اختياري)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Link Vehicle */}
                    <div>
                      <label className="flex items-center gap-1.5 cursor-pointer mb-1">
                        <input
                          type="checkbox"
                          checked={isLinkedToVehicle}
                          onChange={(e) => setIsLinkedToVehicle(e.target.checked)}
                          className="rounded border-slate-700 text-rose-500 focus:ring-rose-500/20"
                        />
                        <span className="text-xs text-slate-300 flex items-center gap-1">
                          <Truck className="w-3 h-3 text-amber-400" />
                          <span>ربط بمركبة</span>
                        </span>
                      </label>
                      {isLinkedToVehicle && (
                        <select
                          value={vehicleId}
                          onChange={(e) => setVehicleId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        >
                          <option value="">-- اختر المركبة --</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              [{v.code}] {v.plateNumber}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Link Fixed Asset */}
                    <div>
                      <label className="flex items-center gap-1.5 cursor-pointer mb-1">
                        <input
                          type="checkbox"
                          checked={isLinkedToAsset}
                          onChange={(e) => setIsLinkedToAsset(e.target.checked)}
                          className="rounded border-slate-700 text-rose-500 focus:ring-rose-500/20"
                        />
                        <span className="text-xs text-slate-300 flex items-center gap-1">
                          <Box className="w-3 h-3 text-cyan-400" />
                          <span>ربط بأصل ثابت</span>
                        </span>
                      </label>
                      {isLinkedToAsset && (
                        <select
                          value={assetId}
                          onChange={(e) => setAssetId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        >
                          <option value="">-- اختر الأصل --</option>
                          {fixedAssets.map((a) => (
                            <option key={a.id} value={a.id}>
                              [{a.assetCode}] {a.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    ملاحظات وبيان إضافي (اختياري)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أي توضيحات أو تفاصيل محاسبية إضافية..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Clean Streamlined Footer Bar without duplicate buttons */}
          <div className="w-full pt-3.5 border-t border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>الخصم المالي المباشر: <strong className="text-amber-300 font-bold">{roleBoxData.boxName}</strong></span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
              <span>{targetBranch?.name || 'الفرع الرئيسي'}</span>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
