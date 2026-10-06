import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import { UnifiedExpenseModal } from './UnifiedExpenseModal';
import { FormattedAmountInput } from './FormattedAmountInput';
import {
  blockNonAmountKeys,
  sanitizeDecimal,
} from '../utils/numberSanitizer';
import {
  computeInterBranchBalances,
  formatBranchLabel,
  CounterpartyBranchBalance,
} from '../utils/interBranchHelpers';
import { InterBranchObligationsDetailModal } from './InterBranchObligationsDetailModal';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Receipt,
  Search,
  FileText,
  Building2,
  ArrowRightLeft,
  Printer,
  Calendar,
  CheckCircle2,
  Percent,
  Wallet,
  Coins,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  X,
  Sparkles,
  SlidersHorizontal,
  Calculator,
  Layers,
  ShieldCheck,
  Lock,
  Unlock,
  ArrowDownRight,
  RefreshCw,
  Send,
  Check,
  AlertCircle,
  Eye,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Currency, TransactionType, FinancialVoucher, ClearingReconciliationDetails, ShiftSettlementVoucher, CashboxScope } from '../types';
import { VoucherPrintModal } from './VoucherPrintModal';
import { ClearingReconciliationModal } from './ClearingReconciliationModal';
import { ClearingSummaryPrintModal } from './ClearingSummaryPrintModal';
import { CodSenderDueAlertBanner } from './CodSenderDueAlertBanner';
import { ShiftSettlementPrintModal } from './ShiftSettlementPrintModal';
import { VaultTransferModal } from './VaultTransferModal';

export const CashboxView: React.FC = () => {
  const {
    currentBranch,
    currentBranchWithDerivedBalance,
    branches,
    transactions,
    vouchers = [],
    shiftSettlements = [],
    parcels = [],
    fixedAssets = [],
    interBranchObligations = [],
    brandingSettings,
    codSettings,
    getCodCommissionLabel,
    calculateCodTransferFee,
    setActiveModule,
    addFinancialVoucher,
    createBranchClearingVoucher,
    submitShiftSettlement,
    approveShiftSettlement,
    rejectShiftSettlement,
    deleteShiftSettlement,
    getCashboxBreakdown,
    getRoleCashboxData,
    getRoleBoxTransactions,
    getRoleBoxInfo,
    addExpense,
    expenses = [],
    users = [],
    hasPermission,
    currentUser,
    formatCurrency,
    formatExchangeRate,
    formatNumber,
    ensureServerConnected,
  } = useOrca();

  const canViewBalances =
    hasPermission('cashbox.view_balances') &&
    (currentUser.permissions?.fieldRestrictions?.canViewFinancialTotals ??
      (currentUser.role === 'super_admin' ||
        currentUser.role === 'hub_manager' ||
        currentUser.role === 'cashier'));
  const canAddTransaction = hasPermission('cashbox.add_transaction');

  // Main UI Navigation Tab
  const [activeMainTab, setActiveMainTab] = useState<
    'ledger' | 'receipts' | 'payments' | 'clearing' | 'master_ledger' | 'obligations'
  >('ledger');
  const [activeCurrencyTab, setActiveCurrencyTab] = useState<Currency>('SYP');

  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isUnifiedExpenseModalOpen, setIsUnifiedExpenseModalOpen] = useState(false);
  const [isClearingModalOpen, setIsClearingModalOpen] = useState(false);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<FinancialVoucher | null>(null);
  const [selectedClearingSummaryForPrint, setSelectedClearingSummaryForPrint] = useState<FinancialVoucher | null>(null);
  const [obligationDetailBranch, setObligationDetailBranch] = useState<CounterpartyBranchBalance | null>(null);

  // حساب الذمم التبادلية عبر helper نقي
  const interBranchSummary = useMemo(() => {
    const isSupervision = Boolean(
      currentBranch?.id === 'ALL_BRANCHES_SUPERVISION_BRANCH' ||
      (currentBranch as any)?.isSupervision === true
    );
    return computeInterBranchBalances(
      interBranchObligations || [],
      currentBranch?.id || '',
      branches || [],
      isSupervision
    );
  }, [interBranchObligations, currentBranch?.id, branches]);

  // Shift Settlement (ترصيد الصناديق) State
  const [isShiftSettlementModalOpen, setIsShiftSettlementModalOpen] = useState(false);
  const [isVaultTransferModalOpen, setIsVaultTransferModalOpen] = useState(false);
  const [selectedShiftVoucherForPrint, setSelectedShiftVoucherForPrint] = useState<ShiftSettlementVoucher | null>(null);
  const [settlementScope, setSettlementScope] = useState<'outgoing' | 'incoming'>(
    currentUser.role === 'inbound_operator' ? 'incoming' : 'outgoing'
  );
  const [settlementSyp, setSettlementSyp] = useState<number>(0);
  const [settlementUsd, setSettlementUsd] = useState<number>(0);
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [rejectModalVoucher, setRejectModalVoucher] = useState<ShiftSettlementVoucher | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [approveModalVoucher, setApproveModalVoucher] = useState<ShiftSettlementVoucher | null>(null);
  const [managerApprovalNotes, setManagerApprovalNotes] = useState<string>('');
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [settlementScopeFilter, setSettlementScopeFilter] = useState<'all' | 'outgoing' | 'incoming'>('all');
  const [ledgerScopeFilter, setLedgerScopeFilter] = useState<'all' | 'master' | 'outgoing' | 'incoming' | 'courier' | 'cashier'>('all');
  const [ledgerUserFilter, setLedgerUserFilter] = useState<string>('all');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('all');
  const [ledgerDateFilter, setLedgerDateFilter] = useState<'all' | 'today' | '3days' | 'week' | 'month'>('all');

  // Search & Filter State
  const [filterType, setFilterType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Form State: Receipt Voucher (سند قبض)
  const [receiptPayee, setReceiptPayee] = useState('');
  const [receiptAmount, setReceiptAmount] = useState<number>(0);
  const [receiptCurrency, setReceiptCurrency] = useState<Currency>('SYP');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [receiptRef, setReceiptRef] = useState('');

  // Form State: Payment Voucher (سند دفع / صرف)
  const [paymentRecipient, setPaymentRecipient] = useState('');
  const [paymentCategory, setPaymentCategory] = useState('مصاريف تشغيلية ووقود');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>('SYP');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  // Asset linking states for payment voucher
  const [isLinkedToAsset, setIsLinkedToAsset] = useState<boolean>(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  // Helper to fetch latest maintenance date & details for the selected asset
  const getAssetMaintenanceInfo = (assetId: string) => {
    if (!assetId) return null;
    const asset = fixedAssets.find((a) => a.id === assetId);
    if (!asset) return null;

    const linkedExpenses = expenses
      .filter((e) => e.assetId === asset.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  // Filtered Branch Transactions (General Ledger)
  const branchTransactions = (transactions || []).filter(
    (t) => t.branchId === currentBranch?.id
  );

  // Filtered Branch Financial Vouchers
  const branchVouchers = (vouchers || []).filter(
    (v) => v.branchId === currentBranch?.id || v.counterpartyBranchId === currentBranch?.id
  );

  const isTxCredit = (type: TransactionType) =>
    [
      'shipping_income_prepaid',
      'shipping_collected_dest',
      'cod_collected_dest',
      'transfer_fee_income',
      'settlement_received_from_branch',
      'voucher_receipt',
      'deposit',
    ].includes(type);

  // Live Calculations of Vault In / Out
  const sypIn = branchTransactions
    .filter((t) => t.currency === 'SYP' && isTxCredit(t.type))
    .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  const sypOut = branchTransactions
    .filter((t) => t.currency === 'SYP' && !isTxCredit(t.type))
    .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  const usdIn = branchTransactions
    .filter((t) => t.currency === 'USD' && isTxCredit(t.type))
    .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  const usdOut = branchTransactions
    .filter((t) => t.currency === 'USD' && !isTxCredit(t.type))
    .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  // Remittance Commission state and metrics linked to central Pricing Engine
  const [showCommissionCalculator, setShowCommissionCalculator] = useState(false);
  const [calcRemittanceAmount, setCalcRemittanceAmount] = useState<number>(0);
  const [calcRemittanceCur, setCalcRemittanceCur] = useState<Currency>('SYP');

  const totalBranchTransferFeesSyp = branchTransactions
    .filter((t) => t.currency === 'SYP' && (t.type === 'transfer_fee_income' || t.description?.includes('عمولة')))
    .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  const totalBranchTransferFeesUsd = branchTransactions
    .filter((t) => t.currency === 'USD' && (t.type === 'transfer_fee_income' || t.description?.includes('عمولة')))
    .reduce((acc, t) => acc + (t.amount ?? 0), 0);

  // Handlers for Creating Vouchers
  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await ensureServerConnected();
    if (!ok) return;

    if (!isBranchManager) {
      alert('عذراً: تحرير وإصدار سندات القبض محصور حصراً بدور مدير الفرع.');
      return;
    }
    if (receiptAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    if (!receiptPayee.trim()) {
      alert('يرجى إدخال اسم المستلم منه');
      return;
    }

    const targetScope: CashboxScope =
      currentUser.role === 'inbound_operator'
        ? 'incoming'
        : currentUser.role === 'outbound_operator' || currentUser.role === 'reception_data_entry'
        ? 'outgoing'
        : currentUser.role === 'cashier'
        ? 'cashier'
        : ledgerScopeFilter === 'outgoing'
        ? 'outgoing'
        : ledgerScopeFilter === 'incoming'
        ? 'incoming'
        : 'master';

    const created = addFinancialVoucher({
      type: 'receipt',
      branchId: currentBranch.id,
      currency: receiptCurrency,
      amount: receiptAmount,
      paidByOrTo: receiptPayee.trim(),
      reasonCategory: 'سند قبض نقدية',
      description: receiptDescription.trim() || `قبض نقدي من ${receiptPayee.trim()}`,
      referenceNumber: receiptRef.trim() || undefined,
      performedByUserId: currentUser.id,
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
      cashboxScope: targetScope,
    });

    setIsReceiptModalOpen(false);
    setReceiptAmount(0);
    setReceiptPayee('');
    setReceiptDescription('');
    setReceiptRef('');

    // Open Printable Voucher Modal
    if (created) {
      setSelectedVoucherForPrint(created);
    }
  };

  // Open Full-Screen Clearing & Reconciliation Modal
  const handleOpenClearingModal = () => {
    setIsClearingModalOpen(true);
  };

  // Sub-box Breakdown and Branch Shift Settlements
  const isOutgoingRole = currentUser.role === 'outbound_operator';
  const isIncomingRole = currentUser.role === 'inbound_operator';
  const isBranchManager =
    currentUser.role === 'hub_manager' ||
    currentUser.role === 'super_admin' ||
    (currentUser.role as string) === 'branch_manager' ||
    (currentUser.role as string) === 'admin';

  const isManagerRole = isBranchManager;
  const isCashierRole = currentUser.role === 'cashier';

  // Granular Access & RBAC Flags
  const canViewAllBoxes = isManagerRole || hasPermission('cashbox.view_all_boxes') || hasPermission('cashbox.manage_vault');
  const canViewOutgoingBox = canViewAllBoxes || isOutgoingRole || hasPermission('cashbox.outbound_access');
  const canViewIncomingBox = canViewAllBoxes || isIncomingRole || hasPermission('cashbox.inbound_access');
  const canViewMasterVault = canViewAllBoxes;
  const canViewTransfers = canViewAllBoxes || hasPermission('cashbox.transfer_access');

  const canOperateOutgoingBox = canViewAllBoxes || isOutgoingRole;
  const canOperateIncomingBox = canViewAllBoxes || isIncomingRole;
  const canOperateMasterVault = canViewAllBoxes;
  const canApproveShiftSettlement = isManagerRole || hasPermission('cashbox.approve_settlement');
  
  // حصر إنشاء سندات القبض وسندات الصرف حصراً بمدير الفرع والإدارة العامة
  const canCreateReceiptVoucher = isBranchManager;
  const canCreatePaymentVoucher = isBranchManager;
  
  // For clearing: allowed for super_admin, OR if current branch is an agent branch!
  const canAccessClearing =
    currentUser.role === 'super_admin' || currentBranch?.type === 'agent';

  // Vault Transfer Voucher permission (سند مناقلة صناديق بين الفروع - حصري لمدراء الفروع والإدارة العامة)
  const canCreateVaultTransfer =
    currentUser.role === 'super_admin' ||
    currentUser.role === 'hub_manager' ||
    (currentUser.role as string) === 'branch_manager' ||
    hasPermission('cashbox.manage_vault');

  // Sub-box Breakdown for active user/branch scope
  const cashboxBreakdown = getCashboxBreakdown(
    currentBranch?.id,
    (!canViewAllBoxes && (isOutgoingRole || isIncomingRole)) ? currentUser.id : undefined
  );
  const branchShiftSettlements = (shiftSettlements || []).filter((s) => {
    if (s.branchId !== currentBranch?.id) return false;
    if (!canViewAllBoxes) {
      if (isOutgoingRole && s.cashboxScope !== 'outgoing') return false;
      if (isIncomingRole && s.cashboxScope !== 'incoming') return false;
    }
    return true;
  });
  const pendingShiftCount = branchShiftSettlements.filter((s) => s.status === 'pending').length;

  // Handler to open Shift Settlement with pre-filled unclosed shift balances
  const handleOpenShiftSettlement = (targetScope?: 'outgoing' | 'incoming') => {
    let scope: 'outgoing' | 'incoming' = 'outgoing';
    if (isIncomingRole && !canViewAllBoxes) {
      scope = 'incoming';
    } else if (isOutgoingRole && !canViewAllBoxes) {
      scope = 'outgoing';
    } else {
      scope = targetScope || (isIncomingRole ? 'incoming' : 'outgoing');
    }

    setSettlementScope(scope);
    if (scope === 'outgoing') {
      setSettlementSyp(cashboxBreakdown.outgoingBox.unsettledSyp);
      setSettlementUsd(cashboxBreakdown.outgoingBox.unsettledUsd);
    } else {
      setSettlementSyp(cashboxBreakdown.incomingBox.unsettledSyp);
      setSettlementUsd(cashboxBreakdown.incomingBox.unsettledUsd);
    }
    setSettlementNotes('');
    setIsShiftSettlementModalOpen(true);
  };

  const handleConfirmShiftSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await ensureServerConnected();
    if (!ok) return;

    if (settlementScope === 'outgoing' && !canOperateOutgoingBox) {
      alert('غير مصرح لك بإجراء ترصيد لصندوق الصادر');
      return;
    }
    if (settlementScope === 'incoming' && !canOperateIncomingBox) {
      alert('غير مصرح لك بإجراء ترصيد لصندوق الوارد');
      return;
    }
    if (settlementSyp <= 0 && settlementUsd <= 0) {
      alert('يرجى إدخال مبلغ ترصيد أكبر من الصفر بالليرة السورية أو بالدولار');
      return;
    }
    if (!settlementNotes.trim()) {
      alert('بند الملاحظات إلزامي دائماً لتوثيق وتأكيد تسليم الوردية ومطابقة النقدية مع المدير');
      return;
    }

    const created = submitShiftSettlement(
      settlementScope,
      settlementSyp,
      settlementUsd,
      settlementNotes.trim()
    );

    setIsShiftSettlementModalOpen(false);
    setSelectedShiftVoucherForPrint(created);
  };

  // Branch users for filtering
  const branchUsersList = (users || []).filter(
    (u) => !currentBranch?.id || u.branchId === currentBranch.id || u.role === 'super_admin'
  );

  // Filtered General Ledger
  const baseTransactions = !canViewAllBoxes && getRoleBoxTransactions
    ? getRoleBoxTransactions(currentUser?.role || 'outbound_operator', currentBranch?.id, currentUser?.id)
    : branchTransactions;

  const isWithinCashboxDateFilter = (timestampStr: string) => {
    if (ledgerDateFilter === 'all') return true;
    const txTime = new Date(timestampStr).getTime();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (ledgerDateFilter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return txTime >= todayStart.getTime();
    }
    if (ledgerDateFilter === '3days') return now - txTime <= 3 * dayMs;
    if (ledgerDateFilter === 'week') return now - txTime <= 7 * dayMs;
    if (ledgerDateFilter === 'month') return now - txTime <= 30 * dayMs;
    return true;
  };

  const isMatchingCashboxCategory = (tx: any) => {
    if (ledgerCategoryFilter === 'all') return true;
    if (ledgerCategoryFilter === 'shipping_prepaid') return tx.type === 'shipping_income_prepaid';
    if (ledgerCategoryFilter === 'shipping_dest') return tx.type === 'shipping_collected_dest';
    if (ledgerCategoryFilter === 'cod_collected') return tx.type === 'cod_collected_dest';
    if (ledgerCategoryFilter === 'cod_payout') return tx.type === 'cod_paid_to_sender';
    if (ledgerCategoryFilter === 'shift_settlement') {
      return [
        'shift_settlement_received_inflow',
        'shift_settlement_outflow',
        'settlement_transfer_to_hub',
        'settlement_received_from_branch',
      ].includes(tx.type);
    }
    if (ledgerCategoryFilter === 'vouchers') {
      return ['voucher_receipt', 'voucher_payment', 'voucher_clearing'].includes(tx.type);
    }
    if (ledgerCategoryFilter === 'expenses') {
      return ['operating_expense', 'expense'].includes(tx.type);
    }
    return true;
  };

  const displayTransactions = baseTransactions.filter((t) => {
    if (t.currency !== activeCurrencyTab) return false;

    const isCredit = isTxCredit(t.type);
    if (filterType !== 'all') {
      if (filterType === 'in' && !isCredit) return false;
      if (filterType === 'out' && isCredit) return false;
    }
    if (ledgerScopeFilter !== 'all') {
      const tScope = t.cashboxScope || (
        t.type === 'shipping_income_prepaid' ? 'outgoing' :
        (t.type === 'shipping_collected_dest' || t.type === 'cod_collected_dest') ? 'incoming' : 'master'
      );
      if (tScope !== ledgerScopeFilter) return false;
    }
    if (ledgerUserFilter !== 'all') {
      if (t.performedByUserId && t.performedByUserId !== ledgerUserFilter) return false;
      if (!t.performedByUserId && t.performedByUserName) {
        const matchUser = branchUsersList.find((u) => u.id === ledgerUserFilter);
        if (matchUser && t.performedByUserName !== matchUser.name) return false;
      }
    }
    if (!isMatchingCashboxCategory(t)) return false;
    if (!isWithinCashboxDateFilter(t.timestamp)) return false;

    if (searchFilter) {
      const match =
        t.description?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (t.referenceId && t.referenceId.toLowerCase().includes(searchFilter.toLowerCase())) ||
        t.id?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        t.performedByUserName?.toLowerCase().includes(searchFilter.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  // Filtered Vouchers per Tab
  const receiptVouchers = branchVouchers.filter((v) => v.type === 'receipt');
  const paymentVouchers = branchVouchers.filter((v) => v.type === 'payment');
  const clearingVouchers = branchVouchers.filter((v) => v.type === 'clearing');

  return (
    <div className="space-y-4 pb-20 text-slate-100">
      {/* Top Header Card - Compact & Side-by-Side Actions */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl px-3.5 py-2.5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
              صندوق فرع: {currentBranch?.name} ({currentBranch?.governorate})
            </h1>

            {/* Sub-Box Indicator Badge */}
            {isOutgoingRole && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                <span>صندوق قسم الصادر</span>
                <span className="font-mono font-semibold">({formatCurrency(cashboxBreakdown.outgoingBox.unsettledSyp, 'SYP')})</span>
              </span>
            )}
            {isIncomingRole && (
              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center gap-1">
                <span>صندوق قسم الوارد</span>
                <span className="font-mono font-semibold">({formatCurrency(cashboxBreakdown.incomingBox.unsettledSyp, 'SYP')})</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick Action Buttons - Filtered by User Permissions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Shift Settlement Quick Trigger for Outgoing/Incoming/Manager */}
          {(canOperateOutgoingBox || canOperateIncomingBox || isManagerRole) && (
            <button
              type="button"
              id="btn_shift_settlement"
              onClick={() => handleOpenShiftSettlement()}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-amber-200 shrink-0" />
              <span>
                {isOutgoingRole ? '+ ترصيد وردية الصادر' : isIncomingRole ? '+ ترصيد وردية الوارد' : '+ ترصيد وإغلاق وردية'}
              </span>
            </button>
          )}

          {canCreateReceiptVoucher && (
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>+ سند قبض</span>
            </button>
          )}

          {canCreatePaymentVoucher && (
            <button
              id="btn_new_payment_voucher"
              onClick={() => {
                setIsUnifiedExpenseModalOpen(true);
              }}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-rose-600 to-amber-700 hover:from-rose-500 hover:to-amber-600 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-200 shrink-0" />
              <span>+ تسجيل سند مصروف جديد</span>
            </button>
          )}

          {canCreateVaultTransfer && (
            <button
              id="btn_new_vault_transfer_voucher"
              onClick={() => setIsVaultTransferModalOpen(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="إصدار سند مناقلة وتحويل أموال بين صناديق الفروع (مدير الفرع)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-200 shrink-0" />
              <span>+ سند مناقلة صناديق بين الفروع</span>
            </button>
          )}

          {canAccessClearing && (
            <button
              onClick={handleOpenClearingModal}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
              <span>+ سند مقاصة ومطابقة</span>
            </button>
          )}

          {clearingVouchers.length > 0 && (
            <button
              type="button"
              id="btn_quick_print_clearing_summary"
              onClick={() => setSelectedClearingSummaryForPrint(clearingVouchers[0])}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="طباعة ملخص مقاصة الوكيل (ورقة A4 للإرسال مع المبلغ)"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>ملخص المقاصة (A4)</span>
            </button>
          )}
        </div>
      </div>

      {/* High-Priority Alert Banner for COD Sender Remittance Payouts Due (صرف حوالات الطرود ضد الدفع للمرسلين) */}
      <CodSenderDueAlertBanner />

      {/* Remittance Commission & COD Tariff Central Link Card (الربط المباشر مع محرك التسعير) */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/40 rounded-xl p-3.5 sm:p-4 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <span>تعرفة عمولة الحوالات المالية (COD)</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                  {getCodCommissionLabel('SYP')}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                  مربوط بمحرك التسعير المركزي
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تطبق هذه التعرفة آلياً على كافة الطرود والحوالات المسجلة بالفرع وتُقيد الإيرادات في الصندوق تلقائياً.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowCommissionCalculator(!showCommissionCalculator)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{showCommissionCalculator ? 'إخفاء الحاسبة' : 'حاسبة عمولة سريعة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('pricing')}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-md shadow-amber-950/40 flex items-center gap-1.5 transition cursor-pointer"
              title="الانتقال إلى محرك التسعير والتعرفة لتعديل نسب وشرائح العمولات"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>ضبط وتعديل في محرك التسعير</span>
            </button>
          </div>
        </div>

        {/* Total Remittance Commission metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">إجمالي عمولات الحوالات (ل.س):</span>
            <span className="font-bold text-amber-300 text-xs sm:text-sm">
              {formatCurrency(totalBranchTransferFeesSyp, 'SYP')}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">إجمالي عمولات الحوالات ($):</span>
            <span className="font-bold text-emerald-300 text-xs sm:text-sm">
              {formatCurrency(totalBranchTransferFeesUsd, 'USD')}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">الحد الأدنى للعمولة بالليرة:</span>
            <span className="font-bold text-slate-300 text-xs sm:text-sm">
              {formatCurrency(codSettings?.minTransferFeeSyp || 5000, 'SYP')}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">الحد الأدنى للعمولة بالدولار:</span>
            <span className="font-bold text-slate-300 text-xs sm:text-sm">
              {formatCurrency(codSettings?.minTransferFeeUsd || 1.0, 'USD')}
            </span>
          </div>
        </div>

        {/* Quick Commission Calculator Drawer */}
        {showCommissionCalculator && (
          <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-amber-400" />
                <span>حساب عمولة الحوالة فوراً وفق تعرفة محرك التسعير:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCalcRemittanceCur('SYP')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                    calcRemittanceCur === 'SYP' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  ل.س
                </button>
                <button
                  type="button"
                  onClick={() => setCalcRemittanceCur('USD')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                    calcRemittanceCur === 'USD' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  $
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">مبلغ الحوالة:</label>
                <input
                  type="number"
                  step="any"
                  value={calcRemittanceAmount || ''}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={blockNonAmountKeys}
                  onChange={(e) => {
                    const clean = sanitizeDecimal(e.target.value);
                    setCalcRemittanceAmount(clean === '' ? 0 : parseFloat(clean) || 0);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs focus:border-amber-500 focus:outline-none"
                  placeholder="أدخل مبلغ الحوالة"
                />
              </div>

              <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/30">
                <span className="text-[10px] text-amber-300 font-bold block">العمولة المستحقة:</span>
                <span className="font-mono text-sm font-black text-amber-300">
                  {formatCurrency(calculateCodTransferFee(calcRemittanceAmount, calcRemittanceCur), calcRemittanceCur)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 pt-4 sm:pt-0">
                <button
                  type="button"
                  onClick={() => {
                    setReceiptPayee('عميل حوالة نقدية');
                    setReceiptAmount(calculateCodTransferFee(calcRemittanceAmount, calcRemittanceCur));
                    setReceiptCurrency(calcRemittanceCur);
                    setReceiptDescription(`قبض عمولة حوالة مالية بقيمة ${formatCurrency(calcRemittanceAmount, calcRemittanceCur)}`);
                    setIsReceiptModalOpen(true);
                  }}
                  className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowDownLeft className="w-3 h-3" />
                  <span>إنشاء سند قبض بالعمولة</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dual Vault Summary Cards (Mac Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* SYP Box */}
        <div
          onClick={() => setActiveCurrencyTab('SYP')}
          className={`cursor-pointer rounded-2xl p-5 border transition-all ${
            activeCurrencyTab === 'SYP'
              ? 'bg-slate-900 border-emerald-500/80 shadow-2xl shadow-emerald-950/40 ring-2 ring-emerald-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                SYP
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">خزينة الليرة السورية</h3>
                <span className="text-[11px] text-slate-400">الرصيد الفعلي المتاح بالصندوق</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 text-xs font-bold font-mono">
              ل.س
            </span>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
              {canViewBalances ? formatCurrency(currentBranchWithDerivedBalance?.boxSypBalance || 0, 'SYP') : '***,***'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-800 text-xs font-mono">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="font-sans text-[11px]">مقبوضات واردة:</span>
              </div>
              <span className="font-bold text-white">
                {canViewBalances ? `+${formatCurrency(sypIn, 'SYP')}` : '***'}
              </span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-rose-400">
                <ArrowUpRight className="w-4 h-4" />
                <span className="font-sans text-[11px]">مدفوعات صادرة:</span>
              </div>
              <span className="font-bold text-white">
                {canViewBalances ? `-${formatCurrency(sypOut, 'SYP')}` : '***'}
              </span>
            </div>
          </div>
        </div>

        {/* USD Box */}
        <div
          onClick={() => setActiveCurrencyTab('USD')}
          className={`cursor-pointer rounded-2xl p-5 border transition-all ${
            activeCurrencyTab === 'USD'
              ? 'bg-slate-900 border-cyan-500/80 shadow-2xl shadow-cyan-950/40 ring-2 ring-cyan-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
                USD
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">خزينة الدولار الأمريكي</h3>
                <span className="text-[11px] text-slate-400">الرصيد الفعلي المتاح بالصندوق</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 text-xs font-bold font-mono">
              USD ($)
            </span>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-cyan-400 font-mono tracking-tight">
              {canViewBalances ? formatCurrency(currentBranchWithDerivedBalance?.boxUsdBalance || 0, 'USD') : '$***,***'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-800 text-xs font-mono">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="font-sans text-[11px]">مقبوضات واردة:</span>
              </div>
              <span className="font-bold text-white">
                {canViewBalances ? `+${formatCurrency(usdIn, 'USD')}` : '***'}
              </span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-rose-400">
                <ArrowUpRight className="w-4 h-4" />
                <span className="font-sans text-[11px]">مدفوعات صادرة:</span>
              </div>
              <span className="font-bold text-white">
                {canViewBalances ? `-${formatCurrency(usdOut, 'USD')}` : '***'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveMainTab('ledger')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'ledger'
              ? 'bg-slate-800 text-white shadow border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span>سجل حركات الخزينة ({branchTransactions.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('master_ledger')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'master_ledger'
              ? 'bg-slate-800 text-amber-300 shadow border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-400" />
          <span>سجل الصناديق والترصيد العام</span>
          {pendingShiftCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
              {pendingShiftCount} بانتظار الاعتماد
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveMainTab('receipts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'receipts'
              ? 'bg-slate-800 text-emerald-300 shadow border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          <span>سندات القبض الواردة ({receiptVouchers.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('payments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'payments'
              ? 'bg-slate-800 text-rose-300 shadow border border-rose-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 text-rose-400" />
          <span>سندات الدفع والصرف ({paymentVouchers.length})</span>
        </button>

        {canAccessClearing && (
          <button
            onClick={() => setActiveMainTab('clearing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeMainTab === 'clearing'
                ? 'bg-slate-800 text-cyan-300 shadow border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
            <span>سندات المقاصة وكشوف المطابقة ({clearingVouchers.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveMainTab('obligations')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'obligations'
              ? 'bg-slate-800 text-indigo-300 shadow border border-indigo-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>
            الذمم التبادلية بين الفروع
            {interBranchSummary.activeBranchesCount > 0 && (
              <span className="mr-1.5 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black border border-indigo-500/30">
                {interBranchSummary.activeBranchesCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* TAB 1: GENERAL LEDGER */}
      {activeMainTab === 'ledger' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white">
                دفتر الأستاذ وسجل الحركات المالية المباشرة ({activeCurrencyTab === 'SYP' ? 'ليرة سورية' : 'دولار'})
              </h2>
              <p className="text-[11px] text-slate-400">
                تسلسل زمني متكامل لكافة الحركات النقدية الواردة والصادرة لفرع {currentBranch?.name}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full">
              {/* Scope Filter - Dynamic & RBAC Guided */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs flex-wrap gap-1">
                {canViewAllBoxes && (
                  <>
                    <button
                      onClick={() => setLedgerScopeFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        ledgerScopeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'
                      }`}
                    >
                      كافة الصناديق
                    </button>
                    <button
                      onClick={() => setLedgerScopeFilter('master')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        ledgerScopeFilter === 'master' ? 'bg-amber-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      خزينة المدير
                    </button>
                  </>
                )}
                {canViewOutgoingBox && (
                  <button
                    onClick={() => setLedgerScopeFilter('outgoing')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      ledgerScopeFilter === 'outgoing' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    صندوق الصادر
                  </button>
                )}
                {canViewIncomingBox && (
                  <button
                    onClick={() => setLedgerScopeFilter('incoming')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      ledgerScopeFilter === 'incoming' ? 'bg-blue-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    صندوق الوارد
                  </button>
                )}
                {canViewAllBoxes && (
                  <>
                    <button
                      onClick={() => setLedgerScopeFilter('courier')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        ledgerScopeFilter === 'courier' ? 'bg-purple-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      عهدة المناديب
                    </button>
                    <button
                      onClick={() => setLedgerScopeFilter('cashier')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        ledgerScopeFilter === 'cashier' ? 'bg-teal-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      صندوق المحاسبة
                    </button>
                  </>
                )}
              </div>

              {/* Filter In / Out */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterType('in')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterType === 'in' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  وارد فقط (+)
                </button>
                <button
                  onClick={() => setFilterType('out')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterType === 'out' ? 'bg-rose-600 text-white' : 'text-slate-400'
                  }`}
                >
                  صادر فقط (-)
                </button>
              </div>

              {/* User filter */}
              {isBranchManager && branchUsersList.length > 0 && (
                <div className="flex items-center bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400 text-[11px] ml-1.5 shrink-0">الموظف:</span>
                  <select
                    value={ledgerUserFilter}
                    onChange={(e) => setLedgerUserFilter(e.target.value)}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-bold"
                  >
                    <option value="all" className="bg-slate-900 text-slate-200">كافة الموظفين</option>
                    {branchUsersList.map((u) => (
                      <option key={u.id} value={u.id} className="bg-slate-900 text-slate-200">
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category filter */}
              <div className="flex items-center bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 text-[11px] ml-1.5 shrink-0">التصنيف:</span>
                <select
                  value={ledgerCategoryFilter}
                  onChange={(e) => setLedgerCategoryFilter(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-bold"
                >
                  <option value="all" className="bg-slate-900 text-slate-200">كافة التصنيفات</option>
                  <option value="shipping_prepaid" className="bg-slate-900 text-slate-200">إيرادات شحن مقبوضة سلفاً</option>
                  <option value="shipping_dest" className="bg-slate-900 text-slate-200">أجور شحن مقبوضة في الوجهة</option>
                  <option value="cod_collected" className="bg-slate-900 text-slate-200">تحصيل مبالغ COD</option>
                  <option value="cod_payout" className="bg-slate-900 text-slate-200">تسليم مبالغ COD</option>
                  <option value="shift_settlement" className="bg-slate-900 text-slate-200">تسويات وترصيد ورديات</option>
                  <option value="vouchers" className="bg-slate-900 text-slate-200">سندات قبض وصرف</option>
                  <option value="expenses" className="bg-slate-900 text-slate-200">مصاريف تشغيلية</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 text-[11px] ml-1.5 shrink-0">الفترة:</span>
                <select
                  value={ledgerDateFilter}
                  onChange={(e) => setLedgerDateFilter(e.target.value as any)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-bold"
                >
                  <option value="all" className="bg-slate-900 text-slate-200">الكل</option>
                  <option value="today" className="bg-slate-900 text-slate-200">اليوم</option>
                  <option value="3days" className="bg-slate-900 text-slate-200">آخر 3 أيام</option>
                  <option value="week" className="bg-slate-900 text-slate-200">هذا الأسبوع</option>
                  <option value="month" className="bg-slate-900 text-slate-200">هذا الشهر</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="بحث بالسند أو البيان..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-semibold">رقم السند والتاريخ</th>
                  <th className="py-2.5 px-3 font-semibold">نوع وتصنيف الحركة</th>
                  <th className="py-2.5 px-3 font-semibold">البيان والشرح</th>
                  <th className="py-2.5 px-3 font-semibold">المبلغ والقيمة</th>
                  <th className="py-2.5 px-3 font-semibold">المستخدم المنفذ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      لا توجد حركات مسجلة تطابق الشروط
                    </td>
                  </tr>
                ) : (
                  displayTransactions.map((tx) => {
                    const isIn = isTxCredit(tx.type);

                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono">
                          <div className="font-bold text-slate-200">{tx.referenceId || tx.id}</div>
                          <div className="text-[10px] text-slate-400" dir="ltr">
                            {tx.timestamp
                              ? new Date(tx.timestamp).toLocaleString('en-GB', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                isIn
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {tx.type === 'shipping_income_prepaid'
                                ? 'إيراد شحن مقبوض سلفاً'
                                : tx.type === 'shipping_collected_dest'
                                ? 'أجور شحن مقبوضة في الوجهة'
                                : tx.type === 'cod_collected_dest'
                                ? 'قبض حوالة COD من المستلم'
                                : tx.type === 'cod_paid_to_sender'
                                ? 'تسليم حوالة COD للمرسل'
                                : tx.type === 'transfer_fee_income'
                                ? 'عمولة حوالات نقدية'
                                : tx.type === 'operating_expense'
                                ? 'مصروف تشغيلي'
                                : tx.type === 'settlement_transfer_to_hub'
                                ? 'توريد نقد للإدارة'
                                : tx.type === 'settlement_received_from_branch'
                                ? 'استلام توريد من فرع'
                                : tx.type === 'voucher_receipt'
                                ? 'سند قبض نقدية'
                                : tx.type === 'voucher_payment'
                                ? 'سند دفع وصرف'
                                : tx.type === 'voucher_clearing'
                                ? 'سند مقاصة فرع'
                                : tx.type === 'deposit'
                                ? 'إيداع نقدي'
                                : tx.type === 'withdrawal'
                                ? 'سحب نقدي'
                                : 'حركة مالية'}
                            </span>

                            {/* Cashbox Scope Pill */}
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                                tx.cashboxScope === 'outgoing'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                                  : tx.cashboxScope === 'incoming'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                                  : 'bg-slate-950 text-slate-400 border border-slate-800'
                              }`}
                            >
                              {tx.cashboxScope === 'outgoing'
                                ? 'صندوق الصادر'
                                : tx.cashboxScope === 'incoming'
                                ? 'صندوق الوارد'
                                : 'الخزينة الرئيسية'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-slate-200 max-w-xs">{tx.description}</td>

                        <td className="py-3 px-3 font-mono font-bold">
                          <span className={isIn ? 'text-emerald-400' : 'text-rose-400'}>
                            {isIn ? '+' : '-'}
                            {formatCurrency(tx.amount ?? 0, tx.currency)}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">
                          {tx.performedByUserId}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RECEIPT VOUCHERS (سندات القبض) */}
      {activeMainTab === 'receipts' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span>سندات القبض النقدية الرسمية (Receipt Vouchers)</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                سندات القبض المحررة بالفرع لقاء أجور الشحن، الإيداعات، والمقبوضات
              </p>
            </div>

            {canCreateReceiptVoucher && (
              <button
                onClick={() => setIsReceiptModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تحرير سند قبض جديد</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">رقم السند والتاريخ</th>
                  <th className="py-2.5 px-3">المستلم منه</th>
                  <th className="py-2.5 px-3">التصنيف والبيان</th>
                  <th className="py-2.5 px-3">المبلغ المقبوض</th>
                  <th className="py-2.5 px-3">رقم المرجع</th>
                  <th className="py-2.5 px-3 text-center">الإجراء والطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {receiptVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      لا توجد سندات قبض مسجلة حتى الآن
                    </td>
                  </tr>
                ) : (
                  receiptVouchers.map((vch) => (
                    <tr key={vch.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                        <div>{vch.voucherNumber}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {vch.date || vch.timestamp?.split('T')[0]}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-bold text-white">{vch.paidByOrTo}</td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{vch.reasonCategory}</div>
                        <div className="text-[11px] text-slate-400 max-w-xs truncate">{vch.description}</div>
                      </td>

                      <td className="py-3 px-3 font-mono font-black text-emerald-400">
                        +{formatCurrency(vch.amount ?? 0, vch.currency)}
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-400">{vch.referenceNumber || '—'}</td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedVoucherForPrint(vch)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>معاينة وطباعة</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT VOUCHERS (سندات الصرف والدفع) */}
      {activeMainTab === 'payments' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                <span>سندات الدفع والصرف النقدية الرسمية (Payment Vouchers)</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                سندات الصرف والمدفوعات المحررة بالفرع لقاء المصاريف التشغيلية، الصيانة، والوقود
              </p>
            </div>

            <button
              onClick={() => setIsUnifiedExpenseModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل سند مصروف جديد</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">رقم السند والتاريخ</th>
                  <th className="py-2.5 px-3">المدفوع له</th>
                  <th className="py-2.5 px-3">التصنيف والبيان</th>
                  <th className="py-2.5 px-3">المبلغ المصروف</th>
                  <th className="py-2.5 px-3">رقم الفاتورة / المرجع</th>
                  <th className="py-2.5 px-3 text-center">الإجراء والطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paymentVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      لا توجد سندات دفع مسجلة حتى الآن
                    </td>
                  </tr>
                ) : (
                  paymentVouchers.map((vch) => (
                    <tr key={vch.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-rose-400">
                        <div>{vch.voucherNumber}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {vch.date || vch.timestamp?.split('T')[0]}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-bold text-white">{vch.paidByOrTo}</td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{vch.reasonCategory}</div>
                        <div className="text-[11px] text-slate-400 max-w-xs truncate">{vch.description}</div>
                      </td>

                      <td className="py-3 px-3 font-mono font-black text-rose-400">
                        -{formatCurrency(vch.amount ?? 0, vch.currency)}
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-400">{vch.referenceNumber || '—'}</td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedVoucherForPrint(vch)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>معاينة وطباعة</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CLEARING VOUCHERS & RECONCILIATION STATEMENTS (سندات المقاصة) */}
      {activeMainTab === 'clearing' && (
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                <span>سندات المقاصة وكشوف المطابقة للمكتب الرئيسي</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                سندات تحويل حصة الإدارة العامة بعد اقتطاع نسبة عمولة الفرع المسجلة سابقا تبعا للنسب المتفق
                عليها مع كشف مطابقة يوضح سبب واحتساب المبلغ
              </p>
            </div>

            <button
              onClick={handleOpenClearingModal}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إصدار سند مقاصة جديد مع كشف مطابقة</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">رقم السند والتاريخ</th>
                  <th className="py-2.5 px-3">الطرف المحوّل إليه</th>
                  <th className="py-2.5 px-3">إجمالي المقبوض بالفرع</th>
                  <th className="py-2.5 px-3">عمولة الفرع المستقطعة</th>
                  <th className="py-2.5 px-3">الصافي المحول للمركز الرئيسي</th>
                  <th className="py-2.5 px-3 text-center">كشف المطابقة والطباعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {clearingVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      لا توجد سندات مقاصة محررة حتى الآن
                    </td>
                  </tr>
                ) : (
                  clearingVouchers.map((vch) => {
                    const cd = vch.clearingDetails;
                    return (
                      <tr key={vch.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-cyan-400">
                          <div>{vch.voucherNumber}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {vch.date || vch.timestamp?.split('T')[0]}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-bold text-white">{vch.paidByOrTo}</td>

                        <td className="py-3 px-3 font-mono font-semibold text-slate-300">
                          {cd ? (
                            <div>
                              {formatCurrency(cd.totalShippingCollectedSyp ?? 0, 'SYP')}
                              {cd.totalShippingCollectedUsd > 0 && ` + ${formatCurrency(cd.totalShippingCollectedUsd, 'USD')}`}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono text-rose-400">
                          {cd ? (
                            <div>
                              -{formatCurrency(cd.branchShippingCommissionAmountSyp ?? 0, 'SYP')}
                              <span className="text-[10px] text-slate-400 mr-1 font-sans">
                                ({cd.branchShippingCommissionPercent}%)
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono font-black text-emerald-400 text-sm">
                          {formatCurrency(vch.amount ?? 0, vch.currency)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedClearingSummaryForPrint(vch)}
                              className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/50 text-emerald-300 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                              title="طباعة ملخص مقاصة الوكيل الرسمي المجهز لورقة A4 (بدون توقيعات للإرسال مع المبلغ)"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-400" />
                              <span>ملخص المقاصة (A4)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedVoucherForPrint(vch)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="معاينة سند المقاصة الأصلي"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                              <span>السند</span>
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
      )}

      {/* TAB: INTER-BRANCH OBLIGATIONS (الذمم التبادلية بين الفروع) */}
      {activeMainTab === 'obligations' && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* عدد الفروع النشطة */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400 mb-1">
                فروع ذات ذمم معلقة
              </div>
              <div className="text-2xl font-black text-indigo-400 font-mono">
                {interBranchSummary.activeBranchesCount}
              </div>
            </div>

            {/* Receivable SYP */}
            <div className="bg-slate-900/60 border border-emerald-900/40 rounded-2xl p-4">
              <div className="text-xs text-emerald-400 mb-1">
                لنا بذمة الفروع (SYP)
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {formatCurrency(interBranchSummary.totalReceivableSyp, 'SYP')}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                علينا: {formatCurrency(interBranchSummary.totalPayableSyp, 'SYP')}
              </div>
            </div>

            {/* Receivable USD */}
            <div className="bg-slate-900/60 border border-cyan-900/40 rounded-2xl p-4">
              <div className="text-xs text-cyan-400 mb-1">
                لنا بذمة الفروع (USD)
              </div>
              <div className="text-2xl font-black text-cyan-400 font-mono">
                {formatCurrency(interBranchSummary.totalReceivableUsd, 'USD')}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                علينا: {formatCurrency(interBranchSummary.totalPayableUsd, 'USD')}
              </div>
            </div>

            {/* Net Position */}
            <div className={`bg-slate-900/60 border rounded-2xl p-4 ${
              interBranchSummary.netSyp >= 0 
                ? 'border-emerald-900/40' 
                : 'border-rose-900/40'
            }`}>
              <div className="text-xs text-slate-400 mb-1">
                الصافي التبادلي
              </div>
              <div className={`text-2xl font-black font-mono ${
                interBranchSummary.netSyp >= 0 
                  ? 'text-emerald-400' 
                  : 'text-rose-400'
              }`}>
                {interBranchSummary.netSyp >= 0 ? '+' : ''}
                {formatCurrency(interBranchSummary.netSyp, 'SYP')}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                {interBranchSummary.netUsd >= 0 ? '+' : ''}
                {formatCurrency(interBranchSummary.netUsd, 'USD')}
              </div>
            </div>
          </div>

          {/* Counterparties Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>الفروع المقابلة ذات الذمم القائمة ({interBranchSummary.counterparties.length})</span>
              </h3>
            </div>

            {interBranchSummary.counterparties.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                لا توجد ذمم معلقة حالياً
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-bold">الفرع المقابل</th>
                      <th className="px-4 py-3 font-bold">المحافظة</th>
                      <th className="px-4 py-3 font-bold text-center">الطرود</th>
                      <th className="px-4 py-3 font-bold">لنا (SYP)</th>
                      <th className="px-4 py-3 font-bold">علينا (SYP)</th>
                      <th className="px-4 py-3 font-bold">الصافي (SYP)</th>
                      <th className="px-4 py-3 font-bold">الصافي (USD)</th>
                      <th className="px-4 py-3 font-bold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {interBranchSummary.counterparties.map((c) => (
                      <tr key={c.branchId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-white">
                          {formatBranchLabel(c)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {c.governorate}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-800 rounded-full text-[10px] font-bold text-slate-300">
                            {c.totalPendingCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-400">
                          {c.receivableSyp > 0 
                            ? formatCurrency(c.receivableSyp, 'SYP') 
                            : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-rose-400">
                          {c.payableSyp > 0 
                            ? formatCurrency(c.payableSyp, 'SYP') 
                            : '—'}
                        </td>
                        <td className={`px-4 py-3 font-mono font-bold ${
                          c.netSyp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {c.netSyp >= 0 ? '+' : ''}
                          {formatCurrency(c.netSyp, 'SYP')}
                        </td>
                        <td className={`px-4 py-3 font-mono ${
                          c.netUsd >= 0 ? 'text-cyan-400' : 'text-rose-400'
                        }`}>
                          {c.netUsd >= 0 ? '+' : ''}
                          {formatCurrency(c.netUsd, 'USD')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setObligationDetailBranch(c)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer active:scale-95 shadow-sm"
                          >
                            كشف تفصيلي
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: MASTER LEDGER & SUB-CASHBOX SETTLEMENTS (سجل الصناديق والترصيد العام) */}
      {activeMainTab === 'master_ledger' && (
        <div className="space-y-5">
          {/* Sub-Cashbox Overview Cards Grid - Separated & RBAC Governed */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* 1. Outgoing Cashbox (صندوق قسم الصادر) */}
            {canViewOutgoingBox && (
              <div className={`bg-slate-900/90 border ${
                canOperateOutgoingBox ? 'border-indigo-500/50' : 'border-slate-800'
              } rounded-2xl p-4 shadow-lg relative flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${
                        canOperateOutgoingBox ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500'
                      } border flex items-center justify-center font-bold`}>
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-white">صندوق قسم الصادر</h3>
                        <span className="text-[10px] text-indigo-300/80">أجور الشحن المدفوعة سلفاً</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 text-[10px] font-bold">
                      Outbound
                    </span>
                  </div>

                  {/* Operational Breakdown */}
                  <div className="mt-3 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">مقبوضات واردة (+):</span>
                      <span className="font-bold text-emerald-400">
                        {canViewBalances || isOutgoingRole ? formatCurrency(cashboxBreakdown.outgoingBox.inflowSyp, 'SYP') : '***'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">مصاريف وصرفيات (-):</span>
                      <span className="font-bold text-rose-400">
                        {canViewBalances || isOutgoingRole ? formatCurrency(cashboxBreakdown.outgoingBox.outflowSyp, 'SYP') : '***'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">ترصيد مسلم للإدارة (⇄):</span>
                      <span className="font-bold text-amber-400">
                        {canViewBalances || isOutgoingRole ? formatCurrency(cashboxBreakdown.outgoingBox.transfersOutSyp, 'SYP') : '***'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 mt-2 bg-slate-950/60 p-2 rounded-xl">
                      <div className="flex items-baseline justify-between">
                        <span className="text-slate-400 text-xs font-sans font-bold">الرصيد الفعلي المتاح:</span>
                        <span className="text-base font-black text-indigo-300">
                          {canViewBalances || isOutgoingRole ? formatCurrency(cashboxBreakdown.outgoingBox.unsettledSyp, 'SYP') : '***'}
                        </span>
                      </div>
                      {(cashboxBreakdown.outgoingBox.unsettledUsd > 0 || cashboxBreakdown.outgoingBox.inflowUsd > 0) && (
                        <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-800">
                          <span className="text-slate-400 text-[10px] font-sans">بالدولار $:</span>
                          <span className="text-xs font-bold text-cyan-300">
                            {canViewBalances || isOutgoingRole ? formatCurrency(cashboxBreakdown.outgoingBox.unsettledUsd, 'USD') : '$***'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800">
                  {canOperateOutgoingBox ? (
                    <button
                      type="button"
                      onClick={() => handleOpenShiftSettlement('outgoing')}
                      className="w-full py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>ترصيد صندوق الصادر</span>
                    </button>
                  ) : (
                    <span className="w-full py-1 block text-center text-[10px] text-slate-500 bg-slate-950/60 rounded-lg border border-slate-800">
                      مخصص لموظف قسم الصادر
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 2. Incoming Cashbox (صندوق قسم الوارد) */}
            {canViewIncomingBox && (
              <div className={`bg-slate-900/90 border ${
                canOperateIncomingBox ? 'border-blue-500/50' : 'border-slate-800'
              } rounded-2xl p-4 shadow-lg relative flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${
                        canOperateIncomingBox ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-500'
                      } border flex items-center justify-center font-bold`}>
                        <ArrowDownLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-white">صندوق قسم الوارد</h3>
                        <span className="text-[10px] text-blue-300/80">تحصيلات COD وأجور الوجهة</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 text-[10px] font-bold">
                      Inbound
                    </span>
                  </div>

                  {/* Operational Breakdown */}
                  <div className="mt-3 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">تحصيلات ومقبوضات (+):</span>
                      <span className="font-bold text-emerald-400">
                        {canViewBalances || isIncomingRole ? formatCurrency(cashboxBreakdown.incomingBox.inflowSyp, 'SYP') : '***'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">صرفيات ومصاريف (-):</span>
                      <span className="font-bold text-rose-400">
                        {canViewBalances || isIncomingRole ? formatCurrency(cashboxBreakdown.incomingBox.outflowSyp, 'SYP') : '***'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">ترصيد مسلم للإدارة (⇄):</span>
                      <span className="font-bold text-amber-400">
                        {canViewBalances || isIncomingRole ? formatCurrency(cashboxBreakdown.incomingBox.transfersOutSyp, 'SYP') : '***'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 mt-2 bg-slate-950/60 p-2 rounded-xl">
                      <div className="flex items-baseline justify-between">
                        <span className="text-slate-400 text-xs font-sans font-bold">الرصيد الفعلي المتاح:</span>
                        <span className="text-base font-black text-blue-300">
                          {canViewBalances || isIncomingRole ? formatCurrency(cashboxBreakdown.incomingBox.unsettledSyp, 'SYP') : '***'}
                        </span>
                      </div>
                      {(cashboxBreakdown.incomingBox.unsettledUsd > 0 || cashboxBreakdown.incomingBox.inflowUsd > 0) && (
                        <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-800">
                          <span className="text-slate-400 text-[10px] font-sans">بالدولار $:</span>
                          <span className="text-xs font-bold text-cyan-300">
                            {canViewBalances || isIncomingRole ? formatCurrency(cashboxBreakdown.incomingBox.unsettledUsd, 'USD') : '$***'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800">
                  {canOperateIncomingBox ? (
                    <button
                      type="button"
                      onClick={() => handleOpenShiftSettlement('incoming')}
                      className="w-full py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>ترصيد صندوق الوارد</span>
                    </button>
                  ) : (
                    <span className="w-full py-1 block text-center text-[10px] text-slate-500 bg-slate-950/60 rounded-lg border border-slate-800">
                      مخصص لموظف قسم الوارد
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 3. Inter-Branch Transfers & Settlements (قسم المناقلات المالية بين الفروع) */}
            {canViewTransfers && (
              <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-4 shadow-lg relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-bold">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-white">المناقلات والتوريدات</h3>
                        <span className="text-[10px] text-cyan-400/80">حركة النقد بين الفروع</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 text-[10px] font-bold font-mono">
                      Transfers
                    </span>
                  </div>

                  {/* Transfer Breakdown */}
                  <div className="mt-3 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">مناقلات مستلمة (+):</span>
                      <span className="font-bold text-emerald-400">
                        {canViewBalances ? formatCurrency(cashboxBreakdown.transfersBox.receivedSyp, 'SYP') : '***'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">مناقلات مرسلة (-):</span>
                      <span className="font-bold text-rose-400">
                        {canViewBalances ? formatCurrency(cashboxBreakdown.transfersBox.sentSyp, 'SYP') : '***'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 mt-2 bg-slate-950/60 p-2 rounded-xl">
                      <div className="flex items-baseline justify-between">
                        <span className="text-slate-400 text-xs font-sans font-bold">صافي حركة المناقلات:</span>
                        <span className={`text-base font-black ${
                          cashboxBreakdown.transfersBox.netSyp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {canViewBalances ? formatCurrency(cashboxBreakdown.transfersBox.netSyp, 'SYP') : '***'}
                        </span>
                      </div>
                      {(cashboxBreakdown.transfersBox.receivedUsd > 0 || cashboxBreakdown.transfersBox.sentUsd > 0) && (
                        <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-800">
                          <span className="text-slate-400 text-[10px] font-sans">صافي بالدولار $:</span>
                          <span className={`text-xs font-bold ${
                            cashboxBreakdown.transfersBox.netUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}>
                            {canViewBalances ? formatCurrency(cashboxBreakdown.transfersBox.netUsd, 'USD') : '$***'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>عمليات التوريد والترحيل</span>
                  <span className="font-mono text-cyan-300 font-bold">تلقائي</span>
                </div>
              </div>
            )}

            {/* 4. Master Vault (خزينة مدير الفرع) */}
            {canViewMasterVault && (
              <div className={`bg-gradient-to-br from-slate-900 to-slate-950 border-2 ${
                canOperateMasterVault ? 'border-amber-500/40' : 'border-slate-800'
              } rounded-2xl p-4 shadow-xl relative overflow-hidden flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${
                        canOperateMasterVault ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-500'
                      } border flex items-center justify-center font-bold`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-white">خزينة مدير الفرع</h3>
                        <span className="text-[10px] text-amber-400/80">الخزينة الرئيسية المركزية</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      canOperateMasterVault ? 'bg-amber-950 text-amber-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      Master Vault
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">مقبوضات وترصيد مستلم (+):</span>
                      <span className="font-bold text-emerald-400">
                        {canViewBalances ? formatCurrency(cashboxBreakdown.masterBox.inflowSyp, 'SYP') : '***'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-[11px] text-slate-400">مصاريف ومسحوبات الخزينة (-):</span>
                      <span className="font-bold text-rose-400">
                        {canViewBalances ? formatCurrency(cashboxBreakdown.masterBox.outflowSyp, 'SYP') : '***'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 mt-2 bg-slate-950/60 p-2 rounded-xl">
                      <div className="flex items-baseline justify-between">
                        <span className="text-slate-400 text-xs font-sans font-bold">رصيد الخزينة ل.س:</span>
                        <span className="text-lg font-black text-amber-300">
                          {canViewBalances ? formatCurrency(cashboxBreakdown.masterBox.syp, 'SYP') : '***,***'}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-800">
                        <span className="text-slate-400 text-[10px] font-sans">رصيد الخزينة $:</span>
                        <span className="text-xs font-bold text-cyan-400">
                          {canViewBalances ? formatCurrency(cashboxBreakdown.masterBox.usd, 'USD') : '$***'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{canOperateMasterVault ? 'تستقبل سندات الترصيد المعتمدة' : 'صلاحية مخصصة لمدير الفرع'}</span>
                  <span className={`font-mono font-bold ${canOperateMasterVault ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {canOperateMasterVault ? 'جاهز' : 'مقفل'}
                  </span>
                </div>
              </div>
            )}

            {/* 5. Total Branch Liquidity (إجمالي سيولة الفرع الشاملة) */}
            {canViewAllBoxes && (
              <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-lg relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-white">إجمالي سيولة الفرع</h3>
                        <span className="text-[10px] text-slate-400">مجموع الخزينة والصناديق</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold">
                      Total Liquid
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 font-mono">
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-400 text-xs font-sans">المجموع ل.س:</span>
                      <span className="text-lg font-black text-emerald-400">
                        {canViewBalances ? formatCurrency(cashboxBreakdown.totalBranchLiquiditySyp, 'SYP') : '***,***'}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-400 text-xs font-sans">المجموع $:</span>
                      <span className="text-sm font-bold text-cyan-400">
                        {canViewBalances ? formatCurrency(cashboxBreakdown.totalBranchLiquidityUsd, 'USD') : '$***'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>سندات الترصيد المسجلة:</span>
                  <span className="font-mono text-white font-bold">{branchShiftSettlements.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Shift Settlements Ledger (دفتر وسجل سندات الترصيد مع مدير الفرع) */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>سجل سندات ترصيد وإقفال الورديات مع خزينة مدير الفرع</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  كافة عمليات تسليم العهد النقدية من مسؤولي الصادر والوارد وإقفالها في صندوق مدير الفرع
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                {/* Status Filter */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setSettlementStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      settlementStatusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'
                    }`}
                  >
                    الكل ({branchShiftSettlements.length})
                  </button>
                  <button
                    onClick={() => setSettlementStatusFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      settlementStatusFilter === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    بانتظار الاعتماد ({pendingShiftCount})
                  </button>
                  <button
                    onClick={() => setSettlementStatusFilter('approved')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      settlementStatusFilter === 'approved' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    معتمد
                  </button>
                  <button
                    onClick={() => setSettlementStatusFilter('rejected')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      settlementStatusFilter === 'rejected' ? 'bg-rose-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    مرفوض
                  </button>
                </div>

                {/* Scope Filter */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setSettlementScopeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      settlementScopeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'
                    }`}
                  >
                    الصناديق
                  </button>
                  <button
                    onClick={() => setSettlementScopeFilter('outgoing')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      settlementScopeFilter === 'outgoing' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    الصادر
                  </button>
                  <button
                    onClick={() => setSettlementScopeFilter('incoming')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      settlementScopeFilter === 'incoming' ? 'bg-blue-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    الوارد
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenShiftSettlement()}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تحرير سند ترصيد جديد</span>
                </button>
              </div>
            </div>

            {/* Settlements Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-3">رقم السند والتاريخ</th>
                    <th className="py-2.5 px-3">الصندوق المحوّل منه</th>
                    <th className="py-2.5 px-3">الموظف المسلّم</th>
                    <th className="py-2.5 px-3">المبلغ المسلم ل.س</th>
                    <th className="py-2.5 px-3">المبلغ المسلم $</th>
                    <th className="py-2.5 px-3">الحالة والاعتماد</th>
                    <th className="py-2.5 px-3 text-center">الإجراءات والطباعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {branchShiftSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        لا توجد سندات ترصيد محررة حتى الآن
                      </td>
                    </tr>
                  ) : (
                    branchShiftSettlements
                      .filter((s) => {
                        if (settlementStatusFilter !== 'all' && s.status !== settlementStatusFilter) return false;
                        if (settlementScopeFilter !== 'all' && s.cashboxScope !== settlementScopeFilter) return false;
                        return true;
                      })
                      .map((voucher) => {
                        const isPending = voucher.status === 'pending';
                        const isApproved = voucher.status === 'approved';
                        const isRejected = voucher.status === 'rejected';

                        return (
                          <tr key={voucher.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-amber-400">
                              <div>{voucher.voucherNumber}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {voucher.date || voucher.timestamp.split('T')[0]}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  voucher.cashboxScope === 'outgoing'
                                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                                    : 'bg-blue-950 text-blue-300 border border-blue-700/60'
                                }`}
                              >
                                {voucher.cashboxScope === 'outgoing' ? 'صندوق قسم الصادر' : 'صندوق قسم الوارد'}
                              </span>
                            </td>

                            <td className="py-3 px-3 font-semibold text-white">
                              {voucher.operatorName || voucher.officerName}
                            </td>

                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                              {formatCurrency(voucher.sypAmount, 'SYP')}
                            </td>

                            <td className="py-3 px-3 font-mono font-bold text-cyan-400">
                              {voucher.usdAmount > 0 ? formatCurrency(voucher.usdAmount, 'USD') : '—'}
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-1 items-start">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                                    isApproved
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                      : isRejected
                                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                      : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                  }`}
                                >
                                  {isApproved && <CheckCircle2 className="w-3 h-3" />}
                                  {isRejected && <AlertCircle className="w-3 h-3" />}
                                  {isPending && <Clock className="w-3 h-3" />}
                                  <span>
                                    {isApproved
                                      ? 'معتمد ومرحل للخزينة'
                                      : isRejected
                                      ? 'مرفوض'
                                      : 'بانتظار استلام المدير'}
                                  </span>
                                </span>
                                {(voucher.notes) && (
                                  <span className="text-[10px] text-slate-300 italic max-w-xs truncate" title={voucher.notes}>
                                    ملاحظات الموظف: "{voucher.notes}"
                                  </span>
                                )}
                                {(voucher.managerNotes) && (
                                  <span className="text-[10px] text-emerald-300 italic max-w-xs truncate" title={voucher.managerNotes}>
                                    تأكيد المدير: "{voucher.managerNotes}"
                                  </span>
                                )}
                                {(voucher.approverName || voucher.managerName) && (
                                  <span className="text-[10px] text-slate-400">
                                    المستلم: {voucher.approverName || voucher.managerName}
                                  </span>
                                )}
                                {(voucher.rejectionReason || voucher.rejectedReason) && (
                                  <span className="text-[10px] text-rose-300">
                                    سبب الرفض: {voucher.rejectionReason || voucher.rejectedReason}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {isPending && canApproveShiftSettlement && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setApproveModalVoucher(voucher);
                                        setManagerApprovalNotes('');
                                      }}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                      title="اعتماد وتأكيد استلام النقد وتصفير الصندوق مع إضافة الملاحظات"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>اعتماد واستلام</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectModalVoucher(voucher);
                                        setRejectionReason('');
                                      }}
                                      className="px-2 py-1 bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-rose-600/40"
                                      title="رفض سند الترصيد وإعادته للموظف"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>رفض</span>
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setSelectedShiftVoucherForPrint(voucher)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="طباعة سند الترصيد الرسمي"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>طباعة السند</span>
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

      {/* ========================================================= */}
      {/* MODAL 1: NEW RECEIPT VOUCHER (سند قبض جديد) */}
      {/* ========================================================= */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">تحرير سند قبض نقدية رسمي (وارد صندوق)</h2>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                    <span className="bg-emerald-950/80 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                      إيداع مباشر في:{' '}
                      {currentUser.role === 'inbound_operator'
                        ? 'صندوق الوارد'
                        : currentUser.role === 'outbound_operator' || currentUser.role === 'reception_data_entry'
                        ? 'صندوق الصادر'
                        : currentUser.role === 'cashier'
                        ? 'صندوق الكاشير'
                        : ledgerScopeFilter === 'outgoing'
                        ? 'صندوق الصادر'
                        : ledgerScopeFilter === 'incoming'
                        ? 'صندوق الوارد'
                        : 'الخزينة الرئيسية'}
                    </span>
                    <span className="text-slate-400">
                      | الموظف المسؤول: <strong className="text-slate-200">{currentUser.name}</strong>
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Payee */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    المستلم منه (المودع / العميل) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={receiptPayee}
                    onChange={(e) => setReceiptPayee(e.target.value)}
                    placeholder="اسم الشخص أو الشركة المودعة"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">العملة</label>
                  <select
                    value={receiptCurrency}
                    onChange={(e) => setReceiptCurrency(e.target.value as Currency)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white font-bold focus:outline-none"
                  >
                    <option value="SYP">ليرة سورية (SYP)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    المبلغ المقبوض ({receiptCurrency === 'SYP' ? 'ل.س' : '$'}){' '}
                    <span className="text-rose-400">*</span>
                  </label>
                  <FormattedAmountInput
                    required
                    value={receiptAmount}
                    currency={receiptCurrency}
                    onChange={(num) => setReceiptAmount(num)}
                    placeholder="أدخل المبلغ المقبوض"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-emerald-300 font-mono font-bold focus:outline-none"
                  />
                </div>

                {/* Reference */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    رقم الإيصال الورقي أو المرجع (اختياري)
                  </label>
                  <input
                    type="text"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                    placeholder="مثال: REC-SY-9921"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">البيان والشرح</label>
                <textarea
                  rows={2}
                  value={receiptDescription}
                  onChange={(e) => setReceiptDescription(e.target.value)}
                  placeholder="شرح تفصيلي لسبب القبض والمقبوضات..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  اعتماد وترحيل سند القبض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* UNIFIED EXPENSE & PAYMENT VOUCHER MODAL */}
      {/* ========================================================= */}
      <UnifiedExpenseModal
        isOpen={isUnifiedExpenseModalOpen}
        onClose={() => setIsUnifiedExpenseModalOpen(false)}
        onSuccess={(createdExp) => {
          if (createdExp.voucherId) {
            const vch = vouchers.find((v) => v.id === createdExp.voucherId);
            if (vch) setSelectedVoucherForPrint(vch);
          }
        }}
      />

      {/* ========================================================= */}
      {/* MODAL 4: SHIFT SETTLEMENT MODAL (سند ترصيد وإقفال وردية) */}
      {/* ========================================================= */}
      {isShiftSettlementModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">تحرير سند ترصيد وإقفال وردية</h2>
                  <span className="text-[11px] text-slate-400 font-mono">
                    تسليم العهدة النقدية إلى خزينة مدير فرع {currentBranch?.name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftSettlementModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmShiftSettlement} className="space-y-4 text-xs">
              {/* Box Scope Selection */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  الصندوق المسلّم للعهدة <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSettlementScope('outgoing');
                      setSettlementSyp(cashboxBreakdown.outgoingBox.unsettledSyp);
                      setSettlementUsd(cashboxBreakdown.outgoingBox.unsettledUsd);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      settlementScope === 'outgoing'
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>صندوق قسم الصادر</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettlementScope('incoming');
                      setSettlementSyp(cashboxBreakdown.incomingBox.unsettledSyp);
                      setSettlementUsd(cashboxBreakdown.incomingBox.unsettledUsd);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      settlementScope === 'incoming'
                        ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>صندوق قسم الوارد</span>
                  </button>
                </div>
              </div>

              {/* Unsettled Balances Indicator */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">النقد الفعلي المسجل غير المرصد:</span>
                  <div className="font-mono font-bold text-amber-300 mt-0.5">
                    {formatCurrency(
                      settlementScope === 'outgoing'
                        ? cashboxBreakdown.outgoingBox.unsettledSyp
                        : cashboxBreakdown.incomingBox.unsettledSyp,
                      'SYP'
                    )}
                    {((settlementScope === 'outgoing'
                      ? cashboxBreakdown.outgoingBox.unsettledUsd
                      : cashboxBreakdown.incomingBox.unsettledUsd) > 0) && (
                      <span className="text-cyan-400 mr-2">
                        + {formatCurrency(
                          settlementScope === 'outgoing'
                            ? cashboxBreakdown.outgoingBox.unsettledUsd
                            : cashboxBreakdown.incomingBox.unsettledUsd,
                          'USD'
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (settlementScope === 'outgoing') {
                      setSettlementSyp(cashboxBreakdown.outgoingBox.unsettledSyp);
                      setSettlementUsd(cashboxBreakdown.outgoingBox.unsettledUsd);
                    } else {
                      setSettlementSyp(cashboxBreakdown.incomingBox.unsettledSyp);
                      setSettlementUsd(cashboxBreakdown.incomingBox.unsettledUsd);
                    }
                  }}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition cursor-pointer"
                >
                  مطابقة وتعبئة الرصيد بالكامل
                </button>
              </div>

              {/* Amounts Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    المبلغ المسلّم (ليرة سورية SYP) <span className="text-rose-400">*</span>
                  </label>
                  <FormattedAmountInput
                    value={settlementSyp}
                    currency="SYP"
                    onChange={(num) => setSettlementSyp(num)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    المبلغ المسلّم (دولار أمريكي USD)
                  </label>
                  <FormattedAmountInput
                    value={settlementUsd}
                    currency="USD"
                    onChange={(num) => setSettlementUsd(num)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-amber-300 mb-1">
                  بند الملاحظات المرافق دائماً (إلزامي للتوثيق والمطابقة) <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="ملاحظات تسليم الوردية للمدير ومطابقة الجرد..."
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsShiftSettlementModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-950/40 cursor-pointer transition"
                >
                  تأكيد وإصدار سند الترصيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: REJECTION REASON MODAL (رفض سند الترصيد) */}
      {/* ========================================================= */}
      {rejectModalVoucher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <h2 className="text-sm font-bold text-white">رفض سند الترصيد رقم {rejectModalVoucher.voucherNumber}</h2>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalVoucher(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                يرجى تدوين سبب رفض سند الترصيد المقدم من الموظف (<strong>{rejectModalVoucher.operatorName || rejectModalVoucher.officerName}</strong>):
              </p>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="مثال: يوجد نقص 5,000 ل.س في الجرد الفعلي..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-rose-500"
                required
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectModalVoucher(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!rejectionReason.trim()) {
                      alert('يرجى كتابة سبب الرفض');
                      return;
                    }
                    rejectShiftSettlement(rejectModalVoucher.id, rejectionReason.trim());
                    setRejectModalVoucher(null);
                  }}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs cursor-pointer transition"
                >
                  تأكيد الرفض
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: MANAGER SHIFT SETTLEMENT APPROVAL MODAL */}
      {/* ========================================================= */}
      {approveModalVoucher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    اعتماد سند الترصيد رقم {approveModalVoucher.voucherNumber}
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    تأكيد استلام النقدية في خزينة المدير وتصفير رصيد الصندوق
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApproveModalVoucher(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">الموظف المسلم:</span>
                <strong className="text-white">{approveModalVoucher.officerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الصندوق:</span>
                <strong className="text-amber-300">
                  {approveModalVoucher.cashboxScope === 'outgoing' ? 'صندوق قسم الصادر' : 'صندوق قسم الوارد'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ بالليرة السورية:</span>
                <strong className="text-emerald-400 font-mono">
                  {formatCurrency(approveModalVoucher.sypAmount, 'SYP')}
                </strong>
              </div>
              {approveModalVoucher.usdAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">المبلغ بالدولار:</span>
                  <strong className="text-cyan-400 font-mono">
                    {formatCurrency(approveModalVoucher.usdAmount, 'USD')}
                  </strong>
                </div>
              )}
              {approveModalVoucher.notes && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-400 block mb-0.5">ملاحظات الموظف المسلم:</span>
                  <p className="text-slate-200 italic font-sans">"{approveModalVoucher.notes}"</p>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                approveShiftSettlement(approveModalVoucher.id, managerApprovalNotes.trim() || undefined);
                setApproveModalVoucher(null);
                setManagerApprovalNotes('');
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-emerald-300 mb-1">
                  بند ملاحظات وتأكيد المدير المرافق دائماً:
                </label>
                <textarea
                  rows={2}
                  value={managerApprovalNotes}
                  onChange={(e) => setManagerApprovalNotes(e.target.value)}
                  placeholder="أدخل ملاحظات اعتماد واستلام النقدية (مثال: تم الجرد والمطابقة واستلام المبلغ نقداً وتصفير الصندوق)..."
                  className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setApproveModalVoucher(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/40 cursor-pointer transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد اعتماد السند وتصفير الصندوق</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: FULL SCREEN CLEARING & RECONCILIATION MODAL */}
      {/* ========================================================= */}
      <ClearingReconciliationModal
        isOpen={isClearingModalOpen}
        onClose={() => setIsClearingModalOpen(false)}
        onVoucherCreated={(v) => {
          setSelectedClearingSummaryForPrint(v);
        }}
      />

      {/* ========================================================= */}
      {/* CLEARING SUMMARY PRINT REPORT (A4 NO SIGNATURES) */}
      {/* ========================================================= */}
      <ClearingSummaryPrintModal
        voucher={selectedClearingSummaryForPrint}
        onClose={() => setSelectedClearingSummaryForPrint(null)}
      />

      {/* ========================================================= */}
      {/* VAULT CASH TRANSFER MODAL (مناقلة أموال وصناديق بين الفروع) */}
      {/* ========================================================= */}
      <VaultTransferModal
        isOpen={isVaultTransferModalOpen}
        onClose={() => setIsVaultTransferModalOpen(false)}
        onSuccess={(v) => setSelectedVoucherForPrint(v)}
      />

      {/* ========================================================= */}
      {/* VOUCHER PRINT & DETAILED MATCHING STATEMENT MODAL */}
      {/* ========================================================= */}
      <VoucherPrintModal
        voucher={selectedVoucherForPrint}
        onClose={() => setSelectedVoucherForPrint(null)}
      />

      {/* ========================================================= */}
      {/* SHIFT SETTLEMENT PRINT MODAL (طباعة سند ترصيد الوردية) */}
      {/* ========================================================= */}
      <ShiftSettlementPrintModal
        voucher={selectedShiftVoucherForPrint}
        branch={currentBranch}
        onClose={() => setSelectedShiftVoucherForPrint(null)}
      />

      {/* ========================================================= */}
      {/* INTER-BRANCH OBLIGATIONS DETAIL MODAL (كشف الذمم التبادلية) */}
      {/* ========================================================= */}
      {obligationDetailBranch && (
        <InterBranchObligationsDetailModal
          isOpen={true}
          onClose={() => setObligationDetailBranch(null)}
          currentBranchId={currentBranch?.id || ''}
          counterpartyBranchId={obligationDetailBranch.branchId}
          counterpartyBranchName={formatBranchLabel(obligationDetailBranch)}
        />
      )}
    </div>
  );
};
