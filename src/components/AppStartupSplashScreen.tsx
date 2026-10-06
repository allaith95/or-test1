import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import officialLogoImg from '../assets/images/orca_express_logo_1789468188740.jpg';

interface AppStartupSplashScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

export const AppStartupSplashScreen: React.FC<AppStartupSplashScreenProps> = ({
  onComplete,
  minDurationMs = 450,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculated = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
      setProgress(calculated);

      if (elapsed >= minDurationMs) {
        clearInterval(interval);
        if (onComplete) {
          onComplete();
        }
      }
    }, 16);

    return () => clearInterval(interval);
  }, [minDurationMs, onComplete]);

  const handleSkip = () => {
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <motion.div
      id="orca_app_startup_splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.25, ease: 'easeOut' } }}
      onClick={handleSkip}
      className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 select-none overflow-hidden font-['Cairo',sans-serif] cursor-pointer transform-gpu"
    >
      {/* Subtle Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(6,182,212,0.12),rgba(15,23,42,0)_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_65%,rgba(245,158,11,0.06),rgba(15,23,42,0)_60%)] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">
        {/* App Logo */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative mb-5"
        >
          {/* Logo Glow Ring */}
          <div className="absolute -inset-1.5 bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-amber-500/20 rounded-2xl blur-sm animate-pulse" />
          
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-black/90 border border-slate-700/80 p-1.5 shadow-2xl flex items-center justify-center overflow-hidden">
            <img
              src={officialLogoImg}
              alt="Orca Express"
              className="w-full h-full object-contain"
            />
          </div>
        </motion.div>

        {/* App Title & Subtitle */}
        <div className="space-y-1 mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>أوركا إكسبريس</span>
            <span className="text-cyan-400 font-mono text-xs tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
              ORCA
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            منظومة إدارة الشحن والخدمات اللوجستية
          </p>
        </div>

        {/* Distinctive Animated Progress Bar */}
        <div className="w-full space-y-2 px-4">
          {/* Progress Track */}
          <div className="relative h-1.5 w-full bg-slate-900/90 rounded-full overflow-hidden border border-slate-800 shadow-inner">
            {/* Animated Fill Bar */}
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-amber-400 rounded-full relative transition-all duration-75 ease-out"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer Light Beam Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            </div>
          </div>

          {/* Progress percentage & status */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="font-sans font-medium text-slate-400">
              {progress < 50 ? 'تهيئة النظام...' : 'جاهز للانطلاق...'}
            </span>
            <span className="text-cyan-300 font-bold">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-5 text-center text-[10px] text-slate-500 font-mono">
        Orca Express • Enterprise Logistics
      </div>
    </motion.div>
  );
};
