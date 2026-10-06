import React, { useState, useEffect, useRef } from 'react';
import { useOrca, ActiveModule } from '../context/OrcaContext';
import { deriveConnectionState } from '../utils/connectionState';
import {
  Search,
  Building2,
  Bell,
  Lock,
  ChevronDown,
  ArrowLeftRight,
  MessageSquare,
  TrendingUp,
  Monitor,
  PackagePlus,
  Truck,
  Warehouse,
  PackageCheck,
  Coins,
  Calculator,
  Users,
  BarChart3,
  ShieldCheck,
  Database,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Calendar,
  Clock,
  Receipt,
  Globe,
  Check,
  Crown,
  X,
} from 'lucide-react';
import { ALL_BRANCHES_SUPERVISION_BRANCH } from '../data/initialData';

// Custom Notification Center Icon
const NotificationsCenterIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor">
    <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" strokeWidth="1.3" />
    <line x1="4.5" y1="5" x2="11.5" y2="5" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="4.5" y1="8" x2="11.5" y2="8" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="4.5" y1="11" x2="8.5" y2="11" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// Connection Status Badge Component (Prompt 68)
const ConnectionStatusBadge: React.FC<{ state: string }> = ({ state }) => {
  const colors: Record<string, { dot: string; text: string; pulse: boolean }> = {
    connected: { dot: 'bg-emerald-400', text: 'متصل', pulse: false },
    CONNECTED: { dot: 'bg-emerald-400', text: 'متصل', pulse: false },
    syncing:   { dot: 'bg-amber-400',   text: 'جاري المزامنة', pulse: true },
    RECONNECTING: { dot: 'bg-amber-400', text: 'جاري المزامنة', pulse: true },
    error:     { dot: 'bg-rose-400',    text: 'خطأ', pulse: true },
    offline:   { dot: 'bg-slate-400',   text: 'غير متصل', pulse: false },
    DISCONNECTED: { dot: 'bg-rose-500', text: 'غير متصل', pulse: false },
    DEGRADED_LOCAL: { dot: 'bg-orange-400', text: 'تخزين مؤقت', pulse: false },
  };
  const c = colors[state] || colors.offline;
  return (
    <span className="flex items-center gap-1 text-[10px]">
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.pulse ? 'animate-pulse' : ''}`} />
      <span className="hidden sm:inline font-bold">{c.text}</span>
    </span>
  );
};

interface DesktopTaskbarProps {
  isDesktopVisible: boolean;
  onToggleShowDesktop: () => void;
  onToggleStartMenu: () => void;
  isStartMenuOpen: boolean;
  onOpenSearch: () => void;
  onToggleNotifications: () => void;
  isNotificationsOpen: boolean;
  onToggleQuickActions: () => void;
  isQuickActionsOpen: boolean;
  onOpenDirectives: () => void;
  onOpenIntegrityHub?: () => void;
  onSelectModule: (mod: ActiveModule) => void;
}

// Isolated Live Clock Component to avoid re-rendering the entire taskbar every second
const LiveSystemClock: React.FC<{
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}> = React.memo(({ isFullscreen, onToggleFullscreen }) => {
  const [currentTime, setCurrentTime] = useState<string>('10:52 ص');
  const [currentDate, setCurrentDate] = useState<string>('2026/09/05');
  const [fullSecondsTime, setFullSecondsTime] = useState<string>('10:52:16 ص');
  const [dayNameDate, setDayNameDate] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const isPM = hours >= 12;
      const period = isPM ? 'م' : 'ص';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      setCurrentTime(`${hours}:${minutes} ${period}`);

      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      setCurrentDate(`${year}/${month}/${day}`);

      const seconds = now.getSeconds().toString().padStart(2, '0');
      setFullSecondsTime(`${hours}:${minutes}:${seconds} ${period}`);

      try {
        setDayNameDate(
          now.toLocaleDateString('ar-SY', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        );
      } catch {
        setDayNameDate(`${year}/${month}/${day}`);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Windows Calendar Flyout */}
      {isCalendarOpen && (
        <div
          className="absolute left-0 bottom-13 w-72 bg-slate-900/98 backdrop-blur-3xl border border-slate-750/90 rounded-xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-200"
          onMouseLeave={() => setIsCalendarOpen(false)}
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
            <div>
              <div className="text-sm font-bold text-white font-mono">{fullSecondsTime}</div>
              <div className="text-[11px] text-cyan-400 font-medium mt-0.5">{dayNameDate}</div>
            </div>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-medium transition flex items-center gap-1 cursor-pointer"
              title="توسيع النافذة"
            >
              {isFullscreen ? <Minimize2 className="w-3 h-3 text-cyan-400" /> : <Maximize2 className="w-3 h-3 text-cyan-400" />}
              <span>{isFullscreen ? 'إنهاء التوسيع' : 'توسيع'}</span>
            </button>
          </div>

          {/* Mini month view */}
          <div className="text-center font-bold text-xs text-slate-300 mb-2">
            أيلول / سبتمبر 2026
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 font-medium mb-1">
            <span>سب</span>
            <span>جم</span>
            <span>خم</span>
            <span>أر</span>
            <span>ثل</span>
            <span>إث</span>
            <span>أح</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-300">
            <span className="p-1 text-slate-600">30</span>
            <span className="p-1 text-slate-600">31</span>
            <span className="p-1 hover:bg-white/10 rounded cursor-pointer">1</span>
            <span className="p-1 hover:bg-white/10 rounded cursor-pointer">2</span>
            <span className="p-1 hover:bg-white/10 rounded cursor-pointer">3</span>
            <span className="p-1 hover:bg-white/10 rounded cursor-pointer">4</span>
            <span className="p-1 bg-cyan-600 text-white font-bold rounded-full cursor-pointer shadow-sm">5</span>
            {Array.from({ length: 25 }, (_, i) => i + 6).map((day) => (
              <span key={day} className="p-1 hover:bg-white/10 rounded cursor-pointer text-slate-300">
                {day}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Live Clock and Date Block (Windows 2-line layout) */}
      <button
        type="button"
        id="fluent_system_tray_clock_btn"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        className={`h-10 px-2 rounded hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer flex flex-col items-center justify-center text-center select-none ${
          isCalendarOpen ? 'bg-white/15' : ''
        }`}
        title="الساعة والتقويم"
      >
        <span className="text-[11px] font-medium text-slate-100 leading-tight">
          {currentTime}
        </span>
        <span className="text-[10px] text-slate-300 leading-tight mt-0.5">
          {currentDate}
        </span>
      </button>
    </>
  );
});

export const DesktopTaskbar: React.FC<DesktopTaskbarProps> = React.memo(({
  isDesktopVisible,
  onToggleShowDesktop,
  onToggleStartMenu,
  isStartMenuOpen,
  onOpenSearch,
  onToggleNotifications,
  isNotificationsOpen,
  onToggleQuickActions,
  isQuickActionsOpen,
  onOpenDirectives,
  onOpenIntegrityHub,
  onSelectModule,
}) => {
  const {
    activeModule,
    currentBranch,
    setCurrentBranch,
    branches,
    currentUser,
    canSwitchBranch,
    canAccessModule,
    hasPermission,
    isolatedNotifications,
    directMessages,
    cloudSyncState,
  } = useOrca();

  // Fast Branch Selector Dropdown
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);
  const [branchSearchFilter, setBranchSearchFilter] = useState('');
  const [selectedGovFilter, setSelectedGovFilter] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => !!document.fullscreenElement);

  // Close branch dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    };
    if (isBranchDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBranchDropdownOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // 14 Syrian Governorates
  const all14Governorates = [
    'دمشق',
    'ريف دمشق',
    'حلب',
    'حمص',
    'حماة',
    'اللاذقية',
    'طرطوس',
    'السويداء',
    'درعا',
    'دير الزور',
    'الحسكة',
    'الرقة',
    'إدلب',
    'القنيطرة',
  ];

  // Pinned Apps in Taskbar matching image.png order:
  // BarChart -> PackagePlus -> Truck -> Warehouse -> Bike -> Coins -> Calculator -> FileEdit -> Users -> ShieldCheck -> Database
  const taskbarApps: { id: ActiveModule; title: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { id: 'dashboard', title: 'لوحة المؤشرات', icon: BarChart3, color: 'text-blue-400' },
    { id: 'intake', title: 'استقبال الطرود', icon: PackagePlus, color: 'text-cyan-400' },
    { id: 'manifests', title: 'مانافيست...', icon: Truck, color: 'text-orange-400' },
    { id: 'arrivals', title: 'مستودع الوصول', icon: Warehouse, color: 'text-emerald-400' },
    { id: 'delivery', title: 'التسليم', icon: PackageCheck, color: 'text-purple-400' },
    { id: 'cashbox', title: 'الخزينة والصناديق', icon: Coins, color: 'text-amber-400' },
    { id: 'expenses', title: 'سجل المصاريف', icon: Receipt, color: 'text-yellow-400' },
    { id: 'pricing', title: 'محرك التسعير', icon: Calculator, color: 'text-pink-400' },
    { id: 'admin_users', title: 'الفروع والصلاحيات', icon: Users, color: 'text-sky-400' },
    { id: 'master_admin', title: 'المدير التنفيذي', icon: ShieldCheck, color: 'text-fuchsia-400' },
    { id: 'fixed_assets', title: 'الأصول الثابتة', icon: Monitor, color: 'text-violet-400' },
    { id: 'backup_cloud', title: 'النسخ الاحتياطي', icon: Database, color: 'text-slate-300' },
  ];

  // Pinned Apps in Taskbar (strictly filtered by user role permissions)
  const allowedTaskbarApps = taskbarApps.filter((app) => canAccessModule(app.id));

  // Permissions & Allowed Branches: General Manager or branch switcher can switch, standard users see plain text
  const canUserSwitchBranch = currentUser.role === 'super_admin' || canSwitchBranch();
  const isBranchLocked = !canUserSwitchBranch;
  const allowedBranches = branches.filter((b) => {
    if (currentUser.canSwitchBranches || currentUser.role === 'super_admin') return true;
    if (currentUser.allowedBranchIds && currentUser.allowedBranchIds.length > 0) {
      return currentUser.allowedBranchIds.includes(b.id);
    }
    return b.id === currentUser.branchId;
  });

  const filteredBranches = allowedBranches.filter((b) => {
    if (!branchSearchFilter.trim()) return true;
    const search = branchSearchFilter.trim().toLowerCase();
    return (
      b.name.toLowerCase().includes(search) ||
      b.governorate.toLowerCase().includes(search) ||
      b.code.toLowerCase().includes(search)
    );
  });

  // Notifications Count
  const unreadCount = isolatedNotifications.filter((n) => !n.read).length;

  // Unread Cashier Collection Notifications
  const unreadCashierCollectNotifs = isolatedNotifications.filter(
    (n) => !n.read && (n.actionType === 'cashier_collect' || n.type === 'cash_settlement')
  );
  const hasUnreadCashierCollect = unreadCashierCollectNotifs.length > 0;

  // Track unread cashier collection notifications
  const prevCashierNotifCountRef = useRef(0);
  useEffect(() => {
    prevCashierNotifCountRef.current = unreadCashierCollectNotifs.length;
  }, [hasUnreadCashierCollect, unreadCashierCollectNotifs.length]);

  // Unread Directives
  const totalDirectivesUnread = directMessages.filter(
    (m) =>
      !m.isRead &&
      (m.recipientUserId === currentUser?.id || (currentBranch && m.recipientBranchId === currentBranch.id))
  ).length;

  return (
    <footer
      id="fluent_desktop_taskbar"
      className="fixed bottom-0 inset-x-0 h-14 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-800/80 shadow-2xl z-40 flex items-center justify-between px-2 sm:px-4 select-none text-xs"
    >
      {/* ========================================================================= */}
      {/* RIGHT SIDE (in RTL): BRANCH SELECTOR + RATE + START + SEARCH + DESKTOP */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* 1. Branch Selector & Supervision Context Switcher */}
        {currentUser.role === 'super_admin' || canSwitchBranch() ? (
          <div className="relative" ref={branchDropdownRef}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                id="btn_app_manager_branch_selector"
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                className={`h-11 px-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer select-none text-right border ${
                  isBranchDropdownOpen
                    ? 'bg-slate-800 border-amber-400/60 shadow-lg shadow-amber-500/10'
                    : currentBranch?.id && branches.some((b) => b.id === currentBranch.id)
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 hover:border-amber-400/70 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900/70 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                }`}
                title={
                  currentBranch?.id && branches.some((b) => b.id === currentBranch.id)
                    ? `أنت تشرف حالياً على فرع [${currentBranch.name}]. انقر للتبديل أو العودة لمدير التطبيق العام.`
                    : 'مدير التطبيق العام (إشراف شامل على كافة الفروع). انقر لاختيار فرع للإشراف عليه.'
                }
              >
                {currentBranch?.id && branches.some((b) => b.id === currentBranch.id) ? (
                  <div className="w-7 h-7 rounded-lg bg-amber-500/25 border border-amber-400/50 text-amber-300 flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="flex flex-col text-right leading-tight max-w-[130px] sm:max-w-[180px]">
                  <span className="font-bold text-amber-300 text-[11px] truncate tracking-tight">
                    {currentUser.name || 'مدير التطبيق'}
                  </span>
                  <span
                    className={`text-[10px] truncate flex items-center gap-1 ${
                      currentBranch?.id && branches.some((b) => b.id === currentBranch.id)
                        ? 'text-amber-200 font-black'
                        : 'text-cyan-300 font-semibold'
                    }`}
                  >
                    {currentBranch?.id && branches.some((b) => b.id === currentBranch.id) ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>مشرف: {currentBranch.name}</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span>مدير تطبيق (عام)</span>
                      </>
                    )}
                  </span>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    isBranchDropdownOpen ? 'rotate-180 text-amber-300' : ''
                  }`}
                />
              </button>

              {/* Quick Reset Button: Shown when super_admin is currently supervising a specific branch */}
              {currentUser.role === 'super_admin' &&
                currentBranch?.id &&
                branches.some((b) => b.id === currentBranch.id) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentBranch(ALL_BRANCHES_SUPERVISION_BRANCH);
                    }}
                    className="h-9 px-2 rounded-lg bg-slate-900/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-[10px] text-slate-300 hover:text-rose-200 font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                    title="إلغاء الإشراف على هذا الفرع والعودة لوضع مدير التطبيق العام (كافة الفروع)"
                  >
                    <X className="w-3 h-3 text-rose-400" />
                    <span className="hidden xl:inline">إنهاء الإشراف</span>
                  </button>
                )}
            </div>

            {/* FLOATING BRANCH SUPERVISION POPOVER */}
            {isBranchDropdownOpen && (
              <div
                className="absolute bottom-full right-0 mb-2 w-76 sm:w-84 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 text-right font-['Cairo',sans-serif]"
                dir="rtl"
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black text-white">إشراف مدير التطبيق على الفروع</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {branches.length} فروع مسجلة
                  </span>
                </div>

                {/* Option 1: Without Branch (General Supervision / All Branches) */}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentBranch(ALL_BRANCHES_SUPERVISION_BRANCH);
                    setIsBranchDropdownOpen(false);
                  }}
                  className={`w-full text-right p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer mb-2 ${
                    !currentBranch?.id || !branches.some((b) => b.id === currentBranch.id)
                      ? 'bg-cyan-500/15 border-cyan-400/60 text-white shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/30'
                      : 'bg-slate-950/70 hover:bg-slate-850 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        !currentBranch?.id || !branches.some((b) => b.id === currentBranch.id)
                          ? 'bg-cyan-500/25 text-cyan-300'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black block">بدون فرع (مدير تطبيق عام)</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                        إشراف شامل، الصندوق الموحد، رؤية مركزية لكافة الفروع
                      </span>
                    </div>
                  </div>
                  {(!currentBranch?.id || !branches.some((b) => b.id === currentBranch.id)) && (
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-black border border-cyan-500/30">
                      نشط حالياً
                    </span>
                  )}
                </button>

                <div className="border-t border-slate-800/80 my-2" />

                {/* Section 2: Actual Registered Branches List */}
                <div className="space-y-1">
                  <span className="text-[10px] text-amber-400 font-bold block px-1 mb-1">
                    أو اختر فرعاً للإشراف عليه وتعديل بياناته:
                  </span>

                  {branches.length === 0 ? (
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
                      <Building2 className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                      <span className="text-[11px] text-slate-400 block font-medium">
                        لا توجد فروع مسجلة بالنظام حتى الآن
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        يمكنك إضافة فرع جديد من قسم المستخدمين والفروع
                      </span>
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                      {branches.map((branch) => {
                        const isSelected = currentBranch?.id === branch.id;
                        return (
                          <button
                            key={branch.id}
                            type="button"
                            onClick={() => {
                              setCurrentBranch(branch);
                              setIsBranchDropdownOpen(false);
                            }}
                            className={`w-full text-right p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-400/30'
                                : 'bg-slate-950/50 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400'
                                }`}
                              >
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-white block">
                                  {branch.name}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  {branch.type === 'main_hub' ? 'فرع رئيسي' : 'نقطة تجميع'} • محافظة {branch.governorate}
                                </span>
                              </div>
                            </div>
                            {isSelected ? (
                              <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded">
                                مشرف حالي
                              </span>
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Footer Notice */}
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
                  يمكنك الدخول لأي فرع وتعديل أي شيء، والعودة للإشراف العام بنقرة واحدة
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Static Branch Display for standard branch users */
          <div className="relative flex items-center gap-1.5 px-2 py-1 text-right select-none border-0 bg-slate-900/40 rounded-xl">
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="flex flex-col text-right leading-tight max-w-[130px] sm:max-w-[180px]">
              <span
                className="font-bold text-white text-[11px] truncate tracking-tight"
                title={currentBranch?.id ? currentBranch.name : 'لا يوجد فرع محدد'}
              >
                {currentBranch?.id ? currentBranch.name : 'لا يوجد فرع محدد'}
              </span>
              <span className="text-[9px] text-cyan-400/90 font-medium truncate">
                {currentBranch?.id && currentBranch.governorate
                  ? `محافظة ${currentBranch.governorate}`
                  : 'غير مقيد بفرع'}
              </span>
            </div>
          </div>
        )}

        {/* 2. Windows 11 Start Menu Button (4 cyan tiles) */}
        <button
          type="button"
          id="fluent_taskbar_start_button"
          onClick={onToggleStartMenu}
          className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-95 ${
            isStartMenuOpen
              ? 'bg-cyan-500/25 border border-cyan-400 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-900/90 hover:bg-slate-850 border border-slate-750 hover:border-cyan-500/50'
          }`}
          title="قائمة البدء (Windows Start)"
        >
          <div className="w-4 h-4 grid grid-cols-2 gap-0.5 group-hover:scale-110 transition-transform">
            <span className="rounded-[1.5px] bg-[#00a4ef]" />
            <span className="rounded-[1.5px] bg-[#00a4ef]" />
            <span className="rounded-[1.5px] bg-[#00a4ef]" />
            <span className="rounded-[1.5px] bg-[#00a4ef]" />
          </div>
        </button>

        {/* 3. Search Button */}
        <button
          type="button"
          id="fluent_taskbar_quick_search"
          onClick={onOpenSearch}
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-750 hover:border-cyan-500/50 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
          title="البحث والاستعلام (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* CENTER: SHORTCUT ICONS (أيقونات الإختصارات بمعايرة دقيقة وبدون أي سكرول)     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex items-center justify-center min-w-0 mx-1 sm:mx-2 md:mx-3 px-1">
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 bg-slate-900/60 border border-slate-800/80 rounded-xl sm:rounded-2xl shadow-inner max-w-full overflow-hidden">
          {/* Desktop / Monitor Button */}
          <button
            type="button"
            id="fluent_taskbar_desktop_btn"
            onClick={onToggleShowDesktop}
            className={`h-8 w-8 sm:h-8.5 sm:w-8.5 md:h-9 md:w-9 lg:h-9.5 lg:w-9.5 rounded-lg sm:rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isDesktopVisible
                ? 'bg-cyan-950/70 border border-cyan-500 text-cyan-400 shadow-md shadow-cyan-500/25'
                : 'bg-slate-900/90 hover:bg-slate-850 border border-slate-750 text-slate-400 hover:text-white'
            }`}
            title={isDesktopVisible ? 'سطح المكتب نشط' : 'إظهار سطح المكتب'}
          >
            <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Pinned App Shortcut Icons */}
          {allowedTaskbarApps.map((app) => {
            const Icon = app.icon;
            const isActive = activeModule === app.id && !isDesktopVisible;

            return (
              <button
                key={app.id}
                type="button"
                id={`taskbar_app_${app.id}`}
                onClick={() => onSelectModule(app.id)}
                className={`h-8 w-8 sm:h-8.5 sm:w-8.5 md:h-9 md:w-9 lg:h-9.5 lg:w-9.5 rounded-lg sm:rounded-xl flex items-center justify-center relative transition-all cursor-pointer group active:scale-95 shrink-0 ${
                  isActive
                    ? 'bg-cyan-950/80 border border-cyan-500/80 text-white shadow-md shadow-cyan-500/25'
                    : 'bg-slate-900/70 hover:bg-slate-850 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white'
                }`}
                title={app.title}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${app.color} group-hover:scale-110 transition-transform`} />
                {isActive && (
                  <span className="absolute -bottom-0.5 w-2 sm:w-2.5 h-0.5 bg-cyan-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* LEFT SIDE (in RTL): SYSTEM TRAY (WINDOWS 10/11 FLUENT STYLE)               */}
      {/* [Directives] [Quick Shortcuts] [Expand/Fullscreen] [Clock & Date] [Cloud] [Action Center] */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 relative">
        {/* 1. Directives Button ("التوجيهات") */}
        <button
          type="button"
          id="fluent_system_tray_directives_btn"
          onClick={onOpenDirectives}
          className="h-9 px-2 sm:px-2.5 rounded hover:bg-white/10 active:bg-white/15 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer relative"
          title="التوجيهات والكتب الإدارية الرسمية"
        >
          <MessageSquare className="w-4 h-4 text-slate-200" />
          <span className="text-[11px] font-medium text-slate-200 hidden lg:inline">التوجيهات</span>
          {totalDirectivesUnread > 0 && (
            <span className="min-w-[17px] h-[17px] px-1 bg-violet-600 text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center absolute -top-1 -right-1 shadow-md">
              {totalDirectivesUnread}
            </span>
          )}
        </button>

        {/* 2. Quick Actions Panel Button ("لوحة الإختصارات") - محجوب قطعياً عن أدوار العزل الصارم (مدخل بيانات، تسليم الوارد، أمين صندوق) */}
        {hasPermission('shortcuts.view') &&
          currentUser.role !== 'outbound_operator' &&
          currentUser.role !== 'reception_data_entry' &&
          currentUser.role !== 'inbound_operator' &&
          currentUser.role !== 'cashier' &&
          currentUser.role !== 'courier' && (
            <button
              type="button"
              id="fluent_system_tray_quick_actions_btn"
              onClick={onToggleQuickActions}
              className={`h-9 w-9 rounded hover:bg-white/10 active:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer relative ${
                isQuickActionsOpen ? 'bg-white/15 text-white' : ''
              }`}
              title="لوحة الإختصارات السريعة والتحكم الفوري"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-200" />
            </button>
          )}

        {/* 3. Fullscreen / Expand Button directly on the taskbar ("أيقونة توسيع") */}
        <button
          type="button"
          id="fluent_system_tray_fullscreen_btn"
          onClick={toggleFullscreen}
          className="h-9 w-9 rounded hover:bg-white/10 active:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title={isFullscreen ? 'إنهاء التوسيع' : 'توسيع'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4 text-slate-200" />
          ) : (
            <Maximize2 className="w-4 h-4 text-slate-200" />
          )}
        </button>

        {/* 4. Isolated Live Clock and Date Block (Windows 2-line layout) */}
        <LiveSystemClock isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />

        {/* 5. Central Database Status & Integrity Hub Trigger Button (Prompt 68) */}
        {(() => {
          const connectionInfo = deriveConnectionState(
            cloudSyncState,
            typeof navigator !== 'undefined' ? navigator.onLine : true
          );
          return currentUser.role === 'super_admin' ? (
            // super_admin: قابل للنقر → يفتح SyncAuditFullScreen
            <button
              type="button"
              id="fluent_system_tray_cloud_indicator"
              onClick={onOpenIntegrityHub}
              className="h-9 px-2 rounded flex items-center justify-center gap-1.5 relative select-none shrink-0 cursor-pointer hover:bg-white/10 active:scale-95 transition-all"
              title="فتح مركز تدقيق المزامنة وقاعدة البيانات والنسخ الاحتياطي"
            >
              <Database
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
                  connectionInfo.state === 'CONNECTED'
                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : connectionInfo.state === 'RECONNECTING'
                    ? 'text-amber-400 animate-spin'
                    : connectionInfo.state === 'DEGRADED_LOCAL'
                    ? 'text-orange-400'
                    : 'text-rose-400'
                }`}
              />
              <ConnectionStatusBadge state={connectionInfo.state} />
            </button>
          ) : (
            // غير super_admin: عرض فقط (غير قابل للنقر)
            <div
              id="fluent_system_tray_cloud_indicator"
              className="h-9 px-2 rounded flex items-center justify-center gap-1.5 relative select-none shrink-0 cursor-default opacity-85 hover:opacity-100 transition-opacity"
              title="حالة الاتصال (للقراءة فقط) — تواصل مع المدير للتفاصيل"
            >
              <Database
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
                  connectionInfo.state === 'CONNECTED'
                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : connectionInfo.state === 'RECONNECTING'
                    ? 'text-amber-400 animate-spin'
                    : connectionInfo.state === 'DEGRADED_LOCAL'
                    ? 'text-orange-400'
                    : 'text-rose-400'
                }`}
              />
              <ConnectionStatusBadge state={connectionInfo.state} />
            </div>
          );
        })()}

        {/* 6. Notifications Button */}
        <button
          type="button"
          id="fluent_system_tray_notifications_btn"
          onClick={onToggleNotifications}
          className={`h-9 px-2 sm:px-2.5 rounded flex items-center justify-center transition-all cursor-pointer relative ${
            hasUnreadCashierCollect
              ? 'bg-rose-950/90 border border-rose-500/90 text-rose-300 shadow-lg shadow-rose-600/50 animate-pulse'
              : isNotificationsOpen
              ? 'bg-white/15 text-white'
              : 'hover:bg-white/10 active:bg-white/15 text-slate-300 hover:text-white'
          }`}
          title={
            hasUnreadCashierCollect
              ? '🚨 إشعار عاجل لأمين الصندوق: يوجد طلب قبض قيمة طرد بانتظار الإيداع!'
              : 'مركز التنبيهات'
          }
        >
          <NotificationsCenterIcon
            className={`w-4 h-4 transition-transform ${
              hasUnreadCashierCollect ? 'text-rose-400 animate-bounce' : 'text-slate-200'
            }`}
          />
          {unreadCount > 0 && (
            <span
              className={`min-w-[17px] h-[17px] px-1 text-[10px] font-black font-mono rounded-full flex items-center justify-center absolute -top-1 -right-1 shadow-lg transition-all ${
                hasUnreadCashierCollect
                  ? 'bg-rose-600 border border-rose-300 text-white shadow-rose-600/90 animate-bounce ring-2 ring-rose-500/80'
                  : 'bg-slate-900 border border-slate-300 text-white'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </footer>
  );
});
