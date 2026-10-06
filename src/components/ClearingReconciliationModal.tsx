import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Printer,
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  TrendingDown,
  Percent,
  Search,
  Check,
  Coins,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  Users,
  ShieldCheck,
  Eye,
  Copy,
  Download,
  CheckSquare,
  Square,
  Package,
  FileDown,
  ExternalLink,
  ChevronRight,
  Info,
  Landmark,
  Banknote,
  CreditCard,
  CheckCircle,
  Lock,
} from 'lucide-react';
import {
  Branch,
  FinancialVoucher,
  ClearingReconciliationDetails,
  ClearingOperationItem,
  ClearingSettlementMethod,
  ClearingSettlementOptions,
  Currency,
  Parcel,
} from '../types';
import { useOrca } from '../context/OrcaContext';
import { VoucherPrintModal } from './VoucherPrintModal';
import { ClearingSummaryPrintModal } from './ClearingSummaryPrintModal';

interface ClearingReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoucherCreated?: (voucher: FinancialVoucher) => void;
}

export const ClearingReconciliationModal: React.FC<ClearingReconciliationModalProps> = ({
  isOpen,
  onClose,
  onVoucherCreated,
}) => {
  const {
    currentBranch,
    branches,
    parcels,
    transactions,
    vouchers,
    expenses,
    createBranchClearingVoucher,
    currentUser,
    setSelectedParcelForQuickView,
    openPrintModal,
    formatCurrency,
    formatNumber,
  } = useOrca();

  // 1. Registered Agent Offices list
  const agentBranches = useMemo(() => {
    return branches.filter((b) => b.type === 'agent');
  }, [branches]);

  // Target Agent Selection: Defaults to currentBranch if agent, or first registered agent, or currentBranch
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    if (currentBranch.type === 'agent') return currentBranch.id;
    const firstAgent = branches.find((b) => b.type === 'agent');
    return firstAgent?.id || currentBranch.id;
  });

  // Keep synced if current branch changes and is an agent
  useEffect(() => {
    if (currentBranch.type === 'agent') {
      setSelectedAgentId(currentBranch.id);
    }
  }, [currentBranch]);

  // The active Agent Branch entity
  const selectedAgentBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedAgentId) || currentBranch;
  }, [branches, selectedAgentId, currentBranch]);

  // Target Head Office destination
  const [destHubId, setDestHubId] = useState<string>(() => {
    const mainHub = branches.find((b) => b.isCentralHub || b.isMainHub || b.id === 'hub_damascus');
    return selectedAgentBranch.parentHubId || currentBranch.parentHubId || mainHub?.id || 'hub_damascus';
  });

  // Commission rates fetched ready & non-editable from Agent card
  const shippingRate: number = useMemo(() => {
    return selectedAgentBranch.commissionRateShipping ?? selectedAgentBranch.shippingCommissionPercent ?? 15;
  }, [selectedAgentBranch]);

  const transferRate: number = useMemo(() => {
    return selectedAgentBranch.commissionRateTransfers ?? selectedAgentBranch.codCommissionPercent ?? 20;
  }, [selectedAgentBranch]);

  // View Mode: 'summary' (تقرير مختصر) or 'detailed' (تقرير تفصيلي بجدول العمليات)
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [tableFilterType, setTableFilterType] = useState<string>('all');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [clearingNotes, setClearingNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Excluded Operation IDs (لتمكين المستخدم من تحديد واستثناء أوامر معينة من السند)
  const [excludedOpIds, setExcludedOpIds] = useState<Set<string>>(new Set());

  // Copied tracking feedback state
  const [copiedOpId, setCopiedOpId] = useState<string | null>(null);

  // Inspected Parcel state for quick popup
  const [inspectedOp, setInspectedOp] = useState<ClearingOperationItem | null>(null);

  // 2. Detect Previous Clearing / Settlements for this Agent
  const previousClearings = useMemo(() => {
    return vouchers
      .filter(
        (v) =>
          v.type === 'clearing' &&
          v.branchId === selectedAgentBranch.id &&
          v.status === 'approved'
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [vouchers, selectedAgentBranch.id]);

  const lastClearing = previousClearings[0] || null;

  // Custom period states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Initialize start date from last clearing or early default
  useEffect(() => {
    if (lastClearing?.clearingDetails?.periodTo) {
      setStartDate(lastClearing.clearingDetails.periodTo);
    } else if (lastClearing?.date) {
      setStartDate(lastClearing.date);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      setStartDate(d.toISOString().split('T')[0]);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    setEndDate(todayStr);
  }, [lastClearing, selectedAgentBranch.id]);

  // Reset exclusions when agent changes
  useEffect(() => {
    setExcludedOpIds(new Set());
  }, [selectedAgentBranch.id, startDate, endDate]);

  // 3. Build and filter operations list exclusively for the selected Agent
  const { operations, firstOperation, lastOperation } = useMemo(() => {
    const items: ClearingOperationItem[] = [];

    const startTimestamp = startDate ? new Date(startDate + 'T00:00:00').getTime() : 0;
    const endTimestamp = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

    // A) Outbound prepaid parcels registered at this Agent branch
    parcels.forEach((p) => {
      const isOrigin = p.originHubId === selectedAgentBranch.id || p.originCollectionBranchId === selectedAgentBranch.id;
      const isPrepaid = p.paymentType === 'prepaid';
      const pTime = new Date(p.createdAt || Date.now()).getTime();

      // Check if after last clearing
      const isAfterPrevious = lastClearing
        ? new Date(p.createdAt || 0).getTime() > new Date(lastClearing.timestamp).getTime() ||
          (p.createdAt?.split('T')[0] || '') >= (lastClearing.clearingDetails?.periodTo || lastClearing.date)
        : true;

      const inDateRange = pTime >= startTimestamp && pTime <= endTimestamp;

      if (isOrigin && isPrepaid && inDateRange && isAfterPrevious) {
        const gross = p.shippingCost || p.priceSyp || 0;
        const cur = p.shippingCurrency || p.currency || 'SYP';
        const branchCut = Math.round((gross * (shippingRate || 0)) / 100);
        const transferred = p.transferredAmount || 0;
        const compShare = Math.max(0, gross - branchCut - transferred);

        items.push({
          id: `op_prep_${p.id}`,
          operationNumber: p.trackingNumber || p.paperReceiptNumber || `OP-${p.id}`,
          date: p.createdAt ? p.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
          time: p.createdAt ? p.createdAt.split('T')[1]?.slice(0, 5) : '12:00',
          timestamp: p.createdAt || new Date().toISOString(),
          type: 'shipping_prepaid',
          typeLabel: 'أجور شحن صادر (مدفوع سلفاً)',
          referenceId: p.trackingNumber,
          description: `شحن طرد إلى [${p.destinationAddress || 'فرع الوجهة'}] - المحتوى: ${p.contentDescription || 'بضائع'}${transferred > 0 ? ` (مبلغ محوّل للموزع: ${formatCurrency(transferred, cur)})` : ''}`,
          partyName: `المرسل: ${p.sender?.name || 'زبون عام'}`,
          grossAmount: gross,
          currency: cur,
          branchCommissionRate: shippingRate,
          branchCommissionAmount: branchCut,
          companyShareAmount: compShare,
          transferredAmount: transferred > 0 ? transferred : undefined,
          transferredAmountReason: transferred > 0 ? p.transferredAmountReason : undefined,
        });
      }
    });

    // B) Inbound collect freight delivered at this Agent branch
    parcels.forEach((p) => {
      const isDest = p.destinationHubId === selectedAgentBranch.id;
      const isCollect = p.paymentType === 'cod_destination' || (p as any).paymentType === 'collect';
      const timeStr = p.deliveredAt || p.arrivedAtDestAt || p.createdAt;
      const pTime = new Date(timeStr || Date.now()).getTime();

      const isAfterPrevious = lastClearing
        ? new Date(timeStr || 0).getTime() > new Date(lastClearing.timestamp).getTime() ||
          (timeStr?.split('T')[0] || '') >= (lastClearing.clearingDetails?.periodTo || lastClearing.date)
        : true;

      const inDateRange = pTime >= startTimestamp && pTime <= endTimestamp;

      if (isDest && isCollect && inDateRange && isAfterPrevious) {
        const gross = p.collectedAmount || p.shippingCost || p.priceSyp || 0;
        const cur = p.shippingCurrency || p.currency || 'SYP';
        const branchCut = Math.round((gross * (shippingRate || 0)) / 100);
        const transferred = p.transferredAmount || 0;
        const compShare = Math.max(0, gross - branchCut - transferred);

        items.push({
          id: `op_col_${p.id}`,
          operationNumber: p.trackingNumber || `COL-${p.id}`,
          date: timeStr ? timeStr.split('T')[0] : new Date().toISOString().split('T')[0],
          time: timeStr ? timeStr.split('T')[1]?.slice(0, 5) : '14:00',
          timestamp: timeStr || new Date().toISOString(),
          type: 'shipping_collect',
          typeLabel: 'أجور شحن وارد (محصل وجهة)',
          referenceId: p.trackingNumber,
          description: `تحصيل أجور شحن عند تسليم الطرد للمستلم [${p.receiver?.name || 'زبون'}]${transferred > 0 ? ` (مبلغ محوّل للموزع: ${formatCurrency(transferred, cur)})` : ''}`,
          partyName: `المستلم: ${p.receiver?.name || 'زبون'}`,
          grossAmount: gross,
          currency: cur,
          branchCommissionRate: shippingRate,
          branchCommissionAmount: branchCut,
          companyShareAmount: compShare,
          transferredAmount: transferred > 0 ? transferred : undefined,
          transferredAmountReason: transferred > 0 ? p.transferredAmountReason : undefined,
        });
      }
    });

    // C) COD Remittances / Goods Collection delivered at this Agent
    parcels.forEach((p) => {
      const isDest = p.destinationHubId === selectedAgentBranch.id;
      const hasCod = Boolean(p.codAmount && p.codAmount > 0);
      const isDelivered = p.handlingStatus === 'delivered' || p.codStatus === 'collected_awaiting_sender_payout' || p.codStatus === 'paid_to_sender';
      const timeStr = p.deliveredAt || p.codCollectedAt || p.createdAt;
      const pTime = new Date(timeStr || Date.now()).getTime();

      const isAfterPrevious = lastClearing
        ? new Date(timeStr || 0).getTime() > new Date(lastClearing.timestamp).getTime() ||
          (timeStr?.split('T')[0] || '') >= (lastClearing.clearingDetails?.periodTo || lastClearing.date)
        : true;

      const inDateRange = pTime >= startTimestamp && pTime <= endTimestamp;

      if (isDest && hasCod && isDelivered && inDateRange && isAfterPrevious) {
        const codVal = p.codAmount || 0;
        const cur = p.codCurrency || p.currency || 'SYP';
        const transferFee = p.transferFee || 0;
        const branchCut = Math.round((transferFee * (transferRate || 0)) / 100);
        const compShareTotal = codVal + (transferFee - branchCut);

        items.push({
          id: `op_cod_${p.id}`,
          operationNumber: p.trackingNumber || `COD-${p.id}`,
          date: timeStr ? timeStr.split('T')[0] : new Date().toISOString().split('T')[0],
          time: timeStr ? timeStr.split('T')[1]?.slice(0, 5) : '15:30',
          timestamp: timeStr || new Date().toISOString(),
          type: 'cod_collection',
          typeLabel: 'تحصيل حوالة COD (مبلغ البضاعة)',
          referenceId: p.trackingNumber,
          description: `تحصيل مبلغ COD بقيمة ${formatCurrency(codVal, cur)} لحساب التاجر [${p.sender?.name || 'مرسل'}]`,
          partyName: `المستلم: ${p.receiver?.name || ''} ◄ المرسل: ${p.sender?.name || ''}`,
          grossAmount: codVal + transferFee,
          currency: cur,
          branchCommissionRate: transferRate,
          branchCommissionAmount: branchCut,
          companyShareAmount: compShareTotal,
        });
      }
    });

    // D) Agent Operating Expense Vouchers, Approved Expenses & Cashbox Transactions
    const recordedExpenseRefs = new Set<string>();

    // 1. Payment Vouchers
    const expenseVouchers = vouchers.filter(
      (v) =>
        v.type === 'payment' &&
        v.branchId === selectedAgentBranch.id &&
        v.status === 'approved'
    );

    expenseVouchers.forEach((v) => {
      const vTime = new Date(v.timestamp || v.date).getTime();
      const isAfterPrevious = lastClearing
        ? new Date(v.timestamp || 0).getTime() > new Date(lastClearing.timestamp).getTime() ||
          v.date >= (lastClearing.clearingDetails?.periodTo || lastClearing.date)
        : true;
      const inDateRange = vTime >= startTimestamp && vTime <= endTimestamp;

      if (inDateRange && isAfterPrevious) {
        recordedExpenseRefs.add(v.id);
        if (v.voucherNumber) recordedExpenseRefs.add(v.voucherNumber);

        items.push({
          id: `op_exp_${v.id}`,
          operationNumber: v.voucherNumber,
          date: v.date,
          time: v.timestamp ? v.timestamp.split('T')[1]?.slice(0, 5) : '11:00',
          timestamp: v.timestamp || new Date(v.date).toISOString(),
          type: 'branch_expense',
          typeLabel: 'مصروف تشغيلي للوكيل',
          referenceId: v.voucherNumber,
          description: `صرف نقدي: ${v.reasonCategory} - ${v.description}`,
          partyName: `المدفوع له: ${v.paidByOrTo}`,
          grossAmount: v.amount,
          currency: v.currency,
          branchCommissionRate: 0,
          branchCommissionAmount: 0,
          companyShareAmount: 0,
          expenseAmount: v.amount,
        });
      }
    });

    // 2. Approved Agent Expenses from Expenses module
    if (expenses && expenses.length > 0) {
      expenses
        .filter((e) => e.branchId === selectedAgentBranch.id && e.status === 'approved')
        .forEach((e) => {
          if (recordedExpenseRefs.has(e.id) || (e.expenseNumber && recordedExpenseRefs.has(e.expenseNumber))) {
            return;
          }
          const eTimeStr = e.createdAt || e.date;
          const eTime = new Date(eTimeStr || Date.now()).getTime();
          const isAfterPrevious = lastClearing
            ? new Date(eTimeStr || 0).getTime() > new Date(lastClearing.timestamp).getTime() ||
              (eTimeStr?.split('T')[0] || '') >= (lastClearing.clearingDetails?.periodTo || lastClearing.date)
            : true;
          const inDateRange = eTime >= startTimestamp && eTime <= endTimestamp;

          if (inDateRange && isAfterPrevious) {
            recordedExpenseRefs.add(e.id);
            if (e.expenseNumber) recordedExpenseRefs.add(e.expenseNumber);

            items.push({
              id: `op_exp_${e.id}`,
              operationNumber: e.expenseNumber || e.id,
              date: eTimeStr ? eTimeStr.split('T')[0] : new Date().toISOString().split('T')[0],
              time: eTimeStr && eTimeStr.includes('T') ? eTimeStr.split('T')[1]?.slice(0, 5) : '10:00',
              timestamp: eTimeStr || new Date().toISOString(),
              type: 'branch_expense',
              typeLabel: 'مصروف معتمد للوكيل',
              referenceId: e.expenseNumber || e.id,
              description: `صرف: ${e.title || e.category || 'مصروف عام'} - المدفوع له: ${e.paidTo || '-'}`,
              partyName: `الجهة: ${e.paidTo || 'مصاريف الوكيل'}`,
              grossAmount: e.amount || 0,
              currency: e.currency || 'SYP',
              branchCommissionRate: 0,
              branchCommissionAmount: 0,
              companyShareAmount: 0,
              expenseAmount: e.amount || 0,
            });
          }
        });
    }

    // 3. Direct Cashbox Operating Expense Transactions for Agent
    if (transactions && transactions.length > 0) {
      transactions
        .filter((t) => t.branchId === selectedAgentBranch.id && (t.type === 'operating_expense' || (t as any).type === 'expense'))
        .forEach((t) => {
          if (t.referenceId && recordedExpenseRefs.has(t.referenceId)) return;
          if (recordedExpenseRefs.has(t.id)) return;
          const tTimeStr = t.timestamp || t.createdAt;
          const tTime = new Date(tTimeStr || Date.now()).getTime();
          const isAfterPrevious = lastClearing
            ? new Date(tTimeStr || 0).getTime() > new Date(lastClearing.timestamp).getTime() ||
              (tTimeStr?.split('T')[0] || '') >= (lastClearing.clearingDetails?.periodTo || lastClearing.date)
            : true;
          const inDateRange = tTime >= startTimestamp && tTime <= endTimestamp;

          if (inDateRange && isAfterPrevious) {
            items.push({
              id: `op_tx_exp_${t.id}`,
              operationNumber: `TX-${t.id.slice(-6)}`,
              date: tTimeStr ? tTimeStr.split('T')[0] : new Date().toISOString().split('T')[0],
              time: tTimeStr && tTimeStr.includes('T') ? tTimeStr.split('T')[1]?.slice(0, 5) : '09:00',
              timestamp: tTimeStr || new Date().toISOString(),
              type: 'branch_expense',
              typeLabel: 'مصروف نقدي للوكيل',
              referenceId: t.referenceId || t.id,
              description: t.description || 'مصروف تشغيلي مقيد بصندوق الوكيل',
              partyName: 'صندوق الوكيل',
              grossAmount: t.amount || 0,
              currency: t.currency || 'SYP',
              branchCommissionRate: 0,
              branchCommissionAmount: 0,
              companyShareAmount: 0,
              expenseAmount: t.amount || 0,
            });
          }
        });
    }

    // Sort chronologically ascending
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const first = items.length > 0 ? items[0] : null;
    const last = items.length > 0 ? items[items.length - 1] : null;

    return {
      operations: items,
      firstOperation: first,
      lastOperation: last,
    };
  }, [parcels, vouchers, expenses, transactions, selectedAgentBranch.id, startDate, endDate, lastClearing, shippingRate, transferRate]);

  // Helper to find associated Parcel entity
  const findParcelForOp = (op: ClearingOperationItem): Parcel | null => {
    return (
      parcels.find((p) => p.trackingNumber === op.referenceId || p.trackingNumber === op.operationNumber) ||
      parcels.find((p) => op.id.includes(p.id)) ||
      null
    );
  };

  // Order Action Handlers
  const handleViewParcel = (op: ClearingOperationItem) => {
    const parcel = findParcelForOp(op);
    if (parcel) {
      setSelectedParcelForQuickView(parcel);
    } else {
      setInspectedOp(op);
    }
  };

  const handlePrintParcel = (op: ClearingOperationItem) => {
    const parcel = findParcelForOp(op);
    if (parcel) {
      openPrintModal('parcel_3part', parcel);
    } else {
      setInspectedOp(op);
    }
  };

  const handleCopyOperationNumber = (op: ClearingOperationItem) => {
    navigator.clipboard.writeText(op.operationNumber || op.referenceId || '');
    setCopiedOpId(op.id);
    setTimeout(() => {
      setCopiedOpId(null);
    }, 1800);
  };

  const handleToggleIncludeOp = (opId: string) => {
    setExcludedOpIds((prev) => {
      const next = new Set(prev);
      if (next.has(opId)) {
        next.delete(opId);
      } else {
        next.add(opId);
      }
      return next;
    });
  };

  const handleSelectAllOps = () => {
    setExcludedOpIds(new Set());
  };

  const handleDeselectAllOps = () => {
    const allIds = new Set(operations.map((o) => o.id));
    setExcludedOpIds(allIds);
  };

  const handleToggleExcludeExpenses = () => {
    const expenseOps = operations.filter((o) => o.type === 'branch_expense');
    const allExpensesExcluded = expenseOps.every((o) => excludedOpIds.has(o.id));

    setExcludedOpIds((prev) => {
      const next = new Set(prev);
      expenseOps.forEach((o) => {
        if (allExpensesExcluded) {
          next.delete(o.id);
        } else {
          next.add(o.id);
        }
      });
      return next;
    });
  };

  // Export CSV of Orders / Operations
  const handleExportOrdersCsv = () => {
    const activeOps = operations.filter((op) => !excludedOpIds.has(op.id));
    if (activeOps.length === 0) {
      alert('لا توجد عمليات مشمولة بالتصدير.');
      return;
    }

    const headers = [
      'ت',
      'رقم العملية / البوليصة',
      'التاريخ',
      'التوقيت',
      'نوع الحركة',
      'البيان',
      'الطرف المعني',
      'المبلغ الإجمالي',
      'العملة',
      'نسبة الوكيل %',
      'عمولة الوكيل',
      'صافي حصة المركز',
    ];

    const rows = activeOps.map((op, idx) => [
      idx + 1,
      op.operationNumber,
      op.date,
      op.time,
      op.typeLabel,
      `"${(op.description || '').replace(/"/g, '""')}"`,
      `"${(op.partyName || '').replace(/"/g, '""')}"`,
      op.grossAmount,
      op.currency,
      op.branchCommissionRate,
      op.branchCommissionAmount,
      op.companyShareAmount,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `كشف_أوامر_مقاصة_${selectedAgentBranch.name.replace(/\s+/g, '_')}_${endDate || new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Active included operations
  const activeOperations = useMemo(() => {
    return operations.filter((op) => !excludedOpIds.has(op.id));
  }, [operations, excludedOpIds]);

  // 4. Financial Totals & 4 Key Figures (strictly calculated on active/included operations)
  const totals = useMemo(() => {
    let grossSyp = 0;
    let grossUsd = 0;

    let expensesSyp = 0;
    let expensesUsd = 0;

    let branchShareSyp = 0;
    let branchShareUsd = 0;

    let shippingGrossSyp = 0;
    let shippingGrossUsd = 0;
    let shippingBranchCutSyp = 0;
    let shippingBranchCutUsd = 0;
    let shippingCompanyNetSyp = 0;
    let shippingCompanyNetUsd = 0;

    let codGrossSyp = 0;
    let codGrossUsd = 0;
    let codBranchCutSyp = 0;
    let codBranchCutUsd = 0;

    let transferredSyp = 0;
    let transferredUsd = 0;

    activeOperations.forEach((op) => {
      // Track transferred amounts to deduct from HQ share
      if (op.transferredAmount && op.transferredAmount > 0) {
        if (op.currency === 'SYP') transferredSyp += op.transferredAmount;
        else transferredUsd += op.transferredAmount;
      }

      if (op.type === 'branch_expense') {
        if (op.currency === 'SYP') expensesSyp += op.grossAmount;
        else expensesUsd += op.grossAmount;
      } else {
        // Revenue / Collections
        if (op.currency === 'SYP') {
          grossSyp += op.grossAmount;
          branchShareSyp += op.branchCommissionAmount;
          if (op.type === 'shipping_prepaid' || op.type === 'shipping_collect') {
            shippingGrossSyp += op.grossAmount;
            shippingBranchCutSyp += op.branchCommissionAmount;
            shippingCompanyNetSyp += op.companyShareAmount;
          } else if (op.type === 'cod_collection') {
            codGrossSyp += op.grossAmount;
            codBranchCutSyp += op.branchCommissionAmount;
          }
        } else {
          grossUsd += op.grossAmount;
          branchShareUsd += op.branchCommissionAmount;
          if (op.type === 'shipping_prepaid' || op.type === 'shipping_collect') {
            shippingGrossUsd += op.grossAmount;
            shippingBranchCutUsd += op.branchCommissionAmount;
            shippingCompanyNetUsd += op.companyShareAmount;
          } else if (op.type === 'cod_collection') {
            codGrossUsd += op.grossAmount;
            codBranchCutUsd += op.branchCommissionAmount;
          }
        }
      }
    });

    // Net payable to Head office = (Total Inflow Gross - Agent Expenses - Agent Commission - Transferred Courier Amounts)
    const netRemitSyp = Math.max(0, grossSyp - expensesSyp - branchShareSyp - transferredSyp);
    const netRemitUsd = Math.max(0, grossUsd - expensesUsd - branchShareUsd - transferredUsd);

    return {
      grossSyp,
      grossUsd,
      expensesSyp,
      expensesUsd,
      branchShareSyp,
      branchShareUsd,
      transferredSyp,
      transferredUsd,
      netRemitSyp,
      netRemitUsd,
      shippingGrossSyp,
      shippingGrossUsd,
      shippingBranchCutSyp,
      shippingBranchCutUsd,
      shippingCompanyNetSyp,
      shippingCompanyNetUsd,
      codGrossSyp,
      codGrossUsd,
      codBranchCutSyp,
      codBranchCutUsd,
    };
  }, [activeOperations]);

  // Filtered table rows for detailed view
  const filteredTableOperations = useMemo(() => {
    return operations.filter((op) => {
      if (tableFilterType !== 'all') {
        if (tableFilterType === 'shipping' && !['shipping_prepaid', 'shipping_collect'].includes(op.type)) {
          return false;
        }
        if (tableFilterType === 'cod' && op.type !== 'cod_collection') {
          return false;
        }
        if (tableFilterType === 'expense' && op.type !== 'branch_expense') {
          return false;
        }
        if (tableFilterType === 'included' && excludedOpIds.has(op.id)) {
          return false;
        }
        if (tableFilterType === 'excluded' && !excludedOpIds.has(op.id)) {
          return false;
        }
      }

      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase();
        const match =
          op.operationNumber.toLowerCase().includes(query) ||
          op.description.toLowerCase().includes(query) ||
          (op.partyName && op.partyName.toLowerCase().includes(query)) ||
          op.typeLabel.toLowerCase().includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [operations, tableFilterType, tableSearch, excludedOpIds]);

  // Settlement Modal State
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementMethod, setSettlementMethod] = useState<ClearingSettlementMethod>('instant_cash');
  const [settlementBankName, setSettlementBankName] = useState('');
  const [settlementTransferRef, setSettlementTransferRef] = useState('');
  const [autoGenerateReceipt, setAutoGenerateReceipt] = useState(true);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [completedResult, setCompletedResult] = useState<{
    clearingVoucher: FinancialVoucher;
    receiptVoucher?: FinancialVoucher;
  } | null>(null);

  // Open Settlement Configuration before final execution
  const handleOpenSettlementDialog = (e: React.FormEvent) => {
    e.preventDefault();

    if (totals.netRemitSyp <= 0 && totals.netRemitUsd <= 0 && activeOperations.length === 0) {
      alert('لا توجد مبالغ أو عمليات مشمولة بالترصيد لتوريدها للمركز الرئيسي.');
      return;
    }

    setIsSettlementModalOpen(true);
  };

  // Final execution of clearing and settlement
  const handleConfirmFinalSettlement = () => {
    setIsSubmitting(true);

    try {
      const details: ClearingReconciliationDetails = {
        periodFrom: startDate || (firstOperation ? firstOperation.date : new Date().toISOString().split('T')[0]),
        periodTo: endDate || (lastOperation ? lastOperation.date : new Date().toISOString().split('T')[0]),
        previousClearingVoucherNumber: lastClearing?.voucherNumber,
        previousClearingDate: lastClearing?.date,
        firstOperationRef: firstOperation?.operationNumber || 'لا توجد عمليات سابقة',
        firstOperationDate: firstOperation ? `${firstOperation.date} ${firstOperation.time || ''}` : '',
        lastOperationRef: lastOperation?.operationNumber || 'لا توجد عمليات',
        lastOperationDate: lastOperation ? `${lastOperation.date} ${lastOperation.time || ''}` : '',
        parcelsCount: activeOperations.filter((o) => o.type !== 'branch_expense').length,
        operationsCount: activeOperations.length,
        // The 4 key figures stored in voucher details
        totalGrossAmountSyp: totals.grossSyp,
        totalGrossAmountUsd: totals.grossUsd,
        totalExpensesSyp: totals.expensesSyp,
        totalExpensesUsd: totals.expensesUsd,
        totalBranchShareSyp: totals.branchShareSyp,
        totalBranchShareUsd: totals.branchShareUsd,
        totalTransferredAmountsSyp: totals.transferredSyp,
        totalTransferredAmountsUsd: totals.transferredUsd,
        totalNetPayableToHeadOfficeSyp: totals.netRemitSyp,
        totalNetPayableToHeadOfficeUsd: totals.netRemitUsd,
        // Detailed breakdowns
        totalShippingCollectedSyp: totals.shippingGrossSyp,
        totalShippingCollectedUsd: totals.shippingGrossUsd,
        branchShippingCommissionPercent: shippingRate,
        branchShippingCommissionAmountSyp: totals.shippingBranchCutSyp,
        branchShippingCommissionAmountUsd: totals.shippingBranchCutUsd,
        headOfficeNetShippingShareSyp: totals.shippingCompanyNetSyp,
        headOfficeNetShippingShareUsd: totals.shippingCompanyNetUsd,
        totalCodCollectedSyp: totals.codGrossSyp,
        totalCodCollectedUsd: totals.codGrossUsd,
        branchCodCommissionPercent: transferRate,
        branchCodCommissionAmountSyp: totals.codBranchCutSyp,
        branchCodCommissionAmountUsd: totals.codBranchCutUsd,
        reconciliationNotes: settlementNotes ? `${clearingNotes ? clearingNotes + ' - ' : ''}${settlementNotes}` : clearingNotes,
        operations: activeOperations.slice(0, 500), // attach snapshot
      };

      const result = createBranchClearingVoucher(
        selectedAgentBranch.id,
        destHubId,
        details,
        clearingNotes,
        {
          method: settlementMethod,
          bankName: settlementBankName,
          transferRefNumber: settlementTransferRef,
          autoGenerateReceiptVoucher: autoGenerateReceipt,
          notes: settlementNotes,
        }
      );

      setIsSubmitting(false);
      setIsSettlementModalOpen(false);
      setCompletedResult(result);

      if (onVoucherCreated) {
        onVoucherCreated(result.clearingVoucher);
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      alert('حدث خطأ أثناء اعتماد وترحيل سند المقاصة. يرجى مراجعة الصناديق.');
    }
  };

  const [previewPrintVoucher, setPreviewPrintVoucher] = useState<FinancialVoucher | null>(null);

  const handleDirectPrintPreview = () => {
    const first = activeOperations.length > 0 ? activeOperations[0] : null;
    const last = activeOperations.length > 0 ? activeOperations[activeOperations.length - 1] : null;

    const draftDetails: ClearingReconciliationDetails = {
      periodFrom: startDate || (first ? first.date : new Date().toISOString().split('T')[0]),
      periodTo: endDate || (last ? last.date : new Date().toISOString().split('T')[0]),
      previousClearingVoucherNumber: lastClearing?.voucherNumber,
      previousClearingDate: lastClearing?.date,
      firstOperationRef: first?.operationNumber || 'لا توجد عمليات سابقة',
      firstOperationDate: first ? `${first.date} ${first.time || ''}` : '',
      lastOperationRef: last?.operationNumber || 'لا توجد عمليات',
      lastOperationDate: last ? `${last.date} ${last.time || ''}` : '',
      parcelsCount: activeOperations.filter((o) => o.type !== 'branch_expense').length,
      operationsCount: activeOperations.length,
      totalGrossAmountSyp: totals.grossSyp,
      totalGrossAmountUsd: totals.grossUsd,
      totalExpensesSyp: totals.expensesSyp,
      totalExpensesUsd: totals.expensesUsd,
      totalBranchShareSyp: totals.branchShareSyp,
      totalBranchShareUsd: totals.branchShareUsd,
      totalTransferredAmountsSyp: totals.transferredSyp,
      totalTransferredAmountsUsd: totals.transferredUsd,
      totalNetPayableToHeadOfficeSyp: totals.netRemitSyp,
      totalNetPayableToHeadOfficeUsd: totals.netRemitUsd,
      totalShippingCollectedSyp: totals.shippingGrossSyp,
      totalShippingCollectedUsd: totals.shippingGrossUsd,
      branchShippingCommissionPercent: shippingRate,
      branchShippingCommissionAmountSyp: totals.shippingBranchCutSyp,
      branchShippingCommissionAmountUsd: totals.shippingBranchCutUsd,
      headOfficeNetShippingShareSyp: totals.shippingCompanyNetSyp,
      headOfficeNetShippingShareUsd: totals.shippingCompanyNetUsd,
      totalCodCollectedSyp: totals.codGrossSyp,
      totalCodCollectedUsd: totals.codGrossUsd,
      branchCodCommissionPercent: transferRate,
      branchCodCommissionAmountSyp: totals.codBranchCutSyp,
      branchCodCommissionAmountUsd: totals.codBranchCutUsd,
      reconciliationNotes: clearingNotes || 'كشف مطابقة وتوريد مالي رسمي للوكيل',
      operations: activeOperations.slice(0, 500),
    };

    const draftVoucher: FinancialVoucher = {
      id: `draft_clearing_${Date.now()}`,
      voucherNumber: `CLR-PRINT-PREVIEW`,
      type: 'clearing',
      branchId: selectedAgentBranch.id,
      counterpartyBranchId: destHubId,
      amount: totals.netRemitSyp,
      currency: 'SYP',
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      performedByUserId: currentUser.id,
      status: 'approved',
      reasonCategory: 'سند مقاصة ومطابقة الحسابات المالية للوكيل وتوريد حصة الإدارة العامة',
      description: `كشف مطابقة وتسوية حسابات مكتب الوكيل [${selectedAgentBranch.name}] مع المركز الرئيسي للفترة من (${draftDetails.periodFrom}) إلى (${draftDetails.periodTo})`,
      paidByOrTo: `الإدارة العامة - ${branches.find((b) => b.id === destHubId)?.name || 'المركز الرئيسي'}`,
      clearingDetails: draftDetails,
    };

    setPreviewPrintVoucher(draftVoucher);
  };

  if (!isOpen) return null;

  // Access check guard: Clearing is restricted to agent branches or super_admin
  const isAgentOrSuperAdmin = currentUser.role === 'super_admin' || currentBranch?.type === 'agent';
  if (!isAgentOrSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">خاصية المقاصة غير متاحة لهذا الفرع</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            وفقاً لتعليمات النظام، المقاصة المالية مخصصة حصراً للفروع التابعة للوكلاء الخارجيين أو الإدارة العامة.
            يمكنكم استخدام خيار <span className="text-purple-300 font-bold">"سند مناقلة صناديق بين الفروع"</span> لنقل وتحويل السيولة النقدية بين الفروع.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            إغلاق Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="fullscreen-clearing-modal"
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col w-full h-full max-h-screen max-w-screen overflow-hidden animate-in fade-in duration-150 select-none"
      dir="rtl"
    >
      {/* 1. ULTRA-COMPACT HEADER (هيدر مختصر ومركّز بدون تكرار) */}
      <header className="py-2 px-3 sm:px-5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-sm">
        {/* Right: Icon + Clean Title */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
              سند المقاصة والمطابقة المالية للأوامر
            </h1>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              تسوية ومطابقة حسابات الوكلاء وتوريد حصة المركز
            </span>
          </div>
        </div>

        {/* Center/Left: Selectors & View Mode Controls in a single concise line */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Agent Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-cyan-500/30">
            <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">الوكيل:</span>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-transparent text-cyan-300 font-bold text-xs focus:outline-none cursor-pointer max-w-[170px] truncate"
            >
              {agentBranches.length > 0 ? (
                <optgroup label="مكاتب الوكلاء">
                  {agentBranches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                      {b.name} ({b.governorate})
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label="كافة الفروع">
                {branches
                  .filter((b) => b.type !== 'agent')
                  .map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-slate-300">
                      {b.name} ({b.governorate})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[11px]">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400">من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white font-mono text-[11px] focus:outline-none w-26"
            />
            <span className="text-slate-500">إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white font-mono text-[11px] focus:outline-none w-26"
            />
          </div>

          {/* Destination Hub Selector */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
            <Building2 className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400">المركز:</span>
            <select
              value={destHubId}
              onChange={(e) => setDestHubId(e.target.value)}
              className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer max-w-[120px] truncate"
            >
              {branches
                .filter((b) => b.isCentralHub || b.isMainHub || b.id === 'hub_damascus')
                .map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    {b.name}
                  </option>
                ))}
            </select>
          </div>

          {/* View Mode Toggle: Summary vs Detailed */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'summary'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>موجز</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'detailed'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>أوامر الطرود ({activeOperations.length})</span>
            </button>
          </div>

          {/* Print Preview Button */}
          <button
            type="button"
            onClick={handleDirectPrintPreview}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
            title="معاينة وطباعة الكشف والسند"
          >
            <Printer className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">طباعة</span>
          </button>

          {/* Primary Top Header CTA Button */}
          <button
            type="button"
            onClick={handleOpenSettlementDialog}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 border border-emerald-300/40 transition cursor-pointer disabled:opacity-50 active:scale-95"
            title="اعتماد وترحيل سند المقاصة وتصفية الحساب"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>اعتماد وترحيل سند المقاصة</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. PROMINENT TOTALS STRIP (شريط الإجماليات الواضح والأرقام البارزة) */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-5 py-2 shrink-0 shadow-inner">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* 1. Total Gross Collected */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-cyan-400" />
                المقبوض لدى الوكيل
              </span>
              <span className="text-[10px] text-slate-500">شحن + تحصيلات COD</span>
            </div>
            <div className="text-right font-mono">
              <div className="text-base sm:text-lg font-black text-cyan-300">
                {formatCurrency(totals.grossSyp, 'SYP')}
              </div>
              {totals.grossUsd > 0 && (
                <div className="text-[10px] text-slate-400">+{formatCurrency(totals.grossUsd, 'USD')}</div>
              )}
            </div>
          </div>

          {/* 2. Agent Expenses */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-rose-500/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                المصاريف المعتمدة
              </span>
              <span className="text-[10px] text-slate-500">سندات صرف للوكيل</span>
            </div>
            <div className="text-right font-mono">
              <div className="text-base sm:text-lg font-black text-rose-400">
                -{formatCurrency(totals.expensesSyp, 'SYP')}
              </div>
              {totals.expensesUsd > 0 && (
                <div className="text-[10px] text-slate-400">-{formatCurrency(totals.expensesUsd, 'USD')}</div>
              )}
            </div>
          </div>

          {/* 3. Agent Commission Share */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                عمولة الوكيل المستحقة
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono font-bold">
                {shippingRate}% شحن | {transferRate}% حوالات
              </span>
            </div>
            <div className="text-right font-mono">
              <div className="text-base sm:text-lg font-black text-amber-300">
                +{formatCurrency(totals.branchShareSyp, 'SYP')}
              </div>
              {totals.branchShareUsd > 0 && (
                <div className="text-[10px] text-slate-400">+{formatCurrency(totals.branchShareUsd, 'USD')}</div>
              )}
            </div>
          </div>

          {/* 4. Net Remittance to Main Company */}
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border-2 border-emerald-500/60 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[11px] font-black text-emerald-300 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                الصافي المورد للإدارة
              </span>
              <span className="text-[10px] text-emerald-400/80 font-bold">المبلغ المحول رسمياً</span>
            </div>
            <div className="text-right font-mono">
              <div className="text-lg sm:text-xl font-black text-white">
                {formatCurrency(totals.netRemitSyp, 'SYP')}
              </div>
              {totals.netRemitUsd > 0 && (
                <div className="text-[10px] text-emerald-300 font-bold">+{formatCurrency(totals.netRemitUsd, 'USD')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SLIM STATUS RIBBON (شريط تفاصيل الفترة والترصيد المدمج) */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">حالة الترصيد:</span>
            {lastClearing ? (
              <span className="font-mono text-emerald-400 font-bold">
                مرصد حتى سند [{lastClearing.voucherNumber}] بتاريخ {lastClearing.date}
              </span>
            ) : (
              <span className="text-amber-400 font-semibold">أول ترصيد تراكمي للوكيل</span>
            )}
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">نطاق العمليات:</span>
            <span className="font-mono text-slate-300 font-semibold">
              من [{firstOperation?.operationNumber || 'بداية'}] إلى [{lastOperation?.operationNumber || 'نهاية'}]
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totals.transferredSyp > 0 && (
            <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50 font-mono">
              مبالغ موزعين مخصومة: {formatCurrency(totals.transferredSyp, 'SYP')}
            </span>
          )}
          <span className="text-slate-400 font-mono text-[11px]">
            أوامر مشمولة بالسند:{' '}
            <strong className="text-emerald-400 font-bold">{activeOperations.length}</strong> من أصل{' '}
            <strong className="text-white">{operations.length}</strong>
          </span>
          {excludedOpIds.size > 0 && (
            <span className="text-[10px] text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
              مستثنى ({excludedOpIds.size})
            </span>
          )}
        </div>
      </div>

      {/* 4. MAIN SCROLLABLE WORKSPACE (المساحة المفتوحة للقوائم والجداول والخيارات) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-950/60">
        <div className="w-full space-y-3">

          {/* VIEW MODE 1: SUMMARY REPORT */}
          {viewMode === 'summary' && (
            <div className="space-y-3 animate-in fade-in">
              {/* Reconciliation Status Information Banner */}
              <div className="bg-gradient-to-l from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                    <CheckCircle className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>كشف المقاصة والتسوية المالية للوكيل</span>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                        {activeOperations.length} أمر مشمول
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      صافي المبلغ المستحق للتوريد للإدارة:{' '}
                      <strong className="text-emerald-400 font-mono text-sm">
                        {formatCurrency(totals.netRemitSyp, 'SYP')}
                      </strong>{' '}
                      {totals.netRemitUsd > 0 && (
                        <span className="text-emerald-300">
                          + {formatCurrency(totals.netRemitUsd, 'USD')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span>الاعتماد والترحيل متاح عبر الزر في الهيدر العلوي </span>
                  <span className="text-emerald-400 font-bold">«اعتماد وترحيل سند المقاصة»</span>
                </div>
              </div>

              {/* Action Banner for Orders */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">أوامر وحركات المقاصة المالية للوكيل</h3>
                    <p className="text-[11px] text-slate-400">
                      يحتوي الكشف على <strong className="text-cyan-300 font-mono">{activeOperations.length}</strong> حركة وأمر طرد مالي جاهز للمقاصة والتوريد.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('detailed')}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>استعراض وتحديد أوامر الطرود بالتفصيل</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportOrdersCsv}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-600/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>تصدير كشف الأوامر (Excel/CSV)</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
                {/* Detailed accounting breakdown table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                        <th className="p-3 font-bold">البند والتصنيف المحاسبي للوكيل</th>
                        <th className="p-3 font-bold text-center">أوامر الطرود</th>
                        <th className="p-3 font-bold text-left">إجمالي المقبوض لدى الوكيل</th>
                        <th className="p-3 font-bold text-center">نسبة الوكيل</th>
                        <th className="p-3 font-bold text-left">إيراد وعمولة الوكيل المقتطعة</th>
                        <th className="p-3 font-bold text-left">صافي حصة الشركة الأساسية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono">
                      {/* Shipping Row */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-sans font-bold text-slate-200">
                          أجور شحن البضائع والطرود (صادر مدفوع + وارد محصل لدى الوكيل)
                        </td>
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {activeOperations.filter((o) => o.type === 'shipping_prepaid' || o.type === 'shipping_collect').length}
                        </td>
                        <td className="p-3 text-left font-bold text-cyan-300">
                          {formatCurrency(totals.shippingGrossSyp, 'SYP')}
                        </td>
                        <td className="p-3 text-center text-amber-400 font-sans font-bold">
                          {shippingRate}%
                        </td>
                        <td className="p-3 text-left font-bold text-amber-300">
                          {formatCurrency(totals.shippingBranchCutSyp, 'SYP')}
                        </td>
                        <td className="p-3 text-left font-black text-emerald-400">
                          {formatCurrency(totals.shippingCompanyNetSyp, 'SYP')}
                        </td>
                      </tr>

                      {/* COD Row */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-sans font-bold text-slate-200">
                          تحصيلات المبالغ والحوالات المالية (COD) المسلمة لدى الوكيل
                        </td>
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {activeOperations.filter((o) => o.type === 'cod_collection').length}
                        </td>
                        <td className="p-3 text-left font-bold text-cyan-300">
                          {formatCurrency(totals.codGrossSyp, 'SYP')}
                        </td>
                        <td className="p-3 text-center text-amber-400 font-sans font-bold">
                          {transferRate}%
                        </td>
                        <td className="p-3 text-left font-bold text-amber-300">
                          {formatCurrency(totals.codBranchCutSyp, 'SYP')}
                        </td>
                        <td className="p-3 text-left font-black text-emerald-400">
                          {formatCurrency(totals.codGrossSyp - totals.codBranchCutSyp, 'SYP')}
                        </td>
                      </tr>

                      {/* Agent Expenses Row */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3 font-sans font-bold text-rose-300">
                          المصاريف التشغيلية المعتمدة المدفوعة بمكتب الوكيل (سندات صرف ونثريات)
                        </td>
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {activeOperations.filter((o) => o.type === 'branch_expense').length}
                        </td>
                        <td className="p-3 text-left font-bold text-rose-400">
                          -{formatCurrency(totals.expensesSyp, 'SYP')}
                        </td>
                        <td className="p-3 text-center text-slate-500 font-sans">خصم مباشر</td>
                        <td className="p-3 text-left text-slate-500">-</td>
                        <td className="p-3 text-left font-bold text-rose-400">
                          -{formatCurrency(totals.expensesSyp, 'SYP')}
                        </td>
                      </tr>

                      {/* Transferred Amounts to Couriers */}
                      {totals.transferredSyp > 0 && (
                        <tr className="hover:bg-slate-800/30 bg-indigo-950/20">
                          <td className="p-3 font-sans font-bold text-indigo-300 flex items-center gap-1.5">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>مبالغ محوّلة لأجور الموزعين بالجهة المقابلة (مخصومة من حصة المركز)</span>
                          </td>
                          <td className="p-3 text-center text-indigo-300 font-mono">
                            {activeOperations.filter((o) => (o.transferredAmount || 0) > 0).length}
                          </td>
                          <td className="p-3 text-left font-bold text-indigo-300 font-mono">
                            {formatCurrency(totals.transferredSyp, 'SYP')}
                          </td>
                          <td className="p-3 text-center text-indigo-400 font-sans text-xs">خصم من المركز</td>
                          <td className="p-3 text-left text-slate-500 font-mono">-</td>
                          <td className="p-3 text-left font-bold text-rose-400 font-mono">
                            -{formatCurrency(totals.transferredSyp, 'SYP')}
                          </td>
                        </tr>
                      )}

                      {/* Final Net Remittance Row */}
                      <tr className="bg-slate-950 font-black">
                        <td colSpan={5} className="p-3.5 font-sans text-sm text-slate-100">
                          المبلغ الصافي النهائي الواجب توريده وترحيله من الوكيل للمركز الرئيسي:
                        </td>
                        <td className="p-3.5 text-left font-mono text-base text-emerald-400">
                          {formatCurrency(totals.netRemitSyp, 'SYP')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Clearing Notes */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ملاحظات وبيان كشف المطابقة وسند المقاصة:
                  </label>
                  <textarea
                    rows={2}
                    value={clearingNotes}
                    onChange={(e) => setClearingNotes(e.target.value)}
                    placeholder={`بيان وملاحظات التسوية والمطابقة الرسمية لحساب الوكيل [${selectedAgentBranch.name}]...`}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-white text-xs outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: DETAILED OPERATIONS TABLE (التقرير التفصيلي بجدول العمليات وأزرار الأوامر) */}
          {viewMode === 'detailed' && (
            <div className="space-y-3 animate-in fade-in">
              {/* 1. ORDERS COMMAND & ACTION TOOLBAR (شريط أوامر وإجراءات سند المقاصة) */}
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
                {/* Top Row: Search & Batch Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Field */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="بحث برقم البوليصة، السند، أو العميل..."
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-xl pr-8 pl-3 py-1.5 text-white text-xs w-60 sm:w-72 focus:border-cyan-500 outline-none"
                      />
                    </div>

                    {/* Batch Selection Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleSelectAllOps}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        title="تحديد كافة العمليات وتضمينها بالسند"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        <span>تحديد الكل</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDeselectAllOps}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        title="إلغاء تحديد كافة العمليات"
                      >
                        <Square className="w-3.5 h-3.5 text-slate-500" />
                        <span>إلغاء التحديد</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleExcludeExpenses}
                        className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-rose-300 border border-rose-900/40 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        title="تبديل تضمين أو استثناء المصاريف التشغيلية"
                      >
                        <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        <span>المصاريف</span>
                      </button>
                    </div>
                  </div>

                  {/* Export & Print Direct Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportOrdersCsv}
                      className="px-3 py-1.5 bg-gradient-to-r from-teal-700 to-cyan-700 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير كشف الأوامر (CSV)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDirectPrintPreview}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>طباعة الكشف</span>
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setTableFilterType('all')}
                      className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                        tableFilterType === 'all'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      الكل ({operations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilterType('shipping')}
                      className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                        tableFilterType === 'shipping'
                          ? 'bg-slate-800 text-cyan-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      أجور شحن ({operations.filter((o) => o.type === 'shipping_prepaid' || o.type === 'shipping_collect').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilterType('cod')}
                      className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                        tableFilterType === 'cod'
                          ? 'bg-slate-800 text-amber-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      حوالات COD ({operations.filter((o) => o.type === 'cod_collection').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilterType('expense')}
                      className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                        tableFilterType === 'expense'
                          ? 'bg-slate-800 text-rose-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      مصاريف ({operations.filter((o) => o.type === 'branch_expense').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilterType('included')}
                      className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                        tableFilterType === 'included'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      المحددة بالسند ({activeOperations.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-slate-400 text-xs flex items-center gap-2 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span>
                        معروض: <strong className="text-white">{filteredTableOperations.length}</strong>
                      </span>
                      <span>|</span>
                      <span>
                        مشمول بالسند: <strong className="text-emerald-400">{activeOperations.length}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Detailed Table with Action Column for Orders */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="sticky top-0 bg-slate-950 text-slate-300 border-b border-slate-800 z-10 shadow-sm">
                      <tr>
                        <th className="p-2.5 text-center font-mono w-10">تضمين</th>
                        <th className="p-2.5 font-bold">رقم العملية / البوليصة</th>
                        <th className="p-2.5 font-bold">التاريخ والتوقيت</th>
                        <th className="p-2.5 font-bold">نوع الحركة</th>
                        <th className="p-2.5 font-bold">البيان والأطراف</th>
                        <th className="p-2.5 text-left font-bold">المبلغ الإجمالي</th>
                        <th className="p-2.5 text-center font-bold">نسبة الوكيل</th>
                        <th className="p-2.5 text-left font-bold text-amber-300">إيراد الوكيل</th>
                        <th className="p-2.5 text-left font-bold text-emerald-300">إيراد / صافي المركز</th>
                        <th className="p-2.5 text-center font-bold">أوامر وإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {filteredTableOperations.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-500 font-sans">
                            لا توجد عمليات مطابقة للشروط أو الفلاتر المحددة للوكيل المحدد.
                          </td>
                        </tr>
                      ) : (
                        filteredTableOperations.map((op, idx) => {
                          const isIncluded = !excludedOpIds.has(op.id);
                          const isCopied = copiedOpId === op.id;

                          return (
                            <tr
                              key={op.id}
                              className={`transition-colors ${
                                !isIncluded
                                  ? 'bg-slate-950/40 text-slate-600 opacity-60'
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              {/* 1. Inclusion Checkbox */}
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleIncludeOp(op.id)}
                                  className={`p-1 rounded-md transition cursor-pointer ${
                                    isIncluded
                                      ? 'text-emerald-400 hover:bg-emerald-950'
                                      : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                                  }`}
                                  title={isIncluded ? 'استثناء هذه العملية من سند المقاصة' : 'إعادة تضمين هذه العملية بالسند'}
                                >
                                  {isIncluded ? (
                                    <CheckSquare className="w-4 h-4" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </td>

                              {/* 2. Operation Number */}
                              <td className="p-2.5 font-bold whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className={isIncluded ? 'text-cyan-400' : 'text-slate-500'}>
                                    {op.operationNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyOperationNumber(op)}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition cursor-pointer"
                                    title="نسخ رقم العملية"
                                  >
                                    {isCopied ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* 3. Date & Time */}
                              <td className="p-2.5 text-slate-400 whitespace-nowrap">
                                {op.date} <span className="text-[10px] text-slate-500">{op.time}</span>
                              </td>

                              {/* 4. Type Badge */}
                              <td className="p-2.5 font-sans">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    op.type === 'branch_expense'
                                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                      : op.type === 'cod_collection'
                                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                      : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                                  }`}
                                >
                                  {op.typeLabel}
                                </span>
                              </td>

                              {/* 5. Description & Parties */}
                              <td className="p-2.5 font-sans max-w-xs">
                                <div className="truncate text-slate-200">{op.description}</div>
                                {op.partyName && (
                                  <div className="text-[10px] text-slate-400 truncate">{op.partyName}</div>
                                )}
                                {Boolean(op.transferredAmount && op.transferredAmount > 0) && (
                                  <div className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 mt-0.5">
                                    <ArrowRightLeft className="w-3 h-3 text-indigo-400 shrink-0" />
                                    <span>محوّل للموزع: {formatCurrency(op.transferredAmount, op.currency)}</span>
                                  </div>
                                )}
                              </td>

                              {/* 6. Total Gross */}
                              <td className="p-2.5 text-left font-bold text-white whitespace-nowrap">
                                {op.type === 'branch_expense' ? '-' : ''}
                                {formatCurrency(op.grossAmount, op.currency)}
                              </td>

                              {/* 7. Agent Rate */}
                              <td className="p-2.5 text-center font-sans font-bold text-amber-400">
                                {op.branchCommissionRate > 0 ? `${op.branchCommissionRate}%` : '-'}
                              </td>

                              {/* 8. Agent Cut */}
                              <td className="p-2.5 text-left font-bold text-amber-300 whitespace-nowrap">
                                {op.branchCommissionAmount > 0
                                  ? `+${formatCurrency(op.branchCommissionAmount, op.currency)}`
                                  : '-'}
                              </td>

                              {/* 9. HQ Net Share */}
                              <td className="p-2.5 text-left font-bold text-emerald-400 whitespace-nowrap">
                                {op.type === 'branch_expense' ? (
                                  `-${formatCurrency(op.grossAmount, op.currency)}`
                                ) : (
                                  <div>
                                    <div>{formatCurrency(op.companyShareAmount, op.currency)}</div>
                                    {Boolean(op.transferredAmount && op.transferredAmount > 0) && (
                                      <div className="text-[9px] text-indigo-300 font-normal">
                                        بعد خصم {formatCurrency(op.transferredAmount, op.currency)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* 10. ORDER ACTION BUTTONS (أزرار أوامر الطرد/العملية) */}
                              <td className="p-2 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  {/* View Order / Parcel Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleViewParcel(op)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-lg transition cursor-pointer shadow-sm"
                                    title="معاينة تفاصيل أمر الطرد أو السند"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Print Waybill / Receipt Button */}
                                  <button
                                    type="button"
                                    onClick={() => handlePrintParcel(op)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded-lg transition cursor-pointer shadow-sm"
                                    title="طباعة بوليصة الشحن أو إيصال الحركة"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Toggle Include / Exclude Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleIncludeOp(op.id)}
                                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                                      isIncluded
                                        ? 'bg-rose-950/60 hover:bg-rose-900 text-rose-300'
                                        : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300'
                                    }`}
                                    title={isIncluded ? 'استثناء من السند' : 'تضمين بالسند'}
                                  >
                                    {isIncluded ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-slate-950 font-black border-t-2 border-slate-800 font-mono">
                      <tr>
                        <td colSpan={5} className="p-3 text-slate-200 font-sans text-xs">
                          إجمالي العمليات المشمولة بالسند ({activeOperations.length} حركة):
                        </td>
                        <td className="p-3 text-left text-cyan-300">
                          {formatCurrency(totals.grossSyp, 'SYP')}
                        </td>
                        <td className="p-3 text-center text-slate-400">-</td>
                        <td className="p-3 text-left text-amber-300">
                          {formatCurrency(totals.branchShareSyp, 'SYP')}
                        </td>
                        <td className="p-3 text-left text-emerald-400 text-sm">
                          {formatCurrency(totals.netRemitSyp, 'SYP')}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={handleExportOrdersCsv}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[10px] font-sans font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <FileDown className="w-3 h-3" />
                            <span>تصدير</span>
                          </button>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. BOTTOM ACTION FOOTER (شريط الأزرار الواضح والظاهر دائماً) */}
      <footer className="min-h-[3.75rem] py-2.5 bg-slate-900 border-t-2 border-emerald-500/50 px-3 sm:px-5 flex flex-wrap md:flex-nowrap items-center justify-between gap-3 shrink-0 shadow-2xl z-30 sticky bottom-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="text-slate-400">
            <span>الوكيل: </span>
            <span className="font-bold text-cyan-300">[{selectedAgentBranch.name}]</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="text-slate-400">
            <span>الأوامر المشمولة: </span>
            <span className="font-bold text-white font-mono">{activeOperations.length} حركة</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="text-slate-400">
            <span>صافي التوريد: </span>
            <span className="font-black text-emerald-400 font-mono text-sm">
              {formatCurrency(totals.netRemitSyp, 'SYP')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleExportOrdersCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="تصدير بيانات الأوامر كملف إكسل / CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>تصدير CSV</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700 hover:border-slate-600"
          >
            إلغاء والعودة
          </button>
        </div>
      </footer>

      {/* Settlement Option Configuration Modal */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">تحديد طريقة تسوية وتوريد المقاصة</h3>
                  <p className="text-xs text-slate-400">
                    الوكيل: <span className="text-cyan-300 font-bold">{selectedAgentBranch.name}</span> ◄ المركز: <span className="text-emerald-300 font-bold">{branches.find(b => b.id === destHubId)?.name || 'دمشق'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSettlementModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary Card */}
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">صافي المبلغ الواجب تحصيله للإدارة:</span>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                  {formatCurrency(totals.netRemitSyp, 'SYP')}
                  {totals.netRemitUsd > 0 && (
                    <span className="text-sm font-normal text-emerald-300 mr-2">
                      + {formatCurrency(totals.netRemitUsd, 'USD')}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-left bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">العمليات المشمولة</span>
                <span className="font-bold text-white font-mono text-xs">{activeOperations.length} حركة</span>
              </div>
            </div>

            {/* Settlement Method Radios */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-300 block">اختر أسلوب التسوية المالية:</label>

              {/* Option 1: Instant Cash Settlement with Auto RV */}
              <label
                onClick={() => setSettlementMethod('instant_cash')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  settlementMethod === 'instant_cash'
                    ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${settlementMethod === 'instant_cash' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'}`}>
                  {settlementMethod === 'instant_cash' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 font-bold text-white mb-0.5">
                    <Banknote className="w-4 h-4 text-emerald-400" />
                    <span>توريد نقدي فوري لخزينة المركز (توليد سند قبض رسمي آلي RV)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">موصى به</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    يتم قيد المبلغ فوراً في خزينة المركز الرئيسي، وتوليد سند قبض نقدية رسمي مقترن بسند المقاصة وتصفير عهدة الفترة.
                  </p>

                  {settlementMethod === 'instant_cash' && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoGenReceiptCheck"
                        checked={autoGenerateReceipt}
                        onChange={(e) => setAutoGenerateReceipt(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="autoGenReceiptCheck" className="text-[11px] text-emerald-200 font-medium cursor-pointer">
                        إصدار سند قبض نقدية رسمي (Receipt Voucher) تلقائياً للمركز المستلم
                      </label>
                    </div>
                  )}
                </div>
              </label>

              {/* Option 2: Bank Remittance / Money Exchange */}
              <label
                onClick={() => setSettlementMethod('bank_transfer')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  settlementMethod === 'bank_transfer'
                    ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${settlementMethod === 'bank_transfer' ? 'border-cyan-400 bg-cyan-500' : 'border-slate-600'}`}>
                  {settlementMethod === 'bank_transfer' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 font-bold text-white mb-0.5">
                    <Landmark className="w-4 h-4 text-cyan-400" />
                    <span>سداد بحوالة مصرفية أو مكتب صرافة</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    سداد المبلغ عبر تحويل بنكي أو مكتب تحويل مع توثيق رقم الإشعار واسم الجهة المحول إليها.
                  </p>

                  {settlementMethod === 'bank_transfer' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-cyan-500/20">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">اسم المصرف / شركة الصرافة:</label>
                        <input
                          type="text"
                          value={settlementBankName}
                          onChange={(e) => setSettlementBankName(e.target.value)}
                          placeholder="مثال: بنك البركة / الفؤاد للصرافة"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">رقم إشعار الحوالة / العملية:</label>
                        <input
                          type="text"
                          value={settlementTransferRef}
                          onChange={(e) => setSettlementTransferRef(e.target.value)}
                          placeholder="مثال: TRF-98742"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* Option 3: Current Account (On Account / Pending Receivable) */}
              <label
                onClick={() => setSettlementMethod('on_account')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  settlementMethod === 'on_account'
                    ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${settlementMethod === 'on_account' ? 'border-amber-400 bg-amber-500' : 'border-slate-600'}`}>
                  {settlementMethod === 'on_account' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 font-bold text-white mb-0.5">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    <span>ترحيل للحساب الجاري (ذمة معلقة على حساب الوكيل)</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    اعتماد ومطابقة الحساب وإقفال الفترة وترحيل الصافي كرصيد ذمة مستحقة على حساب الوكيل ليتم تسويتها لاحقاً.
                  </p>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">ملاحظات التوريد أو التسليم:</label>
              <input
                type="text"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder="أية ملاحظات إضافية بخصوص التسليم أو المطابقة..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalSettlement}
                disabled={isSubmitting}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>تأكيد واعتماد ترحيل المقاصة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Completion View */}
      {completedResult && (
        <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-6 text-center text-slate-100">
            {/* Celebration Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-950/50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">تم اعتماد وترحيل سند المقاصة بنجاح!</h3>
              <p className="text-xs text-slate-400">
                تم قيد السند في سجل الحسابات وتحديث الصناديق وتسوية فترة الحركات للوكيل.
              </p>
            </div>

            {/* Voucher Details Card */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 text-xs space-y-2.5 text-right font-sans">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">رقم سند المقاصة:</span>
                <span className="font-bold font-mono text-cyan-300 text-sm bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800">
                  {completedResult.clearingVoucher.voucherNumber}
                </span>
              </div>

              {completedResult.receiptVoucher && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">رقم سند القبض الرسمي المتولد:</span>
                  <span className="font-bold font-mono text-emerald-300 text-sm bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800">
                    {completedResult.receiptVoucher.voucherNumber}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">الوكيل / المكتب:</span>
                <span className="font-bold text-white">{selectedAgentBranch.name}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">صافي المبلغ المورد:</span>
                <span className="font-black font-mono text-emerald-400 text-base">
                  {formatCurrency(completedResult.clearingVoucher.amount, completedResult.clearingVoucher.currency)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">طريقة التسوية:</span>
                <span className="font-semibold text-cyan-300">
                  {settlementMethod === 'instant_cash'
                    ? 'توريد نقدي فوري مع سند قبض آلي'
                    : settlementMethod === 'bank_transfer'
                    ? `حوالة مصرفية (${settlementBankName || 'بنك'})`
                    : 'ترحيل للحساب الجاري (ذمة مستحقة)'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPreviewPrintVoucher(completedResult.clearingVoucher)}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة ملخص المقاصة (A4)</span>
              </button>

              {completedResult.receiptVoucher && (
                <button
                  type="button"
                  onClick={() => setPreviewPrintVoucher(completedResult.receiptVoucher || null)}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>طباعة سند القبض (RV)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportOrdersCsv}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تصدير كشف الأوامر (CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCompletedResult(null);
                  onClose();
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق والعودة للصندوق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Operation Inspection Popup */}
      {inspectedOp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">تفاصيل الحركة والأمر</h3>
              </div>
              <button
                onClick={() => setInspectedOp(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">رقم العملية / البوليصة:</span>
                  <span className="font-bold font-mono text-cyan-300">{inspectedOp.operationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">التاريخ والوقت:</span>
                  <span className="font-mono text-slate-200">
                    {inspectedOp.date} {inspectedOp.time}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">نوع الحركة:</span>
                  <span className="font-bold text-amber-300">{inspectedOp.typeLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">المبلغ الإجمالي:</span>
                  <span className="font-bold font-mono text-white text-sm">
                    {formatCurrency(inspectedOp.grossAmount, inspectedOp.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">عمولة الوكيل:</span>
                  <span className="font-mono text-amber-400">
                    +{formatCurrency(inspectedOp.branchCommissionAmount, inspectedOp.currency)} ({inspectedOp.branchCommissionRate}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">صافي حصة الإدارة المركزية:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {formatCurrency(inspectedOp.companyShareAmount, inspectedOp.currency)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">البيان والتفاصيل:</span>
                <p className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-200">
                  {inspectedOp.description}
                </p>
              </div>

              {inspectedOp.partyName && (
                <div>
                  <span className="text-slate-400 block mb-1">الأطراف المعنية:</span>
                  <p className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300">
                    {inspectedOp.partyName}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInspectedOp(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Voucher Print Modal Preview */}
      {previewPrintVoucher && previewPrintVoucher.type === 'clearing' ? (
        <ClearingSummaryPrintModal
          voucher={previewPrintVoucher}
          onClose={() => setPreviewPrintVoucher(null)}
        />
      ) : previewPrintVoucher ? (
        <VoucherPrintModal
          voucher={previewPrintVoucher}
          onClose={() => setPreviewPrintVoucher(null)}
        />
      ) : null}
    </div>
  );
};
