import React, { useState, useEffect, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  User,
  Branch,
  UserRole,
  UserPermissions,
  Employee,
} from '../types';
import {
  ALL_PERMISSION_CATEGORIES,
  getDefaultPermissionsForRole,
  ROLE_DEFINITIONS,
} from '../utils/permissionEngine';
import {
  blockNonPhoneKeys,
  blockNonIntegerKeys,
  sanitizePhone,
  sanitizeDigitsOnly,
} from '../utils/numberSanitizer';
import {
  X,
  Shield,
  Building,
  User as UserIcon,
  Phone,
  CreditCard,
  Lock,
  Check,
  Eye,
  Plus,
  Edit,
  Trash2,
  Printer,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Link2,
  Unlink,
  Briefcase,
  Search,
  RotateCcw,
  CheckSquare,
  Square,
  FileText,
  PackageCheck,
  Coins,
  Building2,
  Warehouse,
  Truck,
  ShieldCheck,
  Sliders,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: User | null;
  user?: User | null;
  branches: Branch[];
  onSave: (userData: {
    id?: string;
    name: string;
    username: string;
    role: UserRole;
    branchId: string;
    allowedBranchIds: string[];
    canSwitchBranches: boolean;
    phone: string;
    nationalId?: string;
    isActive: boolean;
    permissions: UserPermissions;
    employeeId?: string;
  }) => void;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  isOpen,
  onClose,
  userToEdit,
  user,
  branches,
  onSave,
}) => {
  const activeUser = userToEdit ?? user ?? null;
  const { employees } = useOrca();
  const isEditing = Boolean(activeUser);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [branchId, setBranchId] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [canSwitchBranches, setCanSwitchBranches] = useState(false);
  const [allowedBranchIds, setAllowedBranchIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [permissions, setPermissions] = useState<UserPermissions>(() =>
    getDefaultPermissionsForRole('cashier')
  );

  // UI / Filter States for simple and clear permissions browsing
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [permissionSearch, setPermissionSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled' | 'sensitive'>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeUser) {
      setName(activeUser.name || '');
      setUsername(activeUser.username || '');
      setRole(activeUser.role || 'cashier');
      setBranchId(activeUser.branchId || branches[0]?.id || '');
      setPhone(activeUser.phone || '');
      setNationalId(activeUser.nationalId || '');
      setIsActive(activeUser.isActive ?? true);
      setCanSwitchBranches(activeUser.canSwitchBranches ?? (activeUser.role === 'super_admin'));
      setAllowedBranchIds(
        activeUser.allowedBranchIds || (activeUser.branchId ? [activeUser.branchId] : [branches[0]?.id || ''])
      );
      setEmployeeId(activeUser.employeeId || '');
      setPermissions(activeUser.permissions || getDefaultPermissionsForRole(activeUser.role));
    } else {
      setName('');
      setUsername('');
      setRole('reception_data_entry');
      setBranchId(branches[0]?.id || '');
      setPhone('');
      setNationalId('');
      setIsActive(true);
      setCanSwitchBranches(false);
      setAllowedBranchIds([branches[0]?.id || '']);
      setEmployeeId('');
      setPermissions(getDefaultPermissionsForRole('reception_data_entry'));
    }
  }, [userToEdit, user, branches, isOpen]);

  // When role === 'courier', strictly restrict visible branches to the courier's main hub and its subsidiary branches
  const courierMainHub = useMemo(() => {
    if (role !== 'courier') return null;
    const currentB = branches.find((b) => b.id === branchId) || branches[0];
    if (!currentB) return null;
    if (currentB.type === 'main_hub' || currentB.isMainHub) return currentB;
    if (currentB.parentHubId) {
      const p = branches.find((b) => b.id === currentB.parentHubId);
      if (p) return p;
    }
    const govHub = branches.find((h) => h.governorate === currentB.governorate && (h.type === 'main_hub' || h.isMainHub));
    return govHub || currentB;
  }, [role, branchId, branches]);

  const displayedBranchesForUser = useMemo(() => {
    if (role !== 'courier' || !courierMainHub) return branches;
    return branches.filter((b) => {
      if (b.id === courierMainHub.id) return true;
      if (b.parentHubId && b.parentHubId === courierMainHub.id) return true;
      if (b.governorate === courierMainHub.governorate && b.type !== 'main_hub' && !b.isMainHub) return true;
      return false;
    });
  }, [role, courierMainHub, branches]);

  // Handle employee selection and auto-filling
  const handleSelectEmployee = (selectedEmpId: string) => {
    setEmployeeId(selectedEmpId);
    if (!selectedEmpId) return;

    const emp = employees.find((e) => e.id === selectedEmpId);
    if (emp) {
      setName(emp.fullName);
      if (emp.phone) setPhone(emp.phone);
      if (emp.nationalId) setNationalId(emp.nationalId);
      if (emp.branchId) {
        setBranchId(emp.branchId);
        if (!allowedBranchIds.includes(emp.branchId)) {
          setAllowedBranchIds([...allowedBranchIds, emp.branchId]);
        }
      }
      if (!username) {
        const generatedUser = emp.code.toLowerCase().replace('-', '_') + '_' + (emp.fullName.split(' ')[0] || 'user');
        setUsername(generatedUser);
      }
    }
  };

  const selectedEmployeeObj = employees.find((e) => e.id === employeeId);

  // Handle Role Change & Template Application
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole !== 'custom') {
      const templatePerms = getDefaultPermissionsForRole(newRole);
      setPermissions(templatePerms);
      if (newRole === 'super_admin') {
        setCanSwitchBranches(true);
        setAllowedBranchIds(branches.map((b) => b.id));
      } else {
        setCanSwitchBranches(false);
      }
    }
  };

  // Reset to default permissions of current role
  const handleResetToCurrentRoleDefault = () => {
    const templatePerms = getDefaultPermissionsForRole(role);
    setPermissions(templatePerms);
  };

  // Toggle single action permission
  const handleToggleAction = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      actions: {
        ...prev.actions,
        [key]: !prev.actions[key],
      },
    }));
  };

  // Toggle module access
  const handleToggleModule = (moduleKey: keyof UserPermissions['modules']) => {
    setPermissions((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [moduleKey]: !prev.modules[moduleKey],
      },
    }));
  };

  // Toggle Field Restriction
  const handleToggleFieldRestriction = (
    fieldKey: keyof UserPermissions['fieldRestrictions']
  ) => {
    setPermissions((prev) => ({
      ...prev,
      fieldRestrictions: {
        ...prev.fieldRestrictions,
        [fieldKey]: !prev.fieldRestrictions[fieldKey],
      },
    }));
  };

  // Select/Deselect All in Category
  const handleToggleCategoryAll = (catId: string, selectAll: boolean) => {
    const category = ALL_PERMISSION_CATEGORIES.find((c) => c.id === catId);
    if (!category) return;

    setPermissions((prev) => {
      const updatedActions = { ...prev.actions };
      category.items.forEach((item) => {
        updatedActions[item.key] = selectAll;
      });

      const updatedModules = { ...prev.modules };
      if (catId in updatedModules) {
        (updatedModules as any)[catId] = selectAll;
      }

      return {
        ...prev,
        modules: updatedModules,
        actions: updatedActions,
      };
    });
  };

  // Global Select / Deselect All
  const handleToggleGlobalAll = (selectAll: boolean) => {
    setPermissions((prev) => {
      const updatedActions: Record<string, boolean> = {};
      const updatedModules: Record<string, boolean> = {};

      ALL_PERMISSION_CATEGORIES.forEach((cat) => {
        (updatedModules as any)[cat.id] = selectAll;
        cat.items.forEach((item) => {
          updatedActions[item.key] = selectAll;
        });
      });

      return {
        ...prev,
        modules: updatedModules as any,
        actions: updatedActions,
      };
    });
  };

  // Toggle Branch Allowed
  const handleToggleBranchAllowed = (bId: string) => {
    setAllowedBranchIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    );
  };

  // Toggle Category Collapse
  const toggleCollapse = (catId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) return;

    onSave({
      id: userToEdit?.id,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      role,
      branchId: role === 'super_admin' ? '' : branchId,
      allowedBranchIds: role === 'super_admin' ? [] : (canSwitchBranches ? branches.map((b) => b.id) : allowedBranchIds),
      canSwitchBranches: role === 'super_admin' ? true : canSwitchBranches,
      phone: phone.trim(),
      nationalId: nationalId.trim() || undefined,
      isActive,
      permissions,
      employeeId: employeeId.trim() || undefined,
    });

    onClose();
  };

  // Calculated Stats
  const totalAvailablePermissions = useMemo(() => {
    return ALL_PERMISSION_CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);
  }, []);

  const totalEnabledPermissions = useMemo(() => {
    return Object.values(permissions.actions || {}).filter(Boolean).length;
  }, [permissions.actions]);

  // Action badge renderer
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'view':
        return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 shrink-0"><Eye className="w-2.5 h-2.5" /> استعراض</span>;
      case 'create':
        return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 shrink-0"><Plus className="w-2.5 h-2.5" /> إضافة</span>;
      case 'edit':
        return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 shrink-0"><Edit className="w-2.5 h-2.5" /> تعديل</span>;
      case 'delete':
        return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 shrink-0"><Trash2 className="w-2.5 h-2.5" /> حذف</span>;
      case 'export_print':
        return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 shrink-0"><Printer className="w-2.5 h-2.5" /> طباعة</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0"><Sparkles className="w-2.5 h-2.5" /> إجراء</span>;
    }
  };

  // Filtered categories and items
  const filteredCategories = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();

    return ALL_PERMISSION_CATEGORIES.map((category) => {
      // Check category tab filter
      if (activeCategoryTab !== 'all' && activeCategoryTab !== category.id) {
        return null;
      }

      // Filter items within category
      const matchedItems = category.items.filter((item) => {
        // Search text matching
        const matchesQuery =
          !q ||
          item.label.toLowerCase().includes(q) ||
          item.key.toLowerCase().includes(q) ||
          category.label.toLowerCase().includes(q);

        if (!matchesQuery) return false;

        // Status matching
        const isEnabled = Boolean(permissions.actions[item.key]);
        if (statusFilter === 'enabled' && !isEnabled) return false;
        if (statusFilter === 'disabled' && isEnabled) return false;
        if (statusFilter === 'sensitive' && !item.isSensitive) return false;

        return true;
      });

      if (matchedItems.length === 0 && (q || statusFilter !== 'all')) {
        return null;
      }

      return {
        ...category,
        items: matchedItems,
        totalItemsCount: category.items.length,
      };
    }).filter(Boolean) as (typeof ALL_PERMISSION_CATEGORIES[0] & { totalItemsCount: number })[];
  }, [activeCategoryTab, permissionSearch, statusFilter, permissions.actions]);

  if (!isOpen) return null;

  return (
    <div
      id="user_edit_modal_fullscreen_root"
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col w-screen h-screen overflow-hidden font-['Cairo',sans-serif] select-none"
    >
      {/* ========================================================================= */}
      {/* STICKY TOP HEADER (شريط علوي منسق للشاشة الكاملة) */}
      {/* ========================================================================= */}
      <header className="h-16 shrink-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {isEditing ? `تعديل المستخدم والصلاحيات: ${activeUser?.name}` : 'إضافة مستخدم جديد وتحديد الصلاحيات'}
              </h1>
              {activeUser && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800 font-mono">
                  @{activeUser.username}
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950/90 text-cyan-300 border border-cyan-800 font-bold hidden md:inline-block">
                شاشة كاملة ومنسقة
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-xl">
              تحديد الدور الوظيفي، ربط الفرع، ضبط قيود الحقول، وإدارة مصفوفة الصلاحيات التفصيلية
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Counter Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            <span className="text-slate-400">الصلاحيات المفعلة:</span>
            <span className="font-bold text-cyan-400 font-mono">
              {totalEnabledPermissions} / {totalAvailablePermissions}
            </span>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isEditing ? 'حفظ التعديلات' : 'تثبيت وإنشاء الحساب'}</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-slate-700"
            title="إغلاق وتراجع"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* SCROLLABLE MAIN BODY (جسم النموذج منسق بشاشة كاملة ومقسّم بعناية) */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-5 bg-slate-950">
        <form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-5 text-xs text-slate-200">

          {/* ========================================================================= */}
          {/* Section 1: اختيار الدور الوظيفي بأزرار صغيرة مدمجة (Small Role Buttons)   */}
          {/* ========================================================================= */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <span>اختيار الدور الوظيفي للمستخدم</span>
                    <span className="text-rose-400">*</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    أزرار سريعة لتطبيق قوالب الصلاحيات وتقييد الواجهات تلقائياً
                  </p>
                </div>
              </div>

              {/* Reset to Role Preset Button */}
              <button
                type="button"
                onClick={handleResetToCurrentRoleDefault}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all"
                title="استعادة الصلاحيات القياسية للدور المحدد"
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span>استعادة صلاحيات الدور الافتراضية</span>
              </button>
            </div>

            {/* Small Role Buttons Bar (أزرار صغيرة مدمجة للأدوار) */}
            <div className="space-y-2.5">
              {/* Operational Roles (الأدوار التشغيلية الأساسية) */}
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1.5">
                  الأدوار التشغيلية الأكثر استخداماً بالفروع:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {[
                    {
                      id: 'outbound_operator' as UserRole,
                      label: 'مدخل بيانات (صادر واستقبال)',
                      badge: 'واجهتان: استقبال + مانافيست',
                      icon: FileText,
                      color: 'cyan',
                    },
                    {
                      id: 'inbound_operator' as UserRole,
                      label: 'تسليم الطرد والوارد',
                      badge: 'واجهتان: مستودع + تسليم',
                      icon: PackageCheck,
                      color: 'emerald',
                    },
                    {
                      id: 'cashier' as UserRole,
                      label: 'أمين صندوق (مالية الفرع)',
                      badge: 'واجهتان: الخزينة + المصاريف',
                      icon: Coins,
                      color: 'amber',
                    },
                  ].map((r) => {
                    const isSelected = role === r.id || (r.id === 'outbound_operator' && role === 'reception_data_entry');
                    const IconComp = r.icon;

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleRoleChange(r.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-400/40'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950' : 'text-cyan-400'}`} />
                        <span>{r.label}</span>
                        {isSelected ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            {r.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Administrative & Specialized Roles (أدوار إدارية وتشغيلية أخرى) */}
              <div className="pt-2 border-t border-slate-800/60">
                <span className="text-[10px] text-slate-400 font-bold block mb-1.5">
                  أدوار إدارية وميدانية ومخصصة:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {[
                    { id: 'hub_manager' as UserRole, label: 'مدير مركز / فرع', icon: Building2 },
                    { id: 'warehouse_keeper' as UserRole, label: 'أمين مستودع', icon: Warehouse },
                    { id: 'courier' as UserRole, label: 'مندوب توصيل وموزع', icon: Truck },
                    { id: 'super_admin' as UserRole, label: 'المدير التنفيذي العام', icon: ShieldCheck },
                    { id: 'custom' as UserRole, label: 'دور مخصص', icon: Sliders },
                  ].map((r) => {
                    const isSelected = role === r.id;
                    const IconComp = r.icon;

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleRoleChange(r.id)}
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-400/40'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{r.label}</span>
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Compact Role Isolation Notice Banner */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-[11px]">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="font-bold text-white">الدور المختار حالياً:</span>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
                  {ROLE_DEFINITIONS[role]?.title || role}
                </span>
              </div>
              <div className="text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-lg font-medium">
                {role === 'outbound_operator' || role === 'reception_data_entry'
                  ? '🔒 عزل صارم: تظهر له واجهتا [استقبال الطرود] و [المانافيست] فقط، مع حجب كامل للوحات الإحصائية والأرقام والاختصارات الأخرى.'
                  : role === 'inbound_operator'
                  ? '🔒 عزل صارم: تظهر له واجهتا [مستودع الوصول] و [تسليم الطرود] فقط، مع حجب كامل للوحات الإحصائية والأرقام والاختصارات الأخرى.'
                  : role === 'cashier'
                  ? '🔒 عزل صارم: تظهر له واجهتا [الخزينة والصناديق] و [سجل المصاريف] فقط، مع حجب كامل للوحات الإحصائية والأرقام والاختصارات الأخرى.'
                  : role === 'hub_manager'
                  ? '👑 إدارة الفرع: صلاحيات تشغيلية وإشرافية على مستوى الفرع المحدد، المانافيست، وتصفية الصناديق.'
                  : role === 'super_admin'
                  ? '⚡ المدير العام: صلاحيات غير مقيدة في كافة المحافظات ولوحة الإدارة التنفيذية وقواعد البيانات.'
                  : 'تخصيص يدوي حر لكافة الصلاحيات والواجهات بحسب الاختيارات أدناه.'}
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* Section 2: بيانات الحساب، ربط الموظف، والفرع المخصص                      */}
          {/* ========================================================================= */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-white">بيانات المستخدم وربط الفرع وسجل الموظف</h2>
                  <p className="text-[11px] text-slate-400">تعبئة الهوية الوظيفية والنطاق الجغرافي للمستخدم</p>
                </div>
              </div>

              {/* Link Employee Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 hidden sm:inline">ربط مع سجل الموظفين:</span>
                <select
                  value={employeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- ربط اختياري مع موظف مسجل --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.code}) - {emp.jobTitle}
                    </option>
                  ))}
                </select>
                {employeeId && (
                  <button
                    type="button"
                    onClick={() => setEmployeeId('')}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                    title="فك الربط"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Account Information Form Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-slate-300 font-bold mb-1">الاسم الكامل للموظف <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ريم العبدالله"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">اسم تسجيل الدخول (Username) <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. reem_data"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>رقم الهاتف / الموبايل</span>
                </label>
                <input
                  type="tel"
                  placeholder="09xxxxxxxx"
                  value={phone}
                  onKeyDown={blockNonPhoneKeys}
                  onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>الرقم الوطني السوري</span>
                </label>
                <input
                  type="text"
                  maxLength={11}
                  placeholder="010100xxxxx (11 رقم)"
                  value={nationalId}
                  onKeyDown={blockNonIntegerKeys}
                  onChange={(e) => setNationalId(sanitizeDigitsOnly(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>الفرع الأساسي المخصص <span className="text-rose-400">*</span></span>
                  {role === 'courier' && courierMainHub && (
                    <span className="text-[10px] text-purple-300 font-bold bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/40">
                      محصور بالرئيسي ({courierMainHub.name}) وفروعه
                    </span>
                  )}
                </label>
                {role === 'super_admin' ? (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold block text-amber-300 text-xs">مسؤول التطبيق العام (مستقل تماماً)</span>
                      <span className="text-[11px] text-slate-300">المدير العام لا يتبع لأي فرع محدد، بل يشرف على كافة الفروع ويدير النظام بأكمله</span>
                    </div>
                  </div>
                ) : (
                  <select
                    value={branchId}
                    onChange={(e) => {
                      const newBId = e.target.value;
                      setBranchId(newBId);
                      if (!allowedBranchIds.includes(newBId)) {
                        setAllowedBranchIds([...allowedBranchIds, newBId]);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
                  >
                    {displayedBranchesForUser.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.governorate}) - [
                        {b.type === 'main_hub'
                          ? 'رئيسي'
                          : `فرعي${b.parentHubId ? ` - تابع لـ: ${branches.find((p) => p.id === b.parentHubId)?.name || ''}` : ''}`}
                        ]
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">حرية التبديل بين الفروع</label>
                {role === 'super_admin' ? (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between">
                    <span>صلاحية وصول شاملة لكافة الفروع تلقائياً</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !canSwitchBranches;
                      setCanSwitchBranches(nextVal);
                      if (nextVal) {
                        setAllowedBranchIds(branches.map((b) => b.id));
                      }
                    }}
                    className={`w-full py-2 px-3 rounded-xl border font-bold flex items-center justify-between transition-all cursor-pointer ${
                      canSwitchBranches
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                        : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span>{canSwitchBranches ? 'مسموح التبديل لكافة الفروع' : 'مقيد بالفرع المخصص'}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${canSwitchBranches ? 'bg-amber-400' : 'bg-slate-600'}`} />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">حالة الحساب</label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-full py-2 px-3 rounded-xl border font-bold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-700 text-rose-300'
                  }`}
                >
                  <span>{isActive ? 'الحساب نشط ومفعل' : 'الحساب مجمد / معطل'}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                </button>
              </div>

              {/* Linked Employee Status Summary */}
              {selectedEmployeeObj && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400">سجل الموظف المرتبط:</span>
                  <span className="font-bold text-cyan-300 truncate">{selectedEmployeeObj.fullName}</span>
                  <span className="text-[10px] text-slate-400">{selectedEmployeeObj.jobTitle} • {selectedEmployeeObj.code}</span>
                </div>
              )}
            </div>

            {/* Allowed Branches checklist if not free switching */}
            {!canSwitchBranches && (
              <div className="pt-2 border-t border-slate-800/60">
                <label className="block text-slate-400 text-[11px] mb-1.5 font-bold">
                  {role === 'courier'
                    ? 'فروع ونقاط تجميع مصرح للموزع تغطيتها داخل المحافظة (الرئيسي وفروعه التابعة حصراً):'
                    : 'فروع إضافية مصرح للموظف تغطيتها والعمل من خلالها:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {displayedBranchesForUser.map((b) => {
                    const isAllowed = allowedBranchIds.includes(b.id) || b.id === branchId;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleToggleBranchAllowed(b.id)}
                        disabled={b.id === branchId}
                        className={`p-2 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                          isAllowed
                            ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        } ${b.id === branchId ? 'opacity-80 cursor-not-allowed' : ''}`}
                      >
                        <div className="truncate">
                          <p className="text-[11px] truncate">{b.name}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{b.governorate}</p>
                        </div>
                        {isAllowed && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* Section 3: قيود الحقول والخصوصية (Field-Level Privacy & Restrictions)      */}
          {/* ========================================================================= */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/80 text-rose-400 font-bold text-xs">
              <Lock className="w-4 h-4" />
              <span>قيود الخصوصية والحقول الحساسة (Field-Level Access Control)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {[
                {
                  key: 'canViewFinancialTotals' as const,
                  label: 'رؤية الأرقام والمجاميع المالية والأرباح',
                  desc: 'إظهار رصيد الصندوق والمجاميع في اللوحات والإحصائيات',
                },
                {
                  key: 'canViewClientPhoneNumbers' as const,
                  label: 'إظهار أرقام هواتف العملاء كاملة',
                  desc: 'في حال الإخفاء تظهر أرقام الزبائن مشفرة جزئياً',
                },
                {
                  key: 'canViewNationalId' as const,
                  label: 'إظهار والتحقق من الرقم الوطني للزبائن',
                  desc: 'الاطلاع على الهوية الشخصية للمستلمين والمرسلين',
                },
                {
                  key: 'canOverridePrices' as const,
                  label: 'السماح بتجاوز وتعديل أسعار الشحن يدوياً',
                  desc: 'إمكانية إدخال خصم أو سعر استثنائي عند التسجيل',
                },
                {
                  key: 'canDeleteRecords' as const,
                  label: 'صلاحية حذف وإلغاء الطرود والسجلات',
                  desc: 'حذف الطرود المسجلة أو إلغاء قيود اليوميات',
                },
                {
                  key: 'canSwitchBranches' as const,
                  label: 'إمكانية تغيير الفرع النشط في الشريط العلوي',
                  desc: 'حرية التنقل والاطلاع على حركة كافة المحافظات',
                },
                {
                  key: 'canDisburseNegativeBalance' as const,
                  label: 'السماح بالصرف بالسالب وتجاوز رصيد الصندوق',
                  desc: 'دفع سندات ومصاريف حتى لو كان الرصيد الحالي غير كافٍ',
                },
              ].map((item) => {
                const isEnabled = permissions.fieldRestrictions?.[item.key] ?? false;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToggleFieldRestriction(item.key)}
                    className={`p-3 rounded-xl border text-right transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                      isEnabled
                        ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-200 shadow-sm ring-1 ring-emerald-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs text-white">{item.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center flex-shrink-0 ${
                        isEnabled ? 'bg-emerald-500 text-slate-950 font-black' : 'border border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isEnabled && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ========================================================================= */}
          {/* Section 4: مصفوفة الصلاحيات المرتبة ببساطة ووضوح تامين                    */}
          {/* ========================================================================= */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            {/* Header with Search and Global Quick Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>مصفوفة الصلاحيات التفصيلية للأقسام والعمليات</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-mono">
                      {totalEnabledPermissions} / {totalAvailablePermissions} مفعلة
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    تحديد وإلغاء الصلاحيات ببساطة ووضوح تام عبر النقر المباشر أو البحث السريع
                  </p>
                </div>
              </div>

              {/* Quick Actions and Search Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Box */}
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    placeholder="بحث سريع في الصلاحيات..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pr-8 pl-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  {permissionSearch && (
                    <button
                      type="button"
                      onClick={() => setPermissionSearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Status Filters */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      statusFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('enabled')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      statusFilter === 'enabled' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    المفعلة
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('disabled')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      statusFilter === 'disabled' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    المعطلة
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('sensitive')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      statusFilter === 'sensitive' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الحساسة
                  </button>
                </div>

                {/* Bulk Select All / Clear All */}
                <button
                  type="button"
                  onClick={() => handleToggleGlobalAll(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold hover:bg-emerald-900 transition-all text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>تفعيل الكل</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleGlobalAll(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-400 font-bold hover:bg-slate-850 hover:text-white transition-all text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  <span>إلغاء الكل</span>
                </button>
              </div>
            </div>

            {/* Category Navigation Pills Bar (أزرار صغيرة لتبويبات الأقسام) */}
            <div className="flex overflow-x-auto pb-1 gap-1.5 scrollbar-thin">
              <button
                type="button"
                onClick={() => setActiveCategoryTab('all')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5 cursor-pointer ${
                  activeCategoryTab === 'all'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>كافة الأقسام</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                  activeCategoryTab === 'all' ? 'bg-slate-950 text-cyan-400' : 'bg-slate-900 text-slate-400'
                }`}>
                  {ALL_PERMISSION_CATEGORIES.length}
                </span>
              </button>

              {ALL_PERMISSION_CATEGORIES.map((cat) => {
                const isSelected = activeCategoryTab === cat.id;
                const catEnabledCount = cat.items.filter((it) => permissions.actions[it.key]).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryTab(cat.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span>{cat.label.split('(')[0]}</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                      isSelected ? 'bg-slate-950 text-cyan-400 font-bold' : 'bg-slate-900 text-slate-400'
                    }`}>
                      {catEnabledCount}/{cat.items.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Permissions Categories List (قائمة الأقسام المبسطة والمرتبة بوضوح) */}
            <div className="space-y-3 pt-1">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-10 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-slate-300 font-bold text-sm">لم يتم العثور على صلاحيات مطابقة للبحث أو الفلتر المختار</p>
                  <p className="text-[11px] text-slate-500">يرجى تعديل عبارة البحث أو اختيار "الكل" لإظهار كافة الأقسام والصلاحيات</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPermissionSearch('');
                      setStatusFilter('all');
                      setActiveCategoryTab('all');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    إعادة ضبط الفلتر والبحث
                  </button>
                </div>
              ) : (
                filteredCategories.map((category) => {
                  const isModuleEnabled = permissions.modules[category.id as keyof UserPermissions['modules']] ?? true;
                  const isCollapsed = Boolean(collapsedCategories[category.id]);
                  const catEnabledCount = category.items.filter((it) => permissions.actions[it.key]).length;

                  return (
                    <div
                      key={category.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden transition-all shadow-md"
                    >
                      {/* Category Header */}
                      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleCollapse(category.id)}
                            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isCollapsed ? 'توسيع القسم' : 'طي القسم'}
                          >
                            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-white text-xs sm:text-sm">{category.label}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-mono font-bold">
                                {catEnabledCount} / {category.items.length} مفعل
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{category.description}</p>
                          </div>
                        </div>

                        {/* Category Controls */}
                        <div className="flex items-center gap-1.5">
                          {/* Module Visibility Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleModule(category.id as any)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              isModuleEnabled
                                ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                                : 'bg-rose-950/80 border-rose-700 text-rose-300'
                            }`}
                            title="التحكم بظهور أو إخفاء أيقونة هذا القسم في قائمة التطبيقات"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isModuleEnabled ? 'ظاهر بالقائمة' : 'مخفي بالقائمة'}</span>
                          </button>

                          {/* Quick Select All / None for this category */}
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryAll(category.id, true)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            تحديد القسم
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryAll(category.id, false)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[10px] transition-all cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>

                      {/* Actions Grid (شبكة عناصر الصلاحيات البسيطة والواضحة) */}
                      {!isCollapsed && (
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {category.items.map((item) => {
                            const isAllowed = permissions.actions[item.key] ?? false;

                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => handleToggleAction(item.key)}
                                className={`p-3 rounded-xl border text-right transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                                  isAllowed
                                    ? 'bg-slate-900 border-cyan-500/70 text-white shadow-sm ring-1 ring-cyan-500/20'
                                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                                }`}
                              >
                                <div className="flex items-start gap-2.5 overflow-hidden">
                                  {/* Custom High Contrast Checkbox */}
                                  <div
                                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center flex-shrink-0 transition-all ${
                                      isAllowed
                                        ? 'bg-cyan-500 text-slate-950 font-black'
                                        : 'border border-slate-700 bg-slate-900'
                                    }`}
                                  >
                                    {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>

                                  <div className="truncate">
                                    <p className="font-bold text-xs text-white leading-tight">
                                      {item.label}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                      {category.description}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  {getActionBadge(item.action)}
                                  {item.isSensitive && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-800 text-amber-300 font-bold">
                                      حساسة
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Spacer for bottom sticky bar */}
          <div className="h-10" />
        </form>
      </div>

      {/* ========================================================================= */}
      {/* STICKY BOTTOM BAR (شريط تثبيت سفلي واضح للشاشة الكاملة)                    */}
      {/* ========================================================================= */}
      <footer className="shrink-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 z-20 shadow-2xl">
        {/* Left Side: Summary info */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">الدور المحدد:</span>
            <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
              {ROLE_DEFINITIONS[role]?.title || role}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-slate-400">الفرع المخصص:</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-200 border border-slate-800 font-bold">
              {branches.find((b) => b.id === branchId)?.name || 'الفرع الأساسي'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">الصلاحيات:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {totalEnabledPermissions}
            </span>
            <span className="text-slate-500 font-mono">/ {totalAvailablePermissions}</span>
          </div>
        </div>

        {/* Right Side: Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
          >
            إلغاء وتراجع
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isEditing ? 'حفظ وتحديث الصلاحيات' : 'تثبيت وإنشاء حساب المستخدم'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
