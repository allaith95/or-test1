import React, { useState, useMemo, useEffect } from 'react';
import { useOrca, ActiveModule } from '../context/OrcaContext';
import { safeStorage } from '../utils/storage';
import { ClearingReconciliationModal } from './ClearingReconciliationModal';
import {
  isShortcutAllowedForUser,
  ROLE_DEFAULT_SHORTCUTS,
  ROLE_DEFINITIONS,
} from '../utils/permissionEngine';
import {
  Settings,
  Volume2,
  VolumeX,
  AlertTriangle,
  Wallet,
  X,
  SlidersHorizontal,
  Search,
  MessageSquare,
  TrendingUp,
  PackagePlus,
  Warehouse,
  Truck,
  PackageCheck,
  Coins,
  Calculator,
  BarChart3,
  BarChart2,
  Users,
  Database,
  FileEdit,
  ShieldCheck,
  ArrowRightLeft,
  FilePlus,
  FileMinus,
  FileSpreadsheet,
  AlertOctagon,
  ClipboardList,
  Receipt,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Layers,
  Monitor,
} from 'lucide-react';

interface DesktopQuickActionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenCashbox: () => void;
  onOpenStagnantInspector: () => void;
  onOpenDirectives: () => void;
  onOpenSearch: () => void;
  onSelectModule?: (mod: ActiveModule) => void;
}

export interface ShortcutCatalogItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'modules' | 'actions' | 'reports';
  categoryLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'cyan' | 'blue' | 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'teal' | 'lime' | 'violet';
  targetModule?: ActiveModule;
  actionKey?:
    | 'toggle_mute'
    | 'clearing'
    | 'stagnant'
    | 'search'
    | 'directives'
    | 'cashbox'
    | 'receipt_voucher'
    | 'payment_voucher'
    | 'manifest_new';
}

const SHORTCUT_CATALOG: ShortcutCatalogItem[] = [
  // ==========================================
  // 1. الواجهات والشاشات الرئيسية (Modules)
  // ==========================================
  {
    id: 'intake',
    title: 'تسجيل واستقبال الطرود',
    subtitle: 'إدخال شحنة وطباعة بوليصة فورية',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: PackagePlus,
    color: 'cyan',
    targetModule: 'intake',
  },
  {
    id: 'arrivals',
    title: 'مستودع الطرود الواصلة',
    subtitle: 'استلام الشاحنات وتفريغ والفرز',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Warehouse,
    color: 'blue',
    targetModule: 'arrivals',
  },
  {
    id: 'manifests',
    title: 'المنافيست وشحن الشاحنات',
    subtitle: 'إصدار بيانات الشحن وحركة النقل',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Truck,
    color: 'indigo',
    targetModule: 'manifests',
  },
  {
    id: 'delivery',
    title: 'قسم التسليم',
    subtitle: 'تسليم الطرود للزبائن والتوقيع وقارئ الهوية',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: PackageCheck,
    color: 'amber',
    targetModule: 'delivery',
  },
  {
    id: 'cashbox',
    title: 'الخزينة والحسابات المالية',
    subtitle: 'حركة الصناديق والسندات واليومية',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Coins,
    color: 'emerald',
    targetModule: 'cashbox',
  },
  {
    id: 'pricing',
    title: 'محرك التسعير والتعرفة',
    subtitle: 'قواعد احتساب الأجور والوزن الحجمي',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Calculator,
    color: 'purple',
    targetModule: 'pricing',
  },
  {
    id: 'analytics',
    title: 'لوحة التحليلات والإحصائيات',
    subtitle: 'مؤشرات الأداء والنمو التشغيلي',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: BarChart3,
    color: 'violet',
    targetModule: 'dashboard',
  },
  {
    id: 'users',
    title: 'المستخدمين والفروع والصلاحيات',
    subtitle: 'إدارة الكوادر والمحافظات والوصول',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Users,
    color: 'blue',
    targetModule: 'admin_users',
  },
  {
    id: 'accounts',
    title: 'شجرة الحسابات والدليل المالي',
    subtitle: 'القيود المحاسبية وميزان المراجعة',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Database,
    color: 'teal',
    targetModule: 'master_admin',
  },
  {
    id: 'directives',
    title: 'الكتب والتوجيهات الإدارية',
    subtitle: 'التعاميم والمراسلات الرسمية الحية',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: MessageSquare,
    color: 'purple',
    actionKey: 'directives',
  },
  {
    id: 'payroll',
    title: 'مسير الرواتب والأجور',
    subtitle: 'رواتب الموظفين والبدلات الشهرية',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: FileEdit,
    color: 'lime',
    targetModule: 'payroll',
  },
  {
    id: 'expenses',
    title: 'إدارة المصاريف والنفقات',
    subtitle: 'المصاريف التشغيلية وسندات الصرف',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Receipt,
    color: 'rose',
    targetModule: 'expenses',
  },
  {
    id: 'customers',
    title: 'إدارة العملاء والمشتركين',
    subtitle: 'بيانات التجار وأصحاب الحسابات',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Users,
    color: 'indigo',
    targetModule: 'customers',
  },
  {
    id: 'vehicles',
    title: 'أسطول الشاحنات والمركبات',
    subtitle: 'بيانات السائقين وتراخيص الشاحنات',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Truck,
    color: 'amber',
    targetModule: 'vehicles',
  },
  {
    id: 'fixed_assets',
    title: 'إدارة الأصول الثابتة وتجهيزات الفروع',
    subtitle: 'أجهزة الكمبيوتر، طابعات الباركود، التجهيزات المكتبية، ومراقبة النفقات',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: Monitor,
    color: 'purple',
    targetModule: 'fixed_assets',
  },
  {
    id: 'forecasting',
    title: 'التنبؤ الذكي وتحليل التكلفة',
    subtitle: 'تحليلات وتوقعات بالذكاء الاصطناعي',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: TrendingUp,
    color: 'violet',
    targetModule: 'master_admin',
  },
  {
    id: 'audit',
    title: 'سجل الرقابة والتدقيق الأمني',
    subtitle: 'سجل تدقيق العمليات ومسار الحركات',
    category: 'modules',
    categoryLabel: 'واجهة رئيسية',
    icon: ShieldCheck,
    color: 'amber',
    targetModule: 'master_admin',
  },

  // ==========================================
  // 2. الأزرار والإجراءات السريعة (Actions)
  // ==========================================
  {
    id: 'clearing',
    title: 'سند مقاصة ومطابقة الحسابات',
    subtitle: 'احتساب نسب وتصفية أرباح الفروع تلقائياً',
    category: 'actions',
    categoryLabel: 'إجراء مالي',
    icon: ArrowRightLeft,
    color: 'cyan',
    actionKey: 'clearing',
  },
  {
    id: 'receipt_voucher',
    title: 'إصدار سند قبض نقدي',
    subtitle: 'إيداع وتحصيل نقدي فوري بالخزينة',
    category: 'actions',
    categoryLabel: 'إجراء مالي',
    icon: FilePlus,
    color: 'emerald',
    actionKey: 'receipt_voucher',
  },
  {
    id: 'payment_voucher',
    title: 'إصدار سند صرف نقدي',
    subtitle: 'صرف ومصروف نقدي من الصندوق',
    category: 'actions',
    categoryLabel: 'إجراء مالي',
    icon: FileMinus,
    color: 'rose',
    actionKey: 'payment_voucher',
  },
  {
    id: 'vault_transfer',
    title: 'سند مناقلة صناديق بين الفروع',
    subtitle: 'نقل وتحويل أموال بين صناديق الفروع',
    category: 'actions',
    categoryLabel: 'إجراء مالي',
    icon: ArrowRightLeft,
    color: 'purple',
    targetModule: 'cashbox',
  },
  {
    id: 'stagnant_sla',
    title: 'فحص الركود وبلاغات SLA',
    subtitle: 'فحص ومتابعة الطرود المتأخرة بالفرع',
    category: 'actions',
    categoryLabel: 'إجراء تشغيلي',
    icon: AlertTriangle,
    color: 'amber',
    actionKey: 'stagnant',
  },
  {
    id: 'search_spotlight',
    title: 'البحث الشامل الفوري',
    subtitle: 'بحث سريع بالطرود والشحنات (Ctrl + K)',
    category: 'actions',
    categoryLabel: 'إجراء سريع',
    icon: Search,
    color: 'blue',
    actionKey: 'search',
  },
  {
    id: 'sound_toggle',
    title: 'التنبيهات الصوتية',
    subtitle: 'كتم أو تفعيل أصوات الإشعارات والتنبيهات',
    category: 'actions',
    categoryLabel: 'إجراء سريع',
    icon: Volume2,
    color: 'rose',
    actionKey: 'toggle_mute',
  },
  {
    id: 'cashbox_quick',
    title: 'رصيد الخزينة المباشر',
    subtitle: 'كشف رصيد الصندوق النقدي الفعلي',
    category: 'actions',
    categoryLabel: 'إجراء مالي',
    icon: Wallet,
    color: 'emerald',
    actionKey: 'cashbox',
  },
  {
    id: 'manifest_new',
    title: 'إنشاء منافيست شحن',
    subtitle: 'تجهيز رحلة جديدة وترحيل الشاحنة',
    category: 'actions',
    categoryLabel: 'إجراء تشغيلي',
    icon: Truck,
    color: 'indigo',
    actionKey: 'manifest_new',
  },

  // ==========================================
  // 3. التقارير والكشوفات المالية والتشغيلية (Reports)
  // ==========================================
  {
    id: 'report_cash_movement',
    title: 'تقرير حركة الصناديق اليومية',
    subtitle: 'كشف حركة النقدية وتدفقات الصندوق',
    category: 'reports',
    categoryLabel: 'تقرير مالي',
    icon: FileSpreadsheet,
    color: 'emerald',
    targetModule: 'cashbox',
  },
  {
    id: 'report_clearing_statement',
    title: 'كشف مطابقة وترصيد الفروع',
    subtitle: 'تقرير تسوية الذمم والمقاصة المركزية',
    category: 'reports',
    categoryLabel: 'تقرير مالي',
    icon: ArrowRightLeft,
    color: 'cyan',
    actionKey: 'clearing',
  },
  {
    id: 'report_shipping_revenues',
    title: 'تقرير إيرادات الشحن والـ COD',
    subtitle: 'تفصيل العمولات وإيرادات النقل المحصلة',
    category: 'reports',
    categoryLabel: 'تقرير مالي',
    icon: Coins,
    color: 'amber',
    targetModule: 'cashbox',
  },
  {
    id: 'report_sla_branches',
    title: 'تقرير كفاءة الفروع ومؤشرات SLA',
    subtitle: 'معدلات الإنجاز وسرعة التسليم بالوجهات',
    category: 'reports',
    categoryLabel: 'تقرير تشغيلي',
    icon: BarChart2,
    color: 'purple',
    targetModule: 'dashboard',
  },
  {
    id: 'report_stagnant_parcels',
    title: 'كشف الطرود الراكدة والمعلقة',
    subtitle: 'حصر الشحنات التي تجاوزت مهلة التخزين',
    category: 'reports',
    categoryLabel: 'تقرير تشغيلي',
    icon: AlertOctagon,
    color: 'rose',
    targetModule: 'arrivals',
  },
  {
    id: 'report_manifests_summary',
    title: 'كشف رحلات الشحن والمنافيستات',
    subtitle: 'سجل وتتبع حركة الشاحنات الصادرة والواردة',
    category: 'reports',
    categoryLabel: 'تقرير تشغيلي',
    icon: ClipboardList,
    color: 'indigo',
    targetModule: 'manifests',
  },
  {
    id: 'report_operating_expenses',
    title: 'كشف المصاريف والإنفاق التشغيلي',
    subtitle: 'بيان النفقات التشغيلية المعتمدة للمركز والفروع',
    category: 'reports',
    categoryLabel: 'تقرير مالي',
    icon: Receipt,
    color: 'rose',
    targetModule: 'expenses',
  },
  {
    id: 'report_payroll_sheet',
    title: 'مسير الرواتب والأجور المعتمد',
    subtitle: 'جدول مستحقات واستقطاعات الكادر',
    category: 'reports',
    categoryLabel: 'تقرير مالي',
    icon: Users,
    color: 'lime',
    targetModule: 'payroll',
  },
  {
    id: 'report_audit_trail',
    title: 'تقرير تدقيق وأمان العمليات',
    subtitle: 'كشف التتبع الزمني لكافة العمليات المالية',
    category: 'reports',
    categoryLabel: 'تقرير رقابي',
    icon: ShieldCheck,
    color: 'amber',
    targetModule: 'master_admin',
  },
];

const DEFAULT_PINNED_IDS = [
  'sound_toggle',
  'clearing',
  'stagnant_sla',
  'cashbox_quick',
  'search_spotlight',
  'directives',
  'intake',
  'manifests',
];

const COLOR_MAP: Record<
  string,
  { bg: string; text: string; border: string; badge: string; hover: string }
> = {
  cyan: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    hover: 'hover:border-cyan-400/60',
  },
  blue: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    hover: 'hover:border-blue-400/60',
  },
  indigo: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    hover: 'hover:border-indigo-400/60',
  },
  purple: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    hover: 'hover:border-purple-400/60',
  },
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    hover: 'hover:border-emerald-400/60',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    hover: 'hover:border-amber-400/60',
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    hover: 'hover:border-rose-400/60',
  },
  teal: {
    bg: 'bg-teal-500/15',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    hover: 'hover:border-teal-400/60',
  },
  lime: {
    bg: 'bg-lime-500/15',
    text: 'text-lime-400',
    border: 'border-lime-500/30',
    badge: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
    hover: 'hover:border-lime-400/60',
  },
  violet: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-400',
    border: 'border-violet-500/30',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    hover: 'hover:border-violet-400/60',
  },
};

export const DesktopQuickActionsPanel: React.FC<DesktopQuickActionsPanelProps> = ({
  isOpen,
  onClose,
  isMuted,
  onToggleMute,
  onOpenCashbox,
  onOpenStagnantInspector,
  onOpenDirectives,
  onOpenSearch,
  onSelectModule,
}) => {
  const {
    currentUser,
    currentBranch,
    currentBranchWithDerivedBalance,
    getStagnantParcels,
    pricingRules,
    brandingSettings,
    canAccessModule,
    hasPermission,
    formatCurrency,
    formatExchangeRate,
  } = useOrca();

  // Mode: regular shortcuts grid vs customization/manager view (triggered by gear button)
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Check if current user is allowed to customize shortcuts
  const canCustomize = hasPermission('shortcuts.customize');

  // If user loses customize permission while customizing, exit customization mode
  useEffect(() => {
    if (!canCustomize && isCustomizing) {
      setIsCustomizing(false);
    }
  }, [canCustomize, isCustomizing]);

  // Search filter inside customization menu
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'modules' | 'actions' | 'reports'>('all');

  // Clearing Reconciliation full-screen modal trigger
  const [isClearingModalOpen, setIsClearingModalOpen] = useState(false);

  // Check if a shortcut is allowed for current user
  const checkAllowed = (shortcutId: string) => {
    return isShortcutAllowedForUser(shortcutId, currentUser, canAccessModule, hasPermission, currentBranch);
  };

  // Determine role-based default shortcuts for this user
  const defaultForUser = useMemo(() => {
    if (currentUser?.permissions?.allowedShortcuts && currentUser.permissions.allowedShortcuts.length > 0) {
      return currentUser.permissions.allowedShortcuts.filter((id) => checkAllowed(id));
    }
    const roleDefaults = ROLE_DEFAULT_SHORTCUTS[currentUser.role] || DEFAULT_PINNED_IDS;
    return roleDefaults.filter((id) => checkAllowed(id));
  }, [currentUser, canAccessModule, hasPermission]);

  // Pinned shortcuts state with persistence scoped per user
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const userStorageKey = `orca_quick_shortcuts_user_${currentUser.id}`;
      const saved = safeStorage.getItem(userStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return defaultForUser;
  });

  // Re-sync when user changes or user-level permissions change
  useEffect(() => {
    try {
      const userStorageKey = `orca_quick_shortcuts_user_${currentUser.id}`;
      const saved = safeStorage.getItem(userStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id: string) => checkAllowed(id));
          if (valid.length > 0) {
            setPinnedIds(valid);
            return;
          }
        }
      }
    } catch {
      // ignore
    }
    setPinnedIds(defaultForUser);
  }, [currentUser.id, defaultForUser]);

  // Save to safeStorage when pinnedIds change
  const savePinnedIds = (newIds: string[]) => {
    setPinnedIds(newIds);
    try {
      const userStorageKey = `orca_quick_shortcuts_user_${currentUser.id}`;
      safeStorage.setItem(userStorageKey, JSON.stringify(newIds));
    } catch {
      // ignore
    }
  };

  const handleAddShortcut = (id: string) => {
    if (!checkAllowed(id)) return;
    if (!pinnedIds.includes(id)) {
      savePinnedIds([...pinnedIds, id]);
    }
  };

  const handleRemoveShortcut = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    savePinnedIds(pinnedIds.filter((item) => item !== id));
  };

  const handleResetDefaults = () => {
    savePinnedIds(defaultForUser);
  };

  const stagnantCount = getStagnantParcels().length;
  const currentUsdRate = brandingSettings?.exchangeRateUsdToSyp || pricingRules?.[0]?.exchangeRateSypPerUsd || 15000;

  // Currently pinned catalog items filtered strictly by user permissions
  const activeShortcuts = useMemo(() => {
    return pinnedIds
      .filter((id) => checkAllowed(id))
      .map((id) => SHORTCUT_CATALOG.find((item) => item.id === id))
      .filter((item): item is ShortcutCatalogItem => Boolean(item));
  }, [pinnedIds, currentUser, canAccessModule, hasPermission]);

  // Catalog items filtered by search, category, and user permissions for customization view
  const filteredCatalog = useMemo(() => {
    return SHORTCUT_CATALOG.filter((item) => {
      // Must be allowed for this user
      if (!checkAllowed(item.id)) return false;

      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.categoryLabel.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory, currentUser, canAccessModule, hasPermission]);

  // Handler for clicking a shortcut tile
  const handleExecuteShortcut = (item: ShortcutCatalogItem) => {
    // Safety check: ensure user still has permission
    if (!checkAllowed(item.id)) return;

    if (item.actionKey === 'toggle_mute') {
      onToggleMute();
      return;
    }

    if (item.actionKey === 'clearing') {
      setIsClearingModalOpen(true);
      return;
    }

    if (item.actionKey === 'stagnant') {
      onClose();
      onOpenStagnantInspector();
      return;
    }

    if (item.actionKey === 'search') {
      onClose();
      onOpenSearch();
      return;
    }

    if (item.actionKey === 'directives') {
      onClose();
      onOpenDirectives();
      return;
    }

    if (item.actionKey === 'cashbox' || item.actionKey === 'receipt_voucher' || item.actionKey === 'payment_voucher') {
      onClose();
      onOpenCashbox();
      return;
    }

    if (item.actionKey === 'manifest_new') {
      onClose();
      if (onSelectModule) onSelectModule('manifests');
      return;
    }

    if (item.targetModule) {
      onClose();
      if (onSelectModule) {
        onSelectModule(item.targetModule);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs select-none"
        onClick={onClose}
      />

      {/* Main Panel Container */}
      <div
        id="fluent_quick_actions_panel"
        dir="rtl"
        className="fixed bottom-16 left-3 sm:left-16 w-[360px] sm:w-[420px] max-w-[calc(100vw-24px)] bg-slate-900/98 backdrop-blur-3xl border border-slate-750 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in slide-in-from-bottom-5 duration-200 select-none text-slate-100"
      >
        {/* ========================================================================= */}
        {/* TOP HEADER WITH BRANDING + SMALL GEAR BUTTON + CLOSE BUTTON */}
        {/* ========================================================================= */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-inner">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black text-white tracking-wide">
                  لوحة الإختصارات السريعة
                </h2>
                <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold font-mono">
                  {activeShortcuts.length} إختصار مصرح
                </span>
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="text-slate-200 font-semibold">{currentUser.name}</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-medium">
                  {ROLE_DEFINITIONS[currentUser.role]?.title || currentUser.role}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* 1. زر المسنن الصغير للتحكم بلوحة الإختصارات (إذا كان مصرحاً له من محرك الصلاحيات) */}
            {canCustomize ? (
              <button
                type="button"
                id="btn_gear_customize_shortcuts"
                onClick={() => setIsCustomizing((prev) => !prev)}
                className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  isCustomizing
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-400'
                    : 'bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 hover:border-purple-500/50'
                }`}
                title={
                  isCustomizing
                    ? 'العودة للوحة الإختصارات'
                    : 'تخصيص لوحة الإختصارات (إضافة / حذف الأزرار المتاحة لدورك)'
                }
              >
                <Settings
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isCustomizing ? 'rotate-90 text-white' : 'text-slate-300'
                  }`}
                />
              </button>
            ) : (
              <div
                className="h-8 px-2 rounded-xl bg-slate-850 border border-slate-750 flex items-center gap-1 text-[10px] text-slate-400"
                title="أزرار لوحة الإختصارات مخصصة ومقفلة وفق محرك الصلاحيات المعتمد لدورك"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[9px] text-slate-300 hidden sm:inline">معتمد</span>
              </div>
            )}

            {/* 2. زر الإغلاق */}
            <button
              type="button"
              id="btn_close_quick_actions_panel"
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-750 shadow-xs"
              title="إغلاق اللوحة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW A: CUSTOMIZATION / MANAGEMENT VIEW (WHEN GEAR BUTTON IS CLICKED) */}
        {/* ========================================================================= */}
        {isCustomizing ? (
          <div className="flex flex-col flex-1 overflow-hidden p-3.5 sm:p-4 space-y-3">
            {/* Header info & Reset button */}
            <div className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>حدد أي زر أو واجهة أو تقرير لإضافته للوحة</span>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-2 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-750 text-[10px] flex items-center gap-1 transition cursor-pointer"
                title="استعادة الإختصارات الافتراضية"
              >
                <RotateCcw className="w-3 h-3" />
                <span>الافتراضي</span>
              </button>
            </div>

            {/* Live Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في كافة أزرار، واجهات وتقارير النظام..."
                className="w-full bg-slate-950/80 border border-slate-750 rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/70 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs: الكل / الواجهات / الأزرار / التقارير */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-[11px] shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-bold transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل ({SHORTCUT_CATALOG.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('modules')}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-bold transition-all cursor-pointer ${
                  selectedCategory === 'modules'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                الواجهات ({SHORTCUT_CATALOG.filter((i) => i.category === 'modules').length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('actions')}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-bold transition-all cursor-pointer ${
                  selectedCategory === 'actions'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                الأزرار ({SHORTCUT_CATALOG.filter((i) => i.category === 'actions').length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('reports')}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-bold transition-all cursor-pointer ${
                  selectedCategory === 'reports'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                التقارير ({SHORTCUT_CATALOG.filter((i) => i.category === 'reports').length})
              </button>
            </div>

            {/* Catalog List with Add/Remove Toggles */}
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5 max-h-[350px]">
              {filteredCatalog.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  لا توجد عناصر مطابقة لـ "{searchQuery}"
                </div>
              ) : (
                filteredCatalog.map((item) => {
                  const isPinned = pinnedIds.includes(item.id);
                  const Icon = item.icon;
                  const colorConfig = COLOR_MAP[item.color] || COLOR_MAP.purple;

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                        isPinned
                          ? 'bg-slate-850/90 border-slate-700 shadow-xs'
                          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-right truncate min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white truncate">
                              {item.title}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-md border shrink-0 ${colorConfig.badge}`}
                            >
                              {item.categoryLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Add/Remove Action Button */}
                      {isPinned ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveShortcut(item.id)}
                          className="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0 shadow-xs"
                          title="حذف من لوحة الإختصارات"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddShortcut(item.id)}
                          className="px-2.5 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0 shadow-xs"
                          title="إضافة إلى لوحة الإختصارات"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Done & Return button */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCustomizing(false)}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تم الحفظ - العودة للوحة الإختصارات ({pinnedIds.length})</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW B: MAIN ACTIVE SHORTCUTS GRID */
          /* ========================================================================= */
          <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {activeShortcuts.map((item) => {
                const Icon = item.icon;
                const colorConfig = COLOR_MAP[item.color] || COLOR_MAP.purple;

                // Special dynamic subtitle values
                let dynamicValue = item.subtitle;
                let isCustomActive = false;

                if (item.id === 'sound_toggle') {
                  dynamicValue = isMuted ? 'الصوت مكتوم' : 'الصوت مفعل';
                  isCustomActive = isMuted;
                } else if (item.id === 'stagnant_sla') {
                  dynamicValue =
                    stagnantCount > 0 ? `${stagnantCount} طرود متأخرة` : 'لا توجد متأخرات';
                } else if (item.id === 'cashbox_quick') {
                  dynamicValue = formatCurrency(currentBranchWithDerivedBalance.boxSypBalance ?? 0, 'SYP');
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => handleExecuteShortcut(item)}
                    className={`group relative p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 text-right ${
                      isCustomActive
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-200'
                    } ${colorConfig.hover} shadow-xs hover:shadow-md active:scale-98`}
                  >
                    {/* Direct delete button on hover (حذف إختصار) */}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveShortcut(item.id, e)}
                      className="absolute top-1 left-1 w-5 h-5 rounded-md bg-slate-900/90 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 border border-slate-700/80"
                      title="حذف هذا الإختصار من اللوحة"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="text-right truncate flex-1 min-w-0">
                      <div className="font-bold text-[11px] text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate opacity-85 mt-0.5">
                        {dynamicValue}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Shortcut Button Card in the grid */}
              <button
                type="button"
                onClick={() => setIsCustomizing(true)}
                className="p-2.5 sm:p-3 rounded-2xl border border-dashed border-slate-700 hover:border-purple-500/60 bg-slate-900/50 hover:bg-purple-500/10 text-slate-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2 cursor-pointer col-span-2 group"
                title="فتح لوحة التحكم وإضافة إختصارات جديدة"
              >
                <div className="w-7 h-7 rounded-xl bg-purple-500/15 group-hover:bg-purple-500/25 border border-purple-500/30 flex items-center justify-center text-purple-400 transition">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">
                  تخصيص وإضافة إختصار جديد من كافة عناصر النظام...
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DIRECT EMBEDDED FULL-SCREEN CLEARING RECONCILIATION MODAL */}
      {/* ========================================================================= */}
      {isClearingModalOpen && (
        <ClearingReconciliationModal
          isOpen={isClearingModalOpen}
          onClose={() => setIsClearingModalOpen(false)}
          onVoucherCreated={() => {}}
        />
      )}
    </>
  );
};
