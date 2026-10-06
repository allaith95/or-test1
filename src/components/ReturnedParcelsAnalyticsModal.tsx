import React, { useMemo, useState } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  RotateCcw,
  X,
  PieChart,
  BarChart3,
  Calendar,
  AlertTriangle,
  Users,
  DollarSign,
  TrendingDown,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  BadgeAlert,
  Wallet,
  ArrowRightLeft,
  Phone,
  Search,
} from 'lucide-react';
import { Parcel } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ReturnedParcelsAnalyticsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    parcels,
    branches,
    currentBranch,
    currentUser,
    formatCurrency,
    auditLogs,
    settleReturnDebt,
    cancelPreDeliveryReturn,
  } = useOrca();

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'overview' | 'abandoned' | 'debts' | 'pre_delivery'>('overview');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // All returned parcels relevant to the current branch / super admin
  const branchReturnedParcels = useMemo(() => {
    return parcels.filter((p) => {
      const isReturnedState =
        p.handlingStatus === 'returned' ||
        p.handlingStatus === 'returned_received_at_branch' ||
        p.handlingStatus === 'return_initiated' ||
        p.handlingStatus === 'returning_to_origin' ||
        p.handlingStatus === 'returned_to_origin' ||
        p.handlingStatus === 'returned_to_sender' ||
        Boolean(p.isReverseShipment);

      if (!isReturnedState) return false;

      if (isSuperAdmin || !currentBranch?.id) return true;
      return (
        p.currentLocationBranchId === currentBranch.id ||
        p.destinationHubId === currentBranch.id ||
        p.receivedBackAtBranchId === currentBranch.id ||
        p.originHubId === currentBranch.id
      );
    });
  }, [parcels, currentBranch?.id, isSuperAdmin]);

  // Filtered by time frame
  const filteredParcels = useMemo(() => {
    return branchReturnedParcels.filter((p) => {
      const returnDate = p.returnedAt || p.createdAt || '';
      if (timeFilter === 'today') return returnDate.startsWith(todayStr);
      if (timeFilter === 'week') return returnDate >= oneWeekAgo;
      if (timeFilter === 'month') return returnDate >= oneMonthAgo;
      return true;
    });
  }, [branchReturnedParcels, timeFilter, todayStr, oneWeekAgo, oneMonthAgo]);

  // KPIs
  const stats = useMemo(() => {
    const total = filteredParcels.length;
    const pendingWithCourier = filteredParcels.filter((p) => p.handlingStatus === 'returned').length;
    const receivedAtBranch = filteredParcels.filter((p) => p.handlingStatus === 'returned_received_at_branch').length;
    const reverseToOrigin = filteredParcels.filter((p) => p.handlingStatus === 'returning_to_origin' || p.handlingStatus === 'returned_to_origin').length;
    const deliveredToSender = filteredParcels.filter((p) => p.handlingStatus === 'returned_to_sender').length;

    let totalCodBlockedSyp = 0;
    let totalReturnShippingSyp = 0;

    filteredParcels.forEach((p) => {
      if (p.paymentType === 'cod' && (p.codAmount || 0) > 0) {
        totalCodBlockedSyp += p.codAmount;
      }
      totalReturnShippingSyp += p.returnShippingCost || 0;
    });

    return {
      total,
      pendingWithCourier,
      receivedAtBranch,
      reverseToOrigin,
      deliveredToSender,
      totalCodBlockedSyp,
      totalReturnShippingSyp,
    };
  }, [filteredParcels]);

  // A1: Overdue and Abandoned Returned Parcels (مرتجعات معلقة / مهجورة بفرع الأصل)
  const abandonedAndOverdueParcels = useMemo(() => {
    return branchReturnedParcels.filter((p) => {
      if (p.handlingStatus !== 'returned_to_origin') return false;
      const isStatusOverdueOrAbandoned = p.returnPickupStatus === 'overdue' || p.returnPickupStatus === 'abandoned';
      const isPastDeadline = p.returnPickupDeadline && new Date(p.returnPickupDeadline).getTime() < Date.now();
      return isStatusOverdueOrAbandoned || isPastDeadline;
    });
  }, [branchReturnedParcels]);

  // A2: Return Debts (ذمم أجور الشحن العكسي المرفوضة من المرسلين)
  const returnDebtsParcels = useMemo(() => {
    return branchReturnedParcels.filter((p) => {
      return p.returnPaymentStatus === 'refused' && (p.returnDebtAmount || 0) > 0;
    });
  }, [branchReturnedParcels]);

  const totalReturnDebtsSyp = useMemo(() => {
    return returnDebtsParcels.reduce((sum, p) => sum + (p.returnDebtAmount || 0), 0);
  }, [returnDebtsParcels]);

  // Part B: Pre-delivery Returns (مرتجعات مُعلنة قبل التسليم)
  const preDeliveryReturns = useMemo(() => {
    return branchReturnedParcels.filter((p) => p.handlingStatus === 'return_initiated');
  }, [branchReturnedParcels]);

  // Chart 1: Return Reasons Breakdown
  const reasonsBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredParcels.forEach((p) => {
      const reason = p.returnReason || p.returnInitiatedReason || 'سبب غير محدد';
      counts[reason] = (counts[reason] || 0) + 1;
    });

    const total = filteredParcels.length || 1;
    const colors = ['#f43f5e', '#fb923c', '#facc15', '#38bdf8', '#a855f7', '#94a3b8'];

    return Object.entries(counts)
      .map(([reason, count], idx) => ({
        reason,
        count,
        percentage: (count / total) * 100,
        color: colors[idx % colors.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredParcels]);

  // Chart 2: Returns per Courier
  const couriersBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; totalCod: number }> = {};
    filteredParcels.forEach((p) => {
      const courierName = p.returnedByUserName || p.assignedCourierName || 'غير محدد';
      if (!counts[courierName]) {
        counts[courierName] = { count: 0, totalCod: 0 };
      }
      counts[courierName].count += 1;
      if (p.paymentType === 'cod') {
        counts[courierName].totalCod += p.codAmount || 0;
      }
    });

    const maxCount = Math.max(...Object.values(counts).map((c) => c.count), 1);

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalCod: data.totalCod,
        percentage: (data.count / maxCount) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredParcels]);

  // Audit Logs for Returns
  const returnAuditLogs = useMemo(() => {
    return auditLogs
      .filter((l) => l.action.includes('مرتجع') || l.action.includes('إرجاع') || l.details.includes('مرتجع') || l.details.includes('عكسي'))
      .slice(0, 10);
  }, [auditLogs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in font-['Cairo',sans-serif]">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>لوحة تقارير وإحصائيات المرتجعات الشاملة</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                  {currentBranch?.name || 'كافة الفروع'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                تحليل مسارات الإرجاع، مهل الاستلام (A1)، ذمم الشحن العكسي (A2)، ومرتجعات ما قبل التسليم (B)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Time Filter Tabs (shown on overview) */}
            {activeTab === 'overview' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex items-center gap-1 text-[11px] font-bold">
                {(['all', 'today', 'week', 'month'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeFilter(t)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      timeFilter === t
                        ? 'bg-rose-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t === 'all' ? 'الكل' : t === 'today' ? 'اليوم' : t === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>نظرة عامة وإحصائيات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('abandoned')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'abandoned'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
            }`}
          >
            <BadgeAlert className="w-3.5 h-3.5" />
            <span>مرتجعات معلقة / مهجورة ({abandonedAndOverdueParcels.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('debts')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'debts'
                ? 'bg-rose-700 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>تقرير ذمم المرتجعات ({returnDebtsParcels.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pre_delivery')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'pre_delivery'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>مرتجعات قبل التسليم ({preDeliveryReturns.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Row 1: KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">إجمالي المرتجعات</span>
                  <span className="text-2xl font-black text-white font-mono">{stats.total}</span>
                  <span className="text-[10px] text-slate-500 block mt-1">طرد خلال الفترة المحددة</span>
                </div>

                <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-amber-300 block mb-1">بانتظار الاستلام (مع الموزع)</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">{stats.pendingWithCourier}</span>
                  <span className="text-[10px] text-amber-400/70 block mt-1">في عهدة الموزع الميدانية</span>
                </div>

                <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-blue-300 block mb-1">مستلمة فعلياً بالفرع</span>
                  <span className="text-2xl font-black text-blue-400 font-mono">{stats.receivedAtBranch}</span>
                  <span className="text-[10px] text-blue-400/70 block mt-1">سقطت عهدة الموزع عنها</span>
                </div>

                <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-emerald-300 block mb-1">شحن عكسي لفرع الأصل</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">{stats.reverseToOrigin}</span>
                  <span className="text-[10px] text-emerald-400/70 block mt-1">
                    تكلفة: {formatCurrency(stats.totalReturnShippingSyp, 'SYP')}
                  </span>
                </div>
              </div>

              {/* Row 2: Charts and Visuals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chart 1: Reasons Breakdown */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-rose-400" />
                    <span>أسباب الإرجاع الأكثر شيوعاً</span>
                  </h3>

                  {reasonsBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">لا توجد بيانات مرتجعات مسجلة للفترة</p>
                  ) : (
                    <div className="space-y-2.5">
                      {reasonsBreakdown.map((r) => (
                        <div key={r.reason} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-200">{r.reason}</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {r.count} طرد ({r.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, Math.max(3, r.percentage))}%`,
                                backgroundColor: r.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chart 2: Returns per Courier */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    <span>أعلى الموزعين تسجيلاً للمرتجعات</span>
                  </h3>

                  {couriersBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">لا توجد بيانات مرتجعات موزعين</p>
                  ) : (
                    <div className="space-y-2.5">
                      {couriersBreakdown.map((c) => (
                        <div key={c.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-200 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {c.name}
                            </span>
                            <span className="font-mono text-[11px] text-amber-300">
                              {c.count} طرد {c.totalCod > 0 && `(${formatCurrency(c.totalCod, 'SYP')})`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, Math.max(5, c.percentage))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Return Lifecycle Audit Trail */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>سجل التدقيق والرقابة للمرتجعات (Audit Trail)</span>
                </h3>

                <div className="space-y-2">
                  {returnAuditLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">لا توجد سجلات تدقيق سابقة للإرجاع</p>
                  ) : (
                    returnAuditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-rose-300 block">{log.action}</span>
                          <p className="text-[11px] text-slate-300">{log.details}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 mr-3">
                          {new Date(log.timestamp).toLocaleTimeString('ar-SY', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: A1 - ABANDONED AND OVERDUE PARCELS */}
          {activeTab === 'abandoned' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-amber-500/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>سياسة مهل استلام الطرود المرتجعة بفرع الأصل</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    مهلة الاستلام الرسمية 30 يوماً من تاريخ الوصول (بعدها تصبح الشحنة متأخرة overdue)، وبعد 60 يوماً تُصنف كشحنة مهجورة (abandoned) وتُنقل لمخزون المرتجعات المعلقة.
                  </p>
                </div>
                <div className="text-left shrink-0 mr-3">
                  <span className="text-lg font-black text-amber-400 font-mono">{abandonedAndOverdueParcels.length}</span>
                  <span className="text-[10px] text-slate-400 block">طرد متأخر / مهجور</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3 font-semibold">رقم التتبع</th>
                      <th className="py-2.5 px-3 font-semibold">المرسل (التاجر)</th>
                      <th className="py-2.5 px-3 font-semibold">تاريخ الوصول للأصل</th>
                      <th className="py-2.5 px-3 font-semibold">مهلة الاستلام</th>
                      <th className="py-2.5 px-3 font-semibold">الحالة الرقابية</th>
                      <th className="py-2.5 px-3 font-semibold text-center">الاتصال</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {abandonedAndOverdueParcels.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500 text-xs">
                          ممتاز! لا توجد طرود مرتجعة متأخرة أو مهجورة حالياً في مستودع الأصل
                        </td>
                      </tr>
                    ) : (
                      abandonedAndOverdueParcels.map((parcel) => {
                        const isAbandoned = parcel.returnPickupStatus === 'abandoned';
                        return (
                          <tr key={parcel.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-white" dir="ltr">
                              {parcel.trackingNumber}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-emerald-300">{parcel.sender.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{parcel.sender.phone}</div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {parcel.receivedBackAt ? new Date(parcel.receivedBackAt).toLocaleDateString('ar-SY') : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {parcel.returnPickupDeadline ? new Date(parcel.returnPickupDeadline).toLocaleDateString('ar-SY') : '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              {isAbandoned ? (
                                <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-900/40 text-rose-300 border border-rose-600">
                                  🛑 مهجور (&gt; 60 يوم)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  ⚠️ متأخر عن المهلة (&gt; 30 يوم)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <a
                                href={`tel:${parcel.sender.phone}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition"
                              >
                                <Phone className="w-3 h-3 text-emerald-400" />
                                <span>اتصال</span>
                              </a>
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

          {/* TAB 3: A2 - RETURN DEBTS REPORT */}
          {activeTab === 'debts' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-rose-500/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-rose-400" />
                    <span>تقرير ذمم الشحن العكسي المعلقة على المرسلين (A2)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    الشحنات المرتجعة التي سُلّمت لمرسليها مع رفض تسديد أجور الشحن العكسي، وسُجلت كذمة معلقة بحساب المرسل.
                  </p>
                </div>
                <div className="text-left shrink-0 mr-3">
                  <span className="text-lg font-black text-rose-400 font-mono">
                    {formatCurrency(totalReturnDebtsSyp, 'SYP')}
                  </span>
                  <span className="text-[10px] text-slate-400 block">إجمالي الذمم المطلوبة</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3 font-semibold">رقم التتبع</th>
                      <th className="py-2.5 px-3 font-semibold">المرسل (المدين)</th>
                      <th className="py-2.5 px-3 font-semibold">فرع الأصل المسجل</th>
                      <th className="py-2.5 px-3 font-semibold">مبلغ الذمة</th>
                      <th className="py-2.5 px-3 font-semibold">تاريخ التسليم والرفض</th>
                      <th className="py-2.5 px-3 font-semibold text-center">الإجراء المالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {returnDebtsParcels.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500 text-xs">
                          لا توجد ذمم شحن عكسي معلقة، كافة الشحنات المرتجعة سُددت نقداً
                        </td>
                      </tr>
                    ) : (
                      returnDebtsParcels.map((parcel) => (
                        <tr key={parcel.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-white" dir="ltr">
                            {parcel.trackingNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-200">{parcel.sender.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{parcel.sender.phone}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {parcel.originHubId}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-rose-400">
                            {formatCurrency(parcel.returnDebtAmount || parcel.returnShippingCost || 0, parcel.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {parcel.deliveredAt ? new Date(parcel.deliveredAt).toLocaleDateString('ar-SY') : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => settleReturnDebt(parcel.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow mx-auto transition cursor-pointer"
                              title="تسديد الذمة نقداً وإيداع المبلغ في صندوق الفرع"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>قبض وتسديد الذمة ✓</span>
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

          {/* TAB 4: PART B - PRE-DELIVERY RETURNS */}
          {activeTab === 'pre_delivery' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-purple-500/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-purple-400" />
                    <span>تقرير الطرود المرتجعة قبل التسليم (Part B)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    الطرود التي أُلغيت في مستودع الاستلام قبل خروج الموزع للتسليم، وجاهزة للشحن العكسي لفرع الأصل أو الإلغاء.
                  </p>
                </div>
                <div className="text-left shrink-0 mr-3">
                  <span className="text-lg font-black text-purple-400 font-mono">{preDeliveryReturns.length}</span>
                  <span className="text-[10px] text-slate-400 block">طرد معلن للإرجاع</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3 font-semibold">رقم التتبع</th>
                      <th className="py-2.5 px-3 font-semibold">المرسل وفرع الأصل</th>
                      <th className="py-2.5 px-3 font-semibold">سبب الإرجاع وملاحظاته</th>
                      <th className="py-2.5 px-3 font-semibold">أجور الشحن العكسي</th>
                      <th className="py-2.5 px-3 font-semibold">تاريخ الإعلان</th>
                      <th className="py-2.5 px-3 font-semibold text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {preDeliveryReturns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500 text-xs">
                          لا توجد طرود معلنة للإرجاع قبل التسليم
                        </td>
                      </tr>
                    ) : (
                      preDeliveryReturns.map((parcel) => (
                        <tr key={parcel.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-white" dir="ltr">
                            {parcel.trackingNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-200">{parcel.sender.name}</div>
                            <div className="text-[10px] text-slate-400">فرع الأصل: {parcel.originHubId}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-block bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
                              {parcel.returnInitiatedReason || 'إلغاء قبل التسليم'}
                            </span>
                            {parcel.returnInitiatedNotes && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{parcel.returnInitiatedNotes}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                            {formatCurrency(parcel.returnShippingCost || 0, parcel.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {parcel.returnInitiatedAt ? new Date(parcel.returnInitiatedAt).toLocaleDateString('ar-SY') : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => cancelPreDeliveryReturn(parcel.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition cursor-pointer"
                            >
                              إلغاء الإرجاع
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
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            نظام إدارة المرتجعات والشحن العكسي المتقدم - ORCA SYRIA
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
