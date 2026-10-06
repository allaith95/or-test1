import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  blockNonAmountKeys,
  blockNonIntegerKeys,
  blockNonPhoneKeys,
  sanitizeDecimal,
  sanitizeDigitsOnly,
  sanitizePhone,
} from '../utils/numberSanitizer';
import {
  ShieldCheck,
  ScanLine,
  CheckCircle,
  AlertCircle,
  Coins,
  DollarSign,
  Building,
  UserCheck,
  User,
  Phone,
  MapPin,
  Package,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Barcode,
  CheckCircle2,
  Check,
  X,
  Keyboard,
  Info,
  Wallet,
  RotateCcw,
  Scan,
  Volume2,
  AlertTriangle,
  Unlock,
  Users,
  Search,
  UserPlus,
  Lock,
  CreditCard,
  Upload,
  Trash2,
  Image as ImageIcon,
  Camera,
  Loader2,
  Save,
} from 'lucide-react';
import { Parcel, Currency, PaymentType, IdDocumentType, Customer, Governorate } from '../types';
import { useOrca } from '../context/OrcaContext';
import { getParcelPaymentSummary } from '../utils/settlementMath';
import { DEFAULT_ID_DOCUMENT_TYPES } from '../data/initialData';
import { normalizeCustomerNames } from '../utils/nameUtils';
import { verifyReceiverIdentity, ReceiverVerificationResult } from '../utils/receiverVerification';
import { CustomerDirectoryModal } from './CustomerDirectoryModal';
import { BirthDateField } from './BirthDateField';
import { validateBirthDate } from '../utils/birthDateUtility';
import {
  toLatinDigits,
  formatLatinDate,
  formatLatinTime,
  formatLatinDateTime,
} from '../utils/numberFormatter';
import {
  processSyrianIdScannerPayload,
  resolveSmartSyrianCivilProfile,
  normalizeBirthDateToISO,
  formatDateToDMY,
  SyrianIdScannerResult,
} from '../utils/BarcodeScannerUtility';
import { useBarcodeDecoder } from '../hooks/useBarcodeDecoder';
import { setPhoto, getPhoto, deletePhoto } from '../utils/photoStorage';
import {
  findCustomerByPhone,
  findCustomerByNationalId,
} from '../utils/phoneUtils';

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface DeliveryHandoverModalProps {
  parcel: Parcel;
  onClose: () => void;
  onConfirm: (deliveryData: {
    nationalId: string;
    idType?: IdDocumentType;
    idPhotoUrl: string;
    idBackPhotoUrl?: string;
    collectedAmount: number;
    deliveryNotes: string;
    actualReceiverName: string;
    receiverRelation: string;
    idMotherName?: string;
    idFatherName?: string;
    idBirthPlace?: string;
    idCivilRecord?: string;
    signatureUrl?: string;
    collectedSyp: number;
    collectedUsd: number;
    shippingCurrency: Currency;
    codCurrency: Currency;
    receiverPhone?: string;
    receiverBirthDate?: string;
    receiverFirstName?: string;
    receiverLastName?: string;
  }) => void;
}

// ترميز المحافظات السورية حسب أول خانتين من الرقم الوطني (11 رقم)
const SYRIAN_GOV_CODES: Record<string, string> = {
  '01': 'محافظة دمشق',
  '02': 'محافظة ريف دمشق',
  '03': 'محافظة القنيطرة',
  '04': 'محافظة حمص',
  '05': 'محافظة حماة',
  '06': 'محافظة اللاذقية',
  '07': 'محافظة إدلب',
  '08': 'محافظة حلب',
  '09': 'محافظة طرطوس',
  '10': 'محافظة الرقة',
  '11': 'محافظة دير الزور',
  '12': 'محافظة الحسكة',
  '13': 'محافظة درعا',
  '14': 'محافظة السويداء',
};

export const DeliveryHandoverModal: React.FC<DeliveryHandoverModalProps> = ({
  parcel,
  onClose,
  onConfirm,
}) => {
  const {
    brandingSettings,
    branches,
    currentBranch,
    parcels,
    customers,
    addCustomer,
    formatCurrency,
    formatNumber,
    ensureServerConnected,
  } = useOrca();
  const exchangeRate = brandingSettings.exchangeRateUsdToSyp || 15000;
  // خيار السماح بتعدد العملات في تسليم الطرود
  const isMultiCurrencyAllowed = brandingSettings.allowMultiCurrencyDelivery === true;

  // جلب النسخة المحدثة الحية من الطرد
  const currentParcel = parcels.find((p) => p.id === parcel.id || p.trackingNumber === parcel.trackingNumber) || parcel;

  // =========================================================================
  // 0. AUTO-FETCH PREVIOUS ID CARD DATA FROM REGISTRY (جلب بيانات البطاقة السابقة آلياً)
  // =========================================================================
  const [showManualScannerOverride, setShowManualScannerOverride] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const existingCardRecord = useMemo(() => {
    const normalizePhone = (num: string) => {
      const digits = (num || '').replace(/\D/g, '');
      if (digits.startsWith('963')) return digits.slice(3);
      if (digits.startsWith('09')) return digits.slice(1);
      return digits;
    };

    const targetPhone = (parcel.receiver?.phone || '').replace(/\D/g, '');
    const targetNormPhone = normalizePhone(parcel.receiver?.phone || '');
    const targetName = (parcel.receiver?.name || '').trim().toLowerCase();
    const targetNationalId = (parcel.receiver?.nationalId || '').trim();

    // 1. Current parcel already has receiver nationalId or complete details
    if (targetNationalId && targetNationalId.length >= 8) {
      return {
        sourceType: 'parcel_current',
        sourceLabel: 'مسجل في بيانات البوليصة الحالية',
        nationalId: targetNationalId,
        idType: parcel.receiver.idType || 'هوية سورية',
        actualReceiverName: parcel.receiver.actualReceiverName || parcel.receiver.name,
        receiverRelation: parcel.receiver.receiverRelation || 'المستلم بالذات',
        firstName: parcel.receiver.firstName || '',
        fatherName: parcel.receiver.idFatherName || parcel.receiver.fatherName || '',
        lastName: parcel.receiver.lastName || '',
        motherName: parcel.receiver.idMotherName || parcel.receiver.motherName || '',
        birthDate: normalizeBirthDateToISO(parcel.receiver.birthDate || (parcel.receiver as any)?.idBirthDate || ''),
        birthPlace: parcel.receiver.idBirthPlace || (parcel.receiver.city ? `محافظة ${parcel.receiver.city}` : ''),
        civilRecord: parcel.receiver.idCivilRecord || parcel.receiver.address || '',
        phone: parcel.receiver.phone || '',
        idPhotoFront: parcel.receiver.idPhotoFront || (parcel.receiver as any)?.nationalIdPhotoUrl || '',
        idPhotoBack: parcel.receiver.idPhotoBack || (parcel.receiver as any)?.nationalIdBackPhotoUrl || '',
        customer: undefined,
      };
    }

    // 2. Search in Customer Directory (سجل العملاء المعتمد الموحد)
    if (customers && customers.length > 0) {
      const matchedCustomer = customers.find((c) => {
        if (!c) return false;
        const cPhone = (c.phone || '').replace(/\D/g, '');
        const cSecPhone = (c.secondaryPhone || '').replace(/\D/g, '');
        const cNormPhone = normalizePhone(c.phone || '');
        const cNormSecPhone = normalizePhone(c.secondaryPhone || '');
        const cName = (c.fullName || '').trim().toLowerCase();
        const cNat = (c.nationalId || '').trim();

        if (targetNationalId && cNat && targetNationalId === cNat) return true;
        if (targetNormPhone && cNormPhone && (targetNormPhone === cNormPhone || cNormPhone.endsWith(targetNormPhone) || targetNormPhone.endsWith(cNormPhone))) return true;
        if (targetNormPhone && cNormSecPhone && (targetNormPhone === cNormSecPhone || cNormSecPhone.endsWith(targetNormPhone) || targetNormPhone.endsWith(cNormSecPhone))) return true;
        if (targetPhone && cPhone && (targetPhone === cPhone || targetPhone.endsWith(cPhone) || cPhone.endsWith(targetPhone))) return true;
        if (targetPhone && cSecPhone && (targetPhone === cSecPhone || targetPhone.endsWith(cSecPhone) || cSecPhone.endsWith(targetPhone))) return true;
        if (targetName && cName && (targetName === cName || cName.includes(targetName) || targetName.includes(cName))) return true;
        return false;
      });

      if (matchedCustomer) {
        const norm = normalizeCustomerNames({
          fullName: matchedCustomer.fullName,
          firstName: matchedCustomer.firstName,
          fatherName: matchedCustomer.fatherName,
          lastName: matchedCustomer.lastName,
        });
        return {
          sourceType: 'customer_directory',
          sourceLabel: `دليل العملاء الموحد (${matchedCustomer.code || matchedCustomer.fullName})`,
          nationalId: matchedCustomer.nationalId || '',
          idType: matchedCustomer.idType || 'هوية سورية',
          actualReceiverName: matchedCustomer.fullName || norm.fullName,
          receiverRelation: 'المستلم بالذات',
          firstName: matchedCustomer.firstName || norm.firstName || '',
          fatherName: matchedCustomer.fatherName || norm.fatherName || parcel.receiver.fatherName || '',
          lastName: matchedCustomer.lastName || norm.lastName || '',
          motherName: matchedCustomer.motherName || (matchedCustomer as any)?.idMotherName || parcel.receiver.idMotherName || parcel.receiver.motherName || '',
          birthDate: normalizeBirthDateToISO(matchedCustomer.birthDate || (matchedCustomer as any)?.idBirthDate || parcel.receiver.birthDate || ''),
          birthPlace: matchedCustomer.birthPlace || (matchedCustomer.city ? `محافظة ${matchedCustomer.city}` : ''),
          civilRecord: matchedCustomer.civilRegistry || matchedCustomer.address || '',
          phone: matchedCustomer.phone,
          idPhotoFront: matchedCustomer.idPhotoFront || '',
          idPhotoBack: matchedCustomer.idPhotoBack || '',
          customer: matchedCustomer,
        };
      }
    }

    // 3. Search in all previous parcels (أرشيف بوالص سابقة موثقة)
    if (parcels && parcels.length > 0) {
      const prevParcel = parcels.find((p) => {
        if (p.id === parcel.id) return false;
        const pRec = p.receiver;
        if (!pRec) return false;

        const pPhone = (pRec.phone || '').replace(/\D/g, '');
        const pNormPhone = normalizePhone(pRec.phone || '');
        const pName = (pRec.name || '').trim().toLowerCase();

        if (targetNationalId && pRec.nationalId === targetNationalId) return true;
        if (targetNormPhone && pNormPhone && (targetNormPhone === pNormPhone || pNormPhone.endsWith(targetNormPhone) || targetNormPhone.endsWith(pNormPhone))) return true;
        if (targetPhone && pPhone && (targetPhone === pPhone || targetPhone.endsWith(pPhone) || pPhone.endsWith(targetPhone))) return true;
        if (targetName && pName && (targetName === pName || pName.includes(targetName) || targetName.includes(pName))) return true;
        return false;
      });

      if (prevParcel && prevParcel.receiver) {
        const pr = prevParcel.receiver;
        const parts = normalizeCustomerNames({
          fullName: pr.actualReceiverName || pr.name,
          firstName: pr.firstName,
          fatherName: pr.idFatherName || pr.fatherName,
          lastName: pr.lastName,
        });
        return {
          sourceType: 'previous_delivery',
          sourceLabel: `أرشيف تسليم سابق (بوليصة: ${prevParcel.trackingNumber})`,
          nationalId: pr.nationalId || '',
          idType: pr.idType || 'هوية سورية',
          actualReceiverName: pr.actualReceiverName || pr.name,
          receiverRelation: pr.receiverRelation || 'المستلم بالذات',
          firstName: pr.firstName || parts.firstName || '',
          fatherName: pr.idFatherName || pr.fatherName || parts.fatherName || '',
          lastName: pr.lastName || parts.lastName || '',
          motherName: pr.idMotherName || pr.motherName || '',
          birthDate: normalizeBirthDateToISO(pr.birthDate || (pr as any)?.idBirthDate || ''),
          birthPlace: pr.idBirthPlace || (pr.city ? `محافظة ${pr.city}` : ''),
          civilRecord: pr.idCivilRecord || pr.address || '',
          phone: pr.phone,
          idPhotoFront: pr.idPhotoFront || (pr as any)?.nationalIdPhotoUrl || '',
          idPhotoBack: pr.idPhotoBack || (pr as any)?.nationalIdBackPhotoUrl || '',
          customer: undefined,
        };
      }
    }

    return null;
  }, [parcel, customers, parcels]);

  // =========================================================================
  // 1. FINANCIAL LOGIC (MULTI-CURRENCY & HYBRID SETTLEMENT)
  // =========================================================================
  const paymentSummary = useMemo(() => getParcelPaymentSummary(currentParcel), [currentParcel]);

  const defaultShippingCurrency: Currency = paymentSummary.shippingCurrency;
  const defaultCodCurrency: Currency = paymentSummary.codCurrency;

  const [shippingCurrency, setShippingCurrency] = useState<Currency>(defaultShippingCurrency);
  const [codCurrency, setCodCurrency] = useState<Currency>(defaultCodCurrency);

  // المبالغ الأساسية المسجلة
  const shippingAmount = paymentSummary.shippingCost;
  const codAmount = paymentSummary.codAmount;
  const transferFee = paymentSummary.transferFee;

  // الحساب المالي المطلوب تحصيله بدقة بكل عملة (افتراضياً: كل عملة بعملتها)
  const initialRequiredSyp = useMemo(() => {
    if (paymentSummary.normalizedType === 'prepaid') return 0;
    let syp = 0;
    if (paymentSummary.normalizedType === 'cod') {
      if (paymentSummary.codCurrency === 'SYP') {
        syp += paymentSummary.codAmount + paymentSummary.transferFee;
      }
      if (!paymentSummary.isShippingPrepaidBySender && paymentSummary.shippingCurrency === 'SYP') {
        syp += paymentSummary.shippingCost;
      }
    } else if (paymentSummary.normalizedType === 'collect') {
      if (paymentSummary.shippingCurrency === 'SYP') {
        syp += paymentSummary.shippingCost;
      }
    }
    return syp;
  }, [paymentSummary]);

  const initialRequiredUsd = useMemo(() => {
    if (paymentSummary.normalizedType === 'prepaid') return 0;
    let usd = 0;
    if (paymentSummary.normalizedType === 'cod') {
      if (paymentSummary.codCurrency === 'USD') {
        usd += paymentSummary.codAmount + paymentSummary.transferFee;
      }
      if (!paymentSummary.isShippingPrepaidBySender && paymentSummary.shippingCurrency === 'USD') {
        usd += paymentSummary.shippingCost;
      }
    } else if (paymentSummary.normalizedType === 'collect') {
      if (paymentSummary.shippingCurrency === 'USD') {
        usd += paymentSummary.shippingCost;
      }
    }
    return usd;
  }, [paymentSummary]);

  // المبالغ المقبوضة فعلياً في الصناديق
  const [collectedSyp, setCollectedSyp] = useState<number>(initialRequiredSyp);
  const [collectedUsd, setCollectedUsd] = useState<number>(initialRequiredUsd);

  // نمط السداد المحدد: 'native' (كل عملة بعملتها - الافتراضي) | 'all_syp' | 'all_usd'
  const [collectionMethod, setCollectionMethod] = useState<'native' | 'all_syp' | 'all_usd'>('native');

  // إذا كانت سياسة تعدد العملات مقفلة، يتم تثبيت النمط على 'native' والمبالغ المقبوضة لكل عملة
  useEffect(() => {
    if (!isMultiCurrencyAllowed) {
      setCollectionMethod('native');
      setCollectedSyp(initialRequiredSyp);
      setCollectedUsd(initialRequiredUsd);
    }
  }, [isMultiCurrencyAllowed, initialRequiredSyp, initialRequiredUsd]);

  // المعادل المالي الكامل بالليرة أو الدولار عند الرغبة بالتحويل
  const totalDueInSypEquivalent =
    (shippingCurrency === 'SYP' ? shippingAmount : shippingAmount * exchangeRate) +
    (paymentSummary.normalizedType === 'cod'
      ? codCurrency === 'SYP'
        ? codAmount + transferFee
        : (codAmount + transferFee) * exchangeRate
      : 0);

  const totalDueInUsdEquivalent =
    (shippingCurrency === 'USD' ? shippingAmount : shippingAmount / exchangeRate) +
    (paymentSummary.normalizedType === 'cod'
      ? codCurrency === 'USD'
        ? codAmount + transferFee
        : (codAmount + transferFee) / exchangeRate
      : 0);

  const handleCollectionMethodChange = (method: 'native' | 'all_syp' | 'all_usd') => {
    if (!isMultiCurrencyAllowed) {
      setCollectionMethod('native');
      setCollectedSyp(initialRequiredSyp);
      setCollectedUsd(initialRequiredUsd);
      return;
    }

    setCollectionMethod(method);
    if (paymentSummary.normalizedType === 'prepaid') {
      setCollectedSyp(0);
      setCollectedUsd(0);
      return;
    }

    if (method === 'native') {
      // تحصيل كل عملة بعملتها الأساسية (مثلاً دولار بالدولار وليرة بالليرة)
      setCollectedSyp(initialRequiredSyp);
      setCollectedUsd(initialRequiredUsd);
    } else if (method === 'all_syp') {
      // سداد كامل القيمة بالليرة السورية
      setCollectedSyp(Math.round(totalDueInSypEquivalent));
      setCollectedUsd(0);
    } else if (method === 'all_usd') {
      // سداد كامل القيمة بالدولار الأمريكي
      setCollectedSyp(0);
      setCollectedUsd(parseFloat(totalDueInUsdEquivalent.toFixed(2)));
    }
  };

  // =========================================================================
  // 2. IDENTITY & CUSTOMER DIRECTORY INTEGRATION (نفس المبدأ والحقول ودليل العملاء في تسجيل طرد)
  // =========================================================================
  const idDocumentTypes = brandingSettings.idDocumentTypes || DEFAULT_ID_DOCUMENT_TYPES;

  // Initial name split using nameUtils
  const initialNameParts = useMemo(() => {
    return normalizeCustomerNames({
      fullName: parcel.receiver.name || '',
      firstName: parcel.receiver.firstName,
      fatherName: parcel.receiver.fatherName || parcel.receiver.idFatherName,
      lastName: parcel.receiver.lastName,
    });
  }, [parcel.receiver]);

  const [receiverIdType, setReceiverIdType] = useState<IdDocumentType>(
    parcel.receiver.idType || (existingCardRecord as any)?.idType || idDocumentTypes[0] || 'هوية سورية'
  );
  const [nationalId, setNationalId] = useState(
    existingCardRecord?.nationalId || ''
  );
  const [receiverFirstName, setReceiverFirstName] = useState(
    existingCardRecord?.firstName || initialNameParts.firstName || ''
  );
  const [receiverFatherName, setReceiverFatherName] = useState(
    existingCardRecord?.fatherName || initialNameParts.fatherName || ''
  );
  const [receiverLastName, setReceiverLastName] = useState(
    existingCardRecord?.lastName || initialNameParts.lastName || ''
  );
  const [receiverMotherName, setReceiverMotherName] = useState(
    existingCardRecord?.motherName || parcel.receiver.idMotherName || parcel.receiver.motherName || ''
  );

  const [receiverBirthDate, setReceiverBirthDate] = useState(
    existingCardRecord?.birthDate || parcel.receiver.birthDate || (parcel.receiver as any)?.idBirthDate || ''
  );

  // Verification result state for identity match
  const [verificationResult, setVerificationResult] = useState<ReceiverVerificationResult | null>(null);

  // Helper to sync all birth date representations
  const setSyncedBirthDate = (isoOrRaw: string) => {
    const iso = normalizeBirthDateToISO(isoOrRaw);
    setReceiverBirthDate(iso || isoOrRaw || '');
  };
  const [receiverPhone, setReceiverPhone] = useState(
    existingCardRecord?.phone || parcel.receiver.phone || ''
  );
  const [receiverRelation, setReceiverRelation] = useState(
    existingCardRecord?.receiverRelation || parcel.receiver.receiverRelation || 'المستلم بالذات'
  );
  const [idBirthPlace, setIdBirthPlace] = useState(
    existingCardRecord?.birthPlace || parcel.receiver.idBirthPlace || ''
  );
  const [idCivilRecord, setIdCivilRecord] = useState(
    existingCardRecord?.civilRecord || parcel.receiver.idCivilRecord || ''
  );
  const [deliveryNotes, setDeliveryNotes] = useState(
    parcel.deliveryNotes ||
      (existingCardRecord
        ? `تم التحقق واستيراد بيانات الهوية تلقائياً من ${existingCardRecord.sourceLabel}`
        : 'تم التحقق من الهوية وتسليم الطرد')
  );
  const [receiverIdPhotoFront, setReceiverIdPhotoFront] = useState<string | null>(null);
  const [receiverIdPhotoBack, setReceiverIdPhotoBack] = useState<string | null>(null);

  const actualReceiverName = useMemo(() => {
    const combined = [receiverFirstName.trim(), receiverFatherName.trim(), receiverLastName.trim()].filter(Boolean).join(' ');
    return combined || parcel.receiver.name || '';
  }, [receiverFirstName, receiverFatherName, receiverLastName, parcel.receiver.name]);

  // Execute Strict Identity Verification against Waybill Recipient
  const handleRunVerification = (customFields?: {
    receiverRelation?: string;
    firstName?: string;
    fatherName?: string;
    lastName?: string;
    nationalId?: string;
    motherName?: string;
    birthDate?: string;
    actualReceiverName?: string;
  }): ReceiverVerificationResult => {
    const rel = customFields?.receiverRelation ?? receiverRelation;
    const fName = customFields?.firstName !== undefined ? customFields.firstName : receiverFirstName;
    const faName = customFields?.fatherName !== undefined ? customFields.fatherName : receiverFatherName;
    const lName = customFields?.lastName !== undefined ? customFields.lastName : receiverLastName;
    const nid = customFields?.nationalId !== undefined ? customFields.nationalId : nationalId;
    const mName = customFields?.motherName !== undefined ? customFields.motherName : receiverMotherName;
    const bDate = customFields?.birthDate !== undefined ? customFields.birthDate : receiverBirthDate;
    const fullName = customFields?.actualReceiverName || [fName.trim(), faName.trim(), lName.trim()].filter(Boolean).join(' ') || actualReceiverName;

    const res = verifyReceiverIdentity(
      currentParcel,
      {
        receiverRelation: rel,
        actualReceiverName: fullName,
        firstName: fName,
        fatherName: faName,
        lastName: lName,
        nationalId: nid,
        motherName: mName,
        birthDate: bDate,
        phone: receiverPhone,
      },
      customers || []
    );

    setVerificationResult(res);
    if (!res.verified) {
      setSubmissionError(res.message);
    } else {
      setSubmissionError(null);
    }
    return res;
  };

  // Validation errors state
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});

  // Customer Directory states
  const [isCustomerDirectoryModalOpen, setIsCustomerDirectoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [multipleCustomerMatches, setMultipleCustomerMatches] = useState<Customer[]>([]);
  const [quickCustomerQuery, setQuickCustomerQuery] = useState('');
  const [isQuickCustomerDropdownOpen, setIsQuickCustomerDropdownOpen] = useState(false);
  const quickCustomerSearchRef = useRef<HTMLDivElement>(null);
  const [idCustomerStatus, setIdCustomerStatus] = useState<{
    type: 'existing' | 'new' | 'multiple' | 'none';
    customer?: Customer;
    message: string;
    scannedName?: string;
  } | null>(null);

  // Barcode Scanner states
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerStatus, setScannerStatus] = useState<string | null>(null);
  const [scannerErrorAlert, setScannerErrorAlert] = useState<string | null>(null);
  const [isScannedIdLocked, setIsScannedIdLocked] = useState(false);
  const [isScannerFocused, setIsScannerFocused] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickCustomerSearchRef.current && !quickCustomerSearchRef.current.contains(e.target as Node)) {
        setIsQuickCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick Customer Filtering (Name, Phone, Secondary Phone, National ID)
  const matchingCustomers = useMemo(() => {
    if (!quickCustomerQuery.trim()) return [];
    const q = quickCustomerQuery.trim().toLowerCase();
    const cleanQ = q.replace(/\D/g, '');
    return (customers || [])
      .filter((c) => {
        if (!c) return false;
        if (c.fullName && c.fullName.toLowerCase().includes(q)) return true;
        if (c.phone && c.phone.includes(q)) return true;
        if (c.secondaryPhone && c.secondaryPhone.includes(q)) return true;
        if (cleanQ.length >= 4 && c.nationalId && c.nationalId.replace(/\D/g, '').includes(cleanQ)) return true;
        return false;
      })
      .slice(0, 8);
  }, [customers, quickCustomerQuery]);

  // Honeywell Audio Synthesizer Feedback
  const playScannerAudio = (type: 'success' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      // Audio might fail if user hasn't interacted yet
    }
  };

  // Apply Customer Data to Fields (Safe merge by default)
  const applyCustomerData = (c: Customer, force: boolean = false) => {
    const norm = normalizeCustomerNames({
      fullName: c.fullName,
      firstName: c.firstName,
      fatherName: c.fatherName,
      lastName: c.lastName,
    });

    const fName = (c.firstName?.trim() || norm.firstName || '').trim();
    const father = (c.fatherName?.trim() || norm.fatherName || '').trim();
    const lName = (c.lastName?.trim() || norm.lastName || '').trim();
    const mName = (
      c.motherName?.trim() ||
      (c as any)?.idMotherName?.trim() ||
      (c as any)?.mother?.trim() ||
      ''
    ).trim();
    const rawBDate = c.birthDate || (c as any)?.idBirthDate || (c as any)?.dob || '';
    const bDate = normalizeBirthDateToISO(rawBDate ? String(rawBDate).trim() : '');
    const nId = (c.nationalId?.trim() || '').trim();
    const idType = c.idType || idDocumentTypes[0] || 'هوية سورية';
    const phone = (c.phone?.trim() || '').trim();
    const photoFront = c.idPhotoFront || '';
    const photoBack = c.idPhotoBack || '';
    const civil = c.address || '';
    const bPlace = c.city ? `محافظة ${c.city}` : '';

    // ✅ لا تكتب فوق ما أدخله المستخدم يدوياً إلا إذا كان force = true
    if (fName && (force || !receiverFirstName.trim())) setReceiverFirstName(fName);
    if (father && (force || !receiverFatherName.trim())) setReceiverFatherName(father);
    if (lName && (force || !receiverLastName.trim())) setReceiverLastName(lName);
    if (mName && (force || !receiverMotherName.trim())) setReceiverMotherName(mName);
    if (bDate && (force || !receiverBirthDate.trim())) setSyncedBirthDate(bDate);
    if (nId && (force || !nationalId.trim())) setNationalId(toLatinDigits(nId).slice(0, 11));
    if (phone && (force || !receiverPhone.trim())) setReceiverPhone(toLatinDigits(phone));
    if (idType && (force || !receiverIdType)) setReceiverIdType(idType);
    if (photoFront && (force || !receiverIdPhotoFront)) setReceiverIdPhotoFront(photoFront);
    if (photoBack && (force || !receiverIdPhotoBack)) setReceiverIdPhotoBack(photoBack);
    if (civil && (force || !idCivilRecord.trim())) setIdCivilRecord(civil);
    if (bPlace && (force || !idBirthPlace.trim())) setIdBirthPlace(bPlace);

    setSelectedCustomer(c);
    const displayFullName = c.fullName || norm.fullName || [fName, father, lName].filter(Boolean).join(' ');
    setQuickCustomerQuery(displayFullName);
    setIsQuickCustomerDropdownOpen(false);

    setIdCustomerStatus({
      type: 'existing',
      customer: c,
      message: `عميل موجود: ${displayFullName}`,
    });

    setInvalidFields({
      receiverFirstName: false,
      receiverFatherName: false,
      receiverLastName: false,
      receiverMotherName: false,
      receiverBirthDate: false,
      nationalId: false,
      receiverPhone: false,
    });
  };

  // Clear receiver fields
  const handleClearReceiverFields = () => {
    setSelectedCustomer(null);
    setIsScannedIdLocked(false);
    setScannerErrorAlert(null);
    setScannerStatus(null);
    setReceiverFirstName('');
    setReceiverFatherName('');
    setReceiverLastName('');
    setReceiverMotherName('');
    setSyncedBirthDate('');
    setNationalId('');
    setReceiverIdType(idDocumentTypes[0] || 'هوية سورية');
    setReceiverPhone('');
    setReceiverIdPhotoFront('');
    setReceiverIdPhotoBack('');
    setIdCivilRecord('');
    setIdBirthPlace('');
    setQuickCustomerQuery('');
    setIdCustomerStatus(null);
    setInvalidFields({
      receiverFirstName: false,
      receiverFatherName: false,
      receiverLastName: false,
      receiverMotherName: false,
      receiverBirthDate: false,
      nationalId: false,
      receiverPhone: false,
    });
  };

  // Upload handler for receiver ID photos (Front & Back)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (side === 'front') {
          setReceiverIdPhotoFront(reader.result as string);
        } else {
          setReceiverIdPhotoBack(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Check customer existence by phone or national ID (Architecture: Phone primary, National ID secondary, Name display-only)
  const checkExistingCustomer = (
    field: 'phone' | 'nationalId'
  ) => {
    const rawValue = field === 'phone' ? receiverPhone : nationalId;

    if (!rawValue || rawValue.length < 7) {
      setIdCustomerStatus({ type: 'none', message: '' });
      setMultipleCustomerMatches([]);
      return;
    }

    const result = field === 'phone'
      ? findCustomerByPhone(customers, rawValue)
      : findCustomerByNationalId(customers, rawValue);

    if (result.multiple.length > 1) {
      // Multiple matches — let user choose
      setMultipleCustomerMatches(result.multiple);
      setIdCustomerStatus({
        type: 'multiple',
        message: `يوجد ${result.multiple.length} عملاء بنفس الرقم — اختر العميل الصحيح`,
      });
      return;
    }

    if (result.match) {
      setMultipleCustomerMatches([]);
      setSelectedCustomer(result.match);
      setIdCustomerStatus({
        type: 'existing',
        customer: result.match,
        message: `عميل موجود: ${result.match.fullName}`,
      });
      return;
    }

    // No match — new customer
    setMultipleCustomerMatches([]);
    setIdCustomerStatus({
      type: 'new',
      message: 'عميل جديد — أدخل البيانات الكاملة من الهوية',
    });
  };

  // Quick add new customer to directory
  const handleQuickAddNewCustomer = () => {
    const fullNameCandidate = [receiverFirstName.trim(), receiverFatherName.trim(), receiverLastName.trim()].filter(Boolean).join(' ');
    const fullNameToUse = quickCustomerQuery.trim() || fullNameCandidate || (idCustomerStatus?.scannedName || '').trim();

    if (!fullNameToUse && !receiverFirstName.trim() && !receiverPhone.trim()) {
      alert('يرجى التأكد من كتابة اسم العميل أو رقم هاتفه أولاً');
      return;
    }

    const norm = normalizeCustomerNames({
      fullName: fullNameToUse || [receiverFirstName.trim(), receiverFatherName.trim(), receiverLastName.trim()].filter(Boolean).join(' '),
      firstName: receiverFirstName.trim(),
      fatherName: receiverFatherName.trim(),
      lastName: receiverLastName.trim(),
    });

    const newCustomer = addCustomer({
      fullName: norm.fullName,
      firstName: norm.firstName || receiverFirstName.trim(),
      fatherName: norm.fatherName || receiverFatherName.trim(),
      lastName: norm.lastName || receiverLastName.trim(),
      motherName: receiverMotherName.trim(),
      birthDate: receiverBirthDate.trim(),
      nationalId: nationalId.trim(),
      idType: receiverIdType,
      phone: receiverPhone.trim(),
      city: (currentParcel.receiver?.city as Governorate) || currentBranch.governorate,
      address: idCivilRecord.trim() || `مدينة ${currentParcel.receiver?.city || currentBranch.governorate}`,
      customerType: 'individual',
      idPhotoFront: receiverIdPhotoFront || undefined,
      idPhotoBack: receiverIdPhotoBack || undefined,
      notes: 'تمت إضافته كعميل جديد عبر شاشة تسليم الطرود وتوثيق الهوية',
    });

    applyCustomerData(newCustomer);
    setScannerStatus(`✓ تم تسجيل العميل [${norm.fullName}] بنجاح في دليل العملاء!`);
  };

  // Parse Syrian National ID Barcode
  const parseBarcodeData = (rawText: string) => {
    try {
      if (!rawText || rawText.trim().length < 2) return;

      const processed: SyrianIdScannerResult = processSyrianIdScannerPayload(rawText);
      const cleanNid = processed.nationalId || '';
      const bDate = processed.birthDate || '';

      setScannerErrorAlert(null);

      const cleanDigits = cleanNid.replace(/\D/g, '');
      const existingCust = cleanDigits.length >= 9
        ? (customers || []).find((c) => c.nationalId && c.nationalId.replace(/\D/g, '') === cleanDigits)
        : null;

      const smartProfile = resolveSmartSyrianCivilProfile(cleanNid, bDate);

      const finalFirstName = existingCust?.firstName || processed.firstName || '';
      const finalFatherName = existingCust?.fatherName || processed.fatherName || '';
      const finalLastName = existingCust?.lastName || processed.lastName || '';
      const finalMotherName = existingCust?.motherName || processed.motherName || '';
      const finalBirthDate = normalizeBirthDateToISO(existingCust?.birthDate || bDate || smartProfile.birthDate || '');
      const finalCity = existingCust?.city || processed.city || smartProfile.city || currentParcel.receiver?.city || currentBranch.governorate;

      if (cleanNid) setNationalId(toLatinDigits(cleanNid).slice(0, 11));
      if (finalFirstName) setReceiverFirstName(finalFirstName);
      if (finalFatherName) setReceiverFatherName(finalFatherName);
      if (finalLastName) setReceiverLastName(finalLastName);
      if (finalMotherName) setReceiverMotherName(finalMotherName);
      if (finalBirthDate) {
        setSyncedBirthDate(finalBirthDate);
      }
      if (existingCust?.phone && !receiverPhone) setReceiverPhone(toLatinDigits(existingCust.phone));
      if (existingCust?.idPhotoFront) setReceiverIdPhotoFront(existingCust.idPhotoFront);
      if (existingCust?.idPhotoBack) setReceiverIdPhotoBack(existingCust.idPhotoBack);

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

      setInvalidFields((prev) => ({
        ...prev,
        ...(finalFirstName ? { receiverFirstName: false } : {}),
        ...(finalFatherName ? { receiverFatherName: false } : {}),
        ...(finalLastName ? { receiverLastName: false } : {}),
        ...(finalMotherName ? { receiverMotherName: false } : {}),
        ...(finalBirthDate ? { receiverBirthDate: false } : {}),
        ...(cleanNid ? { nationalId: false } : {}),
      }));

      playScannerAudio('success');

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
      setBarcodeInput('');

      if (cleanNid) {
        setTimeout(() => {
          handleRunVerification({
            nationalId: cleanNid,
            firstName: finalFirstName,
            fatherName: finalFatherName,
            lastName: finalLastName,
            motherName: finalMotherName,
            birthDate: finalBirthDate,
            actualReceiverName: fullCandidate,
          });
        }, 120);
      }

      setTimeout(() => {
        if (!finalFirstName) {
          const nameEl = document.getElementById('input_receiver_first_name');
          if (nameEl) nameEl.focus();
        } else if (!receiverPhone) {
          const phoneEl = document.getElementById('input_receiver_phone');
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

  // Hardware Scanner Global Listener via useBarcodeDecoder
  useBarcodeDecoder({
    onScan: (decodedData) => {
      if (decodedData && decodedData.raw) {
        parseBarcodeData(decodedData.raw);
      }
    },
    enabled: true,
  });

  // Quick Simulation for testing when physical scanner is not attached
  const handleSimulateScan = () => {
    const govCode = '01'; // Damascus
    const restDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
    const mockId = existingCardRecord?.nationalId || parcel.receiver.nationalId || `${govCode}${restDigits}`;
    const recName = parcel.receiver.name || 'محمد أحمد العلي';
    const mockCode = receiverIdType.includes('فلسطين')
      ? `PALID|${mockId}|${recName}|يوسف|مريم|مخيم اليرموك - دمشق|قيد لاجئين 504`
      : `${mockId}|${recName}|أحمد|فاطمة|دمشق - الصالحية|قيد 312`;
    parseBarcodeData(mockCode);
  };

  // Check initial match with Customer Directory on mount
  useEffect(() => {
    if (existingCardRecord) {
      if (existingCardRecord.nationalId) setNationalId(toLatinDigits(existingCardRecord.nationalId).slice(0, 11));
      if (existingCardRecord.idType) setReceiverIdType(existingCardRecord.idType as IdDocumentType);
      if (existingCardRecord.fatherName) setReceiverFatherName(existingCardRecord.fatherName);
      if (existingCardRecord.motherName) setReceiverMotherName(existingCardRecord.motherName);
      if (existingCardRecord.birthDate) setSyncedBirthDate(existingCardRecord.birthDate);
      if (existingCardRecord.birthPlace) setIdBirthPlace(existingCardRecord.birthPlace);
      if (existingCardRecord.civilRecord) setIdCivilRecord(existingCardRecord.civilRecord);
      if (existingCardRecord.phone) setReceiverPhone(existingCardRecord.phone);
      if (existingCardRecord.idPhotoFront) setReceiverIdPhotoFront(existingCardRecord.idPhotoFront);
      if (existingCardRecord.idPhotoBack) setReceiverIdPhotoBack(existingCardRecord.idPhotoBack);
      if (existingCardRecord.actualReceiverName) {
        const parts = normalizeCustomerNames({
          fullName: existingCardRecord.actualReceiverName,
          firstName: existingCardRecord.firstName,
          fatherName: existingCardRecord.fatherName,
          lastName: existingCardRecord.lastName,
        });
        if (parts.firstName) setReceiverFirstName(parts.firstName);
        if (parts.fatherName) setReceiverFatherName(parts.fatherName);
        if (parts.lastName) setReceiverLastName(parts.lastName);
        setQuickCustomerQuery(parts.fullName);
      }
      if (existingCardRecord.customer) {
        setSelectedCustomer(existingCardRecord.customer);
        setIdCustomerStatus({
          type: 'existing',
          customer: existingCardRecord.customer,
          message: 'عميل مسجل في دليل العملاء الموحد',
        });
      }
      setDeliveryNotes(`تم التحقق واستيراد بيانات الهوية تلقائياً من ${existingCardRecord.sourceLabel}`);
      setScannerStatus(`✓ تم التعرف على بطاقة المستلم واستدعاء كامل بياناته من [${existingCardRecord.sourceLabel}]`);

      // Auto-verify if nationalId is complete
      if (existingCardRecord.nationalId && existingCardRecord.nationalId.length === 11) {
        setTimeout(() => {
          handleRunVerification({
            nationalId: existingCardRecord.nationalId,
            firstName: existingCardRecord.firstName,
            fatherName: existingCardRecord.fatherName,
            lastName: existingCardRecord.lastName,
            motherName: existingCardRecord.motherName,
            birthDate: existingCardRecord.birthDate,
            actualReceiverName: existingCardRecord.actualReceiverName,
            receiverRelation: existingCardRecord.receiverRelation,
          });
        }, 150);
      }
    } else {
      // Check customer directory for initial parcel receiver
      const normPhone = (parcel.receiver?.phone || '').replace(/\D/g, '');
      const normNid = (parcel.receiver?.nationalId || '').trim();
      const normName = (parcel.receiver?.name || '').trim().toLowerCase();
      const match = (customers || []).find((c) => {
        if (!c) return false;
        if (normNid && c.nationalId === normNid) return true;
        if (normPhone && c.phone && c.phone.replace(/\D/g, '') === normPhone) return true;
        if (normName && c.fullName && c.fullName.trim().toLowerCase() === normName) return true;
        return false;
      });
      if (match) {
        applyCustomerData(match);
      }
    }
  }, []);

  // Determine Governorate from first 2 digits of National ID
  const idGovCode = nationalId.slice(0, 2);
  const detectedGov = SYRIAN_GOV_CODES[idGovCode];

  // Branches
  const originBranch = branches.find((b) => b.id === parcel.originHubId);
  const destBranch = branches.find((b) => b.id === parcel.destinationHubId);

  // Form Submission
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setSubmissionError(null);

    // 0. Strict server connection check
    const isOnline = await ensureServerConnected();
    if (!isOnline) {
      // Keep modal and filled data completely intact
      return;
    }

    // Validate required fields
    const missing: string[] = [];
    const newInvalid: Record<string, boolean> = {};

    if (!receiverFirstName.trim() || receiverFirstName.trim().length < 2) {
      missing.push('الاسم الأول (حرفين على الأقل)');
      newInvalid.receiverFirstName = true;
    }
    if (!receiverFatherName.trim() || receiverFatherName.trim().length < 2) {
      missing.push('اسم الأب (حرفين على الأقل)');
      newInvalid.receiverFatherName = true;
    }
    if (!receiverLastName.trim() || receiverLastName.trim().length < 2) {
      missing.push('الكنية (حرفين على الأقل)');
      newInvalid.receiverLastName = true;
    }
    if (!receiverMotherName.trim() || receiverMotherName.trim().length < 2) {
      missing.push('اسم الأم (حرفين على الأقل)');
      newInvalid.receiverMotherName = true;
    }

    // Strict Birth Date validation: Days (1-31), Months (1-12), Year (4 digits)
    const bDateCheck = validateBirthDate(receiverBirthDate);
    if (!bDateCheck.isValid) {
      missing.push(bDateCheck.error || 'تاريخ الولادة بالأرقام فقط (اليوم من 1 إلى 31، الشهر من 1 إلى 12، والسنة 4 أرقام)');
      newInvalid.receiverBirthDate = true;
    }

    // Strict National ID validation: Exactly 11 digits
    const cleanNid = nationalId.replace(/\D/g, '');
    if (!cleanNid) {
      missing.push('الرقم الوطني / رقم الوثيقة (11 رقماً)');
      newInvalid.nationalId = true;
    } else if (cleanNid.length !== 11) {
      missing.push(`الرقم الوطني يجب أن يتكون من 11 رقماً حصراً (حالياً: ${cleanNid.length} أرقام)`);
      newInvalid.nationalId = true;
    }

    const cleanPhoneDigits = receiverPhone.trim().replace(/\D/g, '');
    if (!cleanPhoneDigits || cleanPhoneDigits.length < 9) {
      missing.push('رقم الهاتف (9 أرقام على الأقل)');
      newInvalid.receiverPhone = true;
    }

    if (!receiverIdPhotoFront) {
      missing.push('صورة الهوية (الوجه الأمامي)');
      newInvalid.receiverIdPhotoFront = true;
    }

    if (!receiverIdPhotoBack) {
      missing.push('صورة الهوية (الوجه الخلفي)');
      newInvalid.receiverIdPhotoBack = true;
    }

    if (missing.length > 0) {
      setInvalidFields(newInvalid);
      setSubmissionError(`يرجى استكمال الحقول الإلزامية لتسليم الطرد وتوثيق الهوية: ${missing.join('، ')}`);
      return;
    }

    // Strict identity verification check: Must match parcel recipient
    const vResult = handleRunVerification();
    if (!vResult.verified) {
      setSubmissionError(`⚠️ لا يمكن إتمام التسليم: ${vResult.message}`);
      return;
    }

    // اعتماد مبالغ الإيصال ومحرك التسعير كما هي بدون أي تعديل يدوي
    const sypToCollect = isMultiCurrencyAllowed ? collectedSyp : initialRequiredSyp;
    const usdToCollect = isMultiCurrencyAllowed ? collectedUsd : initialRequiredUsd;
    const totalCollected = sypToCollect + usdToCollect;
    const finalFullName = [receiverFirstName.trim(), receiverFatherName.trim(), receiverLastName.trim()].filter(Boolean).join(' ') || actualReceiverName.trim() || currentParcel.receiver.name;

    try {
      setIsSubmitting(true);

      const parcelId = parcel.id;
      const photoKeys: { front?: string; back?: string } = {};

      if (receiverIdPhotoFront) {
        if (receiverIdPhotoFront.startsWith('data:image/')) {
          const frontKey = `parcel_${parcelId}_receiver_id_front`;
          await setPhoto(frontKey, receiverIdPhotoFront);
          photoKeys.front = frontKey;
        } else {
          photoKeys.front = receiverIdPhotoFront;
        }
      }

      if (receiverIdPhotoBack) {
        if (receiverIdPhotoBack.startsWith('data:image/')) {
          const backKey = `parcel_${parcelId}_receiver_id_back`;
          await setPhoto(backKey, receiverIdPhotoBack);
          photoKeys.back = backKey;
        } else {
          photoKeys.back = receiverIdPhotoBack;
        }
      }

      onConfirm({
        nationalId: nationalId.trim(),
        idType: receiverIdType,
        idPhotoUrl: photoKeys.front || undefined,
        idBackPhotoUrl: photoKeys.back || undefined,
        collectedAmount: totalCollected > 0 ? totalCollected : currentParcel.totalDue,
        deliveryNotes: deliveryNotes.trim(),
        actualReceiverName: finalFullName,
        receiverRelation: receiverRelation.trim() || 'المستلم بالذات',
        idMotherName: receiverMotherName.trim(),
        idFatherName: receiverFatherName.trim(),
        idBirthPlace: idBirthPlace.trim(),
        idCivilRecord: idCivilRecord.trim(),
        collectedSyp: sypToCollect,
        collectedUsd: usdToCollect,
        shippingCurrency,
        codCurrency,
        receiverPhone: receiverPhone.trim(),
        receiverBirthDate: receiverBirthDate.trim(),
        receiverFirstName: receiverFirstName.trim(),
        receiverLastName: receiverLastName.trim(),
      });
    } catch (err: any) {
      console.error('Error submitting delivery handover:', err);
      setSubmissionError(err?.message || 'حدث خطأ أثناء حفظ التسليم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canDeliver =
    currentParcel.handlingStatus === 'received_at_dest' ||
    currentParcel.handlingStatus === 'with_courier' ||
    currentParcel.handlingStatus === 'out_for_delivery';

  if (!canDeliver) {
    return (
      <div
        className="fixed inset-0 z-[100] w-screen h-screen bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
        dir="rtl"
      >
        <div className="bg-slate-900 border border-amber-500/60 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 text-amber-400 pb-4 border-b border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="font-black text-base sm:text-lg text-white">لا يمكن التسليم</div>
              <div className="text-xs text-amber-300 font-mono mt-0.5">
                بوليصة: {parcel.trackingNumber}
              </div>
            </div>
          </div>

          <div className="bg-amber-950/70 border border-amber-500/50 rounded-xl p-4 text-xs text-amber-200 space-y-2 leading-relaxed">
            <div className="font-bold text-amber-300 text-sm">
              حالة الطرد الحالية: "{parcel.handlingStatus || 'غير محدد'}"
            </div>
            <p>
              لا يمكن إتمام التسليم لأن الشحنة لم يتم استلامها وتفريغها بالمستودع بعد.
              يجب أولاً تفريغ الشاحنة (زر "وصلت — ابدأ التفريغ" ثم "تفريغ كامل" أو "مطابقة الطرود وتأكيد التفريغ").
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition shadow-md"
            >
              إغلاق والعودة
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] w-screen h-screen h-[100dvh] bg-slate-950 flex flex-col overflow-hidden m-0 p-0"
      dir="rtl"
    >
      <div className="bg-slate-900 flex flex-col w-full h-full overflow-hidden">
        {/* ========================================================================= */}
        {/* COMPACT SLEEK FULLSCREEN WORKSTATION HEADER */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                تسليم الطرد وتوثيق الهوية ({receiverIdType === 'palestinian' ? 'فلسطيني' : 'السورية'})
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {parcel.trackingNumber}
              </span>
              {parcel.paperReceiptNumber && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline-block">
                  ورقي: {parcel.paperReceiptNumber}
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hidden md:inline-flex items-center gap-1">
                <ScanLine className="w-3 h-3 text-emerald-400" />
                <span>محطة الكاونتر</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="hidden xl:flex items-center gap-2.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">الفرع:</span>
              <strong className="text-slate-200">{currentBranch.name}</strong>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 flex items-center gap-1.5 transition-colors text-xs font-bold cursor-pointer"
              title="إغلاق وإلغاء (Esc)"
            >
              <X className="w-4 h-4 text-slate-400" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BANNER: AUTO-FETCHED PREVIOUS ID CARD DATA & ONE-CLICK COMPLETE DELIVERY */}
        {/* ========================================================================= */}
        {existingCardRecord && (
          <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border-b border-emerald-500/40 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-inner shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-emerald-300">
                    ✓ تم العثور على بطاقة هوية سابقة وموثقة في السجل
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                    {existingCardRecord.sourceLabel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>الرقم الوطني: <strong className="font-mono text-emerald-300">{nationalId}</strong></span>
                  <span>المستلم: <strong className="text-white">{actualReceiverName}</strong></span>
                  {receiverFatherName && <span>الأب: <span className="text-slate-200">{receiverFatherName}</span></span>}
                  {receiverMotherName && <span>الأم: <span className="text-slate-200">{receiverMotherName}</span></span>}
                  {idCivilRecord && <span>القيد: <span className="text-slate-300">{idCivilRecord}</span></span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>البيانات موثقة ومعتمدة من السجل</span>
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL BODY: FORM WITH FULL-HEIGHT SCROLLABLE BODY AND DOCKED STICKY FOOTER */}
        {/* ========================================================================= */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            
            {/* ------------------------------------------------------------------- */}
            {/* COLUMN 1: PARCEL SPECS & ROUTING (3.5 of 12) */}
            {/* ------------------------------------------------------------------- */}
            <div className="lg:col-span-4 space-y-3">
              {/* Route Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-cyan-400" />
                    <span>مسار الشحنة والأطراف</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                    {parcel.shippingCategory === 'postal' ? 'شحن بريدي' : 'شحن بضائع'}
                  </span>
                </div>

                {/* Route Flow */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block">مركز الإرسال:</span>
                    <strong className="text-white text-xs">{originBranch?.name || parcel.sender.city}</strong>
                    <span className="text-[10px] text-slate-400 block">{parcel.sender.city}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-400 rotate-180 shrink-0" />
                  <div className="text-left">
                    <span className="text-[9px] text-slate-500 block">مركز التسليم:</span>
                    <strong className="text-emerald-300 text-xs">{destBranch?.name || parcel.receiver.city}</strong>
                    <span className="text-[10px] text-slate-400 block">{parcel.receiver.city}</span>
                  </div>
                </div>

                {/* Sender & Receiver Info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <User className="w-3 h-3 text-cyan-400" />
                      <span>المرسل:</span>
                    </span>
                    <div className="font-bold text-slate-200 text-xs truncate">{parcel.sender.name}</div>
                    <div className="font-mono text-[10px] text-cyan-400 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" />
                      <span>{parcel.sender.phone}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-400" />
                      <span>المستلم المسجل:</span>
                    </span>
                    <div className="font-bold text-white text-xs break-words leading-tight">{parcel.receiver.name}</div>
                    <div className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" />
                      <span>{parcel.receiver.phone}</span>
                    </div>
                  </div>
                </div>

                {parcel.destinationAddress && (
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 text-[10px] block">عنوان التسليم:</span>
                      <span className="text-slate-200">{parcel.destinationAddress}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Physical Specs Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 pb-1 border-b border-slate-800">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>مواصفات الطرد والمحتوى</span>
                </span>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">الوزن الفعلي</span>
                    <strong className="text-amber-300 font-mono text-sm">{toLatinDigits(parcel.weightKg)} كغ</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">عدد القطع / الطرود</span>
                    <strong className="text-emerald-300 font-mono text-sm">{toLatinDigits(parcel.piecesCount || 1)} طرد</strong>
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-400 text-[10px]">نوع التغليف:</span>
                    <span className="font-bold text-white text-[11px]">{parcel.packageType}</span>
                  </div>
                  {parcel.contentDescription && (
                    <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]">
                      <span className="text-slate-400 text-[10px] block">وصف المحتوى:</span>
                      <span className="text-slate-200">{parcel.contentDescription}</span>
                    </div>
                  )}
                  {parcel.specialInstructions && (
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[10px] flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span>{parcel.specialInstructions}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timing */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>تاريخ الإنشاء:</span>
                  <span className="font-mono text-slate-300">
                    {formatLatinDate(parcel.createdAt)}
                  </span>
                </div>
                {parcel.arrivedAtDestAt && (
                  <div className="flex items-center justify-between">
                    <span>وصول المستودع:</span>
                    <span className="font-mono text-emerald-400">
                      {formatLatinTime(parcel.arrivedAtDestAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* COLUMN 2: FINANCIAL BREAKDOWN (قبض الإيصال المعتمد تلقائياً) */}
            {/* ------------------------------------------------------------------- */}
            <div className="lg:col-span-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                
                {/* Financial Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    <span>أجور التحصيل ومبالغ الإيصال</span>
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      currentParcel.paymentType === 'cod'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : currentParcel.paymentType === 'prepaid'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}
                  >
                    {currentParcel.paymentType === 'cod'
                      ? 'ضد الدفع (COD)'
                      : currentParcel.paymentType === 'prepaid'
                      ? 'مدفوع سلفاً'
                      : 'أجور على المستلم'}
                  </span>
                </div>

                {/* Line Items with Currencies */}
                <div className="space-y-2 text-xs">
                  
                  {/* Item 1: Freight / Shipping Cost */}
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-300 font-bold block">1. أجور الشحن:</span>
                      <span className="text-[10px] text-slate-400">
                        {currentParcel.paymentType === 'prepaid' ? 'مدفوعة مسبقاً من المرسل' : 'مستحقة بموجب الإيصال'}
                      </span>
                    </div>
                    <div className="text-left flex items-center gap-1.5">
                      <span className="font-mono text-sm font-black text-emerald-400">
                        {formatNumber(shippingAmount)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {shippingCurrency === 'SYP' ? 'ل.س' : '$'}
                      </span>
                    </div>
                  </div>

                  {/* Item 2: COD Amount (If COD) */}
                  {currentParcel.paymentType === 'cod' && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-amber-300 font-bold block">2. قيمة بضاعة الحوالة (COD):</span>
                        <span className="text-[10px] text-amber-400/80">تُحول للمرسل بعد القبض</span>
                      </div>
                      <div className="text-left flex items-center gap-1.5">
                        <span className="font-mono text-sm font-black text-amber-400">
                          {formatNumber(codAmount)}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          {codCurrency === 'USD' ? '$ USD' : 'ل.س'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Item 3: Transfer Fee */}
                  {currentParcel.paymentType === 'cod' && transferFee > 0 && (
                    <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">3. عمولة تحويل الحوالة:</span>
                      <span className="font-mono font-bold text-slate-300">
                        {formatCurrency(transferFee, codCurrency)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Receipt Total Card - No manual modification */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 pb-1.5 border-b border-slate-800 flex items-center justify-between">
                    <span>المبلغ المستحق بموجب الإيصال:</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                      معتمد من محرك التسعير
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {initialRequiredSyp > 0 && (
                      <div className="p-2 rounded-lg bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                        <span className="text-xs text-slate-400">مستحق الليرة السورية (صندوق SYP):</span>
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          {formatCurrency(initialRequiredSyp, 'SYP')}
                        </span>
                      </div>
                    )}
                    {initialRequiredUsd > 0 && (
                      <div className="p-2 rounded-lg bg-slate-950 border border-cyan-500/30 flex items-center justify-between">
                        <span className="text-xs text-slate-400">مستحق الدولار (صندوق USD):</span>
                        <span className="font-mono font-black text-cyan-400 text-sm">
                          {formatCurrency(initialRequiredUsd, 'USD')}
                        </span>
                      </div>
                    )}
                    {initialRequiredSyp === 0 && initialRequiredUsd === 0 && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs text-center font-bold">
                        طرد مسدد سلفاً بالكامل - لا توجد مبالغ مستحقة
                      </div>
                    )}
                  </div>
                </div>

                {/* ============================================================= */}
                {/* PROMINENT SINGLE QUICK ACTION BUTTON IN COLUMN 2 */}
                {/* ============================================================= */}
                <div className="p-3.5 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/40 space-y-2.5 shadow-xl">
                  <div className="text-xs font-bold text-slate-200 pb-1.5 border-b border-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>إجراء التسليم والقبض</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded">
                      قبض مباشر في الصندوق
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!verificationResult?.verified || isSubmitting}
                    onClick={(e) => handleSubmit(e)}
                    id="col2_btn_confirm_handover"
                    className={`w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      verificationResult?.verified
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25 ring-1 ring-emerald-300/50 cursor-pointer'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                    }`}
                    title={verificationResult?.verified ? 'إتمام التسليم والقبض' : 'الزر معطل حتى اكتمال التحقق من الهوية بنجاح 🔒'}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                        <span>جارٍ الحفظ والتوثيق...</span>
                      </span>
                    ) : verificationResult?.verified ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-slate-950" />
                        <span>حفظ وإتمام عملية التسليم والقبض وتوثيق الهوية</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-amber-400" />
                        <span>تحقق من هوية المستلم وإتمام التسليم 🔒</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* COLUMN 3: EXACT ID VERIFICATION & CUSTOMER DIRECTORY INTEGRATION (نفس المبدأ والحقول ودليل العملاء في تسجيل طرد) */}
            {/* ------------------------------------------------------------------- */}
            <div className="lg:col-span-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                
                {/* Header with Clear Fields action */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    <span>بيانات الهوية المدنية وقارئ السكنر</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearReceiverFields}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition cursor-pointer flex items-center gap-1 border border-slate-700"
                      title="تفريغ كافة حقول المستلم لإدخال جديد"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>تفريغ الحقول</span>
                    </button>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      الجمهورية العربية السورية
                    </span>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* BARCODE SCANNER SECTION (قارئ الهوية الرقمية - سطر واحد مدمج) */}
                {/* ============================================================= */}
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 shadow-sm flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => {
                        setBarcodeInput(e.target.value);
                        if (e.target.value.includes('\n') || e.target.value.length > 20) {
                          parseBarcodeData(e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          parseBarcodeData(barcodeInput);
                        }
                      }}
                      onFocus={() => setIsScannerFocused(true)}
                      onBlur={() => setIsScannerFocused(false)}
                      placeholder="قارئ الهوية: انقر هنا وامسح باركود الهوية..."
                      className={`w-full bg-slate-950 border rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold tracking-wider transition-all focus:outline-none ${
                        isScannerFocused
                          ? 'border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/30'
                          : 'border-cyan-500/50 text-slate-300'
                      }`}
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400 flex items-center pointer-events-none">
                      <Scan className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateScan}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    title="تجربة مسح آلي سريع للهوية السورية"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>مسح تجريبي</span>
                  </button>
                </div>
                  {/* Scanner Alert / Error Banner */}
                  {scannerErrorAlert && (
                    <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="leading-snug">{scannerErrorAlert}</span>
                    </div>
                  )}

                  {/* Scanner Success Status Feedback */}
                  {scannerStatus && !scannerErrorAlert && (
                    <div className="p-2 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold flex items-center justify-between gap-1.5 animate-in fade-in">
                      <div className="flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{scannerStatus}</span>
                      </div>
                      {isScannedIdLocked && (
                        <button
                          type="button"
                          onClick={() => setIsScannedIdLocked(false)}
                          className="text-[10px] text-cyan-300 hover:text-white underline underline-offset-2 shrink-0 cursor-pointer"
                        >
                          فك القفل للتعديل
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ============================================================= */}
                {/* CUSTOMER DIRECTORY INTEGRATION (دليل العملاء والبحث السريع) */}
                {/* ============================================================= */}
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>دليل العملاء والبحث السريع:</span>
                    </span>
                    <button
                      type="button"
                      id="btn_open_customer_directory"
                      onClick={() => setIsCustomerDirectoryModalOpen(true)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Users className="w-3 h-3 text-cyan-400" />
                      <span>دليل العملاء</span>
                    </button>
                  </div>

                  {/* Inline Auto-Suggest Search Input */}
                  <div ref={quickCustomerSearchRef} className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        value={quickCustomerQuery}
                        onChange={(e) => {
                          setQuickCustomerQuery(e.target.value);
                          setIsQuickCustomerDropdownOpen(true);
                        }}
                        onFocus={() => setIsQuickCustomerDropdownOpen(true)}
                        placeholder="اسم العميل كاملاً أو البحث (الاسم، الهاتف، الرقم الوطني)..."
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Suggestions Dropdown */}
                    {isQuickCustomerDropdownOpen && quickCustomerQuery.trim().length > 0 && (
                      <div className="absolute top-full right-0 left-0 mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                        {matchingCustomers.length > 0 ? (
                          <div className="divide-y divide-slate-800">
                            {matchingCustomers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => applyCustomerData(c)}
                                className="w-full px-3 py-2 text-right hover:bg-slate-800 transition flex items-center justify-between gap-2 text-xs group cursor-pointer"
                              >
                                <div>
                                  <div className="font-bold text-white group-hover:text-cyan-300">{c.fullName}</div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                    <span>هاتف: {c.phone}</span>
                                    {c.nationalId && <span>وطني: {c.nationalId}</span>}
                                    {c.city && <span>محافظة: {c.city}</span>}
                                  </div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold shrink-0">
                                  استدعاء
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-center space-y-2">
                            <p className="text-xs text-slate-400">
                              لا يوجد عميل مسجل سابقاً باسم "{quickCustomerQuery}"
                            </p>
                            <button
                              type="button"
                              onClick={handleQuickAddNewCustomer}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>إضافة [{quickCustomerQuery}] كعميل جديد</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Customer Status Badge */}
                  {idCustomerStatus && idCustomerStatus.type !== 'none' && (
                    <div
                      className={`p-2 rounded-lg text-xs flex items-center justify-between gap-2 animate-in fade-in ${
                        idCustomerStatus.type === 'existing'
                          ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                          : idCustomerStatus.type === 'multiple'
                          ? 'bg-amber-950/80 border border-amber-500/50 text-amber-200'
                          : 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {idCustomerStatus.type === 'existing' ? (
                          <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : idCustomerStatus.type === 'multiple' ? (
                          <Users className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <UserPlus className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className="font-bold truncate">
                          {idCustomerStatus.type === 'existing'
                            ? `عميل مسجل: ${idCustomerStatus.customer?.fullName || idCustomerStatus.message}`
                            : idCustomerStatus.type === 'multiple'
                            ? idCustomerStatus.message
                            : (idCustomerStatus.message || `عميل جديد: ${idCustomerStatus.scannedName || quickCustomerQuery}`)}
                        </span>
                      </div>

                      {idCustomerStatus.type === 'existing' ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {idCustomerStatus.customer && (
                            <button
                              type="button"
                              onClick={() => applyCustomerData(idCustomerStatus.customer!, true)}
                              className="text-[10px] px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shrink-0 cursor-pointer shadow-sm"
                              title="استدعاء وتعبئة بيانات العميل المسجل في الحقول"
                            >
                              استدعاء البيانات
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleClearReceiverFields}
                            className="text-[10px] text-slate-400 hover:text-white underline shrink-0 cursor-pointer"
                          >
                            تفريغ
                          </button>
                        </div>
                      ) : idCustomerStatus.type === 'multiple' ? (
                        <span className="text-[10px] text-amber-300/80 shrink-0">
                          اختر العميل من القائمة أدناه
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-amber-200/80 hidden sm:inline">
                            سيتم توثيقه وإضافته للدليل تلقائياً عند التسليم
                          </span>
                          <button
                            type="button"
                            onClick={handleQuickAddNewCustomer}
                            className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shrink-0 cursor-pointer"
                          >
                            + تسجيل مسبق
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ============================================================= */}
                {/* DETAILED CIVIL FIELDS (الاسم، الأب، الكنية، الأم، المواليد، الوطني، الهاتف) */}
                {/* ============================================================= */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  
                  {/* ============================================================= */}
                  {/* بيانات المستلم في البوليصة (READ-ONLY مرجع رسمي غير قابل للتعديل 🔒) */}
                  {/* ============================================================= */}
                  <div className="bg-slate-900/95 border-2 border-slate-700/80 rounded-xl p-3 space-y-2 shadow-inner">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>بيانات المستلم في البوليصة (READ-ONLY 🔒)</span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        مرجع المطابقة الرسمي
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {/* الاسم المسجل */}
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 block font-bold">الاسم المسجل:</span>
                          <span className="text-white font-black truncate block text-xs" title={parcel.receiver?.name}>
                            {parcel.receiver?.name || '—'}
                          </span>
                        </div>
                      </div>

                      {/* الهاتف المسجل */}
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-2">
                        <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 block font-bold">رقم الهاتف:</span>
                          <span className="font-mono text-cyan-300 font-black block text-xs dir-ltr text-right">
                            {parcel.receiver?.phone || '—'}
                          </span>
                        </div>
                      </div>

                      {/* الرقم الوطني المسجل */}
                      <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 block font-bold">الرقم الوطني:</span>
                          <span className="font-mono font-bold text-xs block text-slate-200">
                            {parcel.receiver?.nationalId
                              ? parcel.receiver.nationalId.length === 11
                                ? `*******${parcel.receiver.nationalId.slice(-4)}`
                                : parcel.receiver.nationalId
                              : 'غير مسجل مسبقاً'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 1: Name, Father, Last Name */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-0.5">
                          <span>الاسم:</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        {(!receiverRelation || receiverRelation === 'المستلم بالذات') ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-bold flex items-center gap-0.5" title="اسم المستلم مقفل ومطابق لبوليصة الشحن">
                            <Lock className="w-2.5 h-2.5" />
                            <span>مقفل 🔒</span>
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                            اسم الوكيل/المفوض
                          </span>
                        )}
                      </div>
                      <input
                        id="input_receiver_first_name"
                        type="text"
                        readOnly={!receiverRelation || receiverRelation === 'المستلم بالذات'}
                        value={receiverFirstName}
                        onChange={(e) => {
                          setReceiverFirstName(e.target.value);
                          setVerificationResult(null);
                          setInvalidFields((prev) => ({ 
                            ...prev, 
                            receiverFirstName: false 
                          }));
                        }}
                        placeholder="الاسم الأول (من الهوية)"
                        className={`w-full ${
                          (!receiverRelation || receiverRelation === 'المستلم بالذات')
                            ? 'bg-slate-900/90 text-slate-300 border-slate-700/80 cursor-not-allowed select-none'
                            : invalidFields.receiverFirstName
                            ? 'bg-slate-950 border-rose-500 ring-1 ring-rose-500/30 text-white'
                            : 'bg-slate-950 border-slate-700 focus:border-cyan-400 text-white'
                        } rounded-lg px-2.5 py-1.5 text-xs focus:outline-none`}
                        title={(!receiverRelation || receiverRelation === 'المستلم بالذات') ? 'اسم المستلم مقفل ومطابق لبوليصة الشحن (المستلم بالذات)' : 'أدخل الاسم الأول للوكيل/المفوض'}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-0.5">
                          <span>اسم الأب:</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        {(!receiverRelation || receiverRelation === 'المستلم بالذات') ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-bold flex items-center gap-0.5" title="اسم الأب مقفل ومطابق لبوليصة الشحن">
                            <Lock className="w-2.5 h-2.5" />
                            <span>مقفل 🔒</span>
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                            أب الوكيل
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        readOnly={!receiverRelation || receiverRelation === 'المستلم بالذات'}
                        value={receiverFatherName}
                        onChange={(e) => {
                          setReceiverFatherName(e.target.value);
                          setVerificationResult(null);
                          setInvalidFields((prev) => ({ 
                            ...prev, 
                            receiverFatherName: false 
                          }));
                        }}
                        placeholder="اسم الأب (من الهوية)"
                        className={`w-full ${
                          (!receiverRelation || receiverRelation === 'المستلم بالذات')
                            ? 'bg-slate-900/90 text-slate-300 border-slate-700/80 cursor-not-allowed select-none'
                            : invalidFields.receiverFatherName
                            ? 'bg-slate-950 border-rose-500 ring-1 ring-rose-500/30 text-white'
                            : 'bg-slate-950 border-slate-700 focus:border-cyan-400 text-white'
                        } rounded-lg px-2.5 py-1.5 text-xs focus:outline-none`}
                        title={(!receiverRelation || receiverRelation === 'المستلم بالذات') ? 'اسم الأب مقفل ومطابق لبوليصة الشحن' : 'أدخل اسم والد الوكيل/المفوض'}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-0.5">
                          <span>الكنية:</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        {(!receiverRelation || receiverRelation === 'المستلم بالذات') ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-bold flex items-center gap-0.5" title="الكنية مقفلة ومطابقة لبوليصة الشحن">
                            <Lock className="w-2.5 h-2.5" />
                            <span>مقفل 🔒</span>
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                            كنية الوكيل
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        readOnly={!receiverRelation || receiverRelation === 'المستلم بالذات'}
                        value={receiverLastName}
                        onChange={(e) => {
                          setReceiverLastName(e.target.value);
                          setVerificationResult(null);
                          setInvalidFields((prev) => ({ 
                            ...prev, 
                            receiverLastName: false 
                          }));
                        }}
                        placeholder="الكنية (من الهوية)"
                        className={`w-full ${
                          (!receiverRelation || receiverRelation === 'المستلم بالذات')
                            ? 'bg-slate-900/90 text-slate-300 border-slate-700/80 cursor-not-allowed select-none'
                            : invalidFields.receiverLastName
                            ? 'bg-slate-950 border-rose-500 ring-1 ring-rose-500/30 text-white'
                            : 'bg-slate-950 border-slate-700 focus:border-cyan-400 text-white'
                        } rounded-lg px-2.5 py-1.5 text-xs focus:outline-none`}
                        title={(!receiverRelation || receiverRelation === 'المستلم بالذات') ? 'الكنية مقفلة ومطابقة لبوليصة الشحن' : 'أدخل كنية الوكيل/المفوض'}
                      />
                    </div>
                  </div>

                  {/* Row 2: Mother Name & Birth Date */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-0.5">
                          <span>اسم الأم:</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        {isScannedIdLocked && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>موثق</span>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={receiverMotherName}
                        onChange={(e) => {
                          setReceiverMotherName(e.target.value);
                          setVerificationResult(null);
                          setInvalidFields((prev) => ({ ...prev, receiverMotherName: false }));
                        }}
                        placeholder="اسم والدة المستلم"
                        className={`w-full bg-slate-950 border ${
                          invalidFields.receiverMotherName ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-700 focus:border-cyan-400'
                        } rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-cyan-400" />
                          <span>تاريخ الولادة:</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        {isScannedIdLocked && receiverBirthDate && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>موثق</span>
                          </span>
                        )}
                      </div>

                      <BirthDateField
                        id="input_receiver_birth_date"
                        value={receiverBirthDate}
                        onChange={(iso, dmy) => {
                          setReceiverBirthDate(iso || dmy);
                          setVerificationResult(null);
                          setInvalidFields((prev) => ({ ...prev, receiverBirthDate: false }));
                        }}
                        required
                        isLocked={isScannedIdLocked && !!receiverBirthDate.trim()}
                        hasError={!!invalidFields.receiverBirthDate}
                        placeholder="DD/MM/YYYY (أرقام فقط)"
                      />
                    </div>
                  </div>

                  {/* Row 3: National ID & Phone */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-0.5">
                          <span>الرقم الوطني:</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        {isScannedIdLocked && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            <span>موثق</span>
                          </span>
                        )}
                      </div>
                      <input
                        id="input_receiver_national_id"
                        type="text"
                        inputMode="numeric"
                        maxLength={11}
                        value={nationalId}
                        onKeyDown={blockNonIntegerKeys}
                        onChange={(e) => {
                          const sanitized = toLatinDigits(sanitizeDigitsOnly(e.target.value)).slice(0, 11);
                          setNationalId(sanitized);
                          setVerificationResult(null);
                          setInvalidFields((prev) => ({ ...prev, nationalId: false }));
                        }}
                        onBlur={() => checkExistingCustomer('nationalId')}
                        placeholder="أدخل 11 رقماً للرقم الوطني"
                        className={`w-full bg-slate-950 border ${
                          invalidFields.nationalId ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-700 focus:border-cyan-400'
                        } rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold tracking-wider focus:outline-none`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-0.5">
                          <span>رقم الهاتف:</span>
                          <span className="text-rose-400">*</span>
                        </label>
                      </div>
                      <input
                        id="input_receiver_phone"
                        type="tel"
                        value={receiverPhone}
                        onKeyDown={blockNonPhoneKeys}
                        onChange={(e) => {
                          const sanitized = toLatinDigits(sanitizePhone(e.target.value));
                          setReceiverPhone(sanitized);
                          setVerificationResult(null);
                          setInvalidFields((prev) => ({ ...prev, receiverPhone: false }));
                        }}
                        onBlur={() => checkExistingCustomer('phone')}
                        placeholder="09xxxxxxxx"
                        className={`w-full bg-slate-950 border ${
                          invalidFields.receiverPhone ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-700 focus:border-cyan-400'
                        } rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none`}
                      />
                    </div>

                    {/* Multiple Customer Matches Selection Interface */}
                    {idCustomerStatus?.type === 'multiple' && multipleCustomerMatches.length > 1 && (
                      <div className="col-span-2 bg-amber-950/50 border border-amber-500/40 rounded-lg p-3 mt-2">
                        <div className="text-xs text-amber-300 font-bold mb-2">
                          ⚠️ يوجد {multipleCustomerMatches.length} عملاء بنفس الرقم — اختر الصحيح:
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {multipleCustomerMatches.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setIdCustomerStatus({
                                  type: 'existing',
                                  customer: c,
                                  message: `عميل موجود: ${c.fullName}`,
                                });
                                setMultipleCustomerMatches([]);
                              }}
                              className="w-full text-right px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-white cursor-pointer transition flex items-center justify-between gap-2"
                            >
                              <div className="font-bold">{c.fullName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {c.phone} • {c.nationalId ? `رقم وطني: ${c.nationalId.slice(-4)}` : 'بدون رقم وطني'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 4: Receiver Capacity & Delivery Note */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">صفة الاستلام:</label>
                      <select
                        value={receiverRelation}
                        onChange={(e) => {
                          const newRel = e.target.value;
                          setReceiverRelation(newRel);
                          setVerificationResult(null);
                          if (newRel === 'المستلم بالذات') {
                            setReceiverFirstName(existingCardRecord?.firstName || initialNameParts.firstName || '');
                            setReceiverFatherName(existingCardRecord?.fatherName || initialNameParts.fatherName || '');
                            setReceiverLastName(existingCardRecord?.lastName || initialNameParts.lastName || '');
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                      >
                        <option value="المستلم بالذات">المستلم بالذات</option>
                        <option value="وكيل شرعي">وكيل شرعي بموجب وكالة</option>
                        <option value="مفوض خطي">مفوض بتفويض خطي</option>
                        <option value="قريب درجة أولى">قريب درجة أولى (أب/أم/ابن/زوجة)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1">ملاحظة التسليم:</label>
                      <input
                        type="text"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="ملاحظات توثيق التسليم"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>



                  {/* ============================================================= */}
                  {/* IDENTITY VERIFICATION ACTION & STATUS CARD (فحص ومطابقة هوية المستلم) */}
                  {/* ============================================================= */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      id="btn_verify_receiver_identity"
                      onClick={() => handleRunVerification()}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-700 via-teal-700 to-cyan-600 hover:from-cyan-600 hover:to-teal-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                    >
                      <Search className="w-4 h-4" />
                      <span>🔍 فحص ومطابقة هوية المستلم مع البوليصة الآن</span>
                    </button>

                    {verificationResult && (
                      <div
                        className={`p-3.5 rounded-xl border space-y-1.5 transition animate-in fade-in ${
                          verificationResult.verified
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                            : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {verificationResult.verified ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          )}
                          <strong className="text-xs font-black">
                            {verificationResult.message}
                          </strong>
                        </div>
                        {verificationResult.verified ? (
                          <div className="text-[11px] text-emerald-300/90 pt-1 border-t border-emerald-500/30">
                            ✓ تم التحقق بنجاح من مطابقة الرقم الوطني والبيانات الشخصية للمستلم. يمكنك الآن إتمام التسليم.
                          </div>
                        ) : (
                          <div className="text-[11px] text-rose-300 pt-1 border-t border-rose-500/30">
                            ⚠️ لا يمكن التسليم حتى تطابق كافة البيانات المطلوبة لمنع تسليم الطرد لغير صاحبه.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* قسم صور الهوية */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs font-bold text-cyan-300">
                        صور الهوية (إلزامية لدليل العملاء)
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* الوجه الأمامي */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1">
                          <span>الوجه الأمامي</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            id="input_receiver_id_front"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const base64 = await fileToBase64(file);
                                setReceiverIdPhotoFront(base64);
                                setInvalidFields((prev) => ({ 
                                  ...prev, 
                                  receiverIdPhotoFront: false 
                                }));
                              } catch (err) {
                                console.error('Failed to load photo:', err);
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor="input_receiver_id_front"
                            className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                              invalidFields.receiverIdPhotoFront
                                ? 'border-rose-500 bg-rose-950/20'
                                : receiverIdPhotoFront
                                ? 'border-emerald-500 bg-emerald-950/20'
                                : 'border-slate-700 bg-slate-950/60 hover:border-cyan-500'
                            }`}
                          >
                            {receiverIdPhotoFront ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-300">
                                  تم رفع الصورة
                                </span>
                              </>
                            ) : (
                              <>
                                <Camera className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-400">
                                  التقط أو ارفع
                                </span>
                              </>
                            )}
                          </label>
                          
                          {receiverIdPhotoFront && (
                            <div className="mt-2 relative">
                              <img
                                src={receiverIdPhotoFront}
                                alt="ID Front"
                                className="w-full h-24 object-cover rounded-lg border border-slate-700"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setReceiverIdPhotoFront(null);
                                }}
                                className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* الوجه الخلفي */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block mb-1 flex items-center gap-1">
                          <span>الوجه الخلفي</span>
                          <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            id="input_receiver_id_back"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const base64 = await fileToBase64(file);
                                setReceiverIdPhotoBack(base64);
                                setInvalidFields((prev) => ({ 
                                  ...prev, 
                                  receiverIdPhotoBack: false 
                                }));
                              } catch (err) {
                                console.error('Failed to load photo:', err);
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor="input_receiver_id_back"
                            className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                              invalidFields.receiverIdPhotoBack
                                ? 'border-rose-500 bg-rose-950/20'
                                : receiverIdPhotoBack
                                ? 'border-emerald-500 bg-emerald-950/20'
                                : 'border-slate-700 bg-slate-950/60 hover:border-cyan-500'
                            }`}
                          >
                            {receiverIdPhotoBack ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-emerald-300">
                                  تم رفع الصورة
                                </span>
                              </>
                            ) : (
                              <>
                                <Camera className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-400">
                                  التقط أو ارفع
                                </span>
                              </>
                            )}
                          </label>
                          
                          {receiverIdPhotoBack && (
                            <div className="mt-2 relative">
                              <img
                                src={receiverIdPhotoBack}
                                alt="ID Back"
                                className="w-full h-24 object-cover rounded-lg border border-slate-700"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setReceiverIdPhotoBack(null);
                                }}
                                className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* حالة الصور */}
                    <div className="text-[10px] text-slate-400 text-center">
                      {receiverIdPhotoFront && receiverIdPhotoBack ? (
                        <span className="text-emerald-400 flex items-center justify-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          جميع صور الهوية مرفوعة
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center justify-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          يجب رفع صورتي الهوية (أمامي وخلفي)
                        </span>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>

        {/* Global Submission Error if any */}
        {submissionError && (
          <div className="mx-4 sm:mx-6 mb-2 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{submissionError}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ALWAYS VISIBLE STICKY FOOTER BAR WITH PRIMARY ACTION */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 border-t border-slate-800 px-3 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs cursor-pointer transition"
            >
              إلغاء وتراجع
            </button>
            <span className="text-xs text-slate-400 hidden sm:inline">
              بوليصة: <span className="font-mono text-cyan-300 font-bold">{parcel.trackingNumber}</span> | المستلم: <span className="text-white font-bold">{actualReceiverName || currentParcel.receiver.name}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!verificationResult?.verified || isSubmitting}
              id="sticky_btn_confirm_delivery"
              className={`px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-lg flex items-center gap-2 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                verificationResult?.verified
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25 ring-1 ring-emerald-300/50 cursor-pointer'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
              }`}
              title={verificationResult?.verified ? 'إتمام التسليم والقبض' : 'الزر معطل حتى اكتمال التحقق من الهوية بنجاح 🔒'}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>جارٍ الحفظ والتوثيق...</span>
                </span>
              ) : verificationResult?.verified ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-slate-950" />
                  <span>حفظ وإتمام عملية التسليم والقبض وتوثيق الهوية</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>تحقق من هوية المستلم وإتمام التسليم 🔒</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>

      {/* Customer Directory Modal */}
      <CustomerDirectoryModal
        isOpen={isCustomerDirectoryModalOpen}
        onClose={() => setIsCustomerDirectoryModalOpen(false)}
        onSelectCustomer={(c) => {
          applyCustomerData(c);
          setIsCustomerDirectoryModalOpen(false);
        }}
        mode="picker"
      />
    </div>
  </div>
);
};
