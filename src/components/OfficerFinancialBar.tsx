import React, { useState } from 'react';
import { useOrca } from '../context/OrcaContext';
import { UnifiedExpenseModal } from './UnifiedExpenseModal';
import { FormattedAmountInput } from './FormattedAmountInput';
import {
  Wallet,
  Coins,
  DollarSign,
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Printer,
  History,
  Info,
  PlusCircle,
  MinusCircle,
  Receipt,
  Building2,
  Sparkles,
  Package,
  Send,
  UserCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { ShiftSettlementVoucher, FinancialVoucher, Currency, CashboxScope } from '../types';
import { ShiftSettlementPrintModal } from './ShiftSettlementPrintModal';
import { VoucherPrintModal } from './VoucherPrintModal';

interface OfficerFinancialBarProps {
  onOpenModule?: (module: any) => void;
  className?: string;
}

export const OfficerFinancialBar: React.FC<OfficerFinancialBarProps> = ({
  onOpenModule,
  className = '',
}) => {
  const {
    currentUser,
    currentBranch,
    branches,
    users = [],
    brandingSettings,
    formatCurrency,
    formatExchangeRate,
    formatNumber,
    getCashboxBreakdown,
    getRoleCashboxData,
    getRoleBoxTransactions,
    getRoleBoxInfo,
    shiftSettlements,
    transactions,
    vouchers,
    parcels,
    submitShiftSettlement,
    approveShiftSettlement,
    rejectShiftSettlement,
    addFinancialVoucher,
    canAccessModule,
    hasPermission,
  } = useOrca();

  // Primary Modal States
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSuperAdminBreakdownModalOpen, setIsSuperAdminBreakdownModalOpen] = useState(false);

  // Print Modal States
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<ShiftSettlementVoucher | null>(null);
  const [selectedFinancialVoucherForPrint, setSelectedFinancialVoucherForPrint] = useState<FinancialVoucher | null>(null);

  // Settlement Form State
  const [settlementMode, setSettlementMode] = useState<'full' | 'custom'>('full');
  const [settlementScope, setSettlementScope] = useState<'outgoing' | 'incoming'>(
    currentUser?.role === 'inbound_operator' ? 'incoming' : 'outgoing'
  );
  const [customSyp, setCustomSyp] = useState<number>(0);
  const [customUsd, setCustomUsd] = useState<number>(0);
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [notesError, setNotesError] = useState<string | null>(null);

  // Receipt Voucher Form State
  const [receiptAmount, setReceiptAmount] = useState<number>(0);
  const [receiptCurrency, setReceiptCurrency] = useState<Currency>('SYP');
  const [receiptPaidBy, setReceiptPaidBy] = useState<string>('');
  const [receiptDescription, setReceiptDescription] = useState<string>('');
  const [receiptRefNo, setReceiptRefNo] = useState<string>('');
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Expense Voucher Form State
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>('SYP');
  const [expensePaidTo, setExpensePaidTo] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('مصاريف تشغيلية ونثريات');
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseRefNo, setExpenseRefNo] = useState<string>('');
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Manager Approval State
  const [selectedVoucherToApprove, setSelectedVoucherToApprove] = useState<ShiftSettlementVoucher | null>(null);
  const [managerApprovalNotes, setManagerApprovalNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Ledger filter states with multi-role support for Branch Manager
  const [ledgerCurrency, setLedgerCurrency] = useState<'SYP' | 'USD'>('SYP');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [ledgerRoleFilter, setLedgerRoleFilter] = useState<'all' | 'outgoing' | 'incoming' | 'manager' | 'courier' | 'cashier'>('all');
  const [ledgerUserFilter, setLedgerUserFilter] = useState<string>('all');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('all');
  const [ledgerDateFilter, setLedgerDateFilter] = useState<'all' | 'today' | '3days' | 'week' | 'month'>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');

  const userRole = currentUser?.role || 'outbound_operator';
  const isOutgoingRole =
    userRole === 'outbound_operator' || userRole === 'reception_data_entry';
  const isIncomingRole = userRole === 'inbound_operator';
  const isBranchManager =
    userRole === 'super_admin' ||
    userRole === 'hub_manager' ||
    (userRole as string) === 'branch_manager' ||
    (userRole as string) === 'admin';
  const isManagerRole =
    isBranchManager ||
    userRole === 'cashier';

  // Permission check for Master Cashbox Center (strictly for Application Manager super_admin)
  const canAccessCashboxCenter =
    userRole === 'super_admin' || currentUser?.role === 'super_admin';

  const breakdown = getCashboxBreakdown ? getCashboxBreakdown(currentBranch?.id) : {
    outgoingSyp: 0,
    outgoingUsd: 0,
    incomingSyp: 0,
    incomingUsd: 0,
    masterSyp: 0,
    masterUsd: 0,
    totalBranchSyp: 0,
    totalBranchUsd: 0,
    pendingSettlementsCount: 0,
    outgoingBox: { inflowSyp: 0, inflowUsd: 0, outflowSyp: 0, outflowUsd: 0, transfersOutSyp: 0, transfersOutUsd: 0, unsettledSyp: 0, unsettledUsd: 0, syp: 0, usd: 0 },
    incomingBox: { inflowSyp: 0, inflowUsd: 0, outflowSyp: 0, outflowUsd: 0, transfersOutSyp: 0, transfersOutUsd: 0, unsettledSyp: 0, unsettledUsd: 0, syp: 0, usd: 0 },
    cashierBox: { inflowSyp: 0, inflowUsd: 0, outflowSyp: 0, outflowUsd: 0, transfersOutSyp: 0, transfersOutUsd: 0, unsettledSyp: 0, unsettledUsd: 0, syp: 0, usd: 0 },
    managerBox: { inflowSyp: 0, inflowUsd: 0, outflowSyp: 0, outflowUsd: 0, transfersInSyp: 0, transfersInUsd: 0, transfersOutSyp: 0, transfersOutUsd: 0, unsettledSyp: 0, unsettledUsd: 0, syp: 0, usd: 0 },
    courierBox: { inflowSyp: 0, inflowUsd: 0, outflowSyp: 0, outflowUsd: 0, transfersOutSyp: 0, transfersOutUsd: 0, unsettledSyp: 0, unsettledUsd: 0, syp: 0, usd: 0 },
    accountantBox: { inflowSyp: 0, inflowUsd: 0, outflowSyp: 0, outflowUsd: 0, transfersOutSyp: 0, transfersOutUsd: 0, unsettledSyp: 0, unsettledUsd: 0, syp: 0, usd: 0 },
  };

  // Branch employees list for filtering
  const branchUsers = React.useMemo(() => {
    return (users || []).filter(
      (u) => !currentBranch?.id || u.branchId === currentBranch.id || u.role === 'super_admin'
    );
  }, [users, currentBranch?.id]);

  // Role-isolated cashbox data
  const roleBoxData = getRoleCashboxData
    ? getRoleCashboxData(userRole, currentBranch?.id)
    : {
        scope: 'outgoing' as CashboxScope,
        boxName: 'صندوق الصادر',
        branchName: currentBranch?.name || 'الفرع الرئيسي',
        fullTitle: 'صندوق الصادر — ' + (currentBranch?.name || ''),
        syp: 0,
        usd: 0,
      };

  const activeBoxTitle = roleBoxData.boxName;
  const currentBoxSyp = roleBoxData.syp;
  const currentBoxUsd = roleBoxData.usd;
  const defaultBoxScope: CashboxScope = roleBoxData.scope;

  // Selected Box metadata & real-time balance for the ledger modal
  const activeSelectedBoxInfo = React.useMemo(() => {
    if (!isBranchManager) {
      return {
        scope: defaultBoxScope,
        title: roleBoxData.boxName,
        fullTitle: roleBoxData.fullTitle,
        sypBalance: roleBoxData.syp,
        usdBalance: roleBoxData.usd,
      };
    }
    switch (ledgerRoleFilter) {
      case 'outgoing':
        return {
          scope: 'outgoing' as CashboxScope,
          title: 'صندوق الصادر والاستقبال',
          fullTitle: `صندوق الصادر — فرع ${currentBranch?.name || ''}`,
          sypBalance: breakdown.outgoingBox.syp,
          usdBalance: breakdown.outgoingBox.usd,
        };
      case 'incoming':
        return {
          scope: 'incoming' as CashboxScope,
          title: 'صندوق الوارد والتسليم',
          fullTitle: `صندوق الوارد — فرع ${currentBranch?.name || ''}`,
          sypBalance: breakdown.incomingBox.syp,
          usdBalance: breakdown.incomingBox.usd,
        };
      case 'manager':
        return {
          scope: 'manager' as CashboxScope,
          title: 'خزينة وصندوق مدير الفرع (العهد والترصيدات)',
          fullTitle: `خزينة المدير — فرع ${currentBranch?.name || ''}`,
          sypBalance: breakdown.managerBox.syp,
          usdBalance: breakdown.managerBox.usd,
        };
      case 'courier':
        return {
          scope: 'courier' as CashboxScope,
          title: 'صندوق كباتن ومناديب التوزيع',
          fullTitle: `عهدة التوزيع — فرع ${currentBranch?.name || ''}`,
          sypBalance: breakdown.courierBox?.syp || 0,
          usdBalance: breakdown.courierBox?.usd || 0,
        };
      case 'cashier':
        return {
          scope: 'cashier' as CashboxScope,
          title: 'صندوق أمين الصندوق والمحاسبة',
          fullTitle: `صندوق المحاسبة — فرع ${currentBranch?.name || ''}`,
          sypBalance: breakdown.cashierBox?.syp || 0,
          usdBalance: breakdown.cashierBox?.usd || 0,
        };
      case 'all':
      default:
        return {
          scope: 'master' as CashboxScope,
          title: 'كافة صناديق وأدوار الفرع (كشف موحد)',
          fullTitle: `كشف حركات الفرع الشامل — فرع ${currentBranch?.name || ''}`,
          sypBalance: breakdown.totalBranchSyp,
          usdBalance: breakdown.totalBranchUsd,
        };
    }
  }, [isBranchManager, defaultBoxScope, roleBoxData, ledgerRoleFilter, breakdown, currentBranch?.name]);

  // Branch settlements
  const branchSettlements = (shiftSettlements || []).filter(
    (s) => s.branchId === currentBranch?.id
  );

  // Specific box settlements strictly isolated to this role's scope and officer (no crossover between roles)
  const boxSettlements = branchSettlements
    .filter((s) => {
      if (currentBranch?.id && s.branchId !== currentBranch.id) return false;
      if (s.cashboxScope !== defaultBoxScope) return false;
      if (isOutgoingRole || isIncomingRole) {
        if (s.officerUserId && currentUser?.id && s.officerUserId !== currentUser.id) return false;
        if (!s.officerUserId && s.officerName && currentUser?.name && s.officerName !== currentUser.name) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Pending settlements strictly for the responsible manager
  const pendingSettlementsForManager = branchSettlements.filter(
    (s) =>
      (s.status === 'pending' || s.status === 'pending_approval') &&
      (s.managerUserId === currentUser?.id || currentUser?.role === 'hub_manager' || currentUser?.role === 'super_admin' || (currentUser?.role as string) === 'admin')
  );

  // My pending settlement as an officer
  const myPendingSettlement = branchSettlements.find(
    (s) =>
      currentUser &&
      (s.officerUserId === currentUser.id || s.officerName === currentUser.name) &&
      (s.status === 'pending' || s.status === 'pending_approval')
  );

  // Raw role transactions before detailed filters
  const rawRoleTransactions = React.useMemo(() => {
    if (!isBranchManager) {
      return getRoleBoxTransactions
        ? getRoleBoxTransactions(userRole, currentBranch?.id, currentUser?.id)
        : [];
    }

    const allBranchTx = (transactions || []).filter(
      (t) => !currentBranch?.id || t.branchId === currentBranch.id
    );

    if (ledgerRoleFilter === 'outgoing') {
      return allBranchTx.filter(
        (t) =>
          t.cashboxScope === 'outgoing' ||
          (!t.cashboxScope &&
            (t.type === 'shipping_income_prepaid' ||
              t.performedByRole === 'outbound_operator' ||
              t.performedByRole === 'reception_data_entry'))
      );
    }
    if (ledgerRoleFilter === 'incoming') {
      return allBranchTx.filter(
        (t) =>
          t.cashboxScope === 'incoming' ||
          (!t.cashboxScope &&
            (t.type === 'shipping_collected_dest' ||
              t.type === 'cod_collected_dest' ||
              t.performedByRole === 'inbound_operator'))
      );
    }
    if (ledgerRoleFilter === 'manager') {
      return allBranchTx.filter(
        (t) =>
          t.cashboxScope === 'manager' ||
          t.cashboxScope === 'master' ||
          (!t.cashboxScope &&
            [
              'shift_settlement_received_inflow',
              'settlement_received_from_branch',
              'settlement_transfer_to_hub',
              'cod_paid_to_sender',
              'branch_commission_payout',
            ].includes(t.type)) ||
          t.performedByRole === 'hub_manager' ||
          t.performedByRole === 'super_admin'
      );
    }
    if (ledgerRoleFilter === 'courier') {
      return allBranchTx.filter(
        (t) =>
          t.cashboxScope === 'courier' ||
          t.performedByRole === 'courier' ||
          t.type === 'cod_collected_dest'
      );
    }
    if (ledgerRoleFilter === 'cashier') {
      return allBranchTx.filter(
        (t) =>
          t.cashboxScope === 'cashier' ||
          t.cashboxScope === 'accountant' ||
          t.performedByRole === 'cashier' ||
          t.performedByRole === 'accountant'
      );
    }
    return allBranchTx;
  }, [isBranchManager, getRoleBoxTransactions, userRole, currentBranch?.id, currentUser?.id, transactions, ledgerRoleFilter]);

  const isCreditTx = (txType: string) => [
    'shipping_income_prepaid',
    'shipping_collected_dest',
    'cod_collected_dest',
    'transfer_fee_income',
    'shift_settlement_received_inflow',
    'voucher_receipt',
    'deposit',
  ].includes(txType);

  // Date filtering helper
  const isWithinDateFilter = (timestampStr: string) => {
    if (ledgerDateFilter === 'all') return true;
    const txTime = new Date(timestampStr).getTime();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (ledgerDateFilter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return txTime >= todayStart.getTime();
    }
    if (ledgerDateFilter === '3days') {
      return now - txTime <= 3 * dayMs;
    }
    if (ledgerDateFilter === 'week') {
      return now - txTime <= 7 * dayMs;
    }
    if (ledgerDateFilter === 'month') {
      return now - txTime <= 30 * dayMs;
    }
    return true;
  };

  // Category filtering helper
  const isMatchingCategory = (tx: any) => {
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

  // Filtered transactions sorted newest first
  const relevantTransactions = React.useMemo(() => {
    return rawRoleTransactions
      .filter((t) => {
        if (t.currency !== ledgerCurrency) return false;
        const isCredit = isCreditTx(t.type);
        if (ledgerTypeFilter === 'credit' && !isCredit) return false;
        if (ledgerTypeFilter === 'debit' && isCredit) return false;
        if (ledgerUserFilter !== 'all') {
          if (t.performedByUserId && t.performedByUserId !== ledgerUserFilter) return false;
          if (!t.performedByUserId && t.performedByUserName) {
            const matchUser = branchUsers.find((u) => u.id === ledgerUserFilter);
            if (matchUser && t.performedByUserName !== matchUser.name) return false;
          }
        }
        if (!isMatchingCategory(t)) return false;
        if (!isWithinDateFilter(t.timestamp)) return false;
        if (ledgerSearch.trim()) {
          const q = ledgerSearch.trim().toLowerCase();
          const match =
            t.description?.toLowerCase().includes(q) ||
            t.referenceId?.toLowerCase().includes(q) ||
            t.id?.toLowerCase().includes(q) ||
            t.performedByUserName?.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
    rawRoleTransactions,
    ledgerCurrency,
    ledgerTypeFilter,
    ledgerUserFilter,
    branchUsers,
    ledgerCategoryFilter,
    ledgerDateFilter,
    ledgerSearch,
  ]);

  const ledgerTotalCredits = React.useMemo(() => {
    return relevantTransactions
      .filter((t) => isCreditTx(t.type))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [relevantTransactions]);

  const ledgerTotalDebits = React.useMemo(() => {
    return relevantTransactions
      .filter((t) => !isCreditTx(t.type))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [relevantTransactions]);

  // Calculate Operational Metrics for the Widescreen Modal
  const relevantParcelsCount = (parcels || []).filter((p) => {
    if (isOutgoingRole) {
      return p.originHubId === currentBranch?.id;
    }
    if (isIncomingRole) {
      return p.destinationHubId === currentBranch?.id && (p.handlingStatus === 'delivered' || p.handlingStatus === 'received_at_dest');
    }
    return p.originHubId === currentBranch?.id || p.destinationHubId === currentBranch?.id;
  }).length;

  const relevantVouchersCount = (vouchers || []).filter(
    (v) => v.branchId === currentBranch?.id && v.cashboxScope === defaultBoxScope
  ).length;

  // Open Prepare Settlement Modal - strictly locked to current user role's cashbox
  const handleOpenPrepareModal = () => {
    const targetScope: 'outgoing' | 'incoming' = isIncomingRole ? 'incoming' : 'outgoing';
    setSettlementScope(targetScope);
    setSettlementMode('full');
    setCustomSyp(currentBoxSyp);
    setCustomUsd(currentBoxUsd);
    setHandoverNotes('');
    setNotesError(null);
    setIsPrepareModalOpen(true);
  };

  // Submit Settlement - strict validation against current box balance
  const handleSubmitSettlement = (e: React.FormEvent) => {
    e.preventDefault();

    if (!handoverNotes.trim()) {
      setNotesError('بند الملاحظات إلزامي دائماً لتوثيق وتأكيد تسليم الوردية ومطابقة النقدية مع المدير');
      return;
    }

    const sypToSubmit = settlementMode === 'full' ? currentBoxSyp : Math.min(currentBoxSyp, customSyp);
    const usdToSubmit = settlementMode === 'full' ? currentBoxUsd : Math.min(currentBoxUsd, customUsd);

    if (sypToSubmit <= 0 && usdToSubmit <= 0) {
      alert('يرجى تحديد مبلغ ترصيد وتسليم أكبر من الصفر (بالليرة السورية أو بالدولار)');
      return;
    }

    if (sypToSubmit > currentBoxSyp || usdToSubmit > currentBoxUsd) {
      alert(`تنبيه: لا يمكن تسليم مبلغ أكبر من رصيد الصندوق المتوفر (${formatCurrency(currentBoxSyp, 'SYP')} / ${formatCurrency(currentBoxUsd, 'USD')})`);
      setCustomSyp(Math.min(currentBoxSyp, customSyp));
      setCustomUsd(Math.min(currentBoxUsd, customUsd));
      return;
    }

    const targetScope: 'outgoing' | 'incoming' = isIncomingRole ? 'incoming' : 'outgoing';
    const created = submitShiftSettlement(
      targetScope,
      sypToSubmit,
      usdToSubmit,
      handoverNotes.trim()
    );

    setIsPrepareModalOpen(false);
    setSelectedVoucherForPrint(created);
  };

  // Submit Receipt Voucher (سند قبض للصندوق)
  const handleCreateReceiptVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBranchManager) {
      setReceiptError('عذراً: إنشاء وتحرير سند القبض محصور حصراً بدور مدير الفرع.');
      return;
    }
    if (receiptAmount <= 0) {
      setReceiptError('يرجى إدخال مبلغ صحيح لسند القبض');
      return;
    }
    if (!receiptPaidBy.trim()) {
      setReceiptError('يرجى تحديد اسم المستلم منه');
      return;
    }
    if (!receiptDescription.trim()) {
      setReceiptError('يرجى كتابة البيان وتفاصيل سند القبض');
      return;
    }

    const created = addFinancialVoucher({
      type: 'receipt',
      branchId: currentBranch?.id || '',
      currency: receiptCurrency,
      amount: receiptAmount,
      paidByOrTo: receiptPaidBy.trim(),
      reasonCategory: 'سند قبض نقدية',
      description: receiptDescription.trim(),
      referenceNumber: receiptRefNo.trim() || undefined,
      performedByUserId: currentUser?.id || '',
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
      cashboxScope: defaultBoxScope,
    });

    setIsReceiptModalOpen(false);
    setReceiptAmount(0);
    setReceiptPaidBy('');
    setReceiptDescription('');
    setReceiptRefNo('');
    setReceiptError(null);

    // Open print preview for newly issued voucher
    if (created) {
      setSelectedFinancialVoucherForPrint(created);
    }
  };

  // Submit Expense Voucher (سند صرف مصروف من الصندوق)
  const handleCreateExpenseVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBranchManager) {
      setExpenseError('عذراً: إنشاء وتحرير سند الصرف محصور حصراً بدور مدير الفرع.');
      return;
    }
    if (expenseAmount <= 0) {
      setExpenseError('يرجى إدخال مبلغ صحيح لسند المصروف');
      return;
    }
    if (!expensePaidTo.trim()) {
      setExpenseError('يرجى تحديد اسم المدفوع له');
      return;
    }
    if (!expenseDescription.trim()) {
      setExpenseError('يرجى كتابة البيان وتفاصيل المصروف');
      return;
    }

    // Check available balance in the box
    const available = expenseCurrency === 'SYP' ? currentBoxSyp : currentBoxUsd;
    if (expenseAmount > available) {
      if (!confirm(`تنبيه: مبلغ المصروف (${formatCurrency(expenseAmount, expenseCurrency)}) أكبر من الرصيد المتوفر حالياً في الصندوق (${formatCurrency(available, expenseCurrency)}). هل تريد المتابعة؟`)) {
        return;
      }
    }

    const created = addFinancialVoucher({
      type: 'payment',
      branchId: currentBranch?.id || '',
      currency: expenseCurrency,
      amount: expenseAmount,
      paidByOrTo: expensePaidTo.trim(),
      reasonCategory: expenseCategory,
      description: expenseDescription.trim(),
      referenceNumber: expenseRefNo.trim() || undefined,
      performedByUserId: currentUser?.id || '',
      date: new Date().toISOString().split('T')[0],
      status: 'approved',
      cashboxScope: defaultBoxScope,
    });

    setIsExpenseModalOpen(false);
    setExpenseAmount(0);
    setExpensePaidTo('');
    setExpenseDescription('');
    setExpenseRefNo('');
    setExpenseError(null);

    // Open print preview for newly issued voucher
    if (created) {
      setSelectedFinancialVoucherForPrint(created);
    }
  };

  // Approve Settlement (Manager)
  const handleConfirmApproval = (voucher: ShiftSettlementVoucher) => {
    if (!managerApprovalNotes.trim()) {
      if (!confirm('هل تريد تأكيد اعتماد سند الترصيد وتصفير الصندوق بدون كتابة ملاحظات إضافية؟')) {
        return;
      }
    }
    approveShiftSettlement(voucher.id, managerApprovalNotes.trim() || undefined);
    setSelectedVoucherToApprove(null);
    setManagerApprovalNotes('');
    setIsApprovalModalOpen(false);
  };

  // Reject Settlement (Manager)
  const handleConfirmRejection = (voucher: ShiftSettlementVoucher) => {
    if (!rejectionReason.trim()) {
      alert('يرجى كتابة سبب رفض السند لإعادته للموظف');
      return;
    }
    rejectShiftSettlement(voucher.id, rejectionReason.trim());
    setSelectedVoucherToApprove(null);
    setRejectionReason('');
    setIsRejecting(false);
    setIsApprovalModalOpen(false);
  };

  return (
    <div className={`space-y-2 font-sans ${className}`}>
      {/* 1. Main Unified Financial Header Bar */}
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 sm:p-3 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-slate-100">
        {/* Left / Info Section: Cashbox Details & Balances */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <Wallet className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <span className="text-amber-300 font-black">
                  {currentUser?.role === 'super_admin' ? 'الصندوق الموحد (إجمالي الخزينة العامة)' : roleBoxData.boxName}
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  — {currentUser?.role === 'super_admin' ? 'كافة الفروع والمراكز' : roleBoxData.branchName}
                </span>
              </span>
            </div>

            {/* Live Balances Display for Super Admin / Action for Roles */}
            <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
              {currentUser?.role === 'super_admin' ? (
                <>
                  <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-700/60 px-2.5 py-0.5 rounded-lg shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-[11px] text-emerald-300 font-medium">الصندوق الموحد (ل.س):</span>
                    <span className="text-xs sm:text-sm font-mono font-black text-emerald-300">
                      {formatCurrency(breakdown.totalBranchSyp, 'SYP')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-cyan-950/70 border border-cyan-700/60 px-2.5 py-0.5 rounded-lg shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span className="text-[11px] text-cyan-300 font-medium">الصندوق الموحد ($):</span>
                    <span className="text-xs sm:text-sm font-mono font-black text-cyan-300">
                      {formatCurrency(breakdown.totalBranchUsd, 'USD')}
                    </span>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLedgerModalOpen(true)}
                  className="flex items-center gap-2 bg-slate-950/90 hover:bg-slate-800 border border-slate-700/80 px-3 py-1 rounded-lg text-xs font-bold text-amber-300 hover:text-amber-200 transition cursor-pointer shadow-sm active:scale-95"
                  title="الانتقال المباشر لاستعراض حركات الصندوق والكشف المالي التفصيلي"
                >
                  <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>سجل حركات وتدفقات الصندوق (استعراض الرصيد والكشف)</span>
                </button>
              )}

              {myPendingSettlement && (
                <div className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-600/70 px-2.5 py-0.5 rounded-lg shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="text-[11px] text-amber-200 font-bold">
                    سند ترصيد ({formatCurrency(myPendingSettlement.sypAmount, 'SYP')}{myPendingSettlement.usdAmount > 0 ? ` / ${formatCurrency(myPendingSettlement.usdAmount, 'USD')}` : ''}) بانتظار تأكيد واعتماد المدير
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right / Actions Section: Vouchers, Prepare for Settlement, Movement Ledger, Cashbox View */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap sm:flex-nowrap">
          {/* Action A: Add Receipt Voucher for this box (حصر سند القبض بمدير الفرع) */}
          {isBranchManager && (
            <button
              type="button"
              id="btn_add_box_receipt_voucher"
              onClick={() => {
                setReceiptError(null);
                setIsReceiptModalOpen(true);
              }}
              className="px-2.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap border border-emerald-500/50"
              title="إنشاء سند قبض نقدية وإيداعها مباشرة في هذا الصندوق (خاص بمدير الفرع)"
            >
              <PlusCircle className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>سند قبض</span>
            </button>
          )}

          {/* Action B: Add Expense Voucher for this box (حصر سند الصرف بمدير الفرع) */}
          {isBranchManager && (
            <button
              type="button"
              id="btn_add_box_expense_voucher"
              onClick={() => {
                setExpenseError(null);
                setIsExpenseModalOpen(true);
              }}
              className="px-2.5 py-2 bg-rose-800/80 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap border border-rose-500/50"
              title="إنشاء سند صرف مصروف وخصمه مباشرة من هذا الصندوق (خاص بمدير الفرع)"
            >
              <MinusCircle className="w-4 h-4 text-rose-200 shrink-0" />
              <span>سند صرف</span>
            </button>
          )}

          {/* Action C: DEDICATED BUTTON: Prepare Amount for Settlement (تحضير المبلغ للترصيد وتسليم العهدة) */}
          <button
            type="button"
            id="btn_prepare_shift_settlement"
            onClick={handleOpenPrepareModal}
            className="px-3 py-2 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-950/30 flex items-center gap-1.5 transition transform active:scale-95 cursor-pointer whitespace-nowrap border border-amber-400/40"
            title="تحضير وتسليم نقدية الصندوق للمدير مع كتابة الملاحظات وتصفير الرصيد"
          >
            <Layers className="w-4 h-4 text-amber-200 shrink-0" />
            <span>تحضير المبلغ للترصيد</span>
          </button>

          {/* Action D: DEDICATED BUTTON: Financial Transactions Log (سجل الحركات المالية المباشر) */}
          <button
            type="button"
            id="btn_open_officer_ledger"
            onClick={() => setIsLedgerModalOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-600/80 flex items-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="عرض سجل الحركات المالية والمقبوضات اليومية لهذا الصندوق"
          >
            <History className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>سجل الحركات</span>
          </button>

          {/* Action E: Link to Full Cashbox Module - ONLY FOR USERS WITH PERMISSION */}
          {onOpenModule && canAccessCashboxCenter && (
            <button
              type="button"
              id="btn_goto_cashbox_module"
              onClick={() => onOpenModule('cashbox')}
              className="px-2.5 py-2 bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
              title="فتح الخزينة والصناديق المركزية"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">مركز الخزينة</span>
            </button>
          )}

          {/* Action F: Pending Approval Indicator for Managers */}
          {isManagerRole && pendingSettlementsForManager.length > 0 && (
            <button
              type="button"
              id="btn_manager_pending_settlements"
              onClick={() => setIsApprovalModalOpen(true)}
              className="px-3 py-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md animate-pulse flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap border border-rose-400"
            >
              <AlertCircle className="w-4 h-4 text-rose-200" />
              <span>
                اعتماد سندات الترصيد ({pendingSettlementsForManager.length})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PREPARE AMOUNT FOR SETTLEMENT (واجهة تحضير المبلغ للترصيد - كامل الشاشة والعرض) */}
      {/* ========================================================================= */}
      {isPrepareModalOpen && (
        <div
          id="fullscreen-prepare-settlement-modal"
          className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200 select-none"
          dir="rtl"
        >
          {/* Modal Top Bar Header (Compact) */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 border-b border-amber-500/30 shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold shadow-inner shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>تحضير المبلغ للترصيد وتسليم عهدة الوردية لمدير الفرع</span>
                </h3>
                <p className="text-[11px] text-amber-300/85 font-mono">
                  فرع: {currentBranch?.name} • الموظف: {currentUser?.name} ({userRole}) • {activeBoxTitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPrepareModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer border border-transparent hover:border-slate-700"
                title="إغلاق الشاشة والرجوع"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: 3-Column Horizontal Layout spanning full screen */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 custom-scrollbar bg-slate-950">
            
            {/* ------------------------------------------------------------- */}
            {/* COLUMN 1: LIVE AUDIT & BOX METRICS (4 Cols) */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Card A: Real-Time Cash Balance */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span>كشف ومطابقة الصندوق الفعلي</span>
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-md text-xs font-bold border border-emerald-500/30">
                      رصيد مباشر ومطابق
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
                      <span className="text-xs text-emerald-400 font-medium block mb-1">
                        الرصيد بالليرة السورية
                      </span>
                      <span className="text-xl font-mono font-black text-emerald-300 block">
                        {formatCurrency(currentBoxSyp, 'SYP')}
                      </span>
                    </div>

                    <div className="p-3.5 bg-cyan-950/40 border border-cyan-800/60 rounded-xl">
                      <span className="text-xs text-cyan-400 font-medium block mb-1">
                        الرصيد بالدولار ($)
                      </span>
                      <span className="text-xl font-mono font-black text-cyan-300 block">
                        {formatCurrency(currentBoxUsd, 'USD')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card B: Shift Operations Summary */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Package className="w-4 h-4 text-cyan-400" />
                    <span>إحصائيات العمليات والسندات بالوردية</span>
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400">الطرود المرتبطة بالوردية:</span>
                      <strong className="text-white font-mono text-sm">{formatNumber(relevantParcelsCount)} طرد</strong>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400">سندات القبض والصرف بالصندوق:</span>
                      <strong className="text-white font-mono text-sm">{formatNumber(relevantVouchersCount)} سند</strong>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400">حالة الصندوق:</span>
                      <strong className="text-emerald-400 font-bold">
                        {currentBoxSyp > 0 || currentBoxUsd > 0 ? 'جاهز للترصيد والتسليم' : 'تم الترصيد بالكامل (مصفّر)'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-blue-950/40 border border-blue-800/40 rounded-xl text-xs text-blue-200 flex items-start gap-2.5 mt-4">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  يتم إرسال السند فوراً لحساب المدير ليقوم بتأكيد الاستلام وتصفير رصيد هذا الصندوق تلقائياً.
                </span>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* COLUMN 2: SETTLEMENT FORM (5 Cols) */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl">
              <form onSubmit={handleSubmitSettlement} className="space-y-3.5">
                <div className="border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-sm sm:text-base text-amber-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    <span>تجهيز سند الترصيد وتسليم العهدة</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    تسليم مبالغ الصندوق المخصص لدورك لمدير الفرع وإغلاق وردية العمل
                  </p>
                </div>

                {/* Role Cashbox Locked Info - Single Box Only */}
                <div className="p-3 bg-slate-950/90 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold shrink-0">
                      <Wallet className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">صندوق الوردية المخصص (حسب الدور والمستخدم):</span>
                      <strong className="text-xs sm:text-sm text-amber-200 font-bold">{activeBoxTitle}</strong>
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-[10px] text-slate-400 block">رصيد الصندوق</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-400">
                      {formatCurrency(currentBoxSyp, 'SYP')}
                    </span>
                    {currentBoxUsd > 0 && (
                      <span className="text-[11px] font-black text-cyan-400 block">
                        {formatCurrency(currentBoxUsd, 'USD')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Settlement Mode Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200">
                    نوع الترصيد والتسليم:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSettlementMode('full');
                        setCustomSyp(currentBoxSyp);
                        setCustomUsd(currentBoxUsd);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        settlementMode === 'full'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-inner ring-1 ring-amber-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>تصفير وترصيد كامل الرصيد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettlementMode('custom');
                        setCustomSyp(currentBoxSyp);
                        setCustomUsd(currentBoxUsd);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        settlementMode === 'custom'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-inner ring-1 ring-amber-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>تسليم مبلغ مخصص / جزئي</span>
                    </button>
                  </div>
                </div>

                {/* Amounts Inputs with strict Max validation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>المبلغ المسلم (ليرة سورية):</span>
                      <span className="text-[10px] text-emerald-400 font-bold font-mono">
                        أعلى حد: {formatCurrency(currentBoxSyp, 'SYP')}
                      </span>
                    </label>
                    <FormattedAmountInput
                      readOnly={settlementMode === 'full'}
                      value={settlementMode === 'full' ? currentBoxSyp : customSyp}
                      currency="SYP"
                      onChange={(num) => {
                        const val = Math.min(currentBoxSyp, Math.max(0, num));
                        setCustomSyp(val);
                      }}
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm sm:text-base font-mono font-black text-emerald-300 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        settlementMode === 'full'
                          ? 'border-slate-800 cursor-not-allowed opacity-90'
                          : 'border-slate-700'
                      }`}
                    />
                    {settlementMode === 'custom' && (
                      <span className="text-[10px] text-slate-400 block">
                        محدد بسقف رصيد الصندوق ({formatCurrency(currentBoxSyp, 'SYP')})
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>المبلغ المسلم (دولار $):</span>
                      <span className="text-[10px] text-cyan-400 font-bold font-mono">
                        أعلى حد: {formatCurrency(currentBoxUsd, 'USD')}
                      </span>
                    </label>
                    <FormattedAmountInput
                      readOnly={settlementMode === 'full'}
                      value={settlementMode === 'full' ? currentBoxUsd : customUsd}
                      currency="USD"
                      onChange={(num) => {
                        const val = Math.min(currentBoxUsd, Math.max(0, num));
                        setCustomUsd(val);
                      }}
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm sm:text-base font-mono font-black text-cyan-300 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        settlementMode === 'full'
                          ? 'border-slate-800 cursor-not-allowed opacity-90'
                          : 'border-slate-700'
                      }`}
                    />
                    {settlementMode === 'custom' && (
                      <span className="text-[10px] text-slate-400 block">
                        محدد بسقف رصيد الصندوق ({formatCurrency(currentBoxUsd, 'USD')})
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Percentage Pickers for Custom Settlement */}
                {settlementMode === 'custom' && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400">تعبئة سريعة من الرصيد:</span>
                    {[
                      { pct: 1, label: '100% الكامل' },
                      { pct: 0.75, label: '75%' },
                      { pct: 0.5, label: '50%' },
                      { pct: 0.25, label: '25%' },
                    ].map((p) => (
                      <button
                        key={p.pct}
                        type="button"
                        onClick={() => {
                          setCustomSyp(Math.min(currentBoxSyp, Math.round(currentBoxSyp * p.pct)));
                          setCustomUsd(Math.min(currentBoxUsd, Math.round(currentBoxUsd * p.pct)));
                        }}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* MANDATORY NOTES FIELD (بند ملاحظات مرافق دائماً) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>بند الملاحظات المرافق دائماً (إلزامي للتوثيق):</span>
                      <span className="text-rose-400 font-black">*</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      مطبوع بالسند ومحفوظ بالسجل
                    </span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={handoverNotes}
                    onChange={(e) => {
                      setHandoverNotes(e.target.value);
                      if (notesError) setNotesError(null);
                    }}
                    placeholder="اكتب تفاصيل وملاحظات تسليم الوردية للمدير (مثال: إغلاق وردية الصباح، تم تسليم كامل النقدية ومطابقة كشوفات الإرساليات)..."
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 leading-relaxed"
                  />
                  {notesError && (
                    <p className="text-xs text-rose-400 font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{notesError}</span>
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsPrepareModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    id="btn_confirm_submit_settlement"
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-amber-950/40 flex items-center gap-2 transition transform active:scale-95 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>إصدار سند الترصيد وإرساله لمدير الفرع</span>
                  </button>
                </div>
              </form>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* COLUMN 3: SETTLEMENTS HISTORY & STATUS (3 Cols) */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>سجل سندات الترصيد السابقة</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-bold bg-slate-800 px-2 py-0.5 rounded">
                    {boxSettlements.length} سندات
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[580px] overflow-y-auto custom-scrollbar pr-1">
                  {boxSettlements.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-xs">لا توجد سندات ترصيد سابقة لهذا الصندوق</p>
                    </div>
                  ) : (
                    boxSettlements.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-amber-300">
                            {item.voucherNumber}
                          </span>
                          {item.status === 'approved' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                              معتمد ومصفّر
                            </span>
                          ) : item.status === 'rejected' ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                              مرفوض
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold animate-pulse border border-amber-500/30">
                              بانتظار المدير
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span className="font-mono font-bold text-emerald-400">
                            {formatCurrency(item.sypAmount, 'SYP')}
                          </span>
                          {item.usdAmount > 0 && (
                            <span className="font-mono font-bold text-cyan-400">
                              {formatCurrency(item.usdAmount, 'USD')}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 italic bg-slate-900 p-1.5 rounded border border-slate-800/80">
                            ملاحظة: "{item.notes}"
                          </p>
                        )}

                        <div className="pt-1.5 flex items-center justify-between border-t border-slate-800/80">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(item.timestamp).toLocaleDateString('ar-SY')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedVoucherForPrint(item)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-slate-700"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                            <span>طباعة السند</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 text-center">
                جميع السندات يتم توثيقها في الأرشيف المالي المركزي
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECEIPT VOUCHER MODAL (إنشاء سند قبض نقدية للصندوق) */}
      {/* ========================================================================= */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-emerald-950 via-slate-800 to-slate-900 border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    إنشاء سند قبض نقدية رسمي
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-emerald-300 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                      إيداع مباشر في: {activeBoxTitle}
                    </span>
                    <span className="text-[11px] text-slate-300 font-mono">
                      الموظف: {currentUser?.name}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateReceiptVoucher} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">العملة:</label>
                  <select
                    value={receiptCurrency}
                    onChange={(e) => setReceiptCurrency(e.target.value as Currency)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  >
                    <option value="SYP">ليرة سورية (SYP)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">المبلغ المقبوض:</label>
                  <FormattedAmountInput
                    required
                    value={receiptAmount}
                    currency={receiptCurrency}
                    onChange={(num) => setReceiptAmount(num)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">
                    المستلم منه (اسم العميل / المودع): <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={receiptPaidBy}
                    onChange={(e) => setReceiptPaidBy(e.target.value)}
                    placeholder="مثال: شركة الأمل للتجارة / العميل أحمد..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">رقم المرجع / الإشعار (اختياري):</label>
                  <input
                    type="text"
                    value={receiptRefNo}
                    onChange={(e) => setReceiptRefNo(e.target.value)}
                    placeholder="رقم الفاتورة أو البوليصة..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">البيان وتفاصيل العملية:</label>
                <textarea
                  required
                  rows={2}
                  value={receiptDescription}
                  onChange={(e) => setReceiptDescription(e.target.value)}
                  placeholder="اكتب بيان سند القبض وشرح سبب الاستلام..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {receiptError && (
                <p className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{receiptError}</span>
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وإصدار سند القبض</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: UNIFIED EXPENSE MODAL (إنشاء سند مصروف جديد) */}
      {/* ========================================================================= */}
      <UnifiedExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
      />

      {/* ========================================================================= */}
      {/* MODAL 4: FINANCIAL TRANSACTIONS LOG (سجل الحركات المالية المباشر - شاشة كاملة مع فلترة الأدوار) */}
      {/* ========================================================================= */}
      {isLedgerModalOpen && (
        <div
          id="fullscreen-ledger-modal"
          className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200 select-none"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-950/90 via-slate-900 to-slate-950 border-b border-cyan-500/30 shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold shadow-inner shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>سجل الحركات والتدفقات المالية اليومية للصناديق</span>
                  <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    فلترة مخصصة ومطابقة الأرصدة
                  </span>
                </h3>
                <p className="text-[11px] text-cyan-300/80 font-mono">
                  {activeSelectedBoxInfo.fullTitle} • فرع {currentBranch?.name} • المشرف: {currentUser?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="p-1.5 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition cursor-pointer border border-slate-700 flex items-center gap-1.5 px-3 text-xs"
                title="طباعة كشف الحركات المالي"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">طباعة الكشف</span>
              </button>
              <button
                type="button"
                onClick={() => setIsLedgerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer border border-transparent hover:border-slate-700 flex items-center gap-1.5 px-3"
                title="إغلاق السجل والرجوع"
              >
                <X className="w-5 h-5" />
                <span className="text-xs hidden sm:inline">إغلاق</span>
              </button>
            </div>
          </div>

          {/* ROLE SELECTOR STRIP (خاص بمدير الفرع والإدارة العامة للاطلاع على حركات وأرصدة كل دور على حدة) */}
          {isBranchManager && (
            <div className="px-4 sm:px-6 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
              <span className="text-xs font-bold text-slate-400 shrink-0 ml-1 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>فرز الصندوق والدور:</span>
              </span>

              {/* 1. الصادر */}
              <button
                type="button"
                onClick={() => setLedgerRoleFilter('outgoing')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shrink-0 ${
                  ledgerRoleFilter === 'outgoing'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-950/50'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-cyan-300" />
                <span>صندوق الصادر (الاستقبال)</span>
                <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                  ledgerRoleFilter === 'outgoing' ? 'bg-blue-950/80 text-cyan-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {formatCurrency(ledgerCurrency === 'SYP' ? breakdown.outgoingBox.syp : breakdown.outgoingBox.usd, ledgerCurrency)}
                </span>
              </button>

              {/* 2. الوارد */}
              <button
                type="button"
                onClick={() => setLedgerRoleFilter('incoming')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shrink-0 ${
                  ledgerRoleFilter === 'incoming'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-md shadow-emerald-950/50'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>صندوق الوارد (التسليم)</span>
                <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                  ledgerRoleFilter === 'incoming' ? 'bg-emerald-950/80 text-emerald-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {formatCurrency(ledgerCurrency === 'SYP' ? breakdown.incomingBox.syp : breakdown.incomingBox.usd, ledgerCurrency)}
                </span>
              </button>

              {/* 3. دور مدير الفرع */}
              <button
                type="button"
                onClick={() => setLedgerRoleFilter('manager')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shrink-0 ${
                  ledgerRoleFilter === 'manager'
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white border-amber-400 shadow-md shadow-amber-950/50'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Wallet className="w-3.5 h-3.5 text-amber-300" />
                <span>دوري كمدير فرع (الخزينة والعهد)</span>
                <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                  ledgerRoleFilter === 'manager' ? 'bg-amber-950/80 text-amber-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {formatCurrency(ledgerCurrency === 'SYP' ? breakdown.managerBox.syp : breakdown.managerBox.usd, ledgerCurrency)}
                </span>
              </button>

              {/* 4. كباتن التوزيع */}
              <button
                type="button"
                onClick={() => setLedgerRoleFilter('courier')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shrink-0 ${
                  ledgerRoleFilter === 'courier'
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white border-purple-400 shadow-md shadow-purple-950/50'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-purple-300" />
                <span>كباتن التوزيع (المناديب)</span>
                <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                  ledgerRoleFilter === 'courier' ? 'bg-purple-950/80 text-purple-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {formatCurrency(ledgerCurrency === 'SYP' ? (breakdown.courierBox?.syp || 0) : (breakdown.courierBox?.usd || 0), ledgerCurrency)}
                </span>
              </button>

              {/* 5. أمين الصندوق والمحاسبة */}
              <button
                type="button"
                onClick={() => setLedgerRoleFilter('cashier')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shrink-0 ${
                  ledgerRoleFilter === 'cashier'
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white border-teal-400 shadow-md shadow-teal-950/50'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-teal-300" />
                <span>أمين الصندوق والمحاسبة</span>
                <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                  ledgerRoleFilter === 'cashier' ? 'bg-teal-950/80 text-teal-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {formatCurrency(ledgerCurrency === 'SYP' ? (breakdown.cashierBox?.syp || 0) : (breakdown.cashierBox?.usd || 0), ledgerCurrency)}
                </span>
              </button>

              {/* 6. كافة حركات الفرع الشاملة */}
              <button
                type="button"
                onClick={() => setLedgerRoleFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shrink-0 mr-auto ${
                  ledgerRoleFilter === 'all'
                    ? 'bg-slate-700 text-white border-slate-500 shadow-md'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-300" />
                <span>كافة أدوار الفرع (كشف شامل)</span>
                <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                  ledgerRoleFilter === 'all' ? 'bg-slate-900 text-cyan-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {formatCurrency(ledgerCurrency === 'SYP' ? breakdown.totalBranchSyp : breakdown.totalBranchUsd, ledgerCurrency)}
                </span>
              </button>
            </div>
          )}

          {/* KPI Summary Banner (محدث لحظياً ومطابق بدقة للدور والفلترة المحددة) */}
          <div className="px-4 sm:px-6 py-3 bg-slate-900/90 border-b border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-amber-300 block mb-0.5">
                  {isBranchManager
                    ? (ledgerRoleFilter === 'outgoing' ? 'رصيد صندوق الصادر' :
                       ledgerRoleFilter === 'incoming' ? 'رصيد صندوق الوارد' :
                       ledgerRoleFilter === 'manager' ? 'رصيد خزينة المدير' :
                       ledgerRoleFilter === 'courier' ? 'رصيد عهدة المناديب' :
                       ledgerRoleFilter === 'cashier' ? 'رصيد صندوق المحاسبة' : 'إجمالي رصيد الفرع')
                    : 'رصيد الصندوق المتاح'}
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-amber-300">
                  {formatCurrency(ledgerCurrency === 'SYP' ? activeSelectedBoxInfo.sypBalance : activeSelectedBoxInfo.usdBalance, ledgerCurrency)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-950/70 border border-emerald-900/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 block mb-0.5">إجمالي المقبوضات (+)</span>
                <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
                  + {formatCurrency(ledgerTotalCredits, ledgerCurrency)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-950/70 border border-rose-900/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-rose-400 block mb-0.5">إجمالي المصروفات والترصيد (-)</span>
                <span className="text-sm sm:text-base font-black font-mono text-rose-400">
                  - {formatCurrency(ledgerTotalDebits, ledgerCurrency)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-950/70 border border-cyan-900/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 block mb-0.5">صافي التدفقات المعروضة</span>
                <span className={`text-sm sm:text-base font-black font-mono ${ledgerTotalCredits - ledgerTotalDebits >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                  {formatCurrency(ledgerTotalCredits - ledgerTotalDebits, ledgerCurrency)}
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="px-4 sm:px-6 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap shrink-0">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* Currency Selector */}
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setLedgerCurrency('SYP')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                    ledgerCurrency === 'SYP'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ليرة سورية (SYP)
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerCurrency('USD')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                    ledgerCurrency === 'USD'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  دولار ($ USD)
                </button>
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    ledgerTypeFilter === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  كافة الحركات
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('credit')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    ledgerTypeFilter === 'credit'
                      ? 'bg-emerald-700 text-white'
                      : 'text-emerald-400/80 hover:text-emerald-300'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>المقبوضات (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('debit')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    ledgerTypeFilter === 'debit'
                      ? 'bg-rose-700 text-white'
                      : 'text-rose-400/80 hover:text-rose-300'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>المصروفات (-)</span>
                </button>
              </div>

              {/* Employee / Officer Specific Filter for Branch Manager */}
              {isBranchManager && branchUsers.length > 0 && (
                <div className="flex items-center bg-slate-900 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                  <span className="text-slate-400 text-[11px] ml-1.5 shrink-0">الموظف:</span>
                  <select
                    value={ledgerUserFilter}
                    onChange={(e) => setLedgerUserFilter(e.target.value)}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-bold"
                  >
                    <option value="all" className="bg-slate-900 text-slate-200">كافة الموظفين</option>
                    {branchUsers.map((u) => (
                      <option key={u.id} value={u.id} className="bg-slate-900 text-slate-200">
                        {u.name} ({u.role === 'outbound_operator' || u.role === 'reception_data_entry' ? 'صادر' : u.role === 'inbound_operator' ? 'وارد' : u.role === 'hub_manager' ? 'مدير فرع' : u.role === 'cashier' ? 'صندوق' : u.role === 'courier' ? 'مندوب' : 'موظف'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Filter */}
              <div className="flex items-center bg-slate-900 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                <span className="text-slate-400 text-[11px] ml-1.5 shrink-0">التصنيف:</span>
                <select
                  value={ledgerCategoryFilter}
                  onChange={(e) => setLedgerCategoryFilter(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-bold"
                >
                  <option value="all" className="bg-slate-900 text-slate-200">كافة التصنيفات</option>
                  <option value="shipping_prepaid" className="bg-slate-900 text-slate-200">إيرادات شحن مقبوضة سلفاً</option>
                  <option value="shipping_dest" className="bg-slate-900 text-slate-200">أجور شحن مقبوضة في الوجهة</option>
                  <option value="cod_collected" className="bg-slate-900 text-slate-200">تحصيل مبالغ COD من المستلم</option>
                  <option value="cod_payout" className="bg-slate-900 text-slate-200">تسليم مبالغ COD للمرسل</option>
                  <option value="shift_settlement" className="bg-slate-900 text-slate-200">تسويات وترصيد ورديات</option>
                  <option value="vouchers" className="bg-slate-900 text-slate-200">سندات القبض والصرف</option>
                  <option value="expenses" className="bg-slate-900 text-slate-200">مصاريف تشغيلية ونثريات</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center bg-slate-900 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                <span className="text-slate-400 text-[11px] ml-1.5 shrink-0">التاريخ:</span>
                <select
                  value={ledgerDateFilter}
                  onChange={(e) => setLedgerDateFilter(e.target.value as any)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-bold"
                >
                  <option value="all" className="bg-slate-900 text-slate-200">كافة الفترات</option>
                  <option value="today" className="bg-slate-900 text-slate-200">اليوم فقط</option>
                  <option value="3days" className="bg-slate-900 text-slate-200">آخر 3 أيام</option>
                  <option value="week" className="bg-slate-900 text-slate-200">هذا الأسبوع</option>
                  <option value="month" className="bg-slate-900 text-slate-200">هذا الشهر</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="بحث برقم الطرد، السند، البيان، اسم الموظف..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              {ledgerSearch && (
                <button
                  type="button"
                  onClick={() => setLedgerSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Full-width Transactions Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 p-4 sm:p-6">
            {relevantTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
                <Coins className="w-16 h-16 mb-4 opacity-25 text-cyan-400 animate-pulse" />
                <h4 className="text-base font-bold text-slate-400 mb-1">لا توجد حركات مالية مسجلة</h4>
                <p className="text-xs text-slate-500 max-w-sm text-center">
                  لم يتم العثور على أي قيود مالية مطابقة لمعايير البحث والفلترة المحددة لـ {activeSelectedBoxInfo.title} بعملة {ledgerCurrency === 'SYP' ? 'الليرة السورية' : 'الدولار الأمريكي'}.
                </p>
              </div>
            ) : (
              <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-xl bg-slate-900/60">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/95 text-slate-300 border-b border-slate-700 sticky top-0 z-10 backdrop-blur-md">
                      <th className="p-3 font-bold w-12 text-center">#</th>
                      <th className="p-3 font-bold">التاريخ والتوقيت</th>
                      <th className="p-3 font-bold">الصندوق / الدور</th>
                      <th className="p-3 font-bold">نوع وطبيعة الحركة</th>
                      <th className="p-3 font-bold">البيان والشرح المالي</th>
                      <th className="p-3 font-bold">المرجع / السند</th>
                      <th className="p-3 font-bold">المستخدم المنفذ</th>
                      <th className="p-3 font-bold text-left">المبلغ والعملة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {relevantTransactions.map((tx, idx) => {
                      const isCredit = isCreditTx(tx.type);

                      // Resolve desk label
                      const deskLabel =
                        tx.cashboxScope === 'outgoing' || tx.type === 'shipping_income_prepaid' || tx.performedByRole === 'outbound_operator'
                          ? 'صادر'
                          : tx.cashboxScope === 'incoming' || tx.type === 'shipping_collected_dest' || tx.type === 'cod_collected_dest' || tx.performedByRole === 'inbound_operator'
                          ? 'وارد'
                          : tx.cashboxScope === 'manager' || tx.performedByRole === 'hub_manager'
                          ? 'إدارة'
                          : tx.cashboxScope === 'courier' || tx.performedByRole === 'courier'
                          ? 'مندوب'
                          : tx.cashboxScope === 'cashier' || tx.performedByRole === 'cashier'
                          ? 'صندوق'
                          : 'عام';

                      const deskBadgeClass =
                        deskLabel === 'صادر'
                          ? 'bg-blue-950 text-blue-300 border-blue-800'
                          : deskLabel === 'وارد'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : deskLabel === 'إدارة'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : deskLabel === 'مندوب'
                          ? 'bg-purple-950 text-purple-300 border-purple-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700';

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/60 transition group">
                          <td className="p-3 text-center font-mono text-[11px] text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-300 whitespace-nowrap" dir="ltr">
                            {new Date(tx.timestamp).toLocaleString('en-GB', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${deskBadgeClass}`}>
                              {deskLabel}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {isCredit ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold inline-flex items-center gap-1.5 shadow-sm">
                                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                                <span>قبض وإيراد نقدي</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold inline-flex items-center gap-1.5 shadow-sm">
                                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                                <span>صرف / ترصيد عهدة</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-200 font-medium max-w-md">
                            <div className="line-clamp-2">{tx.description}</div>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-cyan-400">
                            {tx.referenceId ? (
                              <span className="bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800/60">
                                {tx.referenceId}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">
                            {tx.performedByUserName || 'النظام'}
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-sm whitespace-nowrap">
                            <span
                              className={
                                isCredit ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              {isCredit ? '+' : '-'} {formatCurrency(tx.amount, tx.currency)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className="px-4 sm:px-6 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span>عدد الحركات المعروضة: </span>
              <strong className="text-white font-mono">{relevantTransactions.length}</strong> حركة
              <span className="text-slate-600">•</span>
              <span>الفرع النشط: <strong className="text-cyan-300">{currentBranch?.name || 'المركز'}</strong></span>
              {isBranchManager && (
                <>
                  <span className="text-slate-600">•</span>
                  <span>الصندوق المحدد: <strong className="text-amber-300">{activeSelectedBoxInfo.title}</strong></span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الكشف</span>
              </button>
              <button
                type="button"
                onClick={() => setIsLedgerModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق السجل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: MANAGER SHIFT SETTLEMENT APPROVAL QUEUE & CONFIRMATION */}
      {/* ========================================================================= */}
      {isApprovalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    اعتماد وتأكيد سندات ترصيد الورديات واستلام المبالغ
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    حساب المدير / المحاسب — فرع {currentBranch?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsApprovalModalOpen(false);
                  setSelectedVoucherToApprove(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {selectedVoucherToApprove ? (
                /* Reviewing a single voucher */
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-white">
                        سند ترصيد رقم: {selectedVoucherToApprove.voucherNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(selectedVoucherToApprove.timestamp).toLocaleString('ar-SY')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">الموظف المسلِّم: </span>
                        <strong className="text-white">
                          {selectedVoucherToApprove.officerName}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">نوع الصندوق: </span>
                        <strong className="text-amber-300">
                          {selectedVoucherToApprove.cashboxScope === 'outgoing'
                            ? 'صندوق الصادر'
                            : 'صندوق الوارد'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">المبلغ بالليرة السورية: </span>
                        <strong className="text-emerald-300 font-mono">
                          {formatCurrency(selectedVoucherToApprove.sypAmount, 'SYP')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">المبلغ بالدولار: </span>
                        <strong className="text-cyan-300 font-mono">
                          {formatCurrency(selectedVoucherToApprove.usdAmount, 'USD')}
                        </strong>
                      </div>
                    </div>

                    {/* Officer Notes */}
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                      <span className="text-slate-400 block mb-1 font-bold">
                        ملاحظات الموظف عند التسليم:
                      </span>
                      <p className="text-slate-200">
                        {selectedVoucherToApprove.notes || 'لا توجد ملاحظات مرفقة'}
                      </p>
                    </div>
                  </div>

                  {/* Manager Confirmation Notes Input */}
                  {!isRejecting ? (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-emerald-400">
                        بند ملاحظات وتأكيد المدير / المحاسب (مرافق للاعتماد):
                      </label>
                      <textarea
                        rows={2}
                        value={managerApprovalNotes}
                        onChange={(e) => setManagerApprovalNotes(e.target.value)}
                        placeholder="أدخل ملاحظات اعتماد واستلام النقدية (مثال: تم استلام المبلغ نقداً ومطابقة الجرد وتصفير الصندوق)..."
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-rose-400">
                        سبب رفض السند وإعادته للموظف (إلزامي):
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="اكتب سبب رفض السند لإعادة المبلغ لصندوق الموظف..."
                        className="w-full bg-slate-950 border border-rose-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVoucherToApprove(null);
                        setIsRejecting(false);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      رجوع للقائمة
                    </button>

                    <div className="flex items-center gap-2">
                      {!isRejecting ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsRejecting(true)}
                            className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            رفض السند
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmApproval(selectedVoucherToApprove)}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تأكيد اعتماد السند وتصفير الصندوق واستلام المبلغ</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsRejecting(false)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            إلغاء الرفض
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmRejection(selectedVoucherToApprove)}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            تأكيد رفض السند وإرجاع المبلغ
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* List of Pending Vouchers */
                <div className="space-y-3">
                  {pendingSettlementsForManager.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500/40" />
                      <p className="text-xs font-bold">لا توجد سندات ترصيد بانتظار الاعتماد حالياً</p>
                    </div>
                  ) : (
                    pendingSettlementsForManager.map((voucher) => (
                      <div
                        key={voucher.id}
                        className="p-3.5 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-3 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-amber-300">
                              {voucher.voucherNumber}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {voucher.officerName}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                              {voucher.cashboxScope === 'outgoing' ? 'صندوق الصادر' : 'صندوق الوارد'}
                            </span>
                          </div>

                          <div className="text-xs text-slate-300 flex items-center gap-3">
                            <span className="font-mono text-emerald-400 font-bold">
                              {formatCurrency(voucher.sypAmount, 'SYP')}
                            </span>
                            {voucher.usdAmount > 0 && (
                              <span className="font-mono text-cyan-400 font-bold">
                                {formatCurrency(voucher.usdAmount, 'USD')}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {new Date(voucher.timestamp).toLocaleTimeString('ar-SY')}
                            </span>
                          </div>

                          {voucher.notes && (
                            <p className="text-[11px] text-slate-400 italic truncate max-w-md">
                              ملاحظة الموظف: "{voucher.notes}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedVoucherForPrint(voucher)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
                            title="طباعة / معاينة"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVoucherToApprove(voucher);
                              setIsRejecting(false);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>مراجعة واعتماد</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT MODAL 1: SHIFT SETTLEMENT PRINT MODAL */}
      {/* ========================================================================= */}
      <ShiftSettlementPrintModal
        voucher={selectedVoucherForPrint}
        branch={currentBranch}
        brandingSettings={brandingSettings}
        onClose={() => setSelectedVoucherForPrint(null)}
      />

      {/* ========================================================================= */}
      {/* PRINT MODAL 2: FINANCIAL VOUCHER PRINT MODAL */}
      {/* ========================================================================= */}
      <VoucherPrintModal
        voucher={selectedFinancialVoucherForPrint}
        onClose={() => setSelectedFinancialVoucherForPrint(null)}
      />

      {/* ========================================================================= */}
      {/* MODAL 5: SUPER ADMIN BREAKDOWN MODAL (تفصيل رصيد الصندوق الموحد) */}
      {/* ========================================================================= */}
      {isSuperAdminBreakdownModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-amber-500/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    <span>تفصيل رصيد الصندوق الموحد - مدير التطبيق العام</span>
                  </h3>
                  <p className="text-xs text-amber-300/80">
                    تقسيم دقيق ومرتبط بجميع صناديق الأقسام والشبابيك مع الخزينة العامة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSuperAdminBreakdownModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Box Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. Incoming Box */}
                <div className="bg-slate-950 border border-emerald-900/50 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      صندوق قسم الوارد
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px]">تسليم الطرود</span>
                  </div>

                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">الرصيد المتاح (ل.س):</span>
                      <strong className="text-emerald-300 font-bold">{formatCurrency(breakdown.incomingBox.syp, 'SYP')}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">الرصيد المتاح ($):</span>
                      <strong className="text-cyan-300 font-bold">{formatCurrency(breakdown.incomingBox.usd, 'USD')}</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>إجمالي التحصيلات:</span>
                        <span className="text-slate-300">{formatCurrency(breakdown.incomingBox.inflowSyp, 'SYP')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المحول للمدير:</span>
                        <span className="text-rose-300">{formatCurrency(breakdown.incomingBox.transfersOutSyp, 'SYP')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Outgoing Box */}
                <div className="bg-slate-950 border border-blue-900/50 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-blue-400 flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4" />
                      صندوق قسم الصادر
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px]">إصدار البوالص</span>
                  </div>

                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">الرصيد المتاح (ل.س):</span>
                      <strong className="text-emerald-300 font-bold">{formatCurrency(breakdown.outgoingBox.syp, 'SYP')}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">الرصيد المتاح ($):</span>
                      <strong className="text-cyan-300 font-bold">{formatCurrency(breakdown.outgoingBox.usd, 'USD')}</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>إجمالي الإيرادات:</span>
                        <span className="text-slate-300">{formatCurrency(breakdown.outgoingBox.inflowSyp, 'SYP')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المحول للمدير:</span>
                        <span className="text-rose-300">{formatCurrency(breakdown.outgoingBox.transfersOutSyp, 'SYP')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Manager Vault Box */}
                <div className="bg-slate-950 border border-amber-900/50 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4" />
                      صندوق مدير الفرع / الخزينة
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px]">الخزينة المركزية</span>
                  </div>

                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">الرصيد المتاح (ل.س):</span>
                      <strong className="text-emerald-300 font-bold">{formatCurrency(breakdown.managerBox.syp, 'SYP')}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">الرصيد المتاح ($):</span>
                      <strong className="text-cyan-300 font-bold">{formatCurrency(breakdown.managerBox.usd, 'USD')}</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>المستلم من الشبابيك:</span>
                        <span className="text-emerald-300">{formatCurrency(breakdown.managerBox.inflowSyp, 'SYP')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المصروفات والتوريد:</span>
                        <span className="text-rose-300">{formatCurrency(breakdown.managerBox.outflowSyp, 'SYP')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Reconciliation Banner */}
              <div className="bg-gradient-to-r from-amber-950/40 via-slate-950 to-amber-950/40 border border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-white text-xs block">الصندوق الموحد التراكمي (إجمالي أرصدة النظام)</strong>
                    <span className="text-[11px] text-slate-400">
                      مجموع أرصدة الصناديق = صندوق الوارد + صندوق الصادر + صندوق مدير الفرع والخزينة
                    </span>
                  </div>
                </div>

                <div className="text-left font-mono shrink-0 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
                  <div className="text-sm font-black text-emerald-400">
                    {formatCurrency(breakdown.totalBranchSyp, 'SYP')}
                  </div>
                  <div className="text-xs font-bold text-cyan-400">
                    {formatCurrency(breakdown.totalBranchUsd, 'USD')}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsSuperAdminBreakdownModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
