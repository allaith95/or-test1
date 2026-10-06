import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOrca } from '../context/OrcaContext';
import { safePrint, safeStorage } from '../utils/storage';
import {
  Printer,
  X,
  Scissors,
  Check,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Layers,
  DollarSign,
  Barcode as BarcodeIcon,
  ShieldCheck,
  Eye,
  EyeOff,
  UserCheck,
  Phone,
  Hash,
  Scale,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Settings2,
  CheckCircle2,
  RefreshCw,
  User,
  MapPin,
  Package,
  Truck,
  FileText,
  Coins,
  QrCode,
  Building2,
  Copy,
  ArrowLeft,
} from 'lucide-react';
import { OrcaLogo } from './OrcaLogo';
import { WaybillQRCode } from './WaybillQRCode';
import { WaybillBarcode } from './WaybillBarcode';
import { Parcel } from '../types';
import { getParcelPaymentSummary } from '../utils/settlementMath';

export const PrintModal: React.FC = () => {
  const {
    currentUser,
    isPrintModalOpen,
    printModalType,
    selectedParcelForPrint,
    selectedManifestForPrint,
    closePrintModal,
    branches,
    parcels,
    truckManifests,
    brandingSettings,
    formatCurrency,
    formatNumber,
    formatQuantity,
  } = useOrca();

  const extractWeightAndTypeNote = (pObj: Parcel): string => {
    if (pObj.packageNotes && pObj.packageNotes.trim()) {
      return pObj.packageNotes.trim();
    }
    if (pObj.specialInstructions && pObj.specialInstructions.includes('ملاحظة الوزن والنوع:')) {
      const match = pObj.specialInstructions.match(/ملاحظة الوزن والنوع:\s*([^|]+)/);
      if (match && match[1]) return match[1].trim();
    }
    return '';
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const printAreaRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------
  // PRE-CUT PERFORATED PAPER (نظام الورق المجهز والمقصوص مسبقاً 9.8 سم)
  // -------------------------------------------------------------
  const [isPreCutPaper, setIsPreCutPaper] = useState<boolean>(() => {
    const saved = safeStorage.getItem('orca_waybill_precut_enabled');
    return saved !== null ? saved === 'true' : true; // Default true as officially adopted
  });
  const [verticalOffsetMm, setVerticalOffsetMm] = useState<number>(() => {
    const saved = safeStorage.getItem('orca_waybill_offset_mm');
    return saved !== null ? parseFloat(saved) || 0 : 0;
  });

  const togglePreCutPaper = (enabled: boolean) => {
    setIsPreCutPaper(enabled);
    safeStorage.setItem('orca_waybill_precut_enabled', String(enabled));
    if (enabled) {
      setShowSenderCopy(true);
      setShowReceiverCopy(true);
      setShowArchiveCopy(true);
      setFillFullPage(true);
    }
  };

  const changeVerticalOffset = (offset: number) => {
    const clamped = Math.max(-5, Math.min(5, Math.round(offset * 2) / 2));
    setVerticalOffsetMm(clamped);
    safeStorage.setItem('orca_waybill_offset_mm', String(clamped));
  };

  // -------------------------------------------------------------
  // WAYBILL COPIES VISIBILITY CONTROLS (نسخة مرسل / نسخة مستلم / نسخة أرشفة)
  // -------------------------------------------------------------
  const [showSenderCopy, setShowSenderCopy] = useState(true);
  const [showReceiverCopy, setShowReceiverCopy] = useState(true);
  const [showArchiveCopy, setShowArchiveCopy] = useState(true);

  // DETAIL TOGGLES (تفاصيل وعناصر الإظهار)
  const [showQrCode, setShowQrCode] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showCompanyHeader, setShowCompanyHeader] = useState(true);
  const [showFinancials, setShowFinancials] = useState(true);
  const [showLegalTerms, setShowLegalTerms] = useState(true);
  const [showSenderCivilData, setShowSenderCivilData] = useState(true);
  const [showHandlingNotes, setShowHandlingNotes] = useState(true);
  const [showCutLines, setShowCutLines] = useState(true);
  const [pureWhiteMode, setPureWhiteMode] = useState(false); // Eco ink-saving mode
  const [copiedQr, setCopiedQr] = useState(false);

  // -------------------------------------------------------------
  // DIMENSION & EXPANSION CONTROLS (أبعاد وتوسيع النسخ)
  // -------------------------------------------------------------
  const [fillFullPage, setFillFullPage] = useState(true); // Fill entire A4 page vertically
  const [fontScale, setFontScale] = useState<number>(100); // 85 to 120%
  const [contentPadding, setContentPadding] = useState<'compact' | 'normal' | 'generous'>('normal');
  const [gapSize, setGapSize] = useState<'compact' | 'normal' | 'generous'>('normal');

  // Per-copy height expansion mode:
  const [senderCopyStretch, setSenderCopyStretch] = useState<'auto' | 'grow' | 'tall'>('grow');
  const [receiverCopyStretch, setReceiverCopyStretch] = useState<'auto' | 'grow' | 'tall'>('grow');
  const [archiveCopyStretch, setArchiveCopyStretch] = useState<'auto' | 'grow' | 'tall'>('grow');

  // Preview viewport screen zoom (ملاءمة الصفحة للشاشة لتراها بالكامل مباشرة)
  const [viewZoom, setViewZoom] = useState<'fit' | '75' | '90' | '100'>('fit');

  // -------------------------------------------------------------
  // MASTER TRUCK MANIFEST A4 VISIBILITY & DISPLAY CONTROLS
  // خيارات التحكم بالإظهار والإخفاء لوثيقة المانافيست
  // -------------------------------------------------------------
  // 1. Focus on Parcel details (الوضع الافتراضي: رقم الطرد، نوع الطرد، وعدد الطرود فقط)
  const [manifestShowParcelTracking, setManifestShowParcelTracking] = useState(true);
  const [manifestShowParcelType, setManifestShowParcelType] = useState(true);
  const [manifestShowPiecesCount, setManifestShowPiecesCount] = useState(true);
  const [manifestShowParcelWeight, setManifestShowParcelWeight] = useState(false);
  const [manifestShowParcelNotes, setManifestShowParcelNotes] = useState(false);

  // 2. Focus on Parties: Sender & Receiver (الافتراضي: اسم وهاتف المرسل، واسم وهاتف المستلم)
  const [manifestShowSenderName, setManifestShowSenderName] = useState(true);
  const [manifestShowSenderPhone, setManifestShowSenderPhone] = useState(true);
  const [manifestShowReceiverName, setManifestShowReceiverName] = useState(true);
  const [manifestShowReceiverPhone, setManifestShowReceiverPhone] = useState(true);
  const [manifestShowReceiverAddress, setManifestShowReceiverAddress] = useState(false);
  const [manifestHighlightReceiver, setManifestHighlightReceiver] = useState(false);

  // 3. Financials as Options (الأمور المالية: معطلة افتراضياً للتبسيط والنظافة)
  const [manifestShowFinancials, setManifestShowFinancials] = useState(false); // Master financial switch
  const [manifestShowPaymentMethod, setManifestShowPaymentMethod] = useState(false);
  const [manifestShowCodAmount, setManifestShowCodAmount] = useState(false);
  const [manifestShowShippingCost, setManifestShowShippingCost] = useState(false);
  const [manifestShowFinancialSummary, setManifestShowFinancialSummary] = useState(false);

  // 4. Trip, Driver, Notes, Signatures & Aesthetics
  const [manifestShowTripInfo, setManifestShowTripInfo] = useState(true);
  const [manifestShowManifestNotes, setManifestShowManifestNotes] = useState(false);
  const [manifestShowSignatures, setManifestShowSignatures] = useState(true);
  const [manifestPureWhite, setManifestPureWhite] = useState(false);
  const [manifestTableDensity, setManifestTableDensity] = useState<'compact' | 'normal' | 'relaxed'>('normal');
  const [manifestFontScale, setManifestFontScale] = useState<number>(100);

  // Manifest Quick Presets
  const applyManifestPresetDefault = () => {
    setManifestShowFinancials(false);
    setManifestShowPaymentMethod(false);
    setManifestShowCodAmount(false);
    setManifestShowShippingCost(false);
    setManifestShowFinancialSummary(false);
    setManifestShowSenderName(true);
    setManifestShowSenderPhone(true);
    setManifestShowReceiverName(true);
    setManifestShowReceiverPhone(true);
    setManifestShowReceiverAddress(false);
    setManifestHighlightReceiver(false);
    setManifestShowParcelTracking(true);
    setManifestShowParcelType(true);
    setManifestShowPiecesCount(true);
    setManifestShowParcelWeight(false);
    setManifestShowParcelNotes(false);
    setManifestShowTripInfo(true);
    setManifestShowManifestNotes(false);
    setManifestShowSignatures(true);
    setManifestPureWhite(false);
    setManifestTableDensity('normal');
    setManifestFontScale(100);
  };

  const applyManifestPresetFullFinancial = () => {
    setManifestShowFinancials(true);
    setManifestShowPaymentMethod(true);
    setManifestShowCodAmount(true);
    setManifestShowShippingCost(true);
    setManifestShowFinancialSummary(true);
    setManifestShowSenderName(true);
    setManifestShowSenderPhone(true);
    setManifestShowReceiverName(true);
    setManifestShowReceiverPhone(true);
    setManifestShowReceiverAddress(true);
    setManifestHighlightReceiver(false);
    setManifestShowParcelTracking(true);
    setManifestShowParcelType(true);
    setManifestShowPiecesCount(true);
    setManifestShowParcelWeight(true);
    setManifestShowParcelNotes(true);
    setManifestShowTripInfo(true);
    setManifestShowManifestNotes(true);
    setManifestShowSignatures(true);
    setManifestTableDensity('normal');
    setManifestFontScale(100);
  };

  const applyManifestPresetDeliveryFocus = () => {
    setManifestShowFinancials(false);
    setManifestShowPaymentMethod(false);
    setManifestShowCodAmount(false);
    setManifestShowShippingCost(false);
    setManifestShowFinancialSummary(false);
    setManifestShowSenderName(true);
    setManifestShowSenderPhone(true);
    setManifestShowReceiverName(true);
    setManifestShowReceiverPhone(true);
    setManifestShowReceiverAddress(true);
    setManifestHighlightReceiver(true);
    setManifestShowParcelTracking(true);
    setManifestShowParcelType(true);
    setManifestShowPiecesCount(true);
    setManifestShowParcelWeight(false);
    setManifestShowParcelNotes(true);
    setManifestShowTripInfo(true);
    setManifestShowManifestNotes(true);
    setManifestShowSignatures(true);
    setManifestTableDensity('relaxed');
    setManifestFontScale(100);
  };

  const applyManifestPresetCompactEco = () => {
    applyManifestPresetDefault();
    setManifestPureWhite(true);
    setManifestTableDensity('compact');
    setManifestFontScale(90);
  };

  const resetManifestControls = () => {
    applyManifestPresetDefault();
  };

  // Keyboard shortcut Ctrl+P / Cmd+P
  useEffect(() => {
    if (!isPrintModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        safePrint();
      } else if (e.key === 'Escape') {
        closePrintModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintModalOpen, closePrintModal]);

  if (!isPrintModalOpen) return null;

  const handlePrint = () => {
    try {
      if (typeof window !== 'undefined') {
        window.focus();
      }
      safePrint();
    } catch (err) {
      console.error('Print trigger error:', err);
    }
  };

  // Resolve Branch names for Parcel
  const originHub = branches.find((b) => b.id === selectedParcelForPrint?.originHubId);
  const destHub = branches.find((b) => b.id === selectedParcelForPrint?.destinationHubId);
  const subBranch = branches.find((b) => b.id === selectedParcelForPrint?.originCollectionBranchId);

  // Resolve Manifest details
  const manifestOrigin = branches.find((b) => b.id === selectedManifestForPrint?.originHubId);
  const manifestDest = branches.find((b) => b.id === selectedManifestForPrint?.destinationHubId);
  const manifestParcels = selectedManifestForPrint?.parcelIds
    ? (selectedManifestForPrint.parcelIds.map((id) => parcels.find((p) => p.id === id)).filter(Boolean) as Parcel[])
    : [];

  const manifestTotalFreightSyp = manifestParcels.reduce(
    (sum, p) => sum + ((p.shippingCurrency || p.currency) === 'SYP' ? p.shippingCost || 0 : 0),
    0
  );
  const manifestTotalFreightUsd = manifestParcels.reduce(
    (sum, p) => sum + ((p.shippingCurrency || p.currency) === 'USD' ? p.shippingCost || 0 : 0),
    0
  );
  const manifestTotalCodSyp = manifestParcels.reduce((sum, p) => {
    const s = getParcelPaymentSummary(p);
    return sum + (s.normalizedType === 'cod' && s.codCurrency === 'SYP' ? s.codAmount : 0);
  }, 0);
  const manifestTotalCodUsd = manifestParcels.reduce((sum, p) => {
    const s = getParcelPaymentSummary(p);
    return sum + (s.normalizedType === 'cod' && s.codCurrency === 'USD' ? s.codAmount : 0);
  }, 0);

  // Currency helper
  const getCurrencySymbol = (curr?: string) => (curr === 'USD' ? '$' : 'ل.س');

  // Spacing and density classes
  const paddingClass =
    contentPadding === 'compact'
      ? 'p-2 sm:p-2.5'
      : contentPadding === 'generous'
      ? 'p-4 sm:p-5'
      : 'p-3 sm:p-3.5';

  const gapClass =
    gapSize === 'compact' ? 'gap-2' : gapSize === 'generous' ? 'gap-5' : 'gap-3.5';

  // Per-section flex class for vertical expansion
  const getSectionFlexClass = (stretch: 'auto' | 'grow' | 'tall' | 'extra') => {
    if (!fillFullPage) return 'flex-none';
    if (stretch === 'extra') return 'flex-[3] min-h-0';
    if (stretch === 'tall') return 'flex-[2] min-h-0';
    if (stretch === 'grow') return 'flex-1 min-h-0';
    return 'flex-none';
  };

  // Quick Preset Handlers
  const applyPresetPreCutPaper = () => {
    togglePreCutPaper(true);
    setShowSenderCopy(true);
    setShowReceiverCopy(true);
    setShowArchiveCopy(true);
    setFillFullPage(true);
    setShowQrCode(true);
    setShowBarcode(true);
    setShowCompanyHeader(true);
    setShowFinancials(true);
    setShowLegalTerms(true);
    setShowSenderCivilData(true);
    setShowHandlingNotes(true);
    setShowCutLines(true);
    setFontScale(100);
    setContentPadding('normal');
  };

  const applyPresetBalanced = () => {
    togglePreCutPaper(false);
    setShowSenderCopy(true);
    setShowReceiverCopy(true);
    setShowArchiveCopy(true);
    setFillFullPage(true);
    setSenderCopyStretch('grow');
    setReceiverCopyStretch('grow');
    setArchiveCopyStretch('grow');
    setContentPadding('normal');
    setGapSize('normal');
    setFontScale(100);
  };

  const applyPresetReceiverFocus = () => {
    setShowSenderCopy(true);
    setShowReceiverCopy(true);
    setShowArchiveCopy(true);
    setFillFullPage(true);
    setSenderCopyStretch('auto');
    setReceiverCopyStretch('tall');
    setArchiveCopyStretch('auto');
    setContentPadding('normal');
    setFontScale(100);
  };

  const applyPresetSenderFocus = () => {
    setShowSenderCopy(true);
    setShowReceiverCopy(true);
    setShowArchiveCopy(true);
    setFillFullPage(true);
    setSenderCopyStretch('tall');
    setReceiverCopyStretch('grow');
    setArchiveCopyStretch('auto');
    setContentPadding('normal');
    setFontScale(100);
  };

  const applyPresetArchiveFocus = () => {
    setShowSenderCopy(true);
    setShowReceiverCopy(true);
    setShowArchiveCopy(true);
    setFillFullPage(true);
    setSenderCopyStretch('auto');
    setReceiverCopyStretch('auto');
    setArchiveCopyStretch('tall');
    setContentPadding('normal');
    setFontScale(100);
  };

  const applyPresetCompact = () => {
    setFillFullPage(false);
    setSenderCopyStretch('auto');
    setReceiverCopyStretch('auto');
    setArchiveCopyStretch('auto');
    setContentPadding('compact');
    setGapSize('compact');
    setFontScale(90);
  };

  // Format Date and Time using English/Latin numerals and characters (e.g. 2026-09-20 14:35)
  const formatEnglishDateTime = (dateStr?: string | Date | number) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // Build accurate, plain-text QR payload readable instantly by all smartphone cameras and scanners
  const isRealPaperReceipt = (val?: string | null): boolean => {
    if (!val) return false;
    const t = val.trim();
    if (!t) return false;
    if (t === '-' || t === '0' || t === 'null' || t === 'undefined') return false;
    if (t.startsWith('RC-MANUAL') || t.startsWith('RC-ورقي') || t.includes('معاينة')) return false;
    return true;
  };

  const buildWaybillQrPayload = (p: Parcel): string => {
    const oHub = branches.find((b) => b.id === p.originHubId) || originHub;
    const dHub = branches.find((b) => b.id === p.destinationHubId) || destHub;
    const oCity = oHub?.governorate || oHub?.city || p.sender?.city || oHub?.name || 'دمشق';
    const dCity = dHub?.governorate || dHub?.city || p.receiver?.city || dHub?.name || p.receiver?.city || 'الوجهة';

    const formattedDateTime = formatEnglishDateTime(p.createdAt || new Date());

    const isCod = p.paymentType === 'cod' || (p.codAmount && p.codAmount > 0);
    const isPrepaid = p.paymentType === 'prepaid';
    const fee = p.shippingCost ?? 0;
    const cod = p.codAmount ?? 0;
    const transferFee = p.transferFee ?? 0;
    const shippingCurrency = (p.shippingCurrency || p.currency || 'SYP') as string;
    const codCurrency = (p.codCurrency || p.currency || 'SYP') as string;
    const isSameCurrency = shippingCurrency === codCurrency;
    const shipSym = shippingCurrency === 'USD' ? '$' : 'ل.س';
    const codSym = codCurrency === 'USD' ? '$' : 'ل.س';

    let payText = '';
    if (isCod) {
      const isSenderShipping = p.codShippingPayer === 'sender';
      if (isSenderShipping) {
        payText = `ضد الدفع: ${(cod + transferFee).toLocaleString('en-US')} ${codSym} (الشحن مسدد)`;
      } else if (!isSameCurrency) {
        payText = `ضد الدفع: ${fee.toLocaleString('en-US')} ${shipSym} شحن + ${(cod + transferFee).toLocaleString('en-US')} ${codSym} حوالة`;
      } else {
        const total = fee + cod + transferFee;
        payText = `ضد الدفع: ${total.toLocaleString('en-US')} ${codSym}`;
      }
    } else if (isPrepaid) {
      payText = `مسدد سلفاً (${fee.toLocaleString('en-US')} ${shipSym})`;
    } else {
      payText = `على المستلم (${fee.toLocaleString('en-US')} ${shipSym})`;
    }

    const pieces = p.piecesCount || 1;
    const weight = p.weightKg ? ` (${p.weightKg} كغ)` : '';
    const paperRec = isRealPaperReceipt(p.paperReceiptNumber) ? ` [وصل: #${p.paperReceiptNumber?.trim()}]` : '';

    const lines = [
      `بوليصة: ${p.trackingNumber}${paperRec}`,
      `التاريخ: ${formattedDateTime}`,
      `المسار: ${oCity} ⬅ ${dCity}`,
      `المرسل: ${p.sender?.name || ''} (${p.sender?.phone || ''})`,
      `المستلم: ${p.receiver?.name || ''} (${p.receiver?.phone || ''})`,
      `الطرود: ${pieces} طرد${weight}${p.packageType ? ` - ${p.packageType}` : ''}`,
      `المطلوب: ${payText}`,
    ];

    return lines.join('\n');
  };

  const resetAllControls = () => {
    applyPresetPreCutPaper();
    changeVerticalOffset(0);
    setPureWhiteMode(false);
    setViewZoom('fit');
  };

  // Active copies count
  const activeCopies = [
    showSenderCopy ? 'sender' : null,
    showReceiverCopy ? 'receiver' : null,
    showArchiveCopy ? 'archive' : null,
  ].filter(Boolean);
  const activeSections = activeCopies;

  // Screen View scale style (helps fit the full A4 sheet neatly in front of user)
  const getViewportZoomStyle = (): React.CSSProperties => {
    if (viewZoom === '75') return { transform: 'scale(0.75)', transformOrigin: 'top center' };
    if (viewZoom === '90') return { transform: 'scale(0.90)', transformOrigin: 'top center' };
    if (viewZoom === '100') return { transform: 'scale(1)', transformOrigin: 'top center' };
    // 'fit' mode (scales to approx 80% on standard desktop so the entire page is visible without scrolling)
    return { transform: 'scale(0.82)', transformOrigin: 'top center' };
  };

  return createPortal(
    <div
      dir="rtl"
      id="orca_system_print_modal"
      className="orca-print-portal fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex flex-col print:static print:bg-white print:p-0 print:block print:overflow-visible font-['Cairo',sans-serif] animate-in fade-in duration-150"
    >
      {/* ========================================================= */}
      {/* TOP HEADER BAR (HIDDEN IN PRINT)                          */}
      {/* ========================================================= */}
      <header className="print:hidden bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-inner">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm text-white">
                {printModalType === 'parcel_3part'
                  ? 'معاينة وطباعة بوليصة الشحن الرسمية (نسخة مرسل / نسخة مستلم / نسخة أرشفة)'
                  : 'معاينة وطباعة مانافيست ترحيل الشاحنة (Master Manifest A4)'}
              </h1>
              {selectedParcelForPrint && (
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/80 font-mono font-black text-xs text-cyan-300">
                  {selectedParcelForPrint.trackingNumber}
                </span>
              )}
              {selectedManifestForPrint && (
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/80 font-mono font-black text-xs text-emerald-300">
                  {selectedManifestForPrint.manifestNumber}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>{isSuperAdmin ? 'لوحة التحكم من جهة اليمين • معاينة حية كاملة للصفحة من جهة اليسار' : 'معاينة حية رسمية جاهزة للطباعة'}</span>
              {!isSuperAdmin && (
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-amber-300 font-bold">
                  🔒 مصمم الطباعة خياراته مخصصة لمدير التطبيق حصراً
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls in Top Bar */}
        <div className="flex items-center gap-2">
          {/* Zoom Selector for Live View */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1 text-xs">
            <span className="text-slate-400 font-bold text-[11px] ml-1">عرض الشاشة:</span>
            {[
              { id: 'fit', label: 'ملاءمة الصفحة' },
              { id: '75', label: '75%' },
              { id: '90', label: '90%' },
              { id: '100', label: '100%' },
            ].map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => setViewZoom(z.id as any)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  viewZoom === z.id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePrint}
            title="إرسال أمر الطباعة المباشر إلى طابعة ويندوز الافتراضية"
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black rounded-xl shadow-lg shadow-cyan-900/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة على طابعة ويندوز الافتراضية (Ctrl + P)</span>
          </button>

          <button
            type="button"
            onClick={closePrintModal}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="إغلاق المعاينة (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN BODY: RIGHT SIDEBAR (CONTROLS) + LEFT LIVE PREVIEW  */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden print:block print:overflow-visible">
        {/* ------------------------------------------------------- */}
        {/* 1. RIGHT SIDEBAR: CONTROLS & OPTIONS (جهة اليمين)       */}
        {/* ------------------------------------------------------- */}
        {isSuperAdmin && printModalType === 'parcel_3part' && (
          <aside className="print:hidden w-full lg:w-96 bg-slate-950 border-l border-slate-800/80 flex flex-col shrink-0 overflow-y-auto z-10 shadow-2xl">
            <div className="p-4 space-y-4">
              {/* Header of sidebar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-xs font-black text-white uppercase tracking-wider">
                    إعدادات وخيارات الإشعار
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={resetAllControls}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  title="استعادة الوضع الافتراضي"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة ضبط</span>
                </button>
              </div>

              {/* SECTION A: أقسام ونسخ البوليصة */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    أقسام ونسخ البوليصة:
                  </span>
                  <span className="text-[10px] text-cyan-300 font-bold font-mono px-2 py-0.5 rounded-full bg-slate-800">
                    {activeCopies.length} من 3 مفعّلة
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {/* Copy 1: نسخة مرسل */}
                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showSenderCopy}
                        onChange={(e) => setShowSenderCopy(e.target.checked)}
                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 bg-slate-800 border-slate-700 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-slate-100">نسخة مرسل</div>
                        <div className="text-[10px] text-slate-400">إشعار وإيصال تسليم البضاعة للعميل المرسل</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      المرسل
                    </span>
                  </label>

                  {/* Copy 2: نسخة مستلم */}
                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showReceiverCopy}
                        onChange={(e) => setShowReceiverCopy(e.target.checked)}
                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 bg-slate-800 border-slate-700 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-slate-100">نسخة مستلم</div>
                        <div className="text-[10px] text-slate-400">إيصال الاستلام والتسليم والتعهد للعميل المستلم</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      المستلم
                    </span>
                  </label>

                  {/* Copy 3: نسخة أرشفة */}
                  <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showArchiveCopy}
                        onChange={(e) => setShowArchiveCopy(e.target.checked)}
                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 bg-slate-800 border-slate-700 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-black text-slate-100">نسخة أرشفة</div>
                        <div className="text-[10px] text-slate-400">سجل المركز والتدقيق المالي ومطابقة الصندوق</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      الأرشيف
                    </span>
                  </label>
                </div>
              </div>

              {/* SECTION: نظام الورق المجهز والمقصوص مسبقاً (9.8 سم) */}
              <div className="bg-gradient-to-br from-cyan-950/70 via-slate-900 to-slate-950 border-2 border-cyan-500/50 rounded-xl p-3 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                    ورق مقصوص مسبقاً (9.8 سم):
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePreCutPaper(!isPreCutPaper)}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border transition cursor-pointer flex items-center gap-1 ${
                      isPreCutPaper
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-xs'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className={`w-3 h-3 ${isPreCutPaper ? 'opacity-100 text-emerald-400' : 'opacity-0'}`} />
                    <span>{isPreCutPaper ? 'معتمد ومفعّل' : 'معطل (ورق عادي)'}</span>
                  </button>
                </div>

                <p className="text-[10.5px] text-cyan-200/90 leading-relaxed font-bold">
                  تمت معايرة ارتفاع كل قسم ليكون <span className="text-white underline font-mono">9.8 سم (98 مم)</span> تماماً ليتطابق بالملليمتر مع خطوط التخريم والقص الفيزيائية للورق.
                </p>

                {/* Perforation Zones Breakdown */}
                <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800 text-[9.5px] space-y-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold">1. نسخة مرسل:</span>
                    <span className="font-mono text-cyan-400 font-bold">0.0 سم ⬅ 9.8 سم (98 مم)</span>
                  </div>
                  <div className="border-t border-dashed border-cyan-500/30 my-0.5" />
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold">2. نسخة مستلم:</span>
                    <span className="font-mono text-cyan-400 font-bold">9.8 سم ⬅ 19.6 سم (98 مم)</span>
                  </div>
                  <div className="border-t border-dashed border-cyan-500/30 my-0.5" />
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold">3. نسخة أرشفة:</span>
                    <span className="font-mono text-cyan-400 font-bold">19.6 سم ⬅ 29.4 سم (98 مم)</span>
                  </div>
                </div>

                {/* Printer Roller Offset Calibration */}
                {isPreCutPaper && (
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-300 font-bold flex items-center gap-1">
                        <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                        معايرة إزاحة الطابعة (Offset):
                      </span>
                      <span className="font-mono font-bold text-xs text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-500/30">
                        {verticalOffsetMm > 0 ? `+${verticalOffsetMm}` : verticalOffsetMm} مم
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      <div className="flex items-center gap-1">
                        {[-2, -1, -0.5, 0, 0.5, 1, 2].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => changeVerticalOffset(val)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer border ${
                              verticalOffsetMm === val
                                ? 'bg-cyan-600 border-cyan-400 text-white shadow-xs'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                            title={val === 0 ? 'الافتراضي (0 مم)' : `إزاحة ${val > 0 ? `+${val}` : val} مم`}
                          >
                            {val === 0 ? '0' : val > 0 ? `+${val}` : val}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => changeVerticalOffset(0)}
                        className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-1"
                        title="تصفير الإزاحة"
                      >
                        تصفير
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400">
                      تُستخدم للمطابقة الدقيقة إذا كانت طابعتك تسحب الورقة بنقطة بداية مختلفة.
                    </p>
                  </div>
                )}
              </div>

              {/* SECTION B: أبعاد وتوسيع النسخ وتعبئة ورقة A4 */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                    تعبئة الصفحة وتوسيع النسخ:
                  </span>
                  <button
                    type="button"
                    onClick={() => setFillFullPage(!fillFullPage)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                      fillFullPage
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {fillFullPage ? 'تعبئة كاملة مفعّلة' : 'حجم مدمج'}
                  </button>
                </div>

                {/* Per-Section Height Stretch Selectors */}
                {isPreCutPaper ? (
                  <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[10.5px] text-cyan-200 leading-relaxed font-bold">
                    🔒 <strong className="text-white">الأبعاد مقفلة ومثبتة:</strong> نمط الورق المقصوص مسبقاً مفعّل — كل قسم مخصص له 9.8 سم تماماً. للتعديل اليدوي على تمدد النسخ، عطّل خيار الورق المقصوص مسبقاً في الصندوق أعلاه.
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] text-slate-400 font-bold">توسيع النسخ رأسياً:</div>

                    {/* Stretch Section 1: نسخة مرسل */}
                    <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
                      <span className="text-[11px] text-slate-300 font-bold">نسخة مرسل:</span>
                      <div className="flex items-center gap-1">
                        {[
                          { id: 'auto', label: 'تلقائي' },
                          { id: 'grow', label: 'عادي' },
                          { id: 'tall', label: 'مضاعف 2x' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSenderCopyStretch(m.id as any)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                              senderCopyStretch === m.id
                                ? 'bg-cyan-600 border-cyan-400 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stretch Section 2: نسخة مستلم */}
                    <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
                      <span className="text-[11px] text-slate-300 font-bold">نسخة مستلم:</span>
                      <div className="flex items-center gap-1">
                        {[
                          { id: 'auto', label: 'تلقائي' },
                          { id: 'grow', label: 'عادي' },
                          { id: 'tall', label: 'مضاعف 2x' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setReceiverCopyStretch(m.id as any)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                              receiverCopyStretch === m.id
                                ? 'bg-cyan-600 border-cyan-400 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stretch Section 3: نسخة أرشفة */}
                    <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
                      <span className="text-[11px] text-slate-300 font-bold">نسخة أرشفة:</span>
                      <div className="flex items-center gap-1">
                        {[
                          { id: 'auto', label: 'تلقائي' },
                          { id: 'grow', label: 'عادي' },
                          { id: 'tall', label: 'مضاعف 2x' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setArchiveCopyStretch(m.id as any)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                              archiveCopyStretch === m.id
                                ? 'bg-cyan-600 border-cyan-400 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Spacing & Padding Controls */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">
                      الهوامش الداخلية:
                    </span>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      {[
                        { id: 'compact', label: 'ضيق' },
                        { id: 'normal', label: 'متوازن' },
                        { id: 'generous', label: 'واسع' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setContentPadding(p.id as any)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                            contentPadding === p.id
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">
                      المسافة بين النسخ:
                    </span>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      {[
                        { id: 'compact', label: 'متقارب' },
                        { id: 'normal', label: 'متوازن' },
                        { id: 'generous', label: 'متباعد' },
                      ].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGapSize(g.id as any)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                            gapSize === g.id
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Content & Typography Scale Slider/Buttons */}
                <div className="pt-1 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold">
                      تكبير المحتوى والخطوط بالورقة:
                    </span>
                    <span className="text-[11px] font-mono font-black text-cyan-300">
                      {fontScale}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {[85, 90, 95, 100, 105, 110, 115, 120].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFontScale(s)}
                        className={`flex-1 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                          fontScale === s
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION C: تفاصيل وعناصر الإظهار */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  عناصر وتفاصيل الإظهار:
                </span>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* QR Code Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowQrCode(!showQrCode)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      showQrCode
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>رمز QR للبيانات</span>
                    </span>
                    <Check className={`w-3.5 h-3.5 ${showQrCode ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Barcode Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowBarcode(!showBarcode)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      showBarcode
                        ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <BarcodeIcon className="w-3.5 h-3.5" />
                      <span>الباركود الخطي 128</span>
                    </span>
                    <Check className={`w-3.5 h-3.5 ${showBarcode ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Company Header Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowCompanyHeader(!showCompanyHeader)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      showCompanyHeader
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>ترويسة وشعار الشركة</span>
                    </span>
                    <Check className={`w-3.5 h-3.5 ${showCompanyHeader ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Financials Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowFinancials(!showFinancials)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      showFinancials
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>المبالغ والمالية</span>
                    </span>
                    <Check className={`w-3.5 h-3.5 ${showFinancials ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Civil ID Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowSenderCivilData(!showSenderCivilData)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      showSenderCivilData
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>الرقم الوطني للمرسل</span>
                    </span>
                    <Check
                      className={`w-3.5 h-3.5 ${showSenderCivilData ? 'opacity-100' : 'opacity-0'}`}
                    />
                  </button>

                  {/* Legal Terms & Signatures */}
                  <button
                    type="button"
                    onClick={() => setShowLegalTerms(!showLegalTerms)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      showLegalTerms
                        ? 'bg-slate-800 border-slate-600 text-slate-200'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>الشروط وتوقيع المستلم (الأرشيف)</span>
                    </span>
                    <Check className={`w-3.5 h-3.5 ${showLegalTerms ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Handling Notes */}
                  <button
                    type="button"
                    onClick={() => setShowHandlingNotes(!showHandlingNotes)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      showHandlingNotes
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>ملاحظات الشحنة</span>
                    </span>
                    <Check
                      className={`w-3.5 h-3.5 ${showHandlingNotes ? 'opacity-100' : 'opacity-0'}`}
                    />
                  </button>

                  {/* Cut Lines */}
                  <button
                    type="button"
                    onClick={() => setShowCutLines(!showCutLines)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      showCutLines
                        ? 'bg-slate-800 border-slate-600 text-slate-200'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Scissors className="w-3.5 h-3.5" />
                      <span>خطوط التنقيط الفاصلة</span>
                    </span>
                    <Check className={`w-3.5 h-3.5 ${showCutLines ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                </div>

                {/* Monochrome Guarantee Info */}
                <div className="p-2 rounded-lg bg-black/40 border border-slate-800 flex items-center gap-2 text-slate-300 text-[11px] font-bold">
                  <Printer className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>الطباعة دائماً بنمط أبيض وأسود عالي التباين والدقة (Monochrome B&W).</span>
                </div>
              </div>

              {/* SECTION: إعدادات ومحتوى رمز QR المخصص */}
              {showQrCode && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                      منطق وتشفير رمز الـ QR:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50">
                      معتمد 100%
                    </span>
                  </div>

                  {/* Text Details Info Banner */}
                  <div className="bg-slate-950/80 border border-cyan-500/30 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-bold mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>بيانات البوليصة النصية الكاملة (نص خالص)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      يحتوي رمز الـ QR على كامل بيانات البوليصة (رقم البوليصة، التاريخ والوقت، الشركة، المسار، المرسل، المستلم، العنوان، المحتوى، والمالية) كنص مقروء فوراً بكاميرا أي هاتف بدون أي روابط تتبع أو اتصال إنترنت.
                    </p>
                  </div>

                  {/* QR Code Real-Time Inspector / Test Read Box */}
                  {selectedParcelForPrint && (
                    <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-bold flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          فحص وقراءة الكيو أر للبوليصة الحالية:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const text = buildWaybillQrPayload(selectedParcelForPrint);
                            navigator.clipboard.writeText(text);
                            setCopiedQr(true);
                            setTimeout(() => setCopiedQr(false), 2000);
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer bg-slate-900 border border-slate-700 px-2 py-0.5 rounded transition"
                        >
                          {copiedQr ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ المحتوى</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="bg-white p-1 rounded border-2 border-black shrink-0">
                          <WaybillQRCode
                            value={buildWaybillQrPayload(selectedParcelForPrint)}
                            size={76}
                            margin={1}
                          />
                        </div>
                        <div className="flex-1 bg-slate-900/90 p-2 rounded border border-slate-800 text-[10px] font-mono text-slate-200 max-h-28 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
                          {buildWaybillQrPayload(selectedParcelForPrint)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION D: الأنماط السريعة الجاهزة (1-Click Presets) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  أنماط سريعة جاهزة بنقرة واحدة:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={applyPresetPreCutPaper}
                    className={`col-span-2 p-2 rounded-lg border text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isPreCutPaper
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                    <span>🎯 النمط المعتمد: ورق مقصوص مسبقاً (9.8 سم)</span>
                  </button>
                  <button
                    type="button"
                    onClick={applyPresetBalanced}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-[11px] font-bold text-center transition cursor-pointer"
                  >
                    ⚖️ نمط متوازن (النسخ الثلاث)
                  </button>
                  <button
                    type="button"
                    onClick={applyPresetReceiverFocus}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-[11px] font-bold text-center transition cursor-pointer"
                  >
                    📦 تركيز على نسخة مستلم
                  </button>
                  <button
                    type="button"
                    onClick={applyPresetSenderFocus}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-[11px] font-bold text-center transition cursor-pointer"
                  >
                    👤 تركيز على نسخة مرسل
                  </button>
                  <button
                    type="button"
                    onClick={applyPresetArchiveFocus}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-[11px] font-bold text-center transition cursor-pointer"
                  >
                    📁 تركيز على نسخة أرشفة
                  </button>
                  <button
                    type="button"
                    onClick={applyPresetCompact}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-bold text-center transition cursor-pointer"
                  >
                    🖨️ حجم مدمج ومضغوط
                  </button>
                  <button
                    type="button"
                    onClick={resetAllControls}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة ضبط الكل</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* ------------------------------------------------------- */}
        {/* 1.B RIGHT SIDEBAR: MASTER MANIFEST CONTROLS (جهة اليمين)*/}
        {/* ------------------------------------------------------- */}
        {isSuperAdmin && printModalType === 'manifest_a4' && (
          <aside className="print:hidden w-full lg:w-96 bg-slate-950 border-l border-slate-800/80 flex flex-col shrink-0 overflow-y-auto z-10 shadow-2xl custom-scrollbar">
            <div className="p-4 space-y-4">
              {/* Header of sidebar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs font-black text-white uppercase tracking-wider">
                    خيارات إظهار وتخصيص المانافيست
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={resetManifestControls}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  title="استعادة الوضع الافتراضي"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة ضبط</span>
                </button>
              </div>

              {/* QUICK 1-CLICK PRESETS */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  أنماط جاهزة بنقرة واحدة:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={applyManifestPresetDefault}
                    className={`p-2 rounded-lg border text-[11px] font-bold text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      !manifestShowFinancials && manifestShowPiecesCount && !manifestShowParcelWeight
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
                    }`}
                    title="النمط الافتراضي المبسط: رقم الطرد، المرسل والمستلم وهواتفهم، نوع وعدد الطرود فقط"
                  >
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>النمط الافتراضي القياسي</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-normal">مبسط وبدون تعقيدات</span>
                  </button>

                  <button
                    type="button"
                    onClick={applyManifestPresetFullFinancial}
                    className={`p-2 rounded-lg border text-[11px] font-bold text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      manifestShowFinancials && manifestShowShippingCost
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
                    }`}
                    title="إظهار كافة الأعمدة المالية وأجور الشحن وتحصيلات COD"
                  >
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>نمط التدقيق المالي</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-normal">كافة المبالغ والتحصيلات</span>
                  </button>

                  <button
                    type="button"
                    onClick={applyManifestPresetDeliveryFocus}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[11px] font-bold text-center transition cursor-pointer flex flex-col items-center justify-center gap-1"
                    title="تكبير وإبراز بيانات المستلم والعنوان والتسليم"
                  >
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>تركيز التسليم والمستلم</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-normal">هاتف وعنوان بارز</span>
                  </button>

                  <button
                    type="button"
                    onClick={applyManifestPresetCompactEco}
                    className={`p-2 rounded-lg border text-[11px] font-bold text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      manifestPureWhite
                        ? 'bg-slate-800 border-slate-600 text-white shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
                    }`}
                    title="توفير الورق وحبر الطابعة"
                  >
                    <div className="flex items-center gap-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                      <span>نمط مدمج موفر للحبر</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-normal">خط مدمج وخلفية بيضاء</span>
                  </button>
                </div>
              </div>

              {/* SECTION 1: PARCEL DATA (الأهم: رقم ونوع وعدد الطرود) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                  أعمدة بيانات الطرد (الافتراضية والاختيارية):
                </span>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* Tracking Number */}
                  <button
                    type="button"
                    onClick={() => setManifestShowParcelTracking(!manifestShowParcelTracking)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      manifestShowParcelTracking
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span>🏷️ رقم الطرد (افتراضي)</span>
                    <Check className={`w-3.5 h-3.5 ${manifestShowParcelTracking ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Parcel Type */}
                  <button
                    type="button"
                    onClick={() => setManifestShowParcelType(!manifestShowParcelType)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      manifestShowParcelType
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span>📦 نوع الطرد (افتراضي)</span>
                    <Check className={`w-3.5 h-3.5 ${manifestShowParcelType ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Pieces Count */}
                  <button
                    type="button"
                    onClick={() => setManifestShowPiecesCount(!manifestShowPiecesCount)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      manifestShowPiecesCount
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span>🔢 عدد الطرود (افتراضي)</span>
                    <Check className={`w-3.5 h-3.5 ${manifestShowPiecesCount ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Weight (Optional) */}
                  <button
                    type="button"
                    onClick={() => setManifestShowParcelWeight(!manifestShowParcelWeight)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      manifestShowParcelWeight
                        ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>⚖️ الوزن بالكيلوغرام (إضافي)</span>
                    <Check className={`w-3.5 h-3.5 ${manifestShowParcelWeight ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  {/* Special Notes (Optional) */}
                  <button
                    type="button"
                    onClick={() => setManifestShowParcelNotes(!manifestShowParcelNotes)}
                    className={`col-span-2 p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      manifestShowParcelNotes
                        ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>⚠️ ملاحظات الطرد وتعليمات المناولة</span>
                    <Check className={`w-3.5 h-3.5 ${manifestShowParcelNotes ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                </div>
              </div>

              {/* SECTION 2: SENDER & RECEIVER (المرسل والمستلم) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  أطراف الشحنة (المرسل والمستلم):
                </span>

                <div className="space-y-1.5">
                  {/* Sender Data */}
                  <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300">المرسل (المصدر):</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setManifestShowSenderName(!manifestShowSenderName)}
                        className={`p-1.5 rounded-md border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          manifestShowSenderName
                            ? 'bg-slate-800 border-slate-600 text-white'
                            : 'bg-slate-950 border-slate-850 text-slate-500 line-through'
                        }`}
                      >
                        <span>اسم المرسل (افتراضي)</span>
                        <Check className={`w-3 h-3 ${manifestShowSenderName ? 'opacity-100' : 'opacity-0'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setManifestShowSenderPhone(!manifestShowSenderPhone)}
                        className={`p-1.5 rounded-md border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          manifestShowSenderPhone
                            ? 'bg-slate-800 border-slate-600 text-white'
                            : 'bg-slate-950 border-slate-850 text-slate-500 line-through'
                        }`}
                      >
                        <span>هاتف المرسل (افتراضي)</span>
                        <Check className={`w-3 h-3 ${manifestShowSenderPhone ? 'opacity-100' : 'opacity-0'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Receiver Data */}
                  <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300">المستلم (الوجهة):</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setManifestShowReceiverName(!manifestShowReceiverName)}
                        className={`p-1.5 rounded-md border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          manifestShowReceiverName
                            ? 'bg-slate-800 border-slate-600 text-white'
                            : 'bg-slate-950 border-slate-850 text-slate-500 line-through'
                        }`}
                      >
                        <span>اسم المستلم (افتراضي)</span>
                        <Check className={`w-3 h-3 ${manifestShowReceiverName ? 'opacity-100' : 'opacity-0'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setManifestShowReceiverPhone(!manifestShowReceiverPhone)}
                        className={`p-1.5 rounded-md border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          manifestShowReceiverPhone
                            ? 'bg-slate-800 border-slate-600 text-white'
                            : 'bg-slate-950 border-slate-850 text-slate-500 line-through'
                        }`}
                      >
                        <span>هاتف المستلم (افتراضي)</span>
                        <Check className={`w-3 h-3 ${manifestShowReceiverPhone ? 'opacity-100' : 'opacity-0'}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setManifestShowReceiverAddress(!manifestShowReceiverAddress)}
                        className={`col-span-2 p-1.5 rounded-md border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          manifestShowReceiverAddress
                            ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                            : 'bg-slate-950 border-slate-850 text-slate-500'
                        }`}
                      >
                        <span>📍 العنوان التفصيلي للمستلم (إضافي)</span>
                        <Check className={`w-3 h-3 ${manifestShowReceiverAddress ? 'opacity-100' : 'opacity-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: FINANCIALS (الماليات - معطلة افتراضياً للتبسيط) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    الأمور المالية (اختيارية - معطلة افتراضياً):
                  </span>
                  <button
                    type="button"
                    onClick={() => setManifestShowFinancials(!manifestShowFinancials)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                      manifestShowFinancials
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {manifestShowFinancials ? 'مفعّلة ✓' : 'معطلة (افتراضي) ✕'}
                  </button>
                </div>

                {manifestShowFinancials && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setManifestShowPaymentMethod(!manifestShowPaymentMethod)}
                      className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        manifestShowPaymentMethod
                          ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                      }`}
                    >
                      <span>💳 طريقة الدفع</span>
                      <Check className={`w-3.5 h-3.5 ${manifestShowPaymentMethod ? 'opacity-100' : 'opacity-0'}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setManifestShowCodAmount(!manifestShowCodAmount)}
                      className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        manifestShowCodAmount
                          ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                      }`}
                    >
                      <span>💵 تحصيل COD</span>
                      <Check className={`w-3.5 h-3.5 ${manifestShowCodAmount ? 'opacity-100' : 'opacity-0'}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setManifestShowShippingCost(!manifestShowShippingCost)}
                      className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        manifestShowShippingCost
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>📦 أجور الشحن</span>
                      <Check className={`w-3.5 h-3.5 ${manifestShowShippingCost ? 'opacity-100' : 'opacity-0'}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setManifestShowFinancialSummary(!manifestShowFinancialSummary)}
                      className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        manifestShowFinancialSummary
                          ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                      }`}
                    >
                      <span>📊 ملخص الإجماليات</span>
                      <Check className={`w-3.5 h-3.5 ${manifestShowFinancialSummary ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 4: TRIP INFO & SIGNATURES */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-indigo-400" />
                  بيانات الرحلة والتواقيع:
                </span>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setManifestShowTripInfo(!manifestShowTripInfo)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      manifestShowTripInfo
                        ? 'bg-slate-850 border-slate-700 text-slate-200'
                        : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <span>بيانات السائق والشاحنة</span>
                    <Check className={`w-3.5 h-3.5 ${manifestShowTripInfo ? 'opacity-100' : 'opacity-0'}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setManifestShowSignatures(!manifestShowSignatures)}
                    className={`p-2 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      manifestShowSignatures
                        ? 'bg-slate-850 border-slate-700 text-slate-200'
                        : 'bg-slate-950 border-slate-850 text-slate-500 line-through'
                    }`}
                  >
                    <span>صناديق التواقيع الثلاثية</span>
                    <Check className={`w-3.5 h-3.5 ${manifestShowSignatures ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                </div>
              </div>

              {/* SECTION 5: DENSITY, FONT SCALE & ECO PRINT */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  تنسيق الجدول وتوفير الحبر:
                </span>

                {/* Density Selector */}
                <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-300 font-bold">كثافة الأسطر:</span>
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'compact', label: 'مدمج' },
                      { id: 'normal', label: 'عادي' },
                      { id: 'relaxed', label: 'مريح واسع' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setManifestTableDensity(d.id as any)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                          manifestTableDensity === d.id
                            ? 'bg-emerald-600 border-emerald-400 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Scale */}
                <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-300 font-bold">حجم خط الوثيقة:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManifestFontScale((s) => Math.max(85, s - 5))}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-xs font-mono font-bold text-emerald-400 w-10 text-center">
                      {manifestFontScale}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setManifestFontScale((s) => Math.min(120, s + 5))}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Eco Pure White */}
                <button
                  type="button"
                  onClick={() => setManifestPureWhite(!manifestPureWhite)}
                  className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    manifestPureWhite
                      ? 'bg-slate-100 border-white text-slate-900 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span>🖨️ نمط أبيض بالكامل (توفير حبر الطابعة)</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                    manifestPureWhite ? 'bg-slate-900 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {manifestPureWhite ? 'مفعّل' : 'معطل'}
                  </span>
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* ------------------------------------------------------- */}
        {/* 2. LEFT VIEWPORT: LIVE A4 PREVIEW (جهة اليسار)          */}
        {/* ------------------------------------------------------- */}
        <main className="flex-1 bg-slate-900/60 overflow-y-auto p-2 sm:p-6 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible print:block">
          {/* Zoom Wrapper for screen preview */}
          <div
            className="w-full flex justify-center transition-transform duration-200 print:transform-none"
            style={getViewportZoomStyle()}
          >
            {/* Printable White Sheet */}
            <div
              ref={printAreaRef}
              id="orca_print_sheet"
              className={`orca-print-document w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl p-4 sm:p-6 print:p-0 print:shadow-none print:w-full print:max-w-none text-right font-['Cairo',sans-serif] select-text transition-all ${
                printModalType === 'parcel_3part' && isPreCutPaper ? 'waybill-precut-page' : ''
              } ${fillFullPage ? 'print-fill-page' : ''}`}
              style={{
                minHeight:
                  printModalType === 'parcel_3part'
                    ? isPreCutPaper
                      ? '294mm'
                      : fillFullPage
                      ? '265mm'
                      : 'auto'
                    : fillFullPage
                    ? '287mm'
                    : 'auto',
                maxHeight:
                  printModalType === 'parcel_3part'
                    ? isPreCutPaper
                      ? '294mm'
                      : '280mm'
                    : undefined,
                height:
                  printModalType === 'parcel_3part' && isPreCutPaper
                    ? '294mm'
                    : undefined,
                paddingTop:
                  printModalType === 'parcel_3part' && isPreCutPaper && verticalOffsetMm > 0
                    ? `${verticalOffsetMm}mm`
                    : undefined,
                marginTop:
                  printModalType === 'parcel_3part' && isPreCutPaper && verticalOffsetMm < 0
                    ? `${verticalOffsetMm}mm`
                    : undefined,
                zoom:
                  (printModalType === 'manifest_a4' ? manifestFontScale : fontScale) !== 100
                    ? `${(printModalType === 'manifest_a4' ? manifestFontScale : fontScale) / 100}`
                    : undefined,
              }}
            >
              {/* ========================================================= */}
              {/* 1. THREE-PART A4 CONSIGNMENT NOTE (بوليصة الشحن 3 أقسام بالتساوي)  */}
              {/* ========================================================= */}
              {printModalType === 'parcel_3part' && selectedParcelForPrint && (() => {
                const p = selectedParcelForPrint;
                const shippingFee = p.shippingCost ?? 0;
                const codAmt = p.codAmount ?? 0;
                const transferFeeAmt = p.transferFee ?? 0;
                const isCod = p.paymentType === 'cod' || codAmt > 0;
                const isPrepaid = p.paymentType === 'prepaid';
                const hasRemittance = isCod || codAmt > 0 || transferFeeAmt > 0;
                const carriedOver = p.carriedOverDueAmount ?? 0;

                const originCity = originHub?.governorate || originHub?.city || p.sender?.city || originHub?.name || 'دمشق';
                const destCity = destHub?.governorate || destHub?.city || p.receiver?.city || destHub?.name || p.receiver?.city;
                const paymentMethodLabel = isCod ? 'تحصيل COD ضد الدفع' : isPrepaid ? 'مسدد سلفاً' : 'على المستلم';

                // Net Total Calculation for Receiver's Sheet
                let receiverNetTotal = 0;
                let receiverNetLabel = '';
                if (p.totalDue !== undefined && p.totalDue > 0) {
                  receiverNetTotal = p.totalDue;
                  receiverNetLabel = p.isRerouted
                    ? 'المجموع المطلوب تحصيله'
                    : isCod
                    ? 'المجموع المطلوب (بضاعة + أجور + عمولة)'
                    : isPrepaid
                    ? 'المجموع النهائي (مسدد سلفاً)'
                    : 'المجموع المطلوب (أجور الشحن)';
                } else if (isCod) {
                  const isSenderShipping = p.codShippingPayer === 'sender';
                  receiverNetTotal = isSenderShipping
                    ? codAmt + transferFeeAmt + carriedOver
                    : codAmt + transferFeeAmt + shippingFee + carriedOver;
                  receiverNetLabel = 'المجموع المطلوب دفعه نقداً';
                } else if (isPrepaid) {
                  receiverNetTotal = 0;
                  receiverNetLabel = 'المجموع النهائي (مسدد سلفاً)';
                } else {
                  receiverNetTotal = shippingFee + carriedOver;
                  receiverNetLabel = 'المجموع المطلوب (أجور الشحن)';
                }

                // High-precision, zero-error QR Payload
                const qrPayload = buildWaybillQrPayload(p);

                // حساب الأطوال بدقة متناهية لضمان توزيع ورقة A4 وتوافقها التام مع الورق المقصوص مسبقاً (9.8 سم = 98 مم)
                const activeCount = [showSenderCopy, showReceiverCopy, showArchiveCopy].filter(Boolean).length;
                const perCopyHeightStyle: React.CSSProperties = isPreCutPaper
                  ? {
                      height: '98mm',
                      maxHeight: '98mm',
                      minHeight: '98mm',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }
                  : activeCount === 3
                  ? { height: '88mm', maxHeight: '88mm', minHeight: '88mm', boxSizing: 'border-box' }
                  : activeCount === 2
                  ? { height: '138mm', maxHeight: '138mm', minHeight: '138mm', boxSizing: 'border-box' }
                  : { height: '280mm', maxHeight: '280mm', minHeight: '200mm', boxSizing: 'border-box' };

                const qrSize = isPreCutPaper ? 62 : activeCount === 3 ? 60 : 78;
                const barcodeHeight = isPreCutPaper ? 24 : activeCount === 3 ? 24 : 34;
                const companyDisplayName = brandingSettings?.companyName || 'شركة أوركا للشحن والخدمات اللوجستية';
                const companySubtitleDisplay = brandingSettings?.companySubtitle || 'Orca Express Logistics • شحن داخلي سريع وتوزيع طرود';
                const customerServicePhoneDisplay = brandingSettings?.customerServicePhone || brandingSettings?.officialPhone || '0991234567';

                return (
                  <div
                    id="parcel-print-root"
                    className={`flex flex-col justify-between h-full text-black box-border overflow-hidden ${
                      isPreCutPaper ? 'gap-0 print:gap-0' : 'gap-0.5 print:gap-0'
                    }`}
                    style={{
                      height: isPreCutPaper ? '294mm' : '100%',
                      maxHeight: isPreCutPaper ? '294mm' : '275mm',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Visual Pre-Cut Indicator in screen preview */}
                    {isPreCutPaper && (
                      <div className="print:hidden flex items-center justify-between bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold px-2.5 py-1 mb-1 rounded-lg shrink-0">
                        <span className="flex items-center gap-1.5">
                          <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                          <span>معايرة الورق المقصوص مسبقاً: 3 أقسام متساوية بارتفاع فيزيائي 9.8 سم (98 مم) لكل قسم.</span>
                        </span>
                        <span className="font-mono text-[9px] bg-cyan-900/60 px-1.5 py-0.5 rounded text-cyan-200">
                          3 × 9.8 سم = 29.4 سم
                        </span>
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* 1. نسخة مرسل (SENDER COPY)                                */}
                    {/* ========================================================= */}
                    {showSenderCopy && (
                      <div
                        className={`border-2 border-black rounded-lg px-2.5 py-1.5 bg-white flex flex-col justify-between overflow-hidden print-no-break print-color-exact box-border shrink-0 ${
                          isPreCutPaper ? 'waybill-precut-section' : getSectionFlexClass(senderCopyStretch)
                        }`}
                        style={perCopyHeightStyle}
                      >
                        {/* Company Header */}
                        {showCompanyHeader && (
                          <div className="flex items-center justify-between border-b border-black pb-0.5 mb-0.5 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <OrcaLogo size={20} monochrome customLogoUrl={brandingSettings?.printLogoUrl || brandingSettings?.logoUrl} />
                              <div>
                                <div className="font-black text-xs sm:text-sm text-black tracking-tight leading-tight">
                                  {companyDisplayName}
                                </div>
                                <div className="text-[8.5px] text-black font-bold">
                                  {companySubtitleDisplay}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <div className="text-right text-[9px] border border-black px-1.5 py-0.2 rounded font-mono font-bold">
                                خدمة الزبائن: {customerServicePhoneDisplay}
                              </div>
                              <div className="bg-black text-white px-2.5 py-0.5 rounded text-[10px] font-black tracking-wider">
                                نسخة مرسل
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Top ID & Barcode / QR Bar */}
                        <div className="flex items-center justify-between border-b border-black pb-0.5 mb-0.5 shrink-0 bg-white gap-2">
                          {/* Side 1 (Right): QR Code */}
                          <div className="shrink-0 flex items-center">
                            {showQrCode && (
                              <div className="bg-white p-0.5 rounded border border-black shrink-0 flex items-center justify-center shadow-xs">
                                <WaybillQRCode value={qrPayload} size={qrSize} margin={2} />
                              </div>
                            )}
                          </div>

                          {/* Center: Tracking & Route Details */}
                          <div className="flex-1 flex flex-col items-center justify-center text-center px-1">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-black font-bold">رقم البوليصة:</span>
                              <span className="font-mono font-black text-base sm:text-lg tracking-wider text-black">
                                {p.trackingNumber}
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-[9.5px] font-bold mt-0.5 text-black flex-wrap">
                              {isRealPaperReceipt(p.paperReceiptNumber) && (
                                <>
                                  <span>وصل يدوي: <strong className="font-mono font-black text-xs text-black">#{p.paperReceiptNumber?.trim()}</strong></span>
                                  <span>•</span>
                                </>
                              )}
                              <span>المصدر: <strong className="font-black text-[11px] text-black">{originCity}</strong> ⬅ الوجهة: <strong className="font-black text-[11px] text-black">{destCity}</strong></span>
                              <span>•</span>
                              <span className="font-mono font-black text-black text-[10px]" dir="ltr">{formatEnglishDateTime(p.createdAt)}</span>
                            </div>
                          </div>

                          {/* Side 2 (Left): High-Precision Linear Barcode */}
                          <div className="shrink-0 flex items-center justify-end">
                            {showBarcode && (
                              <div className="shrink-0 flex flex-col items-center justify-center bg-white border border-black rounded p-0.5 shadow-xs overflow-visible">
                                <WaybillBarcode value={p.trackingNumber} width={1.4} height={barcodeHeight} displayValue={false} />
                                <span className="font-mono font-black text-[9px] text-black tracking-widest mt-0.5" dir="ltr">
                                  *{p.trackingNumber}*
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Main Grid: 3 Columns */}
                        <div className="grid grid-cols-3 gap-1 text-xs flex-1 my-0.5 overflow-hidden">
                          {/* Column 1: المصدر والمرسل */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[10px]">
                            <div>
                              <div className="border-b border-black pb-0.5 mb-0.5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-black">المصدر:</span>
                                <span className="text-[11px] font-black text-black">
                                  {originCity}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-[9.5px] text-slate-700 font-bold">المرسل:</div>
                                <div className="font-black text-xs sm:text-[13px] text-black truncate leading-tight">{p.sender?.name || '—'}</div>
                                <div className="text-[9.5px] text-slate-700 font-bold mt-0.5">الهاتف:</div>
                                <div className="font-mono font-black text-xs sm:text-[12.5px] text-black tracking-wider leading-tight">{p.sender?.phone || '—'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Column 2: الوجهة والمرسل إليه */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[10px]">
                            <div>
                              <div className="border-b border-black pb-0.5 mb-0.5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-black">الوجهة:</span>
                                <span className="text-[11px] font-black text-black">
                                  {destCity}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-[9.5px] text-slate-700 font-bold">المرسل إليه:</div>
                                <div className="font-black text-xs sm:text-[13px] text-black truncate leading-tight">{p.receiver?.name || '—'}</div>
                                <div className="text-[9.5px] text-slate-700 font-bold mt-0.5">الهاتف:</div>
                                <div className="font-mono font-black text-xs sm:text-[12.5px] text-black tracking-wider leading-tight">{p.receiver?.phone || '—'}</div>
                              </div>
                            </div>
                            <div className="border-t border-black/50 pt-0.5 mt-0.5 text-[9px] font-bold text-black bg-slate-50 p-0.5 rounded truncate">
                              <span className="text-slate-600">ملاحظة المستلم: </span>
                              <span>{p.destinationAddress || p.specialInstructions || 'استلام من مقر الفرع'}</span>
                            </div>
                          </div>

                          {/* Column 3: مواصفات الطرد + جدول مالي جانبي */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[9.5px]">
                            <div className="space-y-0.5">
                              <div className="border-b border-black pb-0.5 flex justify-between items-center text-[9.5px] font-black text-black">
                                <span>مواصفات الطرد</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[9.5px] font-bold text-black">
                                <div>النوع: <strong className="font-black">{p.packageType}</strong></div>
                                <div>العدد: <strong className="font-mono font-black text-xs">{p.piecesCount}</strong></div>
                                <div className="col-span-2">الوزن: <strong className="font-mono font-black text-xs">{p.weightKg} كغ</strong></div>
                              </div>
                              <div className="text-[8.5px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                <span className="text-slate-600">الوصف: </span>
                                <span>{p.contentDescription || p.specialInstructions || 'بضائع اعتيادية'}</span>
                              </div>
                              {p.truckManifestId && (
                                <div className="text-[8px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                  <span className="text-slate-600">مانافيست الشحنة: </span>
                                  <span className="font-mono font-black">{truckManifests.find((m) => m.id === p.truckManifestId)?.manifestNumber || p.truckManifestId}</span>
                                </div>
                              )}
                              {extractWeightAndTypeNote(p) && (
                                <div className="text-[8px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                  <span className="text-slate-600">ملاحظة الوزن: </span>
                                  <span className="font-bold text-black">{extractWeightAndTypeNote(p)}</span>
                                </div>
                              )}
                            </div>

                            {/* Side Financial Table */}
                            {showFinancials && (
                              <div className="border-2 border-black rounded-md overflow-hidden mt-0.5 bg-white shadow-xs">
                                <table className="w-full text-right border-collapse">
                                  <tbody>
                                    <tr className="border-b border-black/60 bg-slate-50">
                                      <td className="p-0.5 px-1 font-black text-black text-[10px]">أجور الشحن:</td>
                                      <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                        {formatCurrency(shippingFee, p.shippingCurrency || p.currency)}
                                      </td>
                                    </tr>
                                    {hasRemittance && (
                                      <tr className="border-b border-black/60">
                                        <td className="p-0.5 px-1 font-black text-black text-[10px]">قيمة البضاعة/الحوالة:</td>
                                        <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                          {formatCurrency(codAmt, p.codCurrency || p.currency)}
                                        </td>
                                      </tr>
                                    )}
                                    {hasRemittance && transferFeeAmt > 0 && (
                                      <tr className="border-b border-black/60 bg-amber-50/60">
                                        <td className="p-0.5 px-1 font-black text-black text-[10px]">عمولة الحوالة:</td>
                                        <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                          {formatCurrency(transferFeeAmt, p.transferFeeCurrency || p.codCurrency || p.currency)}
                                        </td>
                                      </tr>
                                    )}
                                    <tr className="border-b border-black/60 bg-slate-50">
                                      <td className="p-0.5 px-1 font-black text-black text-[10px]">طريقة الدفع:</td>
                                      <td className="p-0.5 px-1 font-black text-left text-black">
                                        <span className="border border-black px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-100 text-black inline-block">
                                          {paymentMethodLabel}
                                        </span>
                                      </td>
                                    </tr>
                                    <tr className="bg-black text-white font-black">
                                      <td className="p-0.5 px-1 text-[10px] font-black">
                                        {isPrepaid
                                          ? 'المستوفى سلفاً:'
                                          : !isCod
                                          ? 'أجور الشحن:'
                                          : p.codShippingPayer === 'sender'
                                          ? 'المستوفى بالفرع:'
                                          : (p.shippingCurrency || p.currency) === (p.codCurrency || p.currency)
                                          ? 'الإجمالي:'
                                          : 'الإجمالي (مفصل):'}
                                      </td>
                                      <td className="p-0.5 px-1 font-mono text-left text-[11px] sm:text-xs font-black tracking-wider">
                                        {isPrepaid ? (
                                          formatCurrency(shippingFee, p.shippingCurrency || p.currency)
                                        ) : !isCod ? (
                                          formatCurrency(shippingFee + carriedOver, p.shippingCurrency || p.currency)
                                        ) : p.codShippingPayer === 'sender' ? (
                                          <span>
                                            {formatCurrency(shippingFee, p.shippingCurrency || p.currency)} <span className="text-[9px] font-normal text-cyan-300">(شحن)</span>
                                          </span>
                                        ) : (p.shippingCurrency || p.currency) === (p.codCurrency || p.currency) ? (
                                          formatCurrency(shippingFee + codAmt + transferFeeAmt + carriedOver, p.shippingCurrency || p.currency)
                                        ) : (
                                          <span className="text-[10px] leading-tight block">
                                            {formatCurrency(shippingFee, p.shippingCurrency || p.currency)} + {formatCurrency(codAmt + transferFeeAmt, p.codCurrency || p.currency)}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cut Line 1 */}
                    {showCutLines && showSenderCopy && (showReceiverCopy || showArchiveCopy) && (
                      <div
                        className={`w-full shrink-0 ${
                          isPreCutPaper
                            ? 'border-t border-dashed border-cyan-700/60 print:border-black/30'
                            : 'my-0.5 border-t border-dashed border-black/80'
                        }`}
                        style={{ height: '0px', margin: '0px' }}
                        title="خط القص والتخريم المفرغ مسبقاً (9.8 سم)"
                      />
                    )}

                    {/* ========================================================= */}
                    {/* 2. نسخة مستلم (RECEIVER COPY)                              */}
                    {/* ========================================================= */}
                    {showReceiverCopy && (
                      <div
                        className={`border-2 border-black rounded-lg px-2.5 py-1.5 bg-white flex flex-col justify-between overflow-hidden print-no-break print-color-exact box-border shrink-0 ${
                          isPreCutPaper ? 'waybill-precut-section' : getSectionFlexClass(receiverCopyStretch)
                        }`}
                        style={perCopyHeightStyle}
                      >
                        {/* Company Header */}
                        {showCompanyHeader && (
                          <div className="flex items-center justify-between border-b border-black pb-0.5 mb-0.5 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <OrcaLogo size={20} monochrome customLogoUrl={brandingSettings?.printLogoUrl || brandingSettings?.logoUrl} />
                              <div>
                                <div className="font-black text-xs sm:text-sm text-black tracking-tight leading-tight">
                                  {companyDisplayName}
                                </div>
                                <div className="text-[8.5px] text-black font-bold">
                                  {brandingSettings?.companySubtitle
                                    ? `${brandingSettings.companyName} • إشعار تسليم الشحنة للعميل المستلم`
                                    : 'Orca Express Logistics • إشعار تسليم الشحنة للعميل المستلم'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <div className="text-right text-[9px] border border-black px-1.5 py-0.2 rounded font-mono font-bold">
                                خدمة الزبائن: {customerServicePhoneDisplay}
                              </div>
                              <div className="bg-black text-white px-2.5 py-0.5 rounded text-[10px] font-black tracking-wider">
                                نسخة مستلم
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Top ID & Barcode / QR Bar */}
                        <div className="flex items-center justify-between border-b border-black pb-0.5 mb-0.5 shrink-0 bg-white gap-2">
                          {/* Side 1 (Right): QR Code */}
                          <div className="shrink-0 flex items-center">
                            {showQrCode && (
                              <div className="bg-white p-0.5 rounded border border-black shrink-0 flex items-center justify-center shadow-xs">
                                <WaybillQRCode value={qrPayload} size={qrSize} margin={2} />
                              </div>
                            )}
                          </div>

                          {/* Center: Tracking & Route Details */}
                          <div className="flex-1 flex flex-col items-center justify-center text-center px-1">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-black font-bold">رقم البوليصة:</span>
                              <span className="font-mono font-black text-base sm:text-lg tracking-wider text-black">
                                {p.trackingNumber}
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-[9.5px] font-bold mt-0.5 text-black flex-wrap">
                              {isRealPaperReceipt(p.paperReceiptNumber) && (
                                <>
                                  <span>وصل يدوي: <strong className="font-mono font-black text-xs text-black">#{p.paperReceiptNumber?.trim()}</strong></span>
                                  <span>•</span>
                                </>
                              )}
                              <span>المصدر: <strong className="font-black text-[11px] text-black">{originCity}</strong> ⬅ الوجهة: <strong className="font-black text-[11px] text-black">{destCity}</strong></span>
                              <span>•</span>
                              <span className="font-mono font-black text-black text-[10px]" dir="ltr">{formatEnglishDateTime(p.createdAt)}</span>
                            </div>
                          </div>

                          {/* Side 2 (Left): High-Precision Linear Barcode */}
                          <div className="shrink-0 flex items-center justify-end">
                            {showBarcode && (
                              <div className="shrink-0 flex flex-col items-center justify-center bg-white border border-black rounded p-0.5 shadow-xs overflow-visible">
                                <WaybillBarcode value={p.trackingNumber} width={1.4} height={barcodeHeight} displayValue={false} />
                                <span className="font-mono font-black text-[9px] text-black tracking-widest mt-0.5" dir="ltr">
                                  *{p.trackingNumber}*
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Main Grid: 3 Columns */}
                        <div className="grid grid-cols-3 gap-1 text-xs flex-1 my-0.5 overflow-hidden">
                          {/* Column 1: المصدر والمرسل */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[10px]">
                            <div>
                              <div className="border-b border-black pb-0.5 mb-0.5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-black">المصدر:</span>
                                <span className="text-[11px] font-black text-black">
                                  {originCity}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-[9.5px] text-slate-700 font-bold">المرسل:</div>
                                <div className="font-black text-xs sm:text-[13px] text-black truncate leading-tight">{p.sender?.name || '—'}</div>
                                <div className="text-[9.5px] text-slate-700 font-bold mt-0.5">الهاتف:</div>
                                <div className="font-mono font-black text-xs sm:text-[12.5px] text-black tracking-wider leading-tight">{p.sender?.phone || '—'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Column 2: الوجهة والمرسل إليه */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[10px]">
                            <div>
                              <div className="border-b border-black pb-0.5 mb-0.5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-black">الوجهة:</span>
                                <span className="text-[11px] font-black text-black">
                                  {destCity}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-[9.5px] text-slate-700 font-bold">المرسل إليه:</div>
                                <div className="font-black text-xs sm:text-[13px] text-black truncate leading-tight">{p.receiver?.name || '—'}</div>
                                <div className="text-[9.5px] text-slate-700 font-bold mt-0.5">الهاتف:</div>
                                <div className="font-mono font-black text-xs sm:text-[12.5px] text-black tracking-wider leading-tight">{p.receiver?.phone || '—'}</div>
                              </div>
                            </div>
                            <div className="border-t border-black/50 pt-0.5 mt-0.5 text-[9px] font-bold text-black bg-slate-50 p-0.5 rounded truncate">
                              <span className="text-slate-600">ملاحظة المستلم: </span>
                              <span>{p.destinationAddress || p.specialInstructions || 'استلام من مقر الفرع'}</span>
                            </div>
                          </div>

                          {/* Column 3: مواصفات الطرد + جدول مالي جانبي */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[9.5px]">
                            <div className="space-y-0.5">
                              <div className="border-b border-black pb-0.5 flex justify-between items-center text-[9.5px] font-black text-black">
                                <span>مواصفات الطرد</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[9.5px] font-bold text-black">
                                <div>النوع: <strong className="font-black">{p.packageType}</strong></div>
                                <div>العدد: <strong className="font-mono font-black text-xs">{p.piecesCount}</strong></div>
                                <div className="col-span-2">الوزن: <strong className="font-mono font-black text-xs">{p.weightKg} كغ</strong></div>
                              </div>
                              <div className="text-[8.5px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                <span className="text-slate-600">الوصف: </span>
                                <span>{p.contentDescription || p.specialInstructions || 'بضائع اعتيادية'}</span>
                              </div>
                              {p.truckManifestId && (
                                <div className="text-[8px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                  <span className="text-slate-600">مانافيست الشحنة: </span>
                                  <span className="font-mono font-black">{truckManifests.find((m) => m.id === p.truckManifestId)?.manifestNumber || p.truckManifestId}</span>
                                </div>
                              )}
                              {extractWeightAndTypeNote(p) && (
                                <div className="text-[8px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                  <span className="text-slate-600">ملاحظة الوزن: </span>
                                  <span className="font-bold text-black">{extractWeightAndTypeNote(p)}</span>
                                </div>
                              )}
                            </div>

                            {/* Side Financial Table (Net Due Focused) */}
                            {showFinancials && (
                              <div className="border-2 border-black rounded-md overflow-hidden mt-0.5 bg-white shadow-xs">
                                <table className="w-full text-right border-collapse">
                                  <tbody>
                                    <tr className="border-b border-black/60 bg-slate-50">
                                      <td className="p-0.5 px-1 font-black text-black text-[10px]">أجور الشحن:</td>
                                      <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                        {formatCurrency(shippingFee, p.shippingCurrency || p.currency)}
                                      </td>
                                    </tr>
                                    {hasRemittance && (
                                      <tr className="border-b border-black/60">
                                        <td className="p-0.5 px-1 font-black text-black text-[10px]">قيمة البضاعة/الحوالة:</td>
                                        <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                          {formatCurrency(codAmt, p.codCurrency || p.currency)}
                                        </td>
                                      </tr>
                                    )}
                                    {hasRemittance && transferFeeAmt > 0 && (
                                      <tr className="border-b border-black/60 bg-amber-50/60">
                                        <td className="p-0.5 px-1 font-black text-black text-[10px]">عمولة الحوالة:</td>
                                        <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                          {formatCurrency(transferFeeAmt, p.transferFeeCurrency || p.codCurrency || p.currency)}
                                        </td>
                                      </tr>
                                    )}
                                    <tr className="border-b border-black/60 bg-slate-50">
                                      <td className="p-0.5 px-1 font-black text-black text-[10px]">طريقة الدفع:</td>
                                      <td className="p-0.5 px-1 font-black text-left text-black">
                                        <span className="border border-black px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-100 text-black inline-block">
                                          {paymentMethodLabel}
                                        </span>
                                      </td>
                                    </tr>
                                    <tr className="bg-black text-white font-black">
                                      <td className="p-0.5 px-1 text-[10px] font-black">
                                        {isPrepaid
                                          ? 'المطلوب تحصيله:'
                                          : !isCod
                                          ? 'المطلوب دفعه:'
                                          : p.codShippingPayer === 'sender'
                                          ? 'المطلوب (حوالة فقط):'
                                          : (p.shippingCurrency || p.currency) === (p.codCurrency || p.currency)
                                          ? 'المطلوب دفعه:'
                                          : 'المطلوب دفعه (مفصل):'}
                                      </td>
                                      <td className="p-0.5 px-1 font-mono text-left text-[11px] sm:text-xs font-black tracking-wider">
                                        {isPrepaid ? (
                                          '0 (مسدد سلفاً)'
                                        ) : !isCod ? (
                                          formatCurrency(shippingFee + carriedOver, p.shippingCurrency || p.currency)
                                        ) : p.codShippingPayer === 'sender' ? (
                                          formatCurrency(codAmt + transferFeeAmt + carriedOver, p.codCurrency || p.currency)
                                        ) : (p.shippingCurrency || p.currency) === (p.codCurrency || p.currency) ? (
                                          formatCurrency(shippingFee + codAmt + transferFeeAmt + carriedOver, p.shippingCurrency || p.currency)
                                        ) : (
                                          <span className="text-[10px] leading-tight block">
                                            {formatCurrency(shippingFee, p.shippingCurrency || p.currency)} (شحن) + {formatCurrency(codAmt + transferFeeAmt, p.codCurrency || p.currency)} (حوالة)
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cut Line 2 */}
                    {showCutLines && showReceiverCopy && showArchiveCopy && (
                      <div
                        className={`w-full shrink-0 ${
                          isPreCutPaper
                            ? 'border-t border-dashed border-cyan-700/60 print:border-black/30'
                            : 'my-0.5 border-t border-dashed border-black/80'
                        }`}
                        style={{ height: '0px', margin: '0px' }}
                        title="خط القص والتخريم المفرغ مسبقاً (19.6 سم)"
                      />
                    )}

                    {/* ========================================================= */}
                    {/* 3. نسخة أرشفة (ARCHIVE COPY)                                */}
                    {/* ========================================================= */}
                    {showArchiveCopy && (
                      <div
                        className={`border-2 border-black rounded-lg px-2.5 py-1.5 bg-white flex flex-col justify-between overflow-hidden print-no-break print-color-exact box-border shrink-0 ${
                          isPreCutPaper ? 'waybill-precut-section' : getSectionFlexClass(archiveCopyStretch)
                        }`}
                        style={perCopyHeightStyle}
                      >
                        {/* Company Header */}
                        {showCompanyHeader && (
                          <div className="flex items-center justify-between border-b border-black pb-0.5 mb-0.5 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <OrcaLogo size={20} monochrome customLogoUrl={brandingSettings?.printLogoUrl || brandingSettings?.logoUrl} />
                              <div>
                                <div className="font-black text-xs sm:text-sm text-black tracking-tight leading-tight">
                                  {companyDisplayName}
                                </div>
                                <div className="text-[8.5px] text-black font-bold">
                                  {brandingSettings?.companySubtitle
                                    ? `${brandingSettings.companyName} • سجل المركز والتدقيق المالي والأرشفة`
                                    : 'Orca Express Logistics • سجل المركز والتدقيق المالي والأرشفة'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <div className="text-right text-[9px] border border-black px-1.5 py-0.2 rounded font-mono font-bold">
                                خدمة الزبائن: {customerServicePhoneDisplay}
                              </div>
                              <div className="bg-black text-white px-2.5 py-0.5 rounded text-[10px] font-black tracking-wider">
                                نسخة أرشفة
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Top ID & Barcode / QR Bar */}
                        <div className="flex items-center justify-between border-b border-black pb-0.5 mb-0.5 shrink-0 bg-white gap-2">
                          {/* Side 1 (Right): QR Code */}
                          <div className="shrink-0 flex items-center">
                            {showQrCode && (
                              <div className="bg-white p-0.5 rounded border border-black shrink-0 flex items-center justify-center shadow-xs">
                                <WaybillQRCode value={qrPayload} size={qrSize} margin={2} />
                              </div>
                            )}
                          </div>

                          {/* Center: Tracking & Route Details */}
                          <div className="flex-1 flex flex-col items-center justify-center text-center px-1">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-black font-bold">رقم البوليصة:</span>
                              <span className="font-mono font-black text-base sm:text-lg tracking-wider text-black">
                                {p.trackingNumber}
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-[9.5px] font-bold mt-0.5 text-black flex-wrap">
                              {isRealPaperReceipt(p.paperReceiptNumber) && (
                                <>
                                  <span>وصل يدوي: <strong className="font-mono font-black text-xs text-black">#{p.paperReceiptNumber?.trim()}</strong></span>
                                  <span>•</span>
                                </>
                              )}
                              <span>المصدر: <strong className="font-black text-[11px] text-black">{originCity}</strong> ⬅ الوجهة: <strong className="font-black text-[11px] text-black">{destCity}</strong></span>
                              <span>•</span>
                              <span className="font-mono font-black text-black text-[10px]" dir="ltr">{formatEnglishDateTime(p.createdAt)}</span>
                            </div>
                          </div>

                          {/* Side 2 (Left): High-Precision Linear Barcode */}
                          <div className="shrink-0 flex items-center justify-end">
                            {showBarcode && (
                              <div className="shrink-0 flex flex-col items-center justify-center bg-white border border-black rounded p-0.5 shadow-xs overflow-visible">
                                <WaybillBarcode value={p.trackingNumber} width={1.4} height={barcodeHeight} displayValue={false} />
                                <span className="font-mono font-black text-[9px] text-black tracking-widest mt-0.5" dir="ltr">
                                  *{p.trackingNumber}*
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Main Grid: 3 Columns */}
                        <div className="grid grid-cols-3 gap-1 text-xs flex-1 my-0.5 overflow-hidden">
                          {/* Column 1: المصدر والمرسل */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[10px]">
                            <div>
                              <div className="border-b border-black pb-0.5 mb-0.5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-black">المصدر:</span>
                                <span className="text-[11px] font-black text-black">
                                  {originCity}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-[9.5px] text-slate-700 font-bold">المرسل:</div>
                                <div className="font-black text-xs sm:text-[13px] text-black truncate leading-tight">{p.sender?.name || '—'}</div>
                                <div className="text-[9.5px] text-slate-700 font-bold mt-0.5">الهاتف:</div>
                                <div className="font-mono font-black text-xs sm:text-[12.5px] text-black tracking-wider leading-tight">{p.sender?.phone || '—'}</div>
                              </div>
                            </div>
                          </div>

                          {/* Column 2: الوجهة والمرسل إليه + توقيع المستلم في الأرشيف */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[10px]">
                            <div>
                              <div className="border-b border-black pb-0.5 mb-0.5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-black">الوجهة:</span>
                                <span className="text-[11px] font-black text-black">
                                  {destCity}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-[9.5px] text-slate-700 font-bold">المرسل إليه:</div>
                                <div className="font-black text-xs sm:text-[13px] text-black truncate leading-tight">{p.receiver?.name || '—'}</div>
                                <div className="text-[9.5px] text-slate-700 font-bold mt-0.5">الهاتف:</div>
                                <div className="font-mono font-black text-xs sm:text-[12.5px] text-black tracking-wider leading-tight">{p.receiver?.phone || '—'}</div>
                              </div>
                            </div>

                            {/* Recipient Signature & Pledge directly under receiver info on Archive Copy */}
                            {showLegalTerms && (
                              <div className="border-t border-black/70 pt-0.5 mt-0.5 bg-slate-50/90 -mx-1 px-1 pb-0.5 rounded-xs">
                                <div className="text-[7.5px] font-bold text-slate-900 leading-tight">
                                  تعهد واستلام: أقر باستلام الشحنة كاملة وسليمة دون أي نقص أو كسر.
                                </div>
                                <div className="text-[8px] font-black text-black mt-0.5">
                                  توقيع المستلم: ___________________
                                </div>
                              </div>
                            )}

                            {/* Recipient Note below signature without conflict */}
                            <div className="border-t border-dotted border-black/40 pt-0.5 mt-0.5 text-[8.5px] font-bold text-black truncate">
                              <span className="text-slate-600">ملاحظة المستلم: </span>
                              <span>{p.destinationAddress || p.specialInstructions || 'استلام من مقر الفرع'}</span>
                            </div>
                          </div>

                          {/* Column 3: مواصفات الطرد + جدول مالي جانبي */}
                          <div className="border border-black p-1 rounded flex flex-col justify-between bg-white text-[9.5px]">
                            <div className="space-y-0.5">
                              <div className="border-b border-black pb-0.5 flex justify-between items-center text-[9.5px] font-black text-black">
                                <span>مواصفات الطرد</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[9.5px] font-bold text-black">
                                <div>النوع: <strong className="font-black">{p.packageType}</strong></div>
                                <div>العدد: <strong className="font-mono font-black text-xs">{p.piecesCount}</strong></div>
                                <div className="col-span-2">الوزن: <strong className="font-mono font-black text-xs">{p.weightKg} كغ</strong></div>
                              </div>
                              <div className="text-[8.5px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                <span className="text-slate-600">الوصف: </span>
                                <span>{p.contentDescription || p.specialInstructions || 'بضائع اعتيادية'}</span>
                              </div>
                              {p.truckManifestId && (
                                <div className="text-[8px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                  <span className="text-slate-600">مانافيست الشحنة: </span>
                                  <span className="font-mono font-black">{truckManifests.find((m) => m.id === p.truckManifestId)?.manifestNumber || p.truckManifestId}</span>
                                </div>
                              )}
                              {extractWeightAndTypeNote(p) && (
                                <div className="text-[8px] font-bold text-black border-t border-dotted border-black/60 pt-0.5 truncate">
                                  <span className="text-slate-600">ملاحظة الوزن: </span>
                                  <span className="font-bold text-black">{extractWeightAndTypeNote(p)}</span>
                                </div>
                              )}
                            </div>

                            {/* Side Financial Table */}
                            {showFinancials && (
                              <div className="border-2 border-black rounded-md overflow-hidden mt-0.5 bg-white shadow-xs">
                                <table className="w-full text-right border-collapse">
                                  <tbody>
                                    <tr className="border-b border-black/60 bg-slate-50">
                                      <td className="p-0.5 px-1 font-black text-black text-[10px]">أجور الشحن:</td>
                                      <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                        {formatCurrency(shippingFee, p.shippingCurrency || p.currency)}
                                      </td>
                                    </tr>
                                    {hasRemittance && (
                                      <tr className="border-b border-black/60">
                                        <td className="p-0.5 px-1 font-black text-black text-[10px]">قيمة البضاعة/الحوالة:</td>
                                        <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                          {formatCurrency(codAmt, p.codCurrency || p.currency)}
                                        </td>
                                      </tr>
                                    )}
                                    {hasRemittance && transferFeeAmt > 0 && (
                                      <tr className="border-b border-black/60 bg-amber-50/60">
                                        <td className="p-0.5 px-1 font-black text-black text-[10px]">عمولة الحوالة:</td>
                                        <td className="p-0.5 px-1 font-mono font-black text-left text-black text-xs tracking-wide">
                                          {formatCurrency(transferFeeAmt, p.transferFeeCurrency || p.codCurrency || p.currency)}
                                        </td>
                                      </tr>
                                    )}
                                    <tr className="border-b border-black/60 bg-slate-50">
                                      <td className="p-0.5 px-1 font-black text-black text-[10px]">طريقة الدفع:</td>
                                      <td className="p-0.5 px-1 font-black text-left text-black">
                                        <span className="border border-black px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-100 text-black inline-block">
                                          {paymentMethodLabel}
                                        </span>
                                      </td>
                                    </tr>
                                    <tr className="bg-black text-white font-black">
                                      <td className="p-0.5 px-1 text-[10px] font-black">
                                        {isPrepaid
                                          ? 'المطلوب تحصيله:'
                                          : !isCod
                                          ? 'المجموع الصافي:'
                                          : p.codShippingPayer === 'sender'
                                          ? 'المطلوب (حوالة فقط):'
                                          : (p.shippingCurrency || p.currency) === (p.codCurrency || p.currency)
                                          ? 'المجموع الصافي:'
                                          : 'المجموع (مفصل):'}
                                      </td>
                                      <td className="p-0.5 px-1 font-mono text-left text-[11px] sm:text-xs font-black tracking-wider">
                                        {isPrepaid ? (
                                          '0 (مسدد سلفاً)'
                                        ) : !isCod ? (
                                          formatCurrency(shippingFee + carriedOver, p.shippingCurrency || p.currency)
                                        ) : p.codShippingPayer === 'sender' ? (
                                          formatCurrency(codAmt + transferFeeAmt + carriedOver, p.codCurrency || p.currency)
                                        ) : (p.shippingCurrency || p.currency) === (p.codCurrency || p.currency) ? (
                                          formatCurrency(shippingFee + codAmt + transferFeeAmt + carriedOver, p.shippingCurrency || p.currency)
                                        ) : (
                                          <span className="text-[10px] leading-tight block">
                                            {formatCurrency(shippingFee, p.shippingCurrency || p.currency)} (شحن) + {formatCurrency(codAmt + transferFeeAmt, p.codCurrency || p.currency)} (حوالة)
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* 2. MASTER TRUCK & COURIER MANIFEST A4 (مانافيست الشاحنة والموزع A4) */}
              {/* ========================================================= */}
              {printModalType === 'manifest_a4' && selectedManifestForPrint && (() => {
                const m = selectedManifestForPrint;
                const parcelsList = manifestParcels || [];
                const totalPieces = parcelsList.reduce((s, p) => s + (p.piecesCount || 1), 0);
                const totalWeight = parcelsList.reduce((s, p) => s + (p.weightKg || 0), 0);

                // Detect if this is a Courier Manifest (مانافيست موزع)
                const isCourierManifest = Boolean(
                  m.isCourierManifest ||
                  m.manifestNumber?.includes('CUR') ||
                  m.manifestNumber?.startsWith('DLV-') ||
                  m.truckType?.includes('توزيع') ||
                  m.truckPlate === 'موزع محلي' ||
                  (m.originHubId && m.originHubId === m.destinationHubId && (m.driverName || m.courierName))
                );

                // Origin & Destination names (التركيز على اسم المدينة أو الفرع)
                const originName = manifestOrigin?.city || manifestOrigin?.name || 'المصدر';
                const destName = isCourierManifest
                  ? 'مانافيست موزع'
                  : manifestDest?.city || manifestDest?.name || 'كافة الوجهات';

                return (
                  <div
                    id="manifest-print-root"
                    className={`space-y-2.5 text-slate-900 text-right ${
                      manifestPureWhite ? 'manifest-pure-white' : ''
                    }`}
                    style={{ fontSize: `${(manifestFontScale / 100) * 11}px` }}
                  >
                    {/* MANIFEST MASTER HEADER (هيدر مشترك مع تسجيل واضح للمصدر والوجهة) */}
                    <div className="border-2 border-black rounded-lg p-2.5 bg-slate-50">
                      <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-2 mb-2">
                        {/* Company & Title */}
                        <div className="flex items-center gap-2.5">
                          <OrcaLogo size={32} purpose="print" />
                          <div>
                            <div className="font-black text-base text-black leading-tight">
                              {brandingSettings?.companyName || 'شركة أوركا للشحن السريع'}
                            </div>
                            <div className="text-[11px] font-bold text-slate-700">
                              {isCourierManifest
                                ? 'مانافيست موزع / كشف تسليمات الموزع'
                                : 'مانافيست ترحيل شحنات بري'}
                            </div>
                          </div>
                        </div>

                        {/* PROMINENT SOURCE & DESTINATION ROUTE CARD (المصدر والوجهة مع سهم دقيق من المصدر إلى الوجهة) */}
                        <div className="border-2 border-black bg-white rounded-md px-4 py-1.5 flex items-center gap-3 text-center shadow-xs" dir="rtl">
                          <div className="text-right">
                            <div className="text-[9px] font-bold text-slate-500 uppercase">المصدر (الانطلاق)</div>
                            <div className="text-sm font-black text-black leading-tight">{originName}</div>
                          </div>
                          <div className="text-black flex items-center justify-center px-1" title={isCourierManifest ? "توزيع محلي للموزع" : "مسار الشاحنة من المصدر إلى الوجهة"}>
                            {/* Arrow pointing strictly from Origin (Right) to Destination (Left) */}
                            <svg className="w-5 h-5 text-black stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <div className="text-[9px] font-bold text-slate-500 uppercase">
                              {isCourierManifest ? 'الجهة (التوزيع)' : 'الجهة (الوصول)'}
                            </div>
                            <div className="text-sm font-black text-black leading-tight">
                              {isCourierManifest ? 'مانافيست موزع' : destName}
                            </div>
                          </div>
                        </div>

                        {/* Manifest Number & Barcode / Date (الرقم مباشرة بسطر واحد والتاريخ بالإنكليزية) */}
                        <div className="text-left flex flex-col items-end justify-center">
                          <div className="font-mono font-black text-sm sm:text-base text-black px-2.5 py-0.5 bg-slate-100 border-2 border-black rounded shadow-xs tracking-wider" dir="ltr">
                            {m.manifestNumber}
                          </div>
                          <div className="text-[10px] font-mono font-bold text-black mt-0.5 tracking-tight" dir="ltr">
                            {formatEnglishDateTime(m.createdAt)}
                          </div>
                        </div>
                      </div>

                      {/* GENERAL MANIFEST METADATA (بيانات المانافيست العامة) */}
                      {manifestShowTripInfo && (
                        <div className="grid grid-cols-4 gap-2 text-[10.5px] font-bold text-black pt-0.5">
                          <div className="bg-white border border-black rounded px-2 py-1 flex items-center justify-between">
                            <span className="text-slate-600">{isCourierManifest ? 'الموزع:' : 'السائق:'}</span>
                            <span className="font-black text-black truncate max-w-[130px]">
                              {m.courierName || m.driverName || (isCourierManifest ? 'الموزع' : 'سائق الرحلة')}
                            </span>
                          </div>
                          <div className="bg-white border border-black rounded px-2 py-1 flex items-center justify-between">
                            <span className="text-slate-600">{isCourierManifest ? 'هاتف / صفة الموزع:' : 'رقم الشاحنة / اللوحة:'}</span>
                            <span className="font-mono font-black text-black truncate max-w-[130px]">
                              {isCourierManifest
                                ? m.courierPhone || m.driverPhone || m.truckPlate || 'موزع معتمد'
                                : m.truckPlate || '—'}
                            </span>
                          </div>
                          <div className="bg-white border border-black rounded px-2 py-1 flex items-center justify-between">
                            <span className="text-slate-600">إجمالي الشحنات:</span>
                            <span className="font-mono font-black text-black">{parcelsList.length} شحنة</span>
                          </div>
                          <div className="bg-black text-white rounded px-2 py-1 flex items-center justify-between">
                            <span>إجمالي الطرود:</span>
                            <span className="font-mono font-black">{totalPieces} طرد</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* MANIFEST PARCEL TABLE (جدول الطرود بسطر واحد مضغوط لكل بند ليتسع لأكبر عدد طرود) */}
                    <div className="border-2 border-black rounded overflow-hidden">
                      <table className="w-full text-right border-collapse select-text">
                        <thead>
                          <tr className="bg-black text-white text-[10px] font-black h-6">
                            <th className="border-l border-white/40 w-7 text-center px-1">#</th>
                            {manifestShowParcelTracking && (
                              <th className="border-l border-white/40 px-1.5 w-28 whitespace-nowrap">رقم الطرد</th>
                            )}
                            {manifestShowSenderName && (
                              <th className="border-l border-white/40 px-2 whitespace-nowrap">المرسل</th>
                            )}
                            {manifestShowReceiverName && (
                              <th className="border-l border-white/40 px-2 whitespace-nowrap">المستلم</th>
                            )}
                            {manifestShowParcelType && (
                              <th className="border-l border-white/40 px-1.5 w-24 whitespace-nowrap">نوع الطرد</th>
                            )}
                            {manifestShowPiecesCount && (
                              <th className="border-l border-white/40 px-1.5 w-16 text-center whitespace-nowrap">عدد الطرود</th>
                            )}
                            {manifestShowParcelWeight && (
                              <th className="border-l border-white/40 px-1.5 w-16 text-center whitespace-nowrap">الوزن</th>
                            )}
                            {manifestShowParcelNotes && (
                              <th className="border-l border-white/40 px-2 w-28 whitespace-nowrap">الملاحظات</th>
                            )}
                            {manifestShowFinancials && (
                              <th className="border-l border-white/40 px-2 w-28 text-center whitespace-nowrap">المالية والدفع</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/30 text-[9.5px]">
                          {parcelsList.map((p, idx) => {
                            const rowDensityClass =
                              manifestTableDensity === 'compact'
                                ? 'h-4.5 py-0.5'
                                : manifestTableDensity === 'relaxed'
                                ? 'h-7 py-1'
                                : 'h-5.5 py-0.5';

                            return (
                              <tr
                                key={p.id}
                                className={`font-bold transition-colors ${
                                  idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                                }`}
                              >
                                {/* Index */}
                                <td
                                  className={`border-l border-black/30 text-center font-mono font-bold text-black px-1 leading-tight whitespace-nowrap ${rowDensityClass}`}
                                >
                                  {idx + 1}
                                </td>

                                {/* Parcel Number */}
                                {manifestShowParcelTracking && (
                                  <td
                                    className={`border-l border-black/30 px-1.5 font-mono font-black text-black whitespace-nowrap leading-tight ${rowDensityClass}`}
                                  >
                                    {p.trackingNumber}
                                  </td>
                                )}

                                {/* Sender Name Only (Single line) */}
                                {manifestShowSenderName && (
                                  <td className={`border-l border-black/30 px-2 whitespace-nowrap leading-tight ${rowDensityClass}`}>
                                    <div className="font-black text-black truncate max-w-[150px]" title={p.sender?.name || ''}>
                                      {p.sender?.name || '—'}
                                    </div>
                                  </td>
                                )}

                                {/* Receiver Name Only (Single line) */}
                                {manifestShowReceiverName && (
                                  <td className={`border-l border-black/30 px-2 whitespace-nowrap leading-tight ${rowDensityClass}`}>
                                    <div className="font-black text-black truncate max-w-[150px]" title={p.receiver?.name || ''}>
                                      {p.receiver?.name || '—'}
                                    </div>
                                  </td>
                                )}

                                {/* Parcel Type */}
                                {manifestShowParcelType && (
                                  <td
                                    className={`border-l border-black/30 px-1.5 font-bold text-black whitespace-nowrap leading-tight ${rowDensityClass}`}
                                  >
                                    <div className="truncate max-w-[100px]" title={p.packageType || 'طرد اعتيادي'}>
                                      {p.packageType || 'طرد اعتيادي'}
                                    </div>
                                  </td>
                                )}

                                {/* Pieces Count */}
                                {manifestShowPiecesCount && (
                                  <td
                                    className={`border-l border-black/30 px-1.5 text-center font-mono font-black text-black whitespace-nowrap leading-tight ${rowDensityClass}`}
                                  >
                                    {p.piecesCount || 1}
                                  </td>
                                )}

                                {/* Weight (Optional) */}
                                {manifestShowParcelWeight && (
                                  <td
                                    className={`border-l border-black/30 px-1.5 text-center font-mono font-bold text-black whitespace-nowrap leading-tight ${rowDensityClass}`}
                                  >
                                    {p.weightKg || 0} كغ
                                  </td>
                                )}

                                {/* Notes (Optional) */}
                                {manifestShowParcelNotes && (
                                  <td
                                    className={`border-l border-black/30 px-2 text-[9px] text-slate-700 truncate max-w-[120px] whitespace-nowrap leading-tight ${rowDensityClass}`}
                                    title={p.specialInstructions || p.contentDescription || '—'}
                                  >
                                    {p.specialInstructions || p.contentDescription || '—'}
                                  </td>
                                )}

                                {/* Financials (Optional) */}
                                {manifestShowFinancials && (
                                  <td
                                    className={`border-l border-black/30 px-2 font-mono text-center text-[9px] whitespace-nowrap leading-tight ${rowDensityClass}`}
                                  >
                                    {(() => {
                                      const s = getParcelPaymentSummary(p);
                                      if (s.normalizedType === 'cod') {
                                        return (
                                          <span className="text-amber-950 font-black">
                                            COD: {formatCurrency(s.codAmount, s.codCurrency)}
                                          </span>
                                        );
                                      }
                                      if (s.normalizedType === 'collect') {
                                        return (
                                          <span className="text-sky-950 font-bold">
                                            على المستلم: {formatCurrency(s.shippingCost, s.shippingCurrency)}
                                          </span>
                                        );
                                      }
                                      return <span className="text-emerald-900 font-bold">مسدد سلفاً</span>;
                                    })()}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-black text-white font-black text-[10px] h-6 border-t-2 border-black">
                            <td colSpan={manifestShowSenderName && manifestShowReceiverName ? 3 : 2} className="px-2 whitespace-nowrap">
                              المجموع العام: {parcelsList.length} شحنة
                            </td>
                            <td colSpan={2} className="px-2 font-mono text-center whitespace-nowrap">
                              إجمالي الطرود: {totalPieces} طرد
                              {manifestShowParcelWeight ? ` • الوزن: ${totalWeight} كغ` : ''}
                            </td>
                            {manifestShowFinancials && (
                              <td className="px-2 font-mono text-center text-amber-300 whitespace-nowrap">
                                {manifestTotalCodSyp > 0 && manifestTotalCodUsd > 0 ? (
                                  <div className="space-y-0.5">
                                    <div>COD: {formatCurrency(manifestTotalCodSyp, 'SYP')}</div>
                                    <div className="text-amber-200">+ {formatCurrency(manifestTotalCodUsd, 'USD')}</div>
                                  </div>
                                ) : manifestTotalCodUsd > 0 ? (
                                  <div>COD: {formatCurrency(manifestTotalCodUsd, 'USD')}</div>
                                ) : (
                                  <div>COD: {formatCurrency(manifestTotalCodSyp, 'SYP')}</div>
                                )}
                              </td>
                            )}
                            <td colSpan={manifestShowFinancials ? 1 : 2} className="px-2 text-left"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* SIGNATURES SECTION (خانة التواقيع المعتمدة) */}
                    {manifestShowSignatures && (
                      <div className="grid grid-cols-3 gap-3 pt-1 border-t-2 border-black text-[10px] font-bold text-center">
                        <div className="border border-black p-1.5 rounded bg-slate-50">
                          {isCourierManifest ? 'أمين المستودع المسلّم: __________________' : 'أمين مستودع الترحيل: __________________'}
                        </div>
                        <div className="border border-black p-1.5 rounded bg-slate-50 truncate">
                          {isCourierManifest
                            ? `توقيع واستلام الموزع (${m.courierName || m.driverName || 'الموزع'}): __________________`
                            : `توقيع واستلام السائق (${m.driverName || 'السائق'}): __________________`}
                        </div>
                        <div className="border border-black p-1.5 rounded bg-slate-50">
                          {isCourierManifest ? 'المطابقة وتصفية العهدة: __________________' : 'أمين مستودع الوصول: __________________'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </main>
      </div>
    </div>,
    document.body
  );
};
