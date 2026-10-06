import React, { useState } from 'react';
import { Building2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import { loadSavedVpsConfig } from '../services/vpsClient';

interface BootstrapSetupModalProps {
  isOpen: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
}

export const BootstrapSetupModal: React.FC<BootstrapSetupModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const { addUser, setCurrentUser } = useOrca();
  const [adminName, setAdminName] = useState('سليمان');
  const [username, setUsername] = useState('sulaiman');
  const [password, setPassword] = useState('111222000');
  const [phone, setPhone] = useState('0991122334');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAdminName = adminName.trim();
    const finalUsername = username.trim();
    const finalPassword = password.trim();

    if (!finalAdminName || !finalUsername || !finalPassword) {
      setErrorMsg('يرجى تعبئة اسم المدير، اسم المستخدم، وكلمة المرور.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    let serverSucceeded = false;
    let createdSuperUser: any = null;

    // 1. Try server-side initialization
    try {
      const vpsConfig = loadSavedVpsConfig();
      const endpoints = ['/api/bootstrap/init'];
      if (vpsConfig?.serverUrl && vpsConfig.serverUrl.trim()) {
        const customUrl = `${vpsConfig.serverUrl.trim().replace(/\/+$/, '')}/api/bootstrap/init`;
        if (!endpoints.includes(customUrl)) {
          endpoints.unshift(customUrl);
        }
      }

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminName: finalAdminName,
              username: finalUsername,
              password: finalPassword,
              phone: phone.trim(),
              force: true,
            }),
          });

          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await res.json();
            if (res.ok && json.success) {
              serverSucceeded = true;
              createdSuperUser = json.user;
              break;
            } else if (json.error && !json.error.includes('مقفلة نهائياً')) {
              console.warn('[Bootstrap] Server reported error:', json.error);
            }
          }
        } catch (fetchErr) {
          console.warn(`[Bootstrap] Endpoint ${endpoint} unreachable:`, fetchErr);
        }
      }
    } catch (err: any) {
      console.warn('[Bootstrap] Network init failed, applying client fallback:', err);
    }

    // 2. Client-side local fallback
    try {
      const cleanUserSlug = finalUsername.toLowerCase().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
      const newUserObj = {
        id: createdSuperUser?.id || `usr_${cleanUserSlug || 'admin'}`,
        name: finalAdminName,
        username: finalUsername,
        password: finalPassword,
        role: 'super_admin' as const,
        branchId: '',
        canSwitchBranches: true,
        allowedBranchIds: [],
        phone: phone.trim(),
        isActive: true,
      };

      const added = addUser(newUserObj);
      if (added) {
        setCurrentUser(added);
      } else {
        setCurrentUser(newUserObj);
      }

      setSuccessMsg('تم إنشاء حساب مدير النظام (Super Admin) بنجاح!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 600);
    } catch (clientErr: any) {
      if (!serverSucceeded) {
        setErrorMsg(clientErr.message || 'حدث خطأ أثناء إنشاء الحساب محلياً');
      } else {
        setSuccessMsg('تم إنشاء حساب المدير بنجاح!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          if (onClose) onClose();
        }, 600);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 text-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">التهيئة الأولية للنظام</h2>
            <p className="text-xs text-slate-400">إنشاء حساب المدير العام (Super Admin) فقط</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs text-slate-300 mb-1">اسم المدير العام (الاسم الكامل)</label>
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="مثال: سليمان"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">اسم المستخدم (Username)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="sulaiman"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">رقم الهاتف (اختياري)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0991122334"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2 transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إنشاء مدير النظام...</span>
                </>
              ) : (
                <span>إنشاء حساب مدير النظام (Super Admin)</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
