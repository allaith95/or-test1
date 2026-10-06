import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Save,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Lock,
  ArrowRight,
  Printer,
  ShieldCheck,
  Key,
  UserPlus,
  UserCheck,
  Shield,
} from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import { Branch, Governorate, User, UserRole } from '../types';
import {
  blockNonAmountKeys,
  blockNonPhoneKeys,
  sanitizeDecimal,
  sanitizePhone,
} from '../utils/numberSanitizer';
import { ALL_GOVERNORATES, GOVERNORATE_CODES, generateDefaultUsersForBranch } from '../utils/branchHelper';
import { getDefaultPermissionsForRole } from '../utils/permissionEngine';

interface BranchDraftRow {
  id: string;
  code: string;
  name: string;
  governorate: Governorate;
  type: 'main_hub' | 'collection_point' | 'agent';
  parentHubId?: string;
  managerName: string;
  phone: string;
  address: string;
  initialSyp: number;
  initialUsd: number;
  commissionRateShipping: number;
  commissionRateTransfers: number;
}

interface BulkBranchManagerProps {
  onBackToGrid?: () => void;
}

export const BulkBranchManager: React.FC<BulkBranchManagerProps> = ({ onBackToGrid }) => {
  const {
    branches,
    users,
    updateBranch,
    deleteBranch,
    addMultipleBranchesWithUsers,
    addUser,
    updateUser,
  } = useOrca();

  const [activeTab, setActiveTab] = useState<'bulk_add' | 'inline_edit'>('bulk_add');

  // Bulk Add Rows State - starts with two completely empty rows as requested
  const [draftRows, setDraftRows] = useState<BranchDraftRow[]>([
    {
      id: `row_1`,
      code: '',
      name: '',
      governorate: 'دمشق',
      type: 'collection_point',
      parentHubId: '',
      managerName: '',
      phone: '',
      address: '',
      initialSyp: 0,
      initialUsd: 0,
      commissionRateShipping: 0,
      commissionRateTransfers: 0,
    },
    {
      id: `row_2`,
      code: '',
      name: '',
      governorate: 'دمشق',
      type: 'collection_point',
      parentHubId: '',
      managerName: '',
      phone: '',
      address: '',
      initialSyp: 0,
      initialUsd: 0,
      commissionRateShipping: 0,
      commissionRateTransfers: 0,
    },
  ]);

  const [autoGenerateStaff, setAutoGenerateStaff] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState('123456');

  // Pre-Save Staff Customization Modal State
  const [showStaffCustomizationModal, setShowStaffCustomizationModal] = useState(false);
  const [pendingBranches, setPendingBranches] = useState<Branch[]>([]);
  const [pendingStaff, setPendingStaff] = useState<User[]>([]);
  const [bulkPasswordInput, setBulkPasswordInput] = useState('123456');

  // Created report modal state
  const [creationResult, setCreationResult] = useState<{
    createdBranches: Branch[];
    createdUsers: User[];
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inline edit state for existing branches
  const [editableBranches, setEditableBranches] = useState<Branch[]>(() =>
    JSON.parse(JSON.stringify(branches))
  );
  const [inlineSaveSuccess, setInlineSaveSuccess] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  // Sync editable branches when system branches change
  React.useEffect(() => {
    setEditableBranches(JSON.parse(JSON.stringify(branches)));
  }, [branches]);

  // Row Manipulation - adding a new row is completely empty with no pre-filled values
  const handleAddRow = () => {
    const newRow: BranchDraftRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      code: '',
      name: '',
      governorate: 'دمشق',
      type: 'collection_point',
      parentHubId: '',
      managerName: '',
      phone: '',
      address: '',
      initialSyp: 0,
      initialUsd: 0,
      commissionRateShipping: 0,
      commissionRateTransfers: 0,
    };
    setDraftRows((prev) => [...prev, newRow]);
  };

  const handleUpdateDraftRow = (id: string, field: keyof BranchDraftRow, value: any) => {
    setDraftRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveDraftRow = (id: string) => {
    setDraftRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearDraftRows = () => {
    setDraftRows([]);
  };

  // Submit Bulk Add -> Opens review & customization modal before final save
  const handleStartBulkAddReview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const activeRows = draftRows.filter((r) => r.code.trim() || r.name.trim());
    if (activeRows.length === 0) {
      alert('يرجى تعبئة كود واسم الفرع لسطر واحد على الأقل في الجدول للمتابعة!');
      return;
    }

    // Validate codes, names, and parent hub assignment for active rows
    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i];
      if (!row.code.trim()) {
        alert(`يرجى كتابة كود الفرع للسطر رقم ${i + 1}`);
        return;
      }
      if (!row.name.trim()) {
        alert(`يرجى كتابة اسم الفرع للسطر رقم ${i + 1}`);
        return;
      }
      if (row.type === 'collection_point' && !row.parentHubId) {
        alert(
          `الفرع "${row.name || row.code || `سطر ${i + 1}`}" نوعه "فرعي" ويجب ربطه بفرع رئيسي تابع له!\nيرجى اختيار الفرع الرئيسي من عمود "الرئيسي التابع له".`
        );
        return;
      }
    }

    // Check code uniqueness among active rows
    const seenCodes = new Set<string>();
    for (const r of activeRows) {
      const c = r.code.trim().toUpperCase();
      if (seenCodes.has(c)) {
        alert(`كود الفرع (${r.code}) مكرر في الجدول! يجب أن يكون كود كل فرع فريداً.`);
        return;
      }
      seenCodes.add(c);
    }

    // Check code uniqueness with existing system branches
    const existingCodes = new Set(branches.map((b) => b.code.toUpperCase()));
    for (const r of activeRows) {
      const c = r.code.trim().toUpperCase();
      if (existingCodes.has(c)) {
        alert(`كود الفرع (${r.code}) موجود مسبقاً في النظام! يرجى اختيار كود فريد.`);
        return;
      }
    }

    // Map row temporary ids to new branchIds so sub-branches can reference drafted main hubs in the same batch
    const rowIdToBranchId = new Map<string, string>();
    activeRows.forEach((r, index) => {
      const branchId = `br_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;
      rowIdToBranchId.set(r.id, branchId);
    });

    // Prepare candidate branches with assigned ids and resolved parentHubIds
    const preparedBranches: Branch[] = activeRows.map((r) => {
      const branchId = rowIdToBranchId.get(r.id)!;
      let resolvedParentHubId: string | undefined = undefined;

      if (r.type === 'collection_point' && r.parentHubId) {
        if (rowIdToBranchId.has(r.parentHubId)) {
          resolvedParentHubId = rowIdToBranchId.get(r.parentHubId);
        } else {
          resolvedParentHubId = r.parentHubId;
        }
      }

      return {
        id: branchId,
        code: r.code.trim().toUpperCase(),
        name: r.name.trim(),
        governorate: r.governorate,
        type: r.type,
        parentHubId: resolvedParentHubId,
        managerName: r.managerName.trim() || `مدير ${r.name.trim()}`,
        phone: r.phone.trim() || '0900000000',
        address: r.address.trim() || `${r.governorate} - الشارع العام`,
        boxSypBalance: Number(r.initialSyp) || 0,
        boxUsdBalance: Number(r.initialUsd) || 0,
        openingBalanceSyp: Number(r.initialSyp) || 0,
        openingBalanceUsd: Number(r.initialUsd) || 0,
        commissionRateShipping: Number(r.commissionRateShipping) || 0,
        commissionRateTransfers: Number(r.commissionRateTransfers) || 0,
        isActive: true,
      };
    });

    // Generate staff candidates for each branch if autoGenerateStaff is true
    const preparedUsers: User[] = [];
    if (autoGenerateStaff) {
      preparedBranches.forEach((branch) => {
        const branchUsers = generateDefaultUsersForBranch(branch, defaultPassword);
        preparedUsers.push(...branchUsers);
      });
    }

    setPendingBranches(preparedBranches);
    setPendingStaff(preparedUsers);
    setBulkPasswordInput(defaultPassword);
    setShowStaffCustomizationModal(true);
  };

  // Staff customization handlers in modal
  const handleAddStaffToBranch = (branchId: string) => {
    const branch = pendingBranches.find((b) => b.id === branchId);
    if (!branch) return;
    const newStaffId = `usr_custom_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const branchShort = branch.name.replace(/المركز الرئيسي - |فرع /g, '');
    const newUser: User = {
      id: newStaffId,
      name: `موظف ${branchShort}`,
      username: `emp_${branch.code.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.floor(10 + Math.random() * 90)}`,
      password: bulkPasswordInput || defaultPassword || '123456',
      role: 'outbound_operator',
      branchId: branch.id,
      allowedBranchIds: [branch.id],
      canSwitchBranches: false,
      phone: branch.phone || '0900000000',
      isActive: true,
      permissions: getDefaultPermissionsForRole('outbound_operator'),
    };
    setPendingStaff((prev) => [...prev, newUser]);
  };

  const handleUpdatePendingUser = (userId: string, updates: Partial<User>) => {
    setPendingStaff((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const updated = { ...u, ...updates };
        if (updates.role && updates.role !== u.role) {
          updated.permissions = getDefaultPermissionsForRole(updates.role);
        }
        return updated;
      })
    );
  };

  const handleRemovePendingUser = (userId: string) => {
    setPendingStaff((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleApplyBulkPassword = () => {
    if (!bulkPasswordInput.trim()) {
      alert('يرجى إدخال كلمة المرور أولاً');
      return;
    }
    setPendingStaff((prev) =>
      prev.map((u) => ({ ...u, password: bulkPasswordInput.trim() }))
    );
  };

  const handleConfirmFinalSave = () => {
    for (let i = 0; i < pendingStaff.length; i++) {
      const usr = pendingStaff[i];
      if (!usr.name.trim()) {
        alert(`يرجى كتابة الاسم للموظف رقم ${i + 1}`);
        return;
      }
      if (!usr.username.trim()) {
        alert(`يرجى كتابة اسم المستخدم (Username) للموظف رقم ${i + 1}`);
        return;
      }
      if (!usr.password?.trim()) {
        alert(`يرجى كتابة كلمة المرور للموظف (${usr.name})`);
        return;
      }
    }

    // Check username duplicates among pendingStaff
    const seenUsernames = new Set<string>();
    for (const usr of pendingStaff) {
      const u = usr.username.trim().toLowerCase();
      if (seenUsernames.has(u)) {
        alert(`اسم المستخدم (${usr.username}) مكرر بين الكوادر الجديدة! يرجى التأكد من أن كل موظف يمتلك اسم مستخدم فريد.`);
        return;
      }
      seenUsernames.add(u);
    }

    // Check username duplicates with existing system users
    const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));
    for (const usr of pendingStaff) {
      const u = usr.username.trim().toLowerCase();
      if (existingUsernames.has(u)) {
        alert(`اسم المستخدم (${usr.username}) مسجل مسبقاً في النظام لمستخدم آخر! يرجى اختيار اسم مستخدم مختلف.`);
        return;
      }
    }

    const result = addMultipleBranchesWithUsers(pendingBranches, false, pendingStaff);
    setShowStaffCustomizationModal(false);
    setCreationResult(result);
    setDraftRows([]);
  };

  // Inline Edit handlers
  const handleUpdateEditableBranch = (id: string, field: keyof Branch, value: any) => {
    setEditableBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const handleSaveAllInlineChanges = () => {
    editableBranches.forEach((eb) => {
      updateBranch(eb.id, eb);
    });
    setInlineSaveSuccess(true);
    setTimeout(() => setInlineSaveSuccess(false), 3000);
  };

  const handleGenerateDefaultStaffForExistingBranch = (branch: Branch) => {
    const defaultStaff = generateDefaultUsersForBranch(branch, defaultPassword);
    const affectedUsers: User[] = [];

    defaultStaff.forEach((usr) => {
      const existing = users.find((u) => u.username === usr.username);
      if (existing) {
        updateUser(existing.id, {
          name: usr.name,
          role: usr.role,
          branchId: branch.id,
          allowedBranchIds: [branch.id],
          password: defaultPassword,
          isActive: true,
          permissions: usr.permissions,
        });
        affectedUsers.push({
          ...existing,
          name: usr.name,
          role: usr.role,
          branchId: branch.id,
          allowedBranchIds: [branch.id],
          password: defaultPassword,
          isActive: true,
          permissions: usr.permissions,
        });
      } else {
        const created = addUser(usr);
        affectedUsers.push(created || usr);
      }
    });

    // Open creationResult modal immediately so all credentials and copy buttons appear in-app
    setCreationResult({
      createdBranches: [branch],
      createdUsers: affectedUsers,
    });
  };

  const confirmDeleteBranch = () => {
    if (!branchToDelete) return;
    const branchName = branchToDelete.name;
    const branchId = branchToDelete.id;
    deleteBranch(branchId);
    setEditableBranches((prev) => prev.filter((b) => b.id !== branchId));
    setBranchToDelete(null);
    setDeleteSuccessMessage(`تم حذف فرع (${branchName}) وإلغاء ارتباط كافة كوادره بنجاح.`);
    setTimeout(() => setDeleteSuccessMessage(null), 4000);
  };


  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shadow-inner">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">إدارة الفروع المجمعة وتوليد الكوادر</h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                إضافة مباشرة وسريعة
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              إضافة فروع متعددة دفعة واحدة كجدول، توليد حسابات المستخدمين الـ 4 تلقائياً، والتعديل المباشر
            </p>
          </div>
        </div>

        {onBackToGrid && (
          <button
            type="button"
            onClick={onBackToGrid}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-sm font-bold transition shadow-sm"
          >
            <span>العودة لبطاقات الفروع</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-xl max-w-xl">
        <button
          type="button"
          onClick={() => setActiveTab('bulk_add')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-sm transition ${
            activeTab === 'bulk_add'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>جدول إضافة الفروع دفعة واحدة</span>
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-900/40 font-mono">
            {draftRows.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inline_edit')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-sm transition ${
            activeTab === 'inline_edit'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>التعديل المباشر للفروع الحالية</span>
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-900/40 font-mono">
            {branches.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: BULK ADD TABLE */}
      {/* ========================================================= */}
      {activeTab === 'bulk_add' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-2 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة سطر فرع جديد</span>
              </button>

              {draftRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearDraftRows}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs font-medium rounded-xl transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تفريغ الجدول</span>
                </button>
              )}
            </div>

            {/* Auto Staff Options */}
            <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 px-4 py-2 rounded-xl">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoGenerateStaff}
                  onChange={(e) => setAutoGenerateStaff(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-900"
                />
                <span className="text-xs font-bold text-slate-200">
                  توليد الكوادر الـ 4 تلقائياً (مدير، صادر، وارد، صندوق)
                </span>
              </label>

              {autoGenerateStaff && (
                <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3 mr-1">
                  <span className="text-xs text-slate-400">كلمة المرور الافتراضية:</span>
                  <input
                    type="text"
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-700 text-cyan-300 text-xs font-mono font-bold px-2 py-1 rounded text-center"
                  />
                </div>
              )}
            </div>
          </div>

          {/* The Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold whitespace-nowrap">
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 min-w-[100px]">كود الفرع *</th>
                    <th className="p-3 min-w-[180px]">اسم الفرع *</th>
                    <th className="p-3 min-w-[120px]">المحافظة</th>
                    <th className="p-3 min-w-[110px]">النوع</th>
                    <th className="p-3 min-w-[180px]">الرئيسي التابع له</th>
                    <th className="p-3 min-w-[140px]">اسم المدير</th>
                    <th className="p-3 min-w-[110px]">الهاتف</th>
                    <th className="p-3 min-w-[200px]">العنوان التفصيلي</th>
                    <th className="p-3 min-w-[100px]">صندوق (ل.س)</th>
                    <th className="p-3 min-w-[80px]">صندوق ($)</th>
                    <th className="p-3 min-w-[80px]">عمولة شحن %</th>
                    <th className="p-3 min-w-[80px]">عمولة حوالات %</th>
                    <th className="p-3 w-12 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {draftRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-12 text-center text-slate-500">
                        <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30 text-cyan-400" />
                        <p className="text-sm font-bold text-slate-400">الجدول فارغ حالياً</p>
                        <p className="text-xs text-slate-500 mt-1">
                          اضغط على "إضافة سطر فرع جديد" أو "تعبئة تلقائية للمحافظات غير المضافة" للبدء
                        </p>
                      </td>
                    </tr>
                  ) : (
                    draftRows.map((row, index) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="p-2 text-center font-mono text-slate-500">
                          {index + 1}
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.code}
                            onChange={(e) => handleUpdateDraftRow(row.id, 'code', e.target.value)}
                            placeholder="DAM-02"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-cyan-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleUpdateDraftRow(row.id, 'name', e.target.value)}
                            placeholder="اسم الفرع أو المركز"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-white font-medium text-xs focus:border-cyan-500 focus:outline-none"
                            required
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.governorate}
                            onChange={(e) =>
                              handleUpdateDraftRow(row.id, 'governorate', e.target.value as Governorate)
                            }
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
                          >
                            {ALL_GOVERNORATES.map((gov) => (
                              <option key={gov} value={gov}>
                                {gov}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={row.type}
                            onChange={(e) => {
                              const newType = e.target.value as 'main_hub' | 'collection_point' | 'agent';
                              handleUpdateDraftRow(row.id, 'type', newType);
                              if (newType === 'main_hub') {
                                handleUpdateDraftRow(row.id, 'parentHubId', '');
                              }
                            }}
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-semibold"
                          >
                            <option value="main_hub">فرع رئيسي (شحن)</option>
                            <option value="collection_point">نقطة تجميع (عهدة)</option>
                            <option value="agent">مكتب وكيل (مقاصة)</option>
                          </select>
                        </td>
                        <td className="p-2">
                          {row.type === 'collection_point' ? (
                            <select
                              value={row.parentHubId || ''}
                              onChange={(e) =>
                                handleUpdateDraftRow(row.id, 'parentHubId', e.target.value)
                              }
                              className={`w-full bg-slate-950/90 border rounded-lg px-2 py-1.5 text-xs focus:outline-none font-medium ${
                                !row.parentHubId
                                  ? 'border-amber-500/70 text-amber-300 ring-1 ring-amber-500/30'
                                  : 'border-slate-700/80 text-cyan-300'
                              }`}
                              required
                            >
                              <option value="">-- اختر الرئيسي التابع له --</option>
                              {branches
                                .filter((b) => b.type === 'main_hub')
                                .map((hub) => (
                                  <option key={hub.id} value={hub.id}>
                                    {hub.name} ({hub.governorate})
                                  </option>
                                ))}
                              {draftRows
                                .filter(
                                  (dr) =>
                                    dr.id !== row.id &&
                                    dr.type === 'main_hub' &&
                                    (dr.name.trim() || dr.code.trim())
                                )
                                .map((dr) => (
                                  <option key={dr.id} value={dr.id}>
                                    [جدول الدفعة] {dr.name || dr.code} ({dr.governorate})
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-slate-500 block py-1.5 px-2 bg-slate-900/40 rounded-lg border border-slate-800 text-center select-none font-medium">
                              - رئيسي مستقل -
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.managerName}
                            onChange={(e) =>
                              handleUpdateDraftRow(row.id, 'managerName', e.target.value)
                            }
                            placeholder="اسم المدير"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:border-cyan-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.phone}
                            onChange={(e) => handleUpdateDraftRow(row.id, 'phone', e.target.value)}
                            placeholder="011-xxxxxxx"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-300 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.address}
                            onChange={(e) => handleUpdateDraftRow(row.id, 'address', e.target.value)}
                            placeholder="العنوان التفصيلي"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:border-cyan-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={row.initialSyp === 0 ? '' : row.initialSyp}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={blockNonAmountKeys}
                            onChange={(e) => {
                              const clean = sanitizeDecimal(e.target.value);
                              handleUpdateDraftRow(row.id, 'initialSyp', clean === '' ? 0 : Number(clean));
                            }}
                            placeholder="الرصيد ل.س"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-emerald-400 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={row.initialUsd === 0 ? '' : row.initialUsd}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={blockNonAmountKeys}
                            onChange={(e) => {
                              const clean = sanitizeDecimal(e.target.value);
                              handleUpdateDraftRow(row.id, 'initialUsd', clean === '' ? 0 : Number(clean));
                            }}
                            placeholder="الرصيد $"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-blue-400 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={row.commissionRateShipping === 0 ? '' : row.commissionRateShipping}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={blockNonAmountKeys}
                            onChange={(e) => {
                              const clean = sanitizeDecimal(e.target.value);
                              handleUpdateDraftRow(
                                row.id,
                                'commissionRateShipping',
                                clean === '' ? 0 : Number(clean)
                              );
                            }}
                            placeholder="نسبة الشحن %"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={row.commissionRateTransfers === 0 ? '' : row.commissionRateTransfers}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={blockNonAmountKeys}
                            onChange={(e) => {
                              const clean = sanitizeDecimal(e.target.value);
                              handleUpdateDraftRow(
                                row.id,
                                'commissionRateTransfers',
                                clean === '' ? 0 : Number(clean)
                              );
                            }}
                            placeholder="نسبة الحوالات %"
                            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftRow(row.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            title="حذف هذا السطر"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Submit Bar */}
            {draftRows.length > 0 && (
              <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>
                    عدد الفروع في الجدول:{' '}
                    <strong className="text-cyan-400 font-mono text-sm">{draftRows.length}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    الكوادر المتوقع توليدها:{' '}
                    <strong className="text-emerald-400 font-mono text-sm">
                      {autoGenerateStaff ? draftRows.filter((r) => r.code.trim() || r.name.trim()).length * 4 : 0}
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleStartBulkAddReview}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition transform active:scale-95 cursor-pointer"
                >
                  <Users className="w-5 h-5" />
                  <span>حفظ وإضافة كافة الفروع وتوليد الكوادر</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: INLINE EDIT TABLE FOR EXISTING BRANCHES */}
      {/* ========================================================= */}
      {activeTab === 'inline_edit' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">التعديل المباشر للفروع الحالية وإدارة الكوادر</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[11px] font-bold">
                  {editableBranches.length} فرع
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                يمكنك تعديل بيانات أي فرع مباشرة وحفظها، أو توليد الكوادر الـ 4 الافتراضية، أو حذف الفرع
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {inlineSaveSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم حفظ كافة التعديلات بنجاح!</span>
                </div>
              )}

              {deleteSuccessMessage && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{deleteSuccessMessage}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400">كلمة سر الكوادر:</span>
                <input
                  type="text"
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-cyan-300 font-mono text-center focus:outline-none focus:border-cyan-500"
                  title="كلمة المرور الافتراضية عند توليد الكوادر"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveAllInlineChanges}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات المباشرة لكافة الفروع</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold whitespace-nowrap">
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 min-w-[100px]">الكود</th>
                    <th className="p-3 min-w-[200px]">اسم الفرع</th>
                    <th className="p-3 min-w-[120px]">المحافظة</th>
                    <th className="p-3 min-w-[110px]">النوع</th>
                    <th className="p-3 min-w-[170px]">الرئيسي التابع له</th>
                    <th className="p-3 min-w-[140px]">المدير المسؤول</th>
                    <th className="p-3 min-w-[120px]">الهاتف</th>
                    <th className="p-3 min-w-[200px]">العنوان</th>
                    <th className="p-3 min-w-[90px]">عمولة شحن %</th>
                    <th className="p-3 min-w-[90px]">عمولة حوالة %</th>
                    <th className="p-3 min-w-[90px]">الحالة</th>
                    <th className="p-3 min-w-[260px] text-center">الكوادر والعمليات المتاحة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {editableBranches.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.code}
                          onChange={(e) => handleUpdateEditableBranch(b.id, 'code', e.target.value)}
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-cyan-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.name}
                          onChange={(e) => handleUpdateEditableBranch(b.id, 'name', e.target.value)}
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-white font-medium text-xs focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={b.governorate}
                          onChange={(e) =>
                            handleUpdateEditableBranch(
                              b.id,
                              'governorate',
                              e.target.value as Governorate
                            )
                          }
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
                        >
                          {ALL_GOVERNORATES.map((gov) => (
                            <option key={gov} value={gov}>
                              {gov}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={b.type}
                          onChange={(e) => {
                            const newType = e.target.value as 'main_hub' | 'collection_point' | 'agent';
                            handleUpdateEditableBranch(b.id, 'type', newType);
                            if (newType === 'main_hub') {
                              handleUpdateEditableBranch(b.id, 'parentHubId', undefined);
                            }
                          }}
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-semibold"
                        >
                          <option value="main_hub">فرع رئيسي (شحن)</option>
                          <option value="collection_point">نقطة تجميع (عهدة)</option>
                          <option value="agent">مكتب وكيل (مقاصة)</option>
                        </select>
                      </td>
                      <td className="p-2">
                        {b.type === 'collection_point' ? (
                          <select
                            value={b.parentHubId || ''}
                            onChange={(e) =>
                              handleUpdateEditableBranch(b.id, 'parentHubId', e.target.value)
                            }
                            className={`w-full bg-slate-950/70 border rounded px-2 py-1 text-xs focus:outline-none ${
                              !b.parentHubId
                                ? 'border-amber-500/80 text-amber-300'
                                : 'border-slate-700/80 text-cyan-300'
                            }`}
                          >
                            <option value="">-- اختر الرئيسي التابع له --</option>
                            {editableBranches
                              .filter((h) => h.id !== b.id && h.type === 'main_hub')
                              .map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name} ({h.governorate})
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="text-[11px] text-slate-500 block py-1 px-2 bg-slate-900/40 rounded border border-slate-800 text-center select-none font-medium">
                            - رئيسي مستقل -
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.managerName}
                          onChange={(e) =>
                            handleUpdateEditableBranch(b.id, 'managerName', e.target.value)
                          }
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-slate-300 text-xs focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.phone}
                          onChange={(e) =>
                            handleUpdateEditableBranch(b.id, 'phone', e.target.value)
                          }
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-slate-300 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.address}
                          onChange={(e) =>
                            handleUpdateEditableBranch(b.id, 'address', e.target.value)
                          }
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-slate-300 text-xs focus:border-cyan-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={b.commissionRateShipping === 0 ? '' : b.commissionRateShipping}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={blockNonAmountKeys}
                          onChange={(e) => {
                            const clean = sanitizeDecimal(e.target.value);
                            handleUpdateEditableBranch(
                              b.id,
                              'commissionRateShipping',
                              clean === '' ? 0 : Number(clean)
                            );
                          }}
                          placeholder="نسبة الشحن %"
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={b.commissionRateTransfers === 0 ? '' : b.commissionRateTransfers}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={blockNonAmountKeys}
                          onChange={(e) => {
                            const clean = sanitizeDecimal(e.target.value);
                            handleUpdateEditableBranch(
                              b.id,
                              'commissionRateTransfers',
                              clean === '' ? 0 : Number(clean)
                            );
                          }}
                          placeholder="نسبة الحوالات %"
                          className="w-full bg-slate-950/70 border border-slate-700/80 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateEditableBranch(b.id, 'isActive', !b.isActive)}
                          className={`w-full px-2 py-1 rounded text-[11px] font-bold transition ${
                            b.isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {b.isActive ? 'نشط' : 'معطل'}
                        </button>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* عدد الكوادر الحالية */}
                          <span
                            className="text-[10px] px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono font-bold"
                            title="عدد الكوادر المسجلة لهذا الفرع حالياً"
                          >
                            {users.filter((u) => u.branchId === b.id && u.role !== 'super_admin').length} كوادر
                          </span>

                          {/* زر توليد الكوادر الأربعة */}
                          <button
                            type="button"
                            onClick={() => handleGenerateDefaultStaffForExistingBranch(b)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-300 hover:text-white border border-cyan-700/60 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                            title="توليد أو استعادة الحسابات الـ 4 الافتراضية لهذا الفرع وإظهار بيانات الدخول"
                          >
                            <Users className="w-3.5 h-3.5 text-cyan-400" />
                            <span>توليد الكوادر الـ 4</span>
                          </button>

                          {/* زر حذف الفرع */}
                          <button
                            type="button"
                            onClick={() => setBranchToDelete(b)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 hover:text-white border border-rose-800/60 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                            title="حذف هذا الفرع مع تأكيد مسبق"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>حذف الفرع</span>
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



      {/* ========================================================= */}
      {/* SUCCESS REPORT MODAL (After Bulk Creation) */}
      {/* ========================================================= */}
      {creationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-cyan-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    تم إنشاء الفروع وتوليد الكوادر بنجاح!
                  </h3>
                  <p className="text-xs text-slate-400">
                    تمت إضافة ({creationResult.createdBranches.length}) فروع جديدة، وتوليد (
                    {creationResult.createdUsers.length}) حساب مستخدم تلقائياً
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreationResult(null)}
                className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/60 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {/* Branches summary */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  الفروع التي تمت إضافتها:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {creationResult.createdBranches.map((br) => (
                    <div
                      key={br.id}
                      className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs"
                    >
                      <div className="font-bold text-white">{br.name}</div>
                      <div className="flex items-center justify-between text-slate-400 text-[11px] mt-1">
                        <span className="font-mono text-cyan-400">{br.code}</span>
                        <span
                          className={
                            br.type === 'main_hub'
                              ? 'text-amber-400 font-bold'
                              : 'text-indigo-300 font-semibold'
                          }
                        >
                          {br.type === 'main_hub'
                            ? 'رئيسي'
                            : `فرعي (تابع لـ: ${
                                creationResult.createdBranches.find((p) => p.id === br.parentHubId)?.name ||
                                branches.find((p) => p.id === br.parentHubId)?.name ||
                                'الرئيسي'
                              })`}
                        </span>
                        <span>{br.governorate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Users table */}
              {creationResult.createdUsers.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      بيانات تسجيل الدخول للكوادر الجديدة:
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">
                      كلمة المرور لجميع الحسابات:{' '}
                      <strong className="text-white">{defaultPassword}</strong>
                    </span>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="p-2.5">المسمى الوظيفي</th>
                          <th className="p-2.5">الدور</th>
                          <th className="p-2.5">اسم المستخدم (Username)</th>
                          <th className="p-2.5">كلمة المرور</th>
                          <th className="p-2.5 text-center">نسخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {creationResult.createdUsers.map((usr) => (
                          <tr key={usr.id} className="hover:bg-slate-800/30">
                            <td className="p-2.5 font-bold text-white">{usr.name}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                                {usr.role === 'hub_manager'
                                  ? 'مدير فرع'
                                  : usr.role === 'outbound_operator'
                                  ? 'مسؤول صادر'
                                  : usr.role === 'inbound_operator'
                                  ? 'مسؤول وارد'
                                  : 'أمين صندوق'}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono text-cyan-400">{usr.username}</td>
                            <td className="p-2.5 font-mono text-slate-300">{usr.password}</td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(
                                    `المستخدم: ${usr.username} | كلمة المرور: ${usr.password} | ${usr.name}`,
                                    usr.id
                                  )
                                }
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                                title="نسخ بيانات الدخول"
                              >
                                {copiedId === usr.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreationResult(null)}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                تم، متابعة العمل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Save Staff Customization Modal */}
      {showStaffCustomizationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">
                      مراجعة وتعديل بيانات الكوادر وكلمات السر قبل الحفظ النهائي
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      مراجعة ما قبل الاعتماد
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    يمكنك هنا تخصيص الاسم، اسم المستخدم (Username)، كلمة المرور، الهاتف، والدور الوظيفي لكل كادر قبل اعتماد الفروع نهائياً.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowStaffCustomizationModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="إغلاق والعودة لجدول الفروع"
              >
                ✕
              </button>
            </div>

            {/* Quick Bulk Password Bar */}
            <div className="px-5 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>تطبيق كلمة مرور موحدة لكافة الكوادر:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={bulkPasswordInput}
                    onChange={(e) => setBulkPasswordInput(e.target.value)}
                    placeholder="كلمة المرور"
                    className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono font-bold focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBulkPassword}
                    className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    تطبيق على الجميع
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 font-mono">
                  عدد الفروع: <strong className="text-cyan-400">{pendingBranches.length}</strong>
                </span>
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700 font-mono">
                  إجمالي الكوادر: <strong className="text-emerald-400">{pendingStaff.length}</strong>
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {pendingBranches.map((branch, bIdx) => {
                const branchStaff = pendingStaff.filter((u) => u.branchId === branch.id);
                return (
                  <div
                    key={branch.id}
                    className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-inner"
                  >
                    {/* Branch Title Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-xs">
                          {bIdx + 1}
                        </div>
                        <span className="text-sm font-bold text-white">{branch.name}</span>
                        <span className="text-xs font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                          {branch.code}
                        </span>
                        <span className="text-xs text-slate-300">
                          ({branch.governorate} •{' '}
                          {branch.type === 'main_hub' ? (
                            <span className="text-amber-400 font-bold">رئيسي</span>
                          ) : (
                            <span className="text-indigo-300 font-semibold">
                              فرعي
                              {(() => {
                                const parent =
                                  pendingBranches.find((p) => p.id === branch.parentHubId) ||
                                  branches.find((p) => p.id === branch.parentHubId);
                                return parent ? ` (تابع لـ: ${parent.name})` : '';
                              })()}
                            </span>
                          )}
                          )
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddStaffToBranch(branch.id)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة كادر آخر لهذا الفرع</span>
                      </button>
                    </div>

                    {/* Staff Table */}
                    {branchStaff.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-500">
                        لا يوجد كوادر مسجلة لهذا الفرع حالياً. يمكنك الضغط على "إضافة كادر آخر لهذا الفرع".
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-800/80 font-bold">
                              <th className="p-2 w-8 text-center">#</th>
                              <th className="p-2 min-w-[150px]">الاسم الكامل / المسمى</th>
                              <th className="p-2 min-w-[130px]">اسم المستخدم (Username)</th>
                              <th className="p-2 min-w-[110px]">كلمة المرور</th>
                              <th className="p-2 min-w-[110px]">الهاتف</th>
                              <th className="p-2 min-w-[130px]">الدور / الصلاحية</th>
                              <th className="p-2 w-10 text-center">حذف</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {branchStaff.map((usr, uIdx) => (
                              <tr key={usr.id} className="hover:bg-slate-900/40">
                                <td className="p-2 text-center text-slate-500 font-mono">
                                  {uIdx + 1}
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={usr.name}
                                    onChange={(e) =>
                                      handleUpdatePendingUser(usr.id, { name: e.target.value })
                                    }
                                    placeholder="اسم الموظف"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-medium text-xs focus:border-cyan-500 focus:outline-none"
                                    required
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={usr.username}
                                    onChange={(e) =>
                                      handleUpdatePendingUser(usr.id, {
                                        username: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                                      })
                                    }
                                    placeholder="username"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-cyan-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                                    required
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={usr.password || ''}
                                    onChange={(e) =>
                                      handleUpdatePendingUser(usr.id, { password: e.target.value })
                                    }
                                    placeholder="كلمة المرور"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-amber-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                                    required
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="tel"
                                    value={usr.phone || ''}
                                    onKeyDown={blockNonPhoneKeys}
                                    onChange={(e) =>
                                      handleUpdatePendingUser(usr.id, { phone: sanitizePhone(e.target.value) })
                                    }
                                    placeholder="09xxxxxxxx"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 font-mono text-xs focus:border-cyan-500 focus:outline-none text-left"
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={usr.role}
                                    onChange={(e) =>
                                      handleUpdatePendingUser(usr.id, {
                                        role: e.target.value as UserRole,
                                        permissions: getDefaultPermissionsForRole(e.target.value as UserRole),
                                      })
                                    }
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
                                  >
                                    <option value="hub_manager">مدير فرع</option>
                                    <option value="outbound_operator">مسؤول صادر</option>
                                    <option value="inbound_operator">مسؤول وارد</option>
                                    <option value="cashier">أمين صندوق</option>
                                    <option value="courier">مندوب توزيع محلي</option>
                                    <option value="driver">سائق شاحنة</option>
                                    <option value="reception_data_entry">مدخل بيانات</option>
                                    <option value="warehouse_keeper">أمين مستودع</option>
                                  </select>
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePendingUser(usr.id)}
                                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                    title="حذف هذا الحساب"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowStaffCustomizationModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                الرجوع لتعديل جدول الفروع
              </button>

              <button
                type="button"
                onClick={handleConfirmFinalSave}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  تأكيد الحفظ النهائي للفروع والكوادر ({pendingBranches.length} فرع • {pendingStaff.length} كادر)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Branch Delete */}
      {branchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-rose-600/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-rose-950/90 to-slate-900 border-b border-rose-900/50 flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">تأكيد حذف الفرع نهائياً</h3>
                <p className="text-xs text-rose-300/80">عملية حساسة لحذف بطاقة الفرع وحسابات كوادره</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>اسم الفرع المستهدف:</span>
                  <span className="font-bold text-white text-sm">{branchToDelete.name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>كود الفرع والمحافظة:</span>
                  <span className="font-mono text-cyan-400 font-bold">{branchToDelete.code} • {branchToDelete.governorate}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>عدد حسابات الكوادر التابعة التي ستُحذف معه:</span>
                  <span className="font-bold text-rose-400 font-mono px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/60">
                    {users.filter((u) => u.branchId === branchToDelete.id && u.role !== 'super_admin').length} حساب موظف
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200/90 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>ملاحظة أمان:</strong> حساب المدير التنفيذي العام غير مرتبط بأي فرع ويبقى آمناً تماماً ولا يتأثر بأي عملية حذف للفروع.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBranchToDelete(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteBranch}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد الحذف النهائي للفرع</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
