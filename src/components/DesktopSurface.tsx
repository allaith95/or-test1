import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { useOrca, ActiveModule } from '../context/OrcaContext';
import { safeStorage } from '../utils/storage';
import { OrcaDesktopWatermark } from './OrcaDesktopWatermark';
import { ROLE_DEFINITIONS } from '../utils/permissionEngine';
import { OfficerFinancialBar } from './OfficerFinancialBar';
import {
  Building2,
  Coins,
  TrendingUp,
  MessageSquare,
  ArrowUpRight,
  PackagePlus,
  Truck,
  Warehouse,
  PackageCheck,
  Calculator,
  Users,
  BarChart3,
  ShieldCheck,
  Database,
  GripVertical,
  RotateCcw,
  Check,
  Monitor,
  Receipt,
  HandCoins,
  History,
} from 'lucide-react';

interface DesktopSurfaceProps {
  onOpenModule: (mod: ActiveModule) => void;
  onOpenSearch: () => void;
  onOpenDirectives: () => void;
}

export const DesktopSurface: React.FC<DesktopSurfaceProps> = ({
  onOpenModule,
  onOpenDirectives,
}) => {
  const {
    currentBranch,
    branches,
    branchesWithDerivedBalances,
    parcels,
    truckManifests,
    brandingSettings,
    currentUser,
    canAccessModule,
    hasPermission,
    formatCurrency,
    formatNumber,
    openCodSenderPayoutModal,
  } = useOrca();

  // Parcels awaiting COD payout to senders strictly originating from current active branch
  const isAuthorizedForCod = useMemo(() => {
    const allowedRoles = ['super_admin', 'hub_manager', 'branch_manager', 'accountant', 'cashier', 'outbound_operator', 'operations', 'admin'];
    return allowedRoles.includes(currentUser?.role || '');
  }, [currentUser?.role]);

  const readyCodPayouts = useMemo(() => {
    if (!isAuthorizedForCod) return [];
    return parcels.filter((p) => {
      const isOrigin = currentUser?.role === 'super_admin' || p.originHubId === currentBranch?.id || p.originBranchId === currentBranch?.id;
      const isCod = p.paymentType === 'cod' && (p.codAmount || 0) > 0;
      const isDeliveredOrCollected =
        p.handlingStatus === 'delivered' ||
        p.cashierCollected === true ||
        p.codStatus === 'collected_awaiting_sender_payout' ||
        p.codStatus === 'sender_notified';
      const isNotPaidToSender = !p.codPaidToSender && p.codStatus !== 'paid_to_sender';
      return isOrigin && isCod && isDeliveredOrCollected && isNotPaidToSender;
    });
  }, [parcels, currentBranch?.id, isAuthorizedForCod, currentUser?.role]);

  // Calculate live logistics data based on active branch / network
  const todayDateStr = new Date().toISOString().split('T')[0];

  // Relevant parcels for active branch or entire network for super_admin
  const relevantParcels = useMemo(() => {
    return parcels.filter((p) => {
      if (currentUser?.role === 'super_admin') return true;
      return (
        p.originHubId === currentBranch?.id ||
        p.destinationHubId === currentBranch?.id ||
        p.originBranchId === currentBranch?.id ||
        p.originCollectionBranchId === currentBranch?.id
      );
    });
  }, [parcels, currentBranch?.id, currentUser?.role]);

  // Today's registered parcels
  const todayIntakeParcels = useMemo(() => {
    return relevantParcels.filter((p) => {
      const pDate = p.createdAt ? p.createdAt.slice(0, 10) : '';
      return pDate === todayDateStr;
    });
  }, [relevantParcels, todayDateStr]);

  // Active dispatched trucks
  const activeTrucks = useMemo(() => {
    return truckManifests.filter((t) => {
      if (t.status !== 'dispatched') return false;
      if (currentUser?.role === 'super_admin') return true;
      return t.originHubId === currentBranch?.id || t.destinationHubId === currentBranch?.id;
    });
  }, [truckManifests, currentBranch?.id, currentUser?.role]);

  // The 12 Main Apps displayed on the desktop grid
  const gridApps = [
    // App 1: لوحة المؤشرات (الأيقونة الأولى لمدير التطبيق والرقابة الشاملة)
    {
      id: 'dashboard' as ActiveModule,
      title: 'لوحة المؤشرات',
      icon: BarChart3,
      bg: 'bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 shadow-blue-600/30',
      action: () => onOpenModule('dashboard'),
    },
    {
      id: 'cod_payouts' as const,
      title: 'حوالات جاهزة للتسليم',
      badge: readyCodPayouts.length > 0 ? `${readyCodPayouts.length} جاهزة` : undefined,
      badgePulse: readyCodPayouts.length > 0,
      icon: HandCoins,
      bg: readyCodPayouts.length > 0 
        ? 'bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 shadow-rose-600/50' 
        : 'bg-gradient-to-br from-slate-700 to-slate-800',
      action: () => {
        openCodSenderPayoutModal('');
      },
    },
    {
      id: 'intake' as ActiveModule,
      title: 'استقبال الطرود',
      icon: PackagePlus,
      bg: 'bg-gradient-to-br from-sky-400 to-blue-600',
      action: () => onOpenModule('intake'),
    },
    {
      id: 'manifests' as ActiveModule,
      title: 'مانافيست...',
      icon: Truck,
      bg: 'bg-gradient-to-br from-amber-500 to-orange-500',
      action: () => onOpenModule('manifests'),
    },
    {
      id: 'arrivals' as ActiveModule,
      title: 'مستودع الوصول',
      icon: Warehouse,
      bg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
      action: () => onOpenModule('arrivals'),
    },
    {
      id: 'delivery' as ActiveModule,
      title: 'التسليم',
      icon: PackageCheck,
      bg: 'bg-gradient-to-br from-purple-500 to-indigo-600',
      action: () => onOpenModule('delivery'),
    },
    {
      id: 'cashbox' as ActiveModule,
      title: 'الخزينة والصناديق',
      icon: Coins,
      bg: 'bg-gradient-to-br from-amber-400 to-yellow-500',
      action: () => onOpenModule('cashbox'),
    },
    {
      id: 'expenses' as ActiveModule,
      title: 'سجل المصاريف',
      icon: Receipt,
      bg: 'bg-gradient-to-br from-amber-600 to-yellow-700',
      action: () => onOpenModule('expenses'),
    },
    {
      id: 'pricing' as ActiveModule,
      title: 'محرك التسعير',
      icon: Calculator,
      bg: 'bg-gradient-to-br from-pink-500 to-rose-600',
      action: () => onOpenModule('pricing'),
    },
    {
      id: 'admin_users' as ActiveModule,
      title: 'الفروع...',
      icon: Users,
      bg: 'bg-gradient-to-br from-sky-400 to-blue-500',
      action: () => onOpenModule('admin_users'),
    },
    {
      id: 'master_admin' as ActiveModule,
      title: 'المدير التنفيذي',
      badge: 'إدارة عليا',
      icon: ShieldCheck,
      bg: 'bg-gradient-to-br from-fuchsia-600 to-purple-700',
      action: () => onOpenModule('master_admin'),
    },
    {
      id: 'directives' as const,
      title: 'الكتب والتوجيهات',
      icon: MessageSquare,
      bg: 'bg-gradient-to-br from-pink-500 to-purple-600',
      action: onOpenDirectives,
    },
    {
      id: 'fixed_assets' as ActiveModule,
      title: 'الأصول الثابتة',
      icon: Monitor,
      bg: 'bg-gradient-to-br from-violet-600 to-purple-800',
      action: () => onOpenModule('fixed_assets'),
    },
    {
      id: 'backup_cloud' as ActiveModule,
      title: 'النسخ الاحتياطي',
      icon: Database,
      bg: 'bg-gradient-to-br from-slate-600 to-slate-800',
      action: () => onOpenModule('backup_cloud'),
    },
  ];

  // Strictly filter desktop apps based on user role permissions
  const allowedGridApps = useMemo(() => {
    return gridApps.filter((app) => {
      if (app.id === 'cod_payouts') {
        return (
          currentUser.role === 'super_admin' ||
          currentUser.role === 'hub_manager' ||
          canAccessModule('intake') ||
          canAccessModule('delivery') ||
          canAccessModule('cashbox') ||
          hasPermission('delivery.handover')
        );
      }
      if (app.id === 'directives') {
        return (
          currentUser.role === 'super_admin' ||
          currentUser.role === 'hub_manager' ||
          hasPermission('dashboard.view')
        );
      }
      return canAccessModule(app.id);
    });
  }, [gridApps, currentUser.role, hasPermission, canAccessModule]);

  // Desktop icons custom ordering saved in localStorage
  const [customAppOrder, setCustomAppOrder] = useState<string[]>(() => {
    try {
      const userKey = `orca_desktop_apps_order_${currentUser?.id || 'default'}`;
      const saved = safeStorage.getItem(userKey) || safeStorage.getItem('orca_desktop_apps_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse desktop apps order from localStorage', e);
    }
    return [];
  });

  // Reload custom order if current user changes
  useEffect(() => {
    try {
      const userKey = `orca_desktop_apps_order_${currentUser?.id || 'default'}`;
      const saved = safeStorage.getItem(userKey) || safeStorage.getItem('orca_desktop_apps_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomAppOrder(parsed);
          return;
        }
      }
      setCustomAppOrder([]);
    } catch {
      setCustomAppOrder([]);
    }
  }, [currentUser?.id]);

  // Sorted apps based on custom order from localStorage
  const sortedGridApps = useMemo(() => {
    let list = [...allowedGridApps];
    if (customAppOrder && customAppOrder.length > 0) {
      list.sort((a, b) => {
        const indexA = customAppOrder.indexOf(a.id);
        const indexB = customAppOrder.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
    // لمدير التطبيق (Super Admin): لوحة المؤشرات دائماً هي الأيقونة الأولى للمراقبة الشاملة
    if (currentUser.role === 'super_admin') {
      const dashIdx = list.findIndex((a) => a.id === 'dashboard');
      if (dashIdx > 0) {
        const [dashApp] = list.splice(dashIdx, 1);
        list.unshift(dashApp);
      }
    }
    return list;
  }, [allowedGridApps, customAppOrder, currentUser.role]);

  // Drag and drop state
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [dragOverAppId, setDragOverAppId] = useState<string | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragEndTimeRef = useRef<number>(0);
  const [showSavedNotification, setShowSavedNotification] = useState<boolean>(false);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedAppId(id);
    isDraggingRef.current = true;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverAppId !== id) {
      setDragOverAppId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedAppId;
    if (!sourceId || sourceId === targetId) {
      setDraggedAppId(null);
      setDragOverAppId(null);
      return;
    }

    const currentIds = sortedGridApps.map((a) => a.id);
    const sourceIndex = currentIds.indexOf(sourceId as any);
    const targetIndex = currentIds.indexOf(targetId as any);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const newOrder = [...currentIds];
      const [movedItem] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, movedItem);

      setCustomAppOrder(newOrder);

      try {
        const userKey = `orca_desktop_apps_order_${currentUser?.id || 'default'}`;
        safeStorage.setItem(userKey, JSON.stringify(newOrder));
        safeStorage.setItem('orca_desktop_apps_order', JSON.stringify(newOrder));
      } catch (err) {
        console.error('Failed to save reordered desktop apps in storage', err);
      }

      setShowSavedNotification(true);
      setTimeout(() => setShowSavedNotification(false), 2200);
    }

    setDraggedAppId(null);
    setDragOverAppId(null);
  };

  const handleDragEnd = () => {
    setDraggedAppId(null);
    setDragOverAppId(null);
    dragEndTimeRef.current = Date.now();
    isDraggingRef.current = false;
  };

  const handleAppClick = (appAction: () => void) => {
    // Only block click if an active drag was in progress with actual drop target
    if (isDraggingRef.current) {
      return;
    }
    appAction();
  };

  const handleResetOrder = () => {
    setCustomAppOrder([]);
    try {
      const userKey = `orca_desktop_apps_order_${currentUser?.id || 'default'}`;
      safeStorage.removeItem(userKey);
      safeStorage.removeItem('orca_desktop_apps_order');
    } catch (e) {
      console.error('Failed to reset app order', e);
    }
  };

  return (
    <div
      id="orca_fluent_desktop_surface"
      className="w-full h-full min-h-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative select-none overflow-y-auto custom-scrollbar"
    >
      {/* Ambient background depth lights & Watermark */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px]" />
        {/* Shaded Desktop Background Watermark: ORCA EXPRESS Logo & Name */}
        <OrcaDesktopWatermark />
      </div>

      <div className="relative z-10 max-w-[1680px] mx-auto w-full flex-1 flex flex-col justify-between gap-6 sm:gap-8">
        {/* ========================================================================= */}
        {/* 1. TOP 4 CARDS (WIDGETS) - Shown ONLY for users with Dashboard / Analytics permission */}
        {/* For restricted roles (data entry, counter, delivery, cashier): clean banner without extra stats */}
        {/* ========================================================================= */}
        {canAccessModule('dashboard') ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1 (Far right in RTL): الفرع النشط حالياً */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">الفرع النشط حالياً</span>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 truncate max-w-[200px]">
                  {currentBranch?.id ? currentBranch.name : 'كافة الفروع (إشراف عام)'}
                </h3>
                <span className="text-xs text-cyan-400 font-semibold block mt-0.5">
                  {currentBranch?.id && currentBranch.governorate
                    ? `محافظة ${currentBranch.governorate}`
                    : 'نظام مركزي'}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: الصندوق الموحد لمدير التطبيق / سجل الحركات للأدوار */}
            {currentUser?.role === 'super_admin' ? (
              <div className="bg-slate-900/60 backdrop-blur-md border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
                <div className="text-right">
                  <span className="text-[11px] text-amber-300 block font-bold">
                    الصندوق الموحد (إجمالي أرصدة الخزائن)
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 font-mono">
                    {formatCurrency(branchesWithDerivedBalances.reduce((sum, b) => sum + (b.boxSypBalance || 0), 0), 'SYP')}
                  </h3>
                  <span className="text-xs text-cyan-400 font-mono font-bold block mt-0.5">
                    {formatCurrency(branchesWithDerivedBalances.reduce((sum, b) => sum + (b.boxUsdBalance || 0), 0), 'USD')}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg">
                  <Coins className="w-6 h-6" />
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block font-medium">سجل الحركات والكشف المالي</span>
                  <h3 className="text-sm font-bold text-amber-300 tracking-tight mt-1">
                    محفوظ وموثق في سجل العمليات
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                    استعراض الرصيد والكشف عبر زر (سجل الحركات)
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg">
                  <History className="w-6 h-6" />
                </div>
              </div>
            )}

            {/* Card 3: حركة الشحن اللحظية */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">حركة الشحن اللحظية</span>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {formatNumber(todayIntakeParcels.length)}
                  </span>
                  <span className="text-xs text-slate-300 font-medium">طرد اليوم</span>
                  <span className="text-[10.5px] text-slate-400 font-mono">({formatNumber(relevantParcels.length)} إجمالي)</span>
                </div>
                <div className="text-xs text-amber-400/90 font-medium mt-0.5 flex items-center gap-1">
                  <span className="font-bold font-mono text-amber-300">{formatNumber(activeTrucks.length)}</span>
                  <span>شاحنة ترحيل نشطة</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: الكتب والتوجيهات الإدارية */}
            <div
              onClick={onOpenDirectives}
              className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xl relative cursor-pointer hover:border-purple-500/40 transition-all group"
            >
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors absolute top-3.5 left-3.5" />
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">الكتب والتوجيهات الإدارية</span>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight mt-0.5">
                  جميع التوجيهات مستلمة
                </h3>
                <span className="text-xs text-purple-400 font-medium block mt-0.5">
                  اضغط لفتح صندوق المراسلات
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-lg">
                <MessageSquare className="w-6 h-6" />
              </div>
            </div>
          </div>
        ) : (
          /* Simplified operational workspace banner for roles without dashboard */
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">منظومة الواجهات التشغيلية المعتمدة</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                    {currentUser?.role ? (ROLE_DEFINITIONS[currentUser.role]?.title || 'الدور التشغيلي') : 'المستخدم'}
                  </span>
                </div>
                <span className="text-xs text-slate-400 block mt-1">
                  فرع العمل: {currentBranch?.name || 'فرع المركز'} • الواجهات المتاحة محددة ومحصورة حصراً بنطاق عمل هذا الدور
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 bg-slate-950/90 px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                <span className="text-slate-400">المستخدم الحالي:</span>
                <strong className="text-cyan-300 font-bold">{currentUser?.name || 'المستخدم'}</strong>
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FINANCIAL CONTROL & SHIFT SETTLEMENT BAR (سجل الحركات، قيم الصناديق، تحضير الترصيد) */}
        {/* ========================================================================= */}
        <OfficerFinancialBar onOpenModule={onOpenModule} />

        {/* ========================================================================= */}
        {/* 2. THE MIDDLE TILES (Draggable & Reorderable with localStorage Persistence) */}
        {/* ========================================================================= */}
        <div className="my-auto py-4 sm:py-6">
          {/* Sub-header / Reorder tools bar */}
          <div className="max-w-[1440px] mx-auto mb-3 px-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <GripVertical className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-300">تطبيقات ومنظومات العمل</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                (يمكنك سحب وإفلات الأيقونات لإعادة ترتيبها بحسب رغبتك)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {showSavedNotification && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold shadow-lg animate-in fade-in zoom-in-95 duration-200">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  تم حفظ الترتيب في التخزين المحلي
                </span>
              )}

              {customAppOrder.length > 0 && (
                <button
                  type="button"
                  id="reset_desktop_apps_order_btn"
                  onClick={handleResetOrder}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-slate-700 text-[11px] font-medium transition cursor-pointer"
                  title="استعادة الترتيب التلقائي الأصلي"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>الترتيب الافتراضي</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-5 max-w-[1440px] mx-auto">
            {sortedGridApps.map((app) => {
              const Icon = app.icon;
              const isBeingDragged = draggedAppId === app.id;
              const isDragOverTarget = dragOverAppId === app.id && !isBeingDragged;
              const isPulsing = (app as any).badgePulse;

              return (
                <motion.div
                  key={app.id}
                  layout
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, app.id)}
                  onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, app.id)}
                  onDragLeave={(e) => handleDragLeave(e as unknown as React.DragEvent)}
                  onDrop={(e) => handleDrop(e as unknown as React.DragEvent, app.id)}
                  onDragEnd={handleDragEnd}
                  className="relative group"
                >
                  <button
                    type="button"
                    id={`desktop_app_${app.id}`}
                    onClick={() => handleAppClick(app.action)}
                    className={`w-full relative rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center gap-3 transition-all duration-200 cursor-grab active:cursor-grabbing shadow-lg select-none ${
                      isBeingDragged
                        ? 'opacity-30 border-dashed border-cyan-400 scale-95 ring-2 ring-cyan-500/30 bg-slate-900/40'
                        : isDragOverTarget
                        ? 'border-cyan-400 ring-4 ring-cyan-500/50 bg-slate-800/90 scale-105 shadow-2xl shadow-cyan-500/20'
                        : isPulsing
                        ? 'bg-gradient-to-b from-rose-950/60 via-slate-900/80 to-slate-950 border-2 border-rose-500/80 ring-2 ring-rose-500/40 shadow-xl shadow-rose-950/50 hover:scale-[1.05]'
                        : 'bg-slate-900/40 hover:bg-slate-850/70 border border-slate-800/80 hover:border-slate-700/80 hover:scale-[1.04]'
                    }`}
                  >
                    {/* Subtle Drag Handle Indicator on Hover */}
                    <div className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-60 text-slate-400 transition-opacity pointer-events-none">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    {/* Badge for executive admin or ready payouts */}
                    {app.badge && (
                      <span
                        className={`absolute -top-2.5 -right-2 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-lg border border-rose-400/50 pointer-events-none ${
                          isPulsing
                            ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white animate-bounce shadow-rose-600/60 text-[11px] ring-2 ring-rose-400/50'
                            : 'bg-rose-600 animate-pulse'
                        }`}
                      >
                        {app.badge}
                      </span>
                    )}

                    {/* Colored Icon Container */}
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${app.bg} flex items-center justify-center text-white shadow-xl shadow-black/30 group-hover:scale-105 transition-transform pointer-events-none ${
                        isPulsing ? 'animate-pulse' : ''
                      }`}
                    >
                      <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${isPulsing ? 'animate-bounce' : ''}`} />
                    </div>

                    {/* App Title */}
                    <span className="text-xs sm:text-sm font-bold text-white text-center tracking-wide group-hover:text-cyan-300 transition-colors truncate max-w-full pointer-events-none">
                      {app.title}
                    </span>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. BOTTOM GOVERNORATES TICKER BAR (above taskbar) */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 px-2 py-1 text-slate-500 text-[11px] font-medium border-t border-slate-850">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">جميع الحقوق محفوظة ل شركة أوركا اكسبريس</span>
            <span>•</span>
            <span className="text-slate-500 text-[10px]">تم تطوير التطبيق من قبل شركة أبديت لحلول الأعمال</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full text-[10px] text-slate-500 whitespace-nowrap custom-scrollbar">
            <span>دمشق</span>
            <span>•</span>
            <span>حلب</span>
            <span>•</span>
            <span>حمص</span>
            <span>•</span>
            <span>حماة</span>
            <span>•</span>
            <span>اللاذقية</span>
            <span>•</span>
            <span>طرطوس</span>
            <span>•</span>
            <span>درعا</span>
            <span>•</span>
            <span>السويداء</span>
            <span>•</span>
            <span>القنيطرة</span>
            <span>•</span>
            <span>دير الزور</span>
            <span>•</span>
            <span>الرقة</span>
            <span>•</span>
            <span>الحسكة</span>
            <span>•</span>
            <span>إدلب</span>
          </div>
        </div>
      </div>
    </div>
  );
};
