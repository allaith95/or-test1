import React, { useState, useEffect, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Truck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldAlert,
  Phone,
  Building2,
  ShieldCheck,
  User,
  MapPin,
} from 'lucide-react';
import { motion } from 'motion/react';
import { OrcaLogo } from './OrcaLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { checkLockoutState, formatCountdownTimer } from '../utils/lockoutHelper';

interface CourierPortalLoginScreenProps {
  // Pure Courier Portal Login - Completely Isolated
}

export const CourierPortalLoginScreen: React.FC<CourierPortalLoginScreenProps> = () => {
  const { brandingSettings, login, users, branches } = useOrca();

  // Courier credentials
  const [courierInput, setCourierInput] = useState('');
  const [courierPassword, setCourierPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Temporary Account Lockout state
  const [isLocked, setIsLocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Real-time lookup of courier and exclusively associated branch
  // Find courier by username, name, or phone number in real-time
  const matchedCourier = useMemo(() => {
    const clean = courierInput.trim().toLowerCase();
    if (!clean) return null;
    const found = users.find(
      (u) =>
        u.username.toLowerCase() === clean ||
        u.name.toLowerCase() === clean ||
        (u.phone && u.phone.replace(/\D/g, '') === clean.replace(/\D/g, ''))
    );
    if (found && (found.role === 'courier' || found.role === 'super_admin')) {
      return found;
    }
    return null;
  }, [courierInput, users]);

  // Strictly resolve the courier's assigned branch exclusively from registered branches without any default/fallback
  const courierBranch = useMemo(() => {
    if (!matchedCourier?.branchId) return null;
    return branches.find((b) => b.id === matchedCourier.branchId) || null;
  }, [matchedCourier, branches]);

  // Check lockout status on courierInput change
  useEffect(() => {
    if (!courierInput.trim()) {
      setIsLocked(false);
      setRemainingSeconds(0);
      return;
    }
    const state = checkLockoutState(courierInput.trim());
    setIsLocked(state.isLocked);
    setRemainingSeconds(state.remainingSeconds);
  }, [courierInput]);

  // Countdown timer effect
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

  // Handle Courier Login Submit
  const handleCourierLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanInput = courierInput.trim();
    const cleanPassword = courierPassword.trim();

    if (!cleanInput) {
      setErrorMsg('يرجى إدخال اسم المستخدم أو رقم هاتف الموزع');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      // Find user if courier by phone or username
      const targetUser = users.find(
        (u) =>
          u.username.toLowerCase() === cleanInput.toLowerCase() ||
          u.name.toLowerCase() === cleanInput.toLowerCase() ||
          (u.phone && u.phone.replace(/\D/g, '') === cleanInput.replace(/\D/g, ''))
      );

      if (!targetUser) {
        setIsLoading(false);
        setErrorMsg('بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم أو رقم الهاتف.');
        return;
      }

      // Check if user is courier or administrator
      if (targetUser.role !== 'courier' && targetUser.role !== 'super_admin') {
        setIsLoading(false);
        setErrorMsg('هذا الحساب غير مسجل كموزع ميداني معتمد. يرجى الدخول من بوابة موظفي الشركة.');
        return;
      }

      // Strict Branch Association Check for Couriers - No default or demo data
      const targetBranch = branches.find((b) => b.id === targetUser.branchId);
      if (targetUser.role === 'courier') {
        if (!targetUser.branchId) {
          setIsLoading(false);
          setErrorMsg('تنبيه أمني: حساب الموزع غير مقترن بأي فرع في النظام حالياً. يرجى من إدارة النظام تعيين الفرع التابع له الموزع حصراً قبل تسجيل الدخول.');
          return;
        }
        if (!targetBranch) {
          setIsLoading(false);
          setErrorMsg('تنبيه أمني: لم يتم العثور على الفرع التابع له الموزع في قاعدة بيانات الفروع. يرجى من إدارة النظام ربط الموزع بفرع رسمي معتمد حصراً.');
          return;
        }
      }

      const res = login(targetUser.username, cleanPassword);
      setIsLoading(false);

      if (res.success) {
        const branchTitle = targetBranch ? ` — الفرع التابع له حصراً: [${targetBranch.name}]${targetBranch.governorate ? ` (${targetBranch.governorate})` : ''}` : '';
        setSuccessMsg(`تم التحقق بنجاح! مرحباً بك [${targetUser.name}]${branchTitle}، تم تأكيد الربط الحصري بالفرع وجاري الدخول...`);
        setIsLocked(false);
        setRemainingSeconds(0);
      } else {
        if (res.isLocked) {
          setIsLocked(true);
          setRemainingSeconds(res.remainingSeconds || 600);
        }
        setErrorMsg(res.message || 'بيانات الدخول غير صحيحة. يرجى التأكد من كلمة المرور.');
      }
    }, 250);
  };

  return (
    <div
      id="courier_portal_standalone_login"
      className="min-h-screen h-screen w-screen flex flex-col justify-between bg-black text-white relative overflow-y-auto selection:bg-amber-500 selection:text-black font-['Cairo',sans-serif]"
      dir="rtl"
    >
      {/* Black & Gold visual identity ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/3 w-[550px] h-[550px] bg-amber-500/15 rounded-full blur-[160px]" />
        <div className="absolute bottom-10 left-1/3 w-[450px] h-[450px] bg-yellow-500/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:28px_28px] opacity-35" />
      </div>

      {/* TOP COMPACT BAR */}
      <header className="shrink-0 z-10 px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-amber-500/20 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <OrcaLogo size={36} showText={false} />
          <div>
            <span className="text-sm font-black text-white tracking-wide block leading-tight">
              {brandingSettings.companyName || 'أوركا إكسبريس'}
            </span>
            <span className="text-[10px] text-amber-400 font-bold block">
              منظومة الموزعين ومندوبي التوصيل
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton variant="header" />
        </div>
      </header>

      {/* MAIN DIRECT COURIER LOGIN CONTAINER */}
      <main className="flex-1 z-10 px-4 py-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-neutral-950 border-2 border-amber-500/40 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] backdrop-blur-2xl p-6 sm:p-7 space-y-4"
        >
          {/* Header & Icon */}
          <div className="flex flex-col items-center justify-center text-center pb-1">
            <div className="p-4 rounded-2xl bg-black border-2 border-amber-500/40 mb-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Truck className="w-9 h-9 text-amber-400" />
            </div>
            <h1 className="text-xl font-black text-white tracking-wide">
              بوابة مندوبي التوصيل والموزعين
            </h1>
            <p className="text-xs text-neutral-400 font-medium mt-1">
              تسليم الطرود وتأكيد الاستلام والتسوية المالية اليومية
            </p>
          </div>

          {/* Security & Lockout Notices */}
          {isLocked && (
            <div className="p-3.5 rounded-xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 text-xs flex flex-col gap-2 animate-in fade-in shadow-xl">
              <div className="flex items-center gap-2 font-black text-rose-300">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
                <span>تم تجميد هذا الحساب مؤقتاً (5 محاولات فاشلة متتالية)</span>
              </div>
              <div className="flex items-center justify-between bg-black p-2.5 rounded-lg border border-rose-500/40">
                <span className="text-[11px] text-neutral-300 font-bold">الوقت المتبقي لفك التجميد:</span>
                <span className="font-mono text-sm font-black text-amber-300 dir-ltr bg-rose-900/80 px-3 py-1 rounded border border-amber-500/40 shadow-inner">
                  {formatCountdownTimer(remainingSeconds)}
                </span>
              </div>
              <p className="text-[11px] text-rose-300/80">يرجى الانتظار لحين انتهاء العداد التنازلي لإعادة المحاولة.</p>
            </div>
          )}

          {errorMsg && !isLocked && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-bold">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* Courier Login Form */}
          <form onSubmit={handleCourierLoginSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                اسم مستخدم الموزع أو رقم الهاتف المعتمد
              </label>
              <div className="relative">
                <input
                  id="input_courier_username"
                  type="text"
                  value={courierInput}
                  onChange={(e) => setCourierInput(e.target.value)}
                  placeholder="أدخل اسم مستخدم الموزع أو رقم الهاتف المعتمد"
                  required
                  className="w-full px-3 py-2.5 pr-10 rounded-xl bg-black border border-amber-500/30 focus:border-amber-400 text-xs text-white focus:outline-none font-bold placeholder:text-neutral-600"
                />
                <Truck className="w-4 h-4 text-amber-400 absolute right-3 top-3" />
              </div>

              {/* Real-time Branch Binding Confirmation Box */}
              {matchedCourier && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2.5 p-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-xs space-y-2 shadow-inner"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-black text-white">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>الموزع: <span className="text-amber-300">{matchedCourier.name}</span></span>
                    </div>
                    {courierBranch ? (
                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ارتباط حصري مؤكد
                      </span>
                    ) : (
                      <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        غير مقترن بفرع
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-neutral-300 pt-1.5 border-t border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px] font-bold text-neutral-300">الفرع التابع له الموزع حصراً:</span>
                        <span className="font-black text-amber-300 text-xs underline decoration-amber-400/50 underline-offset-2">
                          {courierBranch ? courierBranch.name : 'لم يتم ربط هذا الموزع بأي فرع رسمي في النظام'}
                        </span>
                      </div>
                      {courierBranch?.governorate && (
                        <span className="text-[10.5px] text-neutral-400 font-bold bg-black/60 px-2 py-0.5 rounded border border-neutral-800">
                          {courierBranch.governorate}
                        </span>
                      )}
                    </div>
                    {courierBranch ? (
                      <div className="text-[10px] text-emerald-400/90 font-medium pt-0.5 flex items-center gap-1">
                        <span>✓ تم التحقق من الفرع المعتمد التابع له الموزع حصراً من قاعدة البيانات الرسمية.</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-rose-300 font-bold pt-0.5 flex items-center gap-1 bg-rose-950/60 p-1.5 rounded-lg border border-rose-500/30">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>تنبيه: يجب على إدارة النظام ربط هذا الموزع بفرع رسمي حصراً ليتمكن من تسجيل الدخول.</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-neutral-300">
                  كلمة المرور *
                </label>
              </div>
              <div className="relative">
                <input
                  id="input_courier_password"
                  type={showPassword ? 'text' : 'password'}
                  value={courierPassword}
                  onChange={(e) => setCourierPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الخاصة بحساب الموزع"
                  required
                  className="w-full px-3 py-2.5 pr-10 pl-10 rounded-xl bg-black border border-amber-500/30 focus:border-amber-400 text-xs text-white focus:outline-none font-mono placeholder:text-neutral-600"
                />
                <Lock className="w-4 h-4 text-amber-400 absolute right-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-neutral-500 hover:text-amber-400 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn_submit_courier_login"
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>جاري تسجيل الدخول...</span>
              ) : isLocked ? (
                <span>الحساب مجمد مؤقتاً ({formatCountdownTimer(remainingSeconds)})</span>
              ) : (
                <>
                  <span>دخول بوابة التوزيع</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Helper Tips */}
          <div className="pt-2 border-t border-amber-500/20 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>واجهة معزولة ومحمية لمندوبي الشحن الميدانيين</span>
            </div>
            <p className="text-[10px] text-neutral-500">
              في حال نسيان كلمة المرور يرجى مراجعة إدارة الفرع لتوليد كلمة مرور جديدة
            </p>
          </div>
        </motion.div>
      </main>

      {/* FOOTER */}
      <footer className="shrink-0 z-10 px-4 py-3 text-center text-[11px] text-neutral-500 border-t border-amber-500/20 bg-black/90">
        <span>© {new Date().getFullYear()} {brandingSettings.companyName || 'أوركا إكسبريس'} - تطبيق الموزعين</span>
      </footer>
    </div>
  );
};
