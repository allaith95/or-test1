import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
  Loader2,
  Check,
  ShieldCheck,
  Phone,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  History,
  X,
  UserPlus,
  Layers,
  Percent,
  Truck,
} from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import { Branch, Governorate, User as UserType, UserRole } from '../types';
import { loadSavedVpsConfig } from '../services/vpsClient';

export interface StaffDraft {
  id?: string;
  role: UserRole;
  roleTitle?: string;
  name: string;
  username: string;
  password: string;
  phone: string;
  isCustomRole?: boolean;
}

export interface BranchDraft {
  id: string;
  code: string;
  name: string;
  governorate: Governorate;
  address: string;
  phone: string;
  managerName: string;
  type: 'main_hub' | 'collection_point' | 'agent';
  isExistingInDb?: boolean;
  staff: {
    hub_manager: StaffDraft;
    inbound_operator: StaffDraft;
    outbound_operator: StaffDraft;
  };
  extraStaff: StaffDraft[];
}

const AVAILABLE_EXTRA_ROLES: Array<{ role: UserRole; title: string; desc: string }> = [
  { role: 'cashier', title: 'أمين صندوق / كاشير', desc: 'استلام المقبوضات وصناديق الحوالات' },
  { role: 'courier', title: 'مندوب / موزع ميداني', desc: 'توزيع وتسليم الشحنات للمستلمين' },
  { role: 'warehouse_keeper', title: 'أمين مستودع ورفوف', desc: 'إدارة مخزون الطرود والرفوف' },
  { role: 'accountant', title: 'محاسب مالي', desc: 'مطابقة المقاصات وسندات الفروع' },
  { role: 'operations', title: 'مسؤول عمليات', desc: 'متابعة حركة الأسطول والمنافيستات' },
];

export const UnifiedBranchUserManager: React.FC = () => {
  const {
    branches,
    users,
    addBranch,
    updateBranch,
    deleteBranch,
    addUser,
    updateUser,
    currentUser,
    setCurrentBranch,
  } = useOrca();

  const [branchDrafts, setBranchDrafts] = useState<BranchDraft[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [isDraftDirty, setIsDraftDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Auto-Save Draft recovery state
  const [hasSavedDraftInStorage, setHasSavedDraftInStorage] = useState<boolean>(false);
  const [showDraftRecoveryModal, setShowDraftRecoveryModal] = useState<boolean>(false);
  const [draftSavedTimestamp, setDraftSavedTimestamp] = useState<string | null>(null);

  // Extra Role Menu Popover
  const [showAddRoleMenu, setShowAddRoleMenu] = useState<boolean>(false);

  // 1. Initial Data Population from Context & Check LocalStorage for auto-save draft
  useEffect(() => {
    // Check if there is an unsaved draft in localStorage
    try {
      const savedRaw = localStorage.getItem('orca_branches_draft');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed && Array.isArray(parsed.drafts) && parsed.drafts.length > 0) {
          setHasSavedDraftInStorage(true);
          setDraftSavedTimestamp(
            parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString('ar-SY') : null
          );
        }
      }
    } catch {}

    if (branches && branches.length > 0) {
      const initialDrafts: BranchDraft[] = branches.map((b) => {
        const branchUsers = users.filter((u) => u.branchId === b.id);

        const mgrUser = branchUsers.find((u) => u.role === 'hub_manager');
        const inUser = branchUsers.find(
          (u) =>
            u.role === 'inbound_operator' ||
            u.role === 'reception_data_entry' ||
            u.role === 'warehouse_keeper'
        );
        const outUser = branchUsers.find(
          (u) =>
            u.role === 'outbound_operator' ||
            u.role === 'cashier' ||
            u.role === 'operations'
        );

        // Find extra staff beyond the 3 primary roles
        const primaryIds = new Set([mgrUser?.id, inUser?.id, outUser?.id].filter(Boolean));
        const extraUsers = branchUsers.filter((u) => !primaryIds.has(u.id));

        const cleanCode = (b.code || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'hub';

        return {
          id: b.id,
          code: b.code || '',
          name: b.name || '',
          governorate: (b.governorate as Governorate) || 'دمشق',
          address: b.address || '',
          phone: b.phone || '',
          managerName: b.managerName || '',
          type: (b.type as any) || 'main_hub',
          isExistingInDb: true,
          staff: {
            hub_manager: {
              id: mgrUser?.id,
              role: 'hub_manager',
              name: mgrUser?.name || b.managerName || '',
              username: mgrUser?.username || `mgr_${cleanCode}`,
              password: mgrUser?.password || '123456',
              phone: mgrUser?.phone || b.phone || '',
            },
            inbound_operator: {
              id: inUser?.id,
              role: 'inbound_operator',
              name: inUser?.name || '',
              username: inUser?.username || `in_${cleanCode}`,
              password: inUser?.password || '123456',
              phone: inUser?.phone || '',
            },
            outbound_operator: {
              id: outUser?.id,
              role: 'outbound_operator',
              name: outUser?.name || '',
              username: outUser?.username || `out_${cleanCode}`,
              password: outUser?.password || '123456',
              phone: outUser?.phone || '',
            },
          },
          extraStaff: extraUsers.map((eu) => ({
            id: eu.id,
            role: eu.role,
            roleTitle: eu.role,
            name: eu.name,
            username: eu.username,
            password: eu.password || '123456',
            phone: eu.phone || '',
            isCustomRole: true,
          })),
        };
      });

      setBranchDrafts(initialDrafts);
      if (!selectedBranchId && initialDrafts.length > 0) {
        setSelectedBranchId(initialDrafts[0].id);
      }
    } else if (branchDrafts.length === 0) {
      // Create initial clean draft branch if 0 exist
      const newId = `br_dam_${Date.now()}`;
      const defaultDraft: BranchDraft = {
        id: newId,
        code: 'DAM-MAIN',
        name: 'المركز الرئيسي - دمشق',
        governorate: 'دمشق',
        address: 'المركز اللوجستي العام',
        phone: '0112233445',
        managerName: 'أحمد محمد',
        type: 'main_hub',
        isExistingInDb: false,
        staff: {
          hub_manager: {
            role: 'hub_manager',
            name: 'أحمد محمد',
            username: 'ahmed_dam',
            password: '123456',
            phone: '0944112233',
          },
          inbound_operator: {
            role: 'inbound_operator',
            name: 'سامر وارد',
            username: 'samer_in_dam',
            password: '123456',
            phone: '0944112234',
          },
          outbound_operator: {
            role: 'outbound_operator',
            name: 'وسيم صادر',
            username: 'waseem_out_dam',
            password: '123456',
            phone: '0944112235',
          },
        },
        extraStaff: [],
      };
      setBranchDrafts([defaultDraft]);
      setSelectedBranchId(newId);
    }
  }, [branches, users]);

  // 2. Auto-Save Draft to LocalStorage every 30 Seconds if Draft is Dirty
  useEffect(() => {
    if (!isDraftDirty || branchDrafts.length === 0) return;

    const timer = setInterval(() => {
      try {
        localStorage.setItem(
          'orca_branches_draft',
          JSON.stringify({
            drafts: branchDrafts,
            timestamp: Date.now(),
          })
        );
      } catch (err) {
        console.warn('[AutoSave] Local storage draft failed:', err);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(timer);
  }, [isDraftDirty, branchDrafts]);

  // Handler to Restore Draft from LocalStorage
  const handleRestoreDraftFromStorage = () => {
    try {
      const raw = localStorage.getItem('orca_branches_draft');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.drafts) && parsed.drafts.length > 0) {
          setBranchDrafts(parsed.drafts);
          setSelectedBranchId(parsed.drafts[0].id);
          setIsDraftDirty(true);
          setShowDraftRecoveryModal(false);
          setSaveSuccessMsg('تمت استعادة المسودة المحفوظة بنجاح!');
          setTimeout(() => setSaveSuccessMsg(null), 3000);
        }
      }
    } catch {
      alert('تعذر قراءة المسودة المحفوظة');
    }
  };

  // Handler to Dismiss Draft
  const handleDismissDraftStorage = () => {
    localStorage.removeItem('orca_branches_draft');
    setHasSavedDraftInStorage(false);
    setShowDraftRecoveryModal(false);
  };

  const activeDraft = branchDrafts.find((b) => b.id === selectedBranchId) || branchDrafts[0];

  // Helper to validate staff draft
  const validateStaffDraft = (s: StaffDraft) => {
    const errors: string[] = [];
    if (!s.name || s.name.trim().length < 2) errors.push('الاسم يجب أن يكون حرفين على الأقل');
    if (!s.username || s.username.trim().length < 3) errors.push('المستخدم يجب أن يكون 3 أحرف على الأقل');
    if (!s.password || s.password.length < 6) errors.push('كلمة السر يجب أن تكون 6 أحرف على الأقل');
    if (s.phone && s.phone.trim().length > 0 && !/^[0-9+\s-]{7,15}$/.test(s.phone.trim())) {
      errors.push('رقم الهاتف غير صالح');
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // Helper to validate branch
  const validateBranchDraft = (b: BranchDraft) => {
    const errors: string[] = [];
    if (!b.name || b.name.trim().length < 2) errors.push('اسم الفرع يجب أن يكون حرفين على الأقل');
    if (!b.code || b.code.trim().length < 2) errors.push('كود الفرع يجب أن يكون حرفين على الأقل');

    // Check code duplicate against other drafts
    const duplicateCode = branchDrafts.some(
      (other) => other.id !== b.id && other.code.trim().toUpperCase() === b.code.trim().toUpperCase()
    );
    if (duplicateCode) errors.push(`كود الفرع (${b.code}) مستخدم لفرع آخر في المسودة`);

    // Validate 3 primary roles
    const s1Val = validateStaffDraft(b.staff.hub_manager);
    const s2Val = validateStaffDraft(b.staff.inbound_operator);
    const s3Val = validateStaffDraft(b.staff.outbound_operator);

    const filledCount =
      (s1Val.isValid ? 1 : 0) + (s2Val.isValid ? 1 : 0) + (s3Val.isValid ? 1 : 0);

    const isAllValid = errors.length === 0 && s1Val.isValid && s2Val.isValid && s3Val.isValid;

    return {
      isValid: isAllValid,
      branchErrors: errors,
      s1Errors: s1Val.errors,
      s2Errors: s2Val.errors,
      s3Errors: s3Val.errors,
      filledCount,
      totalPrimary: 3,
    };
  };

  // Handler to add a new branch draft
  const handleAddNewBranchDraft = () => {
    const govCount = branchDrafts.length + 1;
    const govList: Governorate[] = ['حلب', 'حمص', 'اللاذقية', 'حماة', 'طرطوس', 'درعا', 'السويداء'];
    const chosenGov = govList[(govCount - 1) % govList.length];
    const codeTag = chosenGov === 'حلب' ? 'ALP' : chosenGov === 'حمص' ? 'HMS' : `HUB${govCount}`;
    const newId = `br_${codeTag.toLowerCase()}_${Date.now()}`;

    const newDraft: BranchDraft = {
      id: newId,
      code: `${codeTag}-HUB`,
      name: `فرع ${chosenGov}`,
      governorate: chosenGov,
      address: `المركز اللوجستي - ${chosenGov}`,
      phone: `0${govCount}1234567`,
      managerName: '',
      type: 'main_hub',
      isExistingInDb: false,
      staff: {
        hub_manager: {
          role: 'hub_manager',
          name: '',
          username: `mgr_${codeTag.toLowerCase()}`,
          password: '123456',
          phone: '',
        },
        inbound_operator: {
          role: 'inbound_operator',
          name: '',
          username: `in_${codeTag.toLowerCase()}`,
          password: '123456',
          phone: '',
        },
        outbound_operator: {
          role: 'outbound_operator',
          name: '',
          username: `out_${codeTag.toLowerCase()}`,
          password: '123456',
          phone: '',
        },
      },
      extraStaff: [],
    };

    setBranchDrafts((prev) => [...prev, newDraft]);
    setSelectedBranchId(newId);
    setIsDraftDirty(true);
  };

  // Handler to update branch basic fields
  const handleUpdateBranchField = (branchId: string, field: keyof BranchDraft, value: any) => {
    setBranchDrafts((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, [field]: value } : b))
    );
    setIsDraftDirty(true);
  };

  // Handler to update a primary staff field
  const handleUpdateStaffField = (
    branchId: string,
    roleKey: 'hub_manager' | 'inbound_operator' | 'outbound_operator',
    field: keyof StaffDraft,
    value: string
  ) => {
    setBranchDrafts((prev) =>
      prev.map((b) => {
        if (b.id !== branchId) return b;
        const updatedStaffRole = {
          ...b.staff[roleKey],
          [field]: value,
        };
        const updatedStaff = {
          ...b.staff,
          [roleKey]: updatedStaffRole,
        };
        const managerName = roleKey === 'hub_manager' && field === 'name' ? value : b.managerName;
        return {
          ...b,
          managerName,
          staff: updatedStaff,
        };
      })
    );
    setIsDraftDirty(true);
  };

  // Handler to add an Extra Staff Role to active branch
  const handleAddExtraRole = (roleItem: { role: UserRole; title: string }) => {
    if (!activeDraft) return;
    const cleanCode = (activeDraft.code || 'hub').toLowerCase().replace(/[^a-z0-9]/g, '');
    const newExtra: StaffDraft = {
      id: `usr_${roleItem.role}_${activeDraft.id}_${Date.now()}`,
      role: roleItem.role,
      roleTitle: roleItem.title,
      name: '',
      username: `${roleItem.role.slice(0, 4)}_${cleanCode}_${activeDraft.extraStaff.length + 1}`,
      password: '123456',
      phone: '',
      isCustomRole: true,
    };

    setBranchDrafts((prev) =>
      prev.map((b) =>
        b.id === activeDraft.id ? { ...b, extraStaff: [...b.extraStaff, newExtra] } : b
      )
    );
    setShowAddRoleMenu(false);
    setIsDraftDirty(true);
  };

  // Handler to update an extra staff role
  const handleUpdateExtraStaffField = (
    branchId: string,
    extraStaffId: string,
    field: keyof StaffDraft,
    value: string
  ) => {
    setBranchDrafts((prev) =>
      prev.map((b) => {
        if (b.id !== branchId) return b;
        const nextExtras = b.extraStaff.map((es) =>
          (es.id === extraStaffId || es.username === extraStaffId) ? { ...es, [field]: value } : es
        );
        return { ...b, extraStaff: nextExtras };
      })
    );
    setIsDraftDirty(true);
  };

  // Handler to remove an extra staff role
  const handleRemoveExtraStaff = (branchId: string, extraStaffId: string) => {
    setBranchDrafts((prev) =>
      prev.map((b) => {
        if (b.id !== branchId) return b;
        return {
          ...b,
          extraStaff: b.extraStaff.filter((es) => es.id !== extraStaffId && es.username !== extraStaffId),
        };
      })
    );
    setIsDraftDirty(true);
  };

  // Handler to delete a branch draft
  const handleDeleteBranchDraft = (branchId: string) => {
    const target = branchDrafts.find((b) => b.id === branchId);
    if (!target) return;

    if (window.confirm(`هل أنت متأكد من حذف فرع "${target.name}" وكافة حسابات موظفيه؟`)) {
      if (target.isExistingInDb) {
        deleteBranch(branchId);
      }
      setBranchDrafts((prev) => {
        const next = prev.filter((b) => b.id !== branchId);
        if (selectedBranchId === branchId && next.length > 0) {
          setSelectedBranchId(next[0].id);
        }
        return next;
      });
      setIsDraftDirty(true);
    }
  };

  // 3. Save Single Branch (Per-Branch Save)
  const handleSaveSingleBranch = async (branchDraft: BranchDraft) => {
    const validation = validateBranchDraft(branchDraft);
    if (!validation.isValid) {
      alert(`يرجى استكمال الحقول المطلوبة لفرع [${branchDraft.name}]:\n` + [
        ...validation.branchErrors,
        ...validation.s1Errors,
        ...validation.s2Errors,
        ...validation.s3Errors,
      ].join('\n'));
      return;
    }

    setIsSaving(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const payloadBranch: Branch = {
        id: branchDraft.id,
        code: branchDraft.code.trim().toUpperCase(),
        name: branchDraft.name.trim(),
        type: branchDraft.type,
        governorate: branchDraft.governorate,
        address: branchDraft.address,
        phone: branchDraft.phone,
        managerName: branchDraft.staff.hub_manager.name || branchDraft.name,
        commissionRateShipping: 10,
        commissionRateTransfers: 1,
        boxSypBalance: 0,
        boxUsdBalance: 0,
        isActive: true,
      };

      const payloadUsers: any[] = [
        {
          id: branchDraft.staff.hub_manager.id || `usr_mgr_${branchDraft.id}`,
          name: branchDraft.staff.hub_manager.name.trim(),
          username: branchDraft.staff.hub_manager.username.trim(),
          password: branchDraft.staff.hub_manager.password.trim(),
          phone: branchDraft.staff.hub_manager.phone.trim(),
          role: 'hub_manager',
          branchId: branchDraft.id,
          allowedBranchIds: [branchDraft.id],
          canSwitchBranches: true,
          isActive: true,
        },
        {
          id: branchDraft.staff.inbound_operator.id || `usr_in_${branchDraft.id}`,
          name: branchDraft.staff.inbound_operator.name.trim(),
          username: branchDraft.staff.inbound_operator.username.trim(),
          password: branchDraft.staff.inbound_operator.password.trim(),
          phone: branchDraft.staff.inbound_operator.phone.trim(),
          role: 'inbound_operator',
          branchId: branchDraft.id,
          allowedBranchIds: [branchDraft.id],
          canSwitchBranches: false,
          isActive: true,
        },
        {
          id: branchDraft.staff.outbound_operator.id || `usr_out_${branchDraft.id}`,
          name: branchDraft.staff.outbound_operator.name.trim(),
          username: branchDraft.staff.outbound_operator.username.trim(),
          password: branchDraft.staff.outbound_operator.password.trim(),
          phone: branchDraft.staff.outbound_operator.phone.trim(),
          role: 'outbound_operator',
          branchId: branchDraft.id,
          allowedBranchIds: [branchDraft.id],
          canSwitchBranches: false,
          isActive: true,
        },
      ];

      // Append extra staff
      branchDraft.extraStaff.forEach((es) => {
        if (es.name.trim() || es.username.trim()) {
          payloadUsers.push({
            id: es.id || `usr_${es.role}_${branchDraft.id}_${Date.now()}`,
            name: es.name.trim() || `موظف ${es.role}`,
            username: es.username.trim(),
            password: es.password.trim() || '123456',
            phone: es.phone.trim(),
            role: es.role,
            branchId: branchDraft.id,
            allowedBranchIds: [branchDraft.id],
            canSwitchBranches: es.role === 'hub_manager',
            isActive: true,
          });
        }
      });

      // Update Local Orca Context
      addBranch(payloadBranch);
      payloadUsers.forEach((u) => addUser(u));

      // Attempt Backend Sync
      const vpsConfig = loadSavedVpsConfig();
      const endpoint = vpsConfig?.serverUrl
        ? `${vpsConfig.serverUrl.trim().replace(/\/+$/, '')}/api/admin/branches-and-users/bulk-save`
        : '/api/admin/branches-and-users/bulk-save';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branches: [payloadBranch],
          users: payloadUsers,
          requesterRole: currentUser?.role || 'super_admin',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          // Mark branch as existing in DB
          setBranchDrafts((prev) =>
            prev.map((b) => (b.id === branchDraft.id ? { ...b, isExistingInDb: true } : b))
          );
          setSaveSuccessMsg(`تم حفظ بيانات فرع [${payloadBranch.name}] ومستخدميه الـ (${payloadUsers.length}) بنجاح!`);
          setTimeout(() => setSaveSuccessMsg(null), 3500);
        } else {
          setSaveErrorMsg(json.error || 'فشل حفظ الفرع على السيرفر');
        }
      } else {
        const json = await res.json().catch(() => null);
        setSaveErrorMsg(json?.error || 'فشل حفظ الفرع');
      }
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'حدث خطأ أثناء حفظ الفرع');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Bulk Save All Branches and Users
  const handleBulkSaveAll = async () => {
    if (branchDrafts.length === 0) return;

    // Validate all drafts
    for (const draft of branchDrafts) {
      const v = validateBranchDraft(draft);
      if (!v.isValid) {
        alert(`يرجى تصحيح الأخطاء في فرع [${draft.name}]:\n` + [
          ...v.branchErrors,
          ...v.s1Errors,
          ...v.s2Errors,
          ...v.s3Errors,
        ].join('\n'));
        setSelectedBranchId(draft.id);
        return;
      }
    }

    setIsSaving(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    const allBranchesToSave: Branch[] = [];
    const allUsersToSave: any[] = [];

    for (const draft of branchDrafts) {
      const bObj: Branch = {
        id: draft.id,
        code: draft.code.trim().toUpperCase() || 'HUB',
        name: draft.name.trim() || 'فرع جديد',
        type: draft.type,
        governorate: draft.governorate,
        address: draft.address,
        phone: draft.phone,
        managerName: draft.staff.hub_manager.name || draft.name,
        commissionRateShipping: 10,
        commissionRateTransfers: 1,
        boxSypBalance: 0,
        boxUsdBalance: 0,
        isActive: true,
      };
      allBranchesToSave.push(bObj);

      // Primary 3 roles
      const roles = ['hub_manager', 'inbound_operator', 'outbound_operator'] as const;
      roles.forEach((rKey) => {
        const s = draft.staff[rKey];
        if (s && (s.name.trim() || s.username.trim())) {
          allUsersToSave.push({
            id: s.id || `usr_${rKey}_${draft.id}`,
            name: s.name.trim() || `موظف ${rKey}`,
            username: s.username.trim() || `${rKey}_${draft.code.toLowerCase()}`,
            password: s.password.trim() || '123456',
            phone: s.phone.trim(),
            role: rKey,
            branchId: draft.id,
            allowedBranchIds: [draft.id],
            canSwitchBranches: rKey === 'hub_manager',
            isActive: true,
          });
        }
      });

      // Extra roles
      draft.extraStaff.forEach((es) => {
        if (es.name.trim() || es.username.trim()) {
          allUsersToSave.push({
            id: es.id || `usr_${es.role}_${draft.id}_${Date.now()}`,
            name: es.name.trim() || `موظف ${es.role}`,
            username: es.username.trim(),
            password: es.password.trim() || '123456',
            phone: es.phone.trim(),
            role: es.role,
            branchId: draft.id,
            allowedBranchIds: [draft.id],
            canSwitchBranches: false,
            isActive: true,
          });
        }
      });
    }

    try {
      // 1. Sync local OrcaContext
      allBranchesToSave.forEach((b) => addBranch(b));
      allUsersToSave.forEach((u) => addUser(u));

      // 2. Call backend bulk save
      const vpsConfig = loadSavedVpsConfig();
      const endpoint = vpsConfig?.serverUrl
        ? `${vpsConfig.serverUrl.trim().replace(/\/+$/, '')}/api/admin/branches-and-users/bulk-save`
        : '/api/admin/branches-and-users/bulk-save';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branches: allBranchesToSave,
          users: allUsersToSave,
          requesterRole: currentUser?.role || 'super_admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsDraftDirty(false);
          // Clear localStorage auto-save draft on successful full save
          localStorage.removeItem('orca_branches_draft');
          setHasSavedDraftInStorage(false);

          setBranchDrafts((prev) => prev.map((b) => ({ ...b, isExistingInDb: true })));
          setSaveSuccessMsg(
            `تم حفظ كافة التغييرات بنجاح لـ (${allBranchesToSave.length}) فروع و (${allUsersToSave.length}) موظفين!`
          );
          setTimeout(() => setSaveSuccessMsg(null), 4000);
        } else {
          setSaveErrorMsg(data.error || 'حدث خطأ أثناء حفظ الفروع على السيرفر');
        }
      } else {
        const data = await res.json().catch(() => null);
        setSaveErrorMsg(data?.error || 'فشل حفظ التغييرات على السيرفر');
      }
    } catch (err: any) {
      console.warn('[BulkSave] Server call failed:', err);
      setIsDraftDirty(false);
      setSaveSuccessMsg(`تم حفظ التغييرات محلياً بنجاح!`);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeValidation = activeDraft ? validateBranchDraft(activeDraft) : null;

  return (
    <div className="space-y-6">
      {/* 🔴 Draft Recovery Notification Banner if localStorage contains unsaved work */}
      {hasSavedDraftInStorage && (
        <div className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-3 text-amber-200 text-xs shadow-lg backdrop-blur-md animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">توجد مسودة غير محفوظة مخزنة محلياً</span>
              {draftSavedTimestamp && <span className="text-amber-300/80 mr-1.5 font-mono">({draftSavedTimestamp})</span>}
              <p className="text-[11px] text-amber-300/70">هل ترغب في استعادة آخر جلسة عمل للفروع والمستخدمين؟</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRestoreDraftFromStorage}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow"
            >
              استعادة المسودة
            </button>
            <button
              onClick={handleDismissDraftStorage}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs transition"
            >
              تجاهل
            </button>
          </div>
        </div>
      )}

      {/* 🟢 Top Command Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">إدارة الفروع والمستخدمين</h1>
              {isDraftDirty ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  مسودة
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <Check className="w-3.5 h-3.5" />
                  محفوظ ومتزامن
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              الواجهة الموحدة لشجرة الفروع (⅓) وتعيين الطاقم الأساسي والإضافي لكل فرع (⅔)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {saveSuccessMsg && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {saveErrorMsg && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{saveErrorMsg}</span>
            </div>
          )}

          <button
            onClick={handleBulkSaveAll}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>جاري حفظ الكل...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>🔄 حفظ الكل</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 📐 Desktop 2-Column Split Layout (Right 1/3: Branches | Left 2/3: Users) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ────────── 🏢 RIGHT COLUMN (1/3 Width) - BRANCHES LIST ────────── */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>الفروع ({branchDrafts.length})</span>
            </div>
            <button
              onClick={handleAddNewBranchDraft}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ فرع جديد</span>
            </button>
          </div>

          <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {branchDrafts.map((b) => {
              const isSelected = b.id === (activeDraft?.id || selectedBranchId);
              const val = validateBranchDraft(b);
              const totalStaffInBranch = 3 + (b.extraStaff?.length || 0);

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBranchId(b.id)}
                  className={`relative cursor-pointer p-3.5 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  {/* Selected Active Indicator Arrow */}
                  {isSelected && (
                    <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center text-blue-400 font-bold text-lg">
                      ◄
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {val.isValid ? (
                          <span className="inline-flex items-center text-emerald-400 text-xs font-bold gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>✅ {b.name || 'بدون اسم'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-amber-400 text-xs font-bold gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>⚠️ {b.name || 'بدون اسم'}</span>
                          </span>
                        )}

                        {b.isExistingInDb ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                            موجود مسبقاً
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                            مسودة جديدة
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300">
                          {b.code || 'NO-CODE'}
                        </span>
                        <span>•</span>
                        <span>{b.governorate}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          val.isValid
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {val.filledCount}/3 أساسي ({totalStaffInBranch} موظف)
                      </span>

                      <div className="flex items-center gap-1 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveSingleBranch(b);
                          }}
                          title="حفظ الفرع ومستخدميه"
                          className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          <span>حفظ</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBranchDraft(b.id);
                          }}
                          title="حذف الفرع"
                          className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ────────── 👥 LEFT COLUMN (2/3 Width) - USERS FOR SELECTED BRANCH ────────── */}
        <div className="lg:col-span-8 space-y-6">
          {activeDraft ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl">
              {/* Active Branch Meta Info Card with Real-Time Validation */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h2 className="text-base font-bold text-white">
                      مستخدمو فرع [{activeDraft.name}]
                    </h2>
                    {activeDraft.isExistingInDb ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        موجود مسبقاً في قاعدة البيانات
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        فرع جديد غير محفوظ بعد
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {activeDraft.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">اسم الفرع</label>
                    <input
                      type="text"
                      value={activeDraft.name}
                      onChange={(e) => handleUpdateBranchField(activeDraft.id, 'name', e.target.value)}
                      className={`w-full px-3 py-1.5 bg-slate-900 border rounded-lg text-xs text-white focus:outline-none ${
                        activeDraft.name.trim().length < 2
                          ? 'border-rose-500/70 focus:border-rose-400'
                          : 'border-slate-700 focus:border-blue-500'
                      }`}
                    />
                    {activeDraft.name.trim().length < 2 && (
                      <span className="text-[10px] text-rose-400 mt-1 block">اسم الفرع حرفين على الأقل</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">كود الفرع (Code)</label>
                    <input
                      type="text"
                      value={activeDraft.code}
                      onChange={(e) => handleUpdateBranchField(activeDraft.id, 'code', e.target.value.toUpperCase())}
                      className={`w-full px-3 py-1.5 bg-slate-900 border rounded-lg text-xs text-white font-mono focus:outline-none ${
                        activeDraft.code.trim().length < 2
                          ? 'border-rose-500/70 focus:border-rose-400'
                          : 'border-slate-700 focus:border-blue-500'
                      }`}
                    />
                    {activeDraft.code.trim().length < 2 && (
                      <span className="text-[10px] text-rose-400 mt-1 block">كود الفرع حرفين على الأقل</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">المحافظة</label>
                    <input
                      type="text"
                      value={activeDraft.governorate}
                      onChange={(e) => handleUpdateBranchField(activeDraft.id, 'governorate', e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3 Primary Staff User Roles Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>الطاقم الأساسي للفرع (3 أدوار إلزامية)</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    4 حقول لكل مستخدم (اسم، مستخدم، سر، هاتف)
                  </span>
                </div>

                <div className="space-y-4">
                  {/* 👔 ROLE 1: مدير الفرع (hub_manager) */}
                  <div className="p-4 bg-slate-950/90 rounded-xl border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs">👔 Role 1</span>
                        <span className="text-sm font-bold text-amber-200">مدير الفرع (hub_manager)</span>
                      </div>
                      <span className="text-[11px] text-slate-400">إدارة الفرع، الموظفين، والتقارير</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">الاسم</label>
                        <input
                          type="text"
                          placeholder="أحمد محمد"
                          value={activeDraft.staff.hub_manager.name}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'hub_manager', 'name', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                        {activeDraft.staff.hub_manager.name.trim().length < 2 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">حرفين على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">المستخدم</label>
                        <input
                          type="text"
                          placeholder="ahmed_dam"
                          value={activeDraft.staff.hub_manager.username}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'hub_manager', 'username', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                        {activeDraft.staff.hub_manager.username.trim().length < 3 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">3 أحرف على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">كلمة السر</label>
                        <div className="relative">
                          <input
                            type={showPasswords[`${activeDraft.id}_mgr`] ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={activeDraft.staff.hub_manager.password}
                            onChange={(e) =>
                              handleUpdateStaffField(activeDraft.id, 'hub_manager', 'password', e.target.value)
                            }
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-amber-500 focus:outline-none pl-8"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(`${activeDraft.id}_mgr`)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showPasswords[`${activeDraft.id}_mgr`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {activeDraft.staff.hub_manager.password.length < 6 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">6 خانات على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">الهاتف</label>
                        <input
                          type="text"
                          placeholder="0944112233"
                          value={activeDraft.staff.hub_manager.phone}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'hub_manager', 'phone', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 📥 ROLE 2: مسؤول وارد (inbound_operator) */}
                  <div className="p-4 bg-slate-950/90 rounded-xl border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs">📥 Role 2</span>
                        <span className="text-sm font-bold text-emerald-200">مسؤول وارد (inbound_operator)</span>
                      </div>
                      <span className="text-[11px] text-slate-400">استقبال الشاحنات، تسجيل الوارد، والرفوف</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">الاسم</label>
                        <input
                          type="text"
                          placeholder="سامر وارد"
                          value={activeDraft.staff.inbound_operator.name}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'inbound_operator', 'name', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        {activeDraft.staff.inbound_operator.name.trim().length < 2 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">حرفين على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">المستخدم</label>
                        <input
                          type="text"
                          placeholder="samer_in"
                          value={activeDraft.staff.inbound_operator.username}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'inbound_operator', 'username', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                        />
                        {activeDraft.staff.inbound_operator.username.trim().length < 3 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">3 أحرف على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">كلمة السر</label>
                        <div className="relative">
                          <input
                            type={showPasswords[`${activeDraft.id}_in`] ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={activeDraft.staff.inbound_operator.password}
                            onChange={(e) =>
                              handleUpdateStaffField(activeDraft.id, 'inbound_operator', 'password', e.target.value)
                            }
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-emerald-500 focus:outline-none pl-8"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(`${activeDraft.id}_in`)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showPasswords[`${activeDraft.id}_in`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {activeDraft.staff.inbound_operator.password.length < 6 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">6 خانات على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">الهاتف</label>
                        <input
                          type="text"
                          placeholder="0944112234"
                          value={activeDraft.staff.inbound_operator.phone}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'inbound_operator', 'phone', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 📤 ROLE 3: مسؤول صادر (outbound_operator) */}
                  <div className="p-4 bg-slate-950/90 rounded-xl border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs">📤 Role 3</span>
                        <span className="text-sm font-bold text-cyan-200">مسؤول صادر (outbound_operator)</span>
                      </div>
                      <span className="text-[11px] text-slate-400">تجهيز المانافيستات، تسليم الموزعين، والكاونتر</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">الاسم</label>
                        <input
                          type="text"
                          placeholder="وسيم صادر"
                          value={activeDraft.staff.outbound_operator.name}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'outbound_operator', 'name', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-cyan-500 focus:outline-none"
                        />
                        {activeDraft.staff.outbound_operator.name.trim().length < 2 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">حرفين على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">المستخدم</label>
                        <input
                          type="text"
                          placeholder="waseem_out"
                          value={activeDraft.staff.outbound_operator.username}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'outbound_operator', 'username', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                        />
                        {activeDraft.staff.outbound_operator.username.trim().length < 3 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">3 أحرف على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">كلمة السر</label>
                        <div className="relative">
                          <input
                            type={showPasswords[`${activeDraft.id}_out`] ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={activeDraft.staff.outbound_operator.password}
                            onChange={(e) =>
                              handleUpdateStaffField(activeDraft.id, 'outbound_operator', 'password', e.target.value)
                            }
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-cyan-500 focus:outline-none pl-8"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(`${activeDraft.id}_out`)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showPasswords[`${activeDraft.id}_out`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {activeDraft.staff.outbound_operator.password.length < 6 && (
                          <span className="text-[9px] text-rose-400 block mt-0.5">6 خانات على الأقل</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">الهاتف</label>
                        <input
                          type="text"
                          placeholder="0944112235"
                          value={activeDraft.staff.outbound_operator.phone}
                          onChange={(e) =>
                            handleUpdateStaffField(activeDraft.id, 'outbound_operator', 'phone', e.target.value)
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ➕ Dynamic Extra Staff Roles Section */}
              <div className="pt-2 border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                      <span>موظفون إضافيون للفرع ({activeDraft.extraStaff?.length || 0})</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      يمكنك تعيين كاشير، مناديب توصيل، أو أمناء مستودع إضافيين لهذا الفرع
                    </p>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAddRoleMenu((prev) => !prev)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة دور آخر</span>
                    </button>

                    {showAddRoleMenu && (
                      <div className="absolute left-0 mt-1.5 w-64 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-20 space-y-1">
                        {AVAILABLE_EXTRA_ROLES.map((r) => (
                          <button
                            key={r.role}
                            type="button"
                            onClick={() => handleAddExtraRole(r)}
                            className="w-full text-right p-2 rounded-lg hover:bg-slate-900 text-xs flex flex-col gap-0.5 transition"
                          >
                            <span className="font-bold text-white">{r.title}</span>
                            <span className="text-[10px] text-slate-400">{r.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Extra Staff Cards */}
                {activeDraft.extraStaff && activeDraft.extraStaff.length > 0 && (
                  <div className="space-y-3">
                    {activeDraft.extraStaff.map((es, idx) => (
                      <div
                        key={es.id || idx}
                        className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2 relative group"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-850">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                              {es.roleTitle || es.role}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">@{es.username}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraStaff(activeDraft.id, es.id || es.username)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="إزالة الدور"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                          <input
                            type="text"
                            placeholder="الاسم"
                            value={es.name}
                            onChange={(e) =>
                              handleUpdateExtraStaffField(activeDraft.id, es.id || es.username, 'name', e.target.value)
                            }
                            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:border-indigo-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="المستخدم"
                            value={es.username}
                            onChange={(e) =>
                              handleUpdateExtraStaffField(activeDraft.id, es.id || es.username, 'username', e.target.value)
                            }
                            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                          />
                          <input
                            type="password"
                            placeholder="كلمة السر"
                            value={es.password}
                            onChange={(e) =>
                              handleUpdateExtraStaffField(activeDraft.id, es.id || es.username, 'password', e.target.value)
                            }
                            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="الهاتف"
                            value={es.phone}
                            onChange={(e) =>
                              handleUpdateExtraStaffField(activeDraft.id, es.id || es.username, 'phone', e.target.value)
                            }
                            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-3">
              <Building2 className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm">لم يتم اختيار أي فرع. يرجى اختيار فرع من القائمة الجانبية أو إضافة فرع جديد.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
