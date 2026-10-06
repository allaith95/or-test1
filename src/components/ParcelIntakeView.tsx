import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOrca } from '../context/OrcaContext';
import {
  Package,
  Printer,
  Calculator,
  QrCode,
  FileText,
  DollarSign,
  Coins,
  ShieldAlert,
  Search,
  CheckCircle,
  Check,
  Clock,
  Calendar,
  MapPin,
  Building,
  UserCheck,
  Scan,
  CreditCard,
  Sparkles,
  Scale,
  Box,
  Sliders,
  Route,
  Zap,
  Users,
  User,
  UserPlus,
  Upload,
  Image as ImageIcon,
  Info,
  X,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  ArrowRightLeft,
  Eye,
  Send,
  Lock,
  Unlock,
  ShieldCheck,
  Volume2,
  Radio,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import {
  PackageType,
  PaymentType,
  Currency,
  Governorate,
  Parcel,
  PricingBasis,
  ParcelSizeTier,
  ShippingCategory,
  Customer,
  IdDocumentType,
} from '../types';
import { SIZE_TIERS_CONFIG, getGovernorateDistance } from '../utils/distanceEngine';
import { CustomerDirectoryModal } from './CustomerDirectoryModal';
import { FormattedAmountInput } from './FormattedAmountInput';
import { BirthDateField } from './BirthDateField';
import { validateBirthDate } from '../utils/birthDateUtility';
import { validateParcelForm } from '../shared/parcelValidation';
import { DEFAULT_PACKAGE_TYPES, DEFAULT_ID_DOCUMENT_TYPES } from '../data/initialData';
import { getSubBranchesForMainHub } from '../utils/branchHelper';
import { normalizeCustomerNames } from '../utils/nameUtils';
import { setPhoto } from '../utils/photoStorage';
import {
  blockNonAmountKeys,
  blockNonIntegerKeys,
  blockNonPhoneKeys,
  sanitizeDecimal,
  sanitizeDigitsOnly,
  sanitizePhone,
} from '../utils/numberSanitizer';
import { parseSyrianSmartIdBarcode, mapArabicKeyboardToAscii, extractNationalIdNumber } from '../utils/BarcodeDecoderHook';
import {
  resolveSmartSyrianCivilProfile,
  normalizeBirthDateToISO,
  formatDateToDMY,
  processSyrianIdScannerPayload,
  SyrianIdScannerResult
} from '../utils/BarcodeScannerUtility';
import { useBarcodeDecoder } from '../hooks/useBarcodeDecoder';
import { formDraftStorage } from '../utils/formDraftStorage';
import { getParcelPaymentSummary } from '../utils/settlementMath';
import { computeParcelFinancialSummary } from '../shared/financialCalculations';

const SYRIAN_GOVERNORATES: Governorate[] = [
  'دمشق',
  'ريف دمشق',
  'حلب',
  'حمص',
  'حماة',
  'اللاذقية',
  'طرطوس',
  'السويداء',
  'درعا',
  'دير الزور',
  'الحسكة',
  'الرقة',
  'إدلب',
  'القنيطرة',
];

const getPackageTypeSuggestion = (currentVal: string, options: string[]): string => {
  if (!currentVal || !currentVal.trim()) return '';
  const cleanCurrent = currentVal.trim().toLowerCase();
  const found = options.find((opt) => opt.trim().toLowerCase().startsWith(cleanCurrent));
  if (found && found.trim().toLowerCase() !== cleanCurrent) {
    return found;
  }
  return '';
};

export const ParcelIntakeView: React.FC = () => {
  const {
    currentBranch,
    branches,
    currentUser,
    registerParcel,
    calculatePrice,
    openPrintModal,
    setSelectedParcelForQuickView,
    parcels,
    customers,
    addCustomer,
    updateCustomer,
    hasPermission,
    brandingSettings,
    calculateCodTransferFee,
    getCodCommissionLabel,
    codSettings,
    pricingRules,
    formatCurrency,
    formatNumber,
    formatQuantity,
    ensureServerConnected,
    isServerOnline,
  } = useOrca();

  // Dynamic Package Types resolved from central branding or defaults
  const packageTypes: string[] =
    brandingSettings.packageTypes && brandingSettings.packageTypes.length > 0
      ? brandingSettings.packageTypes
      : DEFAULT_PACKAGE_TYPES;

  // Dynamic Document Types resolved from central branding or defaults
  const idDocumentTypes: string[] =
    brandingSettings.idDocumentTypes && brandingSettings.idDocumentTypes.length > 0
      ? brandingSettings.idDocumentTypes
      : DEFAULT_ID_DOCUMENT_TYPES;

  const normalizeIdType = (val?: string): string => {
    if (!val) return idDocumentTypes[0] || 'هوية سورية';
    if (val === 'syrian') return 'هوية سورية';
    if (val === 'palestinian') return 'هوية فلسطيني';
    return val;
  };

  // Customer Directory & Existing Customer State
  const [isCustomerDirectoryModalOpen, setIsCustomerDirectoryModalOpen] = useState(false);
  const [existingCustomerAlert, setExistingCustomerAlert] = useState<{
    customer: Customer;
    message: string;
  } | null>(null);

  // Status for Scanned / Checked Customer (موجود سابقاً / عميل جديد غير مسجل)
  const [idCustomerStatus, setIdCustomerStatus] = useState<{
    type: 'existing' | 'new';
    customer?: Customer;
    scannedName?: string;
    message?: string;
  } | null>(null);

  // Selected Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Quick Customer Search State (خيار بحث سريع بدون الحاجة للدخول لقائمة)
  const [quickCustomerQuery, setQuickCustomerQuery] = useState('');
  const [isQuickCustomerDropdownOpen, setIsQuickCustomerDropdownOpen] = useState(false);
  const quickCustomerSearchRef = useRef<HTMLDivElement>(null);

  const matchingCustomers = quickCustomerQuery.trim()
    ? customers
        .filter((c) => {
          const q = quickCustomerQuery.trim().toLowerCase();
          const cleanQ = q.replace(/\D/g, '');
          const matchName =
            (c.fullName && c.fullName.toLowerCase().includes(q)) ||
            (c.firstName && c.firstName.toLowerCase().includes(q)) ||
            (c.fatherName && c.fatherName.toLowerCase().includes(q)) ||
            (c.lastName && c.lastName.toLowerCase().includes(q)) ||
            (c.motherName && c.motherName.toLowerCase().includes(q)) ||
            (c.companyName && c.companyName.toLowerCase().includes(q));
          const matchPhone = cleanQ.length >= 3 && (
            (c.phone && c.phone.replace(/\D/g, '').includes(cleanQ)) ||
            (c.secondaryPhone && c.secondaryPhone.replace(/\D/g, '').includes(cleanQ))
          );
          const matchNationalId = cleanQ.length >= 3 && c.nationalId
            ? c.nationalId.replace(/\D/g, '').includes(cleanQ)
            : false;
          const matchCity =
            (c.city && c.city.toLowerCase().includes(q)) ||
            (c.address && c.address.toLowerCase().includes(q));
          return matchName || matchPhone || matchNationalId || matchCity;
        })
        .slice(0, 8)
    : [];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        quickCustomerSearchRef.current &&
        !quickCustomerSearchRef.current.contains(e.target as Node)
      ) {
        setIsQuickCustomerDropdownOpen(false);
      }
      if (
        receiverInputContainerRef.current &&
        !receiverInputContainerRef.current.contains(e.target as Node)
      ) {
        setIsReceiverDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const [senderIdPhotoFront, setSenderIdPhotoFront] = useState<string>('');
  const [senderIdPhotoBack, setSenderIdPhotoBack] = useState<string>('');

  const isManualPricing = (brandingSettings.activePricingPolicy || 'manual_pricing') === 'manual_pricing';

  const canCreateParcel = hasPermission('parcels.create');
  const canPrintParcel = hasPermission('parcels.print_a4');
  const canViewPhone = hasPermission('parcels.view_phone') && (currentUser.permissions?.fieldRestrictions?.canViewClientPhoneNumbers ?? true);
  const canViewNationalId = hasPermission('parcels.view_civil_id') && (currentUser.permissions?.fieldRestrictions?.canViewNationalId ?? true);
  const canViewFinancials = hasPermission('parcels.view_financials') && (currentUser.permissions?.fieldRestrictions?.canViewFinancialTotals ?? true);
  const canOverridePrices = hasPermission('parcels.override_prices') && (currentUser.permissions?.fieldRestrictions?.canOverridePrices ?? true);

  const maskPhone = (ph: string) => {
    if (!ph || ph.length < 5) return ph;
    return ph.slice(0, 4) + '***' + ph.slice(-2);
  };

  const maskId = (id: string) => {
    if (!id || id.length < 5) return id;
    return id.slice(0, 4) + '***' + id.slice(-3);
  };

  // Form Draft Recovery (حماية المسودة والبيانات قيد الإدخال عند التحديث أو المزامنة)
  const initialDraft = useMemo(() => {
    const saved = formDraftStorage.getDraft<any>('parcel_intake');
    return saved?.data || null;
  }, []);

  const [draftRestoredAlert, setDraftRestoredAlert] = useState<boolean>(() => Boolean(initialDraft));

  // Form State
  const [paperReceiptNumber, setPaperReceiptNumber] = useState<string>(() => initialDraft?.paperReceiptNumber || '');
  const [originCollectionBranchId, setOriginCollectionBranchId] = useState<string>(() => initialDraft?.originCollectionBranchId || '');
  const [destinationHubId, setDestinationHubId] = useState<string>(() => initialDraft?.destinationHubId || '');
  const [destinationAddress, setDestinationAddress] = useState<string>('');

  // Sender Civil Identity State
  const [senderFirstName, setSenderFirstName] = useState<string>(() => initialDraft?.senderFirstName || '');
  const [senderFatherName, setSenderFatherName] = useState<string>(() => initialDraft?.senderFatherName || '');
  const [senderLastName, setSenderLastName] = useState<string>(() => initialDraft?.senderLastName || '');
  const [senderMotherName, setSenderMotherName] = useState<string>(() => initialDraft?.senderMotherName || '');
  const [senderBirthDate, setSenderBirthDate] = useState<string>(() => initialDraft?.senderBirthDate || '');
  const [senderNationalId, setSenderNationalId] = useState<string>(() => initialDraft?.senderNationalId || '');
  const [senderIdType, setSenderIdType] = useState<string>(() => initialDraft?.senderIdType ? normalizeIdType(initialDraft.senderIdType) : (idDocumentTypes[0] || 'هوية سورية'));
  const [senderPhone, setSenderPhone] = useState<string>(() => initialDraft?.senderPhone || '');
  const [senderCity, setSenderCity] = useState<Governorate>(() => initialDraft?.senderCity || currentBranch.governorate);

  // Barcode Scanner input state & Honeywell Xenon 1900 Smart Decoder States
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerStatus, setScannerStatus] = useState<string | null>(null);
  const [scannerErrorAlert, setScannerErrorAlert] = useState<string | null>(null);
  const [isScannedIdLocked, setIsScannedIdLocked] = useState(false);
  const [isScannerFocused, setIsScannerFocused] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Web Audio Synthesizer for Honeywell Scanner Audio Feedback (Chime / Error Buzz)
  const playScannerAudio = (type: 'success' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.setValueAtTime(170, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch {
      // Audio context playback restrictions
    }
  };

  // Receiver State
  const [receiverName, setReceiverName] = useState<string>(() => initialDraft?.receiverName || '');
  const [receiverPhone, setReceiverPhone] = useState<string>(() => initialDraft?.receiverPhone || '');
  const [receiverCity, setReceiverCity] = useState<Governorate>(() => initialDraft?.receiverCity || 'حلب');
  const [isReceiverCustomerModalOpen, setIsReceiverCustomerModalOpen] = useState(false);
  const [selectedReceiverCustomer, setSelectedReceiverCustomer] = useState<Customer | null>(null);

  // Previous Receiver Auto-Fill & History Lookup
  const [isReceiverDropdownOpen, setIsReceiverDropdownOpen] = useState(false);
  const [autoFilledReceiverAlert, setAutoFilledReceiverAlert] = useState<{
    name: string;
    phone: string;
    city: string;
    count: number;
  } | null>(null);
  const receiverInputContainerRef = useRef<HTMLDivElement>(null);

  // Package Specs
  const [shippingCategory, setShippingCategory] = useState<ShippingCategory>(
    () => initialDraft?.shippingCategory || brandingSettings.defaultShippingCategory || 'postal'
  );
  const [packageType, setPackageType] = useState<PackageType>(() => initialDraft?.packageType || '');
  const [packageNotes, setPackageNotes] = useState<string>(() => initialDraft?.packageNotes || '');
  const [sizeTier, setSizeTier] = useState<ParcelSizeTier>(() => initialDraft?.sizeTier || 'medium');
  const [weightKg, setWeightKg] = useState<number>(() => initialDraft?.weightKg !== undefined ? initialDraft.weightKg : 0);
  const [lengthCm, setLengthCm] = useState<number>(() => initialDraft?.lengthCm !== undefined ? initialDraft.lengthCm : 30);
  const [widthCm, setWidthCm] = useState<number>(() => initialDraft?.widthCm !== undefined ? initialDraft.widthCm : 25);
  const [heightCm, setHeightCm] = useState<number>(() => initialDraft?.heightCm !== undefined ? initialDraft.heightCm : 20);
  const [piecesCount, setPiecesCount] = useState<number>(() => initialDraft?.piecesCount !== undefined ? initialDraft.piecesCount : 1);
  const [contentDescription, setContentDescription] = useState<string>(() => initialDraft?.contentDescription || '');
  const [specialInstructions, setSpecialInstructions] = useState<string>(() => initialDraft?.specialInstructions || '');

  // Validation state for required fields marked with red asterisks (*)
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});

  // Pricing Basis (Weight vs Volume vs Size Tier vs Auto)
  const [pricingBasis, setPricingBasis] = useState<PricingBasis>(() => initialDraft?.pricingBasis || 'auto');

  // Financials & Manual Pricing state
  const [currency, setCurrency] = useState<Currency>(() => initialDraft?.currency || 'SYP');
  const [codCurrency, setCodCurrency] = useState<Currency>(() => initialDraft?.codCurrency || 'SYP');
  const [paymentType, setPaymentType] = useState<PaymentType>(() => initialDraft?.paymentType || 'prepaid');
  const [manualShippingCost, setManualShippingCost] = useState<number>(() => initialDraft?.manualShippingCost !== undefined ? initialDraft.manualShippingCost : 0);
  const [manualShippingCostStr, setManualShippingCostStr] = useState<string>(() => initialDraft?.manualShippingCostStr || '');
  const [codAmount, setCodAmount] = useState<number>(() => initialDraft?.codAmount !== undefined ? initialDraft.codAmount : 0);
  // أجور الشحن في ضد الدفع مع حوالة: 'recipient' (تلقائي على المستلم) أو 'sender' (أجور الشحن على المرسل)
  const [codShippingPayer, setCodShippingPayer] = useState<'recipient' | 'sender'>(() => initialDraft?.codShippingPayer || 'recipient');

  // Transferred Amount (مبلغ محوّل - أجور موزع في الجهة المقابلة وتخصم من حصة الشركة في المقاصة)
  const [showTransferredAmount, setShowTransferredAmount] = useState<boolean>(() => Boolean(initialDraft?.showTransferredAmount));
  const [transferredAmount, setTransferredAmount] = useState<number>(() => initialDraft?.transferredAmount !== undefined ? initialDraft.transferredAmount : 0);
  const [transferredAmountReason, setTransferredAmountReason] = useState<string>(() => initialDraft?.transferredAmountReason || 'أجور الموزع في الجهة المقابلة');
  const [transferredAmountCurrency, setTransferredAmountCurrency] = useState<Currency>(() => initialDraft?.transferredAmountCurrency || 'SYP');

  // Automatically save form drafts (Debounced/Continuous) so browser reload never loses work-in-progress
  useEffect(() => {
    const hasAnyContent = Boolean(
      paperReceiptNumber ||
      senderFirstName ||
      senderLastName ||
      senderNationalId ||
      senderPhone ||
      receiverName ||
      receiverPhone ||
      destinationAddress ||
      contentDescription ||
      packageNotes ||
      (weightKg > 0) ||
      (codAmount > 0) ||
      (manualShippingCost > 0)
    );

    if (hasAnyContent) {
      formDraftStorage.saveDraft('parcel_intake', {
        paperReceiptNumber,
        originCollectionBranchId,
        destinationHubId,
        destinationAddress: '', // تفريغ حقل عنوان التسليم وعدم جلبه تلقائياً من إدخال سابق نهائياً
        senderFirstName,
        senderFatherName,
        senderLastName,
        senderMotherName,
        senderBirthDate,
        senderNationalId,
        senderIdType,
        senderPhone,
        senderCity,
        receiverName,
        receiverPhone,
        receiverCity,
        shippingCategory,
        packageType,
        packageNotes,
        sizeTier,
        weightKg,
        lengthCm,
        widthCm,
        heightCm,
        piecesCount,
        contentDescription,
        specialInstructions,
        pricingBasis,
        currency,
        codCurrency,
        paymentType,
        manualShippingCost,
        manualShippingCostStr,
        codAmount,
        codShippingPayer,
        showTransferredAmount,
        transferredAmount,
        transferredAmountReason,
        transferredAmountCurrency,
      });
    }
  }, [
    paperReceiptNumber,
    originCollectionBranchId,
    destinationHubId,
    destinationAddress,
    senderFirstName,
    senderFatherName,
    senderLastName,
    senderMotherName,
    senderBirthDate,
    senderNationalId,
    senderIdType,
    senderPhone,
    senderCity,
    receiverName,
    receiverPhone,
    receiverCity,
    shippingCategory,
    packageType,
    packageNotes,
    sizeTier,
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    piecesCount,
    contentDescription,
    specialInstructions,
    pricingBasis,
    currency,
    codCurrency,
    paymentType,
    manualShippingCost,
    manualShippingCostStr,
    codAmount,
    codShippingPayer,
    showTransferredAmount,
    transferredAmount,
    transferredAmountReason,
    transferredAmountCurrency,
  ]);

  // Modal alert for incomplete registration conditions
  const [showValidationModal, setShowValidationModal] = useState<boolean>(false);
  const [validationModalErrors, setValidationModalErrors] = useState<string[]>([]);
  const [firstInvalidFieldId, setFirstInvalidFieldId] = useState<string | null>(null);

  // Sync default shipping category if central branding changes
  useEffect(() => {
    if (brandingSettings.defaultShippingCategory) {
      setShippingCategory(brandingSettings.defaultShippingCategory);
    }
  }, [brandingSettings.defaultShippingCategory]);

  // Sync active packageType if packageTypes list updates (only in dropdown mode)
  useEffect(() => {
    if (brandingSettings.packageTypeMode !== 'directory_dropdown') return;
    if (packageTypes.length === 0) return;

    // ✅ إذا كان packageType فارغاً → اتركه فارغاً (اختيار المستخدم)
    if (!packageType || packageType.trim() === '') return;

    // ✅ إذا كان النوع المختار قد حُذف من الإعدادات → صفّره
    if (!packageTypes.includes(packageType)) {
      setPackageType('');
      setManualShippingCost(0);
      setManualShippingCostStr('');
      setFixedPriceAppliedNote(null);
    }
  }, [packageTypes, packageType, brandingSettings.packageTypeMode]);

  const [fixedPriceAppliedNote, setFixedPriceAppliedNote] = useState<string | null>(null);

  // Helper to get rate info for a package type
  const getPackageTypeRateInfo = (typeName: string) => {
    if (!typeName) return undefined;
    const rates = brandingSettings.packageTypeRates || {};
    const matchingKey = Object.keys(rates).find(
      (k) => k.trim().toLowerCase() === typeName.trim().toLowerCase()
    );
    return matchingKey ? rates[matchingKey] : undefined;
  };

  // Helper to compute minimum allowed price for a package type in current currency
  const getPackageTypeMinRate = (typeToCheck: string, targetCurrency: Currency): number | undefined => {
    const rateInfo = getPackageTypeRateInfo(typeToCheck);
    if (!rateInfo) return undefined;
    const exchangeRate = brandingSettings.exchangeRateUsdToSyp || 15000;

    const minSyp = rateInfo.minPriceSyp && rateInfo.minPriceSyp > 0 ? rateInfo.minPriceSyp : undefined;
    const minUsd = rateInfo.minPriceUsd && rateInfo.minPriceUsd > 0 ? rateInfo.minPriceUsd : undefined;

    if (targetCurrency === 'SYP') {
      if (minSyp !== undefined) return minSyp;
      if (minUsd !== undefined) return Math.round(minUsd * exchangeRate);
    } else if (targetCurrency === 'USD') {
      if (minUsd !== undefined) return minUsd;
      if (minSyp !== undefined) return Math.round((minSyp / exchangeRate) * 10) / 10;
    }
    return undefined;
  };

  const currentPackageTypeRateInfo = useMemo(() => {
    return getPackageTypeRateInfo(packageType);
  }, [packageType, brandingSettings.packageTypeRates]);

  const currentPackageTypeMinPrice = useMemo(() => {
    return getPackageTypeMinRate(packageType, currency);
  }, [packageType, currency, brandingSettings.packageTypeRates, brandingSettings.exchangeRateUsdToSyp]);

  // Helper to apply linked fixed price for package type based on target currency
  const applyPackageTypeRate = (
    typeToApply: string,
    targetCurrency: Currency,
    previousCurrency?: Currency
  ) => {
    const exchangeRate = brandingSettings.exchangeRateUsdToSyp || 15000;
    const isDraftEdit = Boolean(
      initialDraft?.packageType && initialDraft.packageType === typeToApply
    );

    let fixedPriceApplied = false;

    if (typeToApply) {
      // Case-insensitive and trimmed key lookup in packageTypeRates
      const rateInfo = getPackageTypeRateInfo(typeToApply);

      if (rateInfo) {
        const fixedSyp =
          rateInfo.fixedPriceSyp && rateInfo.fixedPriceSyp > 0
            ? rateInfo.fixedPriceSyp
            : undefined;
        const fixedUsd =
          rateInfo.fixedPriceUsd && rateInfo.fixedPriceUsd > 0
            ? rateInfo.fixedPriceUsd
            : undefined;

        let targetCost: number | undefined;

        if (targetCurrency === 'SYP') {
          if (fixedSyp !== undefined) {
            targetCost = fixedSyp;
          } else if (fixedUsd !== undefined) {
            targetCost = Math.round(fixedUsd * exchangeRate);
          }
        } else if (targetCurrency === 'USD') {
          if (fixedUsd !== undefined) {
            targetCost = fixedUsd;
          } else if (fixedSyp !== undefined) {
            targetCost = Math.round((fixedSyp / exchangeRate) * 10) / 10;
          }
        }

        if (targetCost !== undefined && targetCost > 0) {
          setManualShippingCost(targetCost);
          setManualShippingCostStr(String(targetCost));
          const minRate = getPackageTypeMinRate(typeToApply, targetCurrency);
          setFixedPriceAppliedNote(
            `✓ تم تطبيق الأجور المثبتة لنوع [${typeToApply}]: ${formatCurrency(
              targetCost,
              targetCurrency
            )}${
              minRate
                ? ` (الحد الأدنى للتعديل: ${formatCurrency(minRate, targetCurrency)})`
                : ''
            }`
          );
          setInvalidFields((prev) => ({ ...prev, shippingCost: false }));
          setValidationErrors((prev) =>
            prev.filter((err) => !err.includes('أجور الشحن'))
          );
          setTimeout(() => setFixedPriceAppliedNote(null), 3500);
          fixedPriceApplied = true;
        }
      }
    }

    // Currency conversion (only when currency changed)
    if (
      !fixedPriceApplied &&
      previousCurrency &&
      previousCurrency !== targetCurrency &&
      manualShippingCost &&
      manualShippingCost > 0
    ) {
      let convertedCost = manualShippingCost;
      if (targetCurrency === 'USD' && previousCurrency === 'SYP') {
        convertedCost = Math.round((manualShippingCost / exchangeRate) * 10) / 10;
      } else if (targetCurrency === 'SYP' && previousCurrency === 'USD') {
        convertedCost = Math.ceil((manualShippingCost * exchangeRate) / 500) * 500;
      }
      setManualShippingCost(convertedCost);
      setManualShippingCostStr(String(convertedCost));
      setFixedPriceAppliedNote(
        `✓ تم تحويل الأجور اليدوية تلقائياً إلى (${
          targetCurrency === 'SYP' ? 'ليرة سورية' : 'دولار أمريكي'
        }): ${formatCurrency(convertedCost, targetCurrency)}`
      );
      setTimeout(() => setFixedPriceAppliedNote(null), 3500);
      return;
    }

    // ✅ Reset: only when NEITHER fixed price applied NOR currency conversion happened
    if (!fixedPriceApplied && !previousCurrency) {
      // Type change without fixed price → clear the field
      if (!isDraftEdit) {
        setManualShippingCost(0);
        setManualShippingCostStr('');
        setFixedPriceAppliedNote(null);
      }
    }
  };

  // Apply linked fixed price for package type if configured in pricing engine
  const handleSelectPackageType = (newType: string) => {
    setPackageType(newType as PackageType);
    applyPackageTypeRate(newType, currency);
  };

  // Handle switching currency and re-applying package type fixed price if set
  const handleCurrencyChange = (newCurrency: Currency) => {
    const oldCurrency = currency;
    setCurrency(newCurrency);
    applyPackageTypeRate(packageType, newCurrency, oldCurrency);
  };

  // Live Auto Calculation
  const [calcResult, setCalcResult] = useState({
    shippingCost: 0,
    transferFee: 0,
    totalDue: 0,
    volumeCbm: 0,
    volumetricWeightKg: 0,
    effectiveWeightKg: 0,
    appliedBasis: 'weight' as 'weight' | 'volume' | 'size_tier',
    calculatedWeightCost: 0,
    calculatedVolumeCost: 0,
    calculatedSizeTierCost: 0,
    distanceKm: 0,
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Available sub-branches strictly under current main hub (filtered by parentHubId)
  const subBranches = useMemo(() => {
    const mainHubId = currentBranch.type === 'main_hub' ? currentBranch.id : currentBranch.parentHubId;
    if (!mainHubId) return [];
    return getSubBranchesForMainHub(branches, mainHubId);
  }, [branches, currentBranch]);

  // Available destination hubs (strictly excluding current branch and inactive branches)
  const destinationHubs = useMemo(() => {
    return branches.filter((b) => {
      // استبعاد الفرع الحالي
      if (b.id === currentBranch.id) return false;
      // استبعاد الفروع غير النشطة
      if (!b.isActive) return false;
      // الوجهة فقط مراكز رئيسية مؤهلة
      if (b.type !== 'main_hub' && !b.isMainHub) return false;
      return true;
    });
  }, [branches, currentBranch.id]);

  // Set default destination hub
  useEffect(() => {
    const validDest = destinationHubs.find((h) => h.id === destinationHubId);
    if (!validDest && destinationHubs.length > 0) {
      const defaultDest = destinationHubs[0];
      setDestinationHubId(defaultDest.id);
      setReceiverCity(defaultDest.governorate);
    }
  }, [destinationHubs, destinationHubId]);

  // Active pricing rule & limits derived from Pricing Engine
  const activePricingRule = useMemo(() => {
    const destHub = branches.find((b) => b.id === destinationHubId);
    const destGov = destHub ? destHub.governorate : receiverCity;
    return (
      pricingRules?.find(
        (r) =>
          (r.originGov === currentBranch.governorate || r.originGov === 'all') &&
          (r.destGov === destGov || r.destGov === 'all')
      ) || pricingRules?.[0]
    );
  }, [branches, destinationHubId, receiverCity, currentBranch.governorate, pricingRules]);

  // Minimum fee defined in pricing engine for this route (الحد الأدنى للأجور)
  const minShippingFeeFromEngine = useMemo(() => {
    if (!activePricingRule) return undefined;
    return currency === 'SYP' ? activePricingRule.minFeeSyp : activePricingRule.minFeeUsd;
  }, [activePricingRule, currency]);

  // Maximum allowed COD remittance defined in pricing engine (سقف الحوالة المسموح)
  const maxCodAllowedFromEngine = useMemo(() => {
    return codCurrency === 'SYP' ? codSettings?.maxCodAllowedSyp : codSettings?.maxCodAllowedUsd;
  }, [codSettings, codCurrency]);

  // Dynamic Price Engine Calculation whenever specs or basis change
  useEffect(() => {
    const destHub = branches.find((b) => b.id === destinationHubId);
    const destGov = destHub ? destHub.governorate : receiverCity;

    const res = calculatePrice(
      currentBranch.governorate,
      destGov,
      packageType,
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
      paymentType,
      currency,
      codAmount,
      pricingBasis,
      sizeTier,
      codCurrency
    );
    setCalcResult(res);
  }, [
    currentBranch.governorate,
    destinationHubId,
    receiverCity,
    packageType,
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    paymentType,
    currency,
    codAmount,
    pricingBasis,
    sizeTier,
    codCurrency,
    calculatePrice,
    branches,
  ]);

  // Previous Receivers Deduplicated Registry & Lookup
  const previousReceivers = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        phone: string;
        city: Governorate;
        address: string;
        destinationHubId?: string;
        shipmentCount: number;
        lastDate?: string;
        isCustomer?: boolean;
      }
    >();

    // 1. Primary Priority: All registered customers from the Unified Customers Directory
    customers.forEach((c) => {
      const cName = (c.fullName || `${c.firstName || ''} ${c.lastName || ''}`).trim();
      const cPhone = (c.phone || '').trim();
      if (!cName && !cPhone) return;

      const cleanPhone = cPhone.replace(/\D/g, '');
      const key = cleanPhone && cleanPhone.length >= 7 ? `phone_${cleanPhone}` : `name_${cName.toLowerCase()}`;

      map.set(key, {
        id: `rec_c_${c.id}`,
        name: cName,
        phone: cPhone,
        city: (c.city || 'حلب') as Governorate,
        address: c.address || '',
        destinationHubId: undefined,
        shipmentCount: c.totalShipmentsReceived || 0,
        lastDate: c.createdAt,
        isCustomer: true,
      });
    });

    // 2. Supplement from registered parcel history
    parcels.forEach((p) => {
      const rName = (p.receiver?.name || '').trim();
      const rPhone = (p.receiver?.phone || '').trim();
      if (!rName && !rPhone) return;

      const cleanPhone = rPhone.replace(/\D/g, '');
      const key = cleanPhone && cleanPhone.length >= 7 ? `phone_${cleanPhone}` : `name_${rName.toLowerCase()}`;

      const existing = map.get(key);
      if (existing) {
        existing.shipmentCount += 1;
        if (p.createdAt && (!existing.lastDate || new Date(p.createdAt) > new Date(existing.lastDate))) {
          existing.lastDate = p.createdAt;
          if (p.destinationHubId) existing.destinationHubId = p.destinationHubId;
        }
      } else {
        map.set(key, {
          id: `rec_p_${p.id}`,
          name: rName,
          phone: rPhone,
          city: (p.receiver?.city || 'حلب') as Governorate,
          address: p.receiver?.address || p.destinationAddress || '',
          destinationHubId: p.destinationHubId,
          shipmentCount: 1,
          lastDate: p.createdAt,
          isCustomer: false,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.shipmentCount - a.shipmentCount);
  }, [parcels, customers]);

  // Live filter matching receivers based directly on receiverName or receiverPhone
  const matchingReceivers = useMemo(() => {
    const q = receiverName.trim().toLowerCase();
    const cleanQ = q.replace(/\D/g, '');
    if (!q && !cleanQ) return previousReceivers.slice(0, 6);

    return previousReceivers
      .filter((r) => {
        const matchName = q && r.name.toLowerCase().includes(q);
        const matchPhone = cleanQ.length >= 3 && r.phone.replace(/\D/g, '').includes(cleanQ);
        const matchCity = q && r.city.toLowerCase().includes(q);
        return matchName || matchPhone || matchCity;
      })
      .slice(0, 8);
  }, [previousReceivers, receiverName]);

  // Check if current typed receiver already exists in the previous/customer registry
  const isExistingReceiver = useMemo(() => {
    if (!receiverName.trim()) return false;
    const cleanName = receiverName.trim().toLowerCase();
    const cleanPhone = receiverPhone.replace(/\D/g, '');
    return previousReceivers.some(
      (r) =>
        r.name.trim().toLowerCase() === cleanName ||
        (cleanPhone.length >= 7 && r.phone.replace(/\D/g, '') === cleanPhone)
    );
  }, [previousReceivers, receiverName, receiverPhone]);

  // Select customer directly from Unified Customer Directory as Receiver
  const selectCustomerAsReceiver = (c: Customer) => {
    const norm = normalizeCustomerNames({
      fullName: c.fullName,
      firstName: c.firstName,
      fatherName: c.fatherName,
      lastName: c.lastName,
    });
    const displayName = c.fullName || norm.fullName || [c.firstName, c.fatherName, c.lastName].filter(Boolean).join(' ');
    setReceiverName(displayName);
    if (c.phone) setReceiverPhone(c.phone);
    if (c.city) {
      setReceiverCity(c.city as Governorate);
      const matchingHub = destinationHubs.find((h) => h.governorate === c.city);
      if (matchingHub) {
        setDestinationHubId(matchingHub.id);
      }
    }
    if (c.address) {
      setDestinationAddress(c.address);
    }
    setSelectedReceiverCustomer(c);
    setAutoFilledReceiverAlert({
      name: displayName,
      phone: c.phone || '',
      city: c.city || 'حلب',
      count: c.totalShipmentsReceived || 1,
    });
    setIsReceiverDropdownOpen(false);
    setIsReceiverCustomerModalOpen(false);
  };

  // Apply previous receiver info automatically
  const selectPreviousReceiver = (r: {
    name: string;
    phone: string;
    city: Governorate;
    address: string;
    destinationHubId?: string;
    shipmentCount: number;
    isCustomer?: boolean;
  }) => {
    setReceiverName(r.name);
    setReceiverPhone(r.phone);
    if (r.city) {
      setReceiverCity(r.city);
      const matchingHub =
        destinationHubs.find((h) => h.id === r.destinationHubId) ||
        destinationHubs.find((h) => h.governorate === r.city);
      if (matchingHub) {
        setDestinationHubId(matchingHub.id);
      }
    }
    // Search if this receiver is in customers directory
    const cleanPhone = (r.phone || '').replace(/\D/g, '');
    const matchedCust = customers.find((c) => {
      const cPhone = (c.phone || '').replace(/\D/g, '');
      const cSec = (c.secondaryPhone || '').replace(/\D/g, '');
      if (cleanPhone.length >= 7 && (cPhone === cleanPhone || cSec === cleanPhone)) return true;
      if (c.fullName && c.fullName.trim().toLowerCase() === r.name.trim().toLowerCase()) return true;
      return false;
    });
    if (matchedCust) {
      setSelectedReceiverCustomer(matchedCust);
      if (matchedCust.address) setDestinationAddress(matchedCust.address);
    } else {
      setSelectedReceiverCustomer(null);
      setDestinationAddress('');
    }

    setAutoFilledReceiverAlert({
      name: r.name,
      phone: r.phone,
      city: r.city,
      count: r.shipmentCount,
    });
    setIsReceiverDropdownOpen(false);
  };

  // Customer Auto-Fill & Lookup logic
  // تفريغ الحقول وإعادة تعبئتها ببيانات العميل المختار مع بقائها قابلة للتعديل بحرية وبدون قفل
  const applyCustomerData = (c: Customer) => {
    // 1. استخلاص الأسماء والمكونات بدقة تامة مع إعطاء الأولوية للحقول الفردية المخزنة
    const norm = normalizeCustomerNames({
      fullName: c.fullName,
      firstName: c.firstName,
      fatherName: c.fatherName,
      lastName: c.lastName,
    });

    const fName = (c.firstName?.trim() || norm.firstName || '').trim();
    const father = (c.fatherName?.trim() || norm.fatherName || '').trim();
    const lName = (c.lastName?.trim() || norm.lastName || '').trim();
    const mName = (c.motherName?.trim() || '').trim();
    const bDate = normalizeBirthDateToISO(c.birthDate?.trim() || '');
    const nId = (c.nationalId?.trim() || '').trim();
    const idType = normalizeIdType(c.idType);
    const phone = (c.phone?.trim() || '').trim();
    const city = (c.city || currentBranch.governorate) as Governorate;
    const photoFront = c.idPhotoFront || '';
    const photoBack = c.idPhotoBack || '';

    // 2. تعيين كامل بيانات العميل الموثقة في حقول واجهة تسجيل الطرد
    setSenderFirstName(fName);
    setSenderFatherName(father);
    setSenderLastName(lName);
    setSenderMotherName(mName);
    setSenderBirthDate(bDate);
    setSenderNationalId(nId);
    setSenderIdType(idType);
    setSenderPhone(phone);
    setSenderCity(city);
    setSenderIdPhotoFront(photoFront);
    setSenderIdPhotoBack(photoBack);

    // 3. تعيين العميل المختار مع بقاء الحقول قابلة للتعديل والإكمال بحرية
    setSelectedCustomer(c);

    const displayFullName = c.fullName || norm.fullName || [fName, father, lName].filter(Boolean).join(' ');
    setQuickCustomerQuery(displayFullName);
    setIsQuickCustomerDropdownOpen(false);

    setIdCustomerStatus({
      type: 'existing',
      customer: c,
      message: 'موجود سابقاً',
    });

    setExistingCustomerAlert(null);

    // إزالة مؤشرات الأخطاء إن وجدت لحقول المرسل وصورة الهوية
    setInvalidFields((prev) => ({
      ...prev,
      senderFirstName: false,
      senderFatherName: false,
      senderLastName: false,
      senderMotherName: false,
      senderBirthDate: false,
      senderNationalId: false,
      senderPhone: false,
      senderIdPhoto: false,
    }));
  };

  // تفريغ يدوي مخصص لحقول المرسل عند الرغبة في إدخال مرسل جديد أو إعادة ضبط الحقول
  const handleClearSenderFields = () => {
    setSelectedCustomer(null);
    setIsScannedIdLocked(false);
    setScannerErrorAlert(null);
    setSenderFirstName('');
    setSenderFatherName('');
    setSenderLastName('');
    setSenderMotherName('');
    setSenderBirthDate('');
    setSenderNationalId('');
    setSenderIdType(idDocumentTypes[0] || 'هوية سورية');
    setSenderPhone('');
    setSenderCity(currentBranch.governorate);
    setSenderIdPhotoFront('');
    setSenderIdPhotoBack('');
    setQuickCustomerQuery('');
    setIdCustomerStatus(null);
    setExistingCustomerAlert(null);
    setInvalidFields((prev) => ({
      ...prev,
      senderFirstName: false,
      senderFatherName: false,
      senderLastName: false,
      senderMotherName: false,
      senderBirthDate: false,
      senderNationalId: false,
      senderPhone: false,
      senderIdPhoto: false,
    }));
  };

  const checkExistingCustomer = (idOrPhone: string, explicitFullName?: string) => {
    if (!idOrPhone && !explicitFullName) return;
    const clean = idOrPhone ? idOrPhone.replace(/\D/g, '') : '';
    const cleanPhone = senderPhone ? senderPhone.replace(/\D/g, '') : '';

    const match = customers.find((c) => {
      if (clean.length >= 7 && c.nationalId) {
        const cNid = c.nationalId.replace(/\D/g, '');
        if (cNid === clean || (cNid.length >= 9 && clean.length >= 9 && cNid === clean)) return true;
      }
      if (cleanPhone.length >= 7) {
        const cPhone = (c.phone || '').replace(/\D/g, '');
        const cSecPhone = (c.secondaryPhone || '').replace(/\D/g, '');
        if (cPhone && (cPhone === cleanPhone || cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone))) return true;
        if (cSecPhone && (cSecPhone === cleanPhone || cSecPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cSecPhone))) return true;
      }
      if (explicitFullName && explicitFullName.trim().length >= 3) {
        const ef = explicitFullName.trim().toLowerCase();
        if (c.fullName && c.fullName.trim().toLowerCase() === ef) return true;
      }
      return false;
    });

    if (match) {
      applyCustomerData(match);
    } else {
      const nameCandidate = explicitFullName || getFullSenderName();
      if (nameCandidate && nameCandidate.trim()) {
        setQuickCustomerQuery(nameCandidate.trim());
        setIdCustomerStatus({
          type: 'new',
          scannedName: nameCandidate.trim(),
          message: 'عميل جديد (غير مسجل)',
        });
      }
    }
  };

  // Quick Action to Add Scanned / Filled Customer to Directory
  const handleQuickAddNewCustomer = () => {
    const fullNameToUse =
      quickCustomerQuery.trim() ||
      getFullSenderName() ||
      (idCustomerStatus?.scannedName || '').trim();

    if (!fullNameToUse && !senderFirstName.trim() && !senderPhone.trim()) {
      alert('يرجى التأكد من كتابة اسم العميل أو رقم هاتفه أولاً');
      return;
    }

    // Normalizing name components to prevent fatherName & lastName collision
    const norm = normalizeCustomerNames({
      fullName: fullNameToUse || [senderFirstName.trim(), senderFatherName.trim(), senderLastName.trim()].filter(Boolean).join(' '),
      firstName: senderFirstName.trim(),
      fatherName: senderFatherName.trim(),
      lastName: senderLastName.trim(),
    });

    const newCustomer = addCustomer({
      fullName: norm.fullName,
      firstName: norm.firstName || senderFirstName.trim(),
      fatherName: norm.fatherName || senderFatherName.trim(),
      lastName: norm.lastName || senderLastName.trim(),
      motherName: senderMotherName.trim(),
      birthDate: senderBirthDate.trim(),
      nationalId: senderNationalId.trim(),
      idType: senderIdType,
      phone: senderPhone.trim(),
      city: senderCity || currentBranch.governorate,
      address: `مدينة ${senderCity || currentBranch.governorate}`,
      customerType: 'individual',
      idPhotoFront: senderIdPhotoFront || undefined,
      idPhotoBack: senderIdPhotoBack || undefined,
      notes: 'تمت إضافته كعميل جديد عبر شاشة استلام الطرود',
    });

    applyCustomerData(newCustomer);
    setScannerStatus(`✓ تم تسجيل العميل [${norm.fullName}] بنجاح في دليل العملاء!`);
  };

  // Handler for parsing National ID Barcode Scanner data (Honeywell Xenon 1900 / PDF417 / MRZ / Custom 2D)
  // يقوم بتنظيف وتنسيق بيانات القارئ والتحقق من صحة الرقم الوطني وتاريخ الميلاد بـ Regex وإعادة ترتيب الحقول
  const parseBarcodeData = (rawText: string) => {
    try {
      if (!rawText || rawText.trim().length < 2) return;

      // 1. استخدام منطق المعالجة والتنظيف وإعادة الترتيب التلقائي للهوية السورية
      const processed: SyrianIdScannerResult = processSyrianIdScannerPayload(rawText);
      const cleanNid = processed.nationalId || '';
      const bDate = processed.birthDate || '';

      // إزالة أي تنبيهات خطأ سابقة
      setScannerErrorAlert(null);

      // 2. التحقق من وجود الرقم الوطني في سجل العملاء المسجلين مسبقاً لجلب وتعبئة البيانات الموثقة
      const cleanDigits = cleanNid.replace(/\D/g, '');
      const existingCust = cleanDigits.length >= 9
        ? customers.find((c) => c.nationalId && c.nationalId.replace(/\D/g, '') === cleanDigits)
        : null;

      // 3. استنتاج المحافظة والقيد السوري من كود الرقم الوطني أو البيانات المقروءة
      const smartProfile = resolveSmartSyrianCivilProfile(cleanNid, bDate);

      const finalFirstName = existingCust?.firstName || processed.firstName || '';
      const finalFatherName = existingCust?.fatherName || processed.fatherName || '';
      const finalLastName = existingCust?.lastName || processed.lastName || '';
      const finalMotherName = existingCust?.motherName || processed.motherName || '';
      const finalBirthDate = normalizeBirthDateToISO(existingCust?.birthDate || bDate || smartProfile.birthDate || '');
      const finalCity = ((existingCust?.city || processed.city || smartProfile.city || senderCity) as Governorate) || currentBranch.governorate;

      // 4. في حال كان العميل جديداً وتم التعرف على اسمه بالكامل، إضافته تلقائياً لدليل العملاء
      if (!existingCust && (finalFirstName && finalLastName)) {
        const newCustName = [finalFirstName, finalFatherName, finalLastName].filter(Boolean).join(' ');
        if (newCustName) {
          addCustomer({
            fullName: newCustName,
            firstName: finalFirstName,
            fatherName: finalFatherName,
            lastName: finalLastName,
            motherName: finalMotherName,
            birthDate: finalBirthDate,
            nationalId: cleanNid,
            idType: senderIdType as IdDocumentType,
            phone: senderPhone || '',
            city: finalCity,
            address: `مدينة ${finalCity}`,
            customerType: 'individual',
            notes: 'تمت إضافته وحفظه تلقائياً من قارئ الباركود للهوية الرقمية',
          });
        }
      }

      // 5. تطبيق كافة الحقول المدققة والمرتبة على واجهة الاستلام
      if (cleanNid) setSenderNationalId(cleanNid);
      if (finalFirstName) setSenderFirstName(finalFirstName);
      if (finalFatherName) setSenderFatherName(finalFatherName);
      if (finalLastName) setSenderLastName(finalLastName);
      if (finalMotherName) setSenderMotherName(finalMotherName);
      if (finalBirthDate) setSenderBirthDate(finalBirthDate);
      if (finalCity) setSenderCity(finalCity);
      if (existingCust?.phone && !senderPhone) setSenderPhone(existingCust.phone);
      if (existingCust?.idPhotoFront) setSenderIdPhotoFront(existingCust.idPhotoFront);
      if (existingCust?.idPhotoBack) setSenderIdPhotoBack(existingCust.idPhotoBack);
      if (existingCust) setSelectedCustomer(existingCust);

      const fullCandidate = existingCust?.fullName || [finalFirstName, finalFatherName, finalLastName].filter(Boolean).join(' ');
      
      if (existingCust && fullCandidate) {
        setQuickCustomerQuery(fullCandidate);
        setIdCustomerStatus({
          type: 'existing',
          customer: existingCust,
          scannedName: fullCandidate,
          message: 'عميل مسجل سابقاً ومطابق للهوية',
        });
        setIsScannedIdLocked(true);
      } else if (finalFirstName && finalLastName) {
        setQuickCustomerQuery(fullCandidate);
        setIdCustomerStatus({
          type: 'new',
          scannedName: fullCandidate,
          message: processed.isReordered ? 'تم استخراج وترتيب بيانات الهوية بنجاح' : 'موثق من الهوية الرقمية',
        });
        setIsScannedIdLocked(true);
      } else {
        setQuickCustomerQuery('');
        setIdCustomerStatus(null);
        setIsScannedIdLocked(false);
      }

      // 6. إزالة مؤشرات الأخطاء للحقول التي تم ملؤها بنجاح
      setInvalidFields((prev) => ({
        ...prev,
        ...(finalFirstName ? { senderFirstName: false } : {}),
        ...(finalFatherName ? { senderFatherName: false } : {}),
        ...(finalLastName ? { senderLastName: false } : {}),
        ...(finalMotherName ? { senderMotherName: false } : {}),
        ...(finalBirthDate ? { senderBirthDate: false } : {}),
        ...(cleanNid ? { senderNationalId: false } : {}),
        ...(existingCust?.idPhotoFront || existingCust?.idPhotoBack ? { senderIdPhoto: false } : {}),
      }));

      // تشغيل إشعار صوتي بالنجاح
      playScannerAudio('success');

      // 7. صياغة رسالة الحالة الذكية للمستخدم
      const dmyDate = formatDateToDMY(finalBirthDate);
      let statusMsg = '';
      if (cleanNid && fullCandidate) {
        statusMsg = `✓ تم مسح وقراءة بيانات الهوية [الرقم الوطني: ${cleanNid} - ${fullCandidate} (مواليد: ${dmyDate})] بنجاح`;
      } else if (cleanNid && dmyDate) {
        statusMsg = `✓ تم التحقق من الرقم الوطني [${cleanNid}] والمواليد [${dmyDate}] بدقة عبر Regex - يرجى إدخال اسم المواطن من البطاقة`;
      } else if (cleanNid) {
        statusMsg = `✓ تم التحقق من صحة الرقم الوطني [${cleanNid}] بنجاح`;
      } else {
        statusMsg = `✓ تم استقبال مسح الباركود ومعالجة البيانات بنجاح`;
      }

      if (processed.isReordered) {
        statusMsg += ' (تمت إعادة ترتيب الحقول وفق النمط السوري المعتاد)';
      }

      setScannerStatus(statusMsg);

      // تفريغ حقل إدخال الباركود ليكون جاهزاً للمسح التالي
      setBarcodeInput('');

      // 8. التركيز التلقائي الذكي على الحقل التالي المطلوب
      setTimeout(() => {
        if (!finalFirstName) {
          const nameEl = document.getElementById('input_sender_first_name');
          if (nameEl) nameEl.focus();
        } else if (!senderPhone) {
          const phoneEl = document.getElementById('input_sender_phone');
          if (phoneEl) phoneEl.focus();
        }
      }, 80);
    } catch (err) {
      console.error('Error parsing barcode input safely:', err);
      playScannerAudio('error');
      setScannerErrorAlert('حدث خطأ أثناء معالجة بيانات القارئ. تم الحفاظ على استقرار التطبيق دون توقف.');
      setBarcodeInput('');
    }
  };

  // Global scanner listener hook: Captures hardware scanner keypress streams anywhere in the view
  useBarcodeDecoder({
    onScan: (decodedData) => {
      if (decodedData && decodedData.raw) {
        parseBarcodeData(decodedData.raw);
      }
    },
    enabled: true
  });

  const getFullSenderName = () => {
    const parts = [senderFirstName, senderFatherName, senderLastName].filter(Boolean);
    return parts.join(' ');
  };

  // التحقق الشامل من كافة الشروط الأساسية لتسجيل وحفظ البوليصة عبر الموديول المشترك
  const validateForm = (): { valid: boolean; errors: string[]; firstErrorRefId: string | null } => {
    const activeShippingCost = isManualPricing ? (Number(manualShippingCost) || 0) : calcResult.shippingCost;
    const result = validateParcelForm({
      packageType,
      senderFirstName,
      senderFatherName,
      senderLastName,
      senderMotherName,
      senderBirthDate,
      senderNationalId,
      senderPhone,
      senderIdPhotoFront,
      senderIdPhotoBack,
      receiverName,
      receiverPhone,
      destinationHubId,
      originHubId: currentBranch.id,
      destinationAddress,
      activeShippingCost,
      currentPackageTypeMinPrice,
      weightKg,
      packageNotes,
      contentDescription,
      paymentType,
      codAmount: Number(codAmount) || 0,
      codCurrency,
      currency,
      maxCodAllowedFromEngine,
      isManualPricing,
    });

    setInvalidFields(result.badFields);
    setValidationErrors(result.errors);

    return {
      valid: result.valid,
      errors: result.errors,
      firstErrorRefId: result.firstErrorRefId,
    };
  };

  // تفريغ حقول النموذج بالكامل ومسح الملاحظات والوزن وإعادة التعيين للوضع الافتراضي
  const handleResetForm = () => {
    setSelectedCustomer(null);
    setSelectedReceiverCustomer(null);
    setExistingCustomerAlert(null);
    setPaperReceiptNumber('');
    setSenderFirstName('');
    setSenderFatherName('');
    setSenderLastName('');
    setSenderMotherName('');
    setSenderBirthDate('');
    setSenderNationalId('');
    setSenderIdType(idDocumentTypes[0] || 'هوية سورية');
    setSenderPhone('');
    setSenderCity(currentBranch.governorate);
    setSenderIdPhotoFront('');
    setSenderIdPhotoBack('');
    setBarcodeInput('');
    setScannerStatus(null);
    setReceiverName('');
    setReceiverPhone('');
    setDestinationAddress('');
    setAutoFilledReceiverAlert(null);
    setPackageType('');
    setPackageNotes('');
    setContentDescription('');
    setSpecialInstructions('');
    setWeightKg(0);
    setLengthCm(30);
    setWidthCm(25);
    setHeightCm(20);
    setPiecesCount(1);
    setManualShippingCost(0);
    setManualShippingCostStr('');
    setCodAmount(0);
    setPaymentType('prepaid');
    setCodShippingPayer('recipient');
    setQuickCustomerQuery('');
    setIdCustomerStatus(null);
    setShowTransferredAmount(false);
    setTransferredAmount(0);
    setTransferredAmountReason('أجور الموزع في الجهة المقابلة');
    setValidationErrors([]);
    setInvalidFields({});
    formDraftStorage.clearDraft('parcel_intake');
    setDraftRestoredAlert(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. تأكيد شروط الحفظ ومنع الحفظ إذا كانت الحقول الإلزامية غير مكتملة
    const validation = validateForm();
    if (!validation.valid) {
      setValidationModalErrors(validation.errors);
      setFirstInvalidFieldId(validation.firstErrorRefId);
      setShowValidationModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      // 2. التحقق الصارم من اتصال السيرفر المركزي لمنع الحفظ المحلي المنفصل وحماية البيانات
      const isOnline = await ensureServerConnected();
      if (!isOnline) {
        // الحفاظ الكامل على النموذج والمسودة الحالية دون أي مسح
        return;
      }

      const fullSenderName = getFullSenderName();

      const activeShippingCost = isManualPricing ? (Number(manualShippingCost) || 0) : calcResult.shippingCost;
      const finSummary = computeParcelFinancialSummary({
        paymentType,
        currency,
        codCurrency,
        shippingCost: activeShippingCost,
        codAmount,
        codShippingPayer,
        calculateTransferFee: (amt, curr) => calculateCodTransferFee(amt, curr),
      });

      const finalShippingCost = finSummary.shippingCost;
      const finalTransferFee = finSummary.transferFee;
      const finalTotalDue = finSummary.totalDueFromReceiver;

      const parsedWeightMatch = packageNotes.match(/(\d+(?:\.\d+)?)/);
      const derivedWeight = parsedWeightMatch ? parseFloat(parsedWeightMatch[1]) : (Number(weightKg) > 0 ? Number(weightKg) : 1);

      let frontKey = senderIdPhotoFront;
      let backKey = senderIdPhotoBack;

      const tempKeyId = `pcl_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
      if (senderIdPhotoFront && senderIdPhotoFront.startsWith('data:image/')) {
        frontKey = `sender_${senderNationalId || tempKeyId}_id_front`;
        await setPhoto(frontKey, senderIdPhotoFront);
      }
      if (senderIdPhotoBack && senderIdPhotoBack.startsWith('data:image/')) {
        backKey = `sender_${senderNationalId || tempKeyId}_id_back`;
        await setPhoto(backKey, senderIdPhotoBack);
      }

      const newParcel = registerParcel({
        paperReceiptNumber: paperReceiptNumber.trim() || '',
        originHubId: currentBranch.id,
        originCollectionBranchId: originCollectionBranchId || undefined,
        destinationHubId: destinationHubId || destinationHubs[0]?.id || currentBranch.id || '',
        destinationAddress: destinationAddress.trim(),
        sender: {
          name: fullSenderName,
          firstName: senderFirstName.trim(),
          fatherName: senderFatherName.trim(),
          lastName: senderLastName.trim(),
          motherName: senderMotherName.trim(),
          birthDate: senderBirthDate.trim(),
          nationalId: senderNationalId.trim(),
          idType: senderIdType,
          phone: senderPhone.trim(),
          city: senderCity,
          address: `مدينة ${senderCity}`,
          idPhotoFront: frontKey || undefined,
          idPhotoBack: backKey || undefined,
          customerId: selectedCustomer?.id,
        },
        receiver: {
          name: receiverName.trim(),
          phone: receiverPhone.trim(),
          city: receiverCity,
          address: destinationAddress.trim(),
          customerId: selectedReceiverCustomer?.id,
          nationalId: selectedReceiverCustomer?.nationalId || undefined,
          idType: selectedReceiverCustomer?.idType || undefined,
          birthDate: selectedReceiverCustomer?.birthDate || undefined,
          firstName: selectedReceiverCustomer?.firstName || undefined,
          fatherName: selectedReceiverCustomer?.fatherName || undefined,
          lastName: selectedReceiverCustomer?.lastName || undefined,
          motherName: selectedReceiverCustomer?.motherName || (selectedReceiverCustomer as any)?.idMotherName || undefined,
          idFatherName: selectedReceiverCustomer?.fatherName || undefined,
          idMotherName: selectedReceiverCustomer?.motherName || (selectedReceiverCustomer as any)?.idMotherName || undefined,
          idBirthPlace: selectedReceiverCustomer?.birthPlace || (selectedReceiverCustomer?.city ? `محافظة ${selectedReceiverCustomer.city}` : undefined),
          idCivilRecord: selectedReceiverCustomer?.civilRegistry || selectedReceiverCustomer?.address || undefined,
          idPhotoFront: selectedReceiverCustomer?.idPhotoFront || undefined,
          idPhotoBack: selectedReceiverCustomer?.idPhotoBack || undefined,
        },
        shippingCategory,
        packageType,
        packageNotes: packageNotes.trim() || undefined,
        weightKg: derivedWeight,
        dimensions: { lengthCm, widthCm, heightCm },
        volumeCbm: isManualPricing ? (lengthCm * widthCm * heightCm) / 1000000 : calcResult.volumeCbm,
        piecesCount,
        contentDescription: contentDescription || (shippingCategory === 'postal' ? 'مستندات ووثائق بريدية' : 'بضائع عامة مشحونة'),
        specialInstructions: packageNotes ? `ملاحظة الوزن والنوع: ${packageNotes}${specialInstructions ? ` | ${specialInstructions}` : ''}` : specialInstructions,
        pricingBasis: isManualPricing ? 'auto' : pricingBasis,
        appliedBasis: isManualPricing ? 'weight' : calcResult.appliedBasis,
        paymentType,
        codShippingPayer: paymentType === 'cod' ? codShippingPayer : undefined,
        currency,
        shippingCurrency: currency,
        codCurrency: paymentType === 'cod' ? codCurrency : undefined,
        transferFeeCurrency: paymentType === 'cod' ? codCurrency : undefined,
        shippingCost: finalShippingCost,
        codAmount: paymentType === 'cod' ? codAmount : 0,
        transferFee: finalTransferFee,
        totalDue: finalTotalDue,
        transferredAmount: showTransferredAmount && Number(transferredAmount) > 0 ? Number(transferredAmount) : undefined,
        transferredAmountReason: showTransferredAmount && Number(transferredAmount) > 0 ? (transferredAmountReason.trim() || 'أجور الموزع في الجهة المقابلة') : undefined,
        transferredAmountCurrency: showTransferredAmount && Number(transferredAmount) > 0 ? (transferredAmountCurrency || currency) : undefined,
        createdById: currentUser.id,
        storageGraceDays: 3,
        notificationDueHours: 24,
      });

      setSuccessMessage(`تم تسجيل الشحنة بنجاح برقم تتبع: ${newParcel.trackingNumber}`);

      // Automatically open the 3-part A4 print modal!
      openPrintModal('parcel_3part', newParcel);

      // Reset Form for next parcel intake (تفريغ جميع الحقول والملاحظات والوزن)
      handleResetForm();
    } catch (err: any) {
      console.error('Error submitting parcel intake:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview the 3-part consignment note before final submission
  const handlePreviewConsignment = () => {
    const validation = validateForm();
    if (!validation.valid) {
      if (validation.firstErrorRefId) {
        const el = document.getElementById(validation.firstErrorRefId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }
      alert(`⚠️ تنبيه شروط المعاينة:\nيرجى استكمال البيانات الإلزامية المعلمة بالإشارة الحمراء (*):\n\n• ${validation.errors.join('\n• ')}`);
      return;
    }

    const fullSenderName = getFullSenderName() || 'اسم المرسل (معاينة)';
    const activePreviewShippingCost = isManualPricing ? (Number(manualShippingCost) || 0) : calcResult.shippingCost;
    const previewFinSummary = computeParcelFinancialSummary({
      paymentType,
      currency,
      codCurrency,
      shippingCost: activePreviewShippingCost,
      codAmount,
      codShippingPayer,
      calculateTransferFee: (amt, curr) => calculateCodTransferFee(amt, curr),
    });

    const finalShippingCost = previewFinSummary.shippingCost;
    const finalTransferFee = previewFinSummary.transferFee;
    const finalTotalDue = previewFinSummary.totalDueFromReceiver;

    const parsedPreviewWeightMatch = packageNotes.match(/(\d+(?:\.\d+)?)/);
    const derivedPreviewWeight = parsedPreviewWeightMatch ? parseFloat(parsedPreviewWeightMatch[1]) : (Number(weightKg) > 0 ? Number(weightKg) : 1);

    const previewParcel: Parcel = {
      id: `preview_${Date.now()}`,
      trackingNumber: `ORK-${new Date().getFullYear()}-8888`,
      paperReceiptNumber: paperReceiptNumber.trim() || '',
      originHubId: currentBranch.id,
      originCollectionBranchId: originCollectionBranchId || undefined,
      destinationHubId: destinationHubId || destinationHubs[0]?.id || currentBranch.id,
      destinationAddress: destinationAddress.trim() || `مدينة ${receiverCity} - استلام من المركز`,
      sender: {
        name: fullSenderName,
        firstName: senderFirstName,
        fatherName: senderFatherName,
        lastName: senderLastName,
        motherName: senderMotherName,
        birthDate: senderBirthDate,
        nationalId: senderNationalId || '04000000000',
        idType: senderIdType,
        phone: senderPhone || '09xxxxxxxx',
        city: senderCity,
      },
      receiver: {
        name: receiverName.trim() || 'اسم المستلم (معاينة)',
        phone: receiverPhone.trim() || '09xxxxxxxx',
        city: receiverCity,
        address: destinationAddress.trim() || `مدينة ${receiverCity}`,
      },
      shippingCategory,
      packageType,
      packageNotes: packageNotes.trim() || undefined,
      weightKg: derivedPreviewWeight,
      dimensions: { lengthCm, widthCm, heightCm },
      volumeCbm: isManualPricing ? (lengthCm * widthCm * heightCm) / 1000000 : calcResult.volumeCbm,
      piecesCount,
      contentDescription: contentDescription.trim() || (shippingCategory === 'postal' ? 'مستندات ووثائق بريدية' : 'بضائع عامة مشحونة'),
      specialInstructions: packageNotes ? `ملاحظة الوزن والنوع: ${packageNotes}${specialInstructions ? ` | ${specialInstructions}` : ''}` : specialInstructions,
      pricingBasis: isManualPricing ? 'auto' : pricingBasis,
      appliedBasis: isManualPricing ? 'weight' : calcResult.appliedBasis,
      paymentType,
      currency,
      shippingCurrency: currency,
      codCurrency: paymentType === 'cod' ? codCurrency : undefined,
      transferFeeCurrency: paymentType === 'cod' ? codCurrency : undefined,
      shippingCost: finalShippingCost,
      codAmount: paymentType === 'cod' ? codAmount : 0,
      transferFee: finalTransferFee,
      totalDue: finalTotalDue,
      transferredAmount: showTransferredAmount && Number(transferredAmount) > 0 ? Number(transferredAmount) : undefined,
      transferredAmountReason: showTransferredAmount && Number(transferredAmount) > 0 ? (transferredAmountReason.trim() || 'أجور الموزع في الجهة المقابلة') : undefined,
      transferredAmountCurrency: showTransferredAmount && Number(transferredAmount) > 0 ? (transferredAmountCurrency || currency) : undefined,
      createdById: currentUser.name || currentUser.id,
      createdAt: new Date().toISOString(),
      handlingStatus: 'received_at_hub',
      storageGraceDays: 3,
      notificationDueHours: 24,
    };

    openPrintModal('parcel_3part', previewParcel);
  };

  // Filtered recent parcels for table
  const recentParcels = parcels.filter(
    (p) =>
      (p.originHubId === currentBranch.id ||
        p.originBranchId === currentBranch.id ||
        p.originCollectionBranchId === currentBranch.id) &&
      (p.trackingNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.paperReceiptNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.sender.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.receiver.name.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="space-y-4 pb-20 text-slate-100">
      {draftRestoredAlert && (
        <div className="bg-amber-950/70 border border-amber-500/60 p-3 rounded-xl flex items-center justify-between text-amber-200 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>تم استرجاع مسودة الشحنة غير المكتملة تلقائياً للحفاظ على عملك ومنع فقدان البيانات أثناء التحديث والمزامنة.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="text-[11px] bg-amber-900/60 hover:bg-amber-800 text-amber-200 px-2.5 py-1 rounded-lg border border-amber-600/50 cursor-pointer"
            >
              مسح المسودة والبدء من جديد
            </button>
            <button
              type="button"
              onClick={() => setDraftRestoredAlert(false)}
              className="text-slate-400 hover:text-white px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-950/60 border border-emerald-500/50 p-3 rounded-xl flex items-center justify-between text-emerald-200 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Form Layout */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Source, Receipt & Extended Sender Civil Data */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                <FileText className="w-4 h-4" />
                <span>1. بيانات الإيصال الورقي والهوية المدنية للمرسل</span>
              </div>
              <button
                type="button"
                onClick={handleResetForm}
                className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition py-0.5 px-2 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700"
                title="تفريغ جميع الحقول والملاحظات والوزن"
              >
                <RotateCcw className="w-3 h-3" />
                <span>تفريغ الحقول</span>
              </button>
            </div>

            {/* Read-Only Origin Center (مركز الانطلاق محدد تلقائياً حسب فرع المستخدم للقراءة فقط) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                مركز الانطلاق (فرع الاستلام الحالي) <span className="text-cyan-400 font-normal">(محدد تلقائياً - للقراءة فقط)</span>
              </label>
              <div className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-cyan-300 flex items-center justify-between font-medium select-none shadow-inner">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  {currentBranch.name} ({currentBranch.governorate})
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  {currentBranch.code}
                </span>
              </div>
            </div>

            {/* Combined row: Sub-branch selection + Paper Receipt number on a single line */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Collection Branch Origin */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  الفرع التابع <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
                </label>
                {currentBranch.type === 'main_hub' ? (
                  <select
                    value={originCollectionBranchId}
                    onChange={(e) => setOriginCollectionBranchId(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">مباشر - ({currentBranch.name})</option>
                    {subBranches.map((sb) => (
                      <option key={sb.id} value={sb.id}>
                        {sb.name} ({sb.governorate}) — فرعي
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-cyan-300 font-medium truncate">
                    {currentBranch.name}
                  </div>
                )}
              </div>

              {/* Paper Receipt number from sub-branch */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  رقم الإيصال الورقي
                </label>
                <input
                  type="text"
                  value={paperReceiptNumber}
                  onChange={(e) => setPaperReceiptNumber(e.target.value)}
                  placeholder="مثال: RC-MZZ-4491"
                  className="w-full bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Barcode Scanner Box for National ID */}
            <div className="bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950 border border-emerald-500/40 rounded-xl p-2 sm:p-2.5 space-y-2 shadow-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Section Title */}
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                  <Scan className="w-3.5 h-3.5 text-emerald-400" />
                  <span>قارئ الهوية</span>
                </span>

                {/* Compact Barcode Scanner Input with pulsing green status */}
                <div className="relative flex-1 min-w-[130px]">
                  <input
                    ref={barcodeInputRef}
                    id="input_barcode_search"
                    type="text"
                    value={barcodeInput}
                    onFocus={() => setIsScannerFocused(true)}
                    onBlur={() => setIsScannerFocused(false)}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        parseBarcodeData(barcodeInput);
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text');
                      if (text) {
                        setTimeout(() => parseBarcodeData(text), 30);
                      }
                    }}
                    placeholder="إنقر هنا ثم إمسح الهوية"
                    className={`w-full bg-emerald-950/40 border rounded-lg px-2.5 py-1 text-xs text-emerald-200 placeholder-emerald-400/80 font-mono transition-all focus:outline-none ${
                      isScannerFocused
                        ? 'border-emerald-400 ring-2 ring-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.35)] bg-emerald-950/70'
                        : 'border-emerald-500/70 shadow-[0_0_8px_rgba(16,185,129,0.2)] animate-pulse'
                    }`}
                  />
                  {isScannerFocused && (
                    <div className="absolute left-2 top-1.5 flex items-center gap-0.5 text-[9px] text-emerald-300 pointer-events-none">
                      <Volume2 className="w-3 h-3 text-emerald-300" />
                    </div>
                  )}
                </div>

                {/* ID Document Type Direct Compact Selector (بدون تسمية نصية لتوفير المساحة) */}
                <select
                  id="select_scanner_id_doc_type"
                  value={senderIdType}
                  onChange={(e) => setSenderIdType(e.target.value)}
                  title="نوع وثيقة إثبات الشخصية"
                  aria-label="نوع الوثيقة"
                  className="bg-slate-900 hover:bg-slate-850 text-cyan-300 text-[11px] font-bold rounded-lg px-2 py-1 border border-slate-700/90 hover:border-cyan-500/60 focus:border-cyan-400 focus:outline-none cursor-pointer shrink-0 shadow-inner transition-colors max-w-[115px] sm:max-w-[130px] truncate"
                >
                  {idDocumentTypes.map((docType) => (
                    <option key={docType} value={docType} className="bg-slate-900 text-slate-100 font-normal">
                      {docType}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error Warning Banner if scanned data incomplete or corrupt */}
              {scannerErrorAlert && (
                <div className="bg-rose-950/90 border border-rose-500/80 rounded-lg p-2 flex items-start gap-2 text-xs text-rose-200 shadow-sm animate-in fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-rose-300 text-xs">تنبيه جودة الهوية (بيانات غير مكتملة / باركود غير واضح)</div>
                    <div className="text-[11px]">{scannerErrorAlert}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScannerErrorAlert(null)}
                    className="text-rose-400 hover:text-white p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Success Status Indicator */}
              {scannerStatus && !scannerErrorAlert && (
                <div className="text-[10px] text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 rounded-lg px-2 py-1 font-semibold flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-1 min-w-0">
                    <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{scannerStatus}</span>
                  </div>
                  {isScannedIdLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsScannedIdLocked(false);
                        setTimeout(() => {
                          const phoneEl = document.getElementById('input_sender_phone');
                          if (phoneEl) phoneEl.focus();
                        }, 50);
                      }}
                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-amber-950 text-amber-300 border border-amber-600/60 rounded text-[9px] font-bold transition flex items-center gap-0.5 shrink-0 cursor-pointer shadow-xs"
                      title="انقر لفك قفل الحقول والانتقال لحقل الهاتف"
                    >
                      <Unlock className="w-2.5 h-2.5 text-amber-400" />
                      <span>فك القفل</span>
                    </button>
                  )}
                </div>
              )}

              {/* Customer Directory Button + Quick Search + Status Indicator */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  {/* Customer Directory Button */}
                  <button
                    type="button"
                    id="btn_open_customer_directory"
                    onClick={() => setIsCustomerDirectoryModalOpen(true)}
                    className="h-8 px-2 bg-slate-900 hover:bg-cyan-950 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-500 rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-xs shrink-0 cursor-pointer"
                    title="فتح دليل العملاء والتجار المعتمدين"
                  >
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>دليل العملاء</span>
                  </button>

                  {/* Quick Inline Search */}
                  <div className="relative flex-1 min-w-0" ref={quickCustomerSearchRef}>
                    <div className="relative flex items-center gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          id="input_quick_customer_query"
                          value={quickCustomerQuery}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuickCustomerQuery(val);
                            setIsQuickCustomerDropdownOpen(true);
                            if (!val.trim()) {
                              setIdCustomerStatus(null);
                            }
                          }}
                          onFocus={() => {
                            if (quickCustomerQuery.trim()) {
                              setIsQuickCustomerDropdownOpen(true);
                            }
                          }}
                          placeholder="اسم العميل كاملاً أو البحث (الاسم، الهاتف، الرقم الوطني)..."
                          className="w-full bg-slate-900 border border-slate-700/90 focus:border-cyan-400 rounded-lg pr-8 pl-7 py-1.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none transition shadow-inner font-medium"
                        />
                        {quickCustomerQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickCustomerQuery('');
                              setIdCustomerStatus(null);
                              setIsQuickCustomerDropdownOpen(false);
                            }}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer p-0.5"
                            title="مسح البحث"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Dynamic Customer Status Indicator & Clear Button */}
                      {selectedCustomer ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <div
                            id="badge_existing_customer"
                            className="h-8 px-2 rounded-lg bg-cyan-950/90 border border-cyan-500/80 text-cyan-300 flex items-center gap-1 shrink-0 shadow-sm transition animate-in fade-in"
                            title={`بيانات مستدعاة من الدليل: ${selectedCustomer.fullName}`}
                          >
                            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-[10px] font-bold hidden sm:inline-block truncate max-w-[90px]">
                              {selectedCustomer.fullName.split(' ')[0]}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearSenderFields}
                            className="h-8 px-2 bg-slate-900 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/60 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="تفريغ بيانات المرسل"
                          >
                            <span>تفريغ</span>
                          </button>
                        </div>
                      ) : idCustomerStatus?.type === 'existing' ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <div
                            id="badge_existing_customer"
                            className="h-8 w-8 rounded-lg bg-emerald-950/90 border border-emerald-500 text-emerald-300 flex items-center justify-center shrink-0 shadow-sm transition animate-in fade-in"
                            title="عميل موجود سابقاً ومسجل في الدليل"
                          >
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                          </div>
                          <button
                            type="button"
                            onClick={handleClearSenderFields}
                            className="h-8 px-2 bg-slate-900 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/60 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="تفريغ بيانات المرسل"
                          >
                            <span>تفريغ</span>
                          </button>
                        </div>
                      ) : null}

                      {idCustomerStatus?.type === 'new' && (
                        <button
                          type="button"
                          id="btn_add_new_customer_quick"
                          onClick={handleQuickAddNewCustomer}
                          className="h-8 w-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/80 rounded-lg flex items-center justify-center shadow-md shrink-0 cursor-pointer transition active:scale-95 animate-in fade-in"
                          title="إضافة عميل جديد للدليل فوراً"
                          aria-label="إضافة عميل جديد"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Quick Dropdown Results */}
                    {isQuickCustomerDropdownOpen && quickCustomerQuery.trim().length > 0 && (
                      <div className="absolute top-full right-0 left-0 mt-1.5 bg-slate-900/98 backdrop-blur-md border border-cyan-500/60 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-800">
                        {matchingCustomers.length > 0 ? (
                          matchingCustomers.map((cust) => (
                            <button
                              key={cust.id}
                              type="button"
                              onClick={() => {
                                applyCustomerData(cust);
                                setQuickCustomerQuery(cust.fullName);
                                setIdCustomerStatus({
                                  type: 'existing',
                                  customer: cust,
                                  message: 'موجود سابقاً',
                                });
                                setIsQuickCustomerDropdownOpen(false);
                              }}
                              className="w-full text-right px-3 py-2.5 hover:bg-cyan-950/60 flex items-center justify-between gap-2 transition group cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                                  {cust.fullName}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-emerald-400">{cust.phone}</span>
                                  {cust.nationalId && (
                                    <span className="font-mono text-cyan-300">({cust.nationalId})</span>
                                  )}
                                  {cust.city && <span className="text-slate-300">• {cust.city}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-cyan-300 bg-cyan-900/70 border border-cyan-700 px-2 py-0.5 rounded-md shrink-0 group-hover:bg-cyan-600 group-hover:text-white transition">
                                استدعاء
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center space-y-2">
                            <div className="text-xs text-slate-400">
                              لا يوجد عميل مسجل سابقاً باسم "{quickCustomerQuery}"
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleQuickAddNewCustomer();
                                setIsQuickCustomerDropdownOpen(false);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>إضافة [{quickCustomerQuery}] كعميل جديد</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sender Civil Data Fields */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>الاسم <span className="text-rose-400">*</span></span>
                    {isScannedIdLocked && !!senderFirstName.trim() && (
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950 px-1 rounded border border-emerald-800 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> موثق
                      </span>
                    )}
                  </label>
                  <input
                    id="input_sender_first_name"
                    type="text"
                    required
                    readOnly={isScannedIdLocked && !!senderFirstName.trim()}
                    value={senderFirstName}
                    onChange={(e) => {
                      if (isScannedIdLocked && !!senderFirstName.trim()) return;
                      setSenderFirstName(e.target.value);
                      if (invalidFields.senderFirstName) {
                        setInvalidFields((prev) => ({ ...prev, senderFirstName: false }));
                      }
                    }}
                    placeholder="الاسم"
                    className={`w-full border rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                      isScannedIdLocked && !!senderFirstName.trim()
                        ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/70 font-semibold cursor-not-allowed shadow-inner'
                        : selectedCustomer
                        ? 'bg-slate-950 border-cyan-500/50 text-cyan-200 focus:border-cyan-400 font-medium focus:outline-none'
                        : invalidFields.senderFirstName
                        ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-white'
                        : 'bg-slate-950/80 border-slate-700 focus:border-cyan-500 text-white focus:outline-none'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>اسم الأب <span className="text-rose-400">*</span></span>
                    {isScannedIdLocked && !!senderFatherName.trim() && (
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950 px-1 rounded border border-emerald-800 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> موثق
                      </span>
                    )}
                  </label>
                  <input
                    id="input_sender_father_name"
                    type="text"
                    required
                    readOnly={isScannedIdLocked && !!senderFatherName.trim()}
                    value={senderFatherName}
                    onChange={(e) => {
                      if (isScannedIdLocked && !!senderFatherName.trim()) return;
                      setSenderFatherName(e.target.value);
                      if (invalidFields.senderFatherName) {
                        setInvalidFields((prev) => ({ ...prev, senderFatherName: false }));
                      }
                    }}
                    placeholder="الأب"
                    className={`w-full border rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                      isScannedIdLocked && !!senderFatherName.trim()
                        ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/70 font-semibold cursor-not-allowed shadow-inner'
                        : selectedCustomer
                        ? 'bg-slate-950 border-cyan-500/50 text-cyan-200 focus:border-cyan-400 font-medium focus:outline-none'
                        : invalidFields.senderFatherName
                        ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-white'
                        : 'bg-slate-950/80 border-slate-700 focus:border-cyan-500 text-white focus:outline-none'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>الكنية <span className="text-rose-400">*</span></span>
                    {isScannedIdLocked && !!senderLastName.trim() && (
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950 px-1 rounded border border-emerald-800 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> موثق
                      </span>
                    )}
                  </label>
                  <input
                    id="input_sender_last_name"
                    type="text"
                    required
                    readOnly={isScannedIdLocked && !!senderLastName.trim()}
                    value={senderLastName}
                    onChange={(e) => {
                      if (isScannedIdLocked && !!senderLastName.trim()) return;
                      setSenderLastName(e.target.value);
                      if (invalidFields.senderLastName) {
                        setInvalidFields((prev) => ({ ...prev, senderLastName: false }));
                      }
                    }}
                    placeholder="الكنية"
                    className={`w-full border rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                      isScannedIdLocked && !!senderLastName.trim()
                        ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/70 font-semibold cursor-not-allowed shadow-inner'
                        : selectedCustomer
                        ? 'bg-slate-950 border-cyan-500/50 text-cyan-200 focus:border-cyan-400 font-medium focus:outline-none'
                        : invalidFields.senderLastName
                        ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-white'
                        : 'bg-slate-950/80 border-slate-700 focus:border-cyan-500 text-white focus:outline-none'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>اسم الأم <span className="text-rose-400">*</span></span>
                    {isScannedIdLocked && !!senderMotherName.trim() && (
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950 px-1 rounded border border-emerald-800 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> موثق
                      </span>
                    )}
                  </label>
                  <input
                    id="input_sender_mother_name"
                    type="text"
                    required
                    readOnly={isScannedIdLocked && !!senderMotherName.trim()}
                    value={senderMotherName}
                    onChange={(e) => {
                      if (isScannedIdLocked && !!senderMotherName.trim()) return;
                      setSenderMotherName(e.target.value);
                      if (invalidFields.senderMotherName) {
                        setInvalidFields((prev) => ({ ...prev, senderMotherName: false }));
                      }
                    }}
                    placeholder="اسم الأم"
                    className={`w-full border rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                      isScannedIdLocked && !!senderMotherName.trim()
                        ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/70 font-semibold cursor-not-allowed shadow-inner'
                        : selectedCustomer
                        ? 'bg-slate-950 border-cyan-500/50 text-cyan-200 focus:border-cyan-400 font-medium focus:outline-none'
                        : invalidFields.senderMotherName
                        ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-white'
                        : 'bg-slate-950/80 border-slate-700 focus:border-cyan-500 text-white focus:outline-none'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      <span>تاريخ الولادة <span className="text-rose-400">*</span></span>
                    </span>
                    {isScannedIdLocked && !!senderBirthDate.trim() && (
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950 px-1 rounded border border-emerald-800 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> موثق
                      </span>
                    )}
                  </label>
                  <BirthDateField
                    id="input_sender_birth_date"
                    value={senderBirthDate}
                    onChange={(iso, dmy) => {
                      setSenderBirthDate(iso || dmy);
                      if (invalidFields.senderBirthDate) {
                        setInvalidFields((prev) => ({ ...prev, senderBirthDate: false }));
                      }
                    }}
                    required
                    isLocked={isScannedIdLocked && !!senderBirthDate.trim()}
                    hasError={!!invalidFields.senderBirthDate}
                    placeholder="DD/MM/YYYY (أرقام فقط)"
                  />
                </div>
              </div>

              {/* National ID & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                {/* 1. الرقم الوطني / رقم الوثيقة */}
                <div className="sm:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-300 truncate" title="رقم الوثيقة / الرقم الوطني">
                      <span>رقم الوثيقة / الرقم الوطني <span className="text-rose-400">*</span></span>
                    </label>
                    {isScannedIdLocked && !!senderNationalId.trim() && (
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950 px-1 rounded border border-emerald-800 flex items-center gap-0.5 shrink-0">
                        <Lock className="w-2.5 h-2.5" /> موثق
                      </span>
                    )}
                  </div>
                  <input
                    id="input_sender_national_id"
                    type="text"
                    maxLength={11}
                    required
                    readOnly={isScannedIdLocked && !!senderNationalId.trim()}
                    value={senderNationalId}
                    onKeyDown={blockNonIntegerKeys}
                    onChange={(e) => {
                      if (isScannedIdLocked && !!senderNationalId.trim()) return;
                      const clean = sanitizeDigitsOnly(e.target.value);
                      setSenderNationalId(clean);
                      if (invalidFields.senderNationalId) {
                        setInvalidFields((prev) => ({ ...prev, senderNationalId: false }));
                      }
                      if (!selectedCustomer) {
                        checkExistingCustomer(clean);
                      }
                    }}
                    placeholder="010xxxxxxxx"
                    className={`w-full h-8 border rounded-xl px-2.5 py-1 text-xs font-mono transition-colors ${
                      isScannedIdLocked && !!senderNationalId.trim()
                        ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/70 font-semibold cursor-not-allowed shadow-inner'
                        : selectedCustomer
                        ? 'bg-slate-950 border-cyan-500/50 text-cyan-200 focus:border-cyan-400 font-medium focus:outline-none'
                        : invalidFields.senderNationalId
                        ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-cyan-200'
                        : 'bg-slate-950/80 border-slate-700 focus:border-cyan-500 text-cyan-200 focus:outline-none'
                    }`}
                  />
                </div>

                {/* 2. رقم الهاتف / الجوال */}
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 truncate">
                    <span>رقم الهاتف <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="input_sender_phone"
                    type="tel"
                    required
                    value={senderPhone}
                    onKeyDown={blockNonPhoneKeys}
                    onChange={(e) => {
                      const clean = sanitizePhone(e.target.value);
                      setSenderPhone(clean);
                      if (!selectedCustomer) {
                        checkExistingCustomer(clean);
                      }
                      if (invalidFields.senderPhone) {
                        setInvalidFields((prev) => ({ ...prev, senderPhone: false }));
                      }
                    }}
                    placeholder="09xxxxxxxx"
                    className={`w-full h-8 border rounded-xl px-2.5 py-1 text-xs font-mono transition-colors ${
                      selectedCustomer
                        ? 'bg-slate-950 border-cyan-500/50 text-cyan-200 focus:border-cyan-400 font-medium focus:outline-none'
                        : invalidFields.senderPhone
                        ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-white'
                        : 'bg-slate-950/80 border-slate-700 focus:border-cyan-500 text-white focus:outline-none'
                    }`}
                  />
                </div>
              </div>

              {/* ID Card Photos (Front & Back) - Mandatory acceptance condition */}
              <div
                id="upload_sender_id_front"
                className={`pt-2 border-t transition-all rounded-xl p-2 ${
                  invalidFields.senderIdPhoto
                    ? 'border-rose-500 bg-rose-950/40 ring-1 ring-rose-500/60'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold flex items-center gap-1">
                    <CreditCard className={`w-3.5 h-3.5 ${invalidFields.senderIdPhoto ? 'text-rose-400' : 'text-cyan-400'}`} />
                    <span className={invalidFields.senderIdPhoto ? 'text-rose-300 font-bold' : 'text-slate-300'}>
                      صورة البطاقة الشخصية (الوجه الأمامي والخلفي) <span className="text-rose-400 font-black">*</span>
                    </span>
                  </span>
                  {senderIdPhotoFront && senderIdPhotoBack ? (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40 flex items-center gap-1 shadow-xs">
                      <span>✓ صورتا الهوية مكتملتان</span>
                    </span>
                  ) : senderIdPhotoFront || senderIdPhotoBack ? (
                    <span className="text-[10px] text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/40 flex items-center gap-1">
                      <span>⚠️ الوجه الثاني مطلوب</span>
                    </span>
                  ) : invalidFields.senderIdPhoto ? (
                    <span className="text-[10px] text-rose-300 font-bold bg-rose-900/80 px-2 py-0.5 rounded-md border border-rose-500 flex items-center gap-1 animate-pulse">
                      <span>⚠️ صورتا الهوية مطلوبتان</span>
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Front Photo */}
                  <div className={`bg-slate-950 border rounded-xl p-2 text-center transition-colors ${
                    invalidFields.senderIdPhoto && !senderIdPhotoFront
                      ? 'border-rose-500/80 bg-rose-950/30'
                      : 'border-slate-800'
                  }`}>
                    <span className="text-[10px] text-slate-400 block mb-1">الوجه الأمامي *</span>
                    {senderIdPhotoFront ? (
                      <div className="relative h-20 rounded-lg overflow-hidden border border-slate-700 group">
                        <img
                          src={senderIdPhotoFront}
                          alt="Front ID"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setSenderIdPhotoFront('')}
                          className="absolute inset-0 bg-black/60 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                        >
                          إزالة
                        </button>
                      </div>
                    ) : (
                      <label className={`h-20 border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition ${
                        invalidFields.senderIdPhoto
                          ? 'border-rose-500/80 hover:bg-rose-950/40'
                          : 'border-slate-700 hover:bg-slate-900'
                      }`}>
                        <Upload className={`w-4 h-4 mb-0.5 ${invalidFields.senderIdPhoto ? 'text-rose-400' : 'text-cyan-400'}`} />
                        <span className={`text-[9px] font-bold ${invalidFields.senderIdPhoto ? 'text-rose-300' : 'text-cyan-400'}`}>رفع الوجه 1</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const r = new FileReader();
                              r.onload = () => {
                                setSenderIdPhotoFront(r.result as string);
                                setInvalidFields((prev) => ({ ...prev, senderIdPhoto: false }));
                              };
                              r.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Back Photo */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">الوجه الخلفي</span>
                    {senderIdPhotoBack ? (
                      <div className="relative h-20 rounded-lg overflow-hidden border border-slate-700 group">
                        <img
                          src={senderIdPhotoBack}
                          alt="Back ID"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setSenderIdPhotoBack('')}
                          className="absolute inset-0 bg-black/60 text-rose-300 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                        >
                          إزالة
                        </button>
                      </div>
                    ) : (
                      <label className="h-20 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900 transition">
                        <Upload className="w-4 h-4 text-cyan-400 mb-0.5" />
                        <span className="text-[9px] text-cyan-400 font-medium">رفع الوجه 2</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const r = new FileReader();
                              r.onload = () => {
                                setSenderIdPhotoBack(r.result as string);
                                setInvalidFields((prev) => ({ ...prev, senderIdPhoto: false }));
                              };
                              r.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Destination & Receiver */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                <MapPin className="w-4 h-4" />
                <span>2. وجهة الوصول وبيانات المستلم</span>
              </div>
              {previousReceivers.length > 0 && (
                <span className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                  {previousReceivers.length} مستلم في السجل
                </span>
              )}
            </div>

            {/* Destination Hub (Placed First) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                المركز الوجهة (المحافظة) <span className="text-rose-400">*</span>
              </label>
              <select
                id="select_destination_hub"
                value={destinationHubId}
                onChange={(e) => {
                  setDestinationHubId(e.target.value);
                  const selectedHub = destinationHubs.find((h) => h.id === e.target.value);
                  if (selectedHub) setReceiverCity(selectedHub.governorate);
                  if (invalidFields.destinationHubId) {
                    setInvalidFields((prev) => ({ ...prev, destinationHubId: false }));
                  }
                }}
                className={`w-full bg-slate-950/80 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors ${
                  invalidFields.destinationHubId
                    ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30'
                    : 'border-slate-700 focus:border-cyan-500'
                }`}
              >
                {destinationHubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name} ({hub.governorate})
                  </option>
                ))}
              </select>
            </div>

            {/* UNIFIED RECEIVER NAME & REGISTRY SEARCH FIELD */}
            <div className="relative" ref={receiverInputContainerRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>اسم المستلم الكامل <span className="text-rose-400">*</span></span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsReceiverCustomerModalOpen(true)}
                    className="text-[10px] bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-700/60 flex items-center gap-1 cursor-pointer font-bold transition"
                    title="اختيار مستلم من دليل العملاء الموحد"
                  >
                    <Users className="w-3 h-3 text-cyan-400" />
                    <span>دليل العملاء</span>
                  </button>
                  {receiverName.trim().length >= 2 && (
                    isExistingReceiver ? (
                      <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-cyan-400" />
                        <span>مسجل مسبقاً</span>
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <UserPlus className="w-3 h-3 text-emerald-400" />
                        <span>مستلم جديد (سيضاف للسجل)</span>
                      </span>
                    )
                  )}
                  {previousReceivers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsReceiverDropdownOpen(!isReceiverDropdownOpen)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                    >
                      {isReceiverDropdownOpen ? 'إغلاق السجل' : 'عرض مقترحات السجل'}
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="input_receiver_name"
                  type="text"
                  required
                  value={receiverName}
                  onChange={(e) => {
                    setReceiverName(e.target.value);
                    setIsReceiverDropdownOpen(true);
                    if (autoFilledReceiverAlert) setAutoFilledReceiverAlert(null);
                    if (invalidFields.receiverName) {
                      setInvalidFields((prev) => ({ ...prev, receiverName: false }));
                    }
                  }}
                  onFocus={() => {
                    if (previousReceivers.length > 0) setIsReceiverDropdownOpen(true);
                  }}
                  placeholder="اكتب اسم المستلم الكامل (أو اختر من السجل المسجل مسبقاً)..."
                  className={`w-full bg-slate-950/90 border rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder:text-slate-500 font-semibold focus:outline-none transition-colors ${
                    invalidFields.receiverName
                      ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30'
                      : 'border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30'
                  }`}
                />
                {receiverName && (
                  <button
                    type="button"
                    onClick={() => {
                      setReceiverName('');
                      setIsReceiverDropdownOpen(false);
                      setAutoFilledReceiverAlert(null);
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Suggestions dropdown for Receiver */}
              {isReceiverDropdownOpen && (
                <div className="absolute right-0 left-0 mt-1 bg-slate-900/98 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-2xl z-40 p-1.5 space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 border-b border-slate-800 flex items-center justify-between">
                    <span>
                      {receiverName.trim() ? 'مستلمون مسجلون مطابقون للاسم المدخل:' : 'أحدث المستلمين المسجلين في السجل:'}
                    </span>
                    <span className="text-cyan-400 font-mono">
                      {matchingReceivers.length} مقترح
                    </span>
                  </div>

                  {matchingReceivers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 space-y-1">
                      <div className="text-slate-300 font-bold">لم يتم العثور على مستلم سابق مطابق للاسم</div>
                      <div className="text-[11px] text-emerald-400 flex items-center justify-center gap-1">
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>سيتم إدراج هذا المستلم في سجل المستلمين الموحد للشحنات</span>
                      </div>
                    </div>
                  ) : (
                    matchingReceivers.map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => selectPreviousReceiver(rec)}
                        className="w-full text-right p-2 rounded-lg hover:bg-cyan-950/40 hover:border-cyan-500/30 border border-transparent transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                              {rec.name}
                            </span>
                            {rec.isCustomer ? (
                              <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800/70 px-1.5 py-0.2 rounded font-medium">
                                عميل مسجل
                              </span>
                            ) : (
                              <span className="text-[9px] bg-purple-950/80 text-purple-300 border border-purple-800/60 px-1.5 py-0.2 rounded font-medium">
                                مستلم شحنات
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5 truncate">
                            <span className="text-slate-300">{rec.phone}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">{rec.city}</span>
                            {rec.address && <span className="truncate text-slate-400">({rec.address})</span>}
                          </div>
                        </div>
                        <div className="text-left shrink-0 mr-2">
                          <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800/70 px-1.5 py-0.5 rounded font-bold">
                            {rec.shipmentCount} شحنة
                          </span>
                        </div>
                      </button>
                    ))
                  )}

                  {/* Option note for new receiver */}
                  {receiverName.trim().length >= 2 && !isExistingReceiver && (
                    <div className="p-2 mt-1 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between text-[11px] text-emerald-200">
                      <div className="flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>مستلم جديد للشحنة: لن يدخل في دليل العملاء إلا بعد تسليم الطرد وتوثيق الهوية في قسم الوارد.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReceiverDropdownOpen(false)}
                        className="text-[10px] bg-emerald-700/60 hover:bg-emerald-600 text-white px-2 py-0.5 rounded font-bold cursor-pointer"
                      >
                        اعتماد ومتابعة
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto-filled Receiver Banner */}
            {autoFilledReceiverAlert && (
              <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-2.5 flex items-start justify-between gap-2 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-emerald-200">
                    <span className="font-bold text-emerald-300">تم جلب بيانات المستلم تلقائياً: </span>
                    <span>{autoFilledReceiverAlert.name} ({autoFilledReceiverAlert.city}) - {autoFilledReceiverAlert.phone}</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">
                      مسجل له {autoFilledReceiverAlert.count} شحنة سابقة في السجل
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoFilledReceiverAlert(null)}
                  className="text-emerald-400 hover:text-white text-xs px-1 font-bold cursor-pointer"
                  title="إغلاق التنبيه"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Receiver Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                رقم هاتف المستلم (للتواصل والإبلاغ) <span className="text-rose-400">*</span>
              </label>
              <input
                id="input_receiver_phone"
                type="tel"
                required
                value={receiverPhone}
                onKeyDown={blockNonPhoneKeys}
                onChange={(e) => {
                  const clean = sanitizePhone(e.target.value);
                  setReceiverPhone(clean);
                  if (invalidFields.receiverPhone) {
                    setInvalidFields((prev) => ({ ...prev, receiverPhone: false }));
                  }
                }}
                placeholder="09xxxxxxxx"
                className={`w-full bg-slate-950/80 border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none transition-colors ${
                  invalidFields.receiverPhone
                    ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30'
                    : 'border-slate-700 focus:border-cyan-500'
                }`}
              />
            </div>

            {/* Detailed Destination Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                عنوان التسليم أو التوصيل التفصيلي <span className="text-rose-400 font-bold">*</span>
              </label>
              <textarea
                id="input_destination_address"
                rows={3}
                value={destinationAddress}
                onChange={(e) => {
                  setDestinationAddress(e.target.value);
                  if (invalidFields['destinationAddress'] && e.target.value.trim()) {
                    setInvalidFields((prev) => ({ ...prev, destinationAddress: false }));
                  }
                }}
                placeholder="مثال: الحي - الشارع - مقابل بناء كذا أو (استلام مباشر من مستودع المركز) - إلزامي للحفظ"
                className={`w-full bg-slate-950/80 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none ${
                  invalidFields['destinationAddress']
                    ? 'border-rose-500 ring-1 ring-rose-500/50 focus:border-rose-400'
                    : 'border-slate-700 focus:border-cyan-500'
                }`}
              />
            </div>
          </div>

          {/* Column 3: Package Specs, Dimensions & Financial System in the SAME Frame */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                  <Package className="w-4 h-4" />
                  <span>3. نوع ومواصفات الشحنة والنظام المالي</span>
                </div>
              </div>

            {/* MANUAL PRICING SPECIFICATION VIEW */}
            {isManualPricing ? (
              <div className="space-y-4">
                {/* Shipping Category (Postal vs Cargo) */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                    <span>تصنيف ونوع الشحنة:</span>
                    <span className="text-[10px] text-slate-400">حدد (بريدي) أو (شحن بضائع)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShippingCategory('postal')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        shippingCategory === 'postal'
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                          : 'bg-slate-950/80 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <span className="text-base">✉️</span>
                      <div className="text-right">
                        <div className="font-black">شحنة بريدية</div>
                        <div className="text-[10px] opacity-80">رسائل، مستندات، أظرف</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShippingCategory('cargo')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        shippingCategory === 'cargo'
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-400 shadow-md shadow-amber-600/30 ring-1 ring-amber-400'
                          : 'bg-slate-950/80 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <span className="text-base">📦</span>
                      <div className="text-right">
                        <div className="font-black">شحن بضائع</div>
                        <div className="text-[10px] opacity-80">طرود، كراتين، حمولات</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Package Type & Weight Note Field side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>نوع الطرد الشحنة</span>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {brandingSettings.packageTypeMode === 'directory_dropdown' ? 'قائمة المعتمدة' : 'إدخال يدوي حر'}
                      </span>
                    </label>

                    {brandingSettings.packageTypeMode === 'directory_dropdown' ? (
                      <select
                        id="select_package_type"
                        value={packageType}
                        onChange={(e) => handleSelectPackageType(e.target.value)}
                        className={`w-full bg-slate-950/90 border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none ${
                          invalidFields.packageType
                            ? 'border-rose-500 ring-1 ring-rose-500 text-rose-200'
                            : 'border-slate-700 focus:border-emerald-500 text-white'
                        }`}
                      >
                        <option value="" disabled className="text-slate-500 bg-slate-900">
                          -- اختر نوع الطرد والشحنة --
                        </option>
                        {packageTypes.map((pt) => {
                          const rateInfo = brandingSettings.packageTypeRates?.[pt];
                          const hasRate =
                            rateInfo &&
                            ((rateInfo.fixedPriceSyp && rateInfo.fixedPriceSyp > 0) ||
                              (rateInfo.fixedPriceUsd && rateInfo.fixedPriceUsd > 0));
                          const hasMin =
                            rateInfo &&
                            ((rateInfo.minPriceSyp && rateInfo.minPriceSyp > 0) ||
                              (rateInfo.minPriceUsd && rateInfo.minPriceUsd > 0));

                          let labelDetails = '';
                          if (hasRate || hasMin) {
                            const rateText = hasRate
                              ? `${rateInfo?.fixedPriceSyp ? `${formatNumber(rateInfo.fixedPriceSyp)} ل.س` : ''}${
                                  rateInfo?.fixedPriceSyp && rateInfo?.fixedPriceUsd ? ' / ' : ''
                                }${rateInfo?.fixedPriceUsd ? `$${rateInfo.fixedPriceUsd}` : ''}`
                              : '';
                            const minText = hasMin
                              ? `${rateInfo?.minPriceSyp ? `${formatNumber(rateInfo.minPriceSyp)} ل.س` : ''}${
                                  rateInfo?.minPriceSyp && rateInfo?.minPriceUsd ? ' / ' : ''
                                }${rateInfo?.minPriceUsd ? `$${rateInfo.minPriceUsd}` : ''}`
                              : '';

                            if (hasRate && hasMin) {
                              labelDetails = ` (أجور مثبتة: ${rateText} | أدنى حد: ${minText})`;
                            } else if (hasRate) {
                              labelDetails = ` (أجور مثبتة: ${rateText})`;
                            } else if (hasMin) {
                              labelDetails = ` (حد أدنى للتعديل: ${minText})`;
                            }
                          }
                          return (
                            <option key={pt} value={pt}>
                              {pt}{labelDetails}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      (() => {
                        const suggestion = getPackageTypeSuggestion(packageType, packageTypes);
                        return (
                          <div className="relative w-full rounded-xl overflow-hidden bg-slate-950/90 border border-slate-700 focus-within:border-emerald-500">
                            {suggestion && (
                              <div
                                className="absolute inset-y-0 right-0 px-3 py-2 text-xs font-semibold pointer-events-none flex items-center overflow-hidden whitespace-nowrap z-0"
                                dir="rtl"
                              >
                                <span className="opacity-0 font-semibold">{packageType}</span>
                                <span className="text-slate-400 font-semibold select-none bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/80 inline-flex items-center gap-1.5 mr-0.5 shadow-sm">
                                  <span>{suggestion.slice(packageType.length)}</span>
                                  <span className="text-[9px] text-cyan-400 font-mono font-bold mr-1">(↵ Enter / Tab)</span>
                                </span>
                              </div>
                            )}
                            <input
                              type="text"
                              value={packageType}
                              onChange={(e) => handleSelectPackageType(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowLeft') && suggestion) {
                                  e.preventDefault();
                                  handleSelectPackageType(suggestion);
                                }
                              }}
                              placeholder="اكتب نوع الطرد يدوياً (مثل: ألبسة، طرود غذائية، أجهزة...)"
                              className="w-full bg-transparent px-3 py-2 text-xs text-white font-semibold focus:outline-none placeholder-slate-500 relative z-10"
                            />
                          </div>
                        );
                      })()
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-400 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5" />
                        <span>وزن الشحنة وملاحظاتها <span className="text-rose-400">*</span></span>
                      </span>
                      {invalidFields.packageNotes && (
                        <span className="text-[10px] text-rose-400 font-bold">مطلوب *</span>
                      )}
                    </label>
                    <input
                      id="input_package_notes"
                      type="text"
                      value={packageNotes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPackageNotes(val);
                        const match = val.match(/(\d+(?:\.\d+)?)/);
                        if (match) {
                          setWeightKg(parseFloat(match[1]));
                        }
                        if (val.trim().length > 0) {
                          if (invalidFields.packageNotes || invalidFields.weightKg) {
                            setInvalidFields((prev) => ({ ...prev, packageNotes: false, weightKg: false }));
                          }
                          setValidationErrors((prev) =>
                            prev.filter((err) => !err.includes('وزن الشحنة') && !err.includes('الوزن'))
                          );
                        }
                      }}
                      placeholder="اكتب وزن الشحنة وملاحظاتها بحرية (مثال: 5 كغ أو كرتونة متوسطة بوزن 8 كغ)"
                      className={`w-full bg-slate-950/90 border rounded-xl px-3 py-2 text-xs text-emerald-200 placeholder-slate-500 font-semibold focus:outline-none transition-colors ${
                        invalidFields.packageNotes
                          ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-950/40 text-rose-200'
                          : 'border-emerald-500/80 focus:border-emerald-400 ring-1 ring-emerald-500/30'
                      }`}
                    />
                    {invalidFields.packageNotes && (
                      <p className="text-[10px] text-rose-400 font-bold mt-1">
                        * يرجى كتابة وزن الشحنة وملاحظاتها
                      </p>
                    )}
                  </div>
                </div>

                {/* Pieces Count and Content Description */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">عدد الطرود</label>
                    <input
                      type="number"
                      min="1"
                      value={piecesCount === 0 ? '' : piecesCount}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => {
                        const clean = sanitizeDigitsOnly(e.target.value);
                        setPiecesCount(clean === '' ? 0 : parseInt(clean, 10) || 0);
                      }}
                      placeholder="عدد الطرود"
                      className="w-full bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      <span>وصف محتوى الشحنة <span className="text-rose-400">*</span></span>
                    </label>
                    <input
                      id="input_content_description"
                      type="text"
                      required
                      value={contentDescription}
                      onChange={(e) => {
                        setContentDescription(e.target.value);
                        if (invalidFields.contentDescription) {
                          setInvalidFields((prev) => ({ ...prev, contentDescription: false }));
                        }
                      }}
                      placeholder={shippingCategory === 'postal' ? 'مثال: أوراق وشهادات مصدقة' : 'مثال: قطع غيار، ملابس، مواد غذائية...'}
                      className={`w-full border rounded-xl px-3 py-2 text-xs transition-colors ${
                        invalidFields.contentDescription
                          ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-white'
                          : 'bg-slate-950/80 border-slate-700 focus:border-cyan-500 text-white focus:outline-none'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* AUTOMATED MATRIX SPECIFICATION VIEW */
              <div className="space-y-4">
                {/* Package Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>نوع الطرد</span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      {brandingSettings.packageTypeMode === 'directory_dropdown' ? 'قائمة المعتمدة' : 'إدخال يدوي حر'}
                    </span>
                  </label>
                  {brandingSettings.packageTypeMode === 'directory_dropdown' ? (
                    <select
                      id="select_package_type_compact"
                      value={packageType}
                      onChange={(e) => handleSelectPackageType(e.target.value)}
                      className={`w-full bg-slate-950/80 border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        invalidFields.packageType
                          ? 'border-rose-500 ring-1 ring-rose-500 text-rose-200'
                          : 'border-slate-700 focus:border-cyan-500 text-white'
                      }`}
                    >
                      <option value="" disabled className="text-slate-500 bg-slate-900">
                        -- اختر نوع الطرد والشحنة --
                      </option>
                      {packageTypes.map((pt) => {
                        const rateInfo = brandingSettings.packageTypeRates?.[pt];
                        const hasRate =
                          rateInfo &&
                          ((rateInfo.fixedPriceSyp && rateInfo.fixedPriceSyp > 0) ||
                            (rateInfo.fixedPriceUsd && rateInfo.fixedPriceUsd > 0));
                        const hasMin =
                          rateInfo &&
                          ((rateInfo.minPriceSyp && rateInfo.minPriceSyp > 0) ||
                            (rateInfo.minPriceUsd && rateInfo.minPriceUsd > 0));

                        let labelDetails = '';
                        if (hasRate || hasMin) {
                          const rateText = hasRate
                            ? `${rateInfo?.fixedPriceSyp ? `${formatNumber(rateInfo.fixedPriceSyp)} ل.س` : ''}${
                                rateInfo?.fixedPriceSyp && rateInfo?.fixedPriceUsd ? ' / ' : ''
                              }${rateInfo?.fixedPriceUsd ? `$${rateInfo.fixedPriceUsd}` : ''}`
                            : '';
                          const minText = hasMin
                            ? `${rateInfo?.minPriceSyp ? `${formatNumber(rateInfo.minPriceSyp)} ل.س` : ''}${
                                rateInfo?.minPriceSyp && rateInfo?.minPriceUsd ? ' / ' : ''
                              }${rateInfo?.minPriceUsd ? `$${rateInfo.minPriceUsd}` : ''}`
                            : '';

                          if (hasRate && hasMin) {
                            labelDetails = ` (أجور مثبتة: ${rateText} | أدنى حد: ${minText})`;
                          } else if (hasRate) {
                            labelDetails = ` (أجور مثبتة: ${rateText})`;
                          } else if (hasMin) {
                            labelDetails = ` (حد أدنى للتعديل: ${minText})`;
                          }
                        }
                        return (
                          <option key={pt} value={pt}>
                            {pt}{labelDetails}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    (() => {
                      const suggestion = getPackageTypeSuggestion(packageType, packageTypes);
                      return (
                        <div className="relative w-full rounded-xl overflow-hidden bg-slate-950/80 border border-slate-700 focus-within:border-cyan-500">
                          {suggestion && (
                            <div
                              className="absolute inset-y-0 right-0 px-3 py-2 text-xs font-semibold pointer-events-none flex items-center overflow-hidden whitespace-nowrap z-0"
                              dir="rtl"
                            >
                              <span className="opacity-0 font-semibold">{packageType}</span>
                              <span className="text-slate-400 font-semibold select-none bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/80 inline-flex items-center gap-1.5 mr-0.5 shadow-sm">
                                <span>{suggestion.slice(packageType.length)}</span>
                                <span className="text-[9px] text-cyan-400 font-mono font-bold mr-1">(↵ Enter / Tab)</span>
                              </span>
                            </div>
                          )}
                          <input
                            type="text"
                            value={packageType}
                            onChange={(e) => handleSelectPackageType(e.target.value)}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowLeft') && suggestion) {
                                e.preventDefault();
                                handleSelectPackageType(suggestion);
                              }
                            }}
                            placeholder="اكتب نوع الطرد يدوياً..."
                            className="w-full bg-transparent px-3 py-2 text-xs text-white font-semibold focus:outline-none placeholder-slate-500 relative z-10"
                          />
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* 5 Parcel Size Tiers Cards */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 text-cyan-400" />
                      <span>فئة حجم الطرد (5 مستويات قياسية):</span>
                    </label>
                    <span className="text-[10px] text-slate-400">تعبئة تلقائية للأبعاد والوزن</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {(Object.keys(SIZE_TIERS_CONFIG) as ParcelSizeTier[]).map((tierKey) => {
                      const cfg = SIZE_TIERS_CONFIG[tierKey];
                      const isSelected = sizeTier === tierKey;
                      return (
                        <button
                          key={tierKey}
                          type="button"
                          onClick={() => {
                            setSizeTier(tierKey);
                            setLengthCm(cfg.typicalDimensions.lengthCm);
                            setWidthCm(cfg.typicalDimensions.widthCm);
                            setHeightCm(cfg.typicalDimensions.heightCm);
                            setWeightKg(cfg.maxWeightKg);
                          }}
                          className={`p-1.5 rounded-xl border text-center transition-all flex flex-col items-center justify-between ${
                            isSelected
                              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 font-bold shadow-sm ring-1 ring-cyan-400'
                              : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          <span className="text-[11px] font-bold truncate w-full">{cfg.label}</span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">{cfg.maxWeightKg} كغ</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weight and Pieces count */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>الوزن الفعلي (كغ) <span className="text-rose-400">*</span></span>
                      {(invalidFields.weightKg || invalidFields.packageNotes) && (
                        <span className="text-[10px] text-rose-400 font-bold">مطلوب *</span>
                      )}
                    </label>
                    <input
                      id="input_weight_kg"
                      type="number"
                      step="any"
                      value={weightKg === 0 ? '' : weightKg}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        const val = clean === '' ? 0 : parseFloat(clean) || 0;
                        setWeightKg(val);
                        if (val > 0) {
                          setPackageNotes(`${val} كغ`);
                          if (invalidFields.weightKg || invalidFields.packageNotes) {
                            setInvalidFields((prev) => ({ ...prev, weightKg: false, packageNotes: false }));
                          }
                          setValidationErrors((prev) =>
                            prev.filter((err) => !err.includes('وزن الشحنة') && !err.includes('الوزن'))
                          );
                        }
                      }}
                      placeholder="الوزن بالكغ"
                      className={`w-full bg-slate-950/80 border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${
                        (invalidFields.weightKg || invalidFields.packageNotes)
                          ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-950/40 text-rose-200'
                          : 'border-slate-700 focus:border-cyan-500 text-white'
                      }`}
                    />
                    {(invalidFields.weightKg || invalidFields.packageNotes) && (
                      <p className="text-[10px] text-rose-400 font-bold mt-1">
                        * يرجى كتابة وزن الشحنة وملاحظاتها
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">عدد الطرود</label>
                    <input
                      type="number"
                      min="1"
                      value={piecesCount === 0 ? '' : piecesCount}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonIntegerKeys}
                      onChange={(e) => {
                        const clean = sanitizeDigitsOnly(e.target.value);
                        setPiecesCount(clean === '' ? 0 : parseInt(clean, 10) || 0);
                      }}
                      placeholder="عدد الطرود"
                      className="w-full bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Dimensions (L x W x H) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    الأبعاد بالسنتيمتر (طول × عرض × ارتفاع)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="طول"
                      value={lengthCm === 0 ? '' : lengthCm}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setLengthCm(clean === '' ? 0 : parseFloat(clean) || 0);
                      }}
                      className="bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono text-center focus:outline-none"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="عرض"
                      value={widthCm === 0 ? '' : widthCm}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setWidthCm(clean === '' ? 0 : parseFloat(clean) || 0);
                      }}
                      className="bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono text-center focus:outline-none"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="ارتفاع"
                      value={heightCm === 0 ? '' : heightCm}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={blockNonAmountKeys}
                      onChange={(e) => {
                        const clean = sanitizeDecimal(e.target.value);
                        setHeightCm(clean === '' ? 0 : parseFloat(clean) || 0);
                      }}
                      className="bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono text-center focus:outline-none"
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] text-slate-400 flex items-center justify-between font-mono">
                    <span>الحجم: {calcResult.volumeCbm} م³</span>
                    <span>الوزن الحجمي: {calcResult.volumetricWeightKg} كغ</span>
                    <span>المسافة: {calcResult.distanceKm} كم</span>
                  </div>
                </div>

                {/* PRICING BASIS SELECTOR */}
                <div className="bg-slate-950/90 border border-slate-700/80 rounded-xl p-3 space-y-2">
                  <label className="block text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    معيار ونوع التسعير المعتمد:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPricingBasis('auto')}
                      className={`p-1.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                        pricingBasis === 'auto'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] leading-tight">تلقائي (الأعلى)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingBasis('size_tier_only')}
                      className={`p-1.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                        pricingBasis === 'size_tier_only'
                          ? 'bg-blue-500/20 border-blue-400 text-blue-200 font-bold shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Box className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] leading-tight">فئة الحجم</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingBasis('weight_only')}
                      className={`p-1.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                        pricingBasis === 'weight_only'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] leading-tight">الوزن فقط</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingBasis('volume_only')}
                      className={`p-1.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                        pricingBasis === 'volume_only'
                          ? 'bg-purple-500/20 border-purple-400 text-purple-200 font-bold shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Box className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[10px] leading-tight">الحجم CBM</span>
                    </button>
                  </div>

                  {/* Basis Calculation Live Feedback */}
                  <div className="text-[10px] text-slate-300 font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-1">
                    <span>فئة الحجم: {formatCurrency(calcResult.calculatedSizeTierCost, currency)}</span>
                    <span>•</span>
                    <span>الوزن: {formatCurrency(calcResult.calculatedWeightCost, currency)}</span>
                    <span>•</span>
                    <span>الحجم: {formatCurrency(calcResult.calculatedVolumeCost, currency)}</span>
                    <span>•</span>
                    <span className="text-cyan-300 font-bold">
                      المعتمد: {calcResult.appliedBasis === 'size_tier' ? 'فئة الحجم' : calcResult.appliedBasis === 'volume' ? 'الحجم CBM' : 'الوزن (كغ)'}
                    </span>
                  </div>
                </div>

                {/* Content Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    <span>وصف محتوى الطرد <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="input_content_description_auto"
                    type="text"
                    required
                    value={contentDescription}
                    onChange={(e) => {
                      setContentDescription(e.target.value);
                      if (invalidFields.contentDescription) {
                        setInvalidFields((prev) => ({ ...prev, contentDescription: false }));
                      }
                    }}
                    placeholder="مثال: ألبسة قطنية، قطع غيار سيارات..."
                    className={`w-full border rounded-xl px-3 py-2 text-xs transition-colors ${
                      invalidFields.contentDescription
                        ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/30 text-white'
                        : 'bg-slate-950/80 border-slate-700 focus:border-cyan-500 text-white focus:outline-none'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FINANCIAL SYSTEM & SHIPPING FEES (النظام المالي وأجور الشحن مدرجة بنفس الإطار) */}
            {/* ========================================================================= */}
            <div className="bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95 border border-amber-500/30 rounded-xl p-3 sm:p-3.5 space-y-3 shadow-md">
              {/* Financial Section Header with Currency Switcher */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Calculator className="w-4 h-4 text-amber-400" />
                  <span>النظام المالي وأجور الشحن</span>
                </div>

                {/* Compact Currency Switcher */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold">العملة:</span>
                  <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleCurrencyChange('SYP')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        currency === 'SYP'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ل.س (SYP)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCurrencyChange('USD')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        currency === 'USD'
                          ? 'bg-cyan-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      دولار (USD)
                    </button>
                  </div>
                </div>
              </div>

              {/* MANUAL PRICING FINANCIAL INPUTS */}
              {isManualPricing ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Payment Method */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">طريقة السداد</label>
                      <select
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                        className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none"
                      >
                        <option value="prepaid">مدفوع سلفاً من المرسل (Prepaid)</option>
                        <option value="collect">أجور على المستلم (Collect)</option>
                        <option value="cod">ضد الدفع + حوالة مالية (COD)</option>
                      </select>
                    </div>

                    {/* FREIGHT COST INPUT */}
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-400 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span>أجور الشحن ({currency === 'SYP' ? 'ل.س' : '$'}): <span className="text-rose-400">*</span></span>
                          {currentPackageTypeRateInfo && (
                            <>
                              {((currentPackageTypeRateInfo.fixedPriceSyp && currentPackageTypeRateInfo.fixedPriceSyp > 0) ||
                                (currentPackageTypeRateInfo.fixedPriceUsd && currentPackageTypeRateInfo.fixedPriceUsd > 0)) && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-normal">
                                  🏷️ أجور مثبتة لنوع [{packageType}]
                                </span>
                              )}
                              {currentPackageTypeMinPrice && currentPackageTypeMinPrice > 0 && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-normal">
                                  ⛔ الحد الأدنى للتعديل: {formatCurrency(currentPackageTypeMinPrice, currency)}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                        {invalidFields.shippingCost && (
                          <span className="text-[10px] text-rose-400 font-bold">مطلوب *</span>
                        )}
                      </label>
                      <div className="relative">
                        <FormattedAmountInput
                          id="input_manual_shipping_cost"
                          value={manualShippingCost}
                          currency={currency}
                          onChange={(parsed) => {
                            setManualShippingCost(parsed);
                            setManualShippingCostStr(parsed === 0 ? '' : String(parsed));
                            if (invalidFields.shippingCost) {
                              setInvalidFields((prev) => ({ ...prev, shippingCost: false }));
                            }
                            if (parsed > 0 && (!currentPackageTypeMinPrice || parsed >= currentPackageTypeMinPrice)) {
                              setValidationErrors((prev) => prev.filter((err) => !err.includes('أجور الشحن')));
                            }
                          }}
                          placeholder="أدخل أجور الشحن مباشرة"
                          className={`w-full bg-slate-950 border rounded-xl pr-3 pl-10 py-1.5 text-xs font-mono font-black focus:outline-none transition-colors ${
                            invalidFields.shippingCost || (currentPackageTypeMinPrice && manualShippingCost > 0 && manualShippingCost < currentPackageTypeMinPrice)
                              ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-950/40 text-rose-200'
                              : 'border-emerald-500 focus:border-emerald-400 text-emerald-300 ring-1 ring-emerald-500/30'
                          }`}
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-400 font-mono pointer-events-none">
                          {currency === 'SYP' ? 'ل.س' : '$'}
                        </span>
                      </div>
                      {fixedPriceAppliedNote && (
                        <p className="text-[10px] text-emerald-400 font-bold mt-1 animate-in fade-in flex items-center gap-1">
                          <span>{fixedPriceAppliedNote}</span>
                        </p>
                      )}
                      {currentPackageTypeMinPrice && manualShippingCost > 0 && manualShippingCost < currentPackageTypeMinPrice && (
                        <p className="text-[10px] text-rose-300 bg-rose-950/60 border border-rose-500/50 p-1.5 rounded-lg font-bold mt-1 animate-pulse flex items-center gap-1">
                          <span>⛔ لا يمكن المتابعة: الأجور المدخلة ({formatCurrency(manualShippingCost, currency)}) أقل من الحد الأدنى المسموح به للتعديل لهذا النوع ({formatCurrency(currentPackageTypeMinPrice, currency)}).</span>
                        </p>
                      )}
                      {invalidFields.shippingCost && (
                        <p className="text-[10px] text-rose-400 font-bold mt-1 animate-pulse">
                          * شرط إلزامي: يجب تحديد وتسجيل أجور الشحن بما لا يقل عن الحد الأدنى قبل حفظ البوليصة
                        </p>
                      )}
                      {minShippingFeeFromEngine && manualShippingCost > 0 && manualShippingCost < minShippingFeeFromEngine && (
                        <p className="text-[10px] text-amber-400 font-mono mt-1">
                          تنبيه: المبلغ أقل من الحد الأدنى للأجور المعتمد في محرك الأسعار لهذا المسار ({formatCurrency(minShippingFeeFromEngine, currency)}).
                        </p>
                      )}
                    </div>
                  </div>

                  {/* COD Amount & Currency Selection inside the field if COD selected */}
                  {paymentType === 'cod' && (
                    <div className="bg-amber-950/20 border border-amber-500/50 rounded-xl p-2.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-amber-400" />
                          <span>مبلغ الحوالة المالية (ضد الدفع COD) <span className="text-rose-400">*</span></span>
                        </label>
                        {/* Remittance Currency Selector directly inside the field */}
                        <div className="flex bg-slate-950 rounded-lg p-0.5 border border-amber-500/40">
                          <button
                            type="button"
                            onClick={() => setCodCurrency('SYP')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                              codCurrency === 'SYP'
                                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            ل.س (SYP)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCodCurrency('USD')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                              codCurrency === 'USD'
                                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            دولار ($)
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <FormattedAmountInput
                          id="input_cod_amount_manual"
                          value={codAmount}
                          currency={codCurrency}
                          onChange={(num) => {
                            setCodAmount(num);
                            if (invalidFields.codAmount) {
                              setInvalidFields((prev) => ({ ...prev, codAmount: false }));
                            }
                          }}
                          placeholder={`اكتب مبلغ الحوالة بـ (${codCurrency === 'SYP' ? 'الليرة السورية' : 'الدولار الأمريكي'})`}
                          className={`w-full bg-slate-950 border rounded-xl pr-3 pl-12 py-2 text-xs font-mono font-bold focus:outline-none transition-colors ${
                            invalidFields.codAmount || (maxCodAllowedFromEngine && codAmount > maxCodAllowedFromEngine)
                              ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-950/40 text-rose-200'
                              : 'border-amber-500/80 focus:border-amber-400 text-amber-300'
                          }`}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-amber-400 font-mono pointer-events-none">
                          {codCurrency === 'SYP' ? 'ل.س' : '$'}
                        </span>
                      </div>
                      {maxCodAllowedFromEngine && codAmount > maxCodAllowedFromEngine && (
                        <div className="text-[10px] text-rose-400 flex items-center gap-1 font-bold animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>تنبيه محرك الأسعار: المبلغ يتجاوز السقف الأعلى المسموح به للحوالة ({formatCurrency(maxCodAllowedFromEngine, codCurrency)})</span>
                        </div>
                      )}
                      {maxCodAllowedFromEngine && (
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span>سقف الحوالة المسموح (محرك الأسعار):</span>
                          <span className="font-mono font-bold text-amber-400">
                            {formatCurrency(maxCodAllowedFromEngine, codCurrency)}
                          </span>
                        </div>
                      )}
                      {(!codAmount || codAmount <= 0) && (
                        <div className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold animate-pulse">
                          <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>شرط إلزامي: يجب تسجيل مبلغ الحوالة لحفظ الطرد ضد الدفع (*)</span>
                        </div>
                      )}
                      <div className="text-[10px] text-amber-200/80 flex items-center justify-between">
                        <span>عمولة التحويل ({getCodCommissionLabel(codCurrency)}):</span>
                        <span className="font-mono font-bold text-amber-300">
                          {formatCurrency(calculateCodTransferFee(codAmount, codCurrency), codCurrency)}
                        </span>
                      </div>

                      {/* Small Button Toggle: اختيار أجور الشحن على المرسل أو التلقائي (على المستلم) */}
                      <div className="bg-slate-950/90 border border-amber-500/40 rounded-lg p-2 space-y-1.5 pt-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                            <span>توزيع أجور الشحن:</span>
                          </span>
                          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                            <button
                              type="button"
                              onClick={() => setCodShippingPayer('recipient')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                codShippingPayer === 'recipient'
                                   ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                              title="الوضع التلقائي: الشحن ومبلغ الحوالة وعمولتها جميعاً على المستلم"
                            >
                              <span>التلقائي (على المستلم)</span>
                              {codShippingPayer === 'recipient' && <Check className="w-2.5 h-2.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCodShippingPayer('sender')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                codShippingPayer === 'sender'
                                  ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                              title="أجور الشحن تسدد من المرسل سلفاً، وتبقى الحوالة وأجور الحوالة على المستلم"
                            >
                              <span>أجور الشحن على المرسل</span>
                              {codShippingPayer === 'sender' && <Check className="w-2.5 h-2.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-300">
                          {codShippingPayer === 'sender' ? (
                            <span className="text-cyan-300 font-medium">
                              ✓ أجور الشحن تسدد من المرسل، ويبقى على المستلم فقط مبلغ الحوالة ({formatCurrency(codAmount, codCurrency)}) وعمولتها.
                            </span>
                          ) : (
                            <span className="text-amber-300/80 font-medium">
                              ✓ التلقائي: المستلم يسدد كامل المبالغ (أجور الشحن + مبلغ الحوالة + عمولة الحوالة).
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* COD Breakdown Summary */}
                  {paymentType === 'cod' ? (
                    <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 space-y-1.5 text-xs font-mono">
                      <div className="text-[10px] font-bold text-amber-400 border-b border-slate-800 pb-1 flex items-center justify-between">
                        <span>تفاصيل المبالغ والعمولات (كل بعملته):</span>
                        <span className="text-[9px] text-slate-400 font-normal">
                          {currency === codCurrency ? 'عملة موحدة' : 'عملتان مختلفتان'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span className="text-slate-400">
                          أجور الشحن {codShippingPayer === 'sender' ? '(مسددة من المرسل بالفرع):' : '(على المستلم):'}
                        </span>
                        <span className={`font-bold ${codShippingPayer === 'sender' ? 'text-cyan-300' : 'text-white'}`}>
                          {formatCurrency(manualShippingCost || 0, currency)}
                          {codShippingPayer === 'sender' && <span className="text-[9px] text-cyan-400 mr-1">(مدفوعة)</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span className="text-slate-400">مبلغ الحوالة المحول للمرسل:</span>
                        <span className="font-bold text-amber-400">{formatCurrency(codAmount || 0, codCurrency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span className="text-slate-400">عمولة التحويل ({getCodCommissionLabel(codCurrency)}):</span>
                        <span className="font-bold text-amber-300">
                          {formatCurrency(calculateCodTransferFee(codAmount, codCurrency), codCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span className="text-slate-400">صافي الحوالة مع عمولتها:</span>
                        <span className="font-bold text-amber-200">
                          {formatCurrency((codAmount || 0) + calculateCodTransferFee(codAmount, codCurrency), codCurrency)}
                        </span>
                      </div>

                      {/* Total Due Presentation */}
                      <div className="border-t border-slate-800 pt-1.5 mt-1">
                        {codShippingPayer === 'sender' ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-amber-300 font-bold">
                              <span>المطلوب تحصيله من المستلم (حوالة + عمولتها فقط):</span>
                              <span className="text-sm font-black text-amber-300">
                                {formatCurrency((codAmount || 0) + calculateCodTransferFee(codAmount, codCurrency), codCurrency)}
                              </span>
                            </div>
                            <div className="bg-cyan-950/40 p-1.5 rounded-lg border border-cyan-800/50 flex items-center justify-between text-[11px]">
                              <span className="text-cyan-300 font-bold">أجور الشحن المستلمة من المرسل سلفاً:</span>
                              <span className="font-bold text-cyan-200">{formatCurrency(manualShippingCost || 0, currency)}</span>
                            </div>
                          </div>
                        ) : currency === codCurrency ? (
                          <div className="flex items-center justify-between text-emerald-400 font-bold">
                            <span>إجمالي المطلوب تحصيله من المستلم (شحن + حوالة):</span>
                            <span className="text-sm font-black text-emerald-300">
                              {formatCurrency((manualShippingCost || 0) + codAmount + calculateCodTransferFee(codAmount, codCurrency), currency)}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-[10px] text-emerald-400 font-bold">إجمالي المطلوب تحصيله من المستلم (مفصل):</div>
                            <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                              <span className="text-cyan-300 font-bold">أجور الشحن:</span>
                              <span className="font-bold text-white">{formatCurrency(manualShippingCost || 0, currency)}</span>
                            </div>
                            <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                              <span className="text-amber-300 font-bold">مجموع الحوالة مع العمولة:</span>
                              <span className="font-bold text-amber-300">
                                {formatCurrency((codAmount || 0) + calculateCodTransferFee(codAmount, codCurrency), codCurrency)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Non-COD Summary */
                    <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px]">
                          <span className="text-slate-400">المطلوب تحصيله: </span>
                          <span className="text-slate-400 font-normal text-[10px]">({paymentType === 'prepaid' ? 'مدفوع سلفاً' : 'على المستلم'})</span>
                        </div>
                        <div className="text-sm font-black text-cyan-300">
                          {paymentType === 'prepaid' ? formatCurrency(0, currency) : formatCurrency(manualShippingCost || 0, currency)}
                        </div>
                      </div>
                      {showTransferredAmount && Number(transferredAmount) > 0 && (
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-800/40">
                          <span className="flex items-center gap-1 font-bold">
                            <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                            <span>مبلغ محوّل:</span>
                          </span>
                          <span className="font-mono font-bold text-indigo-200">
                            {formatCurrency(Number(transferredAmount), transferredAmountCurrency)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* AUTOMATED PRICING FINANCIAL INPUTS */
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Payment Method */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">طريقة السداد</label>
                      <select
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                        className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none"
                      >
                        <option value="prepaid">مدفوع سلفاً من المرسل (Prepaid)</option>
                        <option value="collect">أجور على المستلم (Collect)</option>
                        <option value="cod">ضد الدفع + حوالة مالية (COD)</option>
                      </select>
                    </div>

                    {/* COD Amount & Currency Selection inside the field if COD selected */}
                    {paymentType === 'cod' && (
                      <div className="bg-amber-950/20 border border-amber-500/50 rounded-xl p-2.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>مبلغ الحوالة المالية (ضد الدفع COD) <span className="text-rose-400">*</span></span>
                          </label>
                          {/* Remittance Currency Selector directly inside the field */}
                          <div className="flex bg-slate-950 rounded-lg p-0.5 border border-amber-500/40">
                            <button
                              type="button"
                              onClick={() => setCodCurrency('SYP')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                codCurrency === 'SYP'
                                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              ل.س (SYP)
                            </button>
                            <button
                              type="button"
                              onClick={() => setCodCurrency('USD')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                codCurrency === 'USD'
                                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              دولار ($)
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <FormattedAmountInput
                            id="input_cod_amount_auto"
                            value={codAmount}
                            currency={codCurrency}
                            onChange={(num) => {
                              setCodAmount(num);
                              if (invalidFields.codAmount) {
                                setInvalidFields((prev) => ({ ...prev, codAmount: false }));
                              }
                            }}
                            placeholder={`اكتب مبلغ الحوالة بـ (${codCurrency === 'SYP' ? 'الليرة السورية' : 'الدولار الأمريكي'})`}
                            className={`w-full bg-slate-950 border rounded-xl pr-3 pl-12 py-2 text-xs font-mono font-bold focus:outline-none transition-colors ${
                              invalidFields.codAmount || (maxCodAllowedFromEngine && codAmount > maxCodAllowedFromEngine)
                                ? 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-950/40 text-rose-200'
                                : 'border-amber-500/80 focus:border-amber-400 text-amber-300'
                            }`}
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-amber-400 font-mono pointer-events-none">
                            {codCurrency === 'SYP' ? 'ل.س' : '$'}
                          </span>
                        </div>
                        {maxCodAllowedFromEngine && codAmount > maxCodAllowedFromEngine && (
                          <div className="text-[10px] text-rose-400 flex items-center gap-1 font-bold animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>تنبيه محرك الأسعار: المبلغ يتجاوز السقف الأعلى المسموح به للحوالة ({formatCurrency(maxCodAllowedFromEngine, codCurrency)})</span>
                          </div>
                        )}
                        {maxCodAllowedFromEngine && (
                          <div className="text-[10px] text-slate-400 flex items-center justify-between">
                            <span>سقف الحوالة المسموح (محرك الأسعار):</span>
                            <span className="font-mono font-bold text-amber-400">
                              {formatCurrency(maxCodAllowedFromEngine, codCurrency)}
                            </span>
                          </div>
                        )}
                        {(!codAmount || codAmount <= 0) && (
                          <div className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold animate-pulse">
                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>شرط إلزامي: يجب تسجيل مبلغ الحوالة لحفظ الطرد ضد الدفع (*)</span>
                          </div>
                        )}
                        <div className="text-[10px] text-amber-200/80 flex items-center justify-between">
                          <span>عمولة التحويل (2%):</span>
                          <span className="font-mono font-bold text-amber-300">
                            {formatCurrency(calcResult.transferFee, codCurrency)}
                          </span>
                        </div>

                        {/* Small Button Toggle: اختيار أجور الشحن على المرسل أو التلقائي (على المستلم) */}
                        <div className="bg-slate-950/90 border border-amber-500/40 rounded-lg p-2 space-y-1.5 pt-2">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                              <span>توزيع أجور الشحن:</span>
                            </span>
                            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                              <button
                                type="button"
                                onClick={() => setCodShippingPayer('recipient')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  codShippingPayer === 'recipient'
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="الوضع التلقائي: الشحن ومبلغ الحوالة وعمولتها جميعاً على المستلم"
                              >
                                <span>التلقائي (على المستلم)</span>
                                {codShippingPayer === 'recipient' && <Check className="w-2.5 h-2.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCodShippingPayer('sender')}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  codShippingPayer === 'sender'
                                    ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="أجور الشحن تسدد من المرسل سلفاً، وتبقى الحوالة وأجور الحوالة على المستلم"
                              >
                                <span>أجور الشحن على المرسل</span>
                                {codShippingPayer === 'sender' && <Check className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                          </div>
                          <div className="text-[9px] text-slate-300">
                            {codShippingPayer === 'sender' ? (
                              <span className="text-cyan-300 font-medium">
                                ✓ أجور الشحن تسدد من المرسل، ويبقى على المستلم فقط مبلغ الحوالة ({formatCurrency(codAmount, codCurrency)}) وعمولتها.
                              </span>
                            ) : (
                              <span className="text-amber-300/80 font-medium">
                                ✓ التلقائي: المستلم يسدد كامل المبالغ (أجور الشحن + مبلغ الحوالة + عمولة الحوالة).
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Live Pricing Breakdown */}
                  <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 space-y-1.5 text-xs font-mono">
                    <div className="text-[10px] font-bold text-amber-400 border-b border-slate-800 pb-1 flex items-center justify-between">
                      <span>تفاصيل المبالغ والعمولات (كل بعملته):</span>
                      <span className="text-[9px] text-slate-400 font-normal">
                        {paymentType === 'cod' ? (currency === codCurrency ? 'عملة موحدة' : 'عملتان مختلفتان') : 'شحن فقط'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300 text-[11px]">
                      <span className="text-slate-400">
                        أجور الشحن ({calcResult.appliedBasis === 'size_tier' ? 'فئة الحجم' : calcResult.appliedBasis === 'volume' ? 'CBM' : 'وزن'} - {calcResult.distanceKm} كم) {paymentType === 'cod' && codShippingPayer === 'sender' ? '(مسددة من المرسل بالفرع):' : ':'}
                      </span>
                      <span className={`font-bold ${paymentType === 'cod' && codShippingPayer === 'sender' ? 'text-cyan-300' : 'text-white'}`}>
                        {formatCurrency(calcResult.shippingCost, currency)}
                        {paymentType === 'cod' && codShippingPayer === 'sender' && <span className="text-[9px] text-cyan-400 mr-1">(مدفوعة)</span>}
                      </span>
                    </div>

                    {paymentType === 'cod' && (
                      <>
                        <div className="flex items-center justify-between text-slate-300 text-[11px]">
                          <span className="text-slate-400">مبلغ الحوالة المحول للمرسل:</span>
                          <span className="font-bold text-amber-400">
                            {formatCurrency(codAmount || 0, codCurrency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300 text-[11px]">
                          <span className="text-slate-400">عمولة التحويل (بنفس عملة الحوالة):</span>
                          <span className="font-bold text-amber-300">
                            {formatCurrency(calcResult.transferFee, codCurrency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300 text-[11px]">
                          <span className="text-slate-400">صافي الحوالة مع عمولتها:</span>
                          <span className="font-bold text-amber-200">
                            {formatCurrency((codAmount || 0) + calcResult.transferFee, codCurrency)}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Total Due Presentation */}
                    <div className="border-t border-slate-800 pt-1.5 mt-1">
                      {paymentType === 'prepaid' ? (
                        <div className="flex items-center justify-between text-cyan-300 font-bold">
                          <span>المطلوب تحصيله من المستلم (مدفوع سلفاً):</span>
                          <span className="text-sm font-black">{formatCurrency(0, currency)}</span>
                        </div>
                      ) : paymentType === 'collect' ? (
                        <div className="flex items-center justify-between text-emerald-400 font-bold">
                          <span>المطلوب تحصيله من المستلم (أجور الشحن):</span>
                          <span className="text-sm font-black">
                            {formatCurrency(calcResult.shippingCost, currency)}
                          </span>
                        </div>
                      ) : paymentType === 'cod' && codShippingPayer === 'sender' ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-amber-300 font-bold">
                            <span>المطلوب تحصيله من المستلم (حوالة + عمولتها فقط):</span>
                            <span className="text-sm font-black text-amber-300">
                              {formatCurrency((codAmount || 0) + calcResult.transferFee, codCurrency)}
                            </span>
                          </div>
                          <div className="bg-cyan-950/40 p-1.5 rounded-lg border border-cyan-800/50 flex items-center justify-between text-[11px]">
                            <span className="text-cyan-300 font-bold">أجور الشحن المستلمة من المرسل سلفاً:</span>
                            <span className="font-bold text-cyan-200">{formatCurrency(calcResult.shippingCost, currency)}</span>
                          </div>
                        </div>
                      ) : currency === codCurrency ? (
                        <div className="flex items-center justify-between text-emerald-400 font-bold">
                          <span>إجمالي المطلوب تحصيله من المستلم (شحن + حوالة):</span>
                          <span className="text-sm font-black">
                            {formatCurrency(calcResult.shippingCost + codAmount + calcResult.transferFee, currency)}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-[10px] text-emerald-400 font-bold">إجمالي المطلوب تحصيله من المستلم (مفصل):</div>
                          <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                            <span className="text-cyan-300 font-bold">أجور الشحن:</span>
                            <span className="font-bold text-white">{formatCurrency(calcResult.shippingCost, currency)}</span>
                          </div>
                          <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                            <span className="text-amber-300 font-bold">مجموع الحوالة مع العمولة:</span>
                            <span className="font-bold text-amber-300">
                              {formatCurrency((codAmount || 0) + calcResult.transferFee, codCurrency)}
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Transferred Amount Line in Automated Pricing */}
                      {showTransferredAmount && Number(transferredAmount) > 0 && (
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-800/40">
                          <span className="flex items-center gap-1 font-bold">
                            <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                            <span>مبلغ محوّل:</span>
                          </span>
                          <span className="font-mono font-bold text-indigo-200">
                            {formatCurrency(Number(transferredAmount), transferredAmountCurrency)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TRANSFERRED AMOUNT TOGGLE & INPUTS */}
              <div className="pt-2 border-t border-slate-800/80">
                {!showTransferredAmount ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferredAmount(true);
                      if (!transferredAmount) {
                        setTransferredAmount(transferredAmountCurrency === 'SYP' ? 5000 : 1);
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-500/50 bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                    <span>+ إضافة مبلغ محوّل</span>
                  </button>
                ) : (
                  <div className="p-3 bg-indigo-950/30 border border-indigo-500/40 rounded-xl space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                        <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                        <span>مبلغ محوّل</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTransferredAmount(false);
                          setTransferredAmount(0);
                        }}
                        className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                        title="إلغاء المبلغ المحوّل"
                      >
                        <X className="w-3 h-3" />
                        <span>إلغاء</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Transferred Amount Input & Currency Selector */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-bold text-indigo-200">
                            المبلغ المحوّل:
                          </label>
                          {/* Currency Toggle */}
                          <div className="flex items-center bg-slate-900 border border-indigo-500/40 rounded-md p-0.5">
                            <button
                              type="button"
                              onClick={() => setTransferredAmountCurrency('SYP')}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                transferredAmountCurrency === 'SYP'
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              ل.س
                            </button>
                            <button
                              type="button"
                              onClick={() => setTransferredAmountCurrency('USD')}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                transferredAmountCurrency === 'USD'
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              $
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <FormattedAmountInput
                            value={transferredAmount}
                            currency={transferredAmountCurrency}
                            onChange={(num) => setTransferredAmount(num)}
                            placeholder="أدخل المبلغ المحول"
                            className="w-full bg-slate-950 border border-indigo-500/50 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold outline-none"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-indigo-300 font-bold pointer-events-none">
                            {transferredAmountCurrency === 'SYP' ? 'ل.س' : '$'}
                          </span>
                        </div>
                      </div>

                      {/* Transferred Amount Reason Note */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-300 mb-1">
                          ملاحظة التحويل (السبب):
                        </label>
                        <input
                          type="text"
                          value={transferredAmountReason}
                          onChange={(e) => setTransferredAmountReason(e.target.value)}
                          placeholder="مثال: أجور توصيل الموزع بالجهة المقابلة / أجور دليفري"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Reasons Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-400">أسباب سريعة:</span>
                      {[
                        'أجور موزع الجهة المقابلة',
                        'أجور دليفري وتوصيل للمنزل',
                        'تفريغ وتحميل وجهة',
                        'أجور مندوب خارجي',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTransferredAmountReason(preset)}
                          className="text-[10px] bg-slate-900 hover:bg-indigo-900/60 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white px-2 py-0.5 rounded cursor-pointer transition"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit & Preview Buttons */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
            {/* Validation Errors Alert Box */}
            {validationErrors.length > 0 && (
              <div className="bg-rose-950/90 border-2 border-rose-500 rounded-xl p-3 text-xs space-y-2 shadow-lg shadow-rose-950/50 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-xs pb-1.5 border-b border-rose-800/80">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>تنبيه شروط الحفظ: يرجى استكمال الحقول الإلزامية المعلمة بالإشارة الحمراء (*):</span>
                </div>
                <ul className="space-y-1 pr-2 list-disc list-inside text-rose-200 text-[11px] font-medium">
                  {validationErrors.map((err, idx) => (
                    <li key={idx} className="leading-tight">{err}</li>
                  ))}
                </ul>
                <div className="text-[10px] text-rose-300/80 pt-0.5">
                  💡 لن يتم حفظ الشحنة أو توليد البوليصة حتى إدخال كافة البيانات الإلزامية وتسجيل مبلغ ضد الدفع.
                </div>
              </div>
            )}

            {!canCreateParcel && (
              <div className="text-[11px] text-rose-300 bg-rose-950/80 border border-rose-800 rounded-xl px-3 py-1.5">
                ⚠️ ليس لديك صلاحية تسجيل طرود جديدة (حساب للعرض فقط)
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* زر تفريغ الحقول ومسح الملاحظات والوزن */}
              <button
                type="button"
                id="btn_reset_form"
                onClick={handleResetForm}
                className="h-10 px-3 shrink-0 rounded-xl border border-slate-700 bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer active:scale-95"
                title="تفريغ جميع الحقول والملاحظات والوزن للبدء بشحنة جديدة"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">تفريغ الحقول</span>
              </button>

              {/* زر معاينة: صغير وأيقونة فقط للمعاينة */}
              <button
                type="button"
                id="btn_preview_consignment"
                onClick={handlePreviewConsignment}
                className="h-10 w-10 shrink-0 rounded-xl border border-cyan-500/50 bg-cyan-950/50 hover:bg-cyan-900/70 text-cyan-300 hover:text-white flex items-center justify-center transition cursor-pointer shadow-md shadow-cyan-950/30 active:scale-95"
                title="معاينة إشعار الشحن (3 أقسام) والتحكم بالإظهار قبل الطباعة"
                aria-label="معاينة البوليصة"
              >
                <Eye className="w-5 h-5 text-cyan-400" />
              </button>

              {/* زر حفظ وتوليد بوليصة */}
              <button
                type="submit"
                id="btn_submit_consignment"
                disabled={!canCreateParcel || isSubmitting}
                className={`flex-1 py-2.5 px-4 font-black text-xs sm:text-sm rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                  canCreateParcel && !isSubmitting
                    ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>جارٍ حفظ وتوليد البوليصة...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>حفظ وتوليد بوليصة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>

      {/* Table of Recently Registered Parcels */}
      <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              <span>سجل الطرود المسجلة مؤخراً في المركز ({recentParcels.length})</span>
            </h2>
            <p className="text-[11px] text-slate-400">
              يمكنك معاينة بيان وحالة أي بوليصة بالكامل أو إعادة طباعة نموذج الـ A4 المقسم في أي وقت
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="بحث برقم التتبع أو الورقي أو الاسم..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Parcels Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                <th className="p-3">رقم التتبع / البوليصة</th>
                <th className="p-3">الإيصال اليدوي</th>
                <th className="p-3">المرسل (الرقم الوطني)</th>
                <th className="p-3">المستلم والوجهة</th>
                <th className="p-3">وزن الشحنة وملاحظاتها</th>
                <th className="p-3">معيار التسعير</th>
                <th className="p-3">المطلوب تحصيله</th>
                <th className="p-3">الحالة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentParcels.map((parcel) => (
                <tr key={parcel.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-mono font-bold text-cyan-300">
                    <div>{parcel.trackingNumber}</div>
                    {Boolean(parcel.isCourierPickup || parcel.registeredByCourierName || parcel.collectedByCourierName) && (
                      <div className="mt-1 flex items-center gap-1 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                          <span>🛵 منفذ الطرد:</span>
                          <span className="text-white font-extrabold">
                            {parcel.registeredByCourierName || parcel.collectedByCourierName}
                          </span>
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono text-slate-300">
                    {parcel.paperReceiptNumber}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-white">{parcel.sender.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {parcel.sender.nationalId
                        ? `رقم وطني: ${canViewNationalId ? parcel.sender.nationalId : maskId(parcel.sender.nationalId)}`
                        : (canViewPhone ? parcel.sender.phone : maskPhone(parcel.sender.phone))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-white">{parcel.receiver.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {parcel.receiver.city} - {canViewPhone ? parcel.receiver.phone : maskPhone(parcel.receiver.phone)}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-slate-300">
                    <div>{formatQuantity(parcel.weightKg)} كغ</div>
                    <div className="text-[10px] text-slate-400">({parcel.piecesCount || 1} قطعة)</div>
                  </td>
                  <td className="p-3 font-mono">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">
                      {parcel.packageType || 'طرد'}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-400">
                    <div>
                      {(() => {
                        if (!canViewFinancials) return '*** مخفي';
                        const s = getParcelPaymentSummary(parcel);
                        return (
                          <div className="space-y-0.5 font-mono">
                            <div className="font-bold text-emerald-400">{s.summaryDueText}</div>
                            {s.normalizedType === 'cod' && !s.isSameCurrency && (
                              <div className="text-[9px] text-amber-300 font-normal">
                                {s.isShippingPrepaidBySender
                                  ? '(الشحن مسدد سلفاً)'
                                  : `(شحن: ${formatCurrency(s.shippingCost, s.shippingCurrency)} + حوالة: ${formatCurrency(s.totalCodDue, s.codCurrency)})`}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    {Boolean(parcel.transferredAmount && parcel.transferredAmount > 0) && (
                      <div className="text-[10px] text-indigo-400 font-normal font-sans flex items-center gap-1 mt-0.5">
                        <ArrowRightLeft className="w-2.5 h-2.5" />
                        <span>محوّل: {formatCurrency(parcel.transferredAmount, parcel.transferredAmountCurrency || parcel.currency)}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {(() => {
                      switch (parcel.handlingStatus) {
                        case 'received_at_hub':
                        case 'received_at_origin_hub':
                          return (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/80">
                                بمركز الانطلاق (جاهز للشحن)
                              </span>
                              {(parcel.isRecoveredFromPreviousShortage || parcel.shortageStatus === 'confirmed_at_origin' || parcel.previousShortageManifestNumber) && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                  <span>⚠️ ناقص من شحنة سابقة</span>
                                </span>
                              )}
                            </div>
                          );
                        case 'loaded_in_truck':
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80">
                              محمل بالشاحنة (بانتظار المغادرة)
                            </span>
                          );
                        case 'in_transit':
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950/80 text-sky-300 border border-sky-800/80">
                              في الطريق للوجهة 🚚
                            </span>
                          );
                        case 'received_at_dest':
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                              وصل لفرع الوجهة 🏬
                            </span>
                          );
                        case 'out_for_delivery':
                        case 'with_courier':
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/80">
                              مع المندوب للتسليم 🛵
                            </span>
                          );
                        case 'delivered':
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-950/80 text-teal-300 border border-teal-800/80">
                              تم التسليم للعميل ✅
                            </span>
                          );
                        case 'shortage_missing':
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80 animate-pulse">
                              نقص معلق للتحقق ⚠️
                            </span>
                          );
                        case 'lost_in_transit':
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80">
                              مفقود (بمستودع الفقد والتسويات) 🚨
                            </span>
                          );
                        case 'leftover_origin_warehouse':
                          return (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800/80">
                                بمركز الانطلاق (جاهز للشحن)
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <span>⚠️ ناقص من شحنة سابقة</span>
                              </span>
                            </div>
                          );
                        default:
                          return (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {parcel.handlingStatus}
                            </span>
                          );
                      }
                    })()}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedParcelForQuickView(parcel)}
                        className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/80 text-cyan-300 transition-colors"
                        title="عرض البيان وحالة الطرد بالكامل"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                      {canPrintParcel && (
                        <button
                          onClick={() => openPrintModal('parcel_3part', parcel)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                          title="طباعة بوليصة A4 مقسمة (3 أقسام)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incomplete Registration Conditions Alert Modal */}
      {showValidationModal && (
        <div
          id="modal_validation_errors"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-rose-500/70 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 font-['Cairo',sans-serif]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm sm:text-base font-black text-rose-400">
                  تنبيه: لا يمكن حفظ البوليصة قبل تحقيق الشروط الأساسية!
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  يرجى استكمال وإدخال الحقول الإلزامية الأساسية التالية لإتمام إصدار وتثبيت بوليصة الشحن في النظام:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950/90 rounded-xl p-3.5 border border-rose-500/30 max-h-60 overflow-y-auto space-y-2">
              {validationModalErrors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-rose-300">
                  <span className="text-rose-500 font-bold shrink-0">•</span>
                  <span className="font-semibold leading-relaxed">{err}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                إغلاق والتعديل
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowValidationModal(false);
                  if (firstInvalidFieldId) {
                    setTimeout(() => {
                      const el = document.getElementById(firstInvalidFieldId);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.focus();
                      }
                    }, 100);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-900/40 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>الانتقال لأول حقل ناقص وتصحيحه</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Directory Modal (Sender) */}
      <CustomerDirectoryModal
        isOpen={isCustomerDirectoryModalOpen}
        onClose={() => setIsCustomerDirectoryModalOpen(false)}
        onSelectCustomer={(c) => {
          applyCustomerData(c);
        }}
      />

      {/* Customer Directory Modal (Receiver) */}
      <CustomerDirectoryModal
        isOpen={isReceiverCustomerModalOpen}
        onClose={() => setIsReceiverCustomerModalOpen(false)}
        onSelectCustomer={(c) => {
          selectCustomerAsReceiver(c);
        }}
      />
    </div>
  );
};
