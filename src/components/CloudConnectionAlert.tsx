import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useOrca } from '../context/OrcaContext';
import { deriveConnectionState } from '../utils/connectionState';

interface CloudConnectionAlertProps {
  initialSimulatedOffline?: boolean;
}

export const CloudConnectionAlert: React.FC<CloudConnectionAlertProps> = () => {
  const { cloudSyncState } = useOrca();
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const prevState = useRef<string>('');

  // Listen to browser network changes
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const info = deriveConnectionState(cloudSyncState, isOnline);

  // Detect reconnection transition → show "reconnected" for 3s
  useEffect(() => {
    const wasState = prevState.current;
    prevState.current = info.state;

    if (
      wasState &&
      wasState !== 'CONNECTED' &&
      info.state === 'CONNECTED'
    ) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [info.state]);

  const colorClasses = {
    rose: 'bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-[0_10px_30px_rgba(244,63,94,0.35)]',
    amber: 'bg-amber-950/95 border-amber-500/80 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.35)]',
    orange: 'bg-orange-950/95 border-orange-500/80 text-orange-100 shadow-[0_10px_30px_rgba(249,115,22,0.35)]',
    emerald: 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.35)]',
  };

  const Icon =
    info.icon === 'offline'
      ? WifiOff
      : info.icon === 'syncing'
      ? RefreshCw
      : info.icon === 'warning'
      ? AlertTriangle
      : CheckCircle2;

  return (
    <AnimatePresence>
      {/* 1. Brief success message when connection is restored */}
      {showReconnected && info.state === 'CONNECTED' && (
        <motion.div
          key="banner_reconnected"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-950/95 border border-emerald-500/80 rounded-2xl px-5 py-2.5 flex items-center gap-2.5 shadow-[0_15px_35px_rgba(16,185,129,0.4)] backdrop-blur-md select-none font-['Cairo',sans-serif]"
          dir="rtl"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-emerald-100">
            تمت المزامنة بنجاح واستقرار الاتصال بالسيرفر
          </span>
        </motion.div>
      )}

      {/* 2. Unified banner for DISCONNECTED / RECONNECTING */}
      {info.showBanner && (
        <motion.div
          key="banner_connection_info"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] border rounded-2xl px-5 py-2.5 flex items-center gap-3 backdrop-blur-md select-none max-w-lg font-['Cairo',sans-serif] ${
            colorClasses[info.color]
          }`}
          dir="rtl"
        >
          <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Icon
              className={`w-3.5 h-3.5 shrink-0 ${
                info.icon === 'syncing' ? 'animate-spin' : ''
              }`}
            />
          </div>
          <div className="text-xs font-bold leading-relaxed text-right">
            {info.bannerMessage || info.label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
