import React, { useState } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Expense, ExpenseCategory, ExpenseCategoryItem, Currency, CashboxScope } from '../types';
import { FormattedAmountInput } from './FormattedAmountInput';
import {
  blockNonAmountKeys,
  sanitizeDecimal,
} from '../utils/numberSanitizer';
import {
  Receipt,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Building,
  Truck,
  DollarSign,
  Calendar,
  Filter,
  FileText,
  Upload,
  Image as ImageIcon,
  Check,
  X,
  CreditCard,
  Layers,
  Settings,
  ShieldCheck,
  Zap,
  BarChart3,
  PieChart,
  Tag,
  Sliders,
  CheckSquare,
  Sparkles,
  ArrowRight,
  Clock,
  Wallet,
} from 'lucide-react';

export const ExpensesDirectoryView: React.FC = () => {
  const {
    expenses,
    expenseCategories,
    addExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
    confirmExpenseDisbursement,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    toggleCategoryApprovalRequirement,
    branches,
    vehicles,
    fixedAssets,
    currentBranch,
    currentUser,
    setActiveModule,
    formatCurrency,
    formatNumber,
    getRoleCashboxData,
  } = useOrca();

  const [activeMainTab, setActiveMainTab] = useState<'records' | 'categories' | 'analytics'>('records');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedApprovalType, setSelectedApprovalType] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedCashboxScope, setSelectedCashboxScope] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingReceiptExpense, setViewingReceiptExpense] = useState<Expense | null>(null);

  // Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryItem | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    code: '',
    description: '',
    requiresManagerApproval: true,
    maxDirectSpendLimitSyp: 1000000,
    color: '#06b6d4',
  });

  // Expense Form State
  const defaultScopeForRole: CashboxScope =
    currentUser.role === 'outbound_operator'
      ? 'outgoing'
      : currentUser.role === 'inbound_operator'
      ? 'incoming'
      : 'master';

  const [formData, setFormData] = useState<{
    title: string;
    category: ExpenseCategory;
    categoryId: string;
    branchId: string;
    cashboxScope: CashboxScope;
    vehicleId: string;
    isLinkedToAsset: boolean;
    assetId: string;
    amount: number;
    currency: Currency;
    paidTo: string;
    invoiceNumber: string;
    invoicePhotoUrl: string;
    date: string;
    paymentMethod: 'cash_box' | 'bank_transfer' | 'petty_cash';
    requiresApproval: boolean;
    status: 'approved' | 'pending' | 'rejected' | 'approved_waiting_disbursement';
    notes: string;
  }>({
    title: '',
    category: 'وقود ومحروقات' as ExpenseCategory,
    categoryId: 'cat_fuel',
    branchId: currentBranch.id,
    cashboxScope: defaultScopeForRole,
    vehicleId: '',
    isLinkedToAsset: false,
    assetId: '',
    amount: 0,
    currency: 'SYP' as Currency,
    paidTo: '',
    invoiceNumber: '',
    invoicePhotoUrl: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash_box' as 'cash_box' | 'bank_transfer' | 'petty_cash',
    requiresApproval: false,
    status: 'approved' as 'approved' | 'pending' | 'rejected' | 'approved_waiting_disbursement',
    notes: '',
  });

  const [receiptPreview, setReceiptPreview] = useState<string>('');

  // Find active category item config
  const selectedCategoryConfig = expenseCategories.find(
    (c) => c.id === formData.categoryId || c.name === formData.category
  );

  const roleBoxData = getRoleCashboxData
    ? getRoleCashboxData(currentUser.role, formData.branchId || currentBranch.id)
    : {
        scope: defaultScopeForRole,
        boxName: currentUser.role === 'outbound_operator' ? 'صندوق قسم الصادر' : currentUser.role === 'inbound_operator' ? 'صندوق قسم الوارد' : 'صندوق الإدارة والخزينة',
        branchName: branches.find((b) => b.id === (formData.branchId || currentBranch.id))?.name || currentBranch.name,
      };

  const openAddModal = () => {
    setEditingExpense(null);
    const initialCat = expenseCategories[0] || {
      id: 'cat_fuel',
      name: 'وقود ومحروقات',
      requiresManagerApproval: false,
    };
    setFormData({
      title: '',
      category: initialCat.name as ExpenseCategory,
      categoryId: initialCat.id,
      branchId: currentBranch.id,
      cashboxScope: roleBoxData.scope,
      vehicleId: '',
      isLinkedToAsset: false,
      assetId: '',
      amount: 0,
      currency: 'SYP',
      paidTo: '',
      invoiceNumber: '',
      invoicePhotoUrl: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash_box',
      requiresApproval: initialCat.requiresManagerApproval,
      status: initialCat.requiresManagerApproval && currentUser.role !== 'super_admin' ? 'pending' : 'approved',
      notes: '',
    });
    setReceiptPreview('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    const catItem = expenseCategories.find((c) => c.name === exp.category || c.id === exp.categoryId);
    setFormData({
      title: exp.title,
      category: exp.category,
      categoryId: exp.categoryId || catItem?.id || '',
      branchId: exp.branchId,
      cashboxScope: exp.cashboxScope || roleBoxData.scope,
      vehicleId: exp.vehicleId || '',
      isLinkedToAsset: Boolean(exp.assetId),
      assetId: exp.assetId || '',
      amount: exp.amount,
      currency: exp.currency,
      paidTo: exp.paidTo || '',
      invoiceNumber: exp.invoiceNumber || '',
      invoicePhotoUrl: exp.invoicePhotoUrl || '',
      date: exp.date || new Date().toISOString().split('T')[0],
      paymentMethod: exp.paymentMethod || 'cash_box',
      requiresApproval: exp.requiresApproval !== undefined ? exp.requiresApproval : (catItem?.requiresManagerApproval ?? false),
      status: exp.status,
      notes: exp.notes || '',
    });
    setReceiptPreview(exp.invoicePhotoUrl || '');
    setIsAddModalOpen(true);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosenCat = expenseCategories.find((c) => c.id === e.target.value || c.name === e.target.value);
    if (chosenCat) {
      setFormData((prev) => ({
        ...prev,
        category: chosenCat.name as ExpenseCategory,
        categoryId: chosenCat.id,
        requiresApproval: chosenCat.requiresManagerApproval,
        status: chosenCat.requiresManagerApproval && currentUser.role !== 'super_admin' ? 'pending' : 'approved',
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReceiptPreview(result);
      setFormData((prev) => ({ ...prev, invoicePhotoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || formData.amount <= 0) {
      alert('يرجى إدخال عنوان المصروف والمبلغ بشكل صحيح');
      return;
    }

    const finalAssetId = formData.isLinkedToAsset && formData.assetId ? formData.assetId : undefined;

    if (editingExpense) {
      updateExpense(editingExpense.id, {
        ...formData,
        cashboxScope: roleBoxData.scope,
        paymentMethod: 'cash_box',
        assetId: finalAssetId,
        invoicePhotoUrl: receiptPreview,
      });
    } else {
      addExpense({
        ...formData,
        cashboxScope: roleBoxData.scope,
        paymentMethod: 'cash_box',
        assetId: finalAssetId,
        invoicePhotoUrl: receiptPreview,
        paidByUserId: currentUser.id,
      });
    }

    setIsAddModalOpen(false);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`هل أنت متأكد من حذف سند المصروف [${title}]؟`)) {
      deleteExpense(id);
    }
  };

  // Category Modal Handlers
  const openNewCategoryModal = () => {
    setEditingCategory(null);
    const nextIndex = expenseCategories.length + 1;
    setCategoryFormData({
      name: '',
      code: `EXP-CAT-${nextIndex < 10 ? '0' + nextIndex : nextIndex}`,
      description: '',
      requiresManagerApproval: true,
      maxDirectSpendLimitSyp: 1000000,
      color: '#06b6d4',
    });
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: ExpenseCategoryItem) => {
    setEditingCategory(cat);
    setCategoryFormData({
      name: cat.name,
      code: cat.code,
      description: cat.description || '',
      requiresManagerApproval: cat.requiresManagerApproval,
      maxDirectSpendLimitSyp: cat.maxDirectSpendLimitSyp || 1000000,
      color: cat.color || '#06b6d4',
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) return;

    if (editingCategory) {
      updateExpenseCategory(editingCategory.id, {
        ...categoryFormData,
      });
    } else {
      addExpenseCategory({
        ...categoryFormData,
        isActive: true,
      });
    }
    setIsCategoryModalOpen(false);
  };

  // Dynamic Assets filtered ONLY by the branch selected in the form
  const branchFixedAssets = fixedAssets.filter(
    (asset) => asset.branchId === formData.branchId && asset.condition !== 'decommissioned'
  );

  // Helper to fetch the latest maintenance date & history for the selected asset
  const getAssetMaintenanceInfo = (assetId: string) => {
    if (!assetId) return null;
    const asset = fixedAssets.find((a) => a.id === assetId);
    if (!asset) return null;

    // Previous expenses associated with this asset (excluding current editing expense)
    const linkedExpenses = expenses
      .filter((e) => e.assetId === asset.id && (!editingExpense || e.id !== editingExpense.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Look for maintenance specific expense or latest expense
    const maintenanceExpense =
      linkedExpenses.find((e) =>
        (e.category && e.category.includes('صيانة')) ||
        (e.title && e.title.includes('صيانة')) ||
        (e.notes && e.notes.includes('صيانة'))
      ) || linkedExpenses[0];

    const lastDate = maintenanceExpense?.date || asset.lastMaintenanceDate || null;

    let daysAgo: number | null = null;
    if (lastDate) {
      const diffMs = new Date().getTime() - new Date(lastDate).getTime();
      daysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      asset,
      lastDate,
      daysAgo,
      lastExpenseTitle: maintenanceExpense?.title || null,
      lastExpenseAmount: maintenanceExpense?.amount || null,
      lastExpenseCurrency: maintenanceExpense?.currency || null,
      totalLinkedExpensesCount: linkedExpenses.length,
    };
  };

  // Filtered expenses
  const filteredExpenses = expenses.filter((exp) => {
    const linkedAsset = exp.assetId ? fixedAssets.find((a) => a.id === exp.assetId) : null;
    const matchSearch =
      exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.expenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.paidTo && exp.paidTo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exp.invoiceNumber && exp.invoiceNumber.includes(searchTerm)) ||
      (linkedAsset &&
        (linkedAsset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          linkedAsset.assetCode.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchBranch = selectedBranch === 'all' || exp.branchId === selectedBranch;
    const matchCategory =
      selectedCategory === 'all' ||
      exp.category === selectedCategory ||
      exp.categoryId === selectedCategory;
    const matchStatus = selectedStatus === 'all' || exp.status === selectedStatus;
    const matchApproval =
      selectedApprovalType === 'all' ||
      (selectedApprovalType === 'requires_approval' && exp.requiresApproval) ||
      (selectedApprovalType === 'direct_spend' && !exp.requiresApproval);
    const matchUser = selectedUser === 'all' || exp.paidByUserId === selectedUser;
    const matchCashboxScope = selectedCashboxScope === 'all' || exp.cashboxScope === selectedCashboxScope;
    const matchCurrency = selectedCurrency === 'all' || exp.currency === selectedCurrency;

    return matchSearch && matchBranch && matchCategory && matchStatus && matchApproval && matchUser && matchCashboxScope && matchCurrency;
  });

  // Calculate stats
  const totalExpensesSyp = expenses
    .filter((e) => e.currency === 'SYP' && e.status === 'approved')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalExpensesUsd = expenses
    .filter((e) => e.currency === 'USD' && e.status === 'approved')
    .reduce((acc, e) => acc + e.amount, 0);

  const pendingExpensesCount = expenses.filter((e) => e.status === 'pending').length;
  const waitingDisbursementCount = expenses.filter((e) => e.status === 'approved_waiting_disbursement').length;

  const getBranchName = (bId: string) => {
    const found = branches.find((b) => b.id === bId);
    return found ? found.name : bId;
  };

  // Analytics Breakdown by Category
  const categoryAnalytics = expenseCategories.map((cat) => {
    const matchingExpenses = expenses.filter(
      (e) => (e.category === cat.name || e.categoryId === cat.id) && e.status === 'approved'
    );
    const totalSyp = matchingExpenses
      .filter((e) => e.currency === 'SYP')
      .reduce((acc, e) => acc + e.amount, 0);
    const totalUsd = matchingExpenses
      .filter((e) => e.currency === 'USD')
      .reduce((acc, e) => acc + e.amount, 0);
    const count = matchingExpenses.length;
    const percentageOfTotal = totalExpensesSyp > 0 ? (totalSyp / totalExpensesSyp) * 100 : 0;

    return {
      category: cat,
      totalSyp,
      totalUsd,
      count,
      percentageOfTotal,
    };
  }).sort((a, b) => b.totalSyp - a.totalSyp);

  return (
    <div className="w-full max-w-full space-y-6 pb-28">
      {/* Header & Mode Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              دليل وسجل المصاريف التشغيلية ومحرك الموافقات
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة بنود وأنواع المصاريف، ضبط صلاحيات الصرف المباشر أو بموافقة المدير، وتتبع نفقات الفروع والمركبات
            </p>
          </div>
        </div>

        {/* View Switcher Tabs & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setActiveMainTab('records')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeMainTab === 'records'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              سجل سندات المصاريف
            </button>

            <button
              onClick={() => setActiveMainTab('categories')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeMainTab === 'categories'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              دليل أنواع وفئات المصاريف ({expenseCategories.length})
            </button>

            <button
              onClick={() => setActiveMainTab('analytics')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeMainTab === 'analytics'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              الدراسة التحليلية والتجميع
            </button>
          </div>

          {activeMainTab === 'categories' ? (
            <button
              type="button"
              onClick={openNewCategoryModal}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-cyan-950/50"
            >
              <Plus className="w-4 h-4" />
              إضافة نوع مصروف جديد
            </button>
          ) : (
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-rose-950/50"
            >
              <Plus className="w-4 h-4" />
              تسجيل سند مصروف جديد
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-700/80 cursor-pointer"
            title="العودة إلى لوحة القيادة والرقابة"
          >
            <ArrowRight className="w-4 h-4 text-cyan-400" />
            <span>لوحة القيادة</span>
          </button>
        </div>
      </div>

      {/* Main Tab 1: Expense Records & Approval Queue */}
      {activeMainTab === 'records' && (
        <div className="space-y-6">
          {/* Stats Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium block mb-1">إجمالي النفقات المعتمدة (ل.س)</span>
              <span className="text-xl font-bold text-rose-400 font-mono">
                {formatCurrency(totalExpensesSyp || 0, 'SYP')}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">خصمت من صناديق الفروع</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium block mb-1">إجمالي النفقات (دولار)</span>
              <span className="text-2xl font-bold text-emerald-400 font-mono">
                {formatCurrency(totalExpensesUsd || 0, 'USD')}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">مصاريف وإيجارات بالدولار</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
              <span className="text-xs text-slate-400 font-medium block mb-1">سندات معتمدة بانتظار الصرف</span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-cyan-400 font-mono">{waitingDisbursementCount}</span>
                {waitingDisbursementCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                    جاهزة للصرف
                  </span>
                )}
              </div>
              <span className="text-[10px] text-cyan-500/80 block mt-1">يصرفها صاحب الطلب من صندوقه</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
              <span className="text-xs text-slate-400 font-medium block mb-1">سندات بانتظار موافقة المدير</span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-amber-400 font-mono">{pendingExpensesCount}</span>
                {pendingExpensesCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    تتطلب اعتماد
                  </span>
                )}
              </div>
              <span className="text-[10px] text-amber-500/80 block mt-1">لن تصرف إلا بعد موافقة الإدارة</span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث بعنوان المصروف، رقم السند، جهة الصرف، أو رقم الفاتورة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:border-rose-500 outline-none"
              />
            </div>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-rose-500 outline-none"
            >
              <option value="all">كل الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-rose-500 outline-none"
            >
              <option value="all">كل بنود ودلائل المصاريف</option>
              {expenseCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.requiresManagerApproval ? 'يحتاج موافقة' : 'صرف مباشر'})
                </option>
              ))}
            </select>

            <select
              value={selectedApprovalType}
              onChange={(e) => setSelectedApprovalType(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-rose-500 outline-none"
            >
              <option value="all">نوع شرط الصرف (الكل)</option>
              <option value="requires_approval">يتطلب موافقة مدير</option>
              <option value="direct_spend">صرف مباشر (بدون موافقة)</option>
            </select>

            <select
              value={selectedCashboxScope}
              onChange={(e) => setSelectedCashboxScope(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-rose-500 outline-none"
            >
              <option value="all">كل الصناديق والخزائن</option>
              <option value="master">الخزينة الرئيسية</option>
              <option value="outgoing">صندوق حركة الصادر</option>
              <option value="incoming">صندوق حركة الوارد</option>
            </select>

            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-rose-500 outline-none"
            >
              <option value="all">كل العملات</option>
              <option value="SYP">ليرة سورية (SYP)</option>
              <option value="USD">دولار أمريكي (USD)</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-rose-500 outline-none"
            >
              <option value="all">كل الحالات المالية</option>
              <option value="approved">معتمد ومصروف</option>
              <option value="approved_waiting_disbursement">معتمد وبانتظار تأكيد الصرف</option>
              <option value="pending">بانتظار موافقة الإدارة</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>

          {/* Expenses Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="p-3.5">رقم السند والتاريخ</th>
                    <th className="p-3.5">بيان المصروف</th>
                    <th className="p-3.5">التصنيف والدليل</th>
                    <th className="p-3.5">الفرع والجهة</th>
                    <th className="p-3.5">المبلغ والعملة</th>
                    <th className="p-3.5">شرط الصرف</th>
                    <th className="p-3.5">الفاتورة</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        لا توجد سندات مصاريف تطابق معايير التصفية المحددة
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const catItem = expenseCategories.find(
                        (c) => c.name === exp.category || c.id === exp.categoryId
                      );
                      const requiresApproval =
                        exp.requiresApproval !== undefined
                          ? exp.requiresApproval
                          : catItem?.requiresManagerApproval ?? false;

                      return (
                        <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3.5">
                            <span className="font-mono text-rose-400 font-bold block">{exp.expenseNumber}</span>
                            <span className="text-[10px] text-slate-500">{exp.date}</span>
                          </td>

                          <td className="p-3.5">
                            <span className="font-bold text-white block">{exp.title}</span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              {exp.vehicleId && (
                                <span className="text-[10px] text-amber-400 inline-flex items-center gap-1 font-mono bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/30">
                                  <Truck className="w-3 h-3" />
                                  مركبة: {vehicles.find((v) => v.id === exp.vehicleId)?.plateNumber || exp.vehicleId}
                                </span>
                              )}
                              {exp.assetId && (() => {
                                const assetObj = fixedAssets.find((a) => a.id === exp.assetId);
                                return (
                                  <span className="text-[10px] text-violet-300 inline-flex items-center gap-1 font-mono bg-violet-950/60 px-1.5 py-0.5 rounded border border-violet-800/40">
                                    <Layers className="w-3 h-3 text-violet-400" />
                                    أصل: {assetObj ? `${assetObj.name} (${assetObj.assetCode})` : exp.assetId}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span className="text-cyan-300 font-medium block">{exp.category}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {catItem?.code || 'EXP-CAT'}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className="text-white block">{getBranchName(exp.branchId)}</span>
                            <span className="text-[10px] text-slate-400">
                              {exp.paidTo || 'جهة غير محددة'}
                            </span>
                          </td>

                          <td className="p-3.5 font-mono font-bold text-rose-400 text-sm">
                            {formatCurrency(exp.amount || 0, exp.currency || 'SYP')}
                          </td>

                          <td className="p-3.5">
                            {requiresApproval ? (
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-amber-400" />
                                يحتاج موافقة مدير
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                                <Zap className="w-3 h-3 text-emerald-400" />
                                صرف مباشر
                              </span>
                            )}
                          </td>

                          <td className="p-3.5">
                            {exp.invoicePhotoUrl ? (
                              <button
                                type="button"
                                onClick={() => setViewingReceiptExpense(exp)}
                                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30"
                              >
                                <ImageIcon className="w-3 h-3" />
                                عرض الفاتورة
                              </button>
                            ) : (
                              <span className="text-slate-500 text-[11px]">بدون مرفق</span>
                            )}
                          </td>

                          <td className="p-3.5">
                            <div className="flex flex-col gap-1">
                              {exp.status === 'approved' ? (
                                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 w-fit">
                                  <CheckCircle className="w-3 h-3" />
                                  معتمد ومصروف
                                </span>
                              ) : exp.status === 'approved_waiting_disbursement' ? (
                                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/30 w-fit">
                                  <Clock className="w-3 h-3 text-cyan-400" />
                                  معتمد (بانتظار تأكيد الصرف)
                                </span>
                              ) : exp.status === 'rejected' ? (
                                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 border-rose-500/30 w-fit">
                                  <X className="w-3 h-3 text-rose-400" />
                                  مرفوض
                                </span>
                              ) : (
                                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold border inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border-amber-500/30 w-fit">
                                  <AlertCircle className="w-3 h-3" />
                                  بانتظار الموافقة
                                </span>
                              )}
                              
                              {exp.cashboxScope && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  الصندوق: {exp.cashboxScope === 'outgoing' ? 'الصادر' : exp.cashboxScope === 'incoming' ? 'الوارد' : 'الرئيسي'}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* زر موافقة المدير إذا كان السند بانتظار الموافقة */}
                              {exp.status === 'pending' && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => approveExpense(exp.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow flex items-center gap-1"
                                    title="الموافقة على طلب الصرف"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    موافقة الإدارة
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const reason = window.prompt('يرجى كتابة سبب رفض الصرف (اختياري):');
                                      if (reason !== null) rejectExpense(exp.id, reason || undefined);
                                    }}
                                    className="p-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/40 text-rose-300 transition text-[11px]"
                                    title="رفض الطلب"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* زر تأكيد الصرف الفعلي من صندوق طالب الصرف بعد موافقة المدير */}
                              {exp.status === 'approved_waiting_disbursement' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = confirmExpenseDisbursement(exp.id);
                                    if (!res.success && res.message) {
                                      alert(res.message);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[11px] transition shadow flex items-center gap-1.5 animate-pulse"
                                  title={`تأكيد الصرف المالي وخصم المبلغ من صندوق (${exp.cashboxScope === 'outgoing' ? 'الصادر' : exp.cashboxScope === 'incoming' ? 'الوارد' : 'الفرع'})`}
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  تأكيد الصرف من صندوقي
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openEditModal(exp)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition"
                                title="تعديل السند"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(exp.id, exp.title)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 2: Expense Categories Directory & Approval Rules */}
      {activeMainTab === 'categories' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  دليل أنواع وفئات المصاريف المعرفة وسياسات الاعتماد
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  يمكن للمدير تحديد شرط الصرف لكل نوع مصروف (موافقة مسبقة أم صرف مباشر)، مع تحديد سقوف الصرف للتحكم والتدقيق المالي
                </p>
              </div>

              <button
                onClick={openNewCategoryModal}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                إضافة نوع مصروف جديد
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expenseCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4.5 flex flex-col justify-between transition group shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color || '#06b6d4' }}
                        ></span>
                        <h4 className="text-sm font-bold text-white">{cat.name}</h4>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {cat.code}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed min-h-[36px] mb-3">
                      {cat.description || 'لا يوجد وصف مخصص لهذا البند'}
                    </p>

                    {cat.maxDirectSpendLimitSyp && (
                      <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 mb-3 flex items-center justify-between">
                        <span>سقف الصرف المباشر:</span>
                        <span className="font-mono text-cyan-400 font-bold">
                          {formatCurrency(cat.maxDirectSpendLimitSyp || 0, 'SYP')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {/* Switch Approval Requirement Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryApprovalRequirement(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                        cat.requiresManagerApproval
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                      title="اضغط للتبديل بين يتطلب موافقة والصرف المباشر"
                    >
                      {cat.requiresManagerApproval ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          يحتاج موافقة مدير
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          صرف مباشر (بدون موافقة)
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditCategoryModal(cat)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 rounded-lg transition"
                        title="تعديل بيانات الفئة"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {!cat.isDefault && (
                        <button
                          onClick={() => deleteExpenseCategory(cat.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg transition"
                          title="حذف الفئة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 3: Grouping & Analytical Studies */}
      {activeMainTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Breakdown Table / Cards */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-amber-400" />
                تحليل وتجميع النفقات التشغيلية حسب دليل أنواع المصاريف
              </h3>

              <div className="space-y-4">
                {categoryAnalytics.map((item) => (
                  <div key={item.category.id} className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.category.color || '#06b6d4' }}
                        ></span>
                        <span className="text-xs font-bold text-white">{item.category.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({item.count} سندات)
                        </span>
                      </div>

                      <div className="text-left font-mono">
                        <span className="text-xs font-bold text-rose-400">
                          {formatCurrency(item.totalSyp || 0, 'SYP')}
                        </span>
                        {item.totalUsd > 0 && (
                          <span className="text-xs font-bold text-emerald-400 mr-2">
                            + {formatCurrency(item.totalUsd || 0, 'USD')}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 mr-2">
                          ({item.percentageOfTotal.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(2, item.percentageOfTotal))}%`,
                          backgroundColor: item.category.color || '#06b6d4',
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic Expense Control Card */}
            <div className="space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  سياسة الحوكمة والتحكم بالصرف
                </h4>
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-emerald-400">الصرف المباشر</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {expenseCategories.filter((c) => !c.requiresManagerApproval).length} فئات
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      يسمح لأمناء الصناديق بصرف نفقات الوقود والإنترنت والضيافة فوراً لتسيير حركة الشاحنات بدون تأخير.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-amber-400">بموافقة المدير</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {expenseCategories.filter((c) => c.requiresManagerApproval).length} فئات
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      يتطلب تدقيق وموافقة الإدارة المركزية قبل خصم المبلغ من الصندوق لصيانة المركبات والإيجارات والقرطاسية.
                    </p>
                  </div>
                </div>
              </div>

              {/* Branch Expense Aggregator */}
              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
                  <Building className="w-4 h-4 text-cyan-400" />
                  توزيع النفقات حسب الفروع
                </h4>
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {branches.map((b) => {
                    const bExpenses = expenses.filter((e) => e.branchId === b.id && e.status === 'approved');
                    const bSyp = bExpenses.filter((e) => e.currency === 'SYP').reduce((acc, e) => acc + e.amount, 0);
                    if (bSyp === 0) return null;
                    return (
                      <div key={b.id} className="flex items-center justify-between text-xs p-2 bg-slate-950 rounded-lg border border-slate-800/60">
                        <span className="text-slate-300 font-medium truncate max-w-[140px]">{b.name}</span>
                        <span className="font-mono font-bold text-rose-400">{formatCurrency(bSyp || 0, 'SYP')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950 text-slate-100 w-screen h-screen h-[100dvh] overflow-hidden p-0 m-0 animate-in fade-in duration-200 font-['Cairo',sans-serif]">
          <div className="bg-slate-900 w-full h-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 sm:px-8 sm:py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-400" />
                <span>{editingExpense ? 'تعديل سند مصروف' : 'تسجيل سند مصروف تشغيلي جديد'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 transition text-xs font-bold border border-slate-800 hover:border-slate-700"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
                <span className="hidden sm:inline">إغلاق / رجوع</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 lg:p-8 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="w-full space-y-5">
              {/* Category, Branch & Auto-assigned Cashbox */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    نوع وبند المصروف <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.categoryId || formData.category}
                    onChange={handleCategoryChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 outline-none cursor-pointer"
                    required
                  >
                    {expenseCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.requiresManagerApproval ? 'يحتاج موافقة مدير' : 'صرف مباشر'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    الفرع المسؤول <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => {
                      const newBranchId = e.target.value;
                      const newBranchAssets = fixedAssets.filter(
                        (a) => a.branchId === newBranchId && a.condition !== 'decommissioned'
                      );
                      setFormData((prev) => ({
                        ...prev,
                        branchId: newBranchId,
                        assetId: prev.isLinkedToAsset
                          ? newBranchAssets.some((a) => a.id === prev.assetId)
                            ? prev.assetId
                            : newBranchAssets[0]?.id || ''
                          : '',
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 outline-none cursor-pointer"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    الصندوق المخصص للصرف تلقائياً
                  </label>
                  <div className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-rose-300 flex items-center justify-between">
                    <span className="font-bold truncate">{roleBoxData.boxName}</span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md font-mono">
                      {roleBoxData.branchName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Approval Banner */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  formData.requiresApproval
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {formData.requiresApproval ? (
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Zap className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>
                    {formData.requiresApproval
                      ? '⚠️ هذا النوع محدد بـ "يحتاج موافقة مدير" - سيتم تعليق السند حتى يعتمده المدير.'
                      : '⚡ هذا النوع محدد بـ "صرف مباشر" - سيتم اعتماده وخصمه فوراً من رصيد الخزينة.'}
                  </span>
                </div>

                {currentUser.role === 'super_admin' && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        requiresApproval: !prev.requiresApproval,
                        status: !prev.requiresApproval ? 'approved' : 'pending',
                      }))
                    }
                    className="px-2 py-1 rounded bg-slate-800 text-[10px] font-bold text-white hover:bg-slate-700"
                  >
                    تبديل الشرط لهذا السند
                  </button>
                )}
              </div>

              {/* Title & Beneficiary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    بيان / عنوان المصروف <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="مثال: تعبئة مازوت 300 ليتر لشاحنة حلب..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    الجهة المستفيدة / البائع / المورد
                  </label>
                  <input
                    type="text"
                    value={formData.paidTo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paidTo: e.target.value }))}
                    placeholder="مثال: محطة وقود النور، ورشة الشهباء..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              {/* Amount & Currency & Vehicle Link */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    المبلغ <span className="text-rose-400">*</span>
                  </label>
                  <FormattedAmountInput
                    value={formData.amount}
                    currency={formData.currency}
                    onChange={(num) => {
                      setFormData((prev) => ({ ...prev, amount: num }));
                    }}
                    placeholder="أدخل المبلغ"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:border-rose-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">العملة</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value as Currency }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                  >
                    <option value="SYP">ليرة سورية (SYP)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ربط بمركبة / شاحنة (اختياري)
                  </label>
                  <select
                    value={formData.vehicleId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, vehicleId: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                  >
                    <option value="">بدون ربط بمركبة</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} - {v.brand} ({v.model})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Asset Link Section: خيار تفعيلي عند اختيار 'مصروف مرتبط بأصل' */}
              <div className="rounded-xl border border-violet-700/50 bg-gradient-to-br from-violet-950/30 to-slate-950 p-4 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="is_linked_to_asset_toggle"
                      checked={formData.isLinkedToAsset}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData((prev) => {
                          const branchAssets = fixedAssets.filter(
                            (a) => a.branchId === prev.branchId && a.condition !== 'decommissioned'
                          );
                          const chosenAsset = branchAssets[0];
                          return {
                            ...prev,
                            isLinkedToAsset: checked,
                            assetId: checked ? prev.assetId || chosenAsset?.id || '' : '',
                          };
                        });
                      }}
                      className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 bg-slate-900 border-slate-700"
                    />
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-bold text-violet-200">
                        مصروف مرتبط بأصل (تجهيزات الفرع، حواسب، طابعات باركود، أثاث...)
                      </span>
                    </div>
                  </label>

                  {formData.isLinkedToAsset && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 self-start sm:self-auto">
                      مفعل • {branchFixedAssets.length} أصل متاح في الفرع
                    </span>
                  )}
                </div>

                {formData.isLinkedToAsset && (
                  <div className="space-y-3 pt-3 border-t border-violet-800/40">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-violet-300">
                          قائمة الأصول المتاحة في نفس الفرع ({branches.find((b) => b.id === formData.branchId)?.name || 'الفرع المحدد'}) <span className="text-rose-400">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400">
                          (تصفية حصرية لأصول هذا الفرع فقط)
                        </span>
                      </div>

                      <select
                        id="select_linked_asset_dropdown"
                        value={formData.assetId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => {
                            const sel = fixedAssets.find((a) => a.id === val);
                            return {
                              ...prev,
                              assetId: val,
                              title:
                                prev.title.trim() === '' && sel
                                  ? `صيانة للأصل [${sel.assetCode}] - ${sel.name}`
                                  : prev.title,
                            };
                          });
                        }}
                        className="w-full bg-slate-950 border border-violet-600/60 focus:border-violet-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        required={formData.isLinkedToAsset}
                      >
                        <option value="">-- اضغط لاختيار الأصل من قائمة أصول الفرع --</option>
                        {branchFixedAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            [{asset.assetCode}] {asset.name} - (الموقع: {asset.locationInBranch || 'عام بالفرع'})
                          </option>
                        ))}
                      </select>

                      {branchFixedAssets.length === 0 && (
                        <div className="mt-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            لا توجد أصول ثابتة مسجلة في هذا الفرع حالياً. يمكنك تغيير الفرع في الأعلى أو إضافة الأصل في قسم الأصول الثابتة.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Selected Asset Details & Last Maintenance Date Card */}
                    {formData.assetId && (() => {
                      const mInfo = getAssetMaintenanceInfo(formData.assetId);
                      if (!mInfo) return null;
                      const {
                        asset,
                        lastDate,
                        daysAgo,
                        lastExpenseTitle,
                        lastExpenseAmount,
                        lastExpenseCurrency,
                        totalLinkedExpensesCount,
                      } = mInfo;

                      return (
                        <div className="p-3 bg-slate-900/90 border border-violet-700/50 rounded-xl space-y-2.5 text-xs shadow-inner">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-bold text-violet-300 bg-violet-950/80 px-2 py-0.5 rounded border border-violet-700/50">
                                  {asset.assetCode}
                                </span>
                                <span className="font-bold text-white text-xs">{asset.name}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>العهدة: <strong className="text-slate-300">{asset.assignedToEmployee || asset.assignedEmployee || 'إدارة الفرع'}</strong></span>
                                <span>الموقع: <strong className="text-slate-300">{asset.locationInBranch || 'غير محدد'}</strong></span>
                                {asset.serialNumber && (
                                  <span>S/N: <strong className="font-mono text-slate-300">{asset.serialNumber}</strong></span>
                                )}
                              </div>
                            </div>

                            <span className="text-[10px] px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono self-start sm:self-auto">
                              سعر الشراء: {formatCurrency(asset.purchasePrice || 0, asset.currency || 'SYP')}
                            </span>
                          </div>

                          {/* Last Maintenance Date Display (جلب تاريخ آخر صيانة للأصل المختار) */}
                          <div className="p-2.5 rounded-lg bg-violet-950/60 border border-violet-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-slate-300 text-xs font-semibold block">
                                  تاريخ آخر صيانة للأصل:
                                </span>
                                {lastDate ? (
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-bold font-mono text-amber-300 text-xs">
                                      {lastDate}
                                    </span>
                                    {daysAgo !== null && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                                        {daysAgo === 0 ? 'اليوم' : `منذ ${daysAgo} يوم`}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-emerald-400 font-bold text-[11px] block mt-0.5">
                                    لا توجد صيانة مسجلة سابقة لهذا الأصل (أول عملية صيانة / تجهيز)
                                  </span>
                                )}
                              </div>
                            </div>

                            {lastExpenseTitle && (
                              <div className="text-[11px] text-slate-300 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800 max-w-sm">
                                <span className="text-slate-400 text-[10px] block">بيان آخر صيانة:</span>
                                <span className="truncate block font-medium">{lastExpenseTitle}</span>
                                {lastExpenseAmount !== null && (
                                  <span className="text-[10px] text-rose-300 font-mono font-bold block mt-0.5">
                                    المبلغ: {formatCurrency(lastExpenseAmount, lastExpenseCurrency || 'SYP')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                            <span>
                              إجمالي العمليات المسجلة للأصل سابقاً:{' '}
                              <strong className="text-violet-300 font-mono">{totalLinkedExpensesCount}</strong>
                            </span>
                            <span className="text-emerald-400 font-medium">
                              ✓ سيتم توثيق هذا المصروف وإدراجه في كشف الأصل وسجل الصيانة تلقائياً
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Date & Invoice Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">تاريخ الصرف</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">رقم الفاتورة / الإيصال</label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                    placeholder="INV-2026-..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              {/* Receipt Upload & Preview */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  صورة الفاتورة أو الإشعار الورقي
                </label>
                <div className="border border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-rose-500 transition bg-slate-950/50">
                  {receiptPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={receiptPreview}
                        alt="Receipt"
                        className="max-h-32 rounded-lg border border-slate-700 mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptPreview('');
                          setFormData((prev) => ({ ...prev, invoicePhotoUrl: '' }));
                        }}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-1.5">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-xs text-slate-400">انقر لرفع صورة الفاتورة أو المستند المؤيد</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">ملاحظات إضافية</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="أي تفاصيل أو موافقات خاصة..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 z-10 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-950/50 cursor-pointer"
                >
                  حفظ السند والترحيل المالي
                </button>
              </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto pb-16">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4.5rem)] my-auto">
            <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-cyan-400" />
                {editingCategory ? 'تعديل نوع المصروف' : 'إضافة نوع مصروف جديد لدليل النفقات'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  اسم فئة / نوع المصروف <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: رسوم فحص فني ومعاينة..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">كود التصنيف</label>
                  <input
                    type="text"
                    value={categoryFormData.code}
                    onChange={(e) => setCategoryFormData((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">لون التمييز البياني</label>
                  <input
                    type="color"
                    value={categoryFormData.color}
                    onChange={(e) => setCategoryFormData((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-full h-9 bg-slate-950 border border-slate-700 rounded-xl px-1 py-1 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  الوصف ومجال الصرف
                </label>
                <textarea
                  rows={2}
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="شرح البند وحالات استخدامه..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                />
              </div>

              {/* Approval Requirement Radio / Switch */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-white">
                  شرط اعتماد وصرف هذا البند:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      !categoryFormData.requiresManagerApproval
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="requiresApprovalRadio"
                      checked={!categoryFormData.requiresManagerApproval}
                      onChange={() =>
                        setCategoryFormData((prev) => ({ ...prev, requiresManagerApproval: false }))
                      }
                      className="hidden"
                    />
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div>صرف مباشر</div>
                      <div className="text-[9px] opacity-75 font-normal">لا يحتاج موافقة</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      categoryFormData.requiresManagerApproval
                        ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-bold'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="requiresApprovalRadio"
                      checked={categoryFormData.requiresManagerApproval}
                      onChange={() =>
                        setCategoryFormData((prev) => ({ ...prev, requiresManagerApproval: true }))
                      }
                      className="hidden"
                    />
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div>يحتاج موافقة</div>
                      <div className="text-[9px] opacity-75 font-normal">يتطلب إذن المدير</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  سقف الصرف المباشر بدون موافقة (ل.س)
                </label>
                <FormattedAmountInput
                  value={categoryFormData.maxDirectSpendLimitSyp}
                  currency="SYP"
                  onChange={(num) => {
                    setCategoryFormData((prev) => ({
                      ...prev,
                      maxDirectSpendLimitSyp: num,
                    }));
                  }}
                  placeholder="أدخل سقف الصرف المباشر"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-950/50"
                >
                  حفظ الفئة في الدليل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Receipt Image Modal */}
      {viewingReceiptExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 pb-16 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 max-w-3xl w-full rounded-2xl p-4 shadow-2xl space-y-4 max-h-[calc(100vh-4.5rem)] overflow-y-auto my-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">{viewingReceiptExpense.title}</h4>
                <p className="text-xs text-slate-400 font-mono">
                  سند #{viewingReceiptExpense.expenseNumber} — المبلغ: {formatCurrency(viewingReceiptExpense.amount || 0, viewingReceiptExpense.currency || 'SYP')}
                </p>
              </div>
              <button
                onClick={() => setViewingReceiptExpense(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center bg-slate-950 p-4 rounded-xl">
              <img
                src={viewingReceiptExpense.invoicePhotoUrl}
                alt="Receipt Full"
                className="max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
