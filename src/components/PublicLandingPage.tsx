import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  MapPin,
  Building2,
  X,
  AlertCircle,
  Clock,
  Scan,
  Camera,
  Copy,
  Check,
  RotateCcw,
  ArrowLeft,
  History,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrcaLogo } from './OrcaLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { SyriaLogisticsNetworkMap } from './SyriaLogisticsNetworkMap';
import { Parcel } from '../types';
import { extractCleanTrackingQuery } from '../utils/BarcodeScannerUtility';
import { vpsSyncEngine } from '../services/vpsSyncEngine';
import {
  getEventLabelAr,
  getEventDimensionStyle,
  formatEventTimestamp,
} from '../utils/parcelTimelineHelpers';

interface PublicLandingPageProps {
  // Pure public showcase & tracking interface - completely isolated from internal and portal links
}

interface PublicEventDto {
  id: string;
  eventType: string;
  dimension: string;
  newStatus?: string;
  timestamp: string;
}

interface PublicTimelineDto {
  trackingNumber: string;
  currentStatus: string;
  currentLocationBranchId?: string;
  events: PublicEventDto[];
  eventsCount: number;
  firstEventAt?: string;
  lastEventAt?: string;
  transitDurationMs?: number;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = () => {
  const { parcels, branches, brandingSettings, parcelEvents } = useOrca();

  const [rawInput, setRawInput] = useState('');
  const [searchedParcel, setSearchedParcel] = useState<Parcel | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  const [publicTimeline, setPublicTimeline] = useState<PublicTimelineDto | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Live Syrian Time
  const [currentTime, setCurrentTime] = useState<string>('');

  // Camera Barcode Scanner State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Hardware Barcode Scanner Buffer
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Initial silent cloud pull on mount to make sure latest parcels are available
  useEffect(() => {
    vpsSyncEngine.pullFullDatabaseFromCloud().catch(() => {});
  }, []);

  // Damascus Clock
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

  const fetchPublicTimeline = useCallback(
    async (parcelIdOrTracking: string) => {
      setTimelineLoading(true);
      try {
        const res = await fetch(
          `/api/parcels/${encodeURIComponent(parcelIdOrTracking)}/timeline?public=1`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPublicTimeline(data);
      } catch (err) {
        console.warn('[Public Timeline] API unavailable, using fallback');
        setPublicTimeline(null);
      } finally {
        setTimelineLoading(false);
      }
    },
    []
  );

  // Core Search Function
  const performSearch = (inputQuery: string) => {
    const clean = extractCleanTrackingQuery(inputQuery);
    if (!clean) {
      setSearchError('يرجى إدخال رقم البوليصة أو مسح شريط الباركود');
      setSearchedParcel(null);
      setHasSearched(true);
      setPublicTimeline(null);
      setTimelineExpanded(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    // Give a smooth fast feedback feel (150ms)
    setTimeout(() => {
      const normalizedQuery = clean.toLowerCase();
      const match = parcels.find((p) => {
        const tr = (p.trackingNumber || '').toLowerCase();
        const rc = (p.paperReceiptNumber || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        return (
          tr === normalizedQuery ||
          rc === normalizedQuery ||
          id === normalizedQuery ||
          tr.includes(normalizedQuery) ||
          rc.includes(normalizedQuery)
        );
      });

      setIsSearching(false);
      setHasSearched(true);

      if (match) {
        setSearchedParcel(match);
        setSearchError(null);
        setTimelineExpanded(false);
        setPublicTimeline(null);
        void fetchPublicTimeline(match.id);
      } else {
        setSearchedParcel(null);
        setSearchError(`لم يتم العثور على أي شحنة مطابقة لرقم البوليصة أو الباركود: "${clean}"`);
        setPublicTimeline(null);
        setTimelineExpanded(false);
      }
    }, 150);
  };

  // Hardware Scanner Global Listener (Xenon / Zebra / Datalogic / Generic USB/BT Barcode Reader)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore functional controls
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) {
        return;
      }

      const activeElem = document.activeElement;
      const isInputFocused =
        activeElem &&
        (activeElem.tagName === 'INPUT' ||
          activeElem.tagName === 'TEXTAREA' ||
          (activeElem as HTMLElement).isContentEditable);

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key indicates end of barcode reader transmission
      if (e.key === 'Enter' || e.keyCode === 13) {
        if (barcodeBufferRef.current.length >= 4) {
          const scannedText = barcodeBufferRef.current;
          barcodeBufferRef.current = '';
          setRawInput(scannedText);
          performSearch(scannedText);
          return;
        }
        barcodeBufferRef.current = '';
        return;
      }

      // If typed manually with large interval, reset buffer
      if (timeDiff > 120 && barcodeBufferRef.current.length > 0) {
        barcodeBufferRef.current = '';
      }

      if (e.key.length === 1 && !isInputFocused) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [parcels]);

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(rawInput);
  };

  // Handle Copy Tracking
  const handleCopy = (text: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  // Camera Barcode Scanner Handler
  const startCameraScanner = async () => {
    setCameraError(null);
    setIsCameraScannerOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('الكاميرا غير مدعومة في هذا المتصفح');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      scannerStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // If native BarcodeDetector API is supported
      if ('BarcodeDetector' in window) {
        // @ts-ignore
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8', 'itf'],
        });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                if (detectedVal) {
                  stopCameraScanner();
                  setRawInput(detectedVal);
                  performSearch(detectedVal);
                }
              }
            } catch {
              // Ignore single frame detect errors
            }
          }
        }, 200);
      }
    } catch (err: any) {
      setCameraError('تعذر فتح الكاميرا، يرجى منح إذن الوصول للكاميرا');
    }
  };

  const stopCameraScanner = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach((track) => track.stop());
      scannerStreamRef.current = null;
    }
    setIsCameraScannerOpen(false);
  };

  // Helper to resolve city names
  const getBranchCityName = (branchId?: string) => {
    if (!branchId) return 'المركز الرئيسي';
    const b = branches.find((x) => x.id === branchId || x.code === branchId);
    return b ? b.name || b.city : 'فرع أوركا';
  };

  // Timeline Step Status Helper
  const getTimelineStep = (parcel: Parcel) => {
    switch (parcel.handlingStatus) {
      case 'delivered':
      case 'delivered_uncollected':
        return 4;
      case 'received_at_dest':
      case 'with_courier':
      case 'out_for_delivery':
        return 3;
      case 'in_transit':
      case 'loaded_in_truck':
        return 2;
      case 'received_at_hub':
      case 'received_at_origin_hub':
      default:
        return 1;
    }
  };

  // Parcel status badge helper
  const renderParcelStatusBadge = (p: Parcel) => {
    switch (p.handlingStatus) {
      case 'delivered':
      case 'delivered_uncollected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>تم التسليم</span>
          </span>
        );
      case 'in_transit':
      case 'loaded_in_truck':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20">
            <Truck className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>قيد الشحن البري</span>
          </span>
        );
      case 'received_at_dest':
      case 'with_courier':
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-yellow-400" />
            <span>بفرع الوجهة</span>
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>مرتجعة</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-slate-800 text-amber-300 border border-amber-500/30 shadow-sm">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span>تم الاستلام بالفرع</span>
          </span>
        );
    }
  };

  return (
    <div
      id="public_tracking_root"
      className="h-screen max-h-screen w-screen flex flex-col justify-between bg-slate-950 text-slate-100 relative overflow-hidden font-['Cairo',sans-serif] select-none"
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
              منظومة تتبع الشحنات البرية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PWAInstallButton variant="header" />

          {/* Live Damascus Clock */}
          {currentTime && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>توقيت دمشق:</span>
              <span className="text-white font-bold">{currentTime}</span>
            </div>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. SPLIT WORKSPACE: 70% SYRIA MAP ON RIGHT / 30% TRACKING CARD ON LEFT    */}
      {/* ========================================================================= */}
      <main className="flex-1 z-20 px-4 sm:px-6 lg:px-10 py-4 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8 max-w-[1800px] w-full mx-auto overflow-hidden">
        
        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT COLUMN (70%): FULL BORDERLESS SYRIA LOGISTICS NETWORK MAP         */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full lg:w-[64%] xl:w-[68%] h-[320px] sm:h-[420px] lg:h-full flex items-center justify-center relative overflow-hidden order-2 lg:order-1">
          <div className="w-full h-full flex items-center justify-center p-2">
            <SyriaLogisticsNetworkMap
              className="w-full h-full max-h-[calc(100vh-130px)]"
            />
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* LEFT COLUMN (30%): FROSTED ULTRA-GLASS FLOATING TRACKING CARD           */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full lg:w-[36%] xl:w-[32%] max-w-lg shrink-0 flex items-center justify-center order-1 lg:order-2 overflow-y-auto max-h-[calc(100vh-130px)] pr-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full bg-slate-900/85 border border-amber-500/30 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(245,186,19,0.06)] backdrop-blur-2xl p-5 sm:p-6 space-y-4 relative"
          >
            {/* Top Logo & Title */}
            <div className="text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-slate-950/80 p-1.5 flex items-center justify-center border-2 border-amber-500/40 shadow-xl shadow-amber-500/15 mb-2 backdrop-blur-md">
                <OrcaLogo size={38} showText={false} circularBg={false} />
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                تتبع الشحنات والطرود
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                أدخل رقم البوليصة أو امسح الباركود لعرض الحالة المباشرة
              </p>
            </div>

            {/* FLOATING INPUT FORM */}
            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div className="relative">
                <div
                  className={`relative flex items-center rounded-2xl bg-slate-950/70 backdrop-blur-md border transition-all duration-200 px-3.5 py-2.5 ${
                    isFocused
                      ? 'border-amber-400 ring-2 ring-amber-400/25 shadow-lg shadow-amber-400/15 bg-slate-950/90'
                      : 'border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  {/* Barcode Scanner Icon */}
                  <div className="shrink-0 pl-2.5">
                    <Scan
                      className={`w-4 h-4 transition-colors ${
                        isFocused ? 'text-amber-400 animate-pulse' : 'text-slate-400'
                      }`}
                    />
                  </div>

                  {/* Floating Label & Input Field */}
                  <div className="flex-1 flex flex-col">
                    <span
                      className={`text-[9px] font-bold transition-all ${
                        isFocused || rawInput
                          ? 'text-amber-400 scale-100'
                          : 'text-slate-400'
                      }`}
                    >
                      رقم البوليصة أو مسح الباركود
                    </span>
                    <input
                      id="input_tracking_number"
                      type="text"
                      value={rawInput}
                      onChange={(e) => setRawInput(e.target.value)}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder="مثال: ORK-2026-1029 أو امسح الباركود"
                      required
                      autoComplete="off"
                      className="w-full bg-transparent text-white font-mono font-bold text-xs sm:text-sm focus:outline-none placeholder:text-slate-600 pt-0.5 tracking-wider"
                      dir="ltr"
                    />
                  </div>

                  {/* Right Action Icons: Clear & Camera Scanner */}
                  <div className="flex items-center gap-1 pr-1">
                    {rawInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setRawInput('');
                          setSearchedParcel(null);
                          setHasSearched(false);
                          setSearchError(null);
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                        title="مسح الحقل"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={startCameraScanner}
                      className="p-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold shadow-sm"
                      title="مسح الباركود بكاميرا الموبايل / الجهاز"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">كاميرا</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                id="btn_submit_tracking"
                type="submit"
                disabled={isSearching || !rawInput.trim()}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99]"
              >
                {isSearching ? (
                  <div className="flex items-center gap-2 font-bold">
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>جاري التتبع...</span>
                  </div>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>تتبع الشحنة</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* ERROR ALERT */}
            <AnimatePresence>
              {searchError && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <div className="flex-1">
                    <p className="font-bold text-[11px]">{searchError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SEARCH RESULT FLOATING DETAILS */}
            <AnimatePresence>
              {searchedParcel && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  className="space-y-3 pt-2 border-t border-slate-800"
                >
                  {/* Result Header & Status */}
                  <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">رقم البوليصة:</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-sm font-black text-amber-400 tracking-wider" dir="ltr">
                          {searchedParcel.trackingNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(searchedParcel.trackingNumber)}
                          className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
                          title="نسخ رقم البوليصة"
                        >
                          {copiedTracking ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>{renderParcelStatusBadge(searchedParcel)}</div>
                  </div>

                  {/* Logistics Route Connection */}
                  <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-400 font-bold block">الفرع المصدر:</span>
                      <div className="flex items-center gap-1 font-bold text-white text-[11px]">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        <span>{getBranchCityName(searchedParcel.originCollectionBranchId || searchedParcel.originHubId)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center px-2">
                      <div className="flex items-center gap-0.5 text-amber-400">
                        <span className="w-4 h-0.5 bg-amber-500/40" />
                        <Truck className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                        <span className="w-4 h-0.5 bg-amber-500/40" />
                      </div>
                      <span className="text-[8px] text-slate-400 font-bold">شحن بري</span>
                    </div>

                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] text-slate-400 font-bold block">فرع الوجهة:</span>
                      <div className="flex items-center gap-1 font-bold text-white text-[11px] justify-end">
                        <span>{getBranchCityName(searchedParcel.destinationHubId)}</span>
                        <Building2 className="w-3 h-3 text-yellow-400" />
                      </div>
                    </div>
                  </div>

                  {/* 4-Step Interactive Timeline */}
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-300 block mb-2.5">
                      خط سير الشحنة:
                    </span>
                    
                    <div className="relative flex items-center justify-between">
                      {/* Background connecting bar */}
                      <div className="absolute top-1/2 left-3 right-3 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
                      <div
                        className="absolute top-1/2 right-3 h-0.5 bg-gradient-to-l from-emerald-500 to-amber-500 -translate-y-1/2 z-0 transition-all duration-500"
                        style={{
                          width: `${((getTimelineStep(searchedParcel) - 1) / 3) * 100}%`,
                        }}
                      />

                      {/* Step 1: Received */}
                      <div className="flex flex-col items-center relative z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition ${
                            getTimelineStep(searchedParcel) >= 1
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/30'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          ✓
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold mt-1">الاستلام</span>
                      </div>

                      {/* Step 2: Transit */}
                      <div className="flex flex-col items-center relative z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition ${
                            getTimelineStep(searchedParcel) >= 2
                              ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/30'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          {getTimelineStep(searchedParcel) > 2 ? '✓' : '2'}
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold mt-1">الشحن البري</span>
                      </div>

                      {/* Step 3: Arrived Dest */}
                      <div className="flex flex-col items-center relative z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition ${
                            getTimelineStep(searchedParcel) >= 3
                              ? 'bg-yellow-500 border-yellow-400 text-slate-950 shadow-md shadow-yellow-500/30'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          {getTimelineStep(searchedParcel) > 3 ? '✓' : '3'}
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold mt-1">فرع الوصول</span>
                      </div>

                      {/* Step 4: Delivered */}
                      <div className="flex flex-col items-center relative z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition ${
                            getTimelineStep(searchedParcel) >= 4
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/30'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          {getTimelineStep(searchedParcel) >= 4 ? '✓' : '4'}
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold mt-1">التسليم</span>
                      </div>
                    </div>
                  </div>

                  {/* Reset Search Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setRawInput('');
                      setSearchedParcel(null);
                      setHasSearched(false);
                      setSearchError(null);
                    }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>تتبع شحنة أخرى</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 4. CAMERA SCANNER MODAL (On-Demand)                                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCameraScannerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">قارئ الباركود عبر الكاميرا</h3>
                </div>
                <button
                  type="button"
                  onClick={stopCameraScanner}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video Preview */}
              <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
                {cameraError ? (
                  <div className="text-center p-4 space-y-2">
                    <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                    <p className="text-xs text-rose-300 font-bold">{cameraError}</p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />

                    {/* Red Scanning Laser Line */}
                    <div className="absolute inset-x-8 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-pulse" />

                    {/* Focus Reticle */}
                    <div className="absolute inset-10 border-2 border-amber-400/60 rounded-xl pointer-events-none" />
                  </>
                )}
              </div>

              <p className="text-center text-[11px] text-slate-400 font-medium">
                وجه كاميرا الجهاز نحو شريط الباركود الموجود أعلى بوليصة الشحن
              </p>

              <button
                type="button"
                onClick={stopCameraScanner}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                إلغاء وإغلاق الكاميرا
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. MINIMALIST PROFESSIONAL FOOTER                                         */}
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
