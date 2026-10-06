import React, { useState, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import { safeStorage } from '../utils/storage';
import {
  blockNonAmountKeys,
  blockNonIntegerKeys,
  sanitizeDecimal,
  sanitizeDigitsOnly,
} from '../utils/numberSanitizer';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Users,
  Coins,
  DollarSign,
  SlidersHorizontal,
  FileText,
  FileCheck2,
  Activity,
  ArrowRightLeft,
  KeyRound,
  Edit3,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  Sliders,
  Database,
  Printer,
  ChevronDown,
  ChevronUp,
  MapPin,
  Truck,
  TrendingUp,
  Percent,
  History,
  Download,
  Upload,
  HelpCircle,
  ExternalLink,
  BellRing,
  Clock,
  Timer,
  MessageSquare,
  Send,
  AlertOctagon,
  Zap,
  AlertCircle,
  Contact,
  Receipt,
  Car,
  UserCheck,
  Package,
  Monitor,
  X,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';
import { OrcaLogo } from './OrcaLogo';
import { DEFAULT_PACKAGE_TYPES } from '../data/initialData';
import { User, Branch, Governorate, Currency, PackageType, PricingRule, AuditLogEntry, AlertsAndDeadlinesSettings } from '../types';
import { UserEditModal } from './UserEditModal';
import { CustomerDirectoryView } from './CustomerDirectoryView';
import { VehicleDirectoryView } from './VehicleDirectoryView';
import { EmployeePayrollView } from './EmployeePayrollView';
import { ExpensesDirectoryView } from './ExpensesDirectoryView';
import { BranchCashboxBreakdownModal } from './BranchCashboxBreakdownModal';

export const MasterAdminDashboard: React.FC = () => {
  const {
    branches,
    users,
    parcels,
    truckManifests,
    transactions,
    pricingRules,
    codSettings,
    brandingSettings,
    alertsSettings,
    auditLogs,
    currentBranch,
    currentUser,
    getCashboxBreakdown,
    setCurrentBranch,
    updateBrandingSettings,
    updateAlertsSettings,
    getStagnantParcels,
    getDelayedTrucks,
    getOverdueCourierDeliveries,
    getUnclosedBranchesForSettlement,
    getOverdueCodPayouts,
    sendStagnantParcelAlert,
    triggerManualSlaCheck,
    updateBranchDirectBalances,
    calculateBranchLiveBalance,
    setUserPassword,
    updateBranch,
    addBranch,
    addUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    updatePricingRules,
    updateCodSettings,
    addAuditLog,
    clearAuditLogs,
    exportDatabaseJson,
    importDatabaseJson,
    resetToDemoData,
    switchUserDirectly,
    setSelectedParcelForQuickView,
    setActiveModule,
    formatCurrency,
    formatNumber,
    formatExchangeRate,
  } = useOrca();

  // Active Admin Tab (Persisted across refreshes)
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'vaults'
    | 'pricing'
    | 'branches'
    | 'users'
    | 'customers'
    | 'vehicles'
    | 'employees'
    | 'expenses'
    | 'branding'
    | 'alerts'
    | 'audit'
    | 'database'
  >(() => {
    try {
      const savedTab = safeStorage.getItem('orca_master_admin_active_tab');
      if (savedTab) return savedTab as any;
    } catch {}
    return 'overview';
  });

  useEffect(() => {
    try {
      safeStorage.setItem('orca_master_admin_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  const [auditSubView, setAuditSubView] = useState<'logs' | 'database'>('logs');

  // Vault Balance Override Modal State
  const [selectedBranchForOverride, setSelectedBranchForOverride] = useState<Branch | null>(null);
  const [overrideSyp, setOverrideSyp] = useState<number>(0);
  const [overrideUsd, setOverrideUsd] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);

  // User Management Modal State
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [breakdownBranch, setBreakdownBranch] = useState<Branch | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState<string>('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);

  // Quick Exchange Rate State
  const [tempExchangeRate, setTempExchangeRate] = useState<number>(brandingSettings.exchangeRateUsdToSyp || 15000);
  const [tempFuelSurcharge, setTempFuelSurcharge] = useState<number>(brandingSettings.fuelSurchargePercent || 5);
  const [exchangeRateSaved, setExchangeRateSaved] = useState<boolean>(false);

  // Sync with central exchange rate
  useEffect(() => {
    if (brandingSettings.exchangeRateUsdToSyp) {
      setTempExchangeRate(brandingSettings.exchangeRateUsdToSyp);
    }
  }, [brandingSettings.exchangeRateUsdToSyp]);

  // Package Types Management State (Manual Pricing Mode)
  const [showAddTypeInput, setShowAddTypeInput] = useState<boolean>(false);
  const [newPackageTypeName, setNewPackageTypeName] = useState<string>('');
  const [packageTypeActionMsg, setPackageTypeActionMsg] = useState<string | null>(null);

  const activePackageTypes = brandingSettings.packageTypes && brandingSettings.packageTypes.length > 0
    ? brandingSettings.packageTypes
    : DEFAULT_PACKAGE_TYPES;

  const handleAddPackageTypeAdmin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newPackageTypeName.trim();
    if (!trimmed) return;
    if (activePackageTypes.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setPackageTypeActionMsg(`نوع الطرد "${trimmed}" موجود مسبقاً.`);
      setTimeout(() => setPackageTypeActionMsg(null), 3000);
      return;
    }
    const updated = [...activePackageTypes, trimmed];
    updateBrandingSettings({ packageTypes: updated });
    addAuditLog('إضافة نوع طرد جديد', 'pricing', `تمت إضافة نوع الطرد: [${trimmed}] لقائمة إدخال البيانات`);
    setNewPackageTypeName('');
    setShowAddTypeInput(false);
    setPackageTypeActionMsg(`✓ تمت إضافة [${trimmed}] بنجاح إلى قائمة إدخال البيانات`);
    setTimeout(() => setPackageTypeActionMsg(null), 3500);
  };

  const handleRemovePackageTypeAdmin = (typeToRemove: string) => {
    if (activePackageTypes.length <= 1) {
      alert('يجب الإبقاء على نوع طرد واحد على الأقل في القائمة.');
      return;
    }
    const updated = activePackageTypes.filter((t) => t !== typeToRemove);
    updateBrandingSettings({ packageTypes: updated });
    addAuditLog('حذف نوع طرد', 'pricing', `تم حذف نوع الطرد: [${typeToRemove}]`);
    setPackageTypeActionMsg(`تم حذف [${typeToRemove}] من قائمة إدخال البيانات`);
    setTimeout(() => setPackageTypeActionMsg(null), 3000);
  };

  const handleResetPackageTypesAdmin = () => {
    if (window.confirm('هل أنت متأكد من استعادة قائمة أنواع الطرود الافتراضية؟')) {
      updateBrandingSettings({ packageTypes: DEFAULT_PACKAGE_TYPES });
      addAuditLog('استعادة أنواع الطرود الافتراضية', 'pricing', 'تمت استعادة قائمة أنواع الطرود القياسية في النظام');
      setPackageTypeActionMsg('✓ تمت استعادة قائمة أنواع الطرود القياسية');
      setTimeout(() => setPackageTypeActionMsg(null), 3000);
    }
  };

  // Branding Settings Form State
  const [brandingForm, setBrandingForm] = useState(brandingSettings);
  const [brandingSaved, setBrandingSaved] = useState<boolean>(false);
  const [isLogoProcessing, setIsLogoProcessing] = useState<boolean>(false);
  const [isLogoDragging, setIsLogoDragging] = useState<boolean>(false);
  const [uploadVerificationInfo, setUploadVerificationInfo] = useState<{
    fileName: string;
    fileSize: string;
    dimensions?: string;
    status: 'idle' | 'success' | 'error';
    message: string;
  } | null>(null);

  // Keep branding form synced when external/cloud changes occur
  useEffect(() => {
    setBrandingForm(brandingSettings);
  }, [brandingSettings]);

  // Alerts & Deadlines Settings Form State
  const [alertsForm, setAlertsForm] = useState<AlertsAndDeadlinesSettings>(alertsSettings);
  const [alertsSaved, setAlertsSaved] = useState<boolean>(false);
  const [slaScanResult, setSlaScanResult] = useState<{ stagnantCount: number; delayedTrucksCount: number } | null>(null);
  const [alertSentParcelId, setAlertSentParcelId] = useState<string | null>(null);

  // Audit Logs Filter
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Branch Creation / Edit Modal State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);

  // Totals Calculation across whole Syrian Network using true dynamic cashbox breakdown engine
  const totalNetworkSyp = branches.reduce((sum, b) => {
    const breakdown = getCashboxBreakdown(b.id);
    return sum + (breakdown.totalBranchSyp || 0);
  }, 0);

  const totalNetworkUsd = branches.reduce((sum, b) => {
    const breakdown = getCashboxBreakdown(b.id);
    return sum + (breakdown.totalBranchUsd || 0);
  }, 0);
  const totalParcelsCount = parcels.length;
  const activeTrucksCount = truckManifests.filter((m) => m.status === 'dispatched').length;

  if (currentUser.role !== 'super_admin') {
    return (
      <div className="p-8 max-w-xl mx-auto text-center bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl space-y-4 my-12">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">الوصول مقيد - خاص بالمدير العام حصراً</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          هذه الواجهة مخصصة للإدارة المركزية العليا لتعديل الإعدادات، الأسعار، العملات، والمستخدمين. دورك الحالي [
          {currentUser.name} - {currentUser.role}] مقيد بصلاحيات إدخال البيانات المعتمدة لفرعك.
        </p>
      </div>
    );
  }

  // Handle Vault Direct Override Submit
  const handleDirectBalanceOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchForOverride) return;
    if (!overrideReason.trim()) {
      alert('يرجى كتابة سبب التعديل المالي لتسجيله في سجل التدقيق الأمني');
      return;
    }

    updateBranchDirectBalances(selectedBranchForOverride.id, overrideSyp, overrideUsd, overrideReason);
    setOverrideSuccess(`تم تعديل رصيد فرع [${selectedBranchForOverride.name}] بنجاح وتسجيله في سجل الرقابة`);
    setTimeout(() => {
      setSelectedBranchForOverride(null);
      setOverrideSuccess(null);
      setOverrideReason('');
    }, 1200);
  };

  // Open Vault Override Modal
  const openVaultOverride = (b: Branch) => {
    setSelectedBranchForOverride(b);
    setOverrideSyp(calculateBranchLiveBalance(b.id, 'SYP'));
    setOverrideUsd(calculateBranchLiveBalance(b.id, 'USD'));
    setOverrideReason('');
    setOverrideSuccess(null);
  };

  // Save Exchange Rate & Global Currency Settings
  const handleSaveCurrencySettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateBrandingSettings({
      exchangeRateUsdToSyp: tempExchangeRate,
      fuelSurchargePercent: tempFuelSurcharge,
    });
    setExchangeRateSaved(true);
    addAuditLog('تعديل سعر الصرف المركزي', 'pricing', `تم تعديل سعر صرف الدولار إلى ${formatExchangeRate(tempExchangeRate)} ونسبة المحروقات إلى ${tempFuelSurcharge}%`);
    setTimeout(() => setExchangeRateSaved(false), 2000);
  };

  // Process and Embed Image File into Base64 Data URI with strict validation
  const processAndEmbedImageFile = (
    field: 'logoUrl' | 'printLogoUrl' | 'appBackgroundUrl',
    file: File
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.svg')) {
      setUploadVerificationInfo({
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        status: 'error',
        message: 'الملف المحدد ليس صورة صالحة. يرجى اختيار ملف صورة (PNG, JPG, SVG, WEBP).',
      });
      return;
    }

    setIsLogoProcessing(true);
    setUploadVerificationInfo(null);

    const fieldLabels: Record<string, string> = {
      logoUrl: 'شعار وأيقونة التطبيق',
      printLogoUrl: 'شعار المطبوعات والورقيات الرسمية',
      appBackgroundUrl: 'صورة خلفية سطح المكتب والتطبيق',
    };
    const fieldName = fieldLabels[field] || 'الصورة';

    // If SVG, read as Data URI or plain text
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        if (res) {
          const nextForm = { ...brandingForm, [field]: res };
          setBrandingForm(nextForm);
          updateBrandingSettings(nextForm);
          setUploadVerificationInfo({
            fileName: file.name,
            fileSize: (file.size / 1024).toFixed(1) + ' KB',
            dimensions: 'فيكتور رقمي (SVG)',
            status: 'success',
            message: `تم رفع وتحديث ${fieldName} بنجاح وتعميمها فورياً على جميع الفروع.`,
          });
        }
        setIsLogoProcessing(false);
      };
      reader.onerror = () => {
        setIsLogoProcessing(false);
        setUploadVerificationInfo({
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
          status: 'error',
          message: 'تعذر قراءة ملف SVG، يرجى المحاولة مجدداً.',
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // For raster images (PNG, JPG, WebP, etc.), optimize via HTML5 canvas
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        setIsLogoProcessing(false);
        setUploadVerificationInfo({
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
          status: 'error',
          message: 'تعذر استخراج بيانات الصورة.',
        });
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxDim = field === 'appBackgroundUrl' ? 1400 : 900;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const originalDims = `${width} × ${height} px`;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        let finalDataUrl = rawDataUrl;
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          finalDataUrl = file.type === 'image/jpeg' 
            ? canvas.toDataURL('image/jpeg', 0.90) 
            : canvas.toDataURL('image/png');
        }

        const nextForm = { ...brandingForm, [field]: finalDataUrl };
        setBrandingForm(nextForm);
        updateBrandingSettings(nextForm);
        setIsLogoProcessing(false);
        setUploadVerificationInfo({
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
          dimensions: originalDims,
          status: 'success',
          message: `تم رفع وتحديث ${fieldName} بنجاح وتعميمها فورياً على جميع الفروع.`,
        });
      };
      img.onerror = () => {
        setIsLogoProcessing(false);
        setUploadVerificationInfo({
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + ' KB',
          status: 'error',
          message: 'الملف تالف أو غير مدعوم كصورة.',
        });
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      setIsLogoProcessing(false);
      setUploadVerificationInfo({
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        status: 'error',
        message: 'حدث خطأ أثناء قراءة ملف الصورة.',
      });
    };
    reader.readAsDataURL(file);
  };

  // Specific file upload handlers
  const handleAppLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndEmbedImageFile('logoUrl', file);
    }
  };

  const handlePrintLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndEmbedImageFile('printLogoUrl', file);
    }
  };

  const handleAppBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndEmbedImageFile('appBackgroundUrl', file);
    }
  };

  // Legacy alias for compatibility
  const processAndEmbedLogoFile = (file: File) => processAndEmbedImageFile('logoUrl', file);
  const handleLogoFileUpload = handleAppLogoUpload;
  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsLogoDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndEmbedImageFile('logoUrl', file);
    }
  };

  // Immediate Save & Broadcast Logo to all Branches
  const handleSaveAndBroadcastLogo = () => {
    updateBrandingSettings(brandingForm);
    setBrandingSaved(true);
    addAuditLog(
      'تثبيت وتعميم شعار الهوية لجميع الفروع',
      'branding',
      `تم تثبيت واعتماد الشعار وحفظه في أصل النظام وتعميمه تلقائياً على كل الفروع السورية (${brandingForm.companyName})`
    );
    setTimeout(() => setBrandingSaved(false), 3000);
  };

  // Save Branding Settings
  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    updateBrandingSettings(brandingForm);
    setBrandingSaved(true);
    setTimeout(() => setBrandingSaved(false), 2000);
  };

  const handleResetAppLogo = () => {
    const next = { ...brandingForm, logoUrl: '/orca_express_logo.jpg' };
    setBrandingForm(next);
    updateBrandingSettings(next);
    setUploadVerificationInfo({
      fileName: 'orca_express_logo.jpg',
      fileSize: 'افتراضي',
      status: 'success',
      message: 'تمت استعادة الشعار الافتراضي للتطبيق بنجاح.',
    });
  };

  const handleResetPrintLogo = () => {
    const next = { ...brandingForm, printLogoUrl: '/orca_print_bw.png' };
    setBrandingForm(next);
    updateBrandingSettings(next);
    setUploadVerificationInfo({
      fileName: 'orca_print_bw.png',
      fileSize: 'الرسمي المعتمد (أبيض وأسود)',
      status: 'success',
      message: 'تم اعتماد واستعادة الشعار الرسمي المعتمد للمطبوعات والورقيات (أبيض وأسود) بنجاح.',
    });
  };

  const handleClearAppBackground = () => {
    const next = { ...brandingForm, appBackgroundUrl: '' };
    setBrandingForm(next);
    updateBrandingSettings(next);
    setUploadVerificationInfo({
      fileName: 'خلفية افتراضية',
      fileSize: '-',
      status: 'success',
      message: 'تمت إزالة الخلفية المخصصة والرجوع إلى خلفية النظام الأساسية.',
    });
  };

  // Save Alerts & Deadlines Settings
  const handleSaveAlertsSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateAlertsSettings(alertsForm);
    setAlertsSaved(true);
    setTimeout(() => setAlertsSaved(false), 2000);
  };

  // Run Manual SLA Diagnostic
  const handleTriggerSlaScan = () => {
    const res = triggerManualSlaCheck();
    setSlaScanResult(res);
    setTimeout(() => setSlaScanResult(null), 5000);
  };

  // Send single parcel stagnant alert
  const handleSendSingleStagnantAlert = (parcelId: string) => {
    sendStagnantParcelAlert(parcelId);
    setAlertSentParcelId(parcelId);
    setTimeout(() => setAlertSentParcelId(null), 3000);
  };

  // Save User Password Change
  const handleSaveUserPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newPasswordValue.trim()) return;

    setUserPassword(passwordModalUser.id, newPasswordValue.trim());
    setPasswordChangeSuccess(`تم تغيير كلمة المرور للمستخدم [${passwordModalUser.name}] بنجاح`);
    setTimeout(() => {
      setPasswordModalUser(null);
      setPasswordChangeSuccess(null);
      setNewPasswordValue('');
    }, 1000);
  };

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesCategory = auditCategoryFilter === 'all' || log.category === auditCategoryFilter;
    const matchesQuery =
      !auditSearchQuery.trim() ||
      log.action.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(auditSearchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div id="master_admin_dashboard" className="space-y-4 animate-in fade-in duration-300 pb-20">
      {/* Top Sovereignty Header Banner - Compact & Streamlined */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                غرفة المراقبة والتحكم المركزي
              </h1>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                الإدارة العامة
              </span>
            </div>
          </div>
        </div>

        {/* Master Control Navigation Bar - Two Rows of 6 Buttons Each */}
        <div className="space-y-1 mt-2 pt-2 border-t border-slate-800/80 w-full">
          {/* Row 1: Operations, Fleet & Financials (6 buttons) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-6 gap-1.5">
            <button
              id="tab_admin_overview"
              onClick={() => setActiveTab('overview')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'overview'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">نظرة عامة</span>
            </button>

            <button
              id="tab_admin_customers"
              onClick={() => setActiveTab('customers')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'customers'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <Contact className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <span className="whitespace-nowrap">دليل العملاء</span>
            </button>

            <button
              id="tab_admin_vehicles"
              onClick={() => setActiveTab('vehicles')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'vehicles'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <Car className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span className="whitespace-nowrap">دليل المركبات</span>
            </button>

            <button
              id="tab_admin_employees"
              onClick={() => setActiveTab('employees')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'employees'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span className="whitespace-nowrap">الموظفين والرواتب</span>
            </button>

            <button
              id="tab_admin_expenses"
              onClick={() => setActiveTab('expenses')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'expenses'
                  ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span className="whitespace-nowrap">دليل المصاريف</span>
            </button>

            <button
              id="tab_admin_vaults"
              onClick={() => setActiveTab('vaults')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'vaults'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">الخزائن والسيولة</span>
            </button>
          </div>

          {/* Row 2: Administration, System & Governance (6 buttons) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-6 gap-1.5">
            <button
              id="tab_admin_pricing"
              onClick={() => setActiveTab('pricing')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'pricing'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">العملات والتسعير</span>
            </button>

            <button
              id="tab_admin_branches"
              onClick={() => setActiveTab('branches')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'branches'
                  ? 'bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">الفروع</span>
            </button>

            <button
              id="tab_admin_users"
              onClick={() => setActiveTab('users')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'users'
                  ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">المستخدمين</span>
            </button>

            <button
              id="tab_admin_branding"
              onClick={() => setActiveTab('branding')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'branding'
                  ? 'bg-pink-500 text-white border-pink-400 shadow-md shadow-pink-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">الهوية والترويسة</span>
            </button>

            <button
              id="tab_admin_alerts"
              onClick={() => setActiveTab('alerts')}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'alerts'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <BellRing className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">المهل و SLA</span>
            </button>

            <button
              id="tab_admin_audit"
              onClick={() => {
                setActiveTab('audit');
                setAuditSubView('logs');
              }}
              className={`w-full px-2 py-2 rounded-xl text-[11px] xl:text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center cursor-pointer border ${
                activeTab === 'audit' || activeTab === 'database'
                  ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 bg-slate-950/40 border-slate-800/60'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">الرقابة والنسخ</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'audit' || activeTab === 'database' ? 'bg-black/20 text-white' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {auditLogs.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & CENTRAL COMMAND */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
                <span>سيولة الصناديق بالليرة السورية</span>
                <Coins className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {formatCurrency(totalNetworkSyp || 0, 'SYP')}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">إجمالي أرصدة الخزائن الفعلية</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
                <span>سيولة الصناديق بالدولار</span>
                <DollarSign className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl font-bold text-cyan-400">
                {formatCurrency(totalNetworkUsd || 0, 'USD')}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">إجمالي النقد الأجنبي المتاح</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
                <span>الطرود المسجلة</span>
                <Truck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {totalParcelsCount} <span className="text-xs font-normal text-slate-400">طرد</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">{activeTrucksCount} شاحنات ترحيل نشطة</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
                <span>حسابات المستخدمين</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {users.length} <span className="text-xs font-normal text-slate-400">مستخدم</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">مع صلاحيات وصول مخصصة</p>
            </div>
          </div>

          {/* Quick Direct Actions Panel */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <h3 className="text-xs sm:text-sm font-bold text-white mb-2.5 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>إجراءات الإدارة السريعة</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                onClick={() => setActiveTab('vaults')}
                className="p-3 rounded-lg bg-slate-950/60 border border-emerald-500/20 hover:border-emerald-500/60 text-right transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200">
                    تعديل أرصدة الصناديق
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">تعديل مباشر مع تسجيل السبب</p>
                </div>
                <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
              </button>

              <button
                onClick={() => setActiveTab('pricing')}
                className="p-3 rounded-lg bg-slate-950/60 border border-cyan-500/20 hover:border-cyan-500/60 text-right transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
                    نسبة الوقود للشاحنات
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">تعديل نسبة رسوم المحروقات</p>
                </div>
                <DollarSign className="w-4 h-4 text-cyan-400 shrink-0" />
              </button>

              <button
                id="btn_admin_fixed_assets_card"
                onClick={() => setActiveModule('fixed_assets')}
                className="p-3 rounded-lg bg-slate-950/60 border border-violet-500/20 hover:border-violet-500/60 text-right transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-xs font-bold text-violet-300 group-hover:text-violet-200">
                    أصول الشركة والنفقات
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">تجهيزات الفروع ومصاريف الصيانة</p>
                </div>
                <Monitor className="w-4 h-4 text-violet-400 shrink-0" />
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className="p-3 rounded-lg bg-slate-950/60 border border-purple-500/20 hover:border-purple-500/60 text-right transition-all flex items-center justify-between group"
              >
                <div>
                  <h4 className="text-xs font-bold text-purple-300 group-hover:text-purple-200">
                    إعادة تعيين كلمات المرور
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">تغيير كلمة المرور أو فك التجميد</p>
                </div>
                <KeyRound className="w-4 h-4 text-purple-400 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DIRECT VAULT BALANCE CONTROL */}
      {/* ========================================================================= */}
      {activeTab === 'vaults' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                <span>التحكم المالي المباشر والتعديل السيادي للخزائن</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                بصفتك المدير العام، يمكنك تعديل وتصفير وزيادة رصيد أي صندوق فرعي بشكل مباشر دون الحاجة لقيود مقاصة وسيطة، مع التوثيق التلقائي في سجل الرقابة.
              </p>
            </div>
          </div>

          {/* 14 Branches Cash Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">كود الفرع</th>
                    <th className="py-3 px-4">اسم المركز / المحافظة</th>
                    <th className="py-3 px-4">النوع</th>
                    <th className="py-3 px-4 text-emerald-400">الرصيد الفعلي (ل.س)</th>
                    <th className="py-3 px-4 text-cyan-400">الرصيد الفعلي ($)</th>
                    <th className="py-3 px-4 text-center">إجراء المدير العام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {branches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">{b.code}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{b.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{b.governorate}</span>
                          {b.phone && <span className="text-slate-500">| {b.phone}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.isCentralHub
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50'
                          }`}
                        >
                          {b.isCentralHub ? 'رئيسي' : 'فرعي'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                        <button
                          type="button"
                          onClick={() => setBreakdownBranch(b)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono font-bold"
                          title={`اضغط لتفصيل المبالغ حسب كل صندوق ضمن فرع ${b.name}`}
                        >
                          <span>{formatCurrency(getCashboxBreakdown(b.id).totalBranchSyp || 0, 'SYP')}</span>
                          <Eye className="w-3 h-3 text-emerald-400/80 shrink-0" />
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400 text-sm">
                        <button
                          type="button"
                          onClick={() => setBreakdownBranch(b)}
                          className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition flex items-center gap-1.5 cursor-pointer text-xs font-mono font-bold"
                          title={`اضغط لتفصيل المبالغ حسب كل صندوق ضمن فرع ${b.name}`}
                        >
                          <span>{formatCurrency(getCashboxBreakdown(b.id).totalBranchUsd || 0, 'USD')}</span>
                          <Eye className="w-3 h-3 text-cyan-300/80 shrink-0" />
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setBreakdownBranch(b)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                            title={`تفصيل المبالغ حسب كل صندوق ضمن فرع ${b.name}`}
                          >
                            <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>تفصيل الصناديق</span>
                          </button>

                          <button
                            id={`btn_override_vault_${b.id}`}
                            onClick={() => openVaultOverride(b)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل الرصيد المباشر</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CURRENCIES, EXCHANGE RATES & PRICING MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          {/* Active Pricing Policy Control */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                  <span>تحديد وتفعيل سياسة التسعير المركزية للنظام</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  السياسة المحددة هنا هي التي ستظهر حصراً في واجهة تسجيل الطرود لكافة الموظفين والفروع
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>السياسة المعتمدة: تسعير يدوي مخصص للشحنات</span>
              </span>
            </div>

            <div className="space-y-4">
              {/* Single Approved Policy: Manual Pricing */}
              <div className="p-4 rounded-xl border bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      ✍️
                    </div>
                    <span className="font-bold text-white text-sm">سياسة التسعير اليدوية (المعتمدة والوحيدة)</span>
                  </div>
                  <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> مفعلة رسمياً للنظام
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  يقوم الموظف بكتابة أجور الشحن يدوياً بعد تحديد نوع الشحنة وتحديد وزن ومواصفات الشحنة بحقل الملاحظة المخصص. تم حذف سياسة التسعير الآلي لعدم الحاجة إليها حالياً، وضمان مرونة التسعير حسب الاتفاق.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-emerald-400 font-semibold bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-900">
                  <span>✓ يظهر في واجهة التسجيل حقل الأجور اليدوي المباشر مع فئة الشحن وحقل ملاحظة الوزن</span>
                </div>
              </div>
            </div>

            {/* Default Shipping Category Preference */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-300">
                الفئة الافتراضية للشحنات في الواجهة:
              </span>
              <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => updateBrandingSettings({ defaultShippingCategory: 'postal' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    (brandingSettings.defaultShippingCategory || 'postal') === 'postal'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>✉️</span>
                  <span>بريدي (مستندات ورسائل)</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateBrandingSettings({ defaultShippingCategory: 'cargo' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    brandingSettings.defaultShippingCategory === 'cargo'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>📦</span>
                  <span>شحن (بضائع وطرود)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Package Types Management (When Manual Pricing is Active) */}
          {brandingSettings.activePricingPolicy === 'manual_pricing' && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-white">
                        قائمة أنواع الطرود المعتمدة في إدخال البيانات
                      </h4>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {activePackageTypes.length} أنواع معتمدة
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      هذه القائمة هي التي تظهر لموظف الإدخال عند تسجيل الطرود والشحنات في كافة الفروع
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddTypeInput(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة نوع جديد</span>
                </button>
              </div>

              {/* Alert message if any */}
              {packageTypeActionMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{packageTypeActionMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPackageTypeActionMsg(null)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Add form */}
              {showAddTypeInput && (
                <form
                  onSubmit={handleAddPackageTypeAdmin}
                  className="p-4 rounded-xl bg-slate-950 border border-emerald-500/60 flex flex-col sm:flex-row items-center gap-3 animate-in fade-in"
                >
                  <div className="relative flex-1 w-full">
                    <input
                      type="text"
                      value={newPackageTypeName}
                      onChange={(e) => setNewPackageTypeName(e.target.value)}
                      placeholder="أدخل اسم نوع الطرد الجديد (مثال: مواد غذائية، أدوية ومستلزمات طبية، زجاج ومرايا...)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:border-emerald-400 focus:outline-none placeholder-slate-500"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="submit"
                      disabled={!newPackageTypeName.trim()}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة للقائمة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddTypeInput(false);
                        setNewPackageTypeName('');
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}

              {/* Package Types Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {activePackageTypes.map((type, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-950 transition group shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                      <span className="text-xs font-bold text-slate-200 truncate">{type}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePackageTypeAdmin(type)}
                      title={`حذف نوع الطرد [${type}]`}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/30 transition opacity-60 group-hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>يتم حفظ وتطبيق التعديل فوراً على شاشة تسجيل الطرود لدى كافة فروع المحافظات الـ 14.</span>
                </span>
                <button
                  type="button"
                  onClick={handleResetPackageTypesAdmin}
                  className="text-cyan-400 hover:text-cyan-300 font-medium underline cursor-pointer self-end sm:self-auto"
                >
                  استعادة الأنواع الافتراضية (8)
                </button>
              </div>
            </div>
          )}

          {/* Fuel Surcharge Form */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Percent className="w-5 h-5 text-cyan-400" />
              <span>إدارة نسبة رسوم الوقود المركزية</span>
            </h3>

            <form onSubmit={handleSaveCurrencySettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  نسبة رسوم الوقود والمحروقات الإضافية (%)
                </label>
                <input
                  id="input_fuel_surcharge"
                  type="number"
                  step="any"
                  value={tempFuelSurcharge === 0 ? '' : tempFuelSurcharge}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={blockNonAmountKeys}
                  onChange={(e) => {
                    const clean = sanitizeDecimal(e.target.value);
                    setTempFuelSurcharge(clean === '' ? 0 : Number(clean));
                  }}
                  placeholder="أدخل النسبة %"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm focus:border-cyan-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">تُضاف تلقائياً على تكلفة الشحن الأساسية للشاحنات</span>
              </div>

              <div className="flex items-end">
                <button
                  id="btn_save_currency_settings"
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>تثبيت نسبة الوقود</span>
                </button>
              </div>
            </form>

            {exchangeRateSaved && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم تحديث نسبة الوقود في كافة أرجاء المنظومة بنجاح!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CUSTOMER DIRECTORY (دليل العملاء والحسابات) */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && <CustomerDirectoryView />}

      {/* ========================================================================= */}
      {/* TAB: VEHICLES DIRECTORY (دليل الأسطول والمركبات) */}
      {/* ========================================================================= */}
      {activeTab === 'vehicles' && <VehicleDirectoryView />}

      {/* ========================================================================= */}
      {/* TAB: EMPLOYEES & PAYROLL DIRECTORY (دليل الموظفين والرواتب) */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && <EmployeePayrollView />}

      {/* ========================================================================= */}
      {/* TAB: EXPENSES DIRECTORY (دليل المصاريف التشغيلية) */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && <ExpensesDirectoryView />}

      {/* ========================================================================= */}
      {/* TAB 4: 14 BRANCHES MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                <span>إدارة الفروع والمراكز اللوجستية الـ 14</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تعديل بيانات الفروع، أرقام الهواتف، ربط الفروع الفرعية بالمراكز الإقليمية، وتعديل الحالة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b) => (
              <div
                key={b.id}
                className={`p-5 rounded-2xl border transition-all ${
                  b.isCentralHub
                    ? 'bg-slate-900/90 border-amber-500/40 shadow-lg'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                    {b.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.isCentralHub
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50'
                    }`}
                  >
                    {b.isCentralHub ? 'رئيسي' : 'فرعي'}
                  </span>
                </div>

                <h4 className="text-base font-bold text-white mb-1">{b.name}</h4>
                <p className="text-xs text-slate-400 flex items-center gap-1 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>محافظة {b.governorate}</span>
                  {b.address && <span> - {b.address}</span>}
                </p>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 mb-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">رصيد الخزينة (ل.س):</span>
                    <button
                      type="button"
                      onClick={() => setBreakdownBranch(b)}
                      className="text-emerald-400 font-mono font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      title="اضغط لتفصيل صناديق الفرع"
                    >
                      <span>{formatCurrency(getCashboxBreakdown(b.id).totalBranchSyp || 0, 'SYP')}</span>
                      <Eye className="w-3 h-3 text-emerald-400/80" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">رصيد الخزينة ($):</span>
                    <button
                      type="button"
                      onClick={() => setBreakdownBranch(b)}
                      className="text-cyan-400 font-mono font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      title="اضغط لتفصيل صناديق الفرع"
                    >
                      <span>{formatCurrency(getCashboxBreakdown(b.id).totalBranchUsd || 0, 'USD')}</span>
                      <Eye className="w-3 h-3 text-cyan-400/80" />
                    </button>
                  </div>
                  {b.phone && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                      <span className="text-slate-500">هاتف الفرع:</span>
                      <span className="text-slate-300 font-mono">{b.phone}</span>
                    </div>
                  )}
                </div>

                <div className="w-full py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300 text-xs font-bold flex items-center justify-between">
                  <span className="text-slate-400">حالة الفرع:</span>
                  <span className="text-cyan-400 font-mono">
                    {currentBranch?.id === b.id ? 'الفرع النشط بالجلسة' : 'فرع مسجل'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: USERS & ABSOLUTE PERMISSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span>إدارة المستخدمين والصلاحيات والكلمات السرية المطلقة ({users.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تعديل الصلاحيات الدقيقة لكل موظف، إعادة تعيين كلمة المرور، تغيير الفرع المخصص، وتجميد الحسابات.
              </p>
            </div>

            <button
              id="btn_add_new_user"
              onClick={() => {
                setSelectedUserForEdit(null);
                setIsUserModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة موظف / مستخدم جديد</span>
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">الموظف</th>
                    <th className="py-3 px-4">اسم الدخول</th>
                    <th className="py-3 px-4">الدور الوظيفي</th>
                    <th className="py-3 px-4">الفرع المخصص</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-center">إجراءات المدير العام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => {
                    const uBranch = branches.find((b) => b.id === u.branchId);

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm">{u.name}</div>
                          {u.phone && <div className="text-[11px] text-slate-400">{u.phone}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-cyan-400 font-bold">{u.username}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.role === 'super_admin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-200 font-medium">
                            {u.role === 'super_admin' ? (
                              <span className="text-amber-300 font-bold">مدير تطبيق عام (غير مرتبط بفرع)</span>
                            ) : (
                              uBranch?.name || 'غير محدد'
                            )}
                          </div>
                          {u.role !== 'super_admin' && uBranch?.code && (
                            <span className="text-[10px] text-slate-500 font-mono">{uBranch.code}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.isActive
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {u.isActive ? 'نشط' : 'مجمد'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit Permissions Modal */}
                            <button
                              id={`btn_edit_user_perms_${u.id}`}
                              onClick={() => {
                                setSelectedUserForEdit(u);
                                setIsUserModalOpen(true);
                              }}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="تعديل الصلاحيات الدقيقة"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Reset Password */}
                            <button
                              id={`btn_reset_pass_${u.id}`}
                              onClick={() => {
                                setPasswordModalUser(u);
                                setNewPasswordValue('');
                                setPasswordChangeSuccess(null);
                              }}
                              className="p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 transition-colors"
                              title="تغيير كلمة المرور"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Switch to User */}
                            <button
                              id={`btn_switch_to_user_${u.id}`}
                              onClick={() => switchUserDirectly(u.id)}
                              className="p-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 transition-colors"
                              title="الدخول بصلاحيات هذا المستخدم"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>

                            {/* Toggle Active / Freeze */}
                            {u.role !== 'super_admin' && (
                              <button
                                id={`btn_toggle_freeze_${u.id}`}
                                onClick={() => toggleUserStatus(u.id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  u.isActive
                                    ? 'bg-rose-500/15 hover:bg-rose-500/30 text-rose-400'
                                    : 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400'
                                }`}
                                title={u.isActive ? 'تجميد الحساب' : 'تفعيل الحساب'}
                              >
                                {u.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: BRANDING, PATTERNS & LEGAL NOTICES */}
      {/* ========================================================================= */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-pink-400" />
              <span>تخصيص الهوية الرسمية، الترويسة، النصوص القانونية والأنماط</span>
            </h3>

            <form onSubmit={handleSaveBranding} className="space-y-6">
              {/* ========================================================================= */}
              {/* LOGO SELECTION & BRANDING MANAGEMENT (SINGLE PREVIEW & VERIFIED UPLOAD) */}
              {/* ========================================================================= */}
              <div 
                className={`p-5 rounded-2xl bg-slate-950/80 border transition-all space-y-4 ${
                  isLogoDragging 
                    ? 'border-cyan-500 bg-cyan-950/30 ring-2 ring-cyan-500/50 scale-[1.005]' 
                    : 'border-slate-800'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsLogoDragging(true);
                }}
                onDragLeave={() => setIsLogoDragging(false)}
                onDrop={handleLogoDrop}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <ImageIcon className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-white">شعار وهوية الشركة المركزي</h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                          تثبيت وحفظ لكافة الفروع
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        قم برفع صورة الشعار المعتمد ليتم حفظها وتعميمها تلقائياً على كل فروع ومستودعات المنظومة
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAndBroadcastLogo}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm transition cursor-pointer self-start sm:self-auto"
                    title="حفظ وتثبيت الشعار سحابياً وتعميمه على جميع الفروع فوراً"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تثبيت وتعميم الشعار لجميع الفروع</span>
                  </button>
                </div>

                {/* Upload Verification & Processing Feedback */}
                {isLogoProcessing && (
                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center gap-2.5 text-xs text-cyan-300">
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-cyan-400" />
                    <span>جاري معالجة وقراءة ملف الصورة والتحقق من سلامتها...</span>
                  </div>
                )}

                {uploadVerificationInfo && !isLogoProcessing && (
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    uploadVerificationInfo.status === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {uploadVerificationInfo.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <p className="font-bold">{uploadVerificationInfo.message}</p>
                        {uploadVerificationInfo.status === 'success' && (
                          <p className="text-[11px] text-emerald-300/80 mt-0.5">
                            الملف: <span className="font-mono font-bold text-white">{uploadVerificationInfo.fileName}</span> | الحجم: <span className="font-mono">{uploadVerificationInfo.fileSize}</span> {uploadVerificationInfo.dimensions ? `| الأبعاد: ${uploadVerificationInfo.dimensions}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3 Dedicated Media & Identity Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                  {/* Card 1: Digital App Logo & Icon */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          <span className="text-xs font-bold text-slate-200">أيقونة وشعار التطبيق</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400">
                          {brandingForm.logoUrl && brandingForm.logoUrl !== '/orca_express_logo.jpg' ? 'مخصص' : 'معتمد'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3">
                        يظهر في واجهة التطبيق، الشريط العلوي، ونوافذ النظام الرقمية.
                      </p>
                      {/* Preview Box */}
                      <div className="w-full h-32 flex items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 mb-3 relative group">
                        <OrcaLogo
                          customLogoUrl={brandingForm.logoUrl}
                          purpose="app"
                          size="custom"
                          className="max-w-full max-h-full object-contain"
                          showText={false}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="w-full py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>تغيير أيقونة التطبيق</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAppLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleResetAppLogo}
                        className="w-full py-1 text-[11px] text-slate-500 hover:text-slate-300 transition text-center"
                      >
                        استعادة الشعار الافتراضي
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Official Printables Logo (High-contrast for A4 & Thermal Paper) */}
                  <div className="p-4 rounded-2xl bg-slate-900 border-2 border-amber-500/40 flex flex-col justify-between space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 bg-amber-500 text-slate-950 font-black text-[9px] px-2.5 py-0.5 rounded-br-lg uppercase tracking-wider">
                      رسمي للمطبوعات
                    </div>
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          <span className="text-xs font-bold text-slate-200">شعار المطبوعات والورقيات</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                          معتمد للورق
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3">
                        معتمد لكافة الفواتير، بوالص الشحن، المنافيست، والإيصالات الحرارية بدقة تباين فائقة.
                      </p>
                      {/* Realistic Paper Preview Box (Simulating white document paper) */}
                      <div className="w-full h-32 flex items-center justify-center p-3 rounded-xl bg-white border-2 border-slate-400 shadow-inner mb-3">
                        <OrcaLogo
                          customLogoUrl={brandingForm.printLogoUrl || '/orca_print_bw.png'}
                          purpose="print"
                          monochrome={true}
                          size="custom"
                          className="max-w-full max-h-full object-contain"
                          showText={false}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 hover:border-amber-500/60 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>تغيير شعار المطبوعات</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePrintLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleResetPrintLogo}
                        className="w-full py-1 text-[11px] text-amber-400/70 hover:text-amber-300 transition text-center font-medium"
                      >
                        استعادة الشعار الرسمي المعتمد للمطبوعات
                      </button>
                    </div>
                  </div>

                  {/* Card 3: App Desktop & Background Wallpaper */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                          <span className="text-xs font-bold text-slate-200">خلفية سطح المكتب والتطبيق</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400">
                          {brandingForm.appBackgroundUrl ? 'مفعلة' : 'افتراضية'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3">
                        صورة خلفية مخصصة تزين مساحة العمل وسطح المكتب لكافة فروع النظام.
                      </p>
                      {/* Background Preview Box */}
                      <div
                        className="w-full h-32 flex items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 mb-3 relative overflow-hidden bg-cover bg-center"
                        style={brandingForm.appBackgroundUrl ? { backgroundImage: `url(${brandingForm.appBackgroundUrl})` } : {}}
                      >
                        {!brandingForm.appBackgroundUrl ? (
                          <div className="text-center text-slate-500 text-xs">
                            <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-30" />
                            <span>خلفية النظام الافتراضية</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/40 flex items-end p-2">
                            <span className="text-[10px] text-white/90 bg-slate-900/80 px-2 py-0.5 rounded">معاينة الخلفية</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="w-full py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>اختيار صورة خلفية مخصصة</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAppBackgroundUpload}
                          className="hidden"
                        />
                      </label>
                      {brandingForm.appBackgroundUrl ? (
                        <button
                          type="button"
                          onClick={handleClearAppBackground}
                          className="w-full py-1 text-[11px] text-rose-400 hover:text-rose-300 transition text-center"
                        >
                          إزالة الخلفية المخصصة
                        </button>
                      ) : (
                        <div className="py-1 text-[11px] text-slate-600 text-center">
                          لا توجد خلفية إضافية محددة
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم الشركة الرسمي</label>
                  <input
                    id="input_branding_company_name"
                    type="text"
                    value={brandingForm.companyName}
                    onChange={(e) => setBrandingForm({ ...brandingForm, companyName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الشعار النصي الفرعي</label>
                  <input
                    id="input_branding_subtitle"
                    type="text"
                    value={brandingForm.companySubtitle}
                    onChange={(e) => setBrandingForm({ ...brandingForm, companySubtitle: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الهاتف الموحد للإدارة</label>
                  <input
                    id="input_branding_phone"
                    type="text"
                    value={brandingForm.officialPhone}
                    onChange={(e) => setBrandingForm({ ...brandingForm, officialPhone: e.target.value })}
                    placeholder="مثال: 011-2233445"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-emerald-400">
                      رقم خدمة الزبائن (المعتمد في المطبوعات)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">بوالص الشحن والإيصالات</span>
                  </div>
                  <input
                    id="input_branding_customer_service_phone"
                    type="text"
                    value={brandingForm.customerServicePhone ?? ''}
                    onChange={(e) => setBrandingForm({ ...brandingForm, customerServicePhone: e.target.value })}
                    placeholder="مثال: 0991234567"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-white text-sm focus:border-emerald-400 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    الرقم الذي يُطبع على نسخ البوليصة (المرسل، المستلم، الأرشفة) وجميع وصولات القبض.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">الرقم الضريبي / السجل التجاري</label>
                  <input
                    id="input_branding_tax"
                    type="text"
                    value={brandingForm.commercialRegistry}
                    onChange={(e) => setBrandingForm({ ...brandingForm, commercialRegistry: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">عنوان الإدارة المركزية</label>
                  <input
                    id="input_branding_address"
                    type="text"
                    value={brandingForm.headquartersAddress}
                    onChange={(e) => setBrandingForm({ ...brandingForm, headquartersAddress: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    الشروط والأحكام القانونية المطبوعة أسفل إيصال الاستلام والطرود
                  </label>
                  <textarea
                    id="input_branding_receipt_terms"
                    rows={3}
                    value={brandingForm.receiptFooterTerms}
                    onChange={(e) => setBrandingForm({ ...brandingForm, receiptFooterTerms: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs leading-relaxed focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    الترويسة الرسمية المطبوعة على مانافيست الشاحنات وحواجز التفتيش
                  </label>
                  <textarea
                    id="input_branding_manifest_notes"
                    rows={2}
                    value={brandingForm.manifestFooterNotes}
                    onChange={(e) => setBrandingForm({ ...brandingForm, manifestFooterNotes: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs leading-relaxed focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  id="btn_save_branding_settings"
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm shadow-lg shadow-pink-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ وتثبيت أنماط الهوية</span>
                </button>
              </div>

              {brandingSaved && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم حفظ وتحديث إعدادات الهوية والأنماط بنجاح!</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ALERTS, DEADLINES, STAGNANCY & NOTIFICATIONS (SLA ENGINE) */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <BellRing className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>إعدادات المهل والتنبيهات، فترات الركود وإشعارات التسليم (SLA Engine)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                    SLA & Notification Matrix
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                  تحديد فترات التنبيه التلقائي، مهلات ركود الطرود في المستودعات، احتساب رسوم الأرضيات، مهلات تسليم المناديب، تتبع مواعيد الشاحنات بين المحافظات، وتخصيص قوالب الرسائل التلقائية.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <button
                id="btn_trigger_sla_scan"
                type="button"
                onClick={handleTriggerSlaScan}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>فحص وتشخيص SLA فوري</span>
              </button>

              <button
                id="btn_save_alerts_settings_top"
                type="button"
                onClick={handleSaveAlertsSettings}
                className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>

          {/* SLA Diagnostic Scan Toast Notification */}
          {slaScanResult && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold block text-sm text-white">تم تنفيذ فحص المهل والتنبيهات بنجاح!</span>
                  <span className="text-amber-200">
                    تم رصد {slaScanResult.stagnantCount} طرد راكد في المستودعات، و {slaScanResult.delayedTrucksCount} شاحنة متأخرة عن موعد الوصول. تم تحديث الإشعارات المركزية.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSlaScanResult(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-900"
              >
                إغلاق
              </button>
            </div>
          )}

          {/* Live Metric Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Metric 1 */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
              <div>
                <span className="text-[11px] text-slate-400 font-bold block">الطرود الراكدة حالياً</span>
                <div className="text-xl font-black text-amber-400 mt-0.5">
                  {getStagnantParcels().length}{' '}
                  <span className="text-[10px] font-normal text-slate-400">طرد</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Timer className="w-4 h-4" />
              </div>
            </div>

            {/* Metric 2 */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
              <div>
                <span className="text-[11px] text-slate-400 font-bold block">شاحنات متأخرة بالمسير</span>
                <div className="text-xl font-black text-rose-400 mt-0.5">
                  {getDelayedTrucks().filter((t) => t.isOverdue).length}{' '}
                  <span className="text-[10px] font-normal text-slate-400">شاحنة</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Truck className="w-4 h-4" />
              </div>
            </div>

            {/* Metric 3 */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
              <div>
                <span className="text-[11px] text-slate-400 font-bold block">تسليمات مناديب متأخرة</span>
                <div className="text-xl font-black text-emerald-400 mt-0.5">
                  {getOverdueCourierDeliveries().filter((c) => c.isOverdue).length}{' '}
                  <span className="text-[10px] font-normal text-slate-400">طرد</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            {/* Metric 4 */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
              <div>
                <span className="text-[11px] text-slate-400 font-bold block">فروع لم تُقفل الصندوق</span>
                <div className="text-xl font-black text-cyan-400 mt-0.5">
                  {getUnclosedBranchesForSettlement().filter((b) => b.isOverdue).length}{' '}
                  <span className="text-[10px] font-normal text-slate-400">فرع</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Coins className="w-4 h-4" />
              </div>
            </div>

            {/* Metric 5 */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-md">
              <div>
                <span className="text-[11px] text-slate-400 font-bold block">حوالات COD جاهزة</span>
                <div className="text-xl font-black text-purple-400 mt-0.5">
                  {getOverdueCodPayouts().filter((c) => c.isOverdue).length}{' '}
                  <span className="text-[10px] font-normal text-slate-400">حوالة</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Form Settings */}
          <form onSubmit={handleSaveAlertsSettings} className="space-y-6">
            {/* SECTION 1: Warehouse Storage & Stagnancy */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Timer className="w-5 h-5 text-amber-400" />
                  <h4 className="font-black text-base text-white">
                    1. فترات الركود وبقاء الطرود في المستودع (Warehouse Stagnancy & Storage SLA)
                  </h4>
                </div>
                <span className="text-xs text-amber-400 font-mono font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                  إدارة التخزين والأرضيات
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stagnant Days */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    عدد أيام الركود لتصنيف الطرد كراكد (يوم)
                  </label>
                  <input
                    id="input_stagnant_parcel_days"
                    type="number"
                    value={alertsForm.stagnantParcelDays === 0 ? '' : alertsForm.stagnantParcelDays}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        stagnantParcelDays: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    المدة التي بعدها يُعتبر الطرد بحاجة لتنبيه ومتابعة فورية
                  </p>
                </div>

                {/* Storage Grace Days */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    مهلة التخزين المجاني القصوى (أيام)
                  </label>
                  <input
                    id="input_max_storage_grace_days"
                    type="number"
                    value={alertsForm.maxStorageGraceDays === 0 ? '' : alertsForm.maxStorageGraceDays}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        maxStorageGraceDays: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    فترة السماح المجانية قبل احتساب غرامة أرضيات يومية
                  </p>
                </div>

                {/* Daily Storage Fee SYP */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    غرامة أرضيات اليوم الواحد (ل.س)
                  </label>
                  <input
                    id="input_daily_storage_fee_syp"
                    type="number"
                    step="any"
                    value={alertsForm.dailyStorageFeeSyp === 0 ? '' : alertsForm.dailyStorageFeeSyp}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonAmountKeys}
                    onChange={(e) => {
                      const clean = sanitizeDecimal(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        dailyStorageFeeSyp: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    تُحتسب تلقائياً عن كل يوم إضافي بعد انقضاء المهلة المجانية
                  </p>
                </div>

                {/* Daily Storage Fee USD */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    غرامة أرضيات اليوم الواحد ($)
                  </label>
                  <input
                    id="input_daily_storage_fee_usd"
                    type="number"
                    step="any"
                    value={alertsForm.dailyStorageFeeUsd === 0 ? '' : alertsForm.dailyStorageFeeUsd}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonAmountKeys}
                    onChange={(e) => {
                      const clean = sanitizeDecimal(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        dailyStorageFeeUsd: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    للشحنات والطرود المحسوبة بالعملة الأجنبية
                  </p>
                </div>
              </div>

              {/* Auto Alert Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-white block">
                    تفعيل التنبيه التلقائي لأمين المستودع ومدير الفرع عند ركود أي طرد
                  </span>
                  <span className="text-[11px] text-slate-400">
                    إرسال إشعار في شريط الإشعارات العلوي فور بلوغ الطرد مدة الركود المحددة
                  </span>
                </div>
                <input
                  id="toggle_auto_alert_stagnant"
                  type="checkbox"
                  checked={alertsForm.autoAlertOnStagnant}
                  onChange={(e) =>
                    setAlertsForm((prev) => ({
                      ...prev,
                      autoAlertOnStagnant: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* SECTION 2: Courier Delivery Deadlines & Triggers */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-black text-base text-white">
                    2. مهلات التوصيل مع المناديب وإشعارات التسليم (Courier Delivery SLA & Notification Triggers)
                  </h4>
                </div>
                <span className="text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  مهلات التوصيل الفردي
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Courier Delivery Deadline Hours */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    المهلة القصوى للمندوب لتسليم الطرد (ساعات)
                  </label>
                  <input
                    id="input_courier_deadline_hours"
                    type="number"
                    value={alertsForm.courierDeliveryDeadlineHours === 0 ? '' : alertsForm.courierDeliveryDeadlineHours}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        courierDeliveryDeadlineHours: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    المهلة القصوى منذ استلام المندوب للمانافيست حتى تسليمه للعميل
                  </p>
                </div>

                {/* Courier Warning Alert Minutes */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    تنبيه قبل انتهاء مهلة المندوب (دقائق)
                  </label>
                  <input
                    id="input_courier_warning_minutes"
                    type="number"
                    value={alertsForm.courierOverdueAlertMinutes === 0 ? '' : alertsForm.courierOverdueAlertMinutes}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        courierOverdueAlertMinutes: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    إطلاق تنبيه استباقي للمشرف قبل نفاد مهلة التسليم
                  </p>
                </div>

                {/* Pickup Reminder Interval Hours */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    تكرار تذكير المستلم بالاستلام (كل X ساعة)
                  </label>
                  <input
                    id="input_reminder_interval_hours"
                    type="number"
                    value={alertsForm.receiverPickupReminderIntervalHours === 0 ? '' : alertsForm.receiverPickupReminderIntervalHours}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        receiverPickupReminderIntervalHours: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    الفترة الفاصلة بين رسائل التذكير بالاستلام من الفرع
                  </p>
                </div>

                {/* Max Reminder Count */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    الحد الأقصى لمرات التذكير (مرات)
                  </label>
                  <input
                    id="input_max_reminder_count"
                    type="number"
                    value={alertsForm.maxReminderCount === 0 ? '' : alertsForm.maxReminderCount}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        maxReminderCount: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-purple-400 font-mono font-bold text-sm focus:border-purple-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    الحد الأقصى لعدد رسائل الـ SMS المرسلة للعميل
                  </p>
                </div>
              </div>

              {/* Notification Trigger Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">إشعار المستلم فور وصول الطرد لفرع الوجهة</span>
                  <input
                    id="toggle_notify_arrival"
                    type="checkbox"
                    checked={alertsForm.notifyReceiverOnArrival}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        notifyReceiverOnArrival: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 accent-emerald-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">إشعار المستلم عند خروج الطرد مع المندوب</span>
                  <input
                    id="toggle_notify_courier_out"
                    type="checkbox"
                    checked={alertsForm.notifyReceiverOnCourierOut}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        notifyReceiverOnCourierOut: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 accent-emerald-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-200">إشعار المرسل فور تسليم الطرد وقبض المبلغ</span>
                  <input
                    id="toggle_notify_delivered"
                    type="checkbox"
                    checked={alertsForm.notifySenderOnDelivered}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        notifySenderOnDelivered: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 accent-emerald-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* SECTION 3: Intercity Transit Deadlines & Truck Tracking */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Truck className="w-5 h-5 text-cyan-400" />
                  <h4 className="font-black text-base text-white">
                    3. مهلات النقل البري وتتبع تأخر الشاحنات بين المحافظات (Intercity Transit Deadlines)
                  </h4>
                </div>
                <span className="text-xs text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                  شحن المحافظات
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Intercity Transit Deadline Hours */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    المهلة المتوقعة لرحلة الشاحنة بين المحافظات (ساعات)
                  </label>
                  <input
                    id="input_intercity_deadline_hours"
                    type="number"
                    value={alertsForm.intercityTransitDeadlineHours === 0 ? '' : alertsForm.intercityTransitDeadlineHours}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        intercityTransitDeadlineHours: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    المدة المعتمدة لوصول الشاحنة وتفريغها في فرع المقصد (افتراضي: 14 ساعة)
                  </p>
                </div>

                {/* Truck Delay Alert Threshold Hours */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    مهلة التأخر لإطلاق إنذار طوارئ بالرحلة (ساعات)
                  </label>
                  <input
                    id="input_truck_delay_threshold_hours"
                    type="number"
                    value={alertsForm.truckDelayAlertThresholdHours === 0 ? '' : alertsForm.truckDelayAlertThresholdHours}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        truckDelayAlertThresholdHours: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-rose-400 font-mono font-bold text-sm focus:border-rose-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    ساعات التأخر الإضافية التي تستدعي تنبيه غرفة العمليات والإدارة المركزية
                  </p>
                </div>

                {/* Live Monitoring Auto Alert */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-white block">
                      مراقبة حية وتنبيه الفروع بالرحلات المغادرة
                    </span>
                    <span className="text-[10px] text-slate-400">
                      إرسال إشعار فوري لمستودع المقصد فور انطلاق الشاحنة من المنشأ
                    </span>
                  </div>
                  <input
                    id="toggle_alert_dispatched_trucks"
                    type="checkbox"
                    checked={alertsForm.autoAlertDispatchedTrucks}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        autoAlertDispatchedTrucks: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded text-cyan-500 focus:ring-cyan-400 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: Financial Remittance & Daily Cashbox Remittance Deadlines */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <h4 className="font-black text-base text-white">
                    4. مهلات الحوالات المالية وإقفال الصناديق اليومية (Financial Remittance & Cashbox Deadlines)
                  </h4>
                </div>
                <span className="text-xs text-amber-400 font-mono font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                  الانضباط المالي والمقاصة
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* COD Payout Grace Hours */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    مهلة إتاحة الحوالة COD للقبض للمرسل (ساعات)
                  </label>
                  <input
                    id="input_cod_payout_grace_hours"
                    type="number"
                    value={alertsForm.codPayoutGraceHours === 0 ? '' : alertsForm.codPayoutGraceHours}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        codPayoutGraceHours: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    المدة القصوى لتحويل المبلغ لحساب المرسل بعد استلام المستلم
                  </p>
                </div>

                {/* Daily Settlement Deadline Hour */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    ساعة إقفال وتوريد كشف الصندوق اليومي (0 - 23)
                  </label>
                  <input
                    id="input_daily_settlement_hour"
                    type="number"
                    value={alertsForm.dailySettlementDeadlineHour === 0 ? '' : alertsForm.dailySettlementDeadlineHour}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setAlertsForm((prev) => ({
                        ...prev,
                        dailySettlementDeadlineHour: clean === '' ? 0 : Number(clean),
                      }));
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    مثال: 20 تعني الساعة 8:00 مساءً بتوقيت دمشق
                  </p>
                </div>

                {/* Alert Super Admin On Delayed Settlement */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-white block">
                      تنبيه الإدارة العامة بتأخر إقفال الفروع
                    </span>
                    <span className="text-[10px] text-slate-400">
                      إرسال إنذار فوري في حال تخلف أي فرع عن إرسال كشف الصندوق اليومي
                    </span>
                  </div>
                  <input
                    id="toggle_alert_delayed_settlement"
                    type="checkbox"
                    checked={alertsForm.alertSuperAdminOnDelayedSettlement}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        alertSuperAdminOnDelayedSettlement: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Global Negative Disbursement Control */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-white block">
                      السماح بالصرف بالسالب وتجاوز رصيد الصندوق (عام)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      تمكين دفع سندات الصرف والمصاريف وحوالات COD حتى لو كان رصيد الصندوق غير كافٍ (افتراضياً: منع الصرف بالسالب)
                    </span>
                  </div>
                  <input
                    id="toggle_allow_negative_disbursement_globally"
                    type="checkbox"
                    checked={Boolean(alertsForm.allowNegativeDisbursementGlobally)}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        allowNegativeDisbursementGlobally: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-400 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Smart Notification Deduplication */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-white block">
                      منع تكرار التنبيهات لنفس السبب والكيان (Deduplication)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      محرك ذكي يمنع ظهور نفس التنبيه أو الإشعار مرتين لنفس الطرد أو المانافيست أو السند المالي
                    </span>
                  </div>
                  <input
                    id="toggle_prevent_duplicate_alerts"
                    type="checkbox"
                    checked={alertsForm.preventDuplicateAlerts !== false}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        preventDuplicateAlerts: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded text-cyan-500 focus:ring-cyan-400 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: SMS & Notification Message Templates */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  <h4 className="font-black text-base text-white">
                    5. قوالب الرسائل النصية والإشعارات التلقائية (SMS & System Notification Templates)
                  </h4>
                </div>
                <span className="text-xs text-purple-400 font-mono font-bold bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                  تخصيص نصوص الإشعارات
                </span>
              </div>

              {/* Dynamic Variables Guide */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-300 block">
                  الرموز والمتغيرات الذكية المتاحة للاستخدام داخل النصوص:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { code: '{TRACKING_NO}', label: 'رقم التتبع' },
                    { code: '{RECEIVER_NAME}', label: 'اسم المستلم' },
                    { code: '{ORIGIN_CITY}', label: 'مدينة الإرسال' },
                    { code: '{DEST_CITY}', label: 'مدينة الوجهة' },
                    { code: '{AMOUNT}', label: 'المبلغ المطلوب' },
                    { code: '{CURRENCY}', label: 'العملة' },
                    { code: '{COURIER_PHONE}', label: 'هاتف المندوب' },
                    { code: '{DAYS}', label: 'عدد الأيام' },
                  ].map((v) => (
                    <span
                      key={v.code}
                      className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/60 text-purple-200 text-[11px] font-mono flex items-center gap-1.5"
                    >
                      <span className="font-bold text-purple-400">{v.code}</span>
                      <span className="text-slate-400 text-[10px]">({v.label})</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Template 1: Intake Sender SMS */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    رسالة استلام الشحنة في فرع المنشأ (تُرسل للمرسل)
                  </label>
                  <textarea
                    id="input_template_intake_sender"
                    rows={3}
                    value={alertsForm.templates.onIntakeSenderSms}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        templates: { ...prev.templates, onIntakeSenderSms: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Template 2: Arrival Receiver SMS */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    رسالة وصول الطرد لفرع الوجهة (تُرسل للمستلم للاستلام)
                  </label>
                  <textarea
                    id="input_template_arrival_receiver"
                    rows={3}
                    value={alertsForm.templates.onArrivalReceiverSms}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        templates: { ...prev.templates, onArrivalReceiverSms: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Template 3: Courier Out Receiver SMS */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    رسالة خروج الطرد مع المندوب للتوصيل المنزلي (تُرسل للمستلم)
                  </label>
                  <textarea
                    id="input_template_courier_out"
                    rows={3}
                    value={alertsForm.templates.onCourierOutReceiverSms}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        templates: { ...prev.templates, onCourierOutReceiverSms: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Template 4: Delivered Sender SMS */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    رسالة إتمام التسليم وقبض المبلغ بنجاح (تُرسل للمرسل)
                  </label>
                  <textarea
                    id="input_template_delivered_sender"
                    rows={3}
                    value={alertsForm.templates.onDeliveredSenderSms}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        templates: { ...prev.templates, onDeliveredSenderSms: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Template 5: Stagnant Reminder SMS */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    رسالة تذكير بالاستلام للطرود الراكدة في المستودع (تُرسل للمستلم)
                  </label>
                  <textarea
                    id="input_template_stagnant_reminder"
                    rows={3}
                    value={alertsForm.templates.onStagnantReminderSms}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        templates: { ...prev.templates, onStagnantReminderSms: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Template 6: COD Ready Sender SMS */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    رسالة جهوزية الحوالة المالية COD للقبض (تُرسل للمرسل)
                  </label>
                  <textarea
                    id="input_template_cod_ready"
                    rows={3}
                    value={alertsForm.templates.onCodReadySenderSms}
                    onChange={(e) =>
                      setAlertsForm((prev) => ({
                        ...prev,
                        templates: { ...prev.templates, onCodReadySenderSms: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                يتم تطبيق هذه الإعدادات والمهلات فوراً على مستوى شبكة الـ 14 مركزاً في المحافظات السورية
              </span>
              <button
                id="btn_submit_alerts_settings"
                type="submit"
                className="px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-5 h-5" />
                <span>حفظ وتثبيت كافة إعدادات المهل والتنبيهات</span>
              </button>
            </div>

            {alertsSaved && (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="font-bold">تم حفظ وتحديث إعدادات المهل والتنبيهات والركود (SLA) بنجاح!</span>
              </div>
            )}
          </form>

          {/* ========================================================================= */}
          {/* LIVE SLA MONITORING: STAGNANT PARCELS & DELAYED TRUCKS */}
          {/* ========================================================================= */}
          <div className="space-y-6 pt-4">
            {/* 1. Stagnant Parcels Live Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden space-y-0">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-black text-base text-white">
                      قائمة الرصد الحي: الطرود الراكدة في المستودعات حالياً
                    </h4>
                    <span className="text-xs text-slate-400">
                      الطرود التي تجاوزت مهلة {alertsForm.stagnantParcelDays} أيام دون استلام من العميل
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {getStagnantParcels().length} طرد راكد
                </span>
              </div>

              {getStagnantParcels().length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">
                  ممتاز! لا توجد حالياً أي طرود راكدة تتجاوز مهلة الـ {alertsForm.stagnantParcelDays} أيام.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">رقم التتبع</th>
                        <th className="p-3.5">المرسل / المستلم</th>
                        <th className="p-3.5">المستودع المتواجد فيه</th>
                        <th className="p-3.5">المدة بالمستودع</th>
                        <th className="p-3.5">حالة المهلة والأرضيات</th>
                        <th className="p-3.5 text-center">إجراءات المتابعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {getStagnantParcels().map((item) => {
                        const targetBranch = branches.find((b) => b.id === item.parcel.destinationHubId);
                        const isAlertSent = alertSentParcelId === item.parcel.id;
                        return (
                          <tr key={item.parcel.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-amber-400">
                              {item.parcel.trackingNumber}
                            </td>
                            <td className="p-3.5">
                              <div className="text-white font-bold">{item.parcel.receiver.name}</div>
                              <div className="text-[11px] text-slate-400">
                                من: {item.parcel.sender.name} ({item.parcel.sender.phone})
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="text-slate-200">{targetBranch?.name || 'المركز الرئيسي'}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-bold font-mono">
                                {item.daysInWarehouse} أيام
                              </span>
                            </td>
                            <td className="p-3.5">
                              {item.isOverdue ? (
                                <div className="space-y-0.5">
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-bold">
                                    متجاوز المهلة المجانية ({item.overdueDays} يوم)
                                  </span>
                                  <div className="text-[11px] text-amber-300 font-bold">
                                    رسوم الأرضيات: {formatCurrency(item.accruedStorageFeeSyp || 0, 'SYP')}
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                                  ضمن فترة السماح المجانية
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSendSingleStagnantAlert(item.parcel.id)}
                                  disabled={isAlertSent}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isAlertSent
                                      ? 'bg-emerald-500 text-slate-950 font-black'
                                      : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30'
                                  }`}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>{isAlertSent ? 'تم الإرسال بنجاح' : 'إرسال تذكير فوري'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSelectedParcelForQuickView(item.parcel)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>تفاصيل الطرد</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Delayed Trucks Live Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden space-y-0">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <Truck className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h4 className="font-black text-base text-white">
                      مراقبة رحلات النقل البري بين المحافظات (Transit SLA Monitor)
                    </h4>
                    <span className="text-xs text-slate-400">
                      متابعة الشاحنات المنطلقة ومطابقتها مع مهلة الوصول ({alertsForm.intercityTransitDeadlineHours} ساعة)
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {getDelayedTrucks().length} رحلة نشطة
                </span>
              </div>

              {getDelayedTrucks().length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">
                  لا توجد حالياً أي شاحنات قيد المسير بين المحافظات.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">رقم المانافيست</th>
                        <th className="p-3.5">المسار (من - إلى)</th>
                        <th className="p-3.5">السائق والشاحنة</th>
                        <th className="p-3.5">الوقت المنقضي</th>
                        <th className="p-3.5">حالة المهلة والتأخر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {getDelayedTrucks().map((item) => {
                        const origin = branches.find((b) => b.id === item.truck.originHubId);
                        const dest = branches.find((b) => b.id === item.truck.destinationHubId);
                        return (
                          <tr key={item.truck.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-cyan-400">
                              {item.truck.manifestNumber}
                            </td>
                            <td className="p-3.5 font-bold text-white">
                              {origin?.name} ⬅ {dest?.name}
                            </td>
                            <td className="p-3.5">
                              <div className="text-slate-200">{item.truck.driverName}</div>
                              <div className="text-[11px] text-slate-400">لوحة: {item.truck.truckPlate}</div>
                            </td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-bold font-mono">
                                {item.elapsedHours} ساعة
                              </span>
                            </td>
                            <td className="p-3.5">
                              {item.isOverdue ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                  <AlertOctagon className="w-3.5 h-3.5" />
                                  <span>متأخرة بـ {item.delayHours} ساعة عن المهلة</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>ضمن المهلة المحددة</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Courier Deliveries Live SLA Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden space-y-0">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="font-black text-base text-white">
                      مراقبة تسليمات المناديب والمهل المحددة (Courier Delivery SLA Monitor)
                    </h4>
                    <span className="text-xs text-slate-400">
                      متابعة الطرود الخارجة للتسليم مع المناديب ومطابقتها مع مهلة التسليم ({alertsForm.courierDeliveryDeadlineHours} ساعة)
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {getOverdueCourierDeliveries().length} طرد مع المناديب
                </span>
              </div>

              {getOverdueCourierDeliveries().length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">
                  لا توجد حالياً أي طرود قيد التسليم الميداني مع المناديب.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">رقم التتبع</th>
                        <th className="p-3.5">المستلم والوجهة</th>
                        <th className="p-3.5">اسم المندوب المكلف</th>
                        <th className="p-3.5">الوقت قيد التسليم</th>
                        <th className="p-3.5">حالة المهلة والتأخر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {getOverdueCourierDeliveries().map((item) => (
                        <tr key={item.parcel.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-emerald-400">
                            {item.parcel.trackingNumber}
                          </td>
                          <td className="p-3.5">
                            <div className="text-white font-bold">{item.parcel.receiver.name}</div>
                            <div className="text-[11px] text-slate-400">{item.parcel.receiver.phone}</div>
                          </td>
                          <td className="p-3.5">
                            <span className="text-slate-200 font-bold">{item.courierName}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-bold font-mono">
                              {item.elapsedHours} ساعة
                            </span>
                          </td>
                          <td className="p-3.5">
                            {item.isOverdue ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                <AlertOctagon className="w-3.5 h-3.5" />
                                <span>متأخر بـ {item.delayHours} ساعة</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>ضمن المهلة</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. Branch Settlement Deadline Live SLA Table */}
            <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden space-y-0">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-black text-base text-white">
                      مراقبة إقفال كشوفات الصناديق والالتزام المالي اليومي (Branch Settlement Deadline SLA)
                    </h4>
                    <span className="text-xs text-slate-400">
                      متابعة تقديم كشوفات ترصيد الصناديق بالفروع قبل موعد الإقفال المعتمد ({alertsForm.dailySettlementDeadlineHour}:00)
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {branches.length} فرع نشط
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">الفرع</th>
                      <th className="p-3.5">ساعة الإقفال المعتمدة</th>
                      <th className="p-3.5">آخر إقفال مُسجل</th>
                      <th className="p-3.5">حالة الإقفال اليومي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {getUnclosedBranchesForSettlement().map((item) => (
                      <tr key={item.branch.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-bold text-white">
                          {item.branch.name}
                        </td>
                        <td className="p-3.5 font-mono text-cyan-400 font-bold">
                          {alertsForm.dailySettlementDeadlineHour}:00 بتوقيت دمشق
                        </td>
                        <td className="p-3.5 text-slate-300 font-mono">
                          {item.lastSettlementDate
                            ? new Date(item.lastSettlementDate).toLocaleString('ar-SY')
                            : 'لا يوجد كشف سابق'}
                        </td>
                        <td className="p-3.5">
                          {item.hasSubmittedToday ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تم الإقفال والترصيد بنجاح</span>
                            </span>
                          ) : item.isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              <span>تأخر الإقفال اليومي عن الموعد!</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                              <Clock className="w-3.5 h-3.5" />
                              <span>في انتظار الإقفال اليومي</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: AUDIT LOGS & SYSTEM DATABASE */}
      {/* ========================================================================= */}
      {(activeTab === 'audit' || activeTab === 'database') && (
        <div className="space-y-6">
          {/* Sub Navigation Switcher */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 w-fit">
            <button
              id="subtab_audit_logs"
              onClick={() => {
                setActiveTab('audit');
                setAuditSubView('logs');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                auditSubView === 'logs' && activeTab !== 'database'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل الرقابة والتدقيق الأمني</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/30 text-white font-mono">
                {auditLogs.length}
              </span>
            </button>
            <button
              id="subtab_audit_database"
              onClick={() => {
                setActiveTab('audit');
                setAuditSubView('database');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                auditSubView === 'database' || activeTab === 'database'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>النسخ الاحتياطي وقاعدة البيانات</span>
            </button>
          </div>

          {(auditSubView === 'logs' && activeTab !== 'database') ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-rose-400" />
                <span>سجل الرقابة والتدقيق الأمني الشامل (Security Audit Trail)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                توثيق غير قابل للتلاعب لجميع عمليات الدخول، التعديل المالي للخزائن، تغيير أسعار الصرف، وتبديل الصلاحيات.
              </p>
            </div>

            <button
              id="btn_clear_audit_logs"
              onClick={() => {
                if (window.confirm('هل أنت متأكد من مسح سجل العمليات؟')) {
                  clearAuditLogs();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تفريغ السجل</span>
            </button>
          </div>

          {/* Search and Category Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                id="input_search_audit"
                type="text"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                placeholder="بحث في العمليات أو أسماء المستخدمين أو التفاصيل..."
                className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
              {['all', 'auth', 'cashbox', 'pricing', 'users', 'branding', 'system'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAuditCategoryFilter(cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    auditCategoryFilter === cat
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat === 'all'
                    ? 'الكل'
                    : cat === 'auth'
                    ? 'الأمان والدخول'
                    : cat === 'cashbox'
                    ? 'الخزائن والمالية'
                    : cat === 'pricing'
                    ? 'التسعير والصرف'
                    : cat === 'users'
                    ? 'المستخدمين'
                    : cat === 'branding'
                    ? 'الهوية'
                    : 'النظام'}
                </button>
              ))}
            </div>
          </div>

          {/* Logs List */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-800/70">
              {filteredAuditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">لا توجد سجلات مطابقة للبحث</div>
              ) : (
                filteredAuditLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-800/40 transition-colors flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-white">{log.action}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            log.category === 'cashbox'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : log.category === 'auth'
                              ? 'bg-amber-500/20 text-amber-300'
                              : log.category === 'pricing'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {log.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{log.details}</p>
                    </div>

                    <div className="text-left shrink-0 text-[11px] text-slate-500">
                      <div className="text-slate-300 font-bold">{log.userName}</div>
                      <div>{new Date(log.timestamp).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-400" />
                <span>إدارة قاعدة البيانات والنسخ الاحتياطي والتهيئة</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <h4 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span>تصدير نسخة احتياطية كاملة (JSON Backup)</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تتضمن كافة الطرود، المانافيست، الخزائن، المستخدمين، أسعار الصرف، وقوالب الطباعة.
                  </p>
                  <button
                    id="btn_download_full_backup"
                    onClick={() => {
                      const json = exportDatabaseJson();
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `orca_backup_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                    }}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل النسخة الاحتياطية الآن</span>
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <h4 className="font-bold text-sm text-rose-400 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    <span>إعادة تهيئة النظام الصفرية (Zero-State Clean Reset)</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تفريغ كافة البيانات التشغيلية وتصفير أرصدة الفروع وإعادة ضبط المنظومة للبدء من الصفر مع تفعيل حساب مدير التطبيق (سليمان / 111222000) حصراً.
                  </p>
                  <button
                    id="btn_reset_demo_data"
                    onClick={() => {
                      if (window.confirm('تحذير: هل أنت متأكد من إعادة تهيئة المنظومة بالكامل وتفريغ كافة البيانات للبدء من الصفر؟')) {
                        resetToDemoData();
                        alert('تمت تهيئة المنظومة بنجاح! جميع البيانات فارغة وحساب مدير التطبيق (سليمان) جاهز.');
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>تفريغ وبدء المنظومة من الصفر</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DIRECT VAULT BALANCE OVERRIDE */}
      {/* ========================================================================= */}
      {selectedBranchForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Coins className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">
                  تعديل رصيد الخزينة: {selectedBranchForOverride.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBranchForOverride(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                إلغاء
              </button>
            </div>

            <form onSubmit={handleDirectBalanceOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1">
                  الرصيد الجديد بالليرة السورية (SYP)
                </label>
                <input
                  id="input_override_syp"
                  type="number"
                  step="any"
                  value={overrideSyp === 0 ? '' : overrideSyp}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={blockNonAmountKeys}
                  onChange={(e) => {
                    const clean = sanitizeDecimal(e.target.value);
                    setOverrideSyp(clean === '' ? 0 : Number(clean));
                  }}
                  placeholder="أدخل الرصيد الجديد بالليرة"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold text-base focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-cyan-300 mb-1">
                  الرصيد الجديد بالدولار الأمريكي (USD)
                </label>
                <input
                  id="input_override_usd"
                  type="number"
                  step="any"
                  value={overrideUsd === 0 ? '' : overrideUsd}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={blockNonAmountKeys}
                  onChange={(e) => {
                    const clean = sanitizeDecimal(e.target.value);
                    setOverrideUsd(clean === '' ? 0 : Number(clean));
                  }}
                  placeholder="أدخل الرصيد الجديد بالدولار"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold text-base focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  سبب التعديل المالي (إلزامي للرقابة)
                </label>
                <textarea
                  id="input_override_reason"
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="مثال: تسوية جرد نقدي فعلي من الإدارة العامة، تحويل سيولة طارئة..."
                  required
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {overrideSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{overrideSuccess}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  id="btn_submit_override_vault"
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all"
                >
                  اعتماد وتثبيت الرصيد
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBranchForOverride(null)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: USER PASSWORD RESET MODAL */}
      {/* ========================================================================= */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">
                  تغيير كلمة المرور: {passwordModalUser.name}
                </h3>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                إلغاء
              </button>
            </div>

            <form onSubmit={handleSaveUserPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  كلمة المرور الجديدة
                </label>
                <input
                  id="input_new_user_password"
                  type="text"
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة..."
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              {passwordChangeSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{passwordChangeSuccess}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  id="btn_submit_change_password"
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-all"
                >
                  حفظ كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: GRANULAR USER PERMISSIONS MODAL */}
      {/* ========================================================================= */}
      {isUserModalOpen && (
        <UserEditModal
          user={selectedUserForEdit}
          branches={branches}
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          onSave={(userData) => {
            if (selectedUserForEdit) {
              updateUser(selectedUserForEdit.id, userData);
              addAuditLog('تحديث صلاحيات موظف', 'users', `تم تعديل بيانات وصلاحيات المستخدم: ${userData.name}`);
            } else {
              addUser(userData as Omit<User, 'id'>);
              addAuditLog('إضافة موظف جديد', 'users', `تمت إضافة مستخدم جديد: ${userData.name}`);
            }
            setIsUserModalOpen(false);
          }}
        />
      )}
      {/* Branch Cashbox Breakdown Modal */}
      <BranchCashboxBreakdownModal
        branch={breakdownBranch}
        isOpen={!!breakdownBranch}
        onClose={() => setBreakdownBranch(null)}
      />
    </div>
  );
};
