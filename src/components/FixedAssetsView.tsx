import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  FixedAsset,
  AssetCategory,
  AssetCondition,
  Currency,
  Expense,
  FinancialVoucher,
  CashboxScope,
} from '../types';
import {
  blockNonAmountKeys,
  sanitizeDecimal,
} from '../utils/numberSanitizer';
import {
  Monitor,
  Printer,
  Barcode,
  Search,
  Plus,
  Edit2,
  Trash2,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Wrench,
  XCircle,
  Clock,
  User,
  MapPin,
  FileText,
  Filter,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Eye,
  Tag,
  ShieldCheck,
  Zap,
  Boxes,
  Cpu,
  RefreshCw,
  QrCode,
  X,
  Check,
} from 'lucide-react';
import { safePrint } from '../utils/storage';

const CATEGORY_LABELS: Record<AssetCategory, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  computers_it: {
    label: 'أجهزة كمبيوتر وخوادم',
    icon: Monitor,
    color: 'text-sky-400 bg-sky-950/40 border-sky-800/60',
  },
  barcode_printers: {
    label: 'طابعات باركود وبوالص',
    icon: Printer,
    color: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
  },
  barcode_scanners: {
    label: 'قوارئ باركود وماسحات',
    icon: Barcode,
    color: 'text-purple-400 bg-purple-950/40 border-purple-800/60',
  },
  office_equipment: {
    label: 'تجهيزات ومعدات مكتبية',
    icon: Cpu,
    color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60',
  },
  furniture: {
    label: 'أثاث ومكاتب وخزائن',
    icon: Boxes,
    color: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/60',
  },
  security_cctv: {
    label: 'كاميرات وأجهزة مراقبة',
    icon: ShieldCheck,
    color: 'text-rose-400 bg-rose-950/40 border-rose-800/60',
  },
  cash_counters: {
    label: 'آلات كشف وعد النقود',
    icon: DollarSign,
    color: 'text-teal-400 bg-teal-950/40 border-teal-800/60',
  },
  other: {
    label: 'أصول أخرى وتجهيزات عامة',
    icon: Tag,
    color: 'text-slate-400 bg-slate-900 border-slate-750',
  },
};

const CONDITION_LABELS: Record<
  AssetCondition,
  { label: string; bg: string; text: string; border: string; icon: React.FC<{ className?: string }> }
> = {
  excellent: {
    label: 'ممتازة جديدة',
    bg: 'bg-emerald-950/50',
    text: 'text-emerald-400',
    border: 'border-emerald-700/60',
    icon: CheckCircle2,
  },
  good: {
    label: 'جيدة قيد التشغيل',
    bg: 'bg-cyan-950/50',
    text: 'text-cyan-400',
    border: 'border-cyan-700/60',
    icon: Zap,
  },
  needs_repair: {
    label: 'بحاجة لصيانة',
    bg: 'bg-amber-950/50',
    text: 'text-amber-400',
    border: 'border-amber-700/60',
    icon: AlertCircle,
  },
  in_maintenance: {
    label: 'في ورشة الصيانة',
    bg: 'bg-orange-950/50',
    text: 'text-orange-400',
    border: 'border-orange-700/60',
    icon: Wrench,
  },
  decommissioned: {
    label: 'خارج الخدمة / تالف',
    bg: 'bg-rose-950/50',
    text: 'text-rose-400',
    border: 'border-rose-700/60',
    icon: XCircle,
  },
  lost_damaged: {
    label: 'مفقود / هالك',
    bg: 'bg-slate-900',
    text: 'text-slate-400',
    border: 'border-slate-800',
    icon: Clock,
  },
};

export const FixedAssetsView: React.FC = () => {
  const {
    fixedAssets = [],
    expenses = [],
    vouchers = [],
    branches = [],
    employees = [],
    currentBranch,
    currentUser,
    hasPermission,
    addFixedAsset,
    updateFixedAsset,
    deleteFixedAsset,
    addExpense,
    addFinancialVoucher,
    brandingSettings,
    formatCurrency,
    formatNumber,
  } = useOrca();

  // Permissions
  const canViewAllBranches =
    currentUser.role === 'super_admin' || hasPermission('assets.view_all_branches');
  const canCreate = hasPermission('assets.create');
  const canEdit = hasPermission('assets.edit');
  const canDelete = hasPermission('assets.delete');
  const canLinkExpense = hasPermission('assets.link_expense');

  // Active View Tab
  // 'branch_table' = جدول أصول الفرع
  // 'all_company'  = كامل أصول الشركة (للمدير العام)
  // 'expenses_log' = سجل ومراقبة مصاريف وصيانة الأصول
  const [activeTab, setActiveTab] = useState<'branch_table' | 'all_company' | 'expenses_log'>('branch_table');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [viewingAssetDetails, setViewingAssetDetails] = useState<FixedAsset | null>(null);
  const [isQuickExpenseModalOpen, setIsQuickExpenseModalOpen] = useState(false);
  const [assetForExpense, setAssetForExpense] = useState<FixedAsset | null>(null);
  const [barcodePrintAsset, setBarcodePrintAsset] = useState<FixedAsset | null>(null);

  // Form State for Asset
  const [formAssetCode, setFormAssetCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<AssetCategory>('computers_it');
  const [formBranchId, setFormBranchId] = useState(currentBranch?.id || 'branch_damascus');
  const [formPurchaseDate, setFormPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPurchasePrice, setFormPurchasePrice] = useState<number>(0);
  const [formCurrency, setFormCurrency] = useState<Currency>('SYP');
  const [formCondition, setFormCondition] = useState<AssetCondition>('good');
  const [formSerialNumber, setFormSerialNumber] = useState('');
  const [formBarcodeTag, setFormBarcodeTag] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formWarrantyDate, setFormWarrantyDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Form State for Linked Expense
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('SYP');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expensePayee, setExpensePayee] = useState('');
  const [expenseCategoryName, setExpenseCategoryName] = useState('صيانة وتجهيزات الأصول');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Reset Add/Edit Form
  const openNewAssetModal = () => {
    const branchPrefix = currentBranch?.code || 'DAM';
    const randCode = Math.floor(1000 + Math.random() * 9000);
    setFormAssetCode(`AST-${branchPrefix}-${randCode}`);
    setFormName('');
    setFormCategory('computers_it');
    setFormBranchId(currentBranch?.id || 'branch_damascus');
    setFormPurchaseDate(new Date().toISOString().split('T')[0]);
    setFormPurchasePrice(0);
    setFormCurrency('SYP');
    setFormCondition('good');
    setFormSerialNumber('');
    setFormBarcodeTag(`TAG-${randCode}`);
    setFormModel('');
    setFormAssignedTo('');
    setFormLocation('');
    setFormSupplier('');
    setFormWarrantyDate('');
    setFormNotes('');
    setEditingAsset(null);
    setIsAddModalOpen(true);
  };

  const openEditAssetModal = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setFormAssetCode(asset.assetCode);
    setFormName(asset.name);
    setFormCategory(asset.category);
    setFormBranchId(asset.branchId);
    setFormPurchaseDate(asset.purchaseDate);
    setFormPurchasePrice(asset.purchasePrice || 0);
    setFormCurrency(asset.currency || 'SYP');
    setFormCondition(asset.condition);
    setFormSerialNumber(asset.serialNumber || '');
    setFormBarcodeTag(asset.barcodeTag || '');
    setFormModel(asset.model || '');
    setFormAssignedTo(asset.assignedEmployee || '');
    setFormLocation(asset.locationInBranch || '');
    setFormSupplier(asset.supplier || '');
    setFormWarrantyDate(asset.warrantyExpiryDate || '');
    setFormNotes(asset.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAssetCode.trim()) {
      alert('يرجى كتابة اسم الأصل وكوده');
      return;
    }

    if (editingAsset) {
      updateFixedAsset(editingAsset.id, {
        assetCode: formAssetCode.trim(),
        name: formName.trim(),
        category: formCategory,
        branchId: formBranchId,
        purchaseDate: formPurchaseDate,
        purchasePrice: Number(formPurchasePrice) || 0,
        currency: formCurrency,
        condition: formCondition,
        serialNumber: formSerialNumber.trim() || undefined,
        barcodeTag: formBarcodeTag.trim() || undefined,
        model: formModel.trim() || undefined,
        assignedEmployee: formAssignedTo.trim() || undefined,
        locationInBranch: formLocation.trim() || undefined,
        supplier: formSupplier.trim() || undefined,
        warrantyExpiryDate: formWarrantyDate || undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      addFixedAsset({
        assetCode: formAssetCode.trim(),
        name: formName.trim(),
        category: formCategory,
        branchId: formBranchId,
        purchaseDate: formPurchaseDate,
        purchasePrice: Number(formPurchasePrice) || 0,
        currency: formCurrency,
        condition: formCondition,
        serialNumber: formSerialNumber.trim() || undefined,
        barcodeTag: formBarcodeTag.trim() || undefined,
        model: formModel.trim() || undefined,
        assignedEmployee: formAssignedTo.trim() || undefined,
        locationInBranch: formLocation.trim() || undefined,
        supplier: formSupplier.trim() || undefined,
        warrantyExpiryDate: formWarrantyDate || undefined,
        notes: formNotes.trim() || undefined,
      });
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteAsset = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف أو استبعاد الأصل: [${name}]؟`)) {
      deleteFixedAsset(id);
      if (viewingAssetDetails?.id === id) {
        setViewingAssetDetails(null);
      }
    }
  };

  // Quick Expense Modal for Asset
  const openRegisterExpenseForAsset = (asset: FixedAsset) => {
    setAssetForExpense(asset);
    setExpenseTitle(`صيانة وتجهيز للأصل: ${asset.name} (${asset.assetCode})`);
    setExpenseAmount(0);
    setExpenseCurrency(asset.currency || 'SYP');
    setExpensePayee('');
    setExpenseCategoryName('صيانة وإصلاحات مستودع');
    setExpenseNotes('');
    setIsQuickExpenseModalOpen(true);
  };

  const handleSaveQuickExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForExpense) return;
    if (expenseAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }

    const defaultScope: CashboxScope =
      currentUser.role === 'outbound_operator'
        ? 'outgoing'
        : currentUser.role === 'inbound_operator'
        ? 'incoming'
        : 'master';

    // Add to Financial Vouchers (سند دفع وصرف مع تحديد الأصل)
    addFinancialVoucher({
      type: 'payment',
      branchId: assetForExpense.branchId,
      currency: expenseCurrency,
      amount: expenseAmount,
      paidByOrTo: expensePayee || 'ورشة الصيانة / فني التجهيزات',
      reasonCategory: 'صيانة وإصلاحات وتجهيزات أصول',
      description: `${expenseTitle} - ${expenseNotes || ''}`,
      referenceNumber: `AST-EXP-${assetForExpense.assetCode}`,
      performedByUserId: currentUser.id,
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
      assetId: assetForExpense.id,
      cashboxScope: defaultScope,
    });

    // Also register in Expenses log
    addExpense({
      title: expenseTitle,
      category: 'صيانة مركبات وقطع غيار',
      amount: expenseAmount,
      currency: expenseCurrency,
      branchId: assetForExpense.branchId,
      date: new Date().toISOString().split('T')[0],
      paidTo: expensePayee || 'فني الصيانة',
      status: 'approved',
      paymentMethod: 'cash_box',
      notes: `مصروف مرتبط بالأصل: ${assetForExpense.name} [كود: ${assetForExpense.assetCode}]. ${expenseNotes}`,
      assetId: assetForExpense.id,
      cashboxScope: defaultScope,
    });

    setIsQuickExpenseModalOpen(false);
    alert('تم تسجيل وترحيل سند المصروف بنجاح وربطه بالأصل');
  };

  // Helper to calculate total expenses on an asset
  const getAssetExpenses = (assetId: string) => {
    const linkedExpenses = expenses.filter((e) => e.assetId === assetId);
    const linkedVouchers = vouchers.filter((v) => v.assetId === assetId && v.type === 'payment');

    // Aggregate without duplicate reference counting
    const totalSyp = linkedExpenses
      .filter((e) => e.currency === 'SYP')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalUsd = linkedExpenses
      .filter((e) => e.currency === 'USD')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      expensesCount: linkedExpenses.length + linkedVouchers.length,
      totalSyp,
      totalUsd,
      records: linkedExpenses,
      vouchers: linkedVouchers,
    };
  };

  // Filtered Assets based on Active Tab & Filters
  const filteredAssets = useMemo(() => {
    return fixedAssets.filter((asset) => {
      // 1. Branch Tab constraint
      if (activeTab === 'branch_table') {
        if (asset.branchId !== currentBranch?.id) return false;
      } else if (activeTab === 'all_company') {
        if (selectedBranchId !== 'all' && asset.branchId !== selectedBranchId) return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'all' && asset.category !== selectedCategory) return false;

      // 3. Condition filter
      if (selectedCondition !== 'all' && asset.condition !== selectedCondition) return false;

      // 4. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchCode = asset.assetCode.toLowerCase().includes(q);
        const matchName = asset.name.toLowerCase().includes(q);
        const matchSN = asset.serialNumber?.toLowerCase().includes(q) ?? false;
        const matchTag = asset.barcodeTag?.toLowerCase().includes(q) ?? false;
        const matchModel = asset.model?.toLowerCase().includes(q) ?? false;
        const matchEmp = asset.assignedEmployee?.toLowerCase().includes(q) ?? false;
        const matchLoc = asset.locationInBranch?.toLowerCase().includes(q) ?? false;
        if (!matchCode && !matchName && !matchSN && !matchTag && !matchModel && !matchEmp && !matchLoc) {
          return false;
        }
      }

      return true;
    });
  }, [
    fixedAssets,
    activeTab,
    currentBranch?.id,
    selectedBranchId,
    selectedCategory,
    selectedCondition,
    searchTerm,
  ]);

  // Global Financial & Operational Stats
  const stats = useMemo(() => {
    const baseList =
      activeTab === 'branch_table'
        ? fixedAssets.filter((a) => a.branchId === currentBranch?.id)
        : fixedAssets;

    const totalCount = baseList.length;
    const activeCount = baseList.filter(
      (a) => a.condition === 'excellent' || a.condition === 'good'
    ).length;
    const maintenanceCount = baseList.filter(
      (a) => a.condition === 'needs_repair' || a.condition === 'in_maintenance'
    ).length;
    const decommissionedCount = baseList.filter(
      (a) => a.condition === 'decommissioned' || a.condition === 'lost_damaged'
    ).length;

    // Asset Capital Value
    const totalValueSyp = baseList
      .filter((a) => a.currency === 'SYP' || !a.currency)
      .reduce((sum, a) => sum + (a.purchasePrice || 0), 0);
    const totalValueUsd = baseList
      .filter((a) => a.currency === 'USD')
      .reduce((sum, a) => sum + (a.purchasePrice || 0), 0);

    // Total Maintenance & Expenses Spent on these Assets
    const assetIdSet = new Set(baseList.map((a) => a.id));
    const linkedExpenses = expenses.filter((e) => e.assetId && assetIdSet.has(e.assetId));
    const totalSpentSyp = linkedExpenses
      .filter((e) => e.currency === 'SYP')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalSpentUsd = linkedExpenses
      .filter((e) => e.currency === 'USD')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      totalCount,
      activeCount,
      maintenanceCount,
      decommissionedCount,
      totalValueSyp,
      totalValueUsd,
      totalSpentSyp,
      totalSpentUsd,
    };
  }, [fixedAssets, expenses, activeTab, currentBranch?.id]);

  const getBranchName = (branchId: string) => {
    const b = branches.find((item) => item.id === branchId);
    return b ? `${b.name} (${b.governorate})` : branchId;
  };

  return (
    <div className="space-y-4 pb-20 text-slate-100 select-none">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & MAIN CONTROLS */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-750 rounded-2xl p-4 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-500/40 text-violet-400 flex items-center justify-center shrink-0 shadow-lg">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                إدارة الأصول الثابتة وتجهيزات الفروع
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[11px] font-bold">
                أجهزة • طابعات • تجهيزات
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تسجيل ومتابعة التجهيزات المكتبية، أجهزة الكمبيوتر، طابعات الباركود، والرقابة على نفقات
              وصيانة الأصول
            </p>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-between lg:justify-end">
          <div className="flex items-center bg-slate-950/80 border border-slate-750 rounded-xl p-1 gap-1">
            <button
              id="branch_assets_tab_btn"
              onClick={() => setActiveTab('branch_table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'branch_table'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>جدول أصول الفرع [{currentBranch?.name}]</span>
            </button>

            {canViewAllBranches && (
              <button
                id="all_company_assets_tab_btn"
                onClick={() => setActiveTab('all_company')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'all_company'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>كامل أصول الشركة (المدير العام)</span>
              </button>
            )}

            <button
              id="asset_expenses_log_tab_btn"
              onClick={() => setActiveTab('expenses_log')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'expenses_log'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>مراقبة مصاريف وصيانة الأصول</span>
            </button>
          </div>

          {canCreate && (
            <button
              id="add_new_fixed_asset_btn"
              onClick={openNewAssetModal}
              className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-950/50 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل أصل ثابت جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STATISTICAL METRIC CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Total Assets */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">إجمالي عدد الأصول المسجلة</span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
              {stats.totalCount}{' '}
              <span className="text-xs font-sans font-normal text-slate-400">أصل / جهاز</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold block mt-0.5">
              {stats.activeCount} أصل بحالة تشغيلية ممتازة
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-500/30 text-violet-400 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Capital Purchase Value */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">القيمة الدفترية للأصول (الشراء)</span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
              {formatCurrency(stats.totalValueSyp, 'SYP')}
            </div>
            {stats.totalValueUsd > 0 && (
              <span className="text-[11px] text-emerald-400 font-mono font-bold block mt-0.5">
                + {formatCurrency(stats.totalValueUsd, 'USD')}
              </span>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Maintenance & Expenses Spent */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">إجمالي مصاريف الصيانة والتجهيز</span>
            <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono mt-0.5">
              {formatCurrency(stats.totalSpentSyp, 'SYP')}
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
              {stats.maintenanceCount} أصول بحاجة أو قيد الصيانة
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Operational Readiness Rate */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">معدل الجاهزية التشغيلية</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-0.5">
              {stats.totalCount > 0
                ? Math.round((stats.activeCount / stats.totalCount) * 100)
                : 100}
              %
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
              {stats.decommissionedCount} أصول تالفة / خارج الخدمة
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SEARCH & FILTER TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            id="fixed_assets_search_input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالكود، الاسم، الرقم التسلسلي، الموديل، الموظف المسؤول..."
            className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl pr-9 pl-4 py-2 text-xs text-white focus:outline-none placeholder:text-slate-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-2.5 top-2.5 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Company Wide Branch Selector if in all_company view */}
          {activeTab === 'all_company' && canViewAllBranches && (
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-750 rounded-xl px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="filter_branch_select"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">جميع فروع المنظومة (الشركة كاملة)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    فرع {b.name} ({b.governorate})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-750 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="filter_category_select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">جميع التصنيفات</option>
              <option value="computers_it">أجهزة كمبيوتر وخوادم</option>
              <option value="barcode_printers">طابعات باركود وبوالص</option>
              <option value="barcode_scanners">قوارئ باركود وماسحات</option>
              <option value="office_equipment">تجهيزات ومعدات مكتبية</option>
              <option value="furniture">أثاث ومكاتب وخزائن</option>
              <option value="security_cctv">كاميرات ومراقبة</option>
              <option value="cash_counters">آلات عد ونقود</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          {/* Condition Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-750 rounded-xl px-2.5 py-1.5">
            <Zap className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="filter_condition_select"
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">جميع الحالات التشغيلية</option>
              <option value="excellent">ممتازة جديدة</option>
              <option value="good">جيدة قيد التشغيل</option>
              <option value="needs_repair">بحاجة صيانة</option>
              <option value="in_maintenance">في ورشة الصيانة</option>
              <option value="decommissioned">خارج الخدمة / تالف</option>
              <option value="lost_damaged">مفقود / هالك</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN DATA TABLE: جدول أصول الفرع أو كامل أصول الشركة */}
      {/* ========================================================================= */}
      {activeTab !== 'expenses_log' ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                {activeTab === 'branch_table'
                  ? `جدول أصول الفرع: ${currentBranch.name}`
                  : 'سجل كامل أصول وتجهيزات فروع الشركة'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-mono font-bold">
                {filteredAssets.length} أصل
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {activeTab === 'branch_table'
                ? `الأصول الثابتة المخصصة والمربوطة بفرع ${currentBranch.name}`
                : 'قائمة الأصول الثابتة لجميع فروع المحافظات'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="p-3">كود الأصل والباركود</th>
                  <th className="p-3">اسم الأصل والتصنيف</th>
                  <th className="p-3">الفرع والموقع الداخلي</th>
                  <th className="p-3">العهدة الشخصية (الموظف)</th>
                  <th className="p-3">تاريخ الشراء والقيمة</th>
                  <th className="p-3">الحالة التشغيلية</th>
                  <th className="p-3 text-center">المصاريف المرتبطة</th>
                  <th className="p-3 text-center">الإجراءات والعمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-60" />
                      <p className="text-sm font-semibold">لا توجد أصول مطابقة لمعايير البحث والفلترة</p>
                      {canCreate && (
                        <button
                          onClick={openNewAssetModal}
                          className="mt-3 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition"
                        >
                          + إضافة أصل ثابت الآن
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    const catMeta = CATEGORY_LABELS[asset.category] || CATEGORY_LABELS.other;
                    const CatIcon = catMeta.icon;
                    const condMeta = CONDITION_LABELS[asset.condition] || CONDITION_LABELS.good;
                    const CondIcon = condMeta.icon;
                    const assetExpenseData = getAssetExpenses(asset.id);

                    return (
                      <tr
                        key={asset.id}
                        className="hover:bg-slate-850/60 transition group border-b border-slate-800/40"
                      >
                        {/* 1. Code & Barcode */}
                        <td className="p-3 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-violet-300 bg-violet-950/40 border border-violet-800/40 px-2 py-0.5 rounded text-[11px]">
                              {asset.assetCode}
                            </span>
                          </div>
                          {asset.barcodeTag && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                              <Barcode className="w-3 h-3 text-slate-500" />
                              <span>{asset.barcodeTag}</span>
                            </div>
                          )}
                        </td>

                        {/* 2. Name & Category */}
                        <td className="p-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{asset.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${catMeta.color}`}
                            >
                              <CatIcon className="w-2.5 h-2.5" />
                              <span>{catMeta.label}</span>
                            </span>
                            {asset.model && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                موديل: {asset.model}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Branch & Location */}
                        <td className="p-3">
                          <div className="text-slate-200 font-medium flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{getBranchName(asset.branchId)}</span>
                          </div>
                          {asset.locationInBranch && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span>{asset.locationInBranch}</span>
                            </div>
                          )}
                        </td>

                        {/* 4. Assigned Employee */}
                        <td className="p-3">
                          {asset.assignedEmployee ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                              <User className="w-3 h-3 text-cyan-400" />
                              <span>{asset.assignedEmployee}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">عهدة عامة للفرع</span>
                          )}
                        </td>

                        {/* 5. Purchase Date & Price */}
                        <td className="p-3">
                          <div className="text-xs font-mono font-bold text-white">
                            {formatCurrency(asset.purchasePrice || 0, asset.currency || 'SYP')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Calendar className="w-2.5 h-2.5 text-slate-500" />
                            <span>{asset.purchaseDate}</span>
                          </div>
                        </td>

                        {/* 6. Operational Condition */}
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${condMeta.bg} ${condMeta.text} ${condMeta.border}`}
                          >
                            <CondIcon className="w-3 h-3" />
                            <span>{condMeta.label}</span>
                          </span>
                        </td>

                        {/* 7. Linked Expenses */}
                        <td className="p-3 text-center">
                          {assetExpenseData.expensesCount > 0 ? (
                            <button
                              onClick={() => setViewingAssetDetails(asset)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 text-xs font-mono font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                              title="عرض تفاصيل وسجل المصاريف المربوطة بهذا الأصل"
                            >
                              <Receipt className="w-3 h-3 text-rose-400" />
                              <span>
                                {assetExpenseData.totalSyp > 0 &&
                                  formatCurrency(assetExpenseData.totalSyp, 'SYP')}
                                {assetExpenseData.totalUsd > 0 &&
                                  `${assetExpenseData.totalSyp > 0 ? ' + ' : ''}${formatCurrency(assetExpenseData.totalUsd, 'USD')}`}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({assetExpenseData.expensesCount})
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[11px]">لا توجد مصاريف</span>
                          )}
                        </td>

                        {/* 8. Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Profile & Expenses */}
                            <button
                              id={`view_asset_${asset.id}`}
                              onClick={() => setViewingAssetDetails(asset)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                              title="تفاصيل الأصل وسجل المصاريف"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Quick Link Expense */}
                            {canLinkExpense && (
                              <button
                                id={`link_expense_asset_${asset.id}`}
                                onClick={() => openRegisterExpenseForAsset(asset)}
                                className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 border border-rose-800/40 transition cursor-pointer"
                                title="تسجيل سند مصروف / صيانة للأصل"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Print Tag / Barcode */}
                            <button
                              id={`print_tag_asset_${asset.id}`}
                              onClick={() => setBarcodePrintAsset(asset)}
                              className="p-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-400 hover:text-cyan-300 border border-cyan-800/40 transition cursor-pointer"
                              title="طباعة بطاقة الأصل / باركود العهدة"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            {canEdit && (
                              <button
                                id={`edit_asset_${asset.id}`}
                                onClick={() => openEditAssetModal(asset)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition cursor-pointer"
                                title="تعديل بيانات الأصل"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            {canDelete && (
                              <button
                                id={`delete_asset_${asset.id}`}
                                onClick={() => handleDeleteAsset(asset.id, asset.name)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                title="حذف أو استبعاد الأصل"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      ) : (
        /* ========================================================================= */
        /* 5. EXPENSES & MAINTENANCE MONITORING VIEW */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">
                    سجل الرقابة المالية على مصاريف وصيانة الأصول الثابتة
                  </h3>
                  <span className="text-xs text-slate-400">
                    رصد كافة سندات الصرف وفواتير الصيانة المربوطة بكل أصل لمراقبة تكلفة الاستهلاك والتشغيل
                  </span>
                </div>
              </div>
            </div>

            {/* List of Assets with their Expenses */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
              {fixedAssets.map((asset) => {
                const expenseData = getAssetExpenses(asset.id);
                const catMeta = CATEGORY_LABELS[asset.category] || CATEGORY_LABELS.other;
                const CatIcon = catMeta.icon;

                return (
                  <div
                    key={asset.id}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-xs text-violet-300 bg-violet-950/60 px-2 py-0.5 rounded border border-violet-800/40">
                          {asset.assetCode}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${catMeta.color}`}
                        >
                          {catMeta.label}
                        </span>
                      </div>

                      <h4 className="font-bold text-white text-sm line-clamp-1">{asset.name}</h4>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        <span>{getBranchName(asset.branchId)}</span>
                      </div>

                      {/* Financial Comparison Box */}
                      <div className="mt-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">سعر الشراء الأولي:</span>
                          <span className="font-mono font-bold text-white">
                            {formatCurrency(asset.purchasePrice || 0, asset.currency || 'SYP')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-rose-400 font-medium">مجموع مصاريف الصيانة:</span>
                          <span className="font-mono font-bold text-rose-300">
                            {formatCurrency(expenseData.totalSyp, 'SYP')}
                            {expenseData.totalUsd > 0 && ` + ${formatCurrency(expenseData.totalUsd, 'USD')}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-800 pt-1 text-[11px]">
                          <span className="text-slate-400">عدد الحركات المصروفة:</span>
                          <span className="font-bold text-slate-200">
                            {expenseData.expensesCount} سند / مصروف
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setViewingAssetDetails(asset)}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>كشف الحساب والمصاريف</span>
                      </button>

                      {canLinkExpense && (
                        <button
                          onClick={() => openRegisterExpenseForAsset(asset)}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>سند مصروف</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT FIXED ASSET (تسجيل أو تعديل أصل ثابت) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-violet-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {editingAsset ? 'تعديل بيانات الأصل الثابت' : 'تسجيل أصل ثابت وتجهيزات فرع جديدة'}
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    أجهزة الكمبيوتر، طابعات الباركود، التجهيزات المكتبية، والأثاث
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Asset Code */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    كود الأصل الفريد <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formAssetCode}
                    onChange={(e) => setFormAssetCode(e.target.value)}
                    placeholder="مثال: AST-DAM-1002"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    اسم الأصل / الجهاز <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: طابعة باركود حرارية زيبرا ZD220"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Category */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">تصنيف الأصل</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as AssetCategory)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
                  >
                    <option value="computers_it">أجهزة كمبيوتر وخوادم</option>
                    <option value="barcode_printers">طابعات باركود وبوالص</option>
                    <option value="barcode_scanners">قوارئ باركود وماسحات</option>
                    <option value="office_equipment">تجهيزات ومعدات مكتبية</option>
                    <option value="furniture">أثاث ومكاتب وخزائن</option>
                    <option value="security_cctv">كاميرات ومراقبة</option>
                    <option value="cash_counters">آلات عد ونقود</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                {/* Branch */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">الفرع التابع له</label>
                  <select
                    disabled={!canViewAllBranches}
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-medium focus:outline-none disabled:opacity-60"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.governorate})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operational Condition */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">الحالة التشغيلية</label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as AssetCondition)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
                  >
                    <option value="excellent">ممتازة جديدة</option>
                    <option value="good">جيدة قيد التشغيل</option>
                    <option value="needs_repair">بحاجة صيانة</option>
                    <option value="in_maintenance">في ورشة الصيانة</option>
                    <option value="decommissioned">خارج الخدمة / تالف</option>
                    <option value="lost_damaged">مفقود / هالك</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Purchase Date */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">تاريخ الشراء</label>
                  <input
                    type="date"
                    value={formPurchaseDate}
                    onChange={(e) => setFormPurchaseDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                  />
                </div>

                {/* Purchase Price */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">تكلفة الشراء الأصلية</label>
                  <input
                    type="number"
                    step="any"
                    value={formPurchasePrice === 0 ? '' : formPurchasePrice}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonAmountKeys}
                    onChange={(e) => {
                      const clean = sanitizeDecimal(e.target.value);
                      setFormPurchasePrice(clean === '' ? 0 : parseFloat(clean) || 0);
                    }}
                    placeholder="أدخل تكلفة الشراء"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">العملة</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value as Currency)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-bold focus:outline-none"
                  >
                    <option value="SYP">ليرة سورية (SYP)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Model */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">الموديل والمواصفات</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="مثال: Core i7 16GB / ZD220"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">الرقم التسلسلي (S/N)</label>
                  <input
                    type="text"
                    value={formSerialNumber}
                    onChange={(e) => setFormSerialNumber(e.target.value)}
                    placeholder="مثال: SN-99482104"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                  />
                </div>

                {/* Barcode Tag */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">رمز باركود العهدة</label>
                  <input
                    type="text"
                    value={formBarcodeTag}
                    onChange={(e) => setFormBarcodeTag(e.target.value)}
                    placeholder="مثال: TAG-8491"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Assigned Employee */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    العهدة مسجلة باسم الموظف
                  </label>
                  <input
                    type="text"
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    placeholder="اسم الموظف أو مسؤول الكاونتر"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                {/* Location in Branch */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    موقع الأصل داخل الفرع
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="مثال: كاونتر الاستقبال 1 / مستودع الفرز"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">ملاحظات ومواصفات إضافية</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="أي ملاحظات حول الضمان أو الشركة المجهزة أو حالة الجهاز..."
                  className="w-full bg-slate-950 border border-slate-750 focus:border-violet-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  {editingAsset ? 'حفظ التعديلات' : 'اعتماد وتسجيل الأصل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: QUICK REGISTER EXPENSE FOR ASSET (تسجيل سند مصروف للأصل) */}
      {/* ========================================================================= */}
      {isQuickExpenseModalOpen && assetForExpense && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    تسجيل سند مصروف وصيانة مربوط بأصل ثابت
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    الأصل: {assetForExpense.name} [{assetForExpense.assetCode}]
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsQuickExpenseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickExpense} className="space-y-3 text-xs">
              {/* Asset Reference Notice */}
              <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-800/50 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">الأصل المربوط بالسند:</span>
                  <span className="font-bold text-white text-xs">{assetForExpense.name}</span>
                  <span className="text-violet-300 font-mono text-[11px] block mt-0.5">
                    كود: {assetForExpense.assetCode} | فرع: {getBranchName(assetForExpense.branchId)}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  ربط مؤكد
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  بيان المصروف / سبب الصيانة <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="مثال: استبدال رأس طباعة حراري، صيانة باور سبلاي..."
                  className="w-full bg-slate-950 border border-slate-750 focus:border-rose-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    المبلغ المصروف <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={expenseAmount === 0 ? '' : expenseAmount}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonAmountKeys}
                    onChange={(e) => {
                      const clean = sanitizeDecimal(e.target.value);
                      setExpenseAmount(clean === '' ? 0 : parseFloat(clean) || 0);
                    }}
                    placeholder="أدخل المبلغ المصروف"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-rose-500 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">العملة</label>
                  <select
                    value={expenseCurrency}
                    onChange={(e) => setExpenseCurrency(e.target.value as Currency)}
                    className="w-full bg-slate-950 border border-slate-750 focus:border-rose-500 rounded-xl px-3 py-2 text-white font-bold focus:outline-none"
                  >
                    <option value="SYP">ليرة سورية (SYP)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              {/* Payee / Vendor */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  المدفوع له (الفني / مركز الصيانة / الجهة)
                </label>
                <input
                  type="text"
                  value={expensePayee}
                  onChange={(e) => setExpensePayee(e.target.value)}
                  placeholder="اسم الورشة أو الفني المصلح"
                  className="w-full bg-slate-950 border border-slate-750 focus:border-rose-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  تفاصيل الفاتورة والقطع المستبدلة
                </label>
                <textarea
                  rows={2}
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="رقم الفاتورة، القطع الجديدة التي تم تركيبها، فترة الضمان..."
                  className="w-full bg-slate-950 border border-slate-750 focus:border-rose-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuickExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  ترحيل واعتماد سند المصروف للأصل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ASSET DETAILS & LINKED EXPENSES LOG (كشف الأصل وسجل المصاريف) */}
      {/* ========================================================================= */}
      {viewingAssetDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-3xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-violet-400" />
                <div>
                  <h2 className="text-base font-bold text-white">بطاقة الأصل وكشف المصاريف المربوطة</h2>
                  <span className="text-xs text-violet-300 font-mono">
                    {viewingAssetDetails.assetCode}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingAssetDetails(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Main Asset Info Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">اسم الأصل:</span>
                <span className="font-bold text-white text-sm">{viewingAssetDetails.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">التصنيف:</span>
                <span className="font-semibold text-slate-200">
                  {CATEGORY_LABELS[viewingAssetDetails.category]?.label || viewingAssetDetails.category}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">الفرع:</span>
                <span className="font-semibold text-slate-200">
                  {getBranchName(viewingAssetDetails.branchId)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">الحالة التشغيلية:</span>
                <span className="font-bold text-emerald-400">
                  {CONDITION_LABELS[viewingAssetDetails.condition]?.label || viewingAssetDetails.condition}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">تاريخ الشراء:</span>
                <span className="font-mono text-slate-300">{viewingAssetDetails.purchaseDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block">تكلفة الشراء:</span>
                <span className="font-mono font-bold text-white">
                  {formatCurrency(viewingAssetDetails.purchasePrice || 0, viewingAssetDetails.currency || 'SYP')}
                </span>
              </div>
              {viewingAssetDetails.assignedEmployee && (
                <div>
                  <span className="text-slate-500 block">العهدة باسم:</span>
                  <span className="font-semibold text-cyan-400">
                    {viewingAssetDetails.assignedEmployee}
                  </span>
                </div>
              )}
              {viewingAssetDetails.serialNumber && (
                <div>
                  <span className="text-slate-500 block">الرقم التسلسلي S/N:</span>
                  <span className="font-mono text-slate-300">
                    {viewingAssetDetails.serialNumber}
                  </span>
                </div>
              )}
              {viewingAssetDetails.locationInBranch && (
                <div>
                  <span className="text-slate-500 block">الموقع داخل الفرع:</span>
                  <span className="text-slate-300">{viewingAssetDetails.locationInBranch}</span>
                </div>
              )}
            </div>

            {/* Linked Expenses Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-400" />
                  <h3 className="font-bold text-white text-xs">
                    سجل المصاريف والصيانة المربوطة بهذا الأصل
                  </h3>
                </div>
                {canLinkExpense && (
                  <button
                    onClick={() => openRegisterExpenseForAsset(viewingAssetDetails)}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ إضافة سند مصروف جديد للأصل</span>
                  </button>
                )}
              </div>

              {/* Table of Linked Expenses */}
              {(() => {
                const expData = getAssetExpenses(viewingAssetDetails.id);
                if (expData.expensesCount === 0) {
                  return (
                    <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-500 text-xs">
                      لا توجد مصاريف أو فواتير صيانة مسجلة لهذا الأصل حتى الآن
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">التاريخ</th>
                          <th className="p-2.5">بيان المصروف</th>
                          <th className="p-2.5">المستفيد</th>
                          <th className="p-2.5">المبلغ</th>
                          <th className="p-2.5">النوع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                        {expData.records.map((exp) => (
                          <tr key={exp.id} className="hover:bg-slate-900/60">
                            <td className="p-2.5 font-mono text-slate-400">{exp.date}</td>
                            <td className="p-2.5 font-medium text-white">{exp.title}</td>
                            <td className="p-2.5 text-slate-300">{exp.paidTo || '-'}</td>
                            <td className="p-2.5 font-mono font-bold text-rose-300">
                              {formatCurrency(exp.amount || 0, exp.currency || 'SYP')}
                            </td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                {exp.category}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => setBarcodePrintAsset(viewingAssetDetails)}
                className="px-3.5 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>طباعة بطاقة الأصل والباركود</span>
              </button>

              <button
                onClick={() => setViewingAssetDetails(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: BARCODE & ASSET TAG PRINT PREVIEW (طباعة بطاقة الأصل والباركود) */}
      {/* ========================================================================= */}
      {barcodePrintAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">بطاقة تعريف الأصل ورمز الباركود</h3>
              </div>
              <button
                onClick={() => setBarcodePrintAsset(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Printable Physical Tag Simulation */}
            <div
              id="asset_printable_tag"
              className="bg-white text-slate-950 rounded-xl p-4 border-2 border-dashed border-slate-400 text-center space-y-2 shadow-inner"
            >
              <div className="text-[11px] font-black tracking-widest text-slate-600 uppercase">
                {brandingSettings?.companyName || 'ORCA LOGISTICS SYRIA'}
              </div>
              <div className="font-extrabold text-sm text-slate-900">{barcodePrintAsset.name}</div>
              <div className="text-xs text-slate-700 font-medium">
                الفرع: {getBranchName(barcodePrintAsset.branchId)}
              </div>

              {/* Barcode Graphic */}
              <div className="my-3 py-2 bg-slate-100 rounded-lg flex flex-col items-center justify-center border border-slate-300">
                <Barcode className="w-36 h-12 text-slate-900" />
                <span className="font-mono font-bold tracking-widest text-sm text-slate-900 mt-1">
                  {barcodePrintAsset.assetCode}
                </span>
                {barcodePrintAsset.barcodeTag && (
                  <span className="font-mono text-[10px] text-slate-500">
                    TAG: {barcodePrintAsset.barcodeTag}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-600 flex items-center justify-between border-t border-slate-200 pt-1.5">
                <span>تاريخ التجهيز: {barcodePrintAsset.purchaseDate}</span>
                <span>
                  العهدة:{' '}
                  {barcodePrintAsset.assignedEmployee
                    ? barcodePrintAsset.assignedEmployee
                    : 'عهدة فرع'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBarcodePrintAsset(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={() => safePrint()}
                className="px-5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الملصق الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
