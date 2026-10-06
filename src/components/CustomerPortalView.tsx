import React, { useState, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import { Parcel } from '../types';
import {
  Package,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  RefreshCw,
  LogOut,
  MapPin,
  Calendar,
  Eye,
  FileText,
  Share2,
  Bell,
  ChevronRight,
  AlertCircle,
  Building2,
  Phone,
  User,
  ShieldCheck,
  TrendingUp,
  X,
  Receipt,
  Download,
  Check,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  QrCode,
  RotateCcw,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrcaLogo } from './OrcaLogo';
import { PWAInstallButton } from './PWAInstallButton';

const SYRIAN_GOVERNORATES = [
  'دمشق',
  'ريف دمشق',
  'حلب',
  'حمص',
  'حماة',
  'اللاذقية',
  'طرطوس',
  'إدلب',
  'الرقة',
  'دير الزور',
  'الحسكة',
  'درعا',
  'السويداء',
  'القنيطرة',
];

export const CustomerPortalView: React.FC = () => {
  const {
    currentCustomer,
    logoutCustomer,
    getCustomerParcels,
    getCustomerAnalytics,
    getCustomerNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    brandingSettings,
    formatCurrency,
    formatNumber,
    branches,
  } = useOrca();

  // Search and Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'sent' | 'received' | 'in_transit' | 'delivered' | 'cod_ready' | 'returned'>('all');
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedPaymentType, setSelectedPaymentType] = useState<'all' | 'cod' | 'prepaid'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'cod_high' | 'cost_high'>('date_desc');
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  // Modals & UI states
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch customer parcels, analytics, and notifications
  const { sent, received, all } = useMemo(() => getCustomerParcels(), [getCustomerParcels]);
  const analytics = useMemo(() => getCustomerAnalytics(), [getCustomerAnalytics]);
  const customerNotifications = useMemo(() => getCustomerNotifications(), [getCustomerNotifications]);

  const unreadNotificationsCount = customerNotifications.filter((n) => !n.read).length;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleShareTrackingWhatsApp = (parcel: Parcel) => {
    const text = `📦 متابعة شحنة لدى ${brandingSettings.companyName || 'أوركا إكسبريس'}\n🔖 رقم البوليصة: ${parcel.trackingNumber}\n📍 من: ${getBranchName(parcel.originHubId)} ⬅️ إلى: ${getBranchName(parcel.destinationHubId)}\n👤 المستلم: ${parcel.receiver.name}\n🚦 الحالة الحالية: ${getHandlingStatusLabel(parcel.handlingStatus)}\n💰 مبلغ الـ COD: ${parcel.paymentType === 'cod' && parcel.codAmount > 0 ? formatCurrency(parcel.codAmount, parcel.codCurrency || parcel.currency) : 'مدفوع سلفاً'}\nشكراً لتعاملكم معنا.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return 'المركز الرئيسي';
    const b = branches.find((item) => item.id === branchId || item.code === branchId);
    return b ? b.name : branchId;
  };

  // Helper status styling
  const getHandlingStatusLabel = (status: Parcel['handlingStatus']) => {
    switch (status) {
      case 'received_at_origin_hub':
      case 'received_at_hub':
        return 'مسجلة وجاهزة للإرسال';
      case 'loaded_in_truck':
        return 'محملة بالشاحنة اللوجستية';
      case 'in_transit':
        return 'قيد النقل بين المحافظات';
      case 'received_at_dest':
        return 'وصلت فرع الوجهة (جاهزة للاستلام)';
      case 'with_courier':
        return 'خرجت مع الموزع للتسليم';
      case 'delivered':
        return 'تم التسليم بنجاح ✅';
      case 'returned':
        return 'مرتجعة للمرسل';
      case 'shortage_missing':
      case 'lost_in_transit':
      case 'settled_loss_compensated':
      case 'leftover_origin_warehouse':
      case 'rerouted_forwarded':
        return 'قيد التدقيق والمطابقة';
      default:
        return 'قيد المعالجة';
    }
  };

  // 3D-styled Status Badge
  const getStatusBadge = (status: Parcel['handlingStatus']) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-950/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>تم التسليم</span>
          </span>
        );
      case 'with_courier':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950/40">
            <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
            <span>مع الموزع</span>
          </span>
        );
      case 'in_transit':
      case 'loaded_in_truck':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-950/40">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>قيد النقل</span>
          </span>
        );
      case 'received_at_dest':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-950/40">
            <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>بالفرع الوجهة</span>
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm shadow-rose-950/40">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>مرتجعة</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 shadow-sm">
            <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>استلام بالمركز</span>
          </span>
        );
    }
  };

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedGovernorate !== 'all') count++;
    if (selectedDateRange !== 'all') count++;
    if (selectedPaymentType !== 'all') count++;
    if (searchQuery.trim() !== '') count++;
    return count;
  }, [selectedGovernorate, selectedDateRange, selectedPaymentType, searchQuery]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedGovernorate('all');
    setSelectedDateRange('all');
    setSelectedPaymentType('all');
    setSortBy('date_desc');
  };

  // Filtered & Sorted Parcels
  const filteredParcels = useMemo(() => {
    let result = all;

    // 1. Filter by Tab
    if (activeTab === 'sent') {
      result = sent;
    } else if (activeTab === 'received') {
      result = received;
    } else if (activeTab === 'in_transit') {
      result = all.filter(
        (p) =>
          p.handlingStatus === 'in_transit' ||
          p.handlingStatus === 'loaded_in_truck' ||
          p.handlingStatus === 'with_courier'
      );
    } else if (activeTab === 'delivered') {
      result = all.filter((p) => p.handlingStatus === 'delivered');
    } else if (activeTab === 'cod_ready') {
      result = sent.filter(
        (p) =>
          p.paymentType === 'cod' &&
          (p.handlingStatus === 'delivered' ||
            p.isCodCollectedByCashier ||
            Boolean(p.cashierCollected) ||
            p.codStatus === 'collected_awaiting_sender_payout' ||
            p.codStatus === 'sender_notified') &&
          !p.codPaidToSender &&
          p.codPayoutStatus !== 'paid_to_sender' &&
          p.codStatus !== 'paid_to_sender'
      );
    } else if (activeTab === 'returned') {
      result = all.filter((p) => p.handlingStatus === 'returned');
    }

    // 2. Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => {
        return (
          p.trackingNumber.toLowerCase().includes(q) ||
          (p.paperReceiptNumber && p.paperReceiptNumber.toLowerCase().includes(q)) ||
          p.receiver.name.toLowerCase().includes(q) ||
          p.receiver.phone.includes(q) ||
          p.sender.name.toLowerCase().includes(q) ||
          p.sender.phone.includes(q) ||
          (p.contentDescription && p.contentDescription.toLowerCase().includes(q)) ||
          (p.destinationAddress && p.destinationAddress.toLowerCase().includes(q))
        );
      });
    }

    // 3. Filter by Governorate
    if (selectedGovernorate !== 'all') {
      result = result.filter(
        (p) =>
          p.receiver.city === selectedGovernorate ||
          p.sender.city === selectedGovernorate
      );
    }

    // 4. Filter by Date Range
    if (selectedDateRange !== 'all') {
      const now = new Date();
      result = result.filter((p) => {
        const pDate = new Date(p.createdAt);
        if (selectedDateRange === 'today') {
          return pDate.toDateString() === now.toDateString();
        } else if (selectedDateRange === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return pDate >= sevenDaysAgo;
        } else if (selectedDateRange === 'month') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return pDate >= thirtyDaysAgo;
        }
        return true;
      });
    }

    // 5. Filter by Payment Type
    if (selectedPaymentType !== 'all') {
      if (selectedPaymentType === 'cod') {
        result = result.filter((p) => p.paymentType === 'cod' && (p.codAmount || 0) > 0);
      } else if (selectedPaymentType === 'prepaid') {
        result = result.filter((p) => p.paymentType !== 'cod' || (p.codAmount || 0) === 0);
      }
    }

    // 6. Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'date_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'cod_high') {
        return (b.codAmount || 0) - (a.codAmount || 0);
      } else if (sortBy === 'cost_high') {
        return (b.shippingCost || 0) - (a.shippingCost || 0);
      }
      // default: date_desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [all, sent, received, activeTab, searchQuery, selectedGovernorate, selectedDateRange, selectedPaymentType, sortBy]);

  // Tab definitions with 3D icons & counts
  const tabItems = [
    {
      key: 'all',
      label: 'جميع الشحنات',
      shortLabel: 'الكل',
      count: all.length,
      icon: Layers,
      color: 'from-indigo-500 to-blue-600',
      activeBadge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    },
    {
      key: 'sent',
      label: 'صادرة (أرسلتها)',
      shortLabel: 'صادرة',
      count: sent.length,
      icon: ArrowUpRight,
      color: 'from-sky-500 to-cyan-600',
      activeBadge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    },
    {
      key: 'received',
      label: 'واردة (استلمتها)',
      shortLabel: 'واردة',
      count: received.length,
      icon: ArrowDownLeft,
      color: 'from-purple-500 to-indigo-600',
      activeBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
    {
      key: 'in_transit',
      label: 'قيد النقل والتوزيع',
      shortLabel: 'بالطريق',
      count: analytics.inTransitCount + analytics.withCourierCount,
      icon: Truck,
      color: 'from-amber-500 to-orange-600',
      activeBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    {
      key: 'delivered',
      label: 'تم التسليم',
      shortLabel: 'مستلمة',
      count: analytics.deliveredCount,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      activeBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      key: 'cod_ready',
      label: 'حوالات COD جاهزة للصرف',
      shortLabel: 'حوالات COD',
      count: sent.filter(
        (p) =>
          p.paymentType === 'cod' &&
          (p.handlingStatus === 'delivered' ||
            p.isCodCollectedByCashier ||
            Boolean(p.cashierCollected) ||
            p.codStatus === 'collected_awaiting_sender_payout' ||
            p.codStatus === 'sender_notified') &&
          !p.codPaidToSender &&
          p.codPayoutStatus !== 'paid_to_sender' &&
          p.codStatus !== 'paid_to_sender'
      ).length,
      icon: DollarSign,
      color: 'from-emerald-400 to-green-600',
      activeBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
    {
      key: 'returned',
      label: 'مرتجعة',
      shortLabel: 'مرتجعة',
      count: analytics.returnedCount,
      icon: AlertCircle,
      color: 'from-rose-500 to-pink-600',
      activeBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-['Cairo',sans-serif] selection:bg-amber-500 selection:text-black pb-20" dir="rtl">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & IDENTITY BAR (Eye-Safe, Refined) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-amber-500/20 shadow-lg shadow-black/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18 gap-3">
            
            {/* Brand Logo & Customer Name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <OrcaLogo size={36} showText={false} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                    {brandingSettings.companyName || 'ORCA EXPRESS'}
                  </h1>
                </div>
                <p className="text-xs text-amber-400 font-bold truncate">
                  {currentCustomer?.name || 'الزبون'} {currentCustomer?.companyName ? `(${currentCustomer.companyName})` : ''}
                </p>
              </div>
            </div>

            {/* Quick Actions (PWA Install, Statement, Notifications, Refresh, Logout) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <PWAInstallButton variant="header" />

              <motion.button
                whileTap={{ scale: 0.92 }}
                id="customer-portal-statement-btn"
                onClick={() => setIsStatementModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/70 text-xs font-bold text-emerald-300 shadow-sm transition-all"
                title="كشف الحساب والتحصيلات"
              >
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">كشف الحساب</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                id="customer-portal-notifications-btn"
                onClick={() => setIsNotificationsModalOpen(true)}
                className="relative p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 border border-slate-700/70 shadow-sm transition-all"
                title="إشعارات الشحنات"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce shadow-md shadow-rose-900/50">
                    {unreadNotificationsCount}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                id="customer-portal-refresh-btn"
                onClick={handleRefresh}
                title="تحديث البيانات"
                className={`p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 border border-slate-700/70 shadow-sm transition-all ${
                  isRefreshing ? 'animate-spin text-indigo-400' : ''
                }`}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                id="customer-portal-logout-btn"
                onClick={logoutCustomer}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all shadow-sm"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">خروج</span>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
        
        {/* ========================================================================= */}
        {/* CUSTOMER HERO & COD BALANCE ACCENT CARD */}
        {/* ========================================================================= */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-800/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
            {/* Customer Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {currentCustomer?.name}
                </span>
                {currentCustomer?.companyName && (
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 shadow-inner">
                    {currentCustomer.companyName}
                  </span>
                )}
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <ShieldCheck className="w-4 h-4" />
                  حساب زبون نشط
                </span>
              </div>

              <div className="flex items-center gap-3 sm:gap-5 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-mono text-slate-300">{currentCustomer?.phone || 'بدون هاتف'}</span>
                </span>
                {currentCustomer?.city && (
                  <span className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>محافظة {currentCustomer.city}</span>
                  </span>
                )}
                {currentCustomer?.address && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
                    • {currentCustomer.address}
                  </span>
                )}
              </div>
            </div>

            {/* COD Ready for Payout 3D Badge */}
            <div className="w-full lg:w-auto bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 p-3.5 sm:p-4 rounded-2xl shadow-lg flex items-center justify-between sm:justify-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/50 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">حوالات COD جاهزة للصرف الفوري</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono tracking-tight">
                    {formatCurrency(analytics.collectedAwaitingPayoutSyp, 'SYP')}
                  </span>
                  {analytics.collectedAwaitingPayoutUsd > 0 && (
                    <span className="text-xs sm:text-sm font-bold text-emerald-400/80 font-mono">
                      + {formatCurrency(analytics.collectedAwaitingPayoutUsd, 'USD')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. METRIC KPI TILES WITH 3D DEPTH */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
          {/* Total */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('all')}
            className={`cursor-pointer bg-slate-900/90 border rounded-2xl p-3.5 transition-all shadow-md relative overflow-hidden group ${
              activeTab === 'all' ? 'border-indigo-500 ring-1 ring-indigo-500/40' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">إجمالي الشحنات</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-white font-mono">{formatNumber(analytics.totalShipments)}</span>
              <span className="text-[10px] font-bold text-slate-400">طرد</span>
            </div>
          </motion.div>

          {/* Sent */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('sent')}
            className={`cursor-pointer bg-slate-900/90 border rounded-2xl p-3.5 transition-all shadow-md relative overflow-hidden group ${
              activeTab === 'sent' ? 'border-sky-500 ring-1 ring-sky-500/40' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">طرود أرسلتها</span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-sky-400 font-mono">{formatNumber(analytics.sentShipmentsCount)}</span>
              <span className="text-[10px] font-bold text-sky-400/80">صادرة</span>
            </div>
          </motion.div>

          {/* Received */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('received')}
            className={`cursor-pointer bg-slate-900/90 border rounded-2xl p-3.5 transition-all shadow-md relative overflow-hidden group ${
              activeTab === 'received' ? 'border-purple-500 ring-1 ring-purple-500/40' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">طرود استلمتها</span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-purple-400 font-mono">{formatNumber(analytics.receivedShipmentsCount)}</span>
              <span className="text-[10px] font-bold text-purple-400/80">واردة</span>
            </div>
          </motion.div>

          {/* In Transit */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('in_transit')}
            className={`cursor-pointer bg-slate-900/90 border rounded-2xl p-3.5 transition-all shadow-md relative overflow-hidden group ${
              activeTab === 'in_transit' ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">قيد النقل والتوزيع</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                {formatNumber(analytics.inTransitCount + analytics.withCourierCount)}
              </span>
              <span className="text-[10px] font-bold text-amber-400/80">نشطة</span>
            </div>
          </motion.div>

          {/* Delivered */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('delivered')}
            className={`cursor-pointer bg-slate-900/90 border rounded-2xl p-3.5 transition-all shadow-md relative overflow-hidden group ${
              activeTab === 'delivered' ? 'border-emerald-500 ring-1 ring-emerald-500/40' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">تم التسليم بنجاح</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">{formatNumber(analytics.deliveredCount)}</span>
              <span className="text-[10px] font-bold text-emerald-400/80">
                {analytics.deliverySuccessRate}%
              </span>
            </div>
          </motion.div>

          {/* Returned */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setActiveTab('returned')}
            className={`cursor-pointer bg-slate-900/90 border rounded-2xl p-3.5 transition-all shadow-md relative overflow-hidden group ${
              activeTab === 'returned' ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold">المرتجعات</span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-rose-400 font-mono">{formatNumber(analytics.returnedCount)}</span>
              <span className="text-[10px] font-bold text-slate-400">طرد</span>
            </div>
          </motion.div>
        </section>

        {/* ========================================================================= */}
        {/* 4. UPGRADED TOUCH-FRIENDLY SEARCH & LIVE FILTERING CONTROLS */}
        {/* ========================================================================= */}
        <section className="bg-neutral-950 border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
          
          {/* Main Search Input (Large, Mobile-Optimized Touch Target) */}
          <div className="relative flex items-center">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>

            <input
              id="customer-portal-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم البوليصة، رقم الإيصال، اسم أو هاتف المستلم، أو المحافظة..."
              className="w-full bg-black border-2 border-amber-500/30 hover:border-amber-500/50 focus:border-amber-400 rounded-2xl pr-12 pl-24 sm:pl-28 py-3.5 text-sm sm:text-base text-white placeholder-neutral-500 focus:outline-none focus:ring-4 focus:ring-amber-500/15 transition-all shadow-inner font-medium"
            />

            {/* Clear button & Filter toggle button on the left inside search */}
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}

              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => setIsAdvancedFiltersOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isAdvancedFiltersOpen || activeFiltersCount > 0
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/50'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="خيارات الفلترة المتقدمة"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">فلاتر</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-white text-indigo-950 text-[10px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </motion.button>
            </div>
          </div>

          {/* Touch-Friendly Single-Row Circular Icon Selectors (Full Mobile Width, No Scrolling) */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full text-center">
              {tabItems.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    id={`customer-tab-${tab.key}`}
                    onClick={() => setActiveTab(tab.key as any)}
                    title={`${tab.label} (${tab.count})`}
                    className="flex flex-col items-center justify-center gap-1 group py-0.5 focus:outline-none"
                  >
                    <div
                      className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 shadow-md shadow-indigo-950/60 scale-105'
                          : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <IconComponent className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                      {tab.count > 0 && (
                        <span
                          className={`absolute -top-1 -right-1 min-w-[15px] h-3.5 sm:h-4 px-1 rounded-full text-[9px] font-mono font-black flex items-center justify-center ${
                            isActive
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-bold truncate max-w-full block ${
                        isActive ? 'text-indigo-300 font-black' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    >
                      {tab.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expandable Advanced Filters Tray (Animated Drawer) */}
          <AnimatePresence>
            {isAdvancedFiltersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden pt-3 border-t border-slate-800/80 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  
                  {/* Governorate Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      <span>المحافظة / المدينة</span>
                    </label>
                    <select
                      id="customer-governorate-filter"
                      value={selectedGovernorate}
                      onChange={(e) => setSelectedGovernorate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
                    >
                      <option value="all">كافة المحافظات السورية</option>
                      {SYRIAN_GOVERNORATES.map((gov) => (
                        <option key={gov} value={gov}>
                          {gov}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Range Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>الفترة الزمنية</span>
                    </label>
                    <select
                      id="customer-date-filter"
                      value={selectedDateRange}
                      onChange={(e) => setSelectedDateRange(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
                    >
                      <option value="all">كافة الفترات (سجل كامل)</option>
                      <option value="today">شحنات اليوم فقط</option>
                      <option value="week">آخر 7 أيام</option>
                      <option value="month">آخر 30 يوماً</option>
                    </select>
                  </div>

                  {/* Payment Type Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span>نوع الدفع والتحصيل</span>
                    </label>
                    <select
                      id="customer-payment-filter"
                      value={selectedPaymentType}
                      onChange={(e) => setSelectedPaymentType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
                    >
                      <option value="all">كافة أنواع الدفع</option>
                      <option value="cod">شحنات دفع عند الاستلام (COD)</option>
                      <option value="prepaid">شحنات مدفوعة سلفاً</option>
                    </select>
                  </div>

                  {/* Sorting Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
                      <span>الترتيب والفرز</span>
                    </label>
                    <select
                      id="customer-sort-filter"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
                    >
                      <option value="date_desc">الأحدث تاريخاً أولاً</option>
                      <option value="date_asc">الأقدم تاريخاً أولاً</option>
                      <option value="cod_high">الأعلى قيمة COD</option>
                      <option value="cost_high">الأعلى تكلفة شحن</option>
                    </select>
                  </div>
                </div>

                {/* Reset Filters & Active Tags Toolbar */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>النتائج الحالية: <strong className="text-white font-mono">{filteredParcels.length}</strong> طرد</span>
                    {activeFiltersCount > 0 && (
                      <span className="text-indigo-400 text-[11px]">
                        ({activeFiltersCount} فلاتر نشطة)
                      </span>
                    )}
                  </div>

                  {activeFiltersCount > 0 && (
                    <button
                      onClick={resetAllFilters}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>إعادة ضبط الفلاتر</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ========================================================================= */}
        {/* 5. SHIPMENTS LIST / CARDS VIEW (Touch-Optimized, 3D Accents) */}
        {/* ========================================================================= */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>قائمة الشحنات والطرود</span>
              <span className="text-xs font-normal text-slate-400">
                (تم العثور على {filteredParcels.length} شحنة)
              </span>
            </h2>
          </div>

          {filteredParcels.length === 0 ? (
            /* Empty State */
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
                <Package className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-slate-200">لا توجد شحنات مطابقة</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  لم نجد أي طرود تطابق معايير البحث أو التصفية الحالية. يمكنك مسح البحث أو تغيير التصنيف المختار.
                </p>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-950/50"
                >
                  إعادة ضبط جميع الفلاتر
                </button>
              )}
            </div>
          ) : (
            /* Shipment Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {filteredParcels.map((parcel) => {
                const isSentByMe =
                  parcel.sender?.phone === currentCustomer?.phone ||
                  parcel.sender?.customerId === currentCustomer?.id;
                const codCur = parcel.codCurrency || (parcel.codAmount > 1000 ? 'SYP' : parcel.currency);

                return (
                  <motion.div
                    key={parcel.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    id={`customer-parcel-card-${parcel.id}`}
                    onClick={() => setSelectedParcel(parcel)}
                    className="bg-slate-900/90 border border-slate-800/90 hover:border-indigo-500/70 rounded-3xl p-4 sm:p-5 transition-all cursor-pointer shadow-lg hover:shadow-indigo-950/40 relative overflow-hidden group flex flex-col justify-between"
                  >
                    {/* Direction Visual Bar */}
                    <div
                      className={`absolute top-0 right-0 w-1.5 h-full ${
                        isSentByMe ? 'bg-sky-500' : 'bg-purple-500'
                      }`}
                    />

                    <div>
                      {/* Card Header: Tracking Number, Direction Tag, and Status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white font-mono group-hover:text-indigo-400 transition-colors">
                              {parcel.trackingNumber}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                                isSentByMe
                                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                  : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              }`}
                            >
                              {isSentByMe ? 'صادرة منك' : 'واردة إليك'}
                            </span>
                          </div>

                          {parcel.paperReceiptNumber && (
                            <p className="text-xs text-slate-400 font-mono flex items-center gap-1">
                              <FileText className="w-3 h-3 text-slate-500" />
                              <span>إيصال يدوي: {parcel.paperReceiptNumber}</span>
                            </p>
                          )}
                        </div>

                        <div>{getStatusBadge(parcel.handlingStatus)}</div>
                      </div>

                      {/* Origin to Destination Hub Route with 3D Connector */}
                      <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 mb-3.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/50" />
                          <div className="truncate">
                            <span className="text-[10px] text-slate-500 block">من</span>
                            <span className="text-slate-200 font-bold truncate">
                              {getBranchName(parcel.originHubId)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center px-2">
                          <ChevronRight className="w-4 h-4 text-slate-600 rotate-180" />
                        </div>

                        <div className="flex items-center gap-2 min-w-0 text-left">
                          <div className="truncate">
                            <span className="text-[10px] text-slate-500 block text-right">إلى</span>
                            <span className="text-slate-200 font-bold truncate">
                              {getBranchName(parcel.destinationHubId)}
                            </span>
                          </div>
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0 shadow-sm shadow-indigo-400/50" />
                        </div>
                      </div>

                      {/* Parties Info */}
                      <div className="grid grid-cols-2 gap-3 text-xs mb-3.5">
                        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block">المرسل</span>
                          <p className="font-bold truncate text-slate-200">{parcel.sender.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{parcel.sender.phone}</p>
                        </div>
                        <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-bold block">المستلم</span>
                          <p className="font-bold truncate text-slate-200">{parcel.receiver.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{parcel.receiver.phone}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer: COD, Shipping Cost, Date, Quick Actions */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-3">
                        {parcel.paymentType === 'cod' && parcel.codAmount > 0 ? (
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block">مبلغ الـ COD</span>
                            <span className="font-black text-amber-400 font-mono text-sm">
                              {formatCurrency(parcel.codAmount, codCur)}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block">نوع الدفع</span>
                            <span className="font-bold text-emerald-400">مدفوع سلفاً</span>
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">أجور الشحن</span>
                          <span className="font-bold text-slate-300 font-mono text-xs">
                            {formatCurrency(parcel.shippingCost, parcel.shippingCurrency || parcel.currency)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareTrackingWhatsApp(parcel);
                          }}
                          className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
                          title="مشاركة عبر واتساب"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedParcel(parcel);
                          }}
                          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-indigo-950/40 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>تتبع</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 6. DETAILED PARCEL TRACKING MODAL & LIVE TIMELINE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedParcel && (
          <div
            id="customer-parcel-detail-modal"
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setSelectedParcel(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-white font-mono">
                      {selectedParcel.trackingNumber}
                    </h3>
                    <button
                      onClick={() => handleCopy(selectedParcel.trackingNumber, 'تم نسخ رقم البوليصة')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="نسخ رقم البوليصة"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    {copyFeedback && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">
                        {copyFeedback}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تاريخ التسجيل:{' '}
                    {new Date(selectedParcel.createdAt).toLocaleString('ar-SY', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShareTrackingWhatsApp(selectedParcel)}
                    className="p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1.5 text-xs font-bold"
                    title="مشاركة عبر واتساب"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">مشاركة واتساب</span>
                  </button>
                  <button
                    onClick={() => setSelectedParcel(null)}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* LIVE STEP-BY-STEP PROGRESS TIMELINE */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <span>المسار اللوجستي الحي للشحنة</span>
                </h4>

                <div className="relative pr-3 pl-2 py-2">
                  <div className="space-y-5 relative before:absolute before:inset-0 before:right-3.5 before:w-0.5 before:bg-slate-800">
                    
                    {/* Step 1: Registered */}
                    <div className="relative flex items-start gap-3.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shrink-0 ring-4 ring-slate-950 shadow-md shadow-emerald-500/30">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">استلام وتسجيل الشحنة</p>
                        <p className="text-[11px] text-slate-400">
                          في فرع {getBranchName(selectedParcel.originHubId)} ({new Date(selectedParcel.createdAt).toLocaleDateString('ar-SY')})
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Loaded & In Transit */}
                    <div className="relative flex items-start gap-3.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ring-4 ring-slate-950 ${
                          selectedParcel.handlingStatus !== 'received_at_origin_hub' &&
                          selectedParcel.handlingStatus !== 'received_at_hub'
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">تحميل ونقل بين الفروع والمحافظات</p>
                        <p className="text-[11px] text-slate-400">
                          {selectedParcel.truckManifestId
                            ? `ضمن مانافيست الشحن [${selectedParcel.truckManifestId}]`
                            : 'النقل اللوجستي المعتمد'}
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Arrived at Destination Hub */}
                    <div className="relative flex items-start gap-3.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ring-4 ring-slate-950 ${
                          selectedParcel.handlingStatus === 'received_at_dest' ||
                          selectedParcel.handlingStatus === 'with_courier' ||
                          selectedParcel.handlingStatus === 'delivered'
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">وصول لفرع الوجهة</p>
                        <p className="text-[11px] text-slate-400">
                          مركز التوزيع: {getBranchName(selectedParcel.destinationHubId)}
                        </p>
                      </div>
                    </div>

                    {/* Step 4: Out with Courier */}
                    <div className="relative flex items-start gap-3.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ring-4 ring-slate-950 ${
                          selectedParcel.handlingStatus === 'with_courier' ||
                          selectedParcel.handlingStatus === 'delivered'
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">التسليم للمستلم</p>
                        <p className="text-[11px] text-slate-400">
                          {selectedParcel.assignedCourierName
                            ? `مع الموزع: ${selectedParcel.assignedCourierName}`
                            : 'جاهز للاستلام المباشر أو التوصيل بالدراجة/السيارة'}
                        </p>
                      </div>
                    </div>

                    {/* Step 5: Delivered */}
                    <div className="relative flex items-start gap-3.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ring-4 ring-slate-950 ${
                          selectedParcel.handlingStatus === 'delivered'
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">اكتمال التسليم للمستلم</p>
                        <p className="text-[11px] text-slate-400">
                          {selectedParcel.deliveredAt
                            ? `تم التسليم بنجاح بتاريخ ${new Date(selectedParcel.deliveredAt).toLocaleString('ar-SY')}`
                            : 'بانتظار إتمام التسليم للمستلم'}
                        </p>
                      </div>
                    </div>

                    {/* Step 6: COD Payout to Sender (For COD Shipments) */}
                    {selectedParcel.paymentType === 'cod' && selectedParcel.codAmount > 0 && (
                      <div className="relative flex items-start gap-3.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ring-4 ring-slate-950 ${
                            selectedParcel.codPaidToSender || selectedParcel.codPayoutStatus === 'paid_to_sender' || selectedParcel.codStatus === 'paid_to_sender'
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                              : selectedParcel.handlingStatus === 'delivered' || selectedParcel.isCodCollectedByCashier || Boolean(selectedParcel.cashierCollected)
                              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30 animate-pulse'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {selectedParcel.codPaidToSender || selectedParcel.codPayoutStatus === 'paid_to_sender' || selectedParcel.codStatus === 'paid_to_sender'
                              ? 'صرف وتسليم الحوالة للمرسل (تم التسليم ✓)'
                              : selectedParcel.handlingStatus === 'delivered' || selectedParcel.isCodCollectedByCashier || Boolean(selectedParcel.cashierCollected)
                              ? 'الحوالة المالية مستحقة وجاهزة للصرف الفوري 💰'
                              : 'استحقاق صرف الحوالة المالية'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {selectedParcel.codPaidToSender || selectedParcel.codPayoutStatus === 'paid_to_sender' || selectedParcel.codStatus === 'paid_to_sender'
                              ? `تم صرف وتسليم مبلغ (${formatCurrency(selectedParcel.codAmount, selectedParcel.codCurrency || selectedParcel.currency)}) للمستلم (${selectedParcel.codSenderRecipientName || selectedParcel.sender.name})${selectedParcel.codSenderPayoutVoucherNumber ? ` بموجب سند صرف رقم [${selectedParcel.codSenderPayoutVoucherNumber}]` : ''}${selectedParcel.codSenderPayoutDate ? ` بتاريخ ${new Date(selectedParcel.codSenderPayoutDate).toLocaleDateString('ar-SY')}` : ''}`
                              : selectedParcel.handlingStatus === 'delivered' || selectedParcel.isCodCollectedByCashier || Boolean(selectedParcel.cashierCollected)
                              ? 'تم تحصيل قيمة الطرد من المستلم، يمكنك مراجعة الفرع المصدر لصرف واستلام الحوالة نقدياً.'
                              : 'سيتم تجهيز وإشعاركم بصرف الحوالة فور تسليم الطرد وقبض المبلغ من المستلم.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SENDER & RECEIVER CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    بيانات المرسل
                  </span>
                  <p className="text-sm font-bold text-white">{selectedParcel.sender.name}</p>
                  <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {selectedParcel.sender.phone}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {selectedParcel.sender.city} - {selectedParcel.sender.address || 'بدون تفصيل'}
                  </p>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    بيانات المستلم
                  </span>
                  <p className="text-sm font-bold text-white">{selectedParcel.receiver.name}</p>
                  <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {selectedParcel.receiver.phone}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {selectedParcel.receiver.city} - {selectedParcel.destinationAddress || selectedParcel.receiver.address || 'استلام بالفرع'}
                  </p>
                </div>
              </div>

              {/* FINANCIALS & SPECS */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block mb-1">نوع الشحنة</span>
                  <span className="font-bold text-white">{selectedParcel.packageType || 'طرد عادي'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-1">الوزن والقطع</span>
                  <span className="font-bold text-white font-mono">
                    {selectedParcel.weightKg || 1} كغ / {selectedParcel.piecesCount || 1} قطع
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-1">أجور الشحن</span>
                  <span className="font-bold text-white font-mono">
                    {formatCurrency(selectedParcel.shippingCost, selectedParcel.shippingCurrency || selectedParcel.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-1">مبلغ الـ COD</span>
                  <span className="font-black text-amber-400 font-mono text-sm">
                    {selectedParcel.paymentType === 'cod' && selectedParcel.codAmount > 0
                      ? formatCurrency(selectedParcel.codAmount, selectedParcel.codCurrency || selectedParcel.currency)
                      : 'مدفوع سلفاً'}
                  </span>
                </div>
              </div>

              {/* Content Description */}
              {selectedParcel.contentDescription && (
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-300">
                  <span className="text-slate-400 font-bold block mb-1">وصف المحتويات:</span>
                  <p className="leading-relaxed">{selectedParcel.contentDescription}</p>
                </div>
              )}

              {/* Modal Footer Controls (No Print, Clean Touch Actions) */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedParcel(null)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. CUSTOMER NOTIFICATIONS MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isNotificationsModalOpen && (
          <div
            id="customer-notifications-modal"
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setIsNotificationsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">إشعارات الشحنات والحوالات</h3>
                </div>
                <div className="flex items-center gap-2">
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={() => markAllNotificationsRead()}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold transition-all"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                  <button
                    onClick={() => setIsNotificationsModalOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {customerNotifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600" />
                    <p>لا توجد إشعارات جديدة حالياً.</p>
                  </div>
                ) : (
                  customerNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markNotificationRead(n.id)}
                      className={`border rounded-2xl p-3.5 space-y-1.5 transition-all cursor-pointer ${
                        !n.read
                          ? 'bg-slate-900 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 animate-pulse" />
                          )}
                          <p className="text-xs font-bold text-white">{n.title}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                          {new Date(n.timestamp).toLocaleDateString('ar-SY', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setIsNotificationsModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 8. FINANCIAL STATEMENT & COD PAYOUTS MODAL (CONDENSED & SIMPLE EXPLANATION) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isStatementModalOpen && (
          <div
            id="customer-statement-modal"
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setIsStatementModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span>مستحقات وحوالات الدفع عند الاستلام (COD)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    العميل: {currentCustomer?.name} ({currentCustomer?.phone})
                  </p>
                </div>
                <button
                  onClick={() => setIsStatementModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Brief, Simple Explanation Banner */}
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-slate-300">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-bold text-indigo-300 block">كيف تعمل حوالات الـ COD؟</span>
                  <p className="text-slate-300 text-[11px]">
                    يتم تحصيل قيمة البضاعة نقداً من المستلم عند تسليم الطرد، وفور توريد المبلغ تصبح الحوالة جاهزة للصرف فوراً من أقرب فرع إليك.
                  </p>
                </div>
              </div>

              {/* Financial Summary Condensed Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">إجمالي مبالغ COD</span>
                  <span className="text-sm sm:text-base font-black text-white font-mono block">
                    {formatCurrency(analytics.totalCodDueSyp, 'SYP')}
                  </span>
                  {analytics.totalCodDueUsd > 0 && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      + {formatCurrency(analytics.totalCodDueUsd, 'USD')}
                    </span>
                  )}
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl space-y-0.5">
                  <span className="text-[10px] text-emerald-400 font-bold block">
                    جاهزة للصرف الآن 💰
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-400 font-mono block">
                    {formatCurrency(analytics.collectedAwaitingPayoutSyp, 'SYP')}
                  </span>
                  {analytics.collectedAwaitingPayoutUsd > 0 && (
                    <span className="text-[10px] text-emerald-300 block font-mono">
                      + {formatCurrency(analytics.collectedAwaitingPayoutUsd, 'USD')}
                    </span>
                  )}
                </div>

                <div className="col-span-2 sm:col-span-1 bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">حوالات تم صرفها لك</span>
                  <span className="text-sm sm:text-base font-black text-slate-300 font-mono block">
                    {formatCurrency(analytics.paidToSenderSyp, 'SYP')}
                  </span>
                  {analytics.paidToSenderUsd > 0 && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      + {formatCurrency(analytics.paidToSenderUsd, 'USD')}
                    </span>
                  )}
                </div>
              </div>

              {/* Condensed COD Records List (Mobile-First, Essential Data Only) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300">سجل طرود الـ COD الخاصة بك</h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {sent.filter((p) => p.paymentType === 'cod' && (p.codAmount || 0) > 0).length} طرد
                  </span>
                </div>

                <div className="space-y-2 max-h-[42vh] overflow-y-auto custom-scrollbar pr-0.5">
                  {sent
                    .filter((p) => p.paymentType === 'cod' && (p.codAmount || 0) > 0)
                    .map((p) => {
                      const isDelivered =
                        p.handlingStatus === 'delivered' ||
                        p.isCodCollectedByCashier ||
                        Boolean(p.cashierCollected) ||
                        p.codStatus === 'collected_awaiting_sender_payout' ||
                        p.codStatus === 'sender_notified';
                      const isPaidOut =
                        Boolean(p.codPaidToSender) ||
                        p.codPayoutStatus === 'paid_to_sender' ||
                        p.codStatus === 'paid_to_sender';

                      return (
                        <div
                          key={p.id}
                          className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 flex items-center justify-between gap-2.5 hover:border-slate-700 transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-white text-xs">
                                {p.trackingNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans truncate">
                                إلى: {p.receiver.name} ({getBranchName(p.destinationHubId)})
                              </span>
                            </div>
                            <div className="text-xs font-black text-amber-400 font-mono">
                              {formatCurrency(p.codAmount, p.codCurrency || p.currency)}
                            </div>
                          </div>

                          <div className="shrink-0 text-left">
                            {isPaidOut ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="px-2.5 py-1 rounded-xl bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold block text-center shadow-xs">
                                  تم الصرف والتسليم ✓
                                </span>
                                {p.codSenderPayoutVoucherNumber && (
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    سند: {p.codSenderPayoutVoucherNumber}
                                  </span>
                                )}
                              </div>
                            ) : isDelivered ? (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[10px] block text-center">
                                جاهزة للصرف 💰
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-xl bg-amber-500/10 text-amber-300 text-[10px] font-bold block text-center">
                                قيد التوصيل
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {sent.filter((p) => p.paymentType === 'cod' && (p.codAmount || 0) > 0).length === 0 && (
                    <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800/60">
                      لا توجد شحنات دفع عند الاستلام مسجلة حالياً.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setIsStatementModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
