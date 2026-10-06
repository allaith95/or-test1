import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  RefreshCw,
  Scale,
  DollarSign,
  Coins,
  Check,
  HelpCircle,
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { Parcel, Currency } from '../types';
import { calculateParcelReceivable, ParcelReceivableBreakdown } from '../utils/settlementMath';
import {
  blockNonAmountKeys,
  sanitizeDecimal,
} from '../utils/numberSanitizer';
import { useOrca } from '../context/OrcaContext';

export interface AuditTestResult {
  id: string;
  name: string;
  category: 'sum' | 'cash' | 'integrity' | 'currency';
  expected: string;
  actual: string;
  passed: boolean;
  notes: string;
}

export interface SettlementAuditTestUnitProps {
  manifestParcels: Parcel[];
  deliveryStatusMap: Record<string, 'delivered' | 'returned'>;
  expectedGrossSyp: number;
  expectedGrossUsd: number;
  courierCommissionSyp: number;
  expectedNetSyp: number;
  expectedNetUsd: number;
  actualHandedSyp: number;
  actualHandedUsd: number;
  onActualHandedSypChange: (value: number) => void;
  onActualHandedUsdChange: (value: number) => void;
  discrepancyNotes?: string;
  onDiscrepancyNotesChange?: (notes: string) => void;
}

export const SettlementAuditTestUnit: React.FC<SettlementAuditTestUnitProps> = ({
  manifestParcels,
  deliveryStatusMap,
  expectedGrossSyp,
  expectedGrossUsd,
  courierCommissionSyp,
  expectedNetSyp,
  expectedNetUsd,
  actualHandedSyp,
  actualHandedUsd,
  onActualHandedSypChange,
  onActualHandedUsdChange,
  discrepancyNotes = '',
  onDiscrepancyNotesChange,
}) => {
  const { formatCurrency, formatNumber } = useOrca();
  const [isTestExpanded, setIsTestExpanded] = useState<boolean>(true);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [lastAuditTimestamp, setLastAuditTimestamp] = useState<string>(
    new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // 1. Calculate itemized totals parcel by parcel independently for cross-checking
  const auditParcelsData = useMemo(() => {
    let itemizedGrossSyp = 0;
    let itemizedGrossUsd = 0;
    let itemizedFreightSyp = 0;
    let itemizedFreightUsd = 0;
    let itemizedCodSyp = 0;
    let itemizedCodUsd = 0;
    let itemizedTransferFeeSyp = 0;
    let itemizedTransferFeeUsd = 0;

    let deliveredCount = 0;
    let returnedCount = 0;

    const breakdownList: {
      parcel: Parcel;
      receivable: ParcelReceivableBreakdown;
      status: 'delivered' | 'returned';
    }[] = [];

    manifestParcels.forEach((parcel) => {
      const status = deliveryStatusMap[parcel.id] || 'delivered';
      const receivable = calculateParcelReceivable(parcel);
      breakdownList.push({ parcel, receivable, status });

      if (status === 'delivered') {
        deliveredCount += 1;
        if (receivable.currency === 'USD') {
          itemizedGrossUsd += receivable.totalReceivable;
          itemizedFreightUsd += receivable.freightDue;
          itemizedCodUsd += receivable.codDue;
          itemizedTransferFeeUsd += receivable.transferFeeDue;
        } else {
          itemizedGrossSyp += receivable.totalReceivable;
          itemizedFreightSyp += receivable.freightDue;
          itemizedCodSyp += receivable.codDue;
          itemizedTransferFeeSyp += receivable.transferFeeDue;
        }
      } else {
        returnedCount += 1;
      }
    });

    return {
      itemizedGrossSyp,
      itemizedGrossUsd,
      itemizedFreightSyp,
      itemizedFreightUsd,
      itemizedCodSyp,
      itemizedCodUsd,
      itemizedTransferFeeSyp,
      itemizedTransferFeeUsd,
      deliveredCount,
      returnedCount,
      breakdownList,
    };
  }, [manifestParcels, deliveryStatusMap]);

  // 2. Discrepancy calculations
  const diffSyp = actualHandedSyp - expectedNetSyp;
  const diffUsd = actualHandedUsd - expectedNetUsd;
  const hasDiscrepancy = diffSyp !== 0 || diffUsd !== 0;

  // Itemized sum vs gross sum check
  const isItemizedSumValidSyp = auditParcelsData.itemizedGrossSyp === expectedGrossSyp;
  const isItemizedSumValidUsd = auditParcelsData.itemizedGrossUsd === expectedGrossUsd;
  const isParcelsSumMatch = isItemizedSumValidSyp && isItemizedSumValidUsd;

  // 3. Test Suite definitions
  const testResults: AuditTestResult[] = useMemo(() => {
    return [
      {
        id: 'test-parcel-sum',
        name: 'مطابقة مجموع بنود الطرود الفردية مع الإجمالي العام',
        category: 'sum',
        expected: `${formatCurrency(expectedGrossSyp, 'SYP')}${expectedGrossUsd > 0 ? ` + ${formatCurrency(expectedGrossUsd, 'USD')}` : ''}`,
        actual: `${formatCurrency(auditParcelsData.itemizedGrossSyp, 'SYP')}${
          auditParcelsData.itemizedGrossUsd > 0 ? ` + ${formatCurrency(auditParcelsData.itemizedGrossUsd, 'USD')}` : ''
        }`,
        passed: isParcelsSumMatch,
        notes: isParcelsSumMatch
          ? `تم فحص مجموع ${auditParcelsData.deliveredCount} طرد مسلّم، والتطابق بنسبة 100% بدون أي فارق.`
          : 'يوجد خطأ حسابي أو اختلال في تجميع قيم الطرود الفردية!',
      },
      {
        id: 'test-net-formula',
        name: 'معادلة صافي توريد الصندوق (المقبوضات - الاقتطاعات)',
        category: 'integrity',
        expected: formatCurrency(expectedNetSyp, 'SYP'),
        actual: formatCurrency(expectedGrossSyp - courierCommissionSyp, 'SYP'),
        passed: expectedNetSyp === expectedGrossSyp - courierCommissionSyp,
        notes:
          courierCommissionSyp > 0
            ? `خصم عمولة الموزع (${formatCurrency(courierCommissionSyp, 'SYP')}) سليم.`
            : 'تصفية بدون أي اقتطاع عمولة (التوريد 100% كامل للصندوق).',
      },
      {
        id: 'test-handed-cash-syp',
        name: 'مطابقة النقد المسلّم بالليرة السورية مع صافي الطرود',
        category: 'cash',
        expected: formatCurrency(expectedNetSyp, 'SYP'),
        actual: formatCurrency(actualHandedSyp, 'SYP'),
        passed: diffSyp === 0,
        notes:
          diffSyp === 0
            ? 'النقد المسلّم مطابق تماماً للمبلغ المطلوب بالليرة السورية (فارق 0 ل.س).'
            : diffSyp < 0
            ? `يوجد عجز نقدية بقيمة (${formatCurrency(Math.abs(diffSyp), 'SYP')}) نقص في تسليم الموزع.`
            : `يوجد فائض نقدية بقيمة (${formatCurrency(diffSyp, 'SYP')}) زيادة عن صافي الطرود.`,
      },
      ...(expectedNetUsd > 0 || actualHandedUsd > 0
        ? [
            {
              id: 'test-handed-cash-usd',
              name: 'مطابقة النقد المسلّم بالدولار الأمريكي مع صافي الطرود',
              category: 'currency' as const,
              expected: formatCurrency(expectedNetUsd, 'USD'),
              actual: formatCurrency(actualHandedUsd, 'USD'),
              passed: diffUsd === 0,
              notes:
                diffUsd === 0
                  ? 'المبلغ بالدولار مطابق تماماً للمطلوب.'
                  : diffUsd < 0
                  ? `عجز بالدولار بقيمة (${formatCurrency(Math.abs(diffUsd), 'USD')}).`
                  : `فائض بالدولار بقيمة (${formatCurrency(diffUsd, 'USD')}).`,
            },
          ]
        : []),
      {
        id: 'test-parcel-count',
        name: 'توازن تعداد الشحنات (مسلّم + مرتجع = إجمالي الجولة)',
        category: 'integrity',
        expected: `${manifestParcels.length} طرد`,
        actual: `${auditParcelsData.deliveredCount + auditParcelsData.returnedCount} طرد`,
        passed: auditParcelsData.deliveredCount + auditParcelsData.returnedCount === manifestParcels.length,
        notes: `مسلّم: ${auditParcelsData.deliveredCount} | مرتجع: ${auditParcelsData.returnedCount} من إجمالي ${manifestParcels.length} طرد.`,
      },
    ];
  }, [
    expectedGrossSyp,
    expectedGrossUsd,
    auditParcelsData,
    isParcelsSumMatch,
    expectedNetSyp,
    courierCommissionSyp,
    actualHandedSyp,
    diffSyp,
    expectedNetUsd,
    actualHandedUsd,
    diffUsd,
    manifestParcels.length,
  ]);

  const allTestsPassed = testResults.every((t) => t.passed);
  const passedTestsCount = testResults.filter((t) => t.passed).length;

  // Run audit simulation / refresh
  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      setLastAuditTimestamp(
        new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 300);
  };

  // Quick action: auto-match handed cash with expected net
  const handleAutoMatch = () => {
    onActualHandedSypChange(expectedNetSyp);
    onActualHandedUsdChange(expectedNetUsd);
  };

  return (
    <div
      id="settlement-audit-test-unit"
      className="bg-slate-950 border-2 rounded-2xl overflow-hidden shadow-xl transition-all duration-200 border-slate-800"
    >
      {/* ========================================================================= */}
      {/* 1. AUDIT UNIT HEADER */}
      {/* ========================================================================= */}
      <div className="p-3.5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
              allTestsPassed
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
            }`}
          >
            {allTestsPassed ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                <span>وحدة الاختبار والمطابقة الحسابية المخصصة</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Audit Engine
                </span>
              </h4>
            </div>
            <p className="text-[10px] text-slate-400">
              مطابقة فورية للمبالغ المسلّمة من الموزع مع صافي الطرود وكشف الفروقات
            </p>
          </div>
        </div>

        {/* Header Controls & Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-re-run-audit"
            onClick={handleRunAudit}
            disabled={isAuditing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold transition cursor-pointer active:scale-95"
            title="إعادة إجراء الاختبار والتدقيق الحسابي الفوري"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isAuditing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">إعادة الاختبار</span>
          </button>

          <button
            type="button"
            id="btn-toggle-audit-details"
            onClick={() => setIsTestExpanded(!isTestExpanded)}
            className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 transition cursor-pointer"
          >
            {isTestExpanded ? 'إخفاء التفاصيل' : 'عرض الاختبارات'}
          </button>
        </div>
      </div>

      <div className="p-3.5 space-y-3.5">
        {/* ========================================================================= */}
        {/* 2. IMMEDIATE REAL-TIME ALERT BANNER IF DISCREPANCY OR ERROR DETECTED */}
        {/* ========================================================================= */}
        {hasDiscrepancy ? (
          <div
            id="audit-discrepancy-alert"
            className="p-3.5 bg-gradient-to-r from-rose-950/90 via-red-950/70 to-slate-950 border-2 border-rose-500/80 rounded-xl space-y-2.5 shadow-lg animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-600/30 border border-rose-500 text-rose-300 flex items-center justify-center shrink-0 mt-0.5 animate-bounce">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-black text-rose-200 flex items-center gap-2">
                    <span>تنبيه فوري: تم رصد فرق حسابي بين المبالغ المسلمة وصافي الطرود!</span>
                  </div>
                  <div className="text-[11px] text-rose-300/90 mt-0.5 leading-relaxed">
                    المبلغ المطلوب توريده من واقع الطرود المسلمة لا يطابق المبلغ النقدي المسلّم فعلياً من يد الموزع.
                  </div>
                </div>
              </div>

              <div className="px-2.5 py-1 rounded-lg bg-rose-900/60 border border-rose-500/60 text-right shrink-0">
                <div className="text-[10px] text-rose-300 font-bold">
                  {diffSyp < 0 ? 'عجز نقدية (نقص)' : 'فائض نقدية (زيادة)'}
                </div>
                <div className="text-sm font-mono font-black text-white">
                  {diffSyp > 0 ? '+' : ''}
                  {formatCurrency(diffSyp, 'SYP')}
                </div>
              </div>
            </div>

            {/* Detailed Discrepancy Breakdown Table */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-rose-900/50 text-xs">
              <div className="p-2 bg-slate-950/80 rounded-lg border border-rose-900/40">
                <div className="text-[10px] text-slate-400">صافي الطرود المدفوعة (المطلوب):</div>
                <div className="font-mono font-bold text-cyan-300 mt-0.5">
                  {formatCurrency(expectedNetSyp, 'SYP')}
                </div>
              </div>
              <div className="p-2 bg-slate-950/80 rounded-lg border border-rose-900/40">
                <div className="text-[10px] text-slate-400">المبلغ المسلّم فعلياً من الموزع:</div>
                <div className="font-mono font-bold text-amber-300 mt-0.5">
                  {formatCurrency(actualHandedSyp, 'SYP')}
                </div>
              </div>
              <div className="p-2 bg-rose-950/50 rounded-lg border border-rose-600/40">
                <div className="text-[10px] text-rose-300 font-bold">الفارق المحاسبي:</div>
                <div className="font-mono font-black text-rose-300 mt-0.5 flex items-center gap-1">
                  {diffSyp < 0 ? (
                    <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>
                    {diffSyp > 0 ? '+' : ''}
                    {formatCurrency(diffSyp, 'SYP')}
                  </span>
                </div>
              </div>
            </div>

            {/* Optional Discrepancy Justification */}
            {onDiscrepancyNotesChange && (
              <div className="pt-1">
                <label className="block text-[10px] font-bold text-rose-300 mb-1">
                  سبب الفارق المحاسبي أو التبرير (مطلوب لتوثيق السند):
                </label>
                <input
                  type="text"
                  value={discrepancyNotes}
                  onChange={(e) => onDiscrepancyNotesChange(e.target.value)}
                  placeholder="مثال: خصم عمولة وقود إضافية بموافقة الإدارة، أو نقص سيتم توريده غداً..."
                  className="w-full bg-slate-950 border border-rose-500/60 focus:border-rose-400 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-rose-400/50 focus:outline-none"
                />
              </div>
            )}
          </div>
        ) : (
          /* Balanced Success Banner */
          <div
            id="audit-balanced-banner"
            className="p-3 bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-slate-950 border border-emerald-500/50 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm"
          >
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold block">المطابقة الحسابية مكتملة وناجحة (100% متطابق)</span>
                <span className="text-[10px] text-emerald-400/80">
                  إجمالي المبالغ المسلّمة يطابق تماماً صافي مستحقات الطرود المدفوعة بالجولة (الفارق: 0 ل.س).
                </span>
              </div>
            </div>
            <span className="px-2 py-1 rounded-lg text-[10px] font-black font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
              فارق = 0 ل.س
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. PHYSICAL CASH HANDED OVER INPUT WORKSTATION */}
        {/* ========================================================================= */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>تسجيل النقد المستلم فعلياً من الموزع (الجرد الفعلي للصندوق):</span>
            </div>

            {/* Quick 100% Auto-Match Button */}
            <button
              type="button"
              id="btn-auto-match-100"
              onClick={handleAutoMatch}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
              title="تعبئة المبلغ المسلّم بالمبلغ الصافي المطلوب تلقائياً عند التطابق التام"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>مطابقة تامة 100%</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Handed SYP Input */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                المبلغ المسلّم نقداً (ليرة سورية SYP):
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="input-actual-handed-syp"
                  step="any"
                  value={actualHandedSyp === 0 ? '' : actualHandedSyp}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={blockNonAmountKeys}
                  onChange={(e) => {
                    const clean = sanitizeDecimal(e.target.value);
                    onActualHandedSypChange(clean === '' ? 0 : Number(clean) || 0);
                  }}
                  placeholder="أدخل المبلغ المسلّم"
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm font-mono font-black text-white focus:outline-none transition ${
                    diffSyp === 0
                      ? 'border-emerald-500/70 focus:border-emerald-400'
                      : 'border-rose-500 focus:border-rose-400 text-rose-200'
                  }`}
                />
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                  ل.س
                </span>
              </div>
            </div>

            {/* Handed USD Input (Always available or prominent if USD parcels exist) */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                المبلغ المسلّم نقداً (دولار أمريكي USD):
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="input-actual-handed-usd"
                  step="any"
                  value={actualHandedUsd === 0 ? '' : actualHandedUsd}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={blockNonAmountKeys}
                  onChange={(e) => {
                    const clean = sanitizeDecimal(e.target.value);
                    onActualHandedUsdChange(clean === '' ? 0 : Number(clean) || 0);
                  }}
                  placeholder="أدخل المبلغ المسلّم"
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm font-mono font-black text-white focus:outline-none transition ${
                    diffUsd === 0
                      ? 'border-emerald-500/70 focus:border-emerald-400'
                      : 'border-rose-500 focus:border-rose-400 text-rose-200'
                  }`}
                />
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 pointer-events-none">
                  USD $
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. EXPANDABLE DETAILED AUDIT TEST SUITE (5 TEST CHECKS) */}
        {/* ========================================================================= */}
        {isTestExpanded && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="font-bold flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-cyan-400" />
                <span>نتائج فحوصات وحدة الاختبار الحسابية ({passedTestsCount} من {testResults.length} ناجحة):</span>
              </span>
              <span className="text-slate-500 font-mono">آخر فحص: {lastAuditTimestamp}</span>
            </div>

            <div className="space-y-1.5">
              {testResults.map((test) => (
                <div
                  key={test.id}
                  id={test.id}
                  className={`p-2.5 rounded-xl border transition-all text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                    test.passed
                      ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                      : 'bg-rose-950/40 border-rose-500/60 text-rose-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        test.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {test.passed ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="font-bold text-white text-[11px]">{test.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{test.notes}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <div className="text-right text-[10px] font-mono">
                      <span className="text-slate-400">المطلوب: {test.expected}</span>
                      <span className="mx-1 text-slate-600">|</span>
                      <span className={test.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-black'}>
                        الفعلي: {test.actual}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        test.passed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {test.passed ? 'مطابق' : 'فارق'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
