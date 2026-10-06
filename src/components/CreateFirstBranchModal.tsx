import React, { useState } from 'react';
import { Building2, Users, AlertCircle, CheckCircle2, Loader2, UserCheck, ShieldCheck } from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import { loadSavedVpsConfig } from '../services/vpsClient';

interface CreateFirstBranchModalProps {
  isOpen: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
}

export const CreateFirstBranchModal: React.FC<CreateFirstBranchModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const { currentUser, branches, addBranch, addUser, setCurrentBranch, setCurrentUser } = useOrca();

  // Branch Form State
  const [branchName, setBranchName] = useState('المركز الرئيسي - دمشق');
  const [branchCode, setBranchCode] = useState('DAM-MAIN');
  const [branchGovernorate, setBranchGovernorate] = useState('دمشق');
  const [address, setAddress] = useState('المركز اللوجستي العام - دمشق');
  const [phone, setPhone] = useState('0112233445');
  const [commissionShipping, setCommissionShipping] = useState(10);
  const [commissionTransfers, setCommissionTransfers] = useState(1);

  // Staff Members State (Updated to: hub_manager, inbound_operator, outbound_operator)
  const [staff1Name, setStaff1Name] = useState('سامر - مدير الفرع');
  const [staff1Username, setStaff1Username] = useState('samer_mgr');
  const [staff1Password, setStaff1Password] = useState('123456');
  const [staff1Phone, setStaff1Phone] = useState('0944112233');

  const [staff2Name, setStaff2Name] = useState('وسيم - مسؤول وارد');
  const [staff2Username, setStaff2Username] = useState('waseem_in');
  const [staff2Password, setStaff2Password] = useState('123456');
  const [staff2Phone, setStaff2Phone] = useState('0944112234');

  const [staff3Name, setStaff3Name] = useState('طارق - مسؤول صادر');
  const [staff3Username, setStaff3Username] = useState('tareq_out');
  const [staff3Password, setStaff3Password] = useState('123456');
  const [staff3Phone, setStaff3Phone] = useState('0944112235');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBranchName = branchName.trim();
    const finalBranchCode = branchCode.trim().toUpperCase();
    const finalGovernorate = branchGovernorate.trim();

    if (!finalBranchName || !finalBranchCode || !finalGovernorate) {
      setErrorMsg('يرجى استكمال جميع بيانات الفرع الأساسية.');
      return;
    }

    if (
      !staff1Name.trim() || !staff1Username.trim() || !staff1Password.trim() ||
      !staff2Name.trim() || !staff2Username.trim() || !staff2Password.trim() ||
      !staff3Name.trim() || !staff3Username.trim() || !staff3Password.trim()
    ) {
      setErrorMsg('يرجى استكمال بيانات الموظفين الثلاثة (مدير الفرع، مسؤول وارد، ومسؤول صادر).');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const staffPayload = [
      {
        name: staff1Name.trim(),
        username: staff1Username.trim(),
        password: staff1Password.trim(),
        phone: staff1Phone.trim(),
        role: 'hub_manager',
      },
      {
        name: staff2Name.trim(),
        username: staff2Username.trim(),
        password: staff2Password.trim(),
        phone: staff2Phone.trim(),
        role: 'inbound_operator',
      },
      {
        name: staff3Name.trim(),
        username: staff3Username.trim(),
        password: staff3Password.trim(),
        phone: staff3Phone.trim(),
        role: 'outbound_operator',
      },
    ];

    let serverSucceeded = false;
    let createdBranchObj: any = null;

    try {
      const vpsConfig = loadSavedVpsConfig();
      const endpoints = ['/api/branches/create-first'];
      if (vpsConfig?.serverUrl && vpsConfig.serverUrl.trim()) {
        const customUrl = `${vpsConfig.serverUrl.trim().replace(/\/+$/, '')}/api/branches/create-first`;
        if (!endpoints.includes(customUrl)) endpoints.unshift(customUrl);
      }

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              branchName: finalBranchName,
              branchCode: finalBranchCode,
              branchGovernorate: finalGovernorate,
              address: address.trim(),
              phone: phone.trim(),
              commissionRateShipping: commissionShipping,
              commissionRateTransfers: commissionTransfers,
              requesterRole: currentUser?.role || 'super_admin',
              staff: staffPayload,
            }),
          });

          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await res.json();
            if (res.ok && json.success) {
              serverSucceeded = true;
              createdBranchObj = json.branch;
              break;
            } else if (json.error) {
              console.warn('[CreateFirstBranch] Server error:', json.error);
            }
          }
        } catch (fetchErr) {
          console.warn(`[CreateFirstBranch] Endpoint ${endpoint} unreachable:`, fetchErr);
        }
      }
    } catch (err: any) {
      console.warn('[CreateFirstBranch] Network call failed:', err);
    }

    // Local client state sync
    try {
      const branchId = createdBranchObj?.id || `br_${finalBranchCode.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'main'}`;

      let addedBranch = branches.find((b) => b.id === branchId || b.code === finalBranchCode);
      if (!addedBranch) {
        const branchRes = addBranch({
          name: finalBranchName,
          code: finalBranchCode,
          type: 'main_hub',
          governorate: finalGovernorate as any,
          address: address.trim(),
          phone: phone.trim(),
          managerName: finalBranchName,
          commissionRateShipping: commissionShipping,
          commissionRateTransfers: commissionTransfers,
          isActive: true,
        });
        addedBranch = branchRes.branch;
      }

      if (addedBranch) {
        setCurrentBranch(addedBranch);
      }

      // Add staff members
      staffPayload.forEach((s) => {
        addUser({
          name: s.name,
          username: s.username,
          password: s.password,
          role: s.role as any,
          branchId: branchId,
          canSwitchBranches: false,
          allowedBranchIds: [branchId],
          phone: '',
          isActive: true,
        });
      });

      // Bind current super_admin to this branch
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          branchId: branchId,
          allowedBranchIds: Array.from(new Set([...(currentUser.allowedBranchIds || []), branchId])),
        });
      }

      setSuccessMsg('تم إنشاء الفرع الأول وطاقم العمل بنجاح!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
        window.location.reload();
      }, 700);
    } catch (clientErr: any) {
      if (!serverSucceeded) {
        setErrorMsg(clientErr.message || 'حدث خطأ أثناء إنشاء الفرع محلياً');
      } else {
        setSuccessMsg('تم إنشاء الفرع بنجاح!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          if (onClose) onClose();
          window.location.reload();
        }, 700);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 p-5 bg-slate-950/80 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>إنشاء الفرع الأول وطاقم العمل الأول</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">خطوة 2 من 2</span>
            </h2>
            <p className="text-xs text-slate-400">يرجى إدخال بيانات المركز اللوجستي الأول وإضافة طاقم العمل للبدء الفوري</p>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto custom-scrollbar space-y-5 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Branch Details Section */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
            <div className="text-sm font-bold text-blue-400 flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <Building2 className="w-4 h-4" />
              <span>1. بيانات الفرع الأول (المركز الرئيسي)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">اسم الفرع</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="المركز الرئيسي - دمشق"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">كود الفرع (Branch Code)</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="DAM-MAIN"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">المحافظة / المدينة</label>
                <input
                  type="text"
                  value={branchGovernorate}
                  onChange={(e) => setBranchGovernorate(e.target.value)}
                  placeholder="دمشق"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">العنوان المفصل</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="المركز اللوجستي العام"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Initial Staff Members Section */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-4">
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-2 pb-2 border-b border-slate-800/60">
              <Users className="w-4 h-4" />
              <span>2. طاقم العمل الأول (3 موظفين إشغاليين)</span>
            </div>

            {/* Staff 1: Branch Manager (hub_manager) */}
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span>👔 الموظف 1: مدير الفرع (hub_manager)</span>
                <span className="text-[10px] text-slate-400">إدارة الفرع، الموظفين، والتقارير</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={staff1Name}
                  onChange={(e) => setStaff1Name(e.target.value)}
                  placeholder="اسم الموظف"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                  required
                />
                <input
                  type="text"
                  value={staff1Username}
                  onChange={(e) => setStaff1Username(e.target.value)}
                  placeholder="المستخدم"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                  required
                />
                <input
                  type="password"
                  value={staff1Password}
                  onChange={(e) => setStaff1Password(e.target.value)}
                  placeholder="كلمة السر"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                  required
                />
                <input
                  type="text"
                  value={staff1Phone}
                  onChange={(e) => setStaff1Phone(e.target.value)}
                  placeholder="الهاتف"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                />
              </div>
            </div>

            {/* Staff 2: Inbound Operator (inbound_operator) */}
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
                <span>📥 الموظف 2: مسؤول وارد (inbound_operator)</span>
                <span className="text-[10px] text-slate-400">استقبال الشاحنات وتسجيل الوارد</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={staff2Name}
                  onChange={(e) => setStaff2Name(e.target.value)}
                  placeholder="اسم الموظف"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                  required
                />
                <input
                  type="text"
                  value={staff2Username}
                  onChange={(e) => setStaff2Username(e.target.value)}
                  placeholder="المستخدم"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                  required
                />
                <input
                  type="password"
                  value={staff2Password}
                  onChange={(e) => setStaff2Password(e.target.value)}
                  placeholder="كلمة السر"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                  required
                />
                <input
                  type="text"
                  value={staff2Phone}
                  onChange={(e) => setStaff2Phone(e.target.value)}
                  placeholder="الهاتف"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                />
              </div>
            </div>

            {/* Staff 3: Outbound Operator (outbound_operator) */}
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-cyan-300 flex items-center justify-between">
                <span>📤 الموظف 3: مسؤول صادر (outbound_operator)</span>
                <span className="text-[10px] text-slate-400">تجهيز المانافيستات وتسليم الموزعين</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={staff3Name}
                  onChange={(e) => setStaff3Name(e.target.value)}
                  placeholder="اسم الموظف"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                  required
                />
                <input
                  type="text"
                  value={staff3Username}
                  onChange={(e) => setStaff3Username(e.target.value)}
                  placeholder="المستخدم"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                  required
                />
                <input
                  type="password"
                  value={staff3Password}
                  onChange={(e) => setStaff3Password(e.target.value)}
                  placeholder="كلمة السر"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                  required
                />
                <input
                  type="text"
                  value={staff3Phone}
                  onChange={(e) => setStaff3Phone(e.target.value)}
                  placeholder="الهاتف"
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2 transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء الفرع وطاقم العمل...</span>
                </>
              ) : (
                <span>إنشاء الفرع وطاقم العمل الأول</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
