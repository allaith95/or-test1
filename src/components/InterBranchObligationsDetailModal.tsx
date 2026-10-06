import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Currency, ObligationType, InterBranchObligation } from '../types';
import {
  X,
  Building2,
  Package,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Coins,
  DollarSign,
  Wallet,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentBranchId: string;
  counterpartyBranchId: string;
  counterpartyBranchName: string;
}

export const InterBranchObligationsDetailModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentBranchId,
  counterpartyBranchId,
  counterpartyBranchName,
}) => {
  const {
    interBranchObligations = [],
    branches = [],
    currentBranch,
    formatCurrency,
    formatNumber,
  } = useOrca();

  // Local Filter States
  const [currencyFilter, setCurrencyFilter] = useState<'all' | Currency>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ObligationType>('all');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'receivable' | 'payable'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Find branch objects for title & display
  const currBranchObj = useMemo(
    () => branches.find((b) => b.id === currentBranchId) || currentBranch,
    [branches, currentBranchId, currentBranch]
  );
  const counterBranchObj = useMemo(
    () => branches.find((b) => b.id === counterpartyBranchId),
    [branches, counterpartyBranchId]
  );

  const displayCounterpartyName =
    counterBranchObj?.name || counterpartyBranchName || 'الفرع المقابل';

  // 1. Raw filtered obligations between these two specific branches
  const rawPairObligations = useMemo(() => {
    if (!isOpen || !currentBranchId || !counterpartyBranchId) return [];

    return interBranchObligations.filter((o) => {
      if (!o || o.clearingStatus !== 'pending') return false;
      const isBetweenBranches =
        (o.debtorBranchId === currentBranchId && o.creditorBranchId === counterpartyBranchId) ||
        (o.debtorBranchId === counterpartyBranchId && o.creditorBranchId === currentBranchId);
      return isBetweenBranches;
    });
  }, [isOpen, interBranchObligations, currentBranchId, counterpartyBranchId]);

  // 2. Computed Financial Totals for KPI Ribbon (Unfiltered by search/type for accurate top metrics)
  const kpiTotals = useMemo(() => {
    let recSyp = 0;
    let paySyp = 0;
    let recUsd = 0;
    let payUsd = 0;

    for (const obl of rawPairObligations) {
      const amt = Number(obl.totalObligationAmount) || 0;
      const isReceivable = obl.creditorBranchId === currentBranchId;

      if (obl.currency === 'USD') {
        if (isReceivable) recUsd += amt;
        else payUsd += amt;
      } else {
        if (isReceivable) recSyp += amt;
        else paySyp += amt;
      }
    }

    recSyp = Math.round(recSyp * 100) / 100;
    paySyp = Math.round(paySyp * 100) / 100;
    recUsd = Math.round(recUsd * 100) / 100;
    payUsd = Math.round(payUsd * 100) / 100;

    const netSyp = Math.round((recSyp - paySyp) * 100) / 100;
    const netUsd = Math.round((recUsd - payUsd) * 100) / 100;

    return {
      totalCount: rawPairObligations.length,
      recSyp,
      paySyp,
      netSyp,
      recUsd,
      payUsd,
      netUsd,
    };
  }, [rawPairObligations, currentBranchId]);

  // 3. User-Filtered & Sorted Obligations for the Table View
  const filteredObligations = useMemo(() => {
    let list = [...rawPairObligations];

    // Currency Filter
    if (currencyFilter !== 'all') {
      list = list.filter((o) => o.currency === currencyFilter);
    }

    // Type Filter
    if (typeFilter !== 'all') {
      list = list.filter((o) => o.obligationType === typeFilter);
    }

    // Direction Filter
    if (directionFilter === 'receivable') {
      list = list.filter((o) => o.creditorBranchId === currentBranchId);
    } else if (directionFilter === 'payable') {
      list = list.filter((o) => o.debtorBranchId === currentBranchId);
    }

    // Search Query (tracking number)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.trackingNumber?.toLowerCase().includes(q) ||
          o.id?.toLowerCase().includes(q) ||
          o.parcelId?.toLowerCase().includes(q)
      );
    }

    // Sort by createdAt DESC (newest first)
    list.sort((a, b) => {
      const timeB = new Date(b.createdAt || 0).getTime();
      const timeA = new Date(a.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return list;
  }, [rawPairObligations, currencyFilter, typeFilter, directionFilter, searchQuery, currentBranchId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">
                  كشف الذمم التبادلية والطرود المعلقة
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-[11px] font-bold text-indigo-300">
                  {currBranchObj?.name || 'فرعنا'} ⟷ {displayCounterpartyName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                كشف تفصيلي بالطرود المسلَّمة والذمم القائمة بانتظار المقاصة والتسوية المالية بين الفرعين
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPI Summary Ribbon */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 shrink-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Parcels */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400">إجمالي الطرود المعلقة</div>
                <div className="text-base font-black text-white font-mono">
                  {formatNumber(kpiTotals.totalCount)} <span className="text-xs font-sans text-slate-400">طرد</span>
                </div>
              </div>
            </div>

            {/* Total Receivable (لنا) */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-emerald-400">مستحق لنا (ذمم بذمته)</div>
                <div className="text-sm font-black text-emerald-300 font-mono truncate">
                  {formatCurrency(kpiTotals.recSyp, 'SYP')}
                  {kpiTotals.recUsd > 0 && (
                    <span className="text-xs text-cyan-400 block font-normal">
                      + {formatCurrency(kpiTotals.recUsd, 'USD')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Total Payable (علينا) */}
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-rose-500/15 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-rose-400">مستحق علينا (لصالحه)</div>
                <div className="text-sm font-black text-rose-300 font-mono truncate">
                  {formatCurrency(kpiTotals.paySyp, 'SYP')}
                  {kpiTotals.payUsd > 0 && (
                    <span className="text-xs text-cyan-400 block font-normal">
                      + {formatCurrency(kpiTotals.payUsd, 'USD')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Net Position (الصافي) */}
            <div
              className={`bg-slate-900/90 border rounded-xl p-3 flex items-center gap-3 shadow-sm ${
                kpiTotals.netSyp >= 0
                  ? 'border-cyan-500/30'
                  : 'border-amber-500/30'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  kpiTotals.netSyp >= 0
                    ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-400'
                    : 'bg-amber-500/15 border border-amber-500/25 text-amber-400'
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-300">
                  صافي المركز المالي ({kpiTotals.netSyp >= 0 ? 'لصالحنا' : 'علينا'})
                </div>
                <div
                  className={`text-sm font-black font-mono truncate ${
                    kpiTotals.netSyp >= 0 ? 'text-cyan-300' : 'text-amber-300'
                  }`}
                >
                  {kpiTotals.netSyp >= 0 ? '+' : ''}
                  {formatCurrency(kpiTotals.netSyp, 'SYP')}
                  {kpiTotals.netUsd !== 0 && (
                    <span className="text-xs text-cyan-400 block font-normal">
                      {kpiTotals.netUsd >= 0 ? '+' : ''}
                      {formatCurrency(kpiTotals.netUsd, 'USD')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative w-48 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم البوليصة..."
                className="w-full pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Currency Filter */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setCurrencyFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currencyFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter('SYP')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currencyFilter === 'SYP'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ل.س
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter('USD')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currencyFilter === 'USD'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                USD ($)
              </button>
            </div>

            {/* Direction Filter */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setDirectionFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  directionFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                كافة الاتجاهات
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('receivable')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  directionFilter === 'receivable'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                لنا فقط
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('payable')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  directionFilter === 'payable'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                علينا فقط
              </button>
            </div>
          </div>

          <div className="text-xs font-bold text-slate-400 font-mono">
            عرض {filteredObligations.length} من أصل {rawPairObligations.length} طرد
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 custom-scrollbar">
          {filteredObligations.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-950/30 rounded-2xl border border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-300">لا توجد ذمم أو طرود معلقة مطابقة للفلاتر</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                تمت تسوية جميع الذمم السابقة بنجاح أو لم يتم تسجيل أي طرود بين هذين الفرعين وفق خيارات البحث الحالية.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden shadow">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3.5">البوليصة</th>
                    <th className="py-3 px-3">النوع</th>
                    <th className="py-3 px-3 text-center">الاتجاه</th>
                    <th className="py-3 px-3 text-left">قيمة البضاعة (COD)</th>
                    <th className="py-3 px-3 text-left">حصة الشحن</th>
                    <th className="py-3 px-3 text-left">رسوم التحويل</th>
                    <th className="py-3 px-3 text-left font-bold">إجمالي الذمة</th>
                    <th className="py-3 px-2 text-center">العملة</th>
                    <th className="py-3 px-3 text-center">حالة الصرف للمرسل</th>
                    <th className="py-3 px-3 text-left">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                  {filteredObligations.map((o) => {
                    const isReceivable = o.creditorBranchId === currentBranchId;
                    const dateFormatted = o.createdAt
                      ? new Date(o.createdAt).toLocaleDateString('ar-SY', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';

                    return (
                      <tr key={o.id} className="hover:bg-slate-800/50 transition-colors">
                        {/* Tracking Number */}
                        <td className="py-3 px-3.5">
                          <span className="font-mono font-bold text-white tracking-wide">
                            {o.trackingNumber || o.parcelId}
                          </span>
                        </td>

                        {/* Obligation Type */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {o.obligationType === 'shipping_only' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/50">
                              أجور شحن فقط
                            </span>
                          ) : o.obligationType === 'cod_and_shipping' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/50">
                              شحن + COD
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/50">
                              تحصيل COD
                            </span>
                          )}
                        </td>

                        {/* Direction (لنا / علينا) */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isReceivable ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-emerald-400" />
                              <span>لنا</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                              <TrendingDown className="w-3 h-3 text-rose-400" />
                              <span>علينا</span>
                            </span>
                          )}
                        </td>

                        {/* COD Amount */}
                        <td className="py-3 px-3 text-left font-mono font-semibold text-slate-300">
                          {o.codAmount && o.codAmount > 0 ? formatNumber(o.codAmount) : '—'}
                        </td>

                        {/* Shipping Share */}
                        <td className="py-3 px-3 text-left font-mono text-slate-400">
                          {o.shippingShareAmount && o.shippingShareAmount > 0
                            ? formatNumber(o.shippingShareAmount)
                            : '—'}
                        </td>

                        {/* Transfer Fee Share */}
                        <td className="py-3 px-3 text-left font-mono text-slate-400">
                          {o.transferFeeShareAmount && o.transferFeeShareAmount > 0
                            ? formatNumber(o.transferFeeShareAmount)
                            : '—'}
                        </td>

                        {/* Total Obligation Amount */}
                        <td className="py-3 px-3 text-left font-mono font-black text-sm whitespace-nowrap">
                          <span className={isReceivable ? 'text-emerald-400' : 'text-rose-400'}>
                            {formatNumber(o.totalObligationAmount)}
                          </span>
                        </td>

                        {/* Currency */}
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              o.currency === 'USD'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {o.currency}
                          </span>
                        </td>

                        {/* Sender Payout Status */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {o.senderPayoutStatus === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>تم الصرف للمرسل</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>قيد انتظار الصرف</span>
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-3 px-3 text-left text-[11px] text-slate-400 whitespace-nowrap font-mono">
                          {dateFormatted}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>
              الفرع المحلي: <strong className="text-white">{currBranchObj?.name}</strong> | الفرع المقابل: <strong className="text-white">{displayCounterpartyName}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            إغلاق الكشف
          </button>
        </div>

      </div>
    </div>
  );
};
