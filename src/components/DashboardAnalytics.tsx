import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  LayoutDashboard,
  Radio,
  Activity,
  Truck,
  WalletCards,
  MessageSquareQuote,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Building2,
  Coins,
  Eye,
  Send,
  Package,
  ShieldCheck,
  Printer,
  User,
  Check,
  X,
  Compass,
  Zap,
  Users,
  DollarSign,
  BellRing,
  FileText,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import { Branch, Parcel, TruckManifest, Expense, DirectMessage, AuditLogEntry } from '../types';
import { AdminDirectivesModal } from './AdminDirectivesModal';
import { BranchCashboxBreakdownModal } from './BranchCashboxBreakdownModal';
import { BranchDetailModal } from './BranchDetailModal';

export const DashboardAnalytics: React.FC = () => {
  const {
    currentBranch,
    parcels,
    truckManifests,
    branches,
    branchesWithDerivedBalances,
    users,
    expenses,
    auditLogs,
    directMessages,
    sendDirectMessage,
    approveExpense,
    rejectExpense,
    currentUser,
    transactions,
    getCashboxBreakdown,
    openLostParcelSettlementModal,
    openPrintModal,
    openCodSenderPayoutModal,
    formatCurrency,
  } = useOrca();

  const isSuperAdmin = currentUser.role === 'super_admin';

  // State: Active Monitoring Tab (غرفة المراقبة المركزية: 5 أقسام استراتيجية)
  // 'live_feed': قسم العمليات الفورية
  // 'fleet_radar': قسم الشاحنات وحالاتها
  // 'cashbox_audit': قسم التحقق من الصناديق وأرصدتها
  // 'directives_approvals': قسم التوجيهات الإدارية والاعتمادات
  // 'executive_overview': المؤشرات الشاملة للمنظومة
  const [activeTab, setActiveTab] = useState<
    'live_feed' | 'fleet_radar' | 'cashbox_audit' | 'directives_approvals' | 'executive_overview'
  >('live_feed');

  // Branch Scope: 'all' (كافة فروع المنظومة الـ 14) or specific branchId
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    isSuperAdmin ? 'all' : (currentBranch?.id || 'all')
  );

  // Search & Filtering for Live Feed
  const [liveSearch, setLiveSearch] = useState('');
  const [liveFilterCategory, setLiveFilterCategory] = useState<string>('all');
  const [isLiveFeedPaused, setIsLiveFeedPaused] = useState(false);

  // Modals state
  const [isDirectivesModalOpen, setIsDirectivesModalOpen] = useState(false);
  const [selectedBranchForModal, setSelectedBranchForModal] = useState<Branch | null>(null);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [breakdownBranch, setBreakdownBranch] = useState<Branch | null>(null);

  // Fast Directive Quick-Compose inside Directives Tab
  const [quickDirectiveTitle, setQuickDirectiveTitle] = useState('');
  const [quickDirectiveContent, setQuickDirectiveContent] = useState('');
  const [quickDirectiveTarget, setQuickDirectiveTarget] = useState<'all' | string>('all');
  const [quickDirectivePriority, setQuickDirectivePriority] = useState<'normal' | 'urgent'>('normal');
  const [isSendingDirective, setIsSendingDirective] = useState(false);
  const [directiveSentNotice, setDirectiveSentNotice] = useState(false);

  // Truck Fleet Filter: 'all' | 'loading' | 'in_transit' | 'arrived' | 'completed'
  const [truckFilter, setTruckFilter] = useState<'all' | 'loading' | 'in_transit' | 'arrived' | 'completed'>('all');

  // Cashbox Search
  const [cashboxSearch, setCashboxSearch] = useState('');

  const isAllBranches = selectedBranchId === 'all';

  // -------------------------------------------------------------
  // DEDUPLICATION & INTEGRITY CHECK ENGINES (منع أي تكرار وتطابق البيانات)
  // -------------------------------------------------------------

  // 1. Pristine Deduplicated Branches Map
  const branchMap = useMemo(() => {
    const map = new Map<string, Branch>();
    branchesWithDerivedBalances.forEach((b) => {
      if (b && b.id && !map.has(b.id)) {
        map.set(b.id, b);
      }
    });
    return map;
  }, [branchesWithDerivedBalances]);

  // 2. Pristine Deduplicated Parcels Map & Filtered List
  const { allUniqueParcels, activeParcels, lostParcelsAwaitingSettlement } = useMemo(() => {
    const uniqueMap = new Map<string, Parcel>();
    parcels.forEach((p) => {
      if (p && p.id && !uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    });

    const uniqueList = Array.from(uniqueMap.values());

    const filtered = isAllBranches
      ? uniqueList
      : uniqueList.filter(
          (p) =>
            p.originHubId === selectedBranchId ||
            p.destinationHubId === selectedBranchId ||
            p.originCollectionBranchId === selectedBranchId
        );

    const lost = uniqueList.filter(
      (p) => p.handlingStatus === 'lost_in_transit' || p.shortageStatus === 'confirmed_lost_in_transit'
    );

    return {
      allUniqueParcels: uniqueList,
      activeParcels: filtered,
      lostParcelsAwaitingSettlement: lost,
    };
  }, [parcels, isAllBranches, selectedBranchId]);

  // 3. Pristine Deduplicated Truck Manifests Map & Filtered List
  const {
    activeTruckManifests,
    trucksLoading,
    trucksInTransit,
    trucksArrivedUnloading,
    trucksCompleted,
  } = useMemo(() => {
    const uniqueMap = new Map<string, TruckManifest>();
    truckManifests.forEach((m) => {
      if (m && m.id && !uniqueMap.has(m.id)) {
        uniqueMap.set(m.id, m);
      }
    });

    const uniqueList = Array.from(uniqueMap.values());

    const filtered = isAllBranches
      ? uniqueList
      : uniqueList.filter(
          (m) => m.originHubId === selectedBranchId || m.destinationHubId === selectedBranchId
        );

    return {
      activeTruckManifests: filtered,
      trucksLoading: filtered.filter((m) => m.status === 'preparing'),
      trucksInTransit: filtered.filter((m) => m.status === 'dispatched'),
      trucksArrivedUnloading: filtered.filter((m) => m.status === 'arrived_unloading'),
      trucksCompleted: filtered.filter((m) => m.status === 'received'),
    };
  }, [truckManifests, isAllBranches, selectedBranchId]);

  // 4. Pristine Deduplicated Expenses List
  const { pendingExpenses } = useMemo(() => {
    const uniqueMap = new Map<string, Expense>();
    expenses.forEach((e) => {
      if (e && e.id && !uniqueMap.has(e.id)) {
        uniqueMap.set(e.id, e);
      }
    });

    const uniqueList = Array.from(uniqueMap.values());

    const pending = uniqueList.filter(
      (e) =>
        (e.status === 'pending' || e.status === 'approved_waiting_disbursement') &&
        (isAllBranches || e.branchId === selectedBranchId)
    );

    return { pendingExpenses: pending };
  }, [expenses, isAllBranches, selectedBranchId]);

  // 5. Pristine Deduplicated Financial Summaries across All Branches
  const { branchFinancialSummaries, totalNetworkSyp, totalNetworkUsd } = useMemo(() => {
    let sumSyp = 0;
    let sumUsd = 0;

    const list = Array.from(branchMap.values()).map((branch) => {
      const breakdown = getCashboxBreakdown(branch.id);
      const syp = (breakdown.totalBranchSyp !== undefined && breakdown.totalBranchSyp !== 0)
        ? breakdown.totalBranchSyp
        : (branch.boxSypBalance || 0);
      const usd = (breakdown.totalBranchUsd !== undefined && breakdown.totalBranchUsd !== 0)
        ? breakdown.totalBranchUsd
        : (branch.boxUsdBalance || 0);
      sumSyp += syp;
      sumUsd += usd;

      return {
        branch,
        syp,
        usd,
        outgoingSyp: breakdown.outgoingSyp || 0,
        incomingSyp: breakdown.incomingSyp || 0,
        masterSyp: breakdown.masterSyp || 0,
        pendingSettlements: breakdown.pendingSettlementsCount || 0,
      };
    });

    return {
      branchFinancialSummaries: list,
      totalNetworkSyp: sumSyp,
      totalNetworkUsd: sumUsd,
    };
  }, [branchMap, getCashboxBreakdown]);

  // 6. Pristine Deduplicated Direct Messages List
  const recentDirectives = useMemo(() => {
    const uniqueMap = new Map<string, DirectMessage>();
    directMessages.forEach((dm) => {
      if (dm && dm.id && !uniqueMap.has(dm.id)) {
        uniqueMap.set(dm.id, dm);
      }
    });

    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [directMessages]);

  // 7. Consolidated Live Events Stream (Audit Logs, Real Transactions, Parcels, Manifests with 100% ID-based Branch Binding)
  const consolidatedLiveEvents = useMemo(() => {
    const uniqueEventMap = new Map<
      string,
      {
        id: string;
        timestamp: string;
        title: string;
        details: string;
        category: AuditLogEntry['category'];
        userId: string;
        userName: string;
        branchId: string;
        branchName: string;
      }
    >();

    // 1. Process and enrich audit logs
    auditLogs.forEach((log) => {
      if (!log || !log.id || uniqueEventMap.has(log.id)) return;

      const matchedBranch = branchMap.get(log.branchId);
      let branchName = 'المركز الرئيسي';
      if (matchedBranch) {
        branchName = matchedBranch.name;
      } else if (log.branchId === 'all' || !log.branchId) {
        branchName = 'كافة الفروع';
      } else if (log.branchId === 'system') {
        branchName = 'النظام المركزي';
      }

      uniqueEventMap.set(log.id, {
        id: log.id,
        timestamp: log.timestamp || new Date().toISOString(),
        title: log.action,
        details: log.details,
        category: (log.category as AuditLogEntry['category']) || 'system',
        userId: log.userId,
        userName: log.userName || 'النظام',
        branchId: log.branchId,
        branchName,
      });
    });

    // 2. Synthesize and guarantee real cashbox transactions into the live feed
    transactions.forEach((tx) => {
      if (!tx || !tx.id) return;
      const txKey = `tx_evt_${tx.id}`;
      if (uniqueEventMap.has(txKey)) return;

      const matchedBranch = branchMap.get(tx.branchId);
      const branchName = matchedBranch ? matchedBranch.name : 'الفرع الرئيسي';

      uniqueEventMap.set(txKey, {
        id: txKey,
        timestamp: tx.timestamp || tx.createdAt || new Date().toISOString(),
        title: tx.type === 'deposit' ? 'إيداع نقدي بالخزينة' :
               tx.type === 'withdrawal' ? 'سحب نقدي من الخزينة' :
               tx.type === 'shipping_income_prepaid' ? 'قبض أجور شحن نقداً' :
               tx.type === 'cod_collected_dest' ? 'تحصيل قيمة بضاعة COD' :
               tx.type === 'cod_paid_to_sender' ? 'صرف وتسليم حوالة COD للمرسل' :
               tx.type === 'settlement_transfer_to_hub' ? 'تحويل مقاصة للإدارة' :
               tx.type === 'settlement_received_from_branch' ? 'استلام مقاصة من فرع' :
               'حركة مالية بالصندوق',
        details: `${tx.description} | المبلغ: ${formatCurrency(tx.amount, tx.currency)} [${tx.cashboxScope === 'outgoing' ? 'صندوق الصادر' : tx.cashboxScope === 'incoming' ? 'صندوق الوارد' : 'الخزينة الرئيسية'}]`,
        category: 'cashbox',
        userId: tx.performedByUserId || 'sys',
        userName: tx.performedByUserName || 'أمين الصندوق',
        branchId: tx.branchId,
        branchName,
      });
    });

    // 3. Synthesize parcels into live feed if not present in logs
    parcels.slice(0, 50).forEach((p) => {
      if (!p || !p.id) return;
      const pKey = `p_evt_${p.id}`;
      if (uniqueEventMap.has(pKey)) return;

      const orig = branchMap.get(p.originHubId);
      const dest = branchMap.get(p.destinationHubId);
      const branchName = orig ? orig.name : 'فرع الصادر';

      uniqueEventMap.set(pKey, {
        id: pKey,
        timestamp: p.createdAt || (p as any).timestamp || new Date().toISOString(),
        title: `تسجيل طرد جديد [${p.trackingNumber}]`,
        details: `من: ${p.sender?.name || 'مرسل'} (فرع ${orig?.name || 'الصادر'}) إلى: ${p.receiver?.name || 'مستلم'} (فرع ${dest?.name || 'الوجهة'}) | النوع: ${p.packageType || 'طرد'} | الأجور: ${formatCurrency(p.shippingCost || 0, p.currency || 'SYP')}`,
        category: 'parcels',
        userId: p.createdById || 'sys',
        userName: p.createdByName || p.registeredByUserName || 'موظف الاستقبال',
        branchId: p.originHubId,
        branchName,
      });
    });

    return Array.from(uniqueEventMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [auditLogs, transactions, parcels, branchMap, formatCurrency]);

  // Filtered Live Events with strict ID & Scope matching
  const filteredLiveEvents = useMemo(() => {
    let list = consolidatedLiveEvents;

    if (liveFilterCategory !== 'all') {
      list = list.filter((e) => e.category === liveFilterCategory);
    }

    if (!isAllBranches) {
      list = list.filter((e) => {
        if (!e.branchId || e.branchId === 'all' || e.branchId === 'system' || e.branchId === selectedBranchId) {
          return true;
        }
        const selectedBranch = branchMap.get(selectedBranchId);
        if (selectedBranch && (e.title.includes(selectedBranch.name) || e.details.includes(selectedBranch.name) || e.branchName === selectedBranch.name)) {
          return true;
        }
        return false;
      });
    }

    if (liveSearch.trim()) {
      const q = liveSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.details.toLowerCase().includes(q) ||
          e.userName.toLowerCase().includes(q) ||
          e.branchName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [consolidatedLiveEvents, liveFilterCategory, isAllBranches, selectedBranchId, liveSearch, branchMap]);

  // Quick Directive Sender handler
  const handleSendQuickDirective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDirectiveTitle.trim() || !quickDirectiveContent.trim()) return;

    setIsSendingDirective(true);
    try {
      const targetBranch = quickDirectiveTarget === 'all' ? undefined : branchMap.get(quickDirectiveTarget);

      sendDirectMessage({
        senderUserId: currentUser.id,
        senderName: currentUser.name || currentUser.username,
        senderRole: currentUser.role,
        recipientType: 'branch',
        recipientBranchId: targetBranch?.id,
        recipientBranchName: targetBranch ? targetBranch.name : 'كافة فروع المنظومة',
        title: quickDirectiveTitle.trim(),
        content: quickDirectiveContent.trim(),
        priority: quickDirectivePriority,
      });

      setQuickDirectiveTitle('');
      setQuickDirectiveContent('');
      setDirectiveSentNotice(true);
      setTimeout(() => setDirectiveSentNotice(false), 4000);
    } finally {
      setIsSendingDirective(false);
    }
  };

  // Helper format time
  const formatTimeAgo = (isoDate: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
      if (diff < 60) return `منذ ${diff} ثانية`;
      if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
      if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
      return new Date(isoDate).toLocaleDateString('ar-SY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="w-full flex flex-col bg-slate-950 text-slate-100 font-['Cairo',sans-serif] select-none h-full min-h-full overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. TOP MISSION CONTROL BAR (شريط المراقبة ورادار المنظومة المباشر)           */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl px-4 py-3 shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 z-20 shadow-md">
        {/* Title & Live Status Beacon */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-black text-white tracking-wide">
                غرفة المراقبة المركزية
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span>رادار المراقبة الحية للمنظومة</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              المراقبة اللحظية للعمليات | حركة الشاحنات | تدقيق الصناديق | القرارات الإدارية
            </p>
          </div>
        </div>

        {/* Global Branch Scope Selector & Action Button */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Branch Scope Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-inner">
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] text-slate-400 font-bold">النطاق:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs text-white font-black focus:outline-none cursor-pointer pr-1"
            >
              {isSuperAdmin && (
                <option value="all" className="bg-slate-900 text-cyan-300 font-bold">
                  🌐 كافة الفروع
                </option>
              )}
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  فرع {b.name} ({b.governorate})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Action Button: New Directive */}
          <button
            type="button"
            onClick={() => setIsDirectivesModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-950/40 cursor-pointer transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>إصدار توجيه إداري</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ATTENTION & INTERVENTION BANNER (كبسولات الإنذار والتدخل العاجل)         */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/50 border-b border-slate-800/80 px-4 py-2 shrink-0 flex items-center gap-3 overflow-x-auto custom-scrollbar text-xs">
        <span className="text-[11px] font-black text-slate-400 shrink-0 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>تنبيهات التدخل:</span>
        </span>

        {/* 1. Lost Parcels awaiting Super Admin */}
        {lostParcelsAwaitingSettlement.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              const first = lostParcelsAwaitingSettlement[0];
              if (first) openLostParcelSettlementModal(first);
            }}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 shrink-0 transition cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-bold">
              {lostParcelsAwaitingSettlement.length} طرد مفقود بانتظار قرار التسوية الإدارية
            </span>
            <span className="text-[10px] bg-rose-500/20 px-1 rounded text-rose-200">معالجة ◄</span>
          </button>
        ) : (
          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            <span>لا توجد طرود مفقودة معلقة</span>
          </span>
        )}

        {/* 2. Trucks In-Transit */}
        <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 shrink-0">
          <Truck className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-bold">
            {trucksInTransit.length} شاحنة على الطريق بين الفروع
          </span>
        </div>

        {/* 3. Pending Expense Approvals */}
        {pendingExpenses.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('directives_approvals')}
            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shrink-0 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">
              {pendingExpenses.length} طلب مصاريف بانتظار اعتماد المدير
            </span>
          </button>
        )}

        {/* 4. Total COD awaiting payout */}
        <button
          type="button"
          onClick={() => {
            const codParcels = allUniqueParcels.filter(
              (p) =>
                p.paymentType === 'cod' &&
                (p.handlingStatus === 'received_at_dest' || p.handlingStatus === 'delivered') &&
                p.codStatus !== 'paid_to_sender'
            );
            if (codParcels.length > 0) {
              openCodSenderPayoutModal(codParcels[0].id);
            }
          }}
          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shrink-0 transition cursor-pointer"
        >
          <Coins className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold">
            حوالات COD محصلة جاهزة للتسليم
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN NAVIGATION TABS (الأقسام الخمسة الرئيسية للوحة المراقبة)          */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 shrink-0 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {/* Tab 1: Live Operations Feed */}
        <button
          type="button"
          onClick={() => setActiveTab('live_feed')}
          className={`px-4 py-3 text-xs font-black flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'live_feed'
              ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Radio className={`w-4 h-4 ${activeTab === 'live_feed' ? 'text-cyan-400 animate-pulse' : ''}`} />
          <span>قسم العمليات الفورية المباشرة</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300">
            {filteredLiveEvents.length}
          </span>
        </button>

        {/* Tab 2: Fleet Radar */}
        <button
          type="button"
          onClick={() => setActiveTab('fleet_radar')}
          className={`px-4 py-3 text-xs font-black flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'fleet_radar'
              ? 'border-blue-500 text-blue-300 bg-blue-500/10'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Truck className="w-4 h-4 text-blue-400" />
          <span>قسم الشاحنات وحالات النقل</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300">
            {activeTruckManifests.length}
          </span>
        </button>

        {/* Tab 3: Cashboxes & Vault Audit */}
        <button
          type="button"
          onClick={() => setActiveTab('cashbox_audit')}
          className={`px-4 py-3 text-xs font-black flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'cashbox_audit'
              ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <WalletCards className="w-4 h-4 text-emerald-400" />
          <span>قسم التحقق من الصناديق والأرصدة</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
            {branches.length} فرع
          </span>
        </button>

        {/* Tab 4: Directives & Approvals */}
        <button
          type="button"
          onClick={() => setActiveTab('directives_approvals')}
          className={`px-4 py-3 text-xs font-black flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'directives_approvals'
              ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <MessageSquareQuote className="w-4 h-4 text-indigo-400" />
          <span>قسم التوجيهات الإدارية والاعتمادات</span>
          {pendingExpenses.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
              {pendingExpenses.length} معلق
            </span>
          )}
        </button>

        {/* Tab 5: Executive Overview */}
        <button
          type="button"
          onClick={() => setActiveTab('executive_overview')}
          className={`px-4 py-3 text-xs font-black flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
            activeTab === 'executive_overview'
              ? 'border-purple-500 text-purple-300 bg-purple-500/10'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-purple-400" />
          <span>المؤشرات الشاملة للمنظومة</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB CONTENTS WORKSPACE                                                 */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6">

        {/* ======================================================================= */}
        {/* SECTION 1: LIVE OPERATIONS STREAM (قسم العمليات الفورية)                 */}
        {/* ======================================================================= */}
        {activeTab === 'live_feed' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Filter Bar & Controls */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full md:w-auto flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={liveSearch}
                    onChange={(e) => setLiveSearch(e.target.value)}
                    placeholder="بحث في العمليات الفورية، اسم الموظف، الفرع، أو التفاصيل..."
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                  {[
                    { id: 'all', label: 'كافة العمليات' },
                    { id: 'parcels', label: 'الطرود والشحن' },
                    { id: 'manifests', label: 'الشاحنات' },
                    { id: 'cashbox', label: 'المالية والصناديق' },
                    { id: 'users', label: 'المستخدمين' },
                    { id: 'branches', label: 'الفروع' },
                    { id: 'pricing', label: 'التسعير' },
                    { id: 'auth', label: 'الأمان والتسجيل' },
                    { id: 'alerts', label: 'المهل و SLA' },
                    { id: 'system', label: 'النظام والهوية' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setLiveFilterCategory(cat.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        liveFilterCategory === cat.id
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLiveFeedPaused((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                    isLiveFeedPaused
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isLiveFeedPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  <span>{isLiveFeedPaused ? 'التدفق متوقف مؤقتاً' : 'التدفق اللحظي يعمل'}</span>
                </button>
              </div>
            </div>

            {/* Live Operations Feed Cards List */}
            <div className="space-y-2.5">
              {filteredLiveEvents.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                  <Activity className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-bold text-sm text-slate-300">لا توجد عمليات تطابق البحث في هذا النطاق</p>
                  <p className="text-xs text-slate-500 mt-1">تتم مراقبة العمليات فور تسجيلها في الشبكة اللوجستية</p>
                </div>
              ) : (
                filteredLiveEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800/90 hover:border-slate-700 p-3.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition shadow-xs group"
                  >
                    {/* Left/Right RTL: Category Icon + Title + Details */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          evt.category === 'parcels'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                            : evt.category === 'manifests'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : evt.category === 'cashbox'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : evt.category === 'users'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : evt.category === 'branches'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            : evt.category === 'pricing'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : evt.category === 'alerts'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : evt.category === 'branding'
                            ? 'bg-pink-500/10 text-pink-400 border border-pink-500/30'
                            : evt.category === 'auth'
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {evt.category === 'parcels' ? (
                          <Package className="w-4 h-4" />
                        ) : evt.category === 'manifests' ? (
                          <Truck className="w-4 h-4" />
                        ) : evt.category === 'cashbox' ? (
                          <Coins className="w-4 h-4" />
                        ) : evt.category === 'users' ? (
                          <Users className="w-4 h-4" />
                        ) : evt.category === 'branches' ? (
                          <Building2 className="w-4 h-4" />
                        ) : evt.category === 'pricing' ? (
                          <DollarSign className="w-4 h-4" />
                        ) : evt.category === 'alerts' ? (
                          <BellRing className="w-4 h-4" />
                        ) : evt.category === 'branding' ? (
                          <FileText className="w-4 h-4" />
                        ) : evt.category === 'auth' ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          <Activity className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-black text-white">{evt.title}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            فرع {evt.branchName}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            <span>{evt.userName}</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-mono">
                          {evt.details}
                        </p>
                      </div>
                    </div>

                    {/* Time Ago & Timestamp */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <span className="text-[10px] font-mono text-cyan-400/90 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-800/40 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>{formatTimeAgo(evt.timestamp)}</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* SECTION 2: FLEET RADAR & TRUCKS (قسم الشاحنات وحالات النقل)               */}
        {/* ======================================================================= */}
        {activeTab === 'fleet_radar' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Status Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setTruckFilter('loading')}
                className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
                  truckFilter === 'loading'
                    ? 'bg-amber-950/30 border-amber-500 shadow-lg'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-amber-400 font-bold">قيد التجهيز والتحميل</span>
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{trucksLoading.length}</div>
                <p className="text-[10px] text-slate-400 mt-1">شاحنات في فرع الصادر</p>
              </button>

              <button
                type="button"
                onClick={() => setTruckFilter('in_transit')}
                className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
                  truckFilter === 'in_transit'
                    ? 'bg-blue-950/30 border-blue-500 shadow-lg'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-blue-400 font-bold">على الطريق (مسافرة)</span>
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{trucksInTransit.length}</div>
                <p className="text-[10px] text-slate-400 mt-1">بين فروع المنظومة الآن</p>
              </button>

              <button
                type="button"
                onClick={() => setTruckFilter('arrived')}
                className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
                  truckFilter === 'arrived'
                    ? 'bg-purple-950/30 border-purple-500 shadow-lg'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-purple-400 font-bold">وصلت قيد التفريغ</span>
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{trucksArrivedUnloading.length}</div>
                <p className="text-[10px] text-slate-400 mt-1">بمستودعات الوجهة</p>
              </button>

              <button
                type="button"
                onClick={() => setTruckFilter('completed')}
                className={`p-4 rounded-2xl border text-right transition cursor-pointer ${
                  truckFilter === 'completed'
                    ? 'bg-emerald-950/30 border-emerald-500 shadow-lg'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-emerald-400 font-bold">أفرغت بالكامل</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">{trucksCompleted.length}</div>
                <p className="text-[10px] text-slate-400 mt-1">رحلات مكتملة ومطابقة</p>
              </button>
            </div>

            {/* Filter Reset Button if filtered */}
            {truckFilter !== 'all' && (
              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-300 font-bold">
                  تصفية معروضة حسب الحالة المحددة ({truckFilter})
                </span>
                <button
                  type="button"
                  onClick={() => setTruckFilter('all')}
                  className="text-xs text-cyan-400 hover:underline font-bold"
                >
                  عرض كافة الشاحنات ◄
                </button>
              </div>
            )}

            {/* Trucks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTruckManifests
                .filter((m) => {
                  if (truckFilter === 'loading') return m.status === 'preparing';
                  if (truckFilter === 'in_transit') return m.status === 'dispatched';
                  if (truckFilter === 'arrived') return m.status === 'arrived_unloading';
                  if (truckFilter === 'completed') return m.status === 'received';
                  return true;
                })
                .map((mnf) => {
                  const orig = branchMap.get(mnf.originHubId);
                  const dest = branchMap.get(mnf.destinationHubId);
                  const isMoving = mnf.status === 'dispatched';

                  return (
                    <div
                      key={mnf.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl flex flex-col justify-between gap-4 transition shadow-md"
                    >
                      {/* Top info */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-cyan-400">
                              {mnf.manifestNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                mnf.status === 'dispatched'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : mnf.status === 'preparing'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : mnf.status === 'arrived_unloading'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {mnf.status === 'dispatched'
                                ? 'على الطريق'
                                : mnf.status === 'preparing'
                                ? 'قيد التجهيز'
                                : mnf.status === 'arrived_unloading'
                                ? 'وصلت قيد التفريغ'
                                : 'مكتملة ومفرغة'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            لوحة الشاحنة: <strong className="text-white font-mono">{mnf.truckPlate || 'غير محدد'}</strong> | نوع: {mnf.truckType || 'شاحنة مغلقة'}
                          </p>
                        </div>

                        <div className="text-left">
                          <button
                            type="button"
                            onClick={() => openPrintModal('manifest_a4', mnf)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                            title="طباعة / معاينة مانافيست الشاحنة"
                          >
                            <Printer className="w-3 h-3 text-cyan-400" />
                            <span>معاينة</span>
                          </button>
                        </div>
                      </div>

                      {/* Route Graphic */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">فرع الصادر</span>
                          <span className="text-xs font-black text-white">{orig?.name || 'الصادر'}</span>
                          <span className="text-[10px] text-slate-400 block">{orig?.governorate}</span>
                        </div>

                        <div className="flex-1 px-4 flex flex-col items-center">
                          <span className="text-[10px] text-slate-400 font-mono mb-1">
                            {isMoving ? '◀ الشاحنة مسافرة ◀' : 'خط السير اللوجستي'}
                          </span>
                          <div className="w-full h-1 bg-slate-800 rounded-full relative overflow-hidden">
                            {isMoving && (
                              <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse" />
                            )}
                          </div>
                        </div>

                        <div className="text-left">
                          <span className="text-[10px] text-slate-500 block">فرع الوجهة</span>
                          <span className="text-xs font-black text-cyan-300">{dest?.name || 'الوجهة'}</span>
                          <span className="text-[10px] text-slate-400 block">{dest?.governorate}</span>
                        </div>
                      </div>

                      {/* Manifest Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                        <div>
                          <span className="text-[10px] text-slate-500 block">عدد الطرود</span>
                          <span className="font-mono font-bold text-white">{mnf.parcelsCount || mnf.parcelIds.length} طرد</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">الوزن الإجمالي</span>
                          <span className="font-mono font-bold text-white">{mnf.totalWeightKg || 0} كغ</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">السائق</span>
                          <span className="text-white font-bold truncate block">{mnf.driverName || 'غير مسجل'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* SECTION 3: CASHBOXES & VAULT AUDIT (قسم التحقق من الصناديق والأرصدة)       */}
        {/* ======================================================================= */}
        {activeTab === 'cashbox_audit' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Total Sovereign Financial Banner */}
            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <WalletCards className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-lg font-black text-white">
                    إجمالي السيولة النقدية بالصناديق
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  مجموع الأرصدة المتوفرة حالياً في الخزائن والصناديق
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-[10px] text-emerald-400 font-bold block">إجمالي الليرة السورية (SYP)</span>
                  <span className="text-2xl font-black text-white font-mono">
                    {formatCurrency(totalNetworkSyp, 'SYP')}
                  </span>
                </div>
                <div className="h-10 w-px bg-slate-700 hidden sm:block" />
                <div className="text-right">
                  <span className="text-[10px] text-cyan-400 font-bold block">إجمالي الدولار الأمريكي (USD)</span>
                  <span className="text-2xl font-black text-white font-mono">
                    {formatCurrency(totalNetworkUsd, 'USD')}
                  </span>
                </div>
              </div>
            </div>

            {/* Branch Search Bar */}
            <div className="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cashboxSearch}
                  onChange={(e) => setCashboxSearch(e.target.value)}
                  placeholder="بحث باسم الفرع أو المحافظة..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <span className="text-xs text-slate-400 font-bold">
                عرض {branchFinancialSummaries.length} فرعاً
              </span>
            </div>

            {/* Branches Cashbox Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">اسم الفرع والمحافظة</th>
                      <th className="py-3.5 px-4 text-center">صندوق الصادر (قبض شحن)</th>
                      <th className="py-3.5 px-4 text-center">صندوق الوارد (تسليم و COD)</th>
                      <th className="py-3.5 px-4 text-center">الخزينة الرئيسية للفرع</th>
                      <th className="py-3.5 px-4 text-center">إجمالي الرصيد الصافي (SYP)</th>
                      <th className="py-3.5 px-4 text-center">إجمالي الرصيد الصافي (USD)</th>
                      <th className="py-3.5 px-4 text-center">الإجراء والتدقيق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {branchFinancialSummaries
                      .filter((item) => {
                        if (!cashboxSearch.trim()) return true;
                        const q = cashboxSearch.toLowerCase();
                        return (
                          item.branch.name.toLowerCase().includes(q) ||
                          item.branch.governorate.toLowerCase().includes(q) ||
                          item.branch.city.toLowerCase().includes(q)
                        );
                      })
                      .map((item) => (
                        <tr key={item.branch.id} className="hover:bg-slate-850/60 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-xs">{item.branch.name}</div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.branch.governorate} - {item.branch.city}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-bold">
                            {formatCurrency(item.outgoingSyp, 'SYP')}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-blue-400 font-bold">
                            {formatCurrency(item.incomingSyp, 'SYP')}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-purple-400 font-bold">
                            {formatCurrency(item.masterSyp, 'SYP')}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-white font-black text-sm">
                            {formatCurrency(item.syp, 'SYP')}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-cyan-300 font-black">
                            {formatCurrency(item.usd, 'USD')}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setBreakdownBranch(item.branch)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>كشف الصناديق ◄</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* SECTION 4: DIRECTIVES & APPROVALS (قسم التوجيهات الإدارية والاعتمادات)     */}
        {/* ======================================================================= */}
        {activeTab === 'directives_approvals' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Quick Directive Composer & Pending Approvals Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: Fast Directive Broadcast Composer */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        <Send className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">إصدار تعميم أو توجيه إداري فوري</h3>
                        <p className="text-[11px] text-slate-400">إرسال تعميم رسمي عاجل يظهر مباشرةً لكوادر الفروع</p>
                      </div>
                    </div>
                  </div>

                  {directiveSentNotice && (
                    <div className="mb-3 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تم إرسال وتعميم التوجيه الإداري بنجاح إلى الفروع المحددة.</span>
                    </div>
                  )}

                  <form onSubmit={handleSendQuickDirective} className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">الجهة المستهدفة:</label>
                      <select
                        value={quickDirectiveTarget}
                        onChange={(e) => setQuickDirectiveTarget(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="all">🌐 تعميم لكافة الفروع</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            فرع {b.name} ({b.governorate})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">عنوان التوجيه الإداري:</label>
                      <input
                        type="text"
                        required
                        value={quickDirectiveTitle}
                        onChange={(e) => setQuickDirectiveTitle(e.target.value)}
                        placeholder="مثال: تعليمات تسليم شحنات الـ COD / ضبط أوقات ترحيل الشاحنات..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">نص التوجيه والتعليمات:</label>
                      <textarea
                        required
                        rows={3}
                        value={quickDirectiveContent}
                        onChange={(e) => setQuickDirectiveContent(e.target.value)}
                        placeholder="اكتب التوجيه الإداري بصيغة رسمية واضحة ومحددة..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 custom-scrollbar"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 font-bold">الأولوية:</label>
                        <button
                          type="button"
                          onClick={() => setQuickDirectivePriority('normal')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            quickDirectivePriority === 'normal'
                              ? 'bg-slate-700 text-white'
                              : 'bg-slate-950 text-slate-400'
                          }`}
                        >
                          عادي
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickDirectivePriority('urgent')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            quickDirectivePriority === 'urgent'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-950 text-slate-400'
                          }`}
                        >
                          عاجل ومهم
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingDirective}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-950/40 cursor-pointer active:scale-95 transition disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>تعميم فوري</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Card 2: Expense Approval Center (مركز اعتماد المصاريف المعلقة) */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">طلبات المصاريف والنفقات المعلقة</h3>
                        <p className="text-[11px] text-slate-400">اعتماد أو رفض طلبات الصرف الصادرة من مدراء الفروع</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 font-mono">
                      {pendingExpenses.length} طلب
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar">
                    {pendingExpenses.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/40 mb-2" />
                        <p className="text-xs font-bold text-slate-400">لا توجد طلبات مصاريف معلقة حالياً</p>
                        <p className="text-[10px] text-slate-500 mt-1">كافة النفقات معتمدة ومسواة أصولاً</p>
                      </div>
                    ) : (
                      pendingExpenses.map((exp) => {
                        const br = branchMap.get(exp.branchId);
                        return (
                          <div
                            key={exp.id}
                            className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-xs font-bold text-white">{exp.title}</h4>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  فرع {br?.name || 'الفرع'} | {exp.category} | مقدم الطلب: {exp.performedByUserName || 'الموظف'}
                                </span>
                              </div>
                              <div className="font-mono font-black text-xs text-rose-400">
                                {formatCurrency(exp.amount, exp.currency)}
                              </div>
                            </div>

                            {exp.notes && (
                              <p className="text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded-lg leading-relaxed">
                                {exp.notes}
                              </p>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => rejectExpense(exp.id, 'مرفوض من غرفة المراقبة المركزية')}
                                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>رفض</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => approveExpense(exp.id)}
                                className="px-4 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>موافقة واعتماد</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Archive of Sent Directives */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-black text-white">أرشيف التوجيهات والكتب الإدارية الصادرة</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDirectivesModalOpen(true)}
                  className="text-xs text-indigo-400 hover:underline font-bold"
                >
                  فتح السجل الكامل للتوجيهات ◄
                </button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {recentDirectives.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">لا توجد توجيهات إدارية سابقة</p>
                ) : (
                  recentDirectives.slice(0, 5).map((dir) => (
                    <div
                      key={dir.id}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{dir.title}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-bold">
                            موجه إلى: {dir.recipientBranchName || 'كافة الفروع'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{dir.content}</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {formatTimeAgo(dir.timestamp)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* SECTION 5: EXECUTIVE OVERVIEW (المؤشرات الشاملة للمنظومة)                */}
        {/* ======================================================================= */}
        {activeTab === 'executive_overview' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Stat Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">إجمالي الطرود المسجلة</span>
                <span className="text-2xl font-black text-white font-mono">{activeParcels.length}</span>
                <span className="text-[10px] text-cyan-400 block mt-1">بوليصة شحن نشطة</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">الشاحنات على الطريق</span>
                <span className="text-2xl font-black text-blue-400 font-mono">{trucksInTransit.length}</span>
                <span className="text-[10px] text-slate-400 block mt-1">رحلات شحن نشطة</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">نسبة التسليم الناجح</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {activeParcels.length > 0
                    ? `${Math.round(
                        (activeParcels.filter((p) => p.handlingStatus === 'delivered').length /
                          activeParcels.length) *
                          100
                      )}%`
                    : '100%'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">معدل الإنجاز والتسليم</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">الرصيد النقدي بالليرة</span>
                <span className="text-xl font-black text-white font-mono truncate block">
                  {formatCurrency(totalNetworkSyp, 'SYP')}
                </span>
                <span className="text-[10px] text-emerald-400 block mt-1">سيولة متوفرة بالصناديق</span>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 5. MODALS INTEGRATION                                                     */}
      {/* ========================================================================= */}
      {/* Admin Directives Modal */}
      <AdminDirectivesModal
        isOpen={isDirectivesModalOpen}
        onClose={() => setIsDirectivesModalOpen(false)}
      />

      {/* Branch Cashbox Breakdown Modal */}
      {breakdownBranch && (
        <BranchCashboxBreakdownModal
          branch={breakdownBranch}
          isOpen={!!breakdownBranch}
          onClose={() => setBreakdownBranch(null)}
        />
      )}

      {/* Branch Detail Deep-Dive Modal */}
      {selectedBranchForModal && (
        <BranchDetailModal
          branch={selectedBranchForModal}
          isOpen={isBranchModalOpen}
          onClose={() => {
            setIsBranchModalOpen(false);
            setSelectedBranchForModal(null);
          }}
        />
      )}
    </div>
  );
};
