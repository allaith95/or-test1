import React, { useState, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import { safeStorage } from '../utils/storage';
import {
  Users,
  Building,
  Plus,
  Shield,
  Phone,
  CheckCircle,
  Percent,
  Search,
  Lock,
  Eye,
  Edit,
  Trash2,
  UserCheck,
  Power,
  Layers,
  MapPin,
  Check,
  Link2,
  Table,
  ShieldCheck,
  Truck,
  Bike,
  Smartphone,
  CreditCard,
} from 'lucide-react';
import { Branch, User, Governorate, UserRole, UserPermissions } from '../types';
import {
  blockNonAmountKeys,
  blockNonPhoneKeys,
  sanitizeDecimal,
  sanitizePhone,
} from '../utils/numberSanitizer';
import { UserEditModal } from './UserEditModal';
import { BulkBranchManager } from './BulkBranchManager';
import { CourierCardModal } from './CourierCardModal';
import { UnifiedBranchUserManager } from './UnifiedBranchUserManager';

export const AdminUsersBranchesView: React.FC = () => {
  const {
    branches,
    branchesWithDerivedBalances,
    users,
    employees,
    addBranch,
    addUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    currentBranch,
    setCurrentBranch,
    currentUser,
    setCurrentUser,
    formatCurrency,
  } = useOrca();

  const [activeTab, setActiveTab] = useState<'unified_branches' | 'users' | 'couriers' | 'branches' | 'bulk_branches'>(() => {
    try {
      const saved = safeStorage.getItem('orca_admin_users_branches_tab');
      if (saved) return saved as any;
    } catch {}
    return 'unified_branches';
  });

  useEffect(() => {
    try {
      safeStorage.setItem('orca_admin_users_branches_tab', activeTab);
    } catch {}
  }, [activeTab]);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  
  // User Modal State (Opens full-screen on clicking Add User or Edit User)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<User | null>(null);

  // Courier Card Modal State
  const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
  const [selectedCourierToEdit, setSelectedCourierToEdit] = useState<User | null>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

  // New Branch State
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchType, setNewBranchType] = useState<'main_hub' | 'collection_point' | 'agent'>('collection_point');
  const [newBranchGov, setNewBranchGov] = useState<Governorate>('دمشق');
  const [newBranchParent, setNewBranchParent] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [newBranchManager, setNewBranchManager] = useState('');
  const [newBranchShippingComm, setNewBranchShippingComm] = useState(0);
  const [newBranchTransferComm, setNewBranchTransferComm] = useState(0);

  if (currentUser.role !== 'super_admin') {
    return (
      <div className="p-8 max-w-xl mx-auto text-center bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl space-y-4 my-12">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
          <Users className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">الوصول مقيد - خاص بالمدير العام حصراً</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          إدارة شجرة الفروع والمراكز، إنشاء وتعديل المستخدمين، ومنح الصلاحيات محصورة بالمدير العام حصراً.
        </p>
      </div>
    );
  }

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName || !newBranchCode) return;

    if (newBranchType === 'collection_point' && !newBranchParent) {
      alert('نقطة التجميع يجب ربطها بفرع رئيسي تابع له! يرجى اختيار الفرع الرئيسي.');
      return;
    }

    addBranch({
      code: newBranchCode,
      name: newBranchName,
      type: newBranchType,
      governorate: newBranchGov,
      parentHubId: (newBranchType === 'collection_point' || newBranchType === 'agent') ? newBranchParent : undefined,
      commissionRateShipping: newBranchType === 'agent' ? Number(newBranchShippingComm) : 0,
      commissionRateTransfers: newBranchType === 'agent' ? Number(newBranchTransferComm) : 0,
      address: newBranchAddress,
      phone: newBranchPhone,
      managerName: newBranchManager,
      isActive: true,
    });

    setIsAddBranchOpen(false);
    setNewBranchCode('');
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setNewBranchManager('');
    setNewBranchParent('');
  };

  const handleOpenAddUser = () => {
    setSelectedUserToEdit(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setSelectedUserToEdit(user);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (userData: {
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
  }) => {
    if (userData.id) {
      updateUser(userData.id, userData);
    } else {
      addUser(userData);
    }
  };

  const handleDeleteUser = (user: User) => {
    if (user.id === 'usr_super_admin') {
      alert('لا يمكن حذف حساب المدير التنفيذي الرئيسي للنظام');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف المستخدم "${user.name}" (@${user.username}) نهائياً؟`)) {
      deleteUser(user.id);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery)) ||
      (u.nationalId && u.nationalId.includes(searchQuery));

    const matchesRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
    const matchesBranch = selectedBranchFilter === 'all' || u.branchId === selectedBranchFilter;

    return matchesSearch && matchesRole && matchesBranch;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-bold text-[10px] inline-flex items-center gap-1"><Shield className="w-3 h-3" /> مدير عام النظام</span>;
      case 'hub_manager':
        return <span className="px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-bold text-[10px] inline-flex items-center gap-1"><Building className="w-3 h-3" /> مدير فرع / مركز</span>;
      case 'outbound_operator':
        return <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold text-[10px] inline-flex items-center gap-1"><Plus className="w-3 h-3" /> مدخل بيانات (صادر واستقبال)</span>;
      case 'inbound_operator':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px] inline-flex items-center gap-1"><Layers className="w-3 h-3" /> تسليم الطرد والوارد</span>;
      case 'reception_data_entry':
        return <span className="px-2.5 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-bold text-[10px] inline-flex items-center gap-1"><Plus className="w-3 h-3" /> كاونتر واستقبال</span>;
      case 'warehouse_keeper':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold text-[10px] inline-flex items-center gap-1"><Layers className="w-3 h-3" /> أمين مستودع</span>;
      case 'cashier':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px] inline-flex items-center gap-1"><Percent className="w-3 h-3" /> أمين صندوق ومحاسب</span>;
      case 'courier':
        return <span className="px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800 font-bold text-[10px] inline-flex items-center gap-1"><Phone className="w-3 h-3" /> مندوب وسائق</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold text-[10px] inline-flex items-center gap-1">مخصص</span>;
    }
  };

  return (
    <div className="space-y-4 pb-20 text-slate-100">
      {/* Header Card - Compact */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-700 text-indigo-300 text-[11px] font-mono font-bold">
              لوحة الإدارة والتحكم
            </span>
            <h1 className="text-sm sm:text-base font-black text-white">
              المستخدمين، الفروع، والصلاحيات
            </h1>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {branches.length} فرع مسجل • {users.length} مستخدم
          </span>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('unified_branches')}
            className={`px-3.5 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'unified_branches'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg font-black ring-1 ring-blue-400/50'
                : 'text-blue-300 hover:text-white hover:bg-blue-500/10 border border-blue-500/30'
            }`}
          >
            <Building className="w-3.5 h-3.5 text-blue-400" />
            <span>🏢 إدارة الفروع والمستخدمين (الواجهة الموحدة)</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>كافة المستخدمين والصلاحيات ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('couriers')}
            className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'couriers' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-300 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>الموزعين ({users.filter((u) => u.role === 'courier').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('bulk_branches')}
            className={`px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'bulk_branches'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md font-black'
                : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/30'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>جدول الفروع⚡</span>
          </button>
        </div>
      </div>

      {/* Active User Quick Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300 font-bold text-sm">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">المستخدم المسجل حالياً بالجلسة:</span>
              <span className="text-xs font-black text-cyan-300">{currentUser.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">(@{currentUser.username})</span>
              {getRoleBadge(currentUser.role)}
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              الفرع النشط: <span className="font-bold text-amber-300">{currentBranch.name}</span> ({currentBranch.governorate}) • {currentUser.canSwitchBranches ? 'مسموح التبديل لأي فرع' : 'مقيد بالفرع المصرح'}
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-300 flex items-center gap-2">
          <span className="text-slate-400">يمكنك التبديل الفوري بين الحسابات لتجربة الصلاحيات مباشرة من الجدول أدناه ⬇️</span>
        </div>
      </div>

      {/* TAB 0: UNIFIED BRANCH & USER MANAGER */}
      {activeTab === 'unified_branches' && (
        <UnifiedBranchUserManager />
      )}

      {/* TAB 1: USERS & PERMISSIONS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Top Actions & Filters Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث باسم المستخدم، الدخول، الهاتف، أو الرقم الوطني..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Role Filter */}
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">كافة الأدوار الوظيفية</option>
                <option value="super_admin">مدير عام للنظام</option>
                <option value="hub_manager">مدير مركز / فرع</option>
                <option value="outbound_operator">مدخل بيانات (صادر واستقبال)</option>
                <option value="inbound_operator">تسليم الطرد والوارد</option>
                <option value="reception_data_entry">كاونتر واستقبال</option>
                <option value="warehouse_keeper">أمين مستودع</option>
                <option value="cashier">أمين صندوق ومحاسب</option>
                <option value="courier">مندوب وسائق</option>
                <option value="custom">مخصص</option>
              </select>

              {/* Branch Filter */}
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">كافة الفروع والمحافظات</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Add Action Buttons */}
            <div className="flex items-center gap-2">
              {currentUser.role === 'super_admin' && (
                <button
                  onClick={() => {
                    setSelectedCourierToEdit(null);
                    setIsCourierModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 border border-purple-400/30 transition-all active:scale-95"
                >
                  <Truck className="w-4 h-4" />
                  <span>+ إضافة موزع معتمد</span>
                </button>
              )}

              <button
                onClick={handleOpenAddUser}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مستخدم عام</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4 font-semibold">المستخدم والحساب</th>
                    <th className="py-3 px-4 font-semibold">الدور الوظيفي</th>
                    <th className="py-3 px-4 font-semibold">الفرع المخصص والنطاق</th>
                    <th className="py-3 px-4 font-semibold">ملخص الصلاحيات الحساسة</th>
                    <th className="py-3 px-4 font-semibold">الحالة</th>
                    <th className="py-3 px-4 font-semibold text-center">الإجراءات والتحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((user) => {
                    const branch = branches.find((b) => b.id === user.branchId);
                    const linkedEmp = user.employeeId ? employees.find((e) => e.id === user.employeeId) : null;
                    const isCurrent = currentUser.id === user.id;
                    const canViewFin = user.permissions?.fieldRestrictions?.canViewFinancialTotals ?? (user.role === 'super_admin' || user.role === 'hub_manager' || user.role === 'cashier');
                    const canDelete = user.permissions?.fieldRestrictions?.canDeleteRecords ?? (user.role === 'super_admin');
                    const canOverride = user.permissions?.fieldRestrictions?.canOverridePrices ?? (user.role === 'super_admin' || user.role === 'hub_manager');

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors ${
                          isCurrent ? 'bg-indigo-950/30' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* User info */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-xs">{user.name}</span>
                                {isCurrent && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                                    الحالي
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                <span>@{user.username}</span>
                                {user.phone && <span>• {user.phone}</span>}
                              </div>
                              {linkedEmp && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60 w-fit">
                                  <Link2 className="w-3 h-3 text-indigo-400" />
                                  <span>بطاقة موظف: {linkedEmp.fullName} ({linkedEmp.code})</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4">{getRoleBadge(user.role)}</td>

                        {/* Branch */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {user.role === 'super_admin' ? (
                              <>
                                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>مسؤول التطبيق العام (مستقل)</span>
                                </div>
                                <div className="text-[10px] text-emerald-400 font-mono">
                                  غير مقيد بأي فرع • تحكم شامل وإشراف عام
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-bold text-slate-200 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                                  <span>{branch?.name || 'غير محدد'}</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {user.canSwitchBranches ? (
                                    <span className="text-amber-400 font-mono">تبديل حر لكافة الفروع</span>
                                  ) : (
                                    <span>مقيد بفرعه ({user.allowedBranchIds?.length || 1} فروع مصرحة)</span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Sensitive Permissions Badges */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${
                                canViewFin
                                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-500'
                              }`}
                              title={canViewFin ? 'مسموح رؤية الأرقام المالية' : 'محجوبة الأرقام المالية'}
                            >
                              {canViewFin ? '✓ رؤية المبالغ' : '✗ إخفاء المبالغ'}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${
                                canDelete
                                  ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-500'
                              }`}
                              title={canDelete ? 'مسموح حذف السجلات' : 'ممنوع الحذف'}
                            >
                              {canDelete ? '✓ حذف السجلات' : '✗ ممنوع الحذف'}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${
                                canOverride
                                  ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-500'
                              }`}
                              title={canOverride ? 'مسموح تعديل الأسعار' : 'تسعير آلي فقط'}
                            >
                              {canOverride ? '✓ تعديل السعر' : '✗ تسعير آلي'}
                            </span>
                          </div>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleUserStatus(user.id)}
                            className={`px-2 py-1 rounded-lg border font-bold text-[10px] flex items-center gap-1 transition-all ${
                              user.isActive
                                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900'
                                : 'bg-rose-950/80 border-rose-700 text-rose-300 hover:bg-rose-900'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{user.isActive ? 'نشط' : 'معطل'}</span>
                          </button>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Current User Badge or Status */}
                            {isCurrent && (
                              <span className="px-2 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-700 text-[10px] font-bold flex items-center gap-1">
                                <UserCheck className="w-3 h-3" />
                                <span>الحساب الحالي</span>
                              </span>
                            )}

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(user)}
                              title="تعديل الحساب والصلاحيات والفرع"
                              className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 hover:bg-indigo-900 hover:text-white transition-all"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            {user.id !== 'usr_super_admin' && user.role !== 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                title="حذف المستخدم"
                                className="p-1.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 hover:text-white transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* TAB 2: AUTHORIZED COURIERS DIRECTORY & CARDS */}
      {activeTab === 'couriers' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">سجل وبطاقات الموزعين المعتمدين والميدانيين</h2>
                <p className="text-[11px] text-slate-400">
                  ربط الموزع بالفرع وتخصيص بيئة الجوال المحمولة واسم المستخدم وكلمة المرور لكل موزع
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedCourierToEdit(null);
                setIsCourierModalOpen(true);
              }}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/30 border border-purple-400/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء بطاقة موزع معتمد جديد</span>
            </button>
          </div>

          {/* Couriers Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.filter((u) => u.role === 'courier').length === 0 ? (
              <div className="col-span-full p-8 text-center bg-slate-900/80 border border-slate-800 rounded-3xl space-y-3">
                <Truck className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-200">لا يوجد موزعين معتمدين مسجلين حتى الآن</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  يمكنك إنشاء بطاقة موزع معتمد جديد وتخصيص اسم مستخدم وكلمة مرور له ليدخل لموديل الموزع عبر الجوال مباشرة.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourierToEdit(null);
                    setIsCourierModalOpen(true);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أول موزع معتمد</span>
                </button>
              </div>
            ) : (
              users
                .filter((u) => u.role === 'courier')
                .map((courier) => {
                  const cBranch = branches.find((b) => b.id === courier.branchId);

                  return (
                    <div
                      key={courier.id}
                      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 hover:border-purple-500/40 transition-all"
                    >
                      {/* Top Bar: Name & Role Badge */}
                      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center font-bold text-purple-300 text-sm">
                            {courier.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-white">{courier.name}</h3>
                            <span className="text-[11px] text-purple-300 font-mono font-bold">
                              @{courier.username}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            courier.isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {courier.isActive ? 'حساب نشط' : 'حساب معطل'}
                        </span>
                      </div>

                      {/* Courier Card Details */}
                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">كلمة المرور:</span>
                          <span className="font-mono text-amber-300 font-bold">{courier.password || '12345'}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">الفرع المعتمد:</span>
                          <span className="font-bold text-white">{cBranch?.name || 'مركز عام'}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">رقم الهاتف:</span>
                          <a
                            href={`tel:${courier.phone}`}
                            className="font-mono text-emerald-300 font-bold hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{courier.phone || 'غير مسجل'}</span>
                          </a>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">وسيلة النقل:</span>
                          <span className="bg-slate-950 px-2 py-0.5 rounded text-slate-200 border border-slate-800 font-bold">
                            {courier.vehicleType || 'دراجة نارية'} {courier.vehiclePlate && `(${courier.vehiclePlate})`}
                          </span>
                        </div>

                        {courier.coverageArea && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">قطاع التوزيع:</span>
                            <span className="text-purple-300 font-medium">{courier.coverageArea}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCourierToEdit(courier);
                            setIsCourierModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 rounded-xl font-bold text-xs flex items-center gap-1 transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>تعديل البطاقة</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleUserStatus(courier.id)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition flex items-center gap-1 ${
                            courier.isActive
                              ? 'bg-rose-950/60 hover:bg-rose-900 border-rose-800 text-rose-300'
                              : 'bg-emerald-950/60 hover:bg-emerald-900 border-emerald-800 text-emerald-300'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{courier.isActive ? 'تعطيل' : 'تفعيل'}</span>
                        </button>

                        {courier.id === currentUser.id && (
                          <span className="px-2.5 py-1 bg-cyan-950/80 border border-cyan-700 text-cyan-300 rounded-xl font-bold text-xs flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>الحساب النشط</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BRANCHES & HUBS MANAGEMENT */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h2 className="text-sm font-bold text-white">
              قائمة مراكز المحافظات وفروع التجميع ({branches.length} فرع)
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('bulk_branches')}
                className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition"
              >
                <Table className="w-4 h-4" />
                <span>إضافة وتعديل مجمع كـ جدول (مع توليد الكوادر)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddBranchOpen(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة فرع فردي</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchesWithDerivedBalances.map((branch) => {
              const isMain = branch.type === 'main_hub';
              const isCurrent = currentBranch?.id === branch.id;
              const branchUsers = users.filter((u) => u.branchId === branch.id);

              return (
                <div
                  key={branch.id}
                  className={`bg-slate-900/85 backdrop-blur-md border rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all ${
                    isCurrent ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${
                            isMain
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          }`}
                        >
                          {isMain ? 'رئيسي' : 'فرعي'}
                        </span>
                        <h3 className="font-bold text-sm text-white mt-1">{branch.name}</h3>
                        {!isMain && branch.parentHubId && (
                          <p className="text-[11px] text-amber-300/90 font-medium mt-0.5">
                            تابع للرئيسي:{' '}
                            <span className="font-bold text-amber-300">
                              {branches.find((p) => p.id === branch.parentHubId)?.name || 'غير محدد'}
                            </span>
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400">{branch.code}</span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <p className="flex items-center gap-1 text-slate-400">
                        <Building className="w-3.5 h-3.5" />
                        <span>{branch.governorate} • {branch.address}</span>
                      </p>
                      <p className="flex items-center gap-1 text-slate-400">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="font-mono">{branch.phone || 'غير مسجل'}</span>
                      </p>
                      <p className="text-slate-400">
                        المدير: <span className="text-slate-200 font-bold">{branch.managerName}</span>
                      </p>
                      <p className="text-slate-400">
                        الموظفون المرتبطون بهذا الفرع: <span className="text-cyan-300 font-bold font-mono">{branchUsers.length} موظف</span>
                      </p>
                    </div>

                    {!isMain && (
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 font-sans flex items-center gap-1">
                          <Percent className="w-3.5 h-3.5 text-indigo-400" /> عمولة الفرع:
                        </span>
                        <span className="font-bold text-indigo-300">
                          {branch.commissionRateShipping}% شحن / {branch.commissionRateTransfers}% حوالات
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                    <span
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold ${
                        isCurrent
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                          : 'bg-slate-800/60 text-slate-400'
                      }`}
                    >
                      {isCurrent ? 'الفرع النشط للجلسة' : 'فرع مسجل'}
                    </span>

                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {formatCurrency(branch.boxSypBalance ?? 0, 'SYP')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: BULK BRANCHES & INLINE TABLE */}
      {activeTab === 'bulk_branches' && (
        <BulkBranchManager onBackToGrid={() => setActiveTab('branches')} />
      )}

      {/* USER EDIT / ADD MODAL */}
      <UserEditModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        userToEdit={selectedUserToEdit}
        branches={branches}
        onSave={handleSaveUser}
      />

      {/* MODAL ADD BRANCH */}
      {isAddBranchOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">إضافة فرع أو مركز تجميع جديد</h2>
              <button onClick={() => setIsAddBranchOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">رمز الفرع (Code)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DAM-03"
                    value={newBranchCode}
                    onChange={(e) => setNewBranchCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نوع الفرع</label>
                  <select
                    value={newBranchType}
                    onChange={(e) => {
                      const t = e.target.value as any;
                      setNewBranchType(t);
                      if (t === 'main_hub') setNewBranchParent('');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="main_hub">فرع رئيسي (مركز شحن وتفريغ)</option>
                    <option value="collection_point">نقطة تجميع (تسليم مباشر للرئيسي - بدون عمولات)</option>
                    <option value="agent">مكتب وكيل (خاضع لنظام العمولات والمقاصة المالية)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">اسم الفرع / المكتب</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مكتب أوركا - الميدان / وكالة حمص"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">المحافظة</label>
                  <select
                    value={newBranchGov}
                    onChange={(e) => setNewBranchGov(e.target.value as Governorate)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="دمشق">دمشق</option>
                    <option value="ريف دمشق">ريف دمشق</option>
                    <option value="حلب">حلب</option>
                    <option value="حمص">حمص</option>
                    <option value="اللاذقية">اللاذقية</option>
                    <option value="طرطوس">طرطوس</option>
                    <option value="حماة">حماة</option>
                    <option value="درعا">درعا</option>
                    <option value="السويداء">السويداء</option>
                    <option value="دير الزور">دير الزور</option>
                    <option value="الرقة">الرقة</option>
                    <option value="الحسكة">الحسكة</option>
                    <option value="القنيطرة">القنيطرة</option>
                    <option value="إدلب">إدلب</option>
                  </select>
                </div>

                {(newBranchType === 'collection_point' || newBranchType === 'agent') && (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      الرئيسي التابع له {newBranchType === 'collection_point' && <span className="text-amber-400">*</span>}
                    </label>
                    <select
                      value={newBranchParent}
                      onChange={(e) => setNewBranchParent(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/60 focus:border-amber-400 rounded-xl px-3 py-2 text-amber-300"
                      required={newBranchType === 'collection_point'}
                    >
                      <option value="">-- اختر الفرع الرئيسي --</option>
                      {branches
                        .filter((b) => b.type === 'main_hub')
                        .map((hub) => (
                          <option key={hub.id} value={hub.id}>
                            {hub.name} ({hub.governorate})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {newBranchType === 'collection_point' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-[11px] leading-relaxed">
                  💡 <strong>نقطة تجميع داخلية:</strong> تُسلم كافة مقبوضاتها النقدية مباشرة كعهدة نقدية للفرع الرئيسي التابع له. لا توجد لها عمولات أو سندات مقاصة.
                </div>
              )}

              {newBranchType === 'agent' && (
                <div className="space-y-2">
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 text-[11px] leading-relaxed">
                    🤝 <strong>مكتب وكيل خارجي:</strong> خاضع لنظام المقاصة المالية. يستحق عمولة محددة على أجور الشحن والتحويلات، وتصدر له سندات مقاصة متبادلة مع المركز الرئيسي.
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-cyan-300 font-semibold mb-1">نسبة عمولة الشحن (%)</label>
                      <input
                        type="number"
                        step="any"
                        value={newBranchShippingComm === 0 ? '' : newBranchShippingComm}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={blockNonAmountKeys}
                        onChange={(e) => {
                          const clean = sanitizeDecimal(e.target.value);
                          setNewBranchShippingComm(clean === '' ? 0 : Number(clean) || 0);
                        }}
                        placeholder="e.g. 15%"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-cyan-300 font-semibold mb-1">نسبة عمولة التحويلات (%)</label>
                      <input
                        type="number"
                        step="any"
                        value={newBranchTransferComm === 0 ? '' : newBranchTransferComm}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={blockNonAmountKeys}
                        onChange={(e) => {
                          const clean = sanitizeDecimal(e.target.value);
                          setNewBranchTransferComm(clean === '' ? 0 : Number(clean) || 0);
                        }}
                        placeholder="e.g. 20%"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">العنوان التفصيلي</label>
                <input
                  type="text"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  placeholder="الشارع، البناء، مقابل..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">هاتف الفرع</label>
                  <input
                    type="tel"
                    value={newBranchPhone}
                    onKeyDown={blockNonPhoneKeys}
                    onChange={(e) => setNewBranchPhone(sanitizePhone(e.target.value))}
                    placeholder="011-xxxxxxx"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">اسم مدير الفرع</label>
                  <input
                    type="text"
                    value={newBranchManager}
                    onChange={(e) => setNewBranchManager(e.target.value)}
                    placeholder="أ. فلان الفلاني"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddBranchOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold"
                >
                  إضافة الفرع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Courier Card Modal Component */}
      <CourierCardModal
        isOpen={isCourierModalOpen}
        onClose={() => {
          setIsCourierModalOpen(false);
          setSelectedCourierToEdit(null);
        }}
        courierToEdit={selectedCourierToEdit}
      />
    </div>
  );
};
