import React, { useState, useMemo } from 'react';
import { useOrca, ActiveModule } from '../context/OrcaContext';
import { User } from '../types';
import { MODULE_METADATA } from './DesktopWindowHeader';
import {
  isShortcutAllowedForUser,
  isDirectiveAccessibleToUser,
} from '../utils/permissionEngine';
import {
  Search,
  Users,
  LogOut,
  UserCheck,
  Car,
  Banknote,
  Receipt,
  Clock,
  Shield,
  FileText,
  X,
  PackagePlus,
  PackageCheck,
  Truck,
  Warehouse,
  Coins,
  WalletCards,
  SlidersHorizontal,
  Monitor,
  Database,
  ArrowRightLeft,
  Lock,
  ChevronDown,
  ChevronUp,
  Zap,
  Smartphone,
} from 'lucide-react';

interface DesktopStartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModule: (mod: ActiveModule) => void;
  onOpenDirectivesModal: () => void;
  onOpenSwitchUser: () => void;
  onOpenIntegrityHub?: () => void;
}

// =========================================================================
// تعريفات الدلائل والخدمات المساندة مع شروط الصلاحيات والأدوار الصارمة
// =========================================================================
interface StartDirectoryItem {
  id: string;
  title: string;
  subtitle: string;
  targetModule: ActiveModule;
  icon: React.FC<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  isAllowed: (
    user: User,
    canAccess: (mod: ActiveModule) => boolean,
    hasPerm: (k: string) => boolean
  ) => boolean;
}

const ALL_DIRECTORIES: StartDirectoryItem[] = [
  {
    id: 'customers',
    title: 'دليل العملاء',
    subtitle: 'سجل المشتركين والتجار',
    targetModule: 'customers',
    icon: UserCheck,
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/20',
    isAllowed: (_u, canAccess, hasPerm) =>
      canAccess('customers') || hasPerm('customers.view'),
  },
  {
    id: 'vehicles',
    title: 'أسطول الشاحنات',
    subtitle: 'المركبات والصيانة والسائقين',
    targetModule: 'vehicles',
    icon: Car,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/20',
    isAllowed: (_u, canAccess, hasPerm) =>
      canAccess('vehicles') || hasPerm('vehicles.view'),
  },
  {
    id: 'payroll',
    title: 'الرواتب والموظفين',
    subtitle: 'مسيرات الأجور والكوادر',
    targetModule: 'payroll',
    icon: Banknote,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/20',
    isAllowed: (u, canAccess, hasPerm) =>
      canAccess('payroll') ||
      u.permissions?.modules?.employees_payroll === true ||
      hasPerm('payroll.view'),
  },
  {
    id: 'expenses',
    title: 'دليل المصاريف',
    subtitle: 'فواتير التشغيل وسندات الصرف',
    targetModule: 'expenses',
    icon: Receipt,
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-500/20',
    isAllowed: (_u, canAccess, hasPerm) =>
      canAccess('expenses') || hasPerm('expenses.view'),
  },
  {
    id: 'fixed_assets',
    title: 'الأصول والتجهيزات',
    subtitle: 'تجهيزات الفروع وطابعات الباركود',
    targetModule: 'fixed_assets',
    icon: Monitor,
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/20',
    isAllowed: (_u, canAccess, hasPerm) =>
      canAccess('fixed_assets') || hasPerm('assets.view'),
  },
  {
    id: 'courier_portal',
    title: 'بوابة الموزع (الجوال)',
    subtitle: 'تسليم الطرود وتصفية العهدة',
    targetModule: 'courier_portal',
    icon: Smartphone,
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/20',
    isAllowed: (u, canAccess) =>
      u.role === 'courier' || u.role === 'super_admin' || u.role === 'hub_manager' || canAccess('courier_portal'),
  },
  {
    id: 'pricing',
    title: 'دليل التعرفة والأسعار',
    subtitle: 'أجور النقل ومصفوفة المسافات',
    targetModule: 'pricing',
    icon: SlidersHorizontal,
    colorClass: 'text-pink-400',
    bgClass: 'bg-pink-500/20',
    isAllowed: (_u, canAccess, hasPerm) =>
      canAccess('pricing') || hasPerm('pricing.view'),
  },
  {
    id: 'admin_users',
    title: 'دليل الكوادر والفروع',
    subtitle: 'شبكة المراكز والصلاحيات',
    targetModule: 'admin_users',
    icon: Users,
    colorClass: 'text-teal-400',
    bgClass: 'bg-teal-500/20',
    isAllowed: (_u, canAccess, hasPerm) =>
      canAccess('admin_users') || hasPerm('users.view'),
  },
  {
    id: 'master_admin',
    title: 'الدليل المالي العام',
    subtitle: 'شجرة الحسابات والقيود',
    targetModule: 'master_admin',
    icon: Database,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/20',
    isAllowed: (u, canAccess) =>
      u.role === 'super_admin' || canAccess('master_admin'),
  },
];

// =========================================================================
// تعريفات أزرار الاختصارات السريعة الخاضعة لرقابة الأدوار والصلاحيات
// =========================================================================
interface StartShortcutItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  action: (
    openMod: (mod: ActiveModule) => void,
    openDirectives: () => void
  ) => void;
}

const ALL_SHORTCUTS: StartShortcutItem[] = [
  {
    id: 'intake',
    title: 'تسجيل طرد سريع',
    subtitle: 'إصدار بوليصة شحن',
    icon: PackagePlus,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/20',
    action: (openMod) => openMod('intake'),
  },
  {
    id: 'delivery',
    title: 'تسليم طرد للعميل',
    subtitle: 'توقيع وقارئ الهوية',
    icon: PackageCheck,
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/20',
    action: (openMod) => openMod('delivery'),
  },
  {
    id: 'manifest_new',
    title: 'إصدار منافيست شاحنة',
    subtitle: 'ترحيل ونقل بين المحافظات',
    icon: Truck,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/20',
    action: (openMod) => openMod('manifests'),
  },
  {
    id: 'arrivals',
    title: 'استلام وفرز شاحنة',
    subtitle: 'مطابقة وتفريغ الوارد',
    icon: Warehouse,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/20',
    action: (openMod) => openMod('arrivals'),
  },
  {
    id: 'receipt_voucher',
    title: 'سند قبض نقدي',
    subtitle: 'قبض مالي معتمد للصندوق',
    icon: WalletCards,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/20',
    action: (openMod) => openMod('cashbox'),
  },
  {
    id: 'payment_voucher',
    title: 'سند صرف نفقات',
    subtitle: 'صرف معتمد من الخزينة',
    icon: Coins,
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-500/20',
    action: (openMod) => openMod('cashbox'),
  },
  {
    id: 'clearing',
    title: 'مطابقة وإقفال المقاصة',
    subtitle: 'تسوية الصناديق مع الفروع',
    icon: ArrowRightLeft,
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/20',
    action: (openMod) => openMod('cashbox'),
  },
  {
    id: 'vault_transfer',
    title: 'سند مناقلة صناديق بين الفروع',
    subtitle: 'تحويل أموال بين صناديق الفروع',
    icon: ArrowRightLeft,
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/20',
    action: (openMod) => openMod('cashbox'),
  },
  {
    id: 'report_cash_movement',
    title: 'كشف حركة الصندوق',
    subtitle: 'حركة الوارد والمنصرف',
    icon: Receipt,
    colorClass: 'text-teal-400',
    bgClass: 'bg-teal-500/20',
    action: (openMod) => openMod('cashbox'),
  },
  {
    id: 'stagnant_sla',
    title: 'الطرود الراكدة وSLA',
    subtitle: 'متابعة مهل التسليم',
    icon: Clock,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/20',
    action: (openMod) => openMod('arrivals'),
  },
  {
    id: 'directives',
    title: 'الكتب والتوجيهات',
    subtitle: 'التعاميم والمراسلات الرسمية',
    icon: FileText,
    colorClass: 'text-indigo-400',
    bgClass: 'bg-indigo-500/20',
    action: (_openMod, openDirectives) => openDirectives(),
  },
];

const getRoleArabicTitle = (role: string): string => {
  switch (role) {
    case 'super_admin':
      return 'المدير العام';
    case 'hub_manager':
      return 'مدير مركز';
    case 'cashier':
      return 'أمين صندوق ومحاسب';
    case 'courier':
      return 'مندوب تسليم';
    case 'outbound_operator':
      return 'مسؤول شحن وترحيل';
    case 'inbound_operator':
      return 'مسؤول استقبال وفرز';
    case 'warehouse_keeper':
      return 'أمين مستودع';
    case 'reception_data_entry':
      return 'مدخل بيانات واستقبال';
    case 'warehouseman':
      return 'عامل مستودع ومناولة';
    case 'driver':
      return 'سائق شاحنة';
    case 'custom':
      return 'مستخدم مخصص';
    default:
      return 'موظف تشغيل';
  }
};

export const DesktopStartMenu: React.FC<DesktopStartMenuProps> = ({
  isOpen,
  onClose,
  onOpenModule,
  onOpenDirectivesModal,
  onOpenSwitchUser,
  onOpenIntegrityHub,
}) => {
  const {
    currentUser,
    currentBranch,
    logout,
    directMessages,
    canAccessModule,
    hasPermission,
  } = useOrca();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAllModules, setShowAllModules] = useState(false);

  // All modules in system
  const allModulesList: ActiveModule[] = useMemo(
    () => [
      'dashboard',
      'intake',
      'manifests',
      'arrivals',
      'delivery',
      'cashbox',
      'pricing',
      'admin_users',
      'backup_cloud',
      'master_admin',
      'customers',
      'vehicles',
      'payroll',
      'expenses',
      'fixed_assets',
    ],
    []
  );

  // 1. التطبيقات المصرحة حصراً وفق الدور والصلاحيات
  const authorizedModules = useMemo(() => {
    return allModulesList.filter((m) => canAccessModule(m));
  }, [allModulesList, canAccessModule]);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return authorizedModules;
    const q = searchQuery.trim().toLowerCase();
    return authorizedModules.filter((m) => {
      const meta = MODULE_METADATA[m];
      return (
        meta?.title.toLowerCase().includes(q) ||
        meta?.subtitle.toLowerCase().includes(q)
      );
    });
  }, [authorizedModules, searchQuery]);

  // 2. الدلائل المصرحة حصراً وفق الدور والصلاحيات
  const authorizedDirectories = useMemo(() => {
    return ALL_DIRECTORIES.filter((d) =>
      d.isAllowed(currentUser, canAccessModule, hasPermission)
    );
  }, [currentUser, canAccessModule, hasPermission]);

  const filteredDirectories = useMemo(() => {
    if (!searchQuery.trim()) return authorizedDirectories;
    const q = searchQuery.trim().toLowerCase();
    return authorizedDirectories.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q)
    );
  }, [authorizedDirectories, searchQuery]);

  // 3. أزرار الاختصارات السريعة المصرحة حصراً وفق الدور والصلاحيات
  const authorizedShortcuts = useMemo(() => {
    return ALL_SHORTCUTS.filter((s) =>
      isShortcutAllowedForUser(s.id, currentUser, canAccessModule, hasPermission, currentBranch)
    );
  }, [currentUser, canAccessModule, hasPermission, currentBranch]);

  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return authorizedShortcuts;
    const q = searchQuery.trim().toLowerCase();
    return authorizedShortcuts.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.subtitle.toLowerCase().includes(q)
    );
  }, [authorizedShortcuts, searchQuery]);

  // 4. الكتب والتوجيهات الإدارية الموجهة حصراً للمستخدم وفرعه
  const authorizedDirectives = useMemo(() => {
    if (!hasPermission('directives.view')) return [];
    return directMessages.filter((msg) =>
      isDirectiveAccessibleToUser(msg, currentUser, currentBranch?.id)
    );
  }, [hasPermission, directMessages, currentUser, currentBranch?.id]);

  const filteredDirectives = useMemo(() => {
    const list = authorizedDirectives;
    if (!searchQuery.trim()) return list.slice(0, 3);
    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (dir) =>
        dir.title.toLowerCase().includes(q) ||
        dir.content.toLowerCase().includes(q)
    );
  }, [authorizedDirectives, searchQuery]);

  // هل يوجد أي نتيجة مطابقة للبحث ضمن الصلاحيات الممنوحة
  const hasSearchResults =
    filteredModules.length > 0 ||
    filteredDirectories.length > 0 ||
    filteredShortcuts.length > 0 ||
    filteredDirectives.length > 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay to close when clicking outside */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />

      <div
        id="fluent_start_menu"
        className="fixed bottom-16 right-3 sm:right-6 w-[380px] sm:w-[540px] max-w-[calc(100vw-24px)] bg-slate-900/98 backdrop-blur-3xl border border-slate-700/80 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[84vh] animate-in fade-in slide-in-from-bottom-5 duration-200"
      >
        {/* ========================================================================= */}
        {/* START MENU TOP SEARCH & ROLE BADGE HEADER */}
        {/* ========================================================================= */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/90 bg-slate-950/80">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                <span className="rounded-[1px] bg-[#00a4ef]" />
                <span className="rounded-[1px] bg-[#00a4ef]" />
                <span className="rounded-[1px] bg-[#00a4ef]" />
                <span className="rounded-[1px] bg-[#00a4ef]" />
              </div>
              <span className="text-xs font-bold text-slate-200">
                قائمة البدء والوصول السريع
              </span>
            </div>

            {/* مؤشر الأمان والأدوار المطبقة */}
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-[10px] text-cyan-300 font-semibold">
              <Shield className="w-3 h-3 text-cyan-400" />
              <span>مخصصة لدور: {getRoleArabicTitle(currentUser.role)}</span>
            </div>
          </div>

          <div className="relative">
            <input
              id="input_start_menu_search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في التطبيقات، الأدلة، والاختصارات المصرحة لك..."
              autoFocus
              className="w-full bg-slate-900 border border-slate-700/90 focus:border-cyan-400 rounded-xl pr-10 pl-9 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none ring-2 ring-cyan-500/20 transition-all shadow-inner"
            />
            <Search className="w-4 h-4 text-cyan-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* START MENU SCROLLABLE BODY */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
          {/* في حال البحث وعدم وجود أي نتيجة مصرحة */}
          {searchQuery.trim() !== '' && !hasSearchResults && (
            <div className="p-6 text-center space-y-2 bg-slate-950/50 rounded-2xl border border-slate-800">
              <Lock className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-300">
                لا توجد عناصر مطابقة ضمن الصلاحيات الممنوحة
              </div>
              <div className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                العناصر أو الأدلة التي تبحث عنها غير متوفرة أو تتطلب صلاحيات وصول
                إضافية لحسابك ({getRoleArabicTitle(currentUser.role)}).
              </div>
            </div>
          )}

          {/* 1. قائمة التطبيقات والوحدات المثبتة والمصرحة */}
          {filteredModules.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                  <span>التطبيقات والوحدات المصرحة</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {filteredModules.length} وحدة متاحة
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {(showAllModules || searchQuery.trim() !== ''
                  ? filteredModules
                  : filteredModules.slice(0, 8)
                ).map((modId) => {
                  const meta = MODULE_METADATA[modId];
                  if (!meta) return null;
                  const IconComp = meta.icon;

                  return (
                    <button
                      key={modId}
                      type="button"
                      onClick={() => {
                        onOpenModule(modId);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-750 hover:border-slate-600 flex flex-col items-center text-center transition-all hover:scale-105 cursor-pointer group"
                      title={meta.subtitle}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-white shadow-md mb-1.5 ring-1 ring-white/20`}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200 group-hover:text-white truncate max-w-full">
                        {meta.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {filteredModules.length > 8 && searchQuery.trim() === '' && (
                <button
                  type="button"
                  onClick={() => setShowAllModules((prev) => !prev)}
                  className="w-full py-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center justify-center gap-1 bg-slate-950/40 hover:bg-slate-800/60 rounded-xl border border-slate-800 transition cursor-pointer"
                >
                  {showAllModules ? (
                    <>
                      <span>طي القائمة الإضافية</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>عرض باقي الوحدات المصرحة ({filteredModules.length - 8}+)</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* 2. قسم الدلائل والخدمات المساندة (محكوم حصرياً بصلاحيات الأدوار) */}
          {filteredDirectories.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-200">
                  الدلائل والخدمات المساندة المصرحة
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({filteredDirectories.length} دليل متاح)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {filteredDirectories.map((dir) => {
                  const IconComp = dir.icon;
                  return (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => {
                        onOpenModule(dir.targetModule);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-750 flex items-center gap-2.5 text-right transition cursor-pointer hover:border-slate-600 group"
                      title={dir.subtitle}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg ${dir.bgClass} ${dir.colorClass} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="truncate min-w-0">
                        <div className="font-bold text-slate-200 truncate group-hover:text-white">
                          {dir.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {dir.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. قسم أزرار الاختصارات السريعة (محكوم حصرياً بصلاحيات الدور الوظيفي) */}
          {filteredShortcuts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>أزرار الاختصارات السريعة المصرحة</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({filteredShortcuts.length} اختصار)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {filteredShortcuts.map((sc) => {
                  const IconComp = sc.icon;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        sc.action(onOpenModule, onOpenDirectivesModal);
                        onClose();
                      }}
                      className="p-2 rounded-xl bg-slate-950/60 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 flex items-center gap-2 text-right transition cursor-pointer group"
                      title={sc.subtitle}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg ${sc.bgClass} ${sc.colorClass} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate min-w-0">
                        <div className="font-semibold text-slate-200 text-[11px] truncate group-hover:text-white">
                          {sc.title}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                          {sc.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. قسم الكتب والتوجيهات الإدارية الموجهة حصراً للمستخدم وفرعه */}
          {hasPermission('directives.view') && filteredDirectives.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>الكتب والتوجيهات الإدارية الموصى بها</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onOpenDirectivesModal();
                    onClose();
                  }}
                  className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                >
                  عرض الأرشيف الكامل
                </button>
              </div>

              <div className="space-y-1.5">
                {filteredDirectives.map((dir) => (
                  <div
                    key={dir.id}
                    onClick={() => {
                      onOpenDirectivesModal();
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 flex-1 ml-2">
                      <div className="font-bold text-slate-200 truncate">
                        {dir.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {dir.content}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        dir.priority === 'urgent'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : dir.priority === 'important'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {dir.priority === 'urgent'
                        ? 'عاجل'
                        : dir.priority === 'important'
                        ? 'هام'
                        : 'إداري'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* START MENU FOOTER: ACTIVE USER CARD & RBAC ENFORCEMENT */}
        {/* ========================================================================= */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden ring-1 ring-cyan-400/30">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                currentUser.name.charAt(0)
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                <span className="text-cyan-400 font-medium">
                  {getRoleArabicTitle(currentUser.role)}
                </span>
                <span>•</span>
                <span className="truncate">{currentBranch.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenIntegrityHub && (
              <button
                type="button"
                id="btn_start_menu_diagnostics"
                onClick={() => {
                  onClose();
                  onOpenIntegrityHub();
                }}
                className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 hover:text-cyan-100 border border-cyan-700/50 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                title="مركز تدقيق المزامنة وجودة الطرود"
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">تدقيق المزامنة</span>
              </button>
            )}

            <button
              type="button"
              id="btn_start_menu_switch_user"
              onClick={() => {
                onClose();
                onOpenSwitchUser();
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
              title="تبديل المستخدم"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">تبديل</span>
            </button>

            <button
              type="button"
              id="btn_start_menu_logout"
              onClick={() => {
                onClose();
                logout();
              }}
              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
