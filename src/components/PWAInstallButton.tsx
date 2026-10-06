import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full' | 'header';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const res = await install();
      if (res) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  // If not installable and not iOS, render a friendly desktop/general trigger if requested or return null
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {variant === 'header' ? (
        <button
          onClick={handleInstallClick}
          title="تثبيت التطبيق على الجهاز (PWA)"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600/30 via-indigo-600/30 to-purple-600/30 border border-cyan-500/40 text-cyan-300 hover:text-white hover:border-cyan-400 text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95 ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>تثبيت التطبيق</span>
        </button>
      ) : variant === 'full' ? (
        <button
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-sm shadow-md hover:shadow-cyan-500/25 active:scale-98 transition-all ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>تثبيت أوركا كـ تطبيق على الجهاز</span>
        </button>
      ) : (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium transition ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>تثبيت PWA</span>
        </button>
      )}

      {/* iOS Safari Installation Instruction Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in font-['Cairo',sans-serif]">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-cyan-500/40 p-6 shadow-2xl text-slate-100 relative space-y-4">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">تثبيت تطبيق أوركا على الآيفون / الآيباد</h3>
                <p className="text-xs text-slate-400">اتبع الخطوات البسيطة لإضافة التطبيق إلى الشاشة الرئيسية</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">1</span>
                <span>اضغط على زر **مشاركة (Share)** <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-xs">⎘</span> في شريط Safari السفلي.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">2</span>
                <span>مرر للأسفل واضغط على خيار **إضافة إلى الشاشة الرئيسية (Add to Home Screen)**.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">3</span>
                <span>تأكيد الاسم واضغط **إضافة (Add)** لتثبيت أوركا كـ تطبيق مستقل.</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition"
            >
              فهمت، إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {justInstalled && (
        <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 shadow-xl border border-emerald-400 animate-slide-in font-['Cairo',sans-serif]">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span className="font-bold text-sm">تم تثبيت تطبيق أوركا بنجاح على جهازك!</span>
        </div>
      )}
    </>
  );
};
