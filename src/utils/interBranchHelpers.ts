import { InterBranchObligation, Branch, Currency } from '../types';

export interface CounterpartyBranchBalance {
  branchId: string;
  branchName: string;
  branchCode: string;
  governorate: string;
  isCentralHub: boolean;

  // Syrian Pound (SYP)
  receivableSyp: number; // لنا بذمته (نحن الدائن)
  payableSyp: number;    // علينا لصالحه (نحن المدين)
  netSyp: number;        // الصافي (receivable - payable)
  pendingParcelsCountSyp: number;

  // US Dollar (USD)
  receivableUsd: number;
  payableUsd: number;
  netUsd: number;
  pendingParcelsCountUsd: number;

  totalPendingCount: number;
}

export interface InterBranchSummary {
  currentBranchId: string;
  isSupervision: boolean;

  // إجماليات الليرة السورية
  totalReceivableSyp: number;
  totalPayableSyp: number;
  netSyp: number;

  // إجماليات الدولار
  totalReceivableUsd: number;
  totalPayableUsd: number;
  netUsd: number;

  // قائمة الفروع المقابلة ذات الأرصدة النشطة
  counterparties: CounterpartyBranchBalance[];
  activeBranchesCount: number;
}

/**
 * دالة مساعدة نقية 100% لحساب أرصدة وصافي الذمم التبادلية بين الفروع.
 * تعمل داخل useMemo وتتميز بسرعة أداء O(n) مع Map داخلي.
 */
export function computeInterBranchBalances(
  obligations: InterBranchObligation[],
  currentBranchId: string,
  branches: Branch[],
  isSupervision: boolean = false
): InterBranchSummary {
  // 1. فلترة أولية للأداء: معالجة الذمم المعلقة فقط
  const pendingObligations = obligations.filter(
    (o) => o && o.clearingStatus === 'pending'
  );

  // خريطة سريعة لبيانات الفروع لتجنب تكرار البحث
  const branchMap = new Map<string, Branch>();
  for (const b of branches) {
    if (b && b.id) {
      branchMap.set(b.id, b);
    }
  }

  const isGlobalSupervision =
    isSupervision &&
    (!currentBranchId ||
      currentBranchId === 'all_branches' ||
      currentBranchId === 'ALL_BRANCHES_SUPERVISION_BRANCH');

  const counterpartyMap = new Map<string, CounterpartyBranchBalance>();

  const getOrCreateCounterparty = (bId: string): CounterpartyBranchBalance => {
    let existing = counterpartyMap.get(bId);
    if (!existing) {
      const bObj = branchMap.get(bId);
      existing = {
        branchId: bId,
        branchName: bObj ? bObj.name : `فرع محذوف (${bId})`,
        branchCode: bObj ? bObj.code : '?',
        governorate: bObj ? bObj.governorate : '—',
        isCentralHub: bObj ? Boolean(bObj.isCentralHub) : false,
        receivableSyp: 0,
        payableSyp: 0,
        netSyp: 0,
        pendingParcelsCountSyp: 0,
        receivableUsd: 0,
        payableUsd: 0,
        netUsd: 0,
        pendingParcelsCountUsd: 0,
        totalPendingCount: 0,
      };
      counterpartyMap.set(bId, existing);
    }
    return existing;
  };

  // 2. معالجة الذمم في مرور واحد O(n)
  for (const obl of pendingObligations) {
    const debtorId = obl.debtorBranchId;
    const creditorId = obl.creditorBranchId;
    const amount = Number(obl.totalObligationAmount) || 0;
    const isUsd = obl.currency === 'USD';

    if (amount <= 0 || !debtorId || !creditorId || debtorId === creditorId) {
      continue;
    }

    if (isGlobalSupervision) {
      // في وضع الإشراف العام الشامل:
      // نجمع لكل فرع في الشبكة ما هو مستحق له وما هو مستحق عليه إجمالاً
      const debtorEntry = getOrCreateCounterparty(debtorId);
      const creditorEntry = getOrCreateCounterparty(creditorId);

      if (isUsd) {
        debtorEntry.payableUsd += amount;
        creditorEntry.receivableUsd += amount;
        debtorEntry.pendingParcelsCountUsd += 1;
        creditorEntry.pendingParcelsCountUsd += 1;
      } else {
        debtorEntry.payableSyp += amount;
        creditorEntry.receivableSyp += amount;
        debtorEntry.pendingParcelsCountSyp += 1;
        creditorEntry.pendingParcelsCountSyp += 1;
      }

      debtorEntry.totalPendingCount += 1;
      creditorEntry.totalPendingCount += 1;
    } else {
      // في وضع الفرع المحدد:
      // نهتم فقط بالذمم التي يكون الفرع الحالي طرفاً فيها
      const isDebtor = debtorId === currentBranchId;
      const isCreditor = creditorId === currentBranchId;

      if (!isDebtor && !isCreditor) {
        continue;
      }

      const counterpartyId = isDebtor ? creditorId : debtorId;
      const entry = getOrCreateCounterparty(counterpartyId);

      if (isCreditor) {
        // الفرع الحالي هو الدائن ◄ المبلغ مستحق لنا (Receivable)
        if (isUsd) {
          entry.receivableUsd += amount;
          entry.pendingParcelsCountUsd += 1;
        } else {
          entry.receivableSyp += amount;
          entry.pendingParcelsCountSyp += 1;
        }
      } else {
        // الفرع الحالي هو المدين ◄ المبلغ مستحق علينا (Payable)
        if (isUsd) {
          entry.payableUsd += amount;
          entry.pendingParcelsCountUsd += 1;
        } else {
          entry.payableSyp += amount;
          entry.pendingParcelsCountSyp += 1;
        }
      }

      entry.totalPendingCount += 1;
    }
  }

  // 3. احتساب الصافي وترتيب قائمة الفروع المقابلة
  let totalReceivableSyp = 0;
  let totalPayableSyp = 0;
  let totalReceivableUsd = 0;
  let totalPayableUsd = 0;
  let activeBranchesCount = 0;

  const counterparties: CounterpartyBranchBalance[] = [];

  for (const item of counterpartyMap.values()) {
    // تقريب الكسور لمنع شوائب الفاصلة العائمة
    item.receivableSyp = Math.round(item.receivableSyp * 100) / 100;
    item.payableSyp = Math.round(item.payableSyp * 100) / 100;
    item.netSyp = Math.round((item.receivableSyp - item.payableSyp) * 100) / 100;

    item.receivableUsd = Math.round(item.receivableUsd * 100) / 100;
    item.payableUsd = Math.round(item.payableUsd * 100) / 100;
    item.netUsd = Math.round((item.receivableUsd - item.payableUsd) * 100) / 100;

    const hasActivity =
      item.receivableSyp > 0 ||
      item.payableSyp > 0 ||
      item.receivableUsd > 0 ||
      item.payableUsd > 0 ||
      item.totalPendingCount > 0;

    if (hasActivity) {
      activeBranchesCount += 1;
    }

    if (!isGlobalSupervision) {
      totalReceivableSyp += item.receivableSyp;
      totalPayableSyp += item.payableSyp;
      totalReceivableUsd += item.receivableUsd;
      totalPayableUsd += item.payableUsd;
    }

    counterparties.push(item);
  }

  // في وضع الإشراف العام، الإجماليات تمثل إجمالي حجم الذمم المعلقة عبر كامل القطر
  if (isGlobalSupervision) {
    for (const obl of pendingObligations) {
      const amt = Number(obl.totalObligationAmount) || 0;
      if (amt <= 0) continue;
      if (obl.currency === 'USD') {
        totalReceivableUsd += amt;
        totalPayableUsd += amt;
      } else {
        totalReceivableSyp += amt;
        totalPayableSyp += amt;
      }
    }
  }

  // ترتيب تنازلي حسب عدد الطرود المعلقة ثم قيمة الذمة الإجمالية
  counterparties.sort((a, b) => {
    if (b.totalPendingCount !== a.totalPendingCount) {
      return b.totalPendingCount - a.totalPendingCount;
    }
    const valB = Math.abs(b.netSyp) + Math.abs(b.netUsd * 15000);
    const valA = Math.abs(a.netSyp) + Math.abs(a.netUsd * 15000);
    return valB - valA;
  });

  totalReceivableSyp = Math.round(totalReceivableSyp * 100) / 100;
  totalPayableSyp = Math.round(totalPayableSyp * 100) / 100;
  totalReceivableUsd = Math.round(totalReceivableUsd * 100) / 100;
  totalPayableUsd = Math.round(totalPayableUsd * 100) / 100;

  const netSyp = Math.round((totalReceivableSyp - totalPayableSyp) * 100) / 100;
  const netUsd = Math.round((totalReceivableUsd - totalPayableUsd) * 100) / 100;

  return {
    currentBranchId,
    isSupervision,
    totalReceivableSyp,
    totalPayableSyp,
    netSyp,
    totalReceivableUsd,
    totalPayableUsd,
    netUsd,
    counterparties,
    activeBranchesCount,
  };
}

/**
 * دالة مساعدة لتنسيق تسمية الفرع المقابل مع الكود والمحافظة
 */
export function formatBranchLabel(branch: CounterpartyBranchBalance): string {
  if (!branch) return 'فرع غير معروف';
  if (branch.branchCode && branch.branchCode !== '?') {
    return `${branch.branchName} (${branch.branchCode})`;
  }
  return branch.branchName || 'فرع غير محدد';
}
