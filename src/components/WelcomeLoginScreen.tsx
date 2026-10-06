import React, { useState, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  ShieldCheck,
  ShieldAlert,
  User as UserIcon,
  Lock,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  LogIn,
  Building2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { OrcaLogo } from './OrcaLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { SyriaLogisticsNetworkMap } from './SyriaLogisticsNetworkMap';
import { checkLockoutState, formatCountdownTimer } from '../utils/lockoutHelper';
import { vpsSyncEngine } from '../services/vpsSyncEngine';

interface WelcomeLoginScreenProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const WelcomeLoginScreen: React.FC<WelcomeLoginScreenProps> = ({
  onClose,
  isModal = false,
}) => {
  const {
    users,
    branches,
    brandingSettings,
    login,
  } = useOrca();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFocusedUser, setIsFocusedUser] = useState(false);
  const [isFocusedPass, setIsFocusedPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Temporary Account Lockout state
  const [isLocked, setIsLocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Live Syrian Time
  const [currentTime, setCurrentTime] = useState<string>('');

  // Initial silent cloud pull on mount to make sure credentials and users are updated
  useEffect(() => {
    vpsSyncEngine.pullFullDatabaseFromCloud().catch(() => {});
  }, []);

  // Check lockout status on username change
  useEffect(() => {
    if (!username.trim()) {
      setIsLocked(false);
      setRemainingSeconds(0);
      return;
    }
    const state = checkLockoutState(username.trim());
    setIsLocked(state.isLocked);
    setRemainingSeconds(state.remainingSeconds);
  }, [username]);

  // Live countdown timer for lockout
  useEffect(() => {
    if (!isLocked || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          setErrorMsg(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, remainingSeconds]);

  // Live Damascus Clock
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('ar-SY', {
          timeZone: 'Asia/Damascus',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now);
        setCurrentTime(formatted);
      } catch {
        setCurrentTime(new Date().toLocaleTimeString('ar-SY'));
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Selected user preview for role detection
  const detectedUser = users.find(
    (u) =>
      u.username.toLowerCase() === username.trim().toLowerCase() ||
      u.name.toLowerCase() === username.trim().toLowerCase() ||
      (username.trim().toLowerCase() === 'سليمان' && (u.username === 'سليمان' || u.name === 'سليمان' || u.role === 'super_admin'))
  );

  // Strictly resolve the courier's assigned branch exclusively from database
  const detectedUserBranch = React.useMemo(() => {
    if (!detectedUser?.branchId) return null;
    return branches.find((b) => b.id === detectedUser.branchId) || null;
  }, [detectedUser, branches]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!username.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم');
      return;
    }

    if (!password.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور');
      return;
    }

    // Strict validation for couriers
    if (detectedUser && detectedUser.role === 'courier') {
      if (!detectedUser.branchId) {
        setErrorMsg('تنبيه أمني: حساب الموزع غير مقترن بأي فرع في النظام. يجب من إدارة النظام تعيين الفرع التابع له الموزع حصراً.');
        return;
      }
      if (!detectedUserBranch) {
        setErrorMsg('تنبيه أمني: لم يتم العثور على الفرع التابع له الموزع في قاعدة بيانات الفروع الرسمية.');
        return;
      }
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = login(username.trim(), password.trim());
      setIsLoading(false);
      if (res.success) {
        if (detectedUser?.role === 'courier' && detectedUserBranch) {
          setSuccessMsg(`تم تسجيل الدخول بنجاح! مرحباً بك [${detectedUser.name}] — الفرع التابع له حصراً: [${detectedUserBranch.name}]${detectedUserBranch.governorate ? ` (${detectedUserBranch.governorate})` : ''}`);
        } else {
          setSuccessMsg('تم تسجيل الدخول بنجاح! مرحباً بك.');
        }
        setIsLocked(false);
        setRemainingSeconds(0);
        if (onClose) setTimeout(onClose, 400);
      } else {
        if (res.isLocked) {
          setIsLocked(true);
          setRemainingSeconds(res.remainingSeconds || 600);
        }
        setErrorMsg(res.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    }, 250);
  };

  return (
    <div
      id="welcome_login_screen"
      className={`${
        isModal
          ? 'fixed inset-0 z-50 flex flex-col justify-between h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden'
          : 'h-screen max-h-screen w-screen flex flex-col justify-between bg-slate-950 text-slate-100 relative overflow-hidden'
      } font-['Cairo',sans-serif]`}
      dir="rtl"
    >
      {/* ========================================================================= */}
      {/* 1. CINEMATIC AMBIENT BACKGROUND GLOWS                                    */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        <div className="absolute inset-0 bg-[#040711]" />
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-amber-500/[0.07] rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/[0.07] rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-radial from-transparent via-slate-950/40 to-slate-950/90" />
      </div>

      {/* ========================================================================= */}
      {/* 2. MINIMALIST TOP HEADER                                                  */}
      {/* ========================================================================= */}
      <header className="shrink-0 z-20 bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-md px-6 sm:px-10 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-950 p-1 flex items-center justify-center border border-slate-800 shadow-md">
            <OrcaLogo size={30} showText={false} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
              {brandingSettings.companyName || 'أوركا اكسبريس'}
            </h1>
            <p className="text-[11px] text-amber-400 font-medium">
              بوابة تسجيل دخول الموظفين
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PWAInstallButton variant="header" />

          {/* Live Syrian Clock */}
          {currentTime && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>توقيت دمشق:</span>
              <span className="text-white font-bold">{currentTime}</span>
            </div>
          )}

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. SPLIT WORKSPACE: 70% SYRIA MAP ON RIGHT / 30% LOGIN CARD ON LEFT       */}
      {/* ========================================================================= */}
      <main className="flex-1 z-20 px-4 sm:px-6 lg:px-10 py-4 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8 max-w-[1800px] w-full mx-auto overflow-hidden">
        
        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT COLUMN (70%): FULL BORDERLESS SYRIA LOGISTICS NETWORK MAP         */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full lg:w-[66%] xl:w-[70%] h-[320px] sm:h-[420px] lg:h-full flex items-center justify-center relative overflow-hidden order-2 lg:order-1">
          <div className="w-full h-full flex items-center justify-center p-2">
            <SyriaLogisticsNetworkMap
              className="w-full h-full max-h-[calc(100vh-130px)]"
            />
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* LEFT COLUMN (30%): FROSTED ULTRA-GLASS FLOATING LOGIN CARD              */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full lg:w-[34%] xl:w-[30%] max-w-md shrink-0 flex items-center justify-center order-1 lg:order-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full bg-slate-900/85 border border-amber-500/30 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(245,186,19,0.06)] backdrop-blur-2xl p-6 sm:p-7 space-y-5 relative"
          >
            {/* Top Logo & Title */}
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-950/80 p-2 flex items-center justify-center border-2 border-amber-500/40 shadow-xl shadow-amber-500/15 mb-2.5 backdrop-blur-md">
                <OrcaLogo size={46} showText={false} circularBg={false} />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                تسجيل دخول الموظفين
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                أدخل بيانات حسابك للوصول إلى النظام
              </p>
            </div>

            {/* Account Lockout Notice */}
            {isLocked && (
              <div className="p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 text-xs flex flex-col gap-2 animate-in fade-in shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2 font-black text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                  <span>تم تجميد هذا الحساب مؤقتاً</span>
                </div>
                <div className="flex items-center justify-between bg-slate-950/90 p-2 rounded-xl border border-rose-500/40">
                  <span className="text-[11px] text-slate-300 font-bold">الوقت المتبقي:</span>
                  <span className="font-mono text-xs font-black text-amber-300 dir-ltr bg-rose-900/80 px-2.5 py-0.5 rounded border border-amber-500/40">
                    {formatCountdownTimer(remainingSeconds)}
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && !isLocked && (
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in backdrop-blur-md">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="font-bold">{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in backdrop-blur-md">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="font-bold">{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              
              {/* FLOATING FIELD 1: USERNAME (اسم المستخدم) */}
              <div className="relative">
                <div
                  className={`relative flex items-center rounded-2xl bg-slate-950/70 backdrop-blur-md border transition-all duration-200 px-3.5 py-2.5 ${
                    isFocusedUser
                      ? 'border-amber-400 ring-2 ring-amber-400/25 shadow-lg shadow-amber-400/15 bg-slate-950/90'
                      : 'border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="shrink-0 pl-2.5">
                    <UserIcon
                      className={`w-4 h-4 transition-colors ${
                        isFocusedUser ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <span
                      className={`text-[9px] font-bold transition-all ${
                        isFocusedUser || username
                          ? 'text-amber-400 scale-100'
                          : 'text-slate-400'
                      }`}
                    >
                      اسم المستخدم (Username)
                    </span>
                    <input
                      id="input_username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setIsFocusedUser(true)}
                      onBlur={() => setIsFocusedUser(false)}
                      placeholder="أدخل اسم المستخدم"
                      required
                      autoComplete="username"
                      className="w-full bg-transparent text-white font-bold text-xs sm:text-sm focus:outline-none placeholder:text-slate-600 pt-0.5"
                    />
                  </div>
                </div>

                {/* Detected User Role & Branch Hint */}
                {detectedUser && (
                  <div className="mt-1.5 p-2 rounded-xl bg-slate-900/90 border border-slate-700/60 flex flex-col gap-1 text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>المستخدم: <strong className="text-white">{detectedUser.name}</strong></span>
                      </div>
                      <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold">
                        {detectedUser.role === 'courier' ? 'موزع ميداني معتمد' : detectedUser.role === 'super_admin' ? 'مدير التطبيق العام' : 'موظف'}
                      </span>
                    </div>

                    {detectedUser.role === 'courier' && (
                      <div className="flex items-center justify-between text-amber-300 pt-1 border-t border-slate-800">
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-slate-400 font-bold text-[10px]">الفرع التابع له حصراً:</span>
                          <span className="text-amber-300 font-black">
                            {detectedUserBranch ? detectedUserBranch.name : 'لم يتم ربط فرع بعد'}
                          </span>
                        </div>
                        {detectedUserBranch?.governorate && (
                          <span className="text-[9.5px] text-slate-400 font-mono">
                            ({detectedUserBranch.governorate})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* FLOATING FIELD 2: PASSWORD (كلمة المرور) */}
              <div className="relative">
                <div
                  className={`relative flex items-center rounded-2xl bg-slate-950/70 backdrop-blur-md border transition-all duration-200 px-3.5 py-2.5 ${
                    isFocusedPass
                      ? 'border-amber-400 ring-2 ring-amber-400/25 shadow-lg shadow-amber-400/15 bg-slate-950/90'
                      : 'border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="shrink-0 pl-2.5">
                    <Lock
                      className={`w-4 h-4 transition-colors ${
                        isFocusedPass ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <span
                      className={`text-[9px] font-bold transition-all ${
                        isFocusedPass || password
                          ? 'text-amber-400 scale-100'
                          : 'text-slate-400'
                      }`}
                    >
                      كلمة المرور (Password)
                    </span>
                    <input
                      id="input_password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsFocusedPass(true)}
                      onBlur={() => setIsFocusedPass(false)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full bg-transparent text-white font-mono text-xs sm:text-sm focus:outline-none placeholder:text-slate-600 pt-0.5 tracking-wider"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="pr-1.5 text-slate-400 hover:text-white transition cursor-pointer"
                    title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                id="btn_submit_login"
                type="submit"
                disabled={isLoading || isLocked}
                className="w-full mt-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99]"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2 font-bold">
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>جاري تسجيل الدخول...</span>
                  </div>
                ) : isLocked ? (
                  <span>الحساب مجمد مؤقتاً</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>تسجيل الدخول</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 4. MINIMALIST PROFESSIONAL FOOTER                                         */}
      {/* ========================================================================= */}
      <footer className="shrink-0 z-20 bg-slate-900/60 border-t border-slate-800/80 px-6 sm:px-12 py-2.5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
        <span className="text-slate-300 font-bold">
          جميع الحقوق محفوظة © أوركا اكسبريس للشحن البري
        </span>
        <span className="text-slate-400 font-medium">
          تم التطوير بواسطة شركة أبديت لحلول الأعمال
        </span>
      </footer>
    </div>
  );
};
