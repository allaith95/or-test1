import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ServerOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck2,
  ShieldAlert,
} from 'lucide-react';
import { checkServerReachable, SERVER_OFFLINE_NOTICE } from '../utils/serverConnectionGuard';

interface ServerOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  customMessage?: string;
}

export const ServerOfflineModal: React.FC<ServerOfflineModalProps> = ({
  isOpen,
  onClose,
  customMessage,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRetry = async () => {
    setIsChecking(true);
    setTestResult(null);
    try {
      const reachable = await checkServerReachable(true);
      if (reachable) {
        setTestResult({
          success: true,
          message: 'تمت استعادة الاتصال بالسيرفر الرئيسي بنجاح! يمكنك الآن الضغط على زر الحفظ.',
        });
        setTimeout(() => {
          onClose();
          setTestResult(null);
        }, 2000);
      } else {
        setTestResult({
          success: false,
          message: 'ما يزال السيرفر الرئيسي غير متصل. يرجى الانتظار والبقاء في هذه الصفحة.',
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="modal_server_offline_alert"
        className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none font-['Cairo',sans-serif]"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-[0_25px_60px_rgba(244,63,94,0.35)] relative overflow-hidden text-right"
        >
          {/* Top ambient highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 animate-pulse" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="إغلاق التنبيه والبقاء في الصفحة"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
              <ServerOff className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  تنبيه: انقطاع الاتصال بالسيرفر الرئيسي
                </h3>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
              </div>
              <span className="text-xs text-rose-300 font-bold block mt-0.5">
                Central Server Offline • Strict Protection Mode
              </span>
            </div>
          </div>

          {/* Core User-Requested Notice Banner */}
          <div className="bg-rose-950/70 border border-rose-500/60 rounded-xl p-3.5 sm:p-4 mb-4 shadow-sm">
            <div className="flex items-start gap-2.5 text-rose-100 text-xs sm:text-sm font-bold leading-relaxed">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>
                {customMessage || SERVER_OFFLINE_NOTICE}
              </span>
            </div>
          </div>

          {/* Data Safety Reassurance Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <FileCheck2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>بيانات الصفحة الحالية محفوظة ولم تُفقد</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed pr-6">
              تم إيقاف عملية الإرسال مؤقتاً لحماية سلامة البيانات ومنع حدوث تضارب في المزامنة. الحقول والبيانات التي أدخلتها تبقى معروضة في الصفحة الحالية دون أي مسح.
            </p>
          </div>

          {/* Real-time check feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold mb-4 flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-500 text-amber-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              البقاء ضمن الصفحة الحالية
            </button>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isChecking}
              className="w-full sm:w-auto flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'جاري فحص الاتصال بالسيرفر...' : 'إعادة فحص الاتصال الآن'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
