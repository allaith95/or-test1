import React, { useState, useEffect } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  User as UserIcon,
  Search,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'motion/react';
import { OrcaLogo } from './OrcaLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { Parcel } from '../types';
import { checkLockoutState, formatCountdownTimer } from '../utils/lockoutHelper';

interface CustomerPortalLoginScreenProps {
  // Pure Customer Portal Login - No Staff Navigation
}

export const CustomerPortalLoginScreen: React.FC<CustomerPortalLoginScreenProps> = () => {
  const {
    brandingSettings,
    loginCustomer,
    parcels,
    branches,
    formatCurrency,
  } = useOrca();

  // Mode: 'login' (registered customer account) | 'track_only' (public parcel search)
  const [activeTab, setActiveTab] = useState<'login' | 'track_only'>('login');

  // Customer account credentials
  const [customerInput, setCustomerInput] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Temporary Account Lockout state
  const [isLocked, setIsLocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Check lockout status on customerInput change
  useEffect(() => {
    if (!customerInput.trim()) {
      setIsLocked(false);
      setRemainingSeconds(0);
      return;
    }
    const state = checkLockoutState(customerInput.trim());
    setIsLocked(state.isLocked);
    setRemainingSeconds(state.remainingSeconds);
  }, [customerInput]);

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

  // Direct parcel tracking state
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [trackedParcel, setTrackedParcel] = useState<Parcel | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [isSearchingParcel, setIsSearchingParcel] = useState(false);

  // Handle Account Login
  const handleCustomerLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!customerInput.trim()) {
      setErrorMsg('يرجى إدخال رقم الهاتف أو اسم المستخدم أو كود العميل');
      return;
    }

    if (!customerPassword.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = loginCustomer(customerInput.trim(), customerPassword.trim());
      setIsLoading(false);
      if (res.success) {
        setSuccessMsg(`تم تسجيل الدخول بنجاح`);
        setIsLocked(false);
        setRemainingSeconds(0);
      } else {
        if (res.isLocked) {
          setIsLocked(true);
          setRemainingSeconds(res.remainingSeconds || 600);
        }
        setErrorMsg(res.message || 'بيانات الدخول غير صحيحة. يرجى التحقق من رقم الهاتف أو كلمة المرور.');
      }
    }, 250);
  };

  // Handle Public Tracking Search
  const handleTrackParcelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    setTrackedParcel(null);

    const q = trackingNumberInput.trim().toUpperCase();
    if (!q) {
      setTrackError('يرجى كتابة رقم البوليصة');
      return;
    }

    setIsSearchingParcel(true);
    setTimeout(() => {
      setIsSearchingParcel(false);
      const found = parcels.find(
        (p) =>
          p.trackingNumber.toUpperCase() === q ||
          p.trackingNumber.toUpperCase().includes(q) ||
          p.id.toUpperCase() === q
      );

      if (found) {
        setTrackedParcel(found);
      } else {
        setTrackError(`لم يتم العثور على شحنة برقم [${q}]`);
      }
    }, 250);
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return 'الفرع الرئيسي';
    const b = branches.find((item) => item.id === branchId || item.code === branchId);
    return b ? b.name : branchId;
  };

  const getHandlingStatusLabel = (status: Parcel['handlingStatus']) => {
    switch (status) {
      case 'received_at_origin_hub':
      case 'received_at_hub':
        return 'جاهزة للإرسال';
      case 'loaded_in_truck':
        return 'محملة بالشاحنة';
      case 'in_transit':
        return 'قيد النقل بين المحافظات';
      case 'received_at_dest':
        return 'وصلت فرع الوجهة (جاهزة للتسليم)';
      case 'with_courier':
        return 'مع المندوب للتسليم';
      case 'delivered':
        return 'تم التسليم بنجاح ✅';
      case 'returned':
        return 'مرتجعة إلى المرسل';
      default:
        return 'قيد المعالجة';
    }
  };

  return (
    <div
      id="customer_portal_standalone_login"
      className="min-h-screen h-screen w-screen flex flex-col justify-between bg-black text-white relative overflow-y-auto selection:bg-amber-500 selection:text-black font-['Cairo',sans-serif]"
      dir="rtl"
    >
      {/* Background ambient lighting in pure Black & Gold */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/3 w-[550px] h-[550px] bg-amber-500/15 rounded-full blur-[160px]" />
        <div className="absolute bottom-10 left-1/3 w-[450px] h-[450px] bg-yellow-500/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:28px_28px] opacity-35" />
      </div>

      {/* TOP COMPACT BAR */}
      <header className="shrink-0 z-10 px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-amber-500/20 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <OrcaLogo size={36} showText={false} />
          <span className="text-sm font-black text-white tracking-wide">
            {brandingSettings.companyName || 'أوركا إكسبريس'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton variant="header" />
        </div>
      </header>

      {/* MAIN DIRECT LOGIN CONTAINER */}
      <main className="flex-1 z-10 px-4 py-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-neutral-950 border-2 border-amber-500/40 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] backdrop-blur-2xl p-6 sm:p-7 space-y-4"
        >
          {/* Logo & Direct Header */}
          <div className="flex flex-col items-center justify-center text-center pb-1">
            <div className="p-3.5 rounded-2xl bg-black border border-amber-500/30 mb-2 shadow-inner">
              <OrcaLogo size={52} showText={false} />
            </div>
            <h1 className="text-lg font-black text-white tracking-wide">
              {brandingSettings.companyName || 'أوركا إكسبريس'}
            </h1>
            <span className="text-xs text-amber-400 font-black mt-0.5 tracking-wider">
              بوابة الزبائن الشاملة
            </span>
          </div>

          {/* Direct Tab Selector */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-black rounded-xl border border-amber-500/30">
            <button
              type="button"
              id="tab_customer_login"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-md shadow-amber-500/20 font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>تسجيل الدخول</span>
            </button>

            <button
              type="button"
              id="tab_public_track"
              onClick={() => {
                setActiveTab('track_only');
                setTrackError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'track_only'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-md shadow-amber-500/20 font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>تتبع شحنة</span>
            </button>
          </div>

          {/* Status Notices */}
          {isLocked && (
            <div className="p-3.5 rounded-xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 text-xs flex flex-col gap-2 animate-in fade-in shadow-xl">
              <div className="flex items-center gap-2 font-black text-rose-300">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
                <span>تم تجميد هذا الحساب مؤقتاً (5 محاولات فاشلة متتالية)</span>
              </div>
              <div className="flex items-center justify-between bg-black p-2.5 rounded-lg border border-rose-500/40">
                <span className="text-[11px] text-neutral-300 font-bold">الوقت المتبقي لفك التجميد تلقائياً:</span>
                <span className="font-mono text-sm font-black text-amber-300 dir-ltr bg-rose-900/80 px-3 py-1 rounded border border-amber-500/40 shadow-inner">
                  {formatCountdownTimer(remainingSeconds)}
                </span>
              </div>
              <p className="text-[11px] text-rose-300/80">يرجى الانتظار لحين انتهاء العداد التنازلي الموضح أعلاه لإعادة محاولة تسجيل الدخول.</p>
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

          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleCustomerLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  رقم الهاتف أو اسم المستخدم
                </label>
                <div className="relative">
                  <input
                    id="input_customer_portal_identifier"
                    type="text"
                    value={customerInput}
                    onChange={(e) => setCustomerInput(e.target.value)}
                    placeholder="رقم الهاتف أو كود العميل"
                    required
                    className="w-full px-3 py-2.5 pr-10 rounded-xl bg-black border border-amber-500/30 focus:border-amber-400 text-xs text-white focus:outline-none font-bold placeholder:text-neutral-600"
                  />
                  <UserIcon className="w-4 h-4 text-amber-400 absolute right-3 top-3" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-neutral-300">
                    كلمة المرور *
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="input_customer_portal_password"
                    type={showPassword ? 'text' : 'password'}
                    value={customerPassword}
                    onChange={(e) => setCustomerPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
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
                id="btn_submit_customer_portal_login"
                type="submit"
                disabled={isLoading || isLocked}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span>جاري الدخول...</span>
                ) : isLocked ? (
                  <span>الحساب مجمد مؤقتاً ({formatCountdownTimer(remainingSeconds)})</span>
                ) : (
                  <>
                    <span>دخول الحساب</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: INSTANT DIRECT TRACKING */}
          {activeTab === 'track_only' && (
            <div className="space-y-3">
              <form onSubmit={handleTrackParcelSubmit} className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="input_public_tracking_number"
                      type="text"
                      value={trackingNumberInput}
                      onChange={(e) => setTrackingNumberInput(e.target.value)}
                      placeholder="رقم البوليصة (SY-10001)"
                      className="w-full px-3 py-2.5 pr-10 rounded-xl bg-black border border-amber-500/30 focus:border-amber-400 text-xs text-white focus:outline-none font-mono uppercase font-bold placeholder:text-neutral-600"
                    />
                    <Search className="w-4 h-4 text-amber-400 absolute right-3 top-3" />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingParcel}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black text-xs font-black shadow transition shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isSearchingParcel ? 'بحث...' : 'تتبع'}
                  </button>
                </div>
              </form>

              {trackError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{trackError}</span>
                </div>
              )}

              {trackedParcel && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-2xl bg-black border border-amber-500/40 space-y-2.5"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-bold">رقم الشحنة</span>
                      <span className="font-mono font-black text-sm text-amber-400">
                        {trackedParcel.trackingNumber}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {getHandlingStatusLabel(trackedParcel.handlingStatus)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block">من:</span>
                      <strong className="text-white font-bold">{getBranchName(trackedParcel.originHubId)}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block">إلى:</span>
                      <strong className="text-white font-bold">{getBranchName(trackedParcel.destinationHubId)}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block">المستلم:</span>
                      <strong className="text-white font-bold">{trackedParcel.receiver.name}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <span className="text-[10px] text-neutral-400 block">قيمة الـ COD:</span>
                      <strong className="text-amber-400 font-mono font-black">
                        {trackedParcel.paymentType === 'cod' && trackedParcel.codAmount > 0
                          ? formatCurrency(trackedParcel.codAmount, trackedParcel.codCurrency || trackedParcel.currency)
                          : 'مدفوع'}
                      </strong>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* FOOTER */}
      <footer className="shrink-0 z-10 px-4 py-3 text-center text-[11px] text-neutral-500 border-t border-amber-500/20 bg-black/90">
        <span>© {new Date().getFullYear()} {brandingSettings.companyName || 'أوركا إكسبريس'}</span>
      </footer>
    </div>
  );
};
