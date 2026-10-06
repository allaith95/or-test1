import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { WifiOff, ShieldCheck } from 'lucide-react';
import {
  getDisconnectedPageDetails,
  subscribeOfflinePageGuard,
} from '../utils/offlinePageGuard';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [details, setDetails] = useState(getDisconnectedPageDetails());

  useEffect(() => {
    return subscribeOfflinePageGuard(() => {
      setDetails(getDisconnectedPageDetails());
    });
  }, []);

  if (isOnline && !details.isConnectionSevered) return null;

  return (
    <div
      id="status_offline_single_page_guard"
      className="fixed bottom-16 right-4 z-[9999] flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-2xl bg-rose-950/95 backdrop-blur-md border border-rose-500/80 text-white px-4 py-2.5 text-xs font-bold shadow-[0_15px_30px_rgba(225,29,72,0.4)] animate-pulse font-['Cairo',sans-serif] max-w-md select-none"
      dir="rtl"
    >
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 rounded-lg bg-rose-600/30 flex items-center justify-center border border-rose-400/40 text-rose-300">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
        </div>
        <span className="text-rose-200 font-black">وضع الحماية (انقطاع الاتصال)</span>
      </div>

      <div className="text-[11px] leading-relaxed text-rose-100/90 pr-1">
        {details.disconnectedPageName ? (
          <>
            كاش الحفظ محصور حصرياً بصفحة:{' '}
            <span className="text-amber-300 font-black underline decoration-amber-400/50">
              {details.disconnectedPageName}
            </span>
            . يرجى البقاء هنا حتى عودة الاتصال بالسيرفر.
          </>
        ) : (
          'لا يوجد اتصال بالسيرفر الرئيسي، يرجى الانتظار حتى عودة الاتصال والبقاء ضمن الصفحة الحالية.'
        )}
      </div>

      <div className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30 shrink-0">
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        <span>البيانات محفوظة</span>
      </div>
    </div>
  );
};
