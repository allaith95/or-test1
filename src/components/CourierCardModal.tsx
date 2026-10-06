import React, { useState, useEffect, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import { User, Branch } from '../types';
import {
  Truck,
  User as UserIcon,
  Phone,
  CreditCard,
  Building2,
  Lock,
  CheckCircle2,
  X,
  Bike,
  Shield,
  MapPin,
  Check,
  AlertCircle,
} from 'lucide-react';

interface CourierCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  courierToEdit?: User | null;
  defaultBranchId?: string;
  onSaveSuccess?: (courierUser: User) => void;
}

export const CourierCardModal: React.FC<CourierCardModalProps> = ({
  isOpen,
  onClose,
  courierToEdit,
  defaultBranchId,
  onSaveSuccess,
}) => {
  const { branches, addUser, updateUser, currentBranch, currentUser } = useOrca();

  // -------------------------------------------------------------
  // 1. RESOLVE MAIN HUBS AND STRICT GOVERNORATE HIERARCHY
  // -------------------------------------------------------------
  // Main hubs list representing each governorate/hub
  const mainHubs = useMemo(() => {
    const list = branches.filter((b) => b.type === 'main_hub' || b.isMainHub);
    if (list.length > 0) return list;
    const withoutParent = branches.filter((b) => !b.parentHubId);
    return withoutParent.length > 0 ? withoutParent : branches;
  }, [branches]);

  // Helper to find the Main Hub for any given branch
  const findMainHubForBranch = (bId?: string): Branch => {
    if (!bId) {
      return mainHubs[0] || currentBranch;
    }
    const b = branches.find((branch) => branch.id === bId);
    if (!b) return mainHubs[0] || currentBranch;

    // If it's already a main hub
    if (b.type === 'main_hub' || b.isMainHub) return b;

    // If it has a parentHubId
    if (b.parentHubId) {
      const parent = branches.find((p) => p.id === b.parentHubId);
      if (parent) return parent;
    }

    // Match by governorate
    const govHub = branches.find((h) => h.governorate === b.governorate && (h.type === 'main_hub' || h.isMainHub));
    if (govHub) return govHub;

    return b;
  };

  // State: The selected Main Hub (المحافظة والمركز الرئيسي التابع له الموزع)
  const [selectedMainHubId, setSelectedMainHubId] = useState<string>(() => {
    const initialBranchId = courierToEdit?.branchId || defaultBranchId || currentBranch?.id;
    const hub = findMainHubForBranch(initialBranchId);
    return hub?.id || mainHubs[0]?.id || '';
  });

  // Active Main Hub Object
  const activeMainHub = useMemo(() => {
    return branches.find((b) => b.id === selectedMainHubId) || mainHubs[0] || currentBranch;
  }, [branches, selectedMainHubId, mainHubs, currentBranch]);

  // -------------------------------------------------------------
  // 2. STRICTLY RESTRICT BRANCHES TO THIS MAIN HUB & ITS SUB-BRANCHES EXCLUSIVELY
  // (حصر إضافة الموزع بالمركز الرئيسي وفروعه التابعة حصراً مع حجب باقي الفروع الرئيسية)
  // -------------------------------------------------------------
  const allowedBranchesForCourier = useMemo(() => {
    if (!activeMainHub) return [];

    return branches.filter((b) => {
      // 1. The Main Hub itself
      if (b.id === activeMainHub.id) return true;

      // 2. Subsidiary branches explicitly attached to this Main Hub
      if (b.parentHubId && b.parentHubId === activeMainHub.id) return true;

      // 3. Branches located in the same governorate that are NOT another main hub
      if (
        b.governorate === activeMainHub.governorate &&
        b.type !== 'main_hub' &&
        !b.isMainHub
      ) {
        return true;
      }

      return false;
    });
  }, [branches, activeMainHub]);

  // Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('12345');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [allowedBranchIds, setAllowedBranchIds] = useState<string[]>([]);
  const [vehicleType, setVehicleType] = useState('دراجة نارية');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [coverageArea, setCoverageArea] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset when modal opens or courier changes
  useEffect(() => {
    if (courierToEdit) {
      const hub = findMainHubForBranch(courierToEdit.branchId);
      setSelectedMainHubId(hub.id);
      setName(courierToEdit.name || '');
      setUsername(courierToEdit.username || '');
      setPassword(courierToEdit.password || '12345');
      setPhone(courierToEdit.phone || '');
      setNationalId(courierToEdit.nationalId || '');
      setBranchId(courierToEdit.branchId || hub.id);
      setAllowedBranchIds(courierToEdit.allowedBranchIds || [courierToEdit.branchId || hub.id]);
      setVehicleType(courierToEdit.vehicleType || 'دراجة نارية');
      setVehiclePlate(courierToEdit.vehiclePlate || '');
      setCoverageArea(courierToEdit.coverageArea || '');
      setNotes(courierToEdit.notes || '');
      setIsActive(courierToEdit.isActive ?? true);
    } else {
      const hub = findMainHubForBranch(defaultBranchId || currentBranch?.id);
      setSelectedMainHubId(hub.id);
      setName('');
      setUsername('');
      setPassword('12345');
      setPhone('');
      setNationalId('');
      // Default to the provided branch if it belongs to this hub, otherwise the hub itself
      const targetB = defaultBranchId || hub.id;
      setBranchId(targetB);
      setAllowedBranchIds([targetB]);
      setVehicleType('دراجة نارية');
      setVehiclePlate('');
      setCoverageArea('');
      setNotes('');
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [courierToEdit, defaultBranchId, currentBranch, branches, isOpen]);

  // Ensure branchId is always valid within the strictly allowed branches for this main hub
  useEffect(() => {
    if (allowedBranchesForCourier.length > 0) {
      const isCurrentBranchValid = allowedBranchesForCourier.some((b) => b.id === branchId);
      if (!isCurrentBranchValid) {
        const fallbackId = allowedBranchesForCourier[0].id;
        setBranchId(fallbackId);
        setAllowedBranchIds((prev) => Array.from(new Set([...prev.filter((id) => allowedBranchesForCourier.some((b) => b.id === id)), fallbackId])));
      }
    }
  }, [allowedBranchesForCourier, branchId]);

  // Handler for changing Main Hub (Super Admin only)
  const handleMainHubChange = (newHubId: string) => {
    setSelectedMainHubId(newHubId);
    const newHub = branches.find((b) => b.id === newHubId);
    if (newHub) {
      setBranchId(newHub.id);
      setAllowedBranchIds([newHub.id]);
    }
  };

  // Auto-generate username from name if empty
  const handleNameChange = (val: string) => {
    setName(val);
    if (!courierToEdit && (!username || username.startsWith('courier_'))) {
      const cleanName = val.trim().toLowerCase().replace(/[\s\W]+/g, '_');
      if (cleanName) {
        setUsername(`courier_${cleanName.slice(0, 12)}`);
      } else {
        setUsername('');
      }
    }
  };

  if (!isOpen || currentUser?.role !== 'super_admin') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (currentUser?.role !== 'super_admin') {
      setErrorMsg('غير مصرح: إضافة أو تعديل الموزعين محصورة بمدير التطبيق العام (Super Admin) فقط');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('يرجى إدخال اسم الموزع المعتمد بالكامل');
      return;
    }

    if (!username.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم لتسجيل الدخول');
      return;
    }

    // Verify selected branch belongs to allowed branches
    const isBranchAllowed = allowedBranchesForCourier.some((b) => b.id === branchId);
    if (!isBranchAllowed) {
      setErrorMsg('الفرع المحدد لا يتبع للمركز الرئيسي والمحافظة المخصصة لهذا الموزع');
      return;
    }

    // Filter allowed branch ids to only those belonging to this main hub
    const sanitizedAllowedBranchIds = Array.from(
      new Set(
        [branchId, ...allowedBranchIds].filter((id) =>
          allowedBranchesForCourier.some((b) => b.id === id)
        )
      )
    );

    let savedUser: User;

    if (courierToEdit) {
      updateUser(courierToEdit.id, {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: password || '12345',
        phone: phone.trim(),
        nationalId: nationalId.trim() || undefined,
        branchId,
        allowedBranchIds: sanitizedAllowedBranchIds,
        canSwitchBranches: false, // Couriers are strictly bound to their main hub & its sub-branches
        vehicleType,
        vehiclePlate: vehiclePlate.trim() || undefined,
        coverageArea: coverageArea.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive,
        role: 'courier',
      });
      savedUser = {
        ...courierToEdit,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        branchId,
        allowedBranchIds: sanitizedAllowedBranchIds,
        vehicleType,
        vehiclePlate: vehiclePlate.trim() || undefined,
        coverageArea: coverageArea.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive,
      };
    } else {
      savedUser = addUser({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: password || '12345',
        phone: phone.trim(),
        nationalId: nationalId.trim() || undefined,
        role: 'courier',
        branchId,
        allowedBranchIds: sanitizedAllowedBranchIds,
        canSwitchBranches: false, // Locked to this hub's jurisdiction
        isActive,
        vehicleType,
        vehiclePlate: vehiclePlate.trim() || undefined,
        coverageArea: coverageArea.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }

    if (onSaveSuccess) {
      onSaveSuccess(savedUser);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-['Cairo',sans-serif]">
      <div className="w-full max-w-4xl bg-slate-900 border border-purple-500/40 rounded-3xl shadow-2xl my-auto text-xs flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header with Quick Actions */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{courierToEdit ? 'تعديل بيانات بطاقة الموزع المعتمد' : 'إنشاء وتوثيق بطاقة موزع معتمد جديد'}</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  محافظة {activeMainHub?.governorate}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                حصر تعيين الموزع ضمن المحافظة والمركز الرئيسي وفروعه التابعة حصراً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg border border-purple-400/30 flex items-center gap-1.5 transition active:scale-95 text-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>اعتماد وبناء البطاقة</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 grow custom-scrollbar">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 0: JURISDICTION RESTRICTION BANNER & MAIN HUB SELECTOR            */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-950 border border-purple-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Shield className="w-4 h-4 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white">
                    نطاق التوزيع: المركز الرئيسي وفروعه التابعة حصراً
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    وفق ضوابط المنظومة، يتم حصر إضافة الموزع بالمركز الرئيسي للمحافظة وفروعه التابعة دون ظهور باقي المحافظات.
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-900 border border-purple-500/30 text-purple-300 font-mono shrink-0">
                {allowedBranchesForCourier.length} فروع متاحة
              </span>
            </div>

            {/* Hub Selector (Super Admin) or Hub Lock Badge (Other Roles) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
              {/* Main Hub of the Governorate */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block flex items-center justify-between">
                  <span>المحافظة والمركز الرئيسي التابع له الموزع:</span>
                  {currentUser.role === 'super_admin' ? (
                    <span className="text-[10px] text-purple-400 font-bold">قابل للتغيير (مدير المنظومة)</span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">مقيد بالفرع الحالي</span>
                  )}
                </label>

                {currentUser.role === 'super_admin' ? (
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-purple-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedMainHubId}
                      onChange={(e) => handleMainHubChange(e.target.value)}
                      className="w-full bg-slate-950 border border-purple-500/60 focus:border-purple-400 rounded-xl pr-9 pl-3 py-2.5 text-xs text-purple-200 font-black focus:outline-none cursor-pointer"
                    >
                      {mainHubs.map((hub) => (
                        <option key={hub.id} value={hub.id} className="bg-slate-900 text-white font-bold">
                          🏢 المركز الرئيسي: {hub.name} (محافظة {hub.governorate})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-purple-200 font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-400" />
                      <span>{activeMainHub?.name} (محافظة {activeMainHub?.governorate})</span>
                    </span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-bold">
                      مركز رئيسي معتمد
                    </span>
                  </div>
                )}
              </div>

              {/* Specific Branch Selector (ONLY Main Hub + Sub-branches of THIS hub) */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block flex items-center justify-between">
                  <span>الفرع المخصص للموزع المعتمد: <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-emerald-400 font-bold">محصور بالمحافظة</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={branchId}
                    onChange={(e) => {
                      const newBId = e.target.value;
                      setBranchId(newBId);
                      if (!allowedBranchIds.includes(newBId)) {
                        setAllowedBranchIds([...allowedBranchIds, newBId]);
                      }
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-750 focus:border-purple-500 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white font-bold focus:outline-none cursor-pointer"
                  >
                    {allowedBranchesForCourier.map((b) => {
                      const isMain = b.id === activeMainHub?.id;
                      return (
                        <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                          {isMain
                            ? `⭐ ${b.name} (المركز الرئيسي للمحافظة)`
                            : `📍 ${b.name} (فرع تابع لـ ${activeMainHub?.name})`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Sub-branch Coverage Badges */}
            {allowedBranchesForCourier.length > 1 && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <span className="text-[11px] text-slate-300 font-bold block">
                  الفروع المصرح للموزع تغطيتها داخل المحافظة (نطاق الصلاحيات الميدانية):
                </span>
                <div className="flex flex-wrap gap-2">
                  {allowedBranchesForCourier.map((b) => {
                    const isPrimary = b.id === branchId;
                    const isSelected = allowedBranchIds.includes(b.id) || isPrimary;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          if (isPrimary) return;
                          if (allowedBranchIds.includes(b.id)) {
                            setAllowedBranchIds(allowedBranchIds.filter((id) => id !== b.id));
                          } else {
                            setAllowedBranchIds([...allowedBranchIds, b.id]);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-950/70 border-purple-500 text-purple-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        } ${isPrimary ? 'ring-1 ring-emerald-500/50 border-emerald-500 text-emerald-200' : ''}`}
                      >
                        <span>{b.id === activeMainHub?.id ? `⭐ ${b.name}` : `📍 ${b.name}`}</span>
                        {isPrimary ? (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded">الأساسي</span>
                        ) : isSelected ? (
                          <Check className="w-3 h-3 text-purple-400" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 1: Basic & Credential Info */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-purple-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <UserIcon className="w-4 h-4 text-purple-400" />
              <span>البيانات الشخصية وبيانات تسجيل الدخول للسيستم</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {/* Full Name */}
              <div className="space-y-1 sm:col-span-2 md:col-span-1">
                <label className="text-slate-300 font-bold block">اسم الموزع بالكامل *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="مثال: أحمد محمود التوزيع"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-3 pl-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-2.5 top-3" />
                </div>
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">اسم المستخدم للدخول (Username) *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: موزع أو courier_ahmed"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-3 pl-8 py-2.5 text-xs text-purple-300 font-mono font-bold placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <Shield className="w-4 h-4 text-purple-400 absolute left-2.5 top-3" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">كلمة المرور *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="افتراضي: 12345"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-3 pl-8 py-2.5 text-xs text-amber-300 font-mono font-bold placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <Lock className="w-4 h-4 text-amber-400 absolute left-2.5 top-3" />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">رقم الهاتف المعتمد *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0988112233"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-3 pl-8 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-2.5 top-3" />
                </div>
              </div>

              {/* National ID */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-slate-300 font-bold block">الرقم الوطني / الهوية الشخصية (11 رقماً)</label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={11}
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                    placeholder="010100xxxxx"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-3 pl-8 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <CreditCard className="w-4 h-4 text-slate-500 absolute left-2.5 top-3" />
                </div>
              </div>
            </div>

            {/* Direct Isolated Link Banner */}
            <div className="mt-3 p-3 bg-slate-900/90 rounded-xl border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[11px] font-bold text-amber-300 block">رابط بوابة الموزع المستقلة:</span>
                  <span className="text-[10px] text-slate-400 font-mono select-all dir-ltr block text-right">
                    {window.location.origin}/?portal=CUR-SC
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?portal=CUR-SC`);
                }}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>نسخ الرابط للموزع</span>
              </button>
            </div>
          </div>

          {/* Section 2: Vehicle & Coverage Details */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <Bike className="w-4 h-4 text-cyan-400" />
              <span>بيانات وسيلة النقل وقطاع التوزيع الميداني</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Vehicle Type */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">نوع وسيلة النقل</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="دراجة نارية">دراجة نارية (موتورسيكل)</option>
                  <option value="فان مغلق">فان مغلق (Van)</option>
                  <option value="سيارة شحن صغيرة">سيارة شحن صغيرة (Pick-up)</option>
                  <option value="سيارة سياحية خاصة">سيارة خاصة</option>
                  <option value="توزيع مشاة / عام">توزيع عام</option>
                </select>
              </div>

              {/* Vehicle Plate */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">رقم لوحة المركبة</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder={`مثال: ${activeMainHub?.governorate || 'دمشق'} 123456`}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Coverage Area */}
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">قطاع / أحياء التوزيع الميداني</label>
                <input
                  type="text"
                  value={coverageArea}
                  onChange={(e) => setCoverageArea(e.target.value)}
                  placeholder="مثال: وسط المدينة - المزة - كفرسوسة"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-slate-300 font-bold block">ملاحظات إضافية وتفاصيل الاتفاق</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أدخل أي ملاحظة حول ساعات العمل، العهدة، أو الاتفاق..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </form>

        {/* Elevated Sticky Bottom Action Bar */}
        <div className="px-5 py-4 bg-slate-950 border-t border-purple-500/30 z-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-2xl">
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <input
              type="checkbox"
              id="chk_courier_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="chk_courier_active" className="text-xs text-slate-300 font-bold cursor-pointer">
              الحساب مفعل ونشط للعمل الميداني
            </label>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition text-xs cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-xl shadow-purple-600/30 border border-purple-400/40 flex items-center gap-2 transition active:scale-95 text-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{courierToEdit ? 'حفظ التعديلات' : 'اعتماد وبناء بطاقة الموزع'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
