import React from 'react';
import { useOrca, ActiveModule } from '../context/OrcaContext';
import { PWAInstallButton } from './PWAInstallButton';
import { NetworkLatencyIndicator } from './NetworkLatencyIndicator';
import {
  LayoutDashboard,
  PackagePlus,
  Truck,
  Warehouse,
  ScanLine,
  PackageCheck,
  WalletCards,
  SlidersHorizontal,
  Users,
  Database,
  ShieldAlert,
  Receipt,
  UserCheck,
  Car,
  Banknote,
  Monitor,
  X,
  Building2,
  Search,
  ArrowRight,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

interface DesktopWindowHeaderProps {
  onClose: () => void;
  onOpenSearch?: () => void;
  onBack?: () => void;
}

export const MODULE_METADATA: Record<
  ActiveModule,
  {
    title: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
    gradient: string;
    accentColor: string;
  }
> = {
  dashboard: {
    title: 'لوحة التحكم والتحليلات',
    subtitle: 'مؤشرات الأداء اللحظية، حركة الطرود، والتدفق المالي للفرع',
    icon: LayoutDashboard,
    gradient: 'from-cyan-500 to-blue-600',
    accentColor: 'text-cyan-400',
  },
  intake: {
    title: 'تسجيل واستلام الطرود',
    subtitle: 'إدخال بوالص الشحن السريع، احتساب الرسوم، وتوليد الباركودات',
    icon: PackagePlus,
    gradient: 'from-emerald-500 to-teal-600',
    accentColor: 'text-emerald-400',
  },
  manifests: {
    title: 'ترحيل الشاحنات والمانافيست',
    subtitle: 'إعداد رحلات النقل البري بين المحافظات وتوليد بيانات الشحن',
    icon: Truck,
    gradient: 'from-blue-500 to-indigo-600',
    accentColor: 'text-blue-400',
  },
  arrivals: {
    title: 'مستودع الوصول والفرز',
    subtitle: 'مطابقة شحنات الشاحنات الواردة، الفرز، وإدارة طرود المستودع',
    icon: Warehouse,
    gradient: 'from-amber-500 to-orange-600',
    accentColor: 'text-amber-400',
  },
  delivery: {
    title: 'قسم التسليم',
    subtitle: 'تسليم الطرود للزبائن، قارئ الهوية، ومحاضر التسليم والتسليم عبر الموزعين',
    icon: PackageCheck,
    gradient: 'from-purple-500 to-violet-600',
    accentColor: 'text-purple-400',
  },
  cashbox: {
    title: 'الخزينة والصندوق المالي',
    subtitle: 'حركات القبض والصرف، سندات القبض/الصرف، والإقفال اليومي للفرع',
    icon: WalletCards,
    gradient: 'from-emerald-500 to-green-600',
    accentColor: 'text-emerald-400',
  },
  pricing: {
    title: 'محرك التسعير والتعرفة',
    subtitle: 'مصفوفة المسافات، قواعد الأوزان والأحجام، وسياسة COD',
    icon: SlidersHorizontal,
    gradient: 'from-pink-500 to-rose-600',
    accentColor: 'text-pink-400',
  },
  admin_users: {
    title: 'المستخدمين والفروع والصلاحيات',
    subtitle: 'إدارة الشبكة اللوجستية، مصفوفة الأدوار، وتراخيص الوصول',
    icon: Users,
    gradient: 'from-teal-500 to-cyan-600',
    accentColor: 'text-teal-400',
  },
  backup_cloud: {
    title: 'النسخ الاحتياطي واستعادة البيانات',
    subtitle: 'إدارة وتصدير النسخ الاحتياطية المشفرة، السجلات المدققة، وتزامن البيانات',
    icon: Database,
    gradient: 'from-amber-500 to-amber-600',
    accentColor: 'text-amber-400',
  },
  master_admin: {
    title: 'لوحة الإدارة المركزية والسيادية',
    subtitle: 'الرقابة الشاملة على مستوى المنظومة، التقارير الإدارية، وإعدادات النظام',
    icon: ShieldAlert,
    gradient: 'from-amber-500 to-red-600',
    accentColor: 'text-amber-400',
  },
  expenses: {
    title: 'دليل المصاريف والنثريات',
    subtitle: 'تسجيل وتبويب نفقات التشغيل، فواتير المحروقات، والمشتريات اليومية',
    icon: Receipt,
    gradient: 'from-rose-500 to-red-600',
    accentColor: 'text-rose-400',
  },
  customers: {
    title: 'دليل العملاء والتجار المعتمدين',
    subtitle: 'سجل الحسابات، الأرقام الوطنية، تصنيف العملاء وتاريخ الشحنات',
    icon: UserCheck,
    gradient: 'from-cyan-500 to-teal-600',
    accentColor: 'text-cyan-400',
  },
  vehicles: {
    title: 'أسطول المركبات والشاحنات',
    subtitle: 'بيانات الشاحنات، أرقام اللوحات، سجلات الصيانة، والسائقين المكلفين',
    icon: Car,
    gradient: 'from-blue-500 to-sky-600',
    accentColor: 'text-blue-400',
  },
  payroll: {
    title: 'الموظفين والرواتب والاستحقاقات',
    subtitle: 'إدارة الكادر البشري، مسيرات الرواتب الشهرية، المكافآت والخصميات',
    icon: Banknote,
    gradient: 'from-emerald-500 to-teal-600',
    accentColor: 'text-emerald-400',
  },
  fixed_assets: {
    title: 'إدارة الأصول الثابتة وتجهيزات الفروع',
    subtitle: 'أجهزة الكمبيوتر، طابعات الباركود، التجهيزات المكتبية، ومراقبة مصاريف وصيانة الأصول',
    icon: Monitor,
    gradient: 'from-violet-500 to-purple-600',
    accentColor: 'text-violet-400',
  },
  courier_portal: {
    title: 'بوابة الموزع المحمول (Mobile Courier Portal)',
    subtitle: 'استقبال المانافيست، التسليم الفردي للعميل، إرجاع الطرود بالسبب، وتصفية العهدة المالية',
    icon: Smartphone,
    gradient: 'from-purple-600 to-indigo-600',
    accentColor: 'text-purple-300',
  },
  customer_portal: {
    title: 'بوابة تتبع الزبائن (Customer Tracking Portal)',
    subtitle: 'متابعة حركة الطرود الصادرة والواردة، كشف حساب تحصيلات الـ COD، والإحصائيات والتحليلات',
    icon: ShieldCheck,
    gradient: 'from-indigo-600 to-sky-600',
    accentColor: 'text-indigo-400',
  },
};

export const DesktopWindowHeader: React.FC<DesktopWindowHeaderProps> = ({
  onClose,
  onOpenSearch,
  onBack,
}) => {
  const { activeModule, currentBranch, currentUser } = useOrca();
  const currentMeta = MODULE_METADATA[activeModule] || MODULE_METADATA.dashboard;
  const IconComponent = currentMeta.icon;
  const isSuperAdmin = currentUser.role === 'super_admin';
  const displayTitle =
    activeModule === 'dashboard' && isSuperAdmin
      ? 'غرفة المراقبة المركزية (لوحة المراقبة الشاملة)'
      : currentMeta.title;

  return (
    <div
      id="fluent_window_header"
      className="w-full bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 sm:gap-3 select-none shadow-sm z-30 shrink-0"
    >
      {/* Right Side (RTL): Back Button + Module Icon + Titles + Branch Tag */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {/* زر رجوع للواجهة السابقة في يمين وأعلى الشاشة */}
        <button
          type="button"
          id="fluent_btn_back_header"
          onClick={onBack || onClose}
          className="h-7 px-2.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white border border-cyan-800/80 hover:border-cyan-500 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 group"
          title="رجوع للواجهة السابقة"
        >
          <ArrowRight className="w-3.5 h-3.5 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-bold">رجوع</span>
        </button>

        <div
          className={`w-7 h-7 rounded-lg bg-gradient-to-br ${currentMeta.gradient} flex items-center justify-center text-white shadow-md shadow-black/30 shrink-0 ring-1 ring-white/20`}
        >
          <IconComponent className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex items-center gap-2">
          <h1 className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight truncate">
            {displayTitle}
          </h1>

          {/* Active Branch Tag (Shown only for specific branches, not showing global network 14 branches text) */}
          {!(activeModule === 'dashboard' && isSuperAdmin) && (
            <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/70 text-[10px] text-slate-300 font-medium">
              <Building2 className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-white truncate max-w-[110px] sm:max-w-none">
                {currentBranch.name}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300">
                {currentBranch.governorate}
              </span>
            </div>
          )}

          {/* Network Latency Indicator directly next to branch name */}
          <NetworkLatencyIndicator />

          {/* Live active dot */}
          <span className="hidden md:inline-flex items-center gap-1 text-[9px] text-emerald-400 font-medium bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>نشط</span>
          </span>
        </div>
      </div>

      {/* Left Side (RTL): PWA Install + Search trigger + Small Close Button in corner */}
      <div className="flex items-center gap-1.5 shrink-0">
        <PWAInstallButton variant="header" />

        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 text-[10px] font-medium transition cursor-pointer"
            title="البحث السريع (Ctrl+K)"
          >
            <Search className="w-3 h-3 text-cyan-400" />
            <span>بحث</span>
            <kbd className="text-[9px] bg-slate-900 px-1 py-0.2 rounded border border-slate-700 font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Small Close Button in the corner to save maximum space */}
        <button
          type="button"
          id="fluent_btn_close_window"
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer active:scale-95"
          title="إغلاق والعودة إلى سطح المكتب"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
